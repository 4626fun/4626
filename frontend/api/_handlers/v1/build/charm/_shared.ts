import { isAddress, type Address } from 'viem'

export const BASE_CHAIN_ID = 8453
export const MAX_BPS = 10_000n
export const SWAP_POOL_FEE_MAX = 1_000_000n
export const CHARM_BUILD_BODY_MAX_BYTES = 16_384

export function toBigIntStrict(v: any, label: string): bigint {
  try {
    if (typeof v === 'bigint') return v
    if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v)) return BigInt(v)
    if (typeof v === 'string') {
      const s = v.trim()
      if (!s) throw new Error('empty')
      return BigInt(s)
    }
    throw new Error('invalid')
  } catch {
    throw new Error(`Invalid ${label}`)
  }
}

export function requireAddress(value: any, label: string): Address {
  if (!value || typeof value !== 'string' || !isAddress(value)) throw new Error(`${label} is required`)
  return value as Address
}

export function setPublicCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export function parseObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

export function setRateLimitRetryAfter(res: { setHeader: (name: string, value: string) => void }, resetAt: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  res.setHeader('Retry-After', String(retryAfterSeconds))
}

export function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`)
  return value
}

export function assertPositive(value: bigint, label: string) {
  if (value <= 0n) throw new Error(`${label} must be > 0`)
}

export function assertNonNegative(value: bigint, label: string) {
  if (value < 0n) throw new Error(`${label} must be >= 0`)
}

export function assertBps(value: bigint, label: string) {
  if (value < 0n || value > MAX_BPS) {
    throw new Error(`${label} must be between 0 and ${MAX_BPS.toString()}`)
  }
}

export function assertSwapPoolFee(value: bigint) {
  if (value < 0n || value > SWAP_POOL_FEE_MAX) {
    throw new Error(`swapPoolFee must be between 0 and ${SWAP_POOL_FEE_MAX.toString()}`)
  }
}

export function toInt24Strict(v: any, label: string): number {
  const parsed = toBigIntStrict(v, label)
  if (parsed < -887272n || parsed > 887272n) throw new Error(`${label} out of range`)
  const n = Number(parsed)
  // Uniswap v3 tick bounds
  return n
}
