import fs from 'node:fs'
import path from 'node:path'

declare const process: {
  env: Record<string, string | undefined>
  cwd: () => string
}

type EnvMap = Record<string, string>

let cachedFallbackEnv: EnvMap | null = null
let cachedFallbackSignature = ''

function parseBoolean(value: unknown, fallback: boolean): boolean {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return fallback
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return true
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return false
  return fallback
}

function decodeQuotedValue(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1)
  }
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
  return value.replace(/\s+#.*$/g, '').trim()
}

function parseEnvFileContent(content: string): EnvMap {
  const values: EnvMap = {}
  const lines = content.replace(/^\uFEFF/, '').split('\n')
  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const line = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed
    const eqIdx = line.indexOf('=')
    if (eqIdx <= 0) continue
    const key = line.slice(0, eqIdx).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    const valueRaw = line.slice(eqIdx + 1)
    values[key] = decodeQuotedValue(valueRaw)
  }
  return values
}

function resolveDefaultFallbackFiles(): string[] {
  const cwd = process.cwd()
  const dirs = new Set<string>()
  dirs.add(cwd)
  dirs.add(path.join(cwd, 'frontend'))
  if (path.basename(cwd) === 'frontend') {
    dirs.add(path.dirname(cwd))
  }

  const fileNames = ['.env.local', '.env.development.local', '.env.development', '.env']
  const files: string[] = []
  for (const dir of dirs) {
    for (const fileName of fileNames) {
      const filePath = path.resolve(dir, fileName)
      try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          files.push(filePath)
        }
      } catch {
        // Ignore inaccessible paths in constrained runtimes.
      }
    }
  }

  return [...new Set(files)]
}

function resolveFallbackFilesFromEnv(): string[] {
  const configured = String(process.env.SERVER_ENV_FILE_FALLBACK_FILES ?? '').trim()
  if (!configured) return resolveDefaultFallbackFiles()
  const files = configured
    .split(/[,\n]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => (path.isAbsolute(entry) ? entry : path.resolve(process.cwd(), entry)))
  return [...new Set(files)]
}

function shouldUseFileFallback(): boolean {
  if (!parseBoolean(process.env.SERVER_ENV_FILE_FALLBACK, true)) return false
  if (parseBoolean(process.env.SERVER_ENV_FILE_FALLBACK_FORCE, false)) return true
  const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase()
  const isVitest = Boolean(String(process.env.VITEST ?? '').trim())
  if (isVitest || nodeEnv === 'test') return false
  if (nodeEnv === 'production') return false
  return true
}

function loadFallbackEnv(): EnvMap {
  const files = resolveFallbackFilesFromEnv()
  const signature = files.join('|')
  if (cachedFallbackEnv && cachedFallbackSignature === signature) {
    return cachedFallbackEnv
  }

  const merged: EnvMap = {}
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const parsed = parseEnvFileContent(content)
      for (const [key, value] of Object.entries(parsed)) {
        if (!key) continue
        // First file wins. Order is local-first.
        if (!(key in merged)) merged[key] = value
      }
    } catch {
      // Ignore unreadable files and continue to remaining candidates.
    }
  }

  cachedFallbackEnv = merged
  cachedFallbackSignature = signature
  return merged
}

export function readServerEnvVar(key: string): string {
  const direct = String(process.env[key] ?? '').trim()
  if (direct) return direct
  if (!shouldUseFileFallback()) return ''
  const fallback = loadFallbackEnv()
  return String(fallback[key] ?? '').trim()
}

export function resetServerEnvCacheForTests(): void {
  cachedFallbackEnv = null
  cachedFallbackSignature = ''
}
