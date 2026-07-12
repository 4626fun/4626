import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'

import type { AccountSetupMe } from '@/features/accountSetup/types'
import { useCreatorCoinBadge } from '@/hooks/useCreatorCoinBadge'
import { summarizeTrayConnections } from '@/lib/creatorEconomy/connectionsSummary'
import {
  fetchCreatorEconomyOnchainSnapshot,
  formatClaimableEth,
} from '@/lib/creatorEconomy/fetchCreatorEconomySnapshot'
import {
  resolveCreatorEconomyView,
} from '@/lib/creatorEconomy/resolveCreatorEconomyView'
import type {
  CreatorEconomyCapabilities,
  CreatorEconomySigningStatus,
  CreatorEconomyView,
} from '@/lib/creatorEconomy/types'
import { fetchProtocolRewardsBalance } from '@/lib/onchain/protocolRewards'

export type UseCreatorEconomySummaryParams = {
  creatorCoinAddress: Address | null | undefined
  cswAddress: Address | null | undefined
  /** Wallet used for ▢/■ balance reads (CSW preferred). */
  holderAddress?: Address | null
  handleOrBasename?: string | null
  accountMe?: AccountSetupMe | null
  accountSigningStatus: CreatorEconomySigningStatus
  /** Whether this session owns the creator economy (creator coin mapped to their CSW). */
  ownsCreatorEconomy?: boolean
  enabled?: boolean
  mode?: 'waitlist' | 'app'
}

export type CreatorEconomySummary = {
  loading: boolean
  capabilities: CreatorEconomyCapabilities
  view: CreatorEconomyView
}

function parsePriceUsd(raw: string | null | undefined): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[$,]/g, '').trim()
  const value = Number(cleaned)
  return Number.isFinite(value) && value > 0 ? value : null
}

function hasPositiveBalance(value: string | null | undefined): boolean {
  if (!value) return false
  const n = Number(value.replace(/,/g, ''))
  return Number.isFinite(n) && n > 0
}

/**
 * Compose creator-economy capabilities for trays.
 * Uses wagmi-free Base reads + public APIs so waitlist can consume it safely.
 */
export function useCreatorEconomySummary(
  params: UseCreatorEconomySummaryParams,
): CreatorEconomySummary {
  const enabled = params.enabled !== false
  const coinAddress = params.creatorCoinAddress ?? null
  const coinBadge = useCreatorCoinBadge(coinAddress)
  const connections = summarizeTrayConnections(params.accountMe)
  const ownsCreatorEconomy = params.ownsCreatorEconomy ?? Boolean(coinAddress)
  const assetPriceUsd = parsePriceUsd(coinBadge?.priceUsd)

  const snapshotQuery = useQuery({
    queryKey: [
      'creator-economy-summary',
      params.mode ?? 'app',
      coinAddress,
      params.holderAddress ?? null,
      assetPriceUsd,
    ],
    enabled: enabled && Boolean(coinAddress),
    staleTime: 30_000,
    retry: 0,
    queryFn: async () => {
      if (!coinAddress) return null
      return fetchCreatorEconomyOnchainSnapshot({
        creatorCoinAddress: coinAddress,
        holderAddress: params.holderAddress ?? params.cswAddress ?? null,
        assetPriceUsd,
      })
    },
  })

  const earningsQuery = useQuery({
    queryKey: ['creator-economy-earnings', params.cswAddress],
    enabled: enabled && params.mode === 'app' && Boolean(params.cswAddress) && ownsCreatorEconomy,
    staleTime: 60_000,
    retry: 0,
    queryFn: async () => {
      if (!params.cswAddress) return null
      try {
        return await fetchProtocolRewardsBalance(params.cswAddress)
      } catch {
        return null
      }
    },
  })

  const capabilities = useMemo<CreatorEconomyCapabilities>(() => {
    const snapshot = snapshotQuery.data
    const resolved = snapshot?.resolved ?? null
    const hasVault = Boolean(resolved?.info.vault)
    const shareOftBalance = snapshot?.shareOftBalance ?? null
    const vaultShareBalance = snapshot?.vaultShareBalance ?? null
    const hasShareHoldings =
      hasPositiveBalance(shareOftBalance) || hasPositiveBalance(vaultShareBalance)

    return {
      hasCreatorCoin: Boolean(coinAddress),
      hasVault,
      symbol: coinBadge?.symbol ?? resolved?.info.symbol ?? null,
      logoUrl: coinBadge?.logoUrl ?? null,
      handleOrBasename: params.handleOrBasename ?? null,
      creatorCoinAddress: coinAddress,
      vaultAddress: resolved?.info.vault ?? null,
      shareOftAddress: resolved?.info.shareOFT ?? null,
      ccaLaunchArm: resolved?.ccaLaunchArm ?? null,
      bundleStatus: snapshot?.bundleStatus ?? (hasVault ? 'not_required' : 'required'),
      activationComplete: snapshot?.activationComplete ?? false,
      auctionState: snapshot?.auctionState ?? 'none',
      settlementComplete: snapshot?.settlementComplete ?? false,
      hookAligned: null,
      isLegacyStack: snapshot?.isLegacyStack ?? false,
      verifiedStrategies: snapshot?.verifiedStrategies ?? [],
      tvlUsd: snapshot?.tvlUsd ?? null,
      sharePpsUsd: snapshot?.sharePpsUsd ?? null,
      claimableCreatorEarningsEth: formatClaimableEth(earningsQuery.data ?? null),
      accountSigningStatus: params.accountSigningStatus,
      connectionsLinked: connections.linked,
      connectionsTotal: connections.total,
      nextConnectionBonus: connections.nextBonus,
      shareOftBalance,
      vaultShareBalance,
      ownsCreatorEconomy,
      strategyPlanLabel: snapshot?.strategyPlanLabel ?? null,
      hasShareHoldings,
    }
  }, [
    coinAddress,
    coinBadge?.symbol,
    coinBadge?.logoUrl,
    params.handleOrBasename,
    params.accountSigningStatus,
    connections.linked,
    connections.total,
    connections.nextBonus,
    ownsCreatorEconomy,
    snapshotQuery.data,
    earningsQuery.data,
  ])

  const view = useMemo(() => resolveCreatorEconomyView(capabilities), [capabilities])

  return {
    loading:
      Boolean(coinAddress) &&
      (snapshotQuery.isLoading || Boolean(coinBadge?.loading)),
    capabilities,
    view,
  }
}
