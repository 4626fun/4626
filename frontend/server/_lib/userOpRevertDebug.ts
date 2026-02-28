import { getAddress, type Address, type Hex } from 'viem'

export type UserOpCallLike = {
  to: Address
  value?: bigint
  data?: Hex
}

export type UserOpErrorDebug = {
  at: string
  sessionId?: string
  stage?: string
  errorType?: string
  message?: string
  shortMessage?: string
  details?: string
  metaMessages?: string[]
  revertData?: Hex
  selector?: Hex
  errorName?: string
  callSummary?: Array<{ to: Address; selector: Hex | null }>
}

// ============================================================================
// Selector decoding (copied pattern from frontend/src/lib/aa/coinbaseErc4337.ts)
// ============================================================================
// Keep keys lowercase.
const KNOWN_ERROR_SELECTORS: Record<string, string> = {
  '0x08c379a0': 'Error(string)',
  '0x4e487b71': 'Panic(uint256)',
  // Coinbase Smart Wallet errors
  '0x82b42900': 'Unauthorized()',
  // Deployment-batcher errors
  '0x30cd7471': 'NotOwner()',
  '0xd92e233d': 'ZeroAddress()',
  '0xb92e9c7a': 'InvalidPercent()',
  '0x1375159e': 'InvalidCodeId()',
  '0x02058db0': 'Phase1Missing()',
  '0x7c604444': 'Phase1CoreMissing()',
  '0x8d8721fc': 'Phase1StateMismatch()',
  '0x585b9263': 'InvalidWeight()',
  '0xe10fdfee': 'V3PoolMissing()',
  '0x24c0a9e0': 'MissingInitialSqrtPriceX96()',
  '0x18b789e6': 'AuctionAlreadyPending()',
  '0x0fd83a8b': 'NoPendingAuction()',
  '0x56a694d2': 'AuctionShareOFTMismatch()',
  '0x8284e8bf': 'AuctionAmountMismatch()',
  '0xf79c143b': 'Phase2Missing()',
  // UniversalCreate2DeployerFromStore
  '0xb4f54111': 'DeployFailed()',
}

const HEX_RE = /^0x[0-9a-fA-F]*$/
const LONG_HEX_RE = /0x[0-9a-fA-F]{80,}/g

function isHexString(value: unknown): value is Hex {
  return typeof value === 'string' && HEX_RE.test(value)
}

function selectorFromData(data: unknown): Hex | null {
  if (!isHexString(data)) return null
  const v = data.toLowerCase()
  if (!/^0x[0-9a-f]{8,}$/.test(v)) return null
  return (`0x${v.slice(2, 10)}`) as Hex
}

function capString(input: string, maxChars: number): string {
  const s = String(input ?? '')
  if (maxChars <= 0) return ''
  return s.length > maxChars ? `${s.slice(0, maxChars)}...` : s
}

function redactLargeHex(input: string): string {
  // Avoid persisting huge calldata/signature/userop blobs. Keep recognizable prefix/suffix.
  return String(input ?? '').replace(LONG_HEX_RE, (m) => `${m.slice(0, 12)}...${m.slice(-8)}`)
}

function normalizeOptionalString(value: unknown, maxChars: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return capString(redactLargeHex(trimmed), maxChars)
}

function extractMetaMessages(errAny: any, maxItems: number, maxItemChars: number): string[] | undefined {
  const candidates = [
    errAny?.metaMessages,
    errAny?.cause?.metaMessages,
    errAny?.cause?.cause?.metaMessages,
    errAny?.details?.metaMessages,
  ]
  let raw: unknown = undefined
  for (const c of candidates) {
    if (c !== undefined) {
      raw = c
      break
    }
  }
  if (raw == null) return undefined
  const items = Array.isArray(raw) ? raw : [raw]
  const out: string[] = []
  for (const item of items.slice(0, Math.max(0, maxItems))) {
    const s = typeof item === 'string' ? item : JSON.stringify(item)
    if (!s) continue
    out.push(capString(redactLargeHex(s), maxItemChars))
  }
  return out.length > 0 ? out : undefined
}

function extractRevertData(errAny: any): Hex | undefined {
  const candidates = [
    errAny?.revertData,
    errAny?.cause?.revertData,
    errAny?.cause?.cause?.revertData,
    errAny?.data,
    errAny?.cause?.data,
    errAny?.cause?.cause?.data,
  ]
  for (const c of candidates) {
    if (isHexString(c) && c.length >= 10) return c
  }
  return undefined
}

function safeAddress(value: unknown): Address | null {
  try {
    return getAddress(String(value))
  } catch {
    return null
  }
}

export function buildUserOpErrorDebug(params: {
  err: unknown
  sessionId?: string
  stage?: string | null
  calls?: UserOpCallLike[] | null
  now?: Date
}): UserOpErrorDebug {
  const { err, sessionId, stage, calls, now } = params
  const anyErr: any = err as any

  const errorType = normalizeOptionalString(anyErr?.name ?? (err instanceof Error ? err.name : undefined), 120)
  const message = normalizeOptionalString(anyErr?.message ?? (err instanceof Error ? err.message : undefined), 2400)
  const shortMessage = normalizeOptionalString(anyErr?.shortMessage, 1200)
  const details = normalizeOptionalString(anyErr?.details, 2000)
  const metaMessages = extractMetaMessages(anyErr, 12, 800)

  const revertDataRaw = extractRevertData(anyErr)
  const selector = revertDataRaw ? selectorFromData(revertDataRaw) : null
  const errorName = selector ? KNOWN_ERROR_SELECTORS[String(selector).toLowerCase()] : undefined
  const revertData = revertDataRaw ? (capString(revertDataRaw, 4096) as Hex) : undefined

  const callSummary =
    Array.isArray(calls) && calls.length > 0
      ? calls.slice(0, 32).map((c) => ({
          to: safeAddress(c?.to) ?? ZERO_ADDRESS,
          selector: selectorFromData(c?.data ?? null),
        }))
      : undefined

  return {
    at: (now ?? new Date()).toISOString(),
    ...(sessionId ? { sessionId } : {}),
    ...(stage ? { stage } : {}),
    ...(errorType ? { errorType } : {}),
    ...(message ? { message } : {}),
    ...(shortMessage ? { shortMessage } : {}),
    ...(details ? { details } : {}),
    ...(metaMessages ? { metaMessages } : {}),
    ...(revertData ? { revertData } : {}),
    ...(selector ? { selector } : {}),
    ...(errorName ? { errorName } : {}),
    ...(callSummary ? { callSummary } : {}),
  }
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

