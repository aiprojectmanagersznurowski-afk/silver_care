import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { RESIDENT_ASSIGNMENT } from '@silvercare/contracts/src/generated/voice'
import ffmpegPath from 'ffmpeg-static'

const { maxAudioBytes } = RESIDENT_ASSIGNMENT.sourceReview
const exec = promisify(execFile)
const sampleRate = 16000
const pcmBytesPerMs = sampleRate * 2 / 1000

export class VoiceAudioUnavailable extends Error {
  constructor() {
    super('VOICE_AUDIO_UNAVAILABLE')
  }
}

function audioFormat(bytes: Buffer) {
  if (bytes.readUInt32BE(0) === 0x1a45dfa3) return 'matroska'
  if (bytes.toString('ascii', 0, 4) === 'OggS') return 'ogg'
  if (bytes.toString('ascii', 4, 8) === 'ftyp') return 'mov'
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE') return 'wav'
  throw new VoiceAudioUnavailable()
}

function wav(pcm: Buffer) {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(pcm.length + 36, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return new Blob([new Uint8Array(header), new Uint8Array(pcm)], { type: 'audio/wav' })
}

export async function clipVoiceAudio(source: Blob, hash: string, startMs: number, endMs: number) {
  const duration = endMs - startMs
  const expectedSize = duration * pcmBytesPerMs
  if (source.size < 12 || source.size > maxAudioBytes || !Number.isSafeInteger(startMs)
    || !Number.isSafeInteger(endMs) || startMs < 0 || duration <= 0 || expectedSize > maxAudioBytes - 44) {
    throw new VoiceAudioUnavailable()
  }
  const bytes = Buffer.from(await source.arrayBuffer())
  if (createHash('sha256').update(bytes).digest('hex') !== hash) throw new VoiceAudioUnavailable()
  const format = audioFormat(bytes)
  if (!ffmpegPath) throw new Error('VOICE_AUDIO_DECODER_UNAVAILABLE')

  const scratch = await mkdtemp(join(tmpdir(), 'sc-voice-'))
  try {
    const input = join(scratch, 'source')
    await writeFile(input, bytes, { mode: 0o600 })
    const { stdout } = await exec(ffmpegPath, [
      '-nostdin', '-hide_banner', '-loglevel', 'error', '-xerror', '-protocol_whitelist', 'file,pipe',
      '-threads', '1', '-f', format, '-ss', (startMs / 1000).toFixed(3), '-i', input,
      '-map', '0:a:0', '-vn', '-sn', '-dn', '-t', (duration / 1000).toFixed(3), '-ar', String(sampleRate),
      '-ac', '1', '-f', 's16le', 'pipe:1',
    ], { encoding: 'buffer', timeout: 20000, maxBuffer: maxAudioBytes, windowsHide: true })
      .catch((error: NodeJS.ErrnoException) => {
        if (typeof error.code === 'number') throw new VoiceAudioUnavailable()
        throw new Error('VOICE_AUDIO_DECODER_UNAVAILABLE')
      })
    if (!stdout.length || stdout.length < expectedSize - pcmBytesPerMs) throw new VoiceAudioUnavailable()
    return wav(stdout.subarray(0, expectedSize))
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}
