// Pure utility helpers extracted from DeployVault.tsx to reduce file size.
// These functions are deliberately side-effect free: no window/localStorage,
// no logger, no React. They validate and normalize values used in the deploy
// flow and can be unit-tested independently.

import {
  getAddress,
  getCreate2Address,
  isAddress,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from 'viem'

import { findCreate2SaltForSuffixWithWasm } from '@/lib/vanity/create2SaltSuffixWasm'
import { isPerVaultVanityWasmConfigured } from '@/lib/vanity/perVaultVanityWasm'

export const ZERO_BYTES32 = `0x${'00'.repeat(32)}`
export const MAX_UINT256 = (1n << 256n) - 1n
export const DEPLOYMENT_VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

const HEX_STRING_RE = /^0x[0-9a-fA-F]+$/
const HEX_SUFFIX_RE = /^[0-9a-fA-F]+$/

export function isHexString(value: unknown): value is Hex {
  return typeof value === 'string' && HEX_STRING_RE.test(value)
}

export function getHexByteLength(hex: string): number | null {
  if (!hex.startsWith('0x')) return null
  const body = hex.slice(2)
  if (body.length % 2 !== 0) return null
  return body.length / 2
}

export function normalizeBytes32(value: unknown): Hex | null {
  if (!isHexString(value)) return null
  if (getHexByteLength(value) !== 32) return null
  if (value.toLowerCase() === ZERO_BYTES32) return null
  return value as Hex
}

export function normalizeAddressLike(value: unknown): Address | null {
  if (typeof value !== 'string') return null
  if (!isAddress(value)) return null
  try {
    return getAddress(value)
  } catch {
    return null
  }
}

export function normalizeAddressArray(value: unknown): Address[] {
  if (!Array.isArray(value)) return []
  const out: Address[] = []
  const seen = new Set<string>()
  for (const entry of value) {
    const normalized = normalizeAddressLike(entry)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }
  return out
}

export function sameAddress(a: unknown, b: unknown): boolean {
  const left = normalizeAddressLike(a)
  const right = normalizeAddressLike(b)
  if (left && right) return left === right
  return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase()
}

export function parseUint8(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 255) {
    return Math.floor(value)
  }
  if (typeof value === 'string') {
    const v = value.trim()
    if (!v) return null
    const n = Number(v)
    if (Number.isFinite(n) && n >= 0 && n <= 255) return Math.floor(n)
  }
  return null
}

export function parseUniswapV3Fee(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = Math.floor(value)
    if (parsed > 0 && parsed <= 1_000_000) return parsed
    return null
  }
  if (typeof value === 'string') {
    const v = value.trim()
    if (!v) return null
    const parsed = Number(v)
    if (!Number.isFinite(parsed)) return null
    const normalized = Math.floor(parsed)
    if (normalized > 0 && normalized <= 1_000_000) return normalized
  }
  return null
}

export function encodeUniswapV3Path(tokens: Address[], fees: number[]): Hex {
  if (tokens.length < 2) throw new Error('Uniswap path requires at least two tokens')
  if (fees.length !== tokens.length - 1) throw new Error('Uniswap path fee count mismatch')
  let out = `0x${tokens[0]!.slice(2)}`
  for (let i = 0; i < fees.length; i += 1) {
    const fee = fees[i]
    if (fee === undefined || !Number.isInteger(fee) || fee <= 0 || fee > 1_000_000) {
      throw new Error(`Invalid Uniswap fee tier: ${fee}`)
    }
    out += fee.toString(16).padStart(6, '0')
    out += tokens[i + 1]!.slice(2)
  }
  return out as Hex
}

export function parsePositiveTokenAmount(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value > 0n ? value : null
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return BigInt(Math.floor(value))
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/,/g, '')
    if (!cleaned) return null
    if (!/^\d+$/.test(cleaned)) return null
    const parsed = BigInt(cleaned)
    return parsed > 0n ? parsed : null
  }
  return null
}

export function normalizeDeploymentVersion(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!v) return null
  if (!DEPLOYMENT_VERSION_RE.test(v)) return null
  return v
}

export function normalizeHexSuffix(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const cleaned = raw.startsWith('0x') ? raw.slice(2) : raw
  if (!cleaned || cleaned.length > 40) return null
  if (!HEX_SUFFIX_RE.test(cleaned)) return null
  return cleaned.toLowerCase()
}

