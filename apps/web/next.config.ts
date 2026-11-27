import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

// Jeśli w apps/web nie ma osobnego .env.local, wczytaj zmienne ze wspólnego .env.local z korzenia repozytorium
const rootEnv = path.resolve(__dirname, "../../.env.local");
if (fs.existsSync(rootEnv)) {
  const content = fs.readFileSync(rootEnv, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

// Trace the binary in pnpm's store so the function bundle uses its physical path.
const ffmpegBinary = `../../node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg${process.platform === 'win32' ? '.exe' : ''}`;

const nextConfig: NextConfig = {
  transpilePackages: ['@silvercare/contracts'],
  serverExternalPackages: ['ffmpeg-static'],
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  outputFileTracingIncludes: {
    '/api/cron/process-voice-captures': [ffmpegBinary],
    '/api/voice/assignment': [ffmpegBinary],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  },
};

export default nextConfig;
