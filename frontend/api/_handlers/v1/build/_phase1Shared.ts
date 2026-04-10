import type { VercelResponse } from '@vercel/node'
import { isAddress, type Address, type Hex } from 'viem'

export const BASE_CHAIN_ID = 8453
export const UINT128_MAX = (1n << 128n) - 1n
export const UINT256_MAX = (1n << 256n) - 1n

// Keep these aligned with contracts/governance/ve4626.sol.
export const VE_MIN_LOCK_DURATION = 7n * 24n * 60n * 60n
export const VE_MAX_LOCK_DURATION = 4n * 365n * 24n * 60n * 60n

const HEX_BYTES_RE = /^0x([a-fA-F0-9]{2})*$/

export function setBuildCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export function setRateLimitRetryAfter(res: VercelResponse, resetAt: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  res.setHeader('Retry-After', String(retryAfterSeconds))
}

export function toBigIntStrict(v: unknown, label: string): bigint {
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

export function requireAddress(value: unknown, label: string): Address {
  if (typeof value !== 'string' || !isAddress(value)) {
    throw new Error(`${label} is required`)
  }
  return value as Address
}

export function parseOptionalHex(value: unknown, label: string): Hex {
  if (value == null) return '0x'
  if (typeof value !== 'string' || !HEX_BYTES_RE.test(value)) {
    throw new Error(`Invalid ${label}`)
  }
  return value as Hex
}

export function assertUint256(value: bigint, label: string) {
  if (value < 0n || value > UINT256_MAX) {
    throw new Error(`${label} must be within uint256`)
  }
}

export function nowUnixSeconds(): bigint {
  return BigInt(Math.floor(Date.now() / 1000))
}
