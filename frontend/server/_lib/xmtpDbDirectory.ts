import fs from 'node:fs'
import path from 'node:path'

declare const process: { env: Record<string, string | undefined>; cwd: () => string }

function countDbFiles(dirPath: string): number {
  try {
    return fs.readdirSync(dirPath).filter((name) => name.endsWith('.db3')).length
  } catch {
    return 0
  }
}

function ensureWritableDir(dirPath: string): boolean {
  try {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 })
    fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Resolve a stable XMTP DB directory with persistence-first behavior.
 *
 * Priority:
 * 1) XMTP_DB_DIRECTORY if explicitly set
 * 2) Existing CWD db with .db3 files (to keep reusing an already active installation)
 * 3) /data/.xmtp-data when writable (persistent volume default on Railway/Docker)
 * 4) CWD fallback
 */
export function resolveXmtpDbDirectory(): string {
  const fromEnv = (process.env.XMTP_DB_DIRECTORY ?? '').trim()
  if (fromEnv) {
    if (ensureWritableDir(fromEnv)) return fromEnv
    console.warn(`[xmtp] XMTP_DB_DIRECTORY is not writable: ${fromEnv}. Falling back to auto-detected writable path.`)
  }

  const cwdDir = path.join(process.cwd(), '.xmtp-data')
  const persistentDir = '/data/.xmtp-data'

  const cwdDbCount = countDbFiles(cwdDir)
  if (cwdDbCount > 0) {
    ensureWritableDir(cwdDir)
    return cwdDir
  }

  if (ensureWritableDir(persistentDir)) return persistentDir

  ensureWritableDir(cwdDir)
  return cwdDir
}
