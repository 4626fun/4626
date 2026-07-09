/**
 * M2-05 — resolve the Base↔Solana bridge core (scalars / bridgeToken routes)
 * from env or the live SolanaBridgeAdapter.BRIDGE() constant instead of a
 * hand-copied address in every deploy/provisioner handler.
 *
 * Adapter (mint registry) and bridge core (route scalars) are distinct:
 * - solanaBridgeAdapter: 4626 SolanaBridgeAdapter on the batcher
 * - baseSolanaBridge:    Base bridge core with `scalars(local, remote)`
 */

import { getAddress, isAddress, type Address } from 'viem'

/** Matches `SolanaBridgeAdapter.BRIDGE` on Base mainnet. */
export const DEFAULT_BASE_SOLANA_BRIDGE = '0x3eff766c76a1be2ce1acf2b69c78bcae257d5188' as Address

export const BASE_SOLANA_BRIDGE_SCALARS_ABI = [
  {
    type: 'function',
    name: 'scalars',
    stateMutability: 'view',
    inputs: [
      { name: 'localToken', type: 'address' },
      { name: 'remoteToken', type: 'bytes32' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const

export const SOLANA_BRIDGE_ADAPTER_BRIDGE_VIEW_ABI = [
  {
    type: 'function',
    name: 'BRIDGE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

type EnvLike = Record<string, string | undefined>

type ReaderClient = {
  readContract: (args: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  const normalized = getAddress(value as Address)
  if (normalized === '0x0000000000000000000000000000000000000000') return null
  return normalized
}

/**
 * Env override keys (first match wins). Useful when the bridge core moves
 * ahead of an adapter redeploy or for fork tests.
 */
export function readBaseSolanaBridgeFromEnv(env: EnvLike = process.env): Address | null {
  const keys = ['BASE_SOLANA_BRIDGE', 'SOLANA_BRIDGE_CORE', 'SOLANA_BASE_BRIDGE'] as const
  for (const key of keys) {
    const resolved = normalizeAddress(String(env[key] ?? '').trim())
    if (resolved) return resolved
  }
  return null
}

/**
 * Read `BRIDGE` from a SolanaBridgeAdapter instance (public constant getter).
 */
export async function readBridgeCoreFromAdapter(params: {
  publicClient: ReaderClient
  adapterAddress: Address
}): Promise<Address | null> {
  try {
    const raw = await params.publicClient.readContract({
      address: params.adapterAddress,
      abi: SOLANA_BRIDGE_ADAPTER_BRIDGE_VIEW_ABI,
      functionName: 'BRIDGE',
    })
    return normalizeAddress(raw)
  } catch {
    return null
  }
}

export type ResolveBaseSolanaBridgeResult = {
  address: Address
  source: 'env' | 'adapter' | 'default'
}

/**
 * Resolve the Base Solana bridge core address.
 *
 * Priority:
 * 1. Env (`BASE_SOLANA_BRIDGE` / `SOLANA_BRIDGE_CORE` / `SOLANA_BASE_BRIDGE`)
 * 2. On-chain `adapter.BRIDGE()` when `adapterAddress` + `publicClient` given
 * 3. Repo default matching `SolanaBridgeAdapter.sol`
 */
export async function resolveBaseSolanaBridge(params?: {
  publicClient?: ReaderClient
  adapterAddress?: Address | null
  env?: EnvLike
}): Promise<ResolveBaseSolanaBridgeResult> {
  const env = params?.env ?? process.env
  const fromEnv = readBaseSolanaBridgeFromEnv(env)
  if (fromEnv) {
    return { address: fromEnv, source: 'env' }
  }

  const adapter = normalizeAddress(params?.adapterAddress)
  if (adapter && params?.publicClient) {
    const fromAdapter = await readBridgeCoreFromAdapter({
      publicClient: params.publicClient,
      adapterAddress: adapter,
    })
    if (fromAdapter) {
      return { address: fromAdapter, source: 'adapter' }
    }
  }

  return { address: DEFAULT_BASE_SOLANA_BRIDGE, source: 'default' }
}

/** Sync helper when only env/default are needed (no on-chain read). */
export function resolveBaseSolanaBridgeSync(env: EnvLike = process.env): Address {
  return readBaseSolanaBridgeFromEnv(env) ?? DEFAULT_BASE_SOLANA_BRIDGE
}
