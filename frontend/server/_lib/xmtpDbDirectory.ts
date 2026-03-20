import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

declare const process: { env: Record<string, string | undefined>; cwd: () => string }

function countDbFiles(dirPath: string): number {
  try {
    return fs.readdirSync(dirPath).filter((name) => name.endsWith('.db3')).length
  } catch {
    return 0
  }
}

/**
 * List all `.db3` files under an XMTP root (e.g. `/data/.xmtp-data`).
 * The XMTP SDK may nest DBs under subfolders such as `v3/` — a flat directory
 * scan misses them and incorrectly logs "no .db3 files" on every boot.
 */
export function listXmtpDb3FilesUnderRoot(rootDir: string, maxDepth = 6): string[] {
  const out: string[] = []
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        walk(full, depth + 1)
      } else if (ent.isFile() && ent.name.endsWith('.db3')) {
        out.push(full)
      }
    }
  }
  walk(rootDir, 0)
  return out
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
 * 4) /tmp/.xmtp-data for serverless runtimes
 * 5) CWD fallback (only if writable)
 */
export function resolveXmtpDbDirectory(): string {
  const fromEnv = (process.env.XMTP_DB_DIRECTORY ?? '').trim()
  if (fromEnv) {
    if (ensureWritableDir(fromEnv)) return fromEnv
    console.warn(`[xmtp] XMTP_DB_DIRECTORY is not writable: ${fromEnv}. Falling back to auto-detected writable path.`)
  }

  const cwdDir = path.join(process.cwd(), '.xmtp-data')
  const persistentDir = '/data/.xmtp-data'
  const tmpDir = path.join(os.tmpdir(), '.xmtp-data')

  const cwdDbCount = countDbFiles(cwdDir)
  if (cwdDbCount > 0 && ensureWritableDir(cwdDir)) {
    return cwdDir
  }

  if (ensureWritableDir(persistentDir)) return persistentDir
  if (ensureWritableDir(tmpDir)) return tmpDir
  if (ensureWritableDir(cwdDir)) return cwdDir

  // Last-resort defensive fallback.
  return tmpDir
}
