import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

/**
 * Returns a viem PublicClient pinned to Base mainnet. The batch config
 * enables multicall aggregation so the owner-enrichment pass (many
 * `ownerAtIndex` calls per CSW) doesn't hammer the RPC with serial
 * requests.
 *
 * We intentionally let viem infer the return type rather than annotating
 * it as `PublicClient` — the generic PublicClient's transaction union
 * is Mainnet-shaped and doesn't admit OpStack (Base) "deposit" txs, so
 * an explicit annotation breaks type assignability at call sites.
 */
export function createBasePublicClient() {
  const rpcUrl = (process.env.BASE_RPC_URL ?? "").trim() || "https://mainnet.base.org";
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl, {
      // Retry transient 429/503s with backoff — paid RPCs still rate-limit
      // during bursts and we batch a lot of owner reads.
      retryCount: 3,
      retryDelay: 500,
    }),
    batch: {
      multicall: {
        batchSize: 1024,
        wait: 16,
      },
    },
  });
}

/** Inferred client type — use this in place of `PublicClient` at call sites. */
export type BasePublicClient = ReturnType<typeof createBasePublicClient>;
