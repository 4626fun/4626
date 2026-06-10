import { createPublicClient, fallback, http, type PublicClient } from 'viem'
import { base } from 'viem/chains'

/** Same-origin Base reads that skip deploy-dry-run Anvil fork when present. */
export const PRODUCTION_BASE_RPC_PROXY = '/api/rpc?chain=base&skipLocalFork=1'

let cached: PublicClient | null = null

/**
 * Mainnet Base reads for swap/permit paths that submit UserOps to live CDP infra.
 * Deploy-dry-run otherwise routes `/api/rpc?chain=base` through a local fork first.
 */
export function getProductionBaseReadClient(): PublicClient {
  if (!cached) {
    cached = createPublicClient({
      chain: base,
      transport: fallback([
        http(PRODUCTION_BASE_RPC_PROXY, {
          retryCount: 1,
          timeout: 20_000,
          fetchOptions: { credentials: 'include' },
        }),
        http('https://mainnet.base.org', { retryCount: 1, timeout: 20_000 }),
      ]),
    }) as PublicClient
  }
  return cached
}
