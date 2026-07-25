/**
 * EIP-8130 "Native Account Abstraction" — protocol constants and a read-only
 * chain readiness probe.
 *
 * Base ships EIP-8130 as part of the Cobalt upgrade. It is live on Vibenet and
 * still in planning for Sepolia and mainnet, so 4626 executes every sponsored
 * write through ERC-4337 EntryPoint v0.6 (`src/lib/aa/coinbaseErc4337.ts`) and
 * nothing here participates in signing or sending. The module exists so ops
 * tooling can watch the rollout and so the migration plan in
 * `docs/_internal/eip-8130-native-aa-readiness.md` has one place to hang the
 * protocol constants it references.
 *
 * Spec: https://eips.ethereum.org/EIPS/eip-8130
 */

/** Protocol constants from the EIP-8130 "Constants" table. */
export const EIP_8130 = {
  /** EIP-2718 transaction type byte for a native AA transaction. */
  txType: 0x79,
  /** Magic byte that domain-separates the payer signature from the sender's. */
  payerType: 0x7a,
  /** Nonce Manager precompile — 2D nonce channels, `getNonce(address,uint256)`. */
  nonceManagerAddress: '0x813000000000000000000000000000000000aa01',
  /** Transaction Context precompile — sender / payer / actorId during execution. */
  txContextAddress: '0x813000000000000000000000000000000000aa02',
  /** Reserved sentinel authenticator for native secp256k1 (`ecrecover`). */
  k1Authenticator: '0x0000000000000000000000000000000000000001',
  /** `nonce_key` selecting nonce-free mode (expiry + `replay_id` replay protection). */
  nonceKeyMax: 2n ** 256n - 1n,
  /** Fixed intrinsic overhead of the AA path, analogous to the 21000 base cost. */
  baseCost: 15_000,
} as const

/**
 * Actor scope bitmask stored in `actor_config.scope`. `0x00` is unrestricted
 * and is also the admin predicate — every "admin" check in the spec is exactly
 * `scope == 0x00`. Unknown bits grant nothing.
 */
export const EIP_8130_ACTOR_SCOPE = {
  admin: 0x00,
  sender: 0x01,
  policy: 0x02,
  nonce: 0x04,
  selfPayer: 0x08,
  sponsorPayer: 0x10,
} as const

/**
 * `unsupported` — no 8130 system contracts visible; ERC-4337 is the only lane.
 * `partial` — some but not all of the system surface is live (Vibenet today).
 * `supported` — the precompiles a wallet needs are all present.
 */
export type NativeAaReadinessLevel = 'unsupported' | 'partial' | 'supported'

/** Raw `eth_getCode` / `eth_chainId` results, before interpretation. */
export type NativeAaProbeCodes = {
  chainId: number | null
  nonceManagerCode: string | null
  txContextCode: string | null
  /**
   * `ACCOUNT_CONFIG_ADDRESS` is CREATE2-derived and resolved at deployment, so
   * the spec does not pin it. Null means "we have no address to probe", which
   * is different from "probed and absent".
   */
  accountConfiguration: { address: string; code: string | null } | null
}

export type NativeAaReadiness = {
  chainId: number | null
  level: NativeAaReadinessLevel
  nonceManagerPresent: boolean
  txContextPresent: boolean
  /** Null when no `ACCOUNT_CONFIG_ADDRESS` was supplied to probe. */
  accountConfigurationPresent: boolean | null
  summary: string
}

export type NativeAaCheckResult = {
  required: boolean
  drifted: boolean
  error: string | null
}

function hasCode(code: string | null | undefined): boolean {
  if (typeof code !== 'string') return false
  const trimmed = code.trim()
  if (!/^0x[0-9a-fA-F]*$/.test(trimmed)) return false
  return trimmed.length > 2
}

