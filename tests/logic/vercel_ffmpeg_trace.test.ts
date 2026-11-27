import { accessSync, constants, globSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import nextConfig from '../../apps/web/next.config'

const appRoot = fileURLToPath(new URL('../../apps/web/', import.meta.url))
const binaryName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
const binary = realpathSync(join(appRoot, 'node_modules', 'ffmpeg-static', binaryName))

describe('@REQ: VOICE-RESIDENT-ASSIGN pakowanie dekodera audio', () => {
  it.each(['/api/cron/process-voice-captures', '/api/voice/assignment'])(
    'dołącza rzeczywisty plik wykonywalny ffmpeg do %s',
    (route) => {
      const includes = nextConfig.outputFileTracingIncludes?.[route] ?? []
      const files = includes.flatMap((pattern) => globSync(pattern, { cwd: appRoot }))
      expect(files.map((file) => join(appRoot, file))).toEqual([binary])
      expect(() => accessSync(binary, constants.X_OK)).not.toThrow()
    },
  )
})