async function findCreate2SaltForSuffixTypescript(params: {
  create2Deployer: Address
  initCode: Hex
  suffix: string
  maxTries: number
  yieldEvery?: number
  startAt?: bigint
  isAddressDeployed?: (addr: Address) => Promise<boolean>
}): Promise<Hex | null> {
  const suffix = normalizeHexSuffix(params.suffix)
  if (!suffix) return null
  const bytecodeHash = keccak256(params.initCode)
  const maxTries = Math.max(1, Math.floor(params.maxTries))
  const yieldEvery = Math.max(256, Math.floor(params.yieldEvery ?? 4096))
  const startAt = typeof params.startAt === 'bigint' ? params.startAt : 0n

  for (let i = 0; i < maxTries; i += 1) {
    const salt = toHex((startAt + BigInt(i)) & MAX_UINT256, { size: 32 }) as Hex
    const addr = getCreate2Address({ from: params.create2Deployer, salt, bytecodeHash })
    if (addr.slice(-suffix.length).toLowerCase() === suffix) {
      if (params.isAddressDeployed) {
        try {
          const deployed = await params.isAddressDeployed(addr)
          if (deployed) {
            continue
          }
        } catch {
          // If we can't check, still allow this salt.
        }
      }
      return salt
    }
    if (i > 0 && i % yieldEvery === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  return null
}

async function findCreate2SaltForSuffixWithRust(params: {
  create2Deployer: Address
  initCode: Hex
  suffix: string
  maxTries: number
  startAt?: bigint
  isAddressDeployed?: (addr: Address) => Promise<boolean>
}): Promise<Hex | null> {
  if (typeof WebAssembly === 'undefined' || typeof fetch !== 'function' || !isPerVaultVanityWasmConfigured()) {
    return null
  }

  const suffix = normalizeHexSuffix(params.suffix)
  if (!suffix) return null

  const bytecodeHash = keccak256(params.initCode)
  const maxTries = Math.max(1, Math.floor(params.maxTries))
  let cursor = typeof params.startAt === 'bigint' ? params.startAt : 0n
  let remaining = maxTries

  while (remaining > 0) {
    const startAtHex = toHex(cursor & MAX_UINT256, { size: 32 }) as Hex
    let result: Awaited<ReturnType<typeof findCreate2SaltForSuffixWithWasm>>
    try {
      result = await findCreate2SaltForSuffixWithWasm({
        create2Deployer: params.create2Deployer,
        initCodeHash: bytecodeHash,
        startAt: startAtHex,
        suffix,
        maxAttempts: remaining,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '')
      if (message.includes('failed to find suffix')) return null
      throw error
    }

    if (!result) return null

    if (params.isAddressDeployed) {
      try {
        const deployed = await params.isAddressDeployed(getAddress(result.predictedAddress))
        if (deployed) {
          cursor = (BigInt(result.salt) + 1n) & MAX_UINT256
          remaining = Math.max(0, remaining - result.attempts)
          continue
        }
      } catch {
        // If we can't check, still allow this salt.
      }
    }

    return result.salt as Hex
  }

  return null
}

export async function findCreate2SaltForSuffix(params: {
  create2Deployer: Address
  initCode: Hex
  suffix: string
  maxTries: number
  yieldEvery?: number
  startAt?: bigint
  isAddressDeployed?: (addr: Address) => Promise<boolean>
  preferWasm?: boolean
}): Promise<Hex | null> {
  const preferWasm = params.preferWasm !== false
  if (preferWasm) {
    try {
      const wasmResult = await findCreate2SaltForSuffixWithRust(params)
      if (wasmResult) return wasmResult
    } catch {
      // Fall back to the TypeScript mirror when WASM is unavailable or stale.
    }
  }
  return findCreate2SaltForSuffixTypescript(params)
}

/** Combined vault+share version search cap when Phase-1 salt overrides can satisfy share suffix separately. */
export const COMBINED_VANITY_VERSION_SEARCH_CAP = 10_000

/** Default server-side attempt budget for combined vault+share version search on salt-disabled batchers. */
export const COMBINED_SALT_DISABLED_SERVER_MAX_TRIES = 50_000_000

export type DeploymentVanityVersionSearchOutcome =
  | 'not_applicable'
  | 'combined_match'
  | 'vault_only_match'
  | 'share_only_match'
  | 'missed_defaults'
  | 'missed_custom'

export function resolveDeploymentVersionSearchMaxTries(params: {
  hasVaultPrefix: boolean
  hasShareSuffix: boolean
  supportsPhase1WithSalt: boolean
  vaultVanityMaxTries: number
  shareOftVanityMaxTries: number
}): number {
  if (params.hasVaultPrefix && params.hasShareSuffix) {
    if (!params.supportsPhase1WithSalt) {
      return Math.min(params.vaultVanityMaxTries, params.shareOftVanityMaxTries)
    }
    return Math.min(
      COMBINED_VANITY_VERSION_SEARCH_CAP,
      params.vaultVanityMaxTries,
      params.shareOftVanityMaxTries,
    )
  }
  if (params.hasVaultPrefix) return params.vaultVanityMaxTries
  if (params.hasShareSuffix) return params.shareOftVanityMaxTries
  return 0
}

/**
 * Salt-enabled batchers: vault prefix via deployment-version search; share suffix via CREATE2 salt grind.
 * Salt-disabled batchers: both targets must match the same deployment version (combined search).
 */
export function resolveDeploymentVersionSearchTargets(params: {
  vaultVanityPrefix: string | null
  shareOftVanitySuffix: string | null
  supportsPhase1WithSalt: boolean
}): { vaultPrefix: string | null; shareSuffix: string | null } {
  if (params.supportsPhase1WithSalt) {
    return {
      vaultPrefix: params.vaultVanityPrefix,
      shareSuffix: null,
    }
  }

  return {
    vaultPrefix: params.vaultVanityPrefix,
    shareSuffix: params.shareOftVanitySuffix,
  }
}

export function needsCombinedSaltDisabledVanitySearch(params: {
  supportsPhase1WithSalt: boolean
  vaultPrefix: string | null
  shareSuffix: string | null
}): boolean {
  return !params.supportsPhase1WithSalt && Boolean(params.vaultPrefix) && Boolean(params.shareSuffix)
}

export function buildShareOftVanityUserWarning(params: {
  shareOftVanitySuffix: string | null
  vaultVanityPrefix: string | null
  saltOverrideDisabled: boolean
  versionSearchOutcome: DeploymentVanityVersionSearchOutcome
}): string | null {
  if (!params.saltOverrideDisabled) return null

  if (
    params.versionSearchOutcome === 'combined_match' ||
    params.versionSearchOutcome === 'share_only_match'
  ) {
    return null
  }

  if (params.versionSearchOutcome === 'missed_defaults') {
    if (params.vaultVanityPrefix && params.shareOftVanitySuffix) {
      return (
        `Default vanity targets (0x${params.vaultVanityPrefix} / ${params.shareOftVanitySuffix}) were not found in the current deployment-version search window. ` +
        'Continuing with deterministic deployment addresses (best-effort).'
      )
    }
    if (params.vaultVanityPrefix) {
      return (
        `Default vault prefix 0x${params.vaultVanityPrefix} was not found in the current deployment-version search window. ` +
        'Continuing with deterministic deployment addresses (best-effort).'
      )
    }
    return (
      'Default share suffix was not found in the current deployment-version search window. ' +
      'Continuing with deterministic deployment addresses (best-effort).'
    )
  }

  return null
}

/** Informational copy when combined vault+share vanity search misses on salt-disabled batchers. */
export function buildSaltDisabledShareSuffixInfoNotice(params: {
  versionSearchOutcome: DeploymentVanityVersionSearchOutcome
  vaultVanityPrefix: string | null
  shareOftVanitySuffix: string | null
  saltOverrideDisabled: boolean
  deploymentVersionUsed?: string | null
}): string | null {
  if (!params.saltOverrideDisabled || !params.shareOftVanitySuffix || !params.vaultVanityPrefix) return null
  if (params.versionSearchOutcome !== 'missed_defaults') return null

  return (
    `Could not find a deployment version matching vault prefix 0x${params.vaultVanityPrefix} and share suffix ${params.shareOftVanitySuffix} ` +
    'in the current search window. This batcher requires both patterns in the same version string; try again with a higher server search budget or run the offline vanity grinder.'
  )
}
