import { createHash, randomBytes } from 'node:crypto'

declare const process: { env: Record<string, string | undefined> }

type RedactionOptions = {
  allowFields?: string[]
  pseudonymizeFields?: string[]
  maskAddresses?: boolean
  maxStringLength?: number
  maxArrayItems?: number
  maxDepth?: number
}

const DEFAULT_PSEUDONYMIZE_FIELDS = [
  'userId',
  'telegramUserId',
  'chatId',
  'profileId',
  'principalId',
  'ownerAddress',
  'canonicalWallet',
]

const DENY_KEY_PATTERNS = [
  /private[_-]?key/i,
  /seed/i,
  /mnemonic/i,
  /passphrase/i,
  /signed[_-]?payload/i,
  /signature/i,
  /webhook/i,
  /incident/i,
  /(stack|trace)/i,
  /authorization/i,
  /secret/i,
  /api[_-]?key/i,
]

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

// M-23 (4626-332): the previous fallback was a hardcoded literal
// '4626-agent-redaction'. Anyone with the source could reverse the
// pseudonyms by recomputing `sha256(salt + knownId)` over a candidate
// space (e.g. all Telegram user IDs in a leak). The salt MUST be
// configured per-deployment.
//
// Policy:
//   1. If `AGENT_REDACTION_SALT` is set and >= 16 chars, use it.
//   2. In development (`NODE_ENV !== 'production'`) fall back to a
//      process-lifetime random salt so local runs work without env
//      setup, but no two boots produce the same pseudonym space.
//   3. In production with no salt configured, generate a process-lifetime
//      random salt AND log a one-shot warning so the misconfiguration is
//      visible. Pseudonyms are still unguessable, just not stable
//      across restarts — which is the correct failure mode: no operator
//      should depend on stability of redacted IDs without an explicit salt.
let cachedSalt: string | null = null
let loggedSaltWarning = false

function toSalt(): string {
  if (cachedSalt !== null) return cachedSalt
  const configured = String(process.env.AGENT_REDACTION_SALT ?? '').trim()
  if (configured.length >= 16) {
    cachedSalt = configured
    return cachedSalt
  }
  const isProduction = String(process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production'
  if (isProduction && !loggedSaltWarning) {
    loggedSaltWarning = true
    // eslint-disable-next-line no-console
    console.warn(
      '[redaction] AGENT_REDACTION_SALT is missing or <16 chars in production; '
        + 'falling back to a process-lifetime random salt. Pseudonyms will not be '
        + 'stable across restarts. Set AGENT_REDACTION_SALT to a stable high-entropy '
        + 'value to restore stability.',
    )
  }
  cachedSalt = randomBytes(32).toString('hex')
  return cachedSalt
}

function toPseudonym(value: unknown): string {
  const text = String(value ?? '').trim()
  if (!text) return '[redacted]'
  const hash = createHash('sha256')
    .update(`${toSalt()}:${text}`)
    .digest('hex')
    .slice(0, 12)
  return `anon_${hash}`
}

function maskAddress(value: string): string {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!ADDRESS_REGEX.test(normalized)) return normalized
  return `${normalized.slice(0, 6)}…${normalized.slice(-4)}`
}

function redactTextSecrets(value: string, maxLen: number): string {
  const redacted = value
    // Ethereum private key style hex blobs
    .replace(/\b0x[a-fA-F0-9]{64}\b/g, '[redacted-hex-secret]')
    // OpenAI/GitHub-like key prefixes
    .replace(/\b(sk|ghp|xoxb|xoxp)-[A-Za-z0-9_-]{8,}\b/g, '[redacted-api-key]')
    // JWT-like payloads
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g, '[redacted-jwt]')
    // Bearer token literals
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{12,}\b/gi, 'Bearer [redacted]')
  if (redacted.length <= maxLen) return redacted
  return `${redacted.slice(0, Math.max(0, maxLen - 1))}…`
}

function isDeniedKey(key: string): boolean {
  return DENY_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

function shouldPseudonymizeKey(key: string, options: RedactionOptions): boolean {
  const normalized = key.trim()
  const configured = options.pseudonymizeFields?.length
    ? options.pseudonymizeFields
    : DEFAULT_PSEUDONYMIZE_FIELDS
  return configured.some((candidate) => candidate.toLowerCase() === normalized.toLowerCase())
}

function allowFieldAtRoot(key: string, options: RedactionOptions): boolean {
  if (!options.allowFields || options.allowFields.length === 0) return true
  return options.allowFields.some((allowed) => allowed === key)
}

function redactValue(
  value: unknown,
  options: RedactionOptions,
  depth: number,
  keyPath: string[],
): unknown {
  const maxDepth = Number.isFinite(Number(options.maxDepth)) ? Math.max(1, Number(options.maxDepth)) : 5
  const maxStringLength = Number.isFinite(Number(options.maxStringLength))
    ? Math.max(16, Number(options.maxStringLength))
    : 1_500
  const maxArrayItems = Number.isFinite(Number(options.maxArrayItems))
    ? Math.max(1, Number(options.maxArrayItems))
    : 10

  if (depth > maxDepth) return '[truncated]'

  if (typeof value === 'string') {
    const maskedAddress = options.maskAddresses !== false && ADDRESS_REGEX.test(value.trim())
      ? maskAddress(value)
      : value
    return redactTextSecrets(maskedAddress, maxStringLength)
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  if (typeof value === 'bigint') return Number(value)
  if (Array.isArray(value)) {
    return value.slice(0, maxArrayItems).map((entry) => redactValue(entry, options, depth + 1, keyPath))
  }
  if (typeof value !== 'object') return '[redacted]'

  const input = value as Record<string, unknown>
  const output: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(input)) {
    if (depth === 0 && !allowFieldAtRoot(key, options)) continue
    if (isDeniedKey(key)) {
      output[key] = '[redacted]'
      continue
    }
    if (shouldPseudonymizeKey(key, options)) {
      output[key] = toPseudonym(entry)
      continue
    }
    output[key] = redactValue(entry, options, depth + 1, [...keyPath, key])
  }
  return output
}

export function redactForRemoteAi<T = unknown>(
  payload: T,
  options: RedactionOptions = {},
): T {
  return redactValue(payload, options, 0, []) as T
}

export function redactTextForRemoteAi(
  input: string,
  options: Pick<RedactionOptions, 'maxStringLength' | 'maskAddresses'> = {},
): string {
  const value = String(input ?? '')
  const maxStringLength = Number.isFinite(Number(options.maxStringLength))
    ? Math.max(16, Number(options.maxStringLength))
    : 3_000
  const withAddressMask =
    options.maskAddresses === false
      ? value
      : value.replace(/\b0x[a-fA-F0-9]{40}\b/g, (match) => maskAddress(match))
  return redactTextSecrets(withAddressMask, maxStringLength)
}

export function redactToJsonForRemoteAi(
  payload: unknown,
  options: RedactionOptions = {},
): string {
  return JSON.stringify(redactForRemoteAi(payload, options))
}
