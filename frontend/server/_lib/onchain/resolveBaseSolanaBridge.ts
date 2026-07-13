/**
 * Resolve the Base↔Solana bridge core (scalars / bridgeToken routes) from env
 * or the repo default. Twin SolanaBridgeAdapter lookup is retired — LayerZero
 * ShareOFT is the active share-mesh plane.
 */

import { getAddress, isAddress, type Address } from 'viem'

/** Base Solana bridge core on mainnet (`scalars` / route liveness). */
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
 * or for fork tests.
 */
export function readBaseSolanaBridgeFromEnv(env: EnvLike = process.env): Address | null {
  const keys = ['BASE_SOLANA_BRIDGE', 'SOLANA_BRIDGE_CORE', 'SOLANA_BASE_BRIDGE'] as const
  for (const key of keys) {
    const resolved = normalizeAddress(String(env[key] ?? '').trim())
    if (resolved) return resolved
  }
  return null
}

export type ResolveBaseSolanaBridgeResult = {
  address: Address
  source: 'env' | 'default'
}

/**
 * Resolve the Base Solana bridge core address.
 *
 * Priority:
 * 1. Env (`BASE_SOLANA_BRIDGE` / `SOLANA_BRIDGE_CORE` / `SOLANA_BASE_BRIDGE`)
 * 2. Repo default
 */
export async function resolveBaseSolanaBridge(params?: {
  publicClient?: ReaderClient
  adapterAddress?: Address | null
  env?: EnvLike
}): Promise<ResolveBaseSolanaBridgeResult> {
  void params?.publicClient
  void params?.adapterAddress
  const env = params?.env ?? process.env
  const fromEnv = readBaseSolanaBridgeFromEnv(env)
  if (fromEnv) {
    return { address: fromEnv, source: 'env' }
  }

  return { address: DEFAULT_BASE_SOLANA_BRIDGE, source: 'default' }
}

/** Sync helper when only env/default are needed (no on-chain read). */
export function resolveBaseSolanaBridgeSync(env: EnvLike = process.env): Address {
  return readBaseSolanaBridgeFromEnv(env) ?? DEFAULT_BASE_SOLANA_BRIDGE
}
