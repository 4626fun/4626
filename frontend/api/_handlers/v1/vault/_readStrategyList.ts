/**
 * Read vault strategy addresses + weights using the live CreatorOVault surface.
 * `getStrategies()` is not present on current modules — use strategyCount/list/weights.
 */

export const VAULT_STRATEGY_LIST_ABI = [
  {
    type: 'function',
    name: 'strategyCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'strategyList',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'strategyWeights',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'strategyDebt',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

export type VaultStrategyRow = {
  address: `0x${string}`
  weight: bigint
  debt: bigint | null
}

type ReadClient = {
  readContract: (args: any) => Promise<unknown>
  multicall: (args: any) => Promise<any[]>
}

function pickResult<T>(r: any): T | null {
  return r?.status === 'success' ? (r.result as T) : null
}

export async function readVaultStrategyList(
  client: ReadClient,
  vault: `0x${string}`,
): Promise<VaultStrategyRow[]> {
  let count = 0n
  try {
    count = (await client.readContract({
      address: vault,
      abi: VAULT_STRATEGY_LIST_ABI,
      functionName: 'strategyCount',
      args: [],
    })) as bigint
  } catch {
    return []
  }

  const n = Number(count)
  if (!Number.isFinite(n) || n <= 0) return []
  // Cap defensive read size (vaults have MAX_STRATEGIES << 64)
  const size = Math.min(n, 64)

  const listRes = await client.multicall({
    allowFailure: true,
    contracts: Array.from({ length: size }, (_, i) => ({
      address: vault,
      abi: VAULT_STRATEGY_LIST_ABI,
      functionName: 'strategyList',
      args: [BigInt(i)],
    })),
  })

  const addresses: `0x${string}`[] = []
  for (const r of listRes) {
    const addr = pickResult<`0x${string}`>(r)
    if (addr && /^0x[a-fA-F0-9]{40}$/.test(addr)) addresses.push(addr)
  }
  if (!addresses.length) return []

  const metaRes = await client.multicall({
    allowFailure: true,
    contracts: addresses.flatMap((address) => [
      { address: vault, abi: VAULT_STRATEGY_LIST_ABI, functionName: 'strategyWeights', args: [address] },
      { address: vault, abi: VAULT_STRATEGY_LIST_ABI, functionName: 'strategyDebt', args: [address] },
    ]),
  })

  return addresses.map((address, i) => {
    const weight = pickResult<bigint>(metaRes[i * 2]) ?? 0n
    const debt = pickResult<bigint>(metaRes[i * 2 + 1])
    return { address, weight, debt }
  })
}
