/**
 * Share-mesh LayerZero pathway policy (Base ↔ Solana, plus EVM lane EIDs).
 *
 * B2 incident: Pipe A burned on Base but Solana mint stayed 0 because Scan
 * treated source outbound confirmations (10) as below destination inbound (15).
 * Never rely on library defaults — wire both sides explicitly and gate before
 * any share bridge / Pipe A send.
 */

export const SHARE_MESH_BASE_EID = 30_184
export const SHARE_MESH_SOLANA_EID = 30_168

/** EVM share-mesh lane EIDs (Base hub ↔ EVM spokes). */
export const SHARE_MESH_ETHEREUM_EID = 30_101
export const SHARE_MESH_ARBITRUM_EID = 30_110
export const SHARE_MESH_UNICHAIN_EID = 30_320
export const SHARE_MESH_ROBINHOOD_EID = 30_416

/** Template `layerzero-share-mesh.config.ts`: [evm→solana, solana→evm]. */
export const EXPECTED_BASE_TO_SOLANA_CONFIRMATIONS = 15n
export const EXPECTED_SOLANA_TO_BASE_CONFIRMATIONS = 32n

/**
 * EVM↔EVM lane confirmations, both directions
 * (template `layerzero-evm-share-mesh.config.ts` uses [15, 15]).
 */
export const EXPECTED_EVM_LANE_CONFIRMATIONS = 15n

export const EXPECTED_OPTIONAL_DVN_COUNT = 5
export const EXPECTED_OPTIONAL_DVN_THRESHOLD = 3
/** LayerZero NIL required/optional DVN sentinel (no DVNs of that class). */
export const NIL_REQUIRED_DVN_COUNT = 255

/** Template Solana lzReceive enforced options (CU + ATA rent lamports). */
export const EXPECTED_SOLANA_LZ_RECEIVE_GAS = 200_000
export const EXPECTED_SOLANA_LZ_RECEIVE_VALUE = 2_039_280

export type UlnConfirmationsSlice = {
  confirmations: bigint
  optionalDvnCount: number
  optionalDvnThreshold: number
  /** Effective count: 0 means no required DVNs (NIL 255 already normalized). */
  requiredDvnCount: number
}

export type PathwayConfirmationSnapshot = {
  /** Base ShareOFT send ULN → Solana */
  baseSend: UlnConfirmationsSlice
  /** Solana OFT store receive ULN ← Base */
  solanaReceive: UlnConfirmationsSlice
  /** Solana OFT store send ULN → Base */
  solanaSend: UlnConfirmationsSlice
  /** Base ShareOFT receive ULN ← Solana */
  baseReceive: UlnConfirmationsSlice
}

export type PathwayGateCheck = {
  id: string
  ok: boolean
  detail: string
}

function asBigInt(value: bigint | number | string): bigint {
  return typeof value === 'bigint' ? value : BigInt(value)
}

/** LayerZero blocks when source outbound confirmations < destination inbound. */
export function outboundMeetsInbound(outbound: bigint | number, inbound: bigint | number): boolean {
  return asBigInt(outbound) >= asBigInt(inbound)
}

/** Normalize Endpoint/Solana NIL sentinel (255) to effective 0. */
export function normalizeEffectiveRequiredDvnCount(requiredDvnCount: number): number {
  return requiredDvnCount === NIL_REQUIRED_DVN_COUNT ? 0 : requiredDvnCount
}

/**
 * Merge Solana custom ULN over library default.
 * Custom field 0 (or missing custom) inherits default; 255 = NIL → effective 0.
 * Confirmations: 0 inherits default (same as LZ Solana config semantics).
 */
