import { isAddress, type Address } from 'viem'

export const AJNA_BUCKET_INDEX_MIN = 1n
export const AJNA_BUCKET_INDEX_MAX = 7388n
export const MAX_BPS = 10_000n

export function toBigIntStrict(v: any, label: string): bigint {
  try {
    if (typeof v === 'bigint') return v
    if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.floor(v))
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase()
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

export function setBuildCors(res: { setHeader: (k: string, v: string) => void }) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export function assertPositive(value: bigint, label: string) {
  if (value <= 0n) throw new Error(`${label} must be > 0`)
}

export function assertNonNegative(value: bigint, label: string) {
  if (value < 0n) throw new Error(`${label} must be >= 0`)
}

export function assertBucketIndex(value: bigint, label: string) {
  if (value < AJNA_BUCKET_INDEX_MIN || value > AJNA_BUCKET_INDEX_MAX) {
    throw new Error(`${label} must be between ${AJNA_BUCKET_INDEX_MIN.toString()} and ${AJNA_BUCKET_INDEX_MAX.toString()}`)
  }
}

export function assertBps(value: bigint, label: string) {
  if (value < 0n || value > MAX_BPS) throw new Error(`${label} must be between 0 and ${MAX_BPS.toString()}`)
}

