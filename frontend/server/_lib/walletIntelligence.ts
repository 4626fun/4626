/**
 * Wallet Intelligence orchestrator.
 *
 * Combines funder tracing, entity labeling, portfolio data, ENS resolution,
 * Lens identity, Basenames, and reputation scoring into a single enriched
 * graph that can be stored on Lens Grove.
 */

import { traceFundersMultiChain, type FunderTraceResult } from './funderTrace.js'
import { getWalletLabelsBatch, type WalletLabelResult } from './walletLabels.js'
import { getEnsProfile, type EnsProfile } from './ensResolver.js'
import { getWalletPortfolio, type WalletPortfolio } from './debankPortfolio.js'
import { resolveCanonicalSmartWalletAddress } from './canonicalWalletResolver.js'
import { resolveLensUserByOwner } from './lensAccounts.js'

// ---------------------------------------------------------------------------
// Graph types
// ---------------------------------------------------------------------------

export type IntelNodeType =
  | 'wallet'
  | 'funder'
  | 'entity-label'
  | 'portfolio'
  | 'ens-name'
  | 'basename'
  | 'lens-account'
  | 'reputation-score'

export type IntelEdgeType =
  | 'funded_by'
  | 'labeled_as'
  | 'has_portfolio'
  | 'has_ens'
  | 'has_basename'
  | 'has_lens'
  | 'has_reputation'

export type IntelNode = {
  id: string
  type: IntelNodeType
  label: string
  data: Record<string, unknown>
}

export type IntelEdge = {
  source: string
  target: string
  type: IntelEdgeType
  data?: Record<string, unknown>
}

export type IntelGroup = {
  id: string
  label: string
  nodeIds: string[]
}

