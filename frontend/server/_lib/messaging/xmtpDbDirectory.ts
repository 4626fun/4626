import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

declare const process: { env: Record<string, string | undefined>; cwd: () => string }

const RAILWAY_PERSISTENT_XMTP_DIR = '/data/.xmtp-data'
const warnedNonWritableEnvXmtpDirs = new Set<string>()

function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL_ENV)
}

function isRailwayPersistentXmtpPath(dirPath: string): boolean {
  const resolved = path.resolve(dirPath).replace(/[\\/]+$/, '')
  return resolved === RAILWAY_PERSISTENT_XMTP_DIR
}

function countDbFiles(dirPath: string): number {
  try {
    return fs.readdirSync(dirPath).filter((name) => name.endsWith('.db3')).length
  } catch {
    return 0
  }
}

function normalizeAbsolutePath(input: string, options?: { preferRealpath?: boolean }): string {
  let resolved = path.resolve(input)
  if (options?.preferRealpath) {
    const segments: string[] = []
    let cursor = resolved
    while (!fs.existsSync(cursor)) {
      const parent = path.dirname(cursor)
      if (parent === cursor) break
      segments.unshift(path.basename(cursor))
      cursor = parent
    }
    try {
      const realBase = fs.realpathSync.native(cursor)
      resolved = segments.length > 0 ? path.join(realBase, ...segments) : realBase
    } catch {
      // Fall back to lexical resolution when the path does not exist yet.
    }
  }
  if (resolved === path.sep) return resolved
  return resolved.replace(/[\\/]+$/, '')
}

function unescapeMountInfoPath(input: string): string {
  return input.replace(/\\([0-7]{3})/g, (_match, octal: string) =>
    String.fromCharCode(Number.parseInt(octal, 8)),
  )
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

/**
 * Parse mount points from `/proc/self/mountinfo`.
 * Paths in mountinfo escape spaces and special bytes using octal escapes.
 */
export function parseMountInfoMountPoints(mountInfoText: string): string[] {
  const seen = new Set<string>()
  for (const line of mountInfoText.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split(' ')
    if (parts.length < 5) continue
    const mountPoint = parts[4]
    if (!mountPoint) continue
    seen.add(normalizeAbsolutePath(unescapeMountInfoPath(mountPoint)))
  }
  return Array.from(seen)
}

/**
 * Return the closest mounted ancestor for a target path, or null when mount
 * info is unavailable.
 */
export function findMountedAncestorPath(targetPath: string, mountInfoText?: string): string | null {
  let source = mountInfoText
  if (source === undefined) {
    try {
      source = fs.readFileSync('/proc/self/mountinfo', 'utf8')
    } catch {
      return null
    }
  }

  const normalizedTarget = normalizeAbsolutePath(targetPath, { preferRealpath: true })
  let bestMatch: string | null = null
  for (const mountPoint of parseMountInfoMountPoints(source)) {
    const isPrefix =
      normalizedTarget === mountPoint ||
      normalizedTarget.startsWith(mountPoint === path.sep ? path.sep : `${mountPoint}${path.sep}`)
    if (!isPrefix) continue
    if (!bestMatch || mountPoint.length > bestMatch.length) {
      bestMatch = mountPoint
    }
  }
  return bestMatch
}

/**
 * True when the target path lives on a dedicated mount, not just the
 * container root filesystem (`/`).
 */
export function hasDedicatedMount(targetPath: string, mountInfoText?: string): boolean {
  const mountedAncestor = findMountedAncestorPath(targetPath, mountInfoText)
  return !!mountedAncestor && mountedAncestor !== path.sep
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
    const expectedServerlessRailwayPath =
      isServerlessRuntime() && isRailwayPersistentXmtpPath(fromEnv)
    if (!expectedServerlessRailwayPath && !warnedNonWritableEnvXmtpDirs.has(fromEnv)) {
      warnedNonWritableEnvXmtpDirs.add(fromEnv)
      console.warn(
        `[xmtp] XMTP_DB_DIRECTORY is not writable: ${fromEnv}. Falling back to auto-detected writable path.`,
      )
    }
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
