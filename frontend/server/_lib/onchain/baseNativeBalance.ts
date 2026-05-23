import { createPublicClient, http, type Address } from 'viem'
import { base } from 'viem/chains'

const DEFAULT_BASE_RPCS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base-mainnet.public.blastapi.io',
] as const

export function resolveBaseRpcUrls(): string[] {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  if (!raw) return [...DEFAULT_BASE_RPCS]
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return Array.from(new Set([...parts, ...DEFAULT_BASE_RPCS]))
}

/** Read native balance from every configured Base RPC and return the highest value. */
export async function readMaxNativeBalanceWei(address: Address): Promise<bigint> {
  let maxBalance = 0n
  for (const url of resolveBaseRpcUrls()) {
    try {
      const client = createPublicClient({ chain: base, transport: http(url) })
      const balance = await client.getBalance({ address, blockTag: 'latest' })
      if (balance > maxBalance) maxBalance = balance
    } catch {
      // Fail open per URL — other RPCs may still return a fresh balance.
    }
  }
  return maxBalance
}
