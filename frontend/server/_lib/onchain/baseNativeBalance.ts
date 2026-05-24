import { createPublicClient, http, type Address } from 'viem'
import { base } from 'viem/chains'

import { resolveServerBaseRpcUrls } from './baseRpcUrl.js'

export function resolveBaseRpcUrls(): string[] {
  return resolveServerBaseRpcUrls()
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
