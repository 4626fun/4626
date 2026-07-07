import type { Address, Chain, PublicClient, Transport } from 'viem'

const VAULT_PPS_ABI = [
  {
    type: 'function',
    name: 'pricePerShare',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

const ORACLE_PRICE_ABI = [
  {
    type: 'function',
    name: 'getAssetPrice',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'int256' }, { type: 'uint256' }],
  },
] as const

export type VaultSharePriceSnapshot = {
  agentUsd: bigint | null
  ppsAgent: bigint | null
  ppsUsd: bigint | null
  oracleTimestamp: bigint | null
}

/**
 * Read vault PPS and convert it into USD via oracle price.
 * All returned values are 1e18-scaled fixed-point values.
 */
export async function readVaultSharePriceSnapshot<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(
  publicClient: PublicClient<TTransport, TChain>,
  params: { vault: Address; oracle?: Address | null },
): Promise<VaultSharePriceSnapshot> {
  const ppsRaw = (await publicClient.readContract({
    address: params.vault,
    abi: VAULT_PPS_ABI,
    functionName: 'pricePerShare',
  })) as bigint

  const snapshot: VaultSharePriceSnapshot = {
    agentUsd: null,
    ppsAgent: ppsRaw,
    ppsUsd: null,
    oracleTimestamp: null,
  }

  if (!params.oracle) return snapshot

  try {
    const [oraclePrice, oracleTimestamp] = (await publicClient.readContract({
      address: params.oracle,
      abi: ORACLE_PRICE_ABI,
      functionName: 'getAssetPrice',
    })) as readonly [bigint, bigint]

    if (oraclePrice > 0n) {
      snapshot.agentUsd = oraclePrice
      snapshot.oracleTimestamp = oracleTimestamp
      snapshot.ppsUsd = (ppsRaw * oraclePrice) / 1_000_000_000_000_000_000n
    }
  } catch {
    // Keep PPS available even if oracle price read fails.
  }

  return snapshot
}