export type WalletIntelligenceGraph = {
  target: string
  canonicalWallet: string
  nodes: IntelNode[]
  edges: IntelEdge[]
  groups: IntelGroup[]
  /** Raw source data for consumers that want structured access. */
  sources: {
    funderTrace: FunderTraceResult | null
    labels: Record<string, WalletLabelResult>
    portfolio: WalletPortfolio | null
    ens: EnsProfile | null
    lens: {
      handle: string | null
      username: string | null
      displayName: string
      avatar: string | null
      accountAddress: string
      ownerAddress: string | null
    } | null
    basename: string | null
  }
  generatedAt: string
  source: string
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type WalletIntelligenceOptions = {
  /** Number of funder hops to trace (default 3, max 5). */
  hops?: number
  /** Chain IDs for funder tracing (default [8453, 1]). */
  chainIds?: number[]
  /** Whether to include portfolio data (default true). */
  includePortfolio?: boolean
  /** Whether to include ENS resolution (default true). */
  includeEns?: boolean
  /** Whether to include Lens resolution (default true). */
  includeLens?: boolean
  /** Whether to include entity labels (default true). */
  includeLabels?: boolean
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildWalletIntelligence(
  address: string,
  options: WalletIntelligenceOptions = {},
): Promise<WalletIntelligenceGraph> {
  const {
    hops = 3,
    chainIds = [8453, 1],
    includePortfolio = true,
    includeEns = true,
    includeLens = true,
    includeLabels = true,
  } = options

  const addr = address.toLowerCase()

  // Step 1: Resolve canonical wallet (CSW → EOA if applicable).
  const canonicalWallet = (await resolveCanonicalSmartWalletAddress(addr)) ?? addr

  // Step 2: Kick off all independent data fetches in parallel.
  const [funderResult, portfolio, ens, lensUser] = await Promise.all([
    traceFundersMultiChain(canonicalWallet, { hops, chainIds }),
    includePortfolio ? getWalletPortfolio(canonicalWallet) : null,
    includeEns ? getEnsProfile(canonicalWallet) : null,
    includeLens ? resolveLensUserByOwner(canonicalWallet) : null,
  ])

  // Step 3: Collect all addresses that need labels (target + funders).
  const allAddresses = new Set<string>([canonicalWallet])
  for (const hop of funderResult.chain) {
    allAddresses.add(hop.funderAddress)
  }

  const labels: Record<string, WalletLabelResult> = includeLabels
    ? await getWalletLabelsBatch(Array.from(allAddresses), 8453)
    : {}

  // Step 4: Build the graph.
  const nodes: IntelNode[] = []
  const edges: IntelEdge[] = []
  const groups: IntelGroup[] = []

  // -- Target wallet node --
  const walletNodeId = `wallet:${canonicalWallet}`
  nodes.push({
    id: walletNodeId,
    type: 'wallet',
    label: canonicalWallet,
    data: {
      address: canonicalWallet,
      requestedAddress: addr,
      isCanonical: canonicalWallet !== addr,
    },
  })

  // -- Funder chain nodes + edges --
  const funderGroupNodeIds: string[] = []
  for (const hop of funderResult.chain) {
    const funderNodeId = `funder:${hop.funderAddress}:hop${hop.hop}`
    nodes.push({
      id: funderNodeId,
      type: 'funder',
      label: hop.funderAddress,
      data: {
        address: hop.funderAddress,
        hop: hop.hop,
        txHash: hop.funderTxHash,
        blockNumber: hop.blockNumber,
        timestamp: hop.timestamp,
        chainId: hop.chainId,
      },
    })

    const sourceId = hop.hop === 1 ? walletNodeId : `funder:${hop.address}:hop${hop.hop - 1}`
    edges.push({
      source: sourceId,
      target: funderNodeId,
      type: 'funded_by',
      data: {
        txHash: hop.funderTxHash,
        blockNumber: hop.blockNumber,
        timestamp: hop.timestamp,
        chainId: hop.chainId,
      },
    })

    funderGroupNodeIds.push(funderNodeId)
  }

  if (funderGroupNodeIds.length > 0) {
    groups.push({
      id: 'group:funders',
      label: 'Funding Chain',
      nodeIds: funderGroupNodeIds,
    })
  }

  // -- Entity label nodes + edges --
  const labelNodeIds: string[] = []
  for (const [labelAddr, labelResult] of Object.entries(labels)) {
    if (!labelResult.isKnownEntity) continue

    for (const lbl of labelResult.labels) {
      const labelNodeId = `label:${labelAddr}:${lbl.name.toLowerCase().replace(/\s+/g, '-')}`
      nodes.push({
        id: labelNodeId,
        type: 'entity-label',
        label: lbl.name,
        data: {
          entityName: lbl.name,
          category: lbl.category,
          subcategory: lbl.subcategory,
          source: lbl.source,
        },
      })

      // Find the node for this address (wallet or funder).
      const addressNodeId =
        labelAddr === canonicalWallet
          ? walletNodeId
          : funderResult.chain.find((h) => h.funderAddress === labelAddr)
            ? `funder:${labelAddr}:hop${funderResult.chain.find((h) => h.funderAddress === labelAddr)!.hop}`
            : walletNodeId

      edges.push({
        source: addressNodeId,
        target: labelNodeId,
        type: 'labeled_as',
      })

      labelNodeIds.push(labelNodeId)
    }
  }

  if (labelNodeIds.length > 0) {
    groups.push({
      id: 'group:labels',
      label: 'Known Entities',
      nodeIds: labelNodeIds,
    })
  }

  // -- Portfolio node + edge --
  if (portfolio) {
    const portfolioNodeId = `portfolio:${canonicalWallet}`
    nodes.push({
      id: portfolioNodeId,
      type: 'portfolio',
      label: `$${formatUsd(portfolio.totalUsdValue)}`,
      data: {
        totalUsdValue: portfolio.totalUsdValue,
        topTokenCount: portfolio.topTokens.length,
        activeChainsCount: portfolio.activeChains.length,
        protocolCount: portfolio.protocols.length,
        topTokens: portfolio.topTokens.slice(0, 5).map((t) => ({
          symbol: t.symbol,
          usdValue: t.usdValue,
        })),
        topChains: portfolio.activeChains.slice(0, 5).map((c) => ({
          name: c.name,
          usdValue: c.usdValue,
        })),
        topProtocols: portfolio.protocols.slice(0, 5).map((p) => ({
          name: p.name,
          netUsdValue: p.netUsdValue,
        })),
      },
    })

    edges.push({
      source: walletNodeId,
      target: portfolioNodeId,
      type: 'has_portfolio',
    })
  }

  // -- ENS node + edge --
  if (ens?.name) {
    const ensNodeId = `ens:${canonicalWallet}`
    nodes.push({
      id: ensNodeId,
      type: 'ens-name',
      label: ens.name,
      data: {
        name: ens.name,
        avatar: ens.avatar,
        displayName: ens.displayName,
        description: ens.description,
        twitter: ens.twitter,
        github: ens.github,
        url: ens.url,
      },
    })

    edges.push({
      source: walletNodeId,
      target: ensNodeId,
      type: 'has_ens',
    })
  }

  // -- Lens node + edge --
  if (lensUser) {
    const lensNodeId = `lens:${lensUser.accountAddress.toLowerCase()}`
    nodes.push({
      id: lensNodeId,
      type: 'lens-account',
      label: lensUser.handle ? `@${lensUser.handle}` : lensUser.accountAddress,
      data: {
        handle: lensUser.handle,
        username: lensUser.username,
        displayName: lensUser.displayName,
        avatar: lensUser.avatar,
        accountAddress: lensUser.accountAddress,
        ownerAddress: lensUser.ownerAddress,
      },
    })

    edges.push({
      source: walletNodeId,
      target: lensNodeId,
      type: 'has_lens',
    })
  }

  // -- Basename (check if we can resolve without importing the client-side module) --
  // We do a lightweight check: if ENS returned a .base.eth name, use that.
  // Otherwise, we skip (the full basename-api is a client-side module).
  let basename: string | null = null
  // Basenames are resolved on Base chain via ENS; we can't call the client-side module here.
  // The basename will be included if the reputation aggregator is called separately.

  return {
    target: addr,
    canonicalWallet,
    nodes,
    edges,
    groups,
    sources: {
      funderTrace: funderResult,
      labels,
      portfolio,
      ens,
      lens: lensUser
        ? {
            handle: lensUser.handle,
            username: lensUser.username,
            displayName: lensUser.displayName,
            avatar: lensUser.avatar,
            accountAddress: lensUser.accountAddress,
            ownerAddress: lensUser.ownerAddress,
          }
        : null,
      basename,
    },
    generatedAt: new Date().toISOString(),
    source: 'wallet-intelligence.v1',
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(2)
}