export function resolveEffectiveSolanaUlnSlice(
  defaultSlice: UlnConfirmationsSlice | null | undefined,
  customSlice: UlnConfirmationsSlice | null | undefined,
): UlnConfirmationsSlice {
  if (!defaultSlice && !customSlice) {
    return {
      confirmations: 0n,
      requiredDvnCount: 0,
      optionalDvnCount: 0,
      optionalDvnThreshold: 0,
    }
  }
  const fallback = defaultSlice ?? {
    confirmations: 0n,
    requiredDvnCount: 0,
    optionalDvnCount: 0,
    optionalDvnThreshold: 0,
  }
  if (!customSlice) return { ...fallback, requiredDvnCount: normalizeEffectiveRequiredDvnCount(fallback.requiredDvnCount) }

  const confirmations =
    customSlice.confirmations === 0n ? fallback.confirmations : customSlice.confirmations

  const requiredRaw = customSlice.requiredDvnCount
  const requiredDvnCount =
    requiredRaw === 0
      ? normalizeEffectiveRequiredDvnCount(fallback.requiredDvnCount)
      : normalizeEffectiveRequiredDvnCount(requiredRaw)

  const optionalRaw = customSlice.optionalDvnCount
  const inheritOptional = optionalRaw === 0
  const optionalDvnCount = inheritOptional
    ? fallback.optionalDvnCount
    : optionalRaw === NIL_REQUIRED_DVN_COUNT
      ? 0
      : optionalRaw
  // Threshold 0 is an inherit sentinel even when optionalDvnCount is explicit.
  const optionalDvnThreshold =
    optionalRaw === NIL_REQUIRED_DVN_COUNT
      ? 0
      : inheritOptional || customSlice.optionalDvnThreshold === 0
        ? fallback.optionalDvnThreshold
        : customSlice.optionalDvnThreshold

  return {
    confirmations,
    requiredDvnCount,
    optionalDvnCount,
    optionalDvnThreshold,
  }
}

/** Normalize Base Endpoint.getConfig / app ULN into effective slice. */
export function normalizeBaseUlnSlice(slice: UlnConfirmationsSlice): UlnConfirmationsSlice {
  return {
    ...slice,
    requiredDvnCount: normalizeEffectiveRequiredDvnCount(slice.requiredDvnCount),
  }
}

export function isExpectedDvnShape(slice: UlnConfirmationsSlice): boolean {
  const required = normalizeEffectiveRequiredDvnCount(slice.requiredDvnCount)
  return (
    slice.optionalDvnCount === EXPECTED_OPTIONAL_DVN_COUNT &&
    slice.optionalDvnThreshold === EXPECTED_OPTIONAL_DVN_THRESHOLD &&
    required === 0
  )
}

/** Left-pad a 20-byte EVM address to bytes32 peer form. */
export function asPaddedEvmPeer(address: string): `0x${string}` {
  const hex = address.trim().toLowerCase().replace(/^0x/, '')
  if (!/^[0-9a-f]{40}$/.test(hex)) {
    throw new Error(`invalid_evm_address_for_peer:${address}`)
  }
  return `0x${'00'.repeat(12)}${hex}`
}

/**
 * Soft check that Base→Solana enforced options encode template lzReceive gas/value.
 * Options are Type-3 worker options; look for the known u128/u128 payloads.
 */
export function enforcedOptionsMatchSolanaTemplate(enforcedOptionsHex: string): boolean {
  const hex = enforcedOptionsHex.trim().toLowerCase().replace(/^0x/, '')
  if (hex.length < 8) return false
  const gasHex = EXPECTED_SOLANA_LZ_RECEIVE_GAS.toString(16)
  const valueHex = EXPECTED_SOLANA_LZ_RECEIVE_VALUE.toString(16)
  return hex.includes(gasHex) && hex.includes(valueHex)
}