/** Pure classifier over already-fetched RPC results. */
export function classifyNativeAaReadiness(codes: NativeAaProbeCodes): NativeAaReadiness {
  const nonceManagerPresent = hasCode(codes.nonceManagerCode)
  const txContextPresent = hasCode(codes.txContextCode)
  const accountConfigurationPresent = codes.accountConfiguration
    ? hasCode(codes.accountConfiguration.code)
    : null

  const anySurfacePresent =
    nonceManagerPresent || txContextPresent || accountConfigurationPresent === true
  const level: NativeAaReadinessLevel = !anySurfacePresent
    ? 'unsupported'
    : nonceManagerPresent && txContextPresent && accountConfigurationPresent !== false
      ? 'supported'
      : 'partial'

  const missing: string[] = []
  if (!nonceManagerPresent) missing.push('nonce manager precompile')
  if (!txContextPresent) missing.push('transaction context precompile')
  if (accountConfigurationPresent === false) missing.push('account configuration contract')

  const summary =
    level === 'unsupported'
      ? 'No EIP-8130 system surface — ERC-4337 EntryPoint v0.6 remains the only sponsored lane.'
      : level === 'supported'
        ? 'EIP-8130 system surface is live.'
        : `EIP-8130 partially live — missing: ${missing.join(', ')}.`

  return {
    chainId: codes.chainId,
    level,
    nonceManagerPresent,
    txContextPresent,
    accountConfigurationPresent,
    summary,
  }
}

/** Exit-code contract for the rollout tripwire. Probe failures take priority over drift. */
export function nativeAaCheckExitCode(results: NativeAaCheckResult[]): 0 | 1 | 2 {
  if (results.some((result) => result.required && result.error !== null)) return 1
  if (results.some((result) => result.drifted)) return 2
  return 0
}

/**
 * Minimal JSON-RPC caller so the probe stays transport-agnostic and testable.
 * Resolve with the `result` field and reject on RPC or transport errors.
 */
export type NativeAaRpcCall = (method: string, params: unknown[]) => Promise<unknown>

function parseChainId(value: unknown): number {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error('eth_chainId returned a malformed result')
  }
  const parsed = Number.parseInt(value, 16)
  if (!Number.isSafeInteger(parsed)) throw new Error('eth_chainId exceeds the supported range')
  return parsed
}

function parseCode(value: unknown, method: string): string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]*$/.test(value)) {
    throw new Error(`${method} returned a malformed result`)
  }
  return value
}

/**
 * Probe a chain for the EIP-8130 system surface. Read-only: three (optionally
 * four) `eth_` calls, no signing, no state change.
 */
export async function probeNativeAaReadiness(
  rpc: NativeAaRpcCall,
  options: {
    accountConfigurationAddress?: string | null
    expectedChainId?: number | null
  } = {},
): Promise<NativeAaReadiness> {
  const accountConfigurationAddress = options.accountConfigurationAddress?.trim() || null

  const [chainIdRaw, nonceManagerCode, txContextCode, accountConfigurationCode] = await Promise.all([
    rpc('eth_chainId', []),
    rpc('eth_getCode', [EIP_8130.nonceManagerAddress, 'latest']),
    rpc('eth_getCode', [EIP_8130.txContextAddress, 'latest']),
    accountConfigurationAddress
      ? rpc('eth_getCode', [accountConfigurationAddress, 'latest'])
      : Promise.resolve(null),
  ])
  const chainId = parseChainId(chainIdRaw)
  if (options.expectedChainId != null && chainId !== options.expectedChainId) {
    throw new Error(`Expected chain ${options.expectedChainId}, received ${chainId}`)
  }

  return classifyNativeAaReadiness({
    chainId,
    nonceManagerCode: parseCode(nonceManagerCode, 'nonce manager eth_getCode'),
    txContextCode: parseCode(txContextCode, 'transaction context eth_getCode'),
    accountConfiguration: accountConfigurationAddress
      ? {
          address: accountConfigurationAddress,
          code: parseCode(accountConfigurationCode, 'account configuration eth_getCode'),
        }
      : null,
  })
}
