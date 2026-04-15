export type SolanaAssetMintOrigin = 'existing' | 'new'
export type SolanaTokenProgram = 'spl-token' | 'token-2022'
export type SolanaAdapterMode = 'regular-oft' | 'oft-adapter'

export type SolanaOvaultMintCompatibilityHints = {
  tokenProgram: SolanaTokenProgram | null
  transferHookDetected: boolean | null
  oftFeeBps: number | null
  adapterMode: SolanaAdapterMode | null
  authorityCompatible: boolean | null
  rentValueLamports: string | null
}

export type SolanaOvaultMintCompatibility = {
  assetMintOrigin: SolanaAssetMintOrigin
  checksRequired: boolean
  programSupported: boolean
  transferHookDetected: boolean
  regularOftMode: boolean
  adapterModeDisallowed: boolean
  oftFeeIsZero: boolean
  authorityCompatible: boolean
  rentValueLamports: string | null
  blockers: string[]
}

export type SolanaOvaultEligibility = {
  existingMintCompatible: boolean
  depositEligible: boolean
  redeemEligible: boolean
  mintCompatibility: SolanaOvaultMintCompatibility
}

declare const process: { env: Record<string, string | undefined> }

function parseBooleanLike(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value !== 0 : null
  if (typeof value !== 'string') return null
  const raw = value.trim().toLowerCase()
  if (!raw) return null
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true
  if (['0', 'false', 'no', 'off'].includes(raw)) return false
  return null
}

function parseOptionalNonNegativeInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number.parseInt(trimmed, 10)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  return null
}

function parseOptionalLamports(value: unknown): string | null {
  if (typeof value === 'bigint') return value >= 0n ? value.toString() : null
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return BigInt(Math.floor(value)).toString()
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (!/^[0-9]+$/.test(trimmed)) return null
    return trimmed
  }
  return null
}

function parseTokenProgram(value: unknown): SolanaTokenProgram | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'spl' || normalized === 'spl-token') return 'spl-token'
  if (normalized === 'token2022' || normalized === 'token-2022') return 'token-2022'
  return null
}

function parseAdapterMode(value: unknown): SolanaAdapterMode | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'regular-oft' || normalized === 'regular' || normalized === 'oft') {
    return 'regular-oft'
  }
  if (normalized === 'oft-adapter' || normalized === 'adapter') {
    return 'oft-adapter'
  }
  return null
}

export function normalizeSolanaAssetMintOrigin(
  value: unknown,
  fallback: SolanaAssetMintOrigin = 'new',
): SolanaAssetMintOrigin {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === 'existing') return 'existing'
  if (normalized === 'new') return 'new'
  return fallback
}

export function parseSolanaOvaultMintCompatibilityHints(
  value: unknown,
): SolanaOvaultMintCompatibilityHints {
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  return {
    tokenProgram: parseTokenProgram(raw.tokenProgram),
    transferHookDetected: parseBooleanLike(raw.transferHookDetected),
    oftFeeBps: parseOptionalNonNegativeInt(raw.oftFeeBps),
    adapterMode: parseAdapterMode(raw.adapterMode),
    authorityCompatible: parseBooleanLike(raw.authorityCompatible),
    rentValueLamports: parseOptionalLamports(raw.rentValueLamports),
  }
}

export function readSolanaOvaultMintCompatibilityHintsFromEnv(): SolanaOvaultMintCompatibilityHints {
  return parseSolanaOvaultMintCompatibilityHints({
    tokenProgram: process.env.SOLANA_OVAULT_TOKEN_PROGRAM,
    transferHookDetected: process.env.SOLANA_OVAULT_TRANSFER_HOOK_DETECTED,
    oftFeeBps: process.env.SOLANA_OVAULT_OFT_FEE_BPS,
    adapterMode: process.env.SOLANA_OVAULT_ADAPTER_MODE,
    authorityCompatible: process.env.SOLANA_OVAULT_AUTHORITY_COMPATIBLE,
    rentValueLamports: process.env.SOLANA_OVAULT_RENT_LAMPORTS,
  })
}

export function evaluateSolanaOvaultMintCompatibility(params: {
  assetMintOrigin: SolanaAssetMintOrigin
  hints: SolanaOvaultMintCompatibilityHints
  routeReady: boolean | null
  requireHintsForExisting: boolean
}): SolanaOvaultEligibility {
  const checksRequired = params.assetMintOrigin === 'existing'
  const hints = params.hints

  const programSupported = hints.tokenProgram === 'spl-token' || hints.tokenProgram === 'token-2022'
  const transferHookDetected = hints.transferHookDetected === true
  const regularOftMode = hints.adapterMode === 'regular-oft'
  const adapterModeDisallowed = !(transferHookDetected && hints.adapterMode === 'oft-adapter')
  const oftFeeIsZero = !transferHookDetected || hints.oftFeeBps === 0
  const authorityCompatible = hints.authorityCompatible === true
  const rentValueLamports = hints.rentValueLamports

  const blockers: string[] = []
  if (checksRequired) {
    if (params.requireHintsForExisting && hints.tokenProgram === null) {
      blockers.push('tokenProgram hint is required for existing mint flow.')
    } else if (!programSupported) {
      blockers.push('Only SPL Token or Token-2022 mints are supported for existing mint flow.')
    }

    if (params.requireHintsForExisting && hints.transferHookDetected === null) {
      blockers.push('transferHookDetected hint is required for existing mint flow.')
    }

    if (transferHookDetected) {
      if (params.requireHintsForExisting && hints.adapterMode === null) {
        blockers.push('adapterMode hint is required when transferHookDetected=true.')
      } else if (!regularOftMode) {
        blockers.push('TransferHook mints must use regular-oft mode (no OFT adapter mode).')
      }
      if (params.requireHintsForExisting && hints.oftFeeBps === null) {
        blockers.push('oftFeeBps hint is required when transferHookDetected=true.')
      } else if (!oftFeeIsZero) {
        blockers.push('TransferHook mints require OFT fee = 0.')
      }
    }

    if (params.requireHintsForExisting && hints.authorityCompatible === null) {
      blockers.push('authorityCompatible hint is required for existing mint flow.')
    } else if (!authorityCompatible) {
      blockers.push('Mint authority/freeze authority compatibility is not confirmed.')
    }

    if (params.requireHintsForExisting && rentValueLamports === null) {
      blockers.push('rentValueLamports hint is required for receive-path execution.')
    } else if (!rentValueLamports || rentValueLamports === '0') {
      blockers.push('Receive-path rent value must be > 0 lamports.')
    }

    if (params.routeReady === false) {
      blockers.push('Solana route is not ready for this mint/token pair.')
    }
  }

  const existingMintCompatible = checksRequired ? blockers.length === 0 : true
  const depositEligible = checksRequired ? existingMintCompatible && params.routeReady !== false : params.routeReady !== false
  const redeemEligible = checksRequired ? existingMintCompatible : true

  return {
    existingMintCompatible,
    depositEligible,
    redeemEligible,
    mintCompatibility: {
      assetMintOrigin: params.assetMintOrigin,
      checksRequired,
      programSupported: checksRequired ? programSupported : true,
      transferHookDetected,
      regularOftMode: checksRequired ? (transferHookDetected ? regularOftMode : true) : true,
      adapterModeDisallowed: checksRequired ? adapterModeDisallowed : true,
      oftFeeIsZero: checksRequired ? oftFeeIsZero : true,
      authorityCompatible: checksRequired ? authorityCompatible : true,
      rentValueLamports,
      blockers,
    },
  }
}