export function assessShareMeshLzPathway(snapshot: PathwayConfirmationSnapshot): {
  ok: boolean
  checks: PathwayGateCheck[]
} {
  const checks: PathwayGateCheck[] = []

  const baseToSolanaOk = outboundMeetsInbound(
    snapshot.baseSend.confirmations,
    snapshot.solanaReceive.confirmations,
  )
  checks.push({
    id: 'base_to_solana_confirmations_compatible',
    ok: baseToSolanaOk,
    detail: `baseSend=${snapshot.baseSend.confirmations} solanaReceive=${snapshot.solanaReceive.confirmations}`,
  })

  const solanaToBaseOk = outboundMeetsInbound(
    snapshot.solanaSend.confirmations,
    snapshot.baseReceive.confirmations,
  )
  checks.push({
    id: 'solana_to_base_confirmations_compatible',
    ok: solanaToBaseOk,
    detail: `solanaSend=${snapshot.solanaSend.confirmations} baseReceive=${snapshot.baseReceive.confirmations}`,
  })

  checks.push({
    id: 'base_send_confirmations_policy',
    ok: snapshot.baseSend.confirmations === EXPECTED_BASE_TO_SOLANA_CONFIRMATIONS,
    detail: `expected=${EXPECTED_BASE_TO_SOLANA_CONFIRMATIONS} actual=${snapshot.baseSend.confirmations}`,
  })

  checks.push({
    id: 'solana_receive_confirmations_policy',
    ok: snapshot.solanaReceive.confirmations === EXPECTED_BASE_TO_SOLANA_CONFIRMATIONS,
    detail: `expected=${EXPECTED_BASE_TO_SOLANA_CONFIRMATIONS} actual=${snapshot.solanaReceive.confirmations}`,
  })

  checks.push({
    id: 'solana_send_confirmations_policy',
    ok: snapshot.solanaSend.confirmations === EXPECTED_SOLANA_TO_BASE_CONFIRMATIONS,
    detail: `expected=${EXPECTED_SOLANA_TO_BASE_CONFIRMATIONS} actual=${snapshot.solanaSend.confirmations}`,
  })

  checks.push({
    id: 'base_receive_confirmations_policy',
    ok: snapshot.baseReceive.confirmations === EXPECTED_SOLANA_TO_BASE_CONFIRMATIONS,
    detail: `expected=${EXPECTED_SOLANA_TO_BASE_CONFIRMATIONS} actual=${snapshot.baseReceive.confirmations}`,
  })

  for (const [id, slice] of [
    ['base_send_dvn_3of5', snapshot.baseSend],
    ['solana_receive_dvn_3of5', snapshot.solanaReceive],
    ['solana_send_dvn_3of5', snapshot.solanaSend],
    ['base_receive_dvn_3of5', snapshot.baseReceive],
  ] as const) {
    checks.push({
      id,
      ok: isExpectedDvnShape(slice),
      detail: `required=${slice.requiredDvnCount} optional=${slice.optionalDvnCount} threshold=${slice.optionalDvnThreshold}`,
    })
  }

  return { ok: checks.every((c) => c.ok), checks }
}


/**
 * Base-only Pipe A gate (no Solana RPC). Catches B2-class Base send confirmations
 * below template [15] and missing Solana lzReceive enforced options / DVN shape.
 * Full bidirectional checks remain in ops:verify-share-mesh-lz.
 */
export function assessBaseShareMeshUlnForPipeA(params: {
  baseSend: UlnConfirmationsSlice
  baseReceive: UlnConfirmationsSlice
  enforcedOptionsHex: string
}): { ok: boolean; checks: PathwayGateCheck[] } {
  const checks: PathwayGateCheck[] = []
  checks.push({
    id: 'base_send_confirmations_policy',
    ok: params.baseSend.confirmations === EXPECTED_BASE_TO_SOLANA_CONFIRMATIONS,
    detail: `expected=${EXPECTED_BASE_TO_SOLANA_CONFIRMATIONS} actual=${params.baseSend.confirmations}`,
  })
  checks.push({
    id: 'base_send_meets_template_solana_inbound',
    ok: outboundMeetsInbound(params.baseSend.confirmations, EXPECTED_BASE_TO_SOLANA_CONFIRMATIONS),
    detail: `baseSend=${params.baseSend.confirmations} minInbound=${EXPECTED_BASE_TO_SOLANA_CONFIRMATIONS}`,
  })
  checks.push({
    id: 'base_receive_confirmations_policy',
    ok: params.baseReceive.confirmations === EXPECTED_SOLANA_TO_BASE_CONFIRMATIONS,
    detail: `expected=${EXPECTED_SOLANA_TO_BASE_CONFIRMATIONS} actual=${params.baseReceive.confirmations}`,
  })
  checks.push({
    id: 'base_send_dvn_3of5',
    ok: isExpectedDvnShape(params.baseSend),
    detail: `required=${params.baseSend.requiredDvnCount} optional=${params.baseSend.optionalDvnCount} threshold=${params.baseSend.optionalDvnThreshold}`,
  })
  checks.push({
    id: 'base_receive_dvn_3of5',
    ok: isExpectedDvnShape(params.baseReceive),
    detail: `required=${params.baseReceive.requiredDvnCount} optional=${params.baseReceive.optionalDvnCount} threshold=${params.baseReceive.optionalDvnThreshold}`,
  })
  checks.push({
    id: 'shareoft_enforced_options_template',
    ok: enforcedOptionsMatchSolanaTemplate(params.enforcedOptionsHex),
    detail: `enforcedOptions=${params.enforcedOptionsHex}`,
  })
  return { ok: checks.every((c) => c.ok), checks }
}
