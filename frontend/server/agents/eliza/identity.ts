/**
 * ERC-8004 Agent Identity — loaded from environment variables.
 *
 * Extracted into its own module to avoid circular imports
 * (index.ts → plugins → index.ts).
 */

declare const process: { env: Record<string, string | undefined> }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Erc8004Identity = {
  agentId: number
  registryAddress: string
  chainId: number
  /** CAIP-10 reference: eip155:<chainId>:<registryAddress> */
  agentRegistry: string
  /** Reputation registry address on the same chain */
  reputationRegistry: string
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

function loadErc8004Identity(): Erc8004Identity | null {
  const agentId = Number(process.env.ERC8004_AGENT_ID ?? '')
  const registryAddress = (process.env.ERC8004_AGENT_REGISTRY ?? '').trim()
  const chainId = Number(process.env.ERC8004_AGENT_CHAIN_ID ?? '')
  const reputationRegistry = (process.env.ERC8004_REPUTATION_REGISTRY ?? '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63').trim()

  if (!Number.isFinite(agentId) || agentId < 0) return null
  if (!registryAddress || !/^0x[a-fA-F0-9]{40}$/.test(registryAddress)) return null
  if (!Number.isFinite(chainId) || chainId <= 0) return null

  return {
    agentId,
    registryAddress,
    chainId,
    agentRegistry: `eip155:${chainId}:${registryAddress.toLowerCase()}`,
    reputationRegistry,
  }
}

/** The agent's on-chain ERC-8004 identity, or null if not configured. */
export const erc8004Identity = loadErc8004Identity()
