import type { Address } from 'viem'

export type CreatorEconomyAuctionState =
  | 'none'
  | 'scheduled'
  | 'live'
  | 'graduated'
  | 'failed'

export type CreatorEconomyBundleStatus = 'not_required' | 'required' | 'unlocked'

export type CreatorEconomySigningStatus =
  | 'ready'
  | 'setup'
  | 'unavailable'
  | 'external'
  | 'action_required'

export type CreatorEconomyStrategyLeg = 'Charm' | 'Ajna' | 'Solana'

export type CreatorEconomyRole = 'prelaunch_creator' | 'creator' | 'holder' | 'none'

export type CreatorEconomyLink = {
  label: string
  href: string
}

/**
 * Address-keyed capability snapshot for the creator-economy tray.
 * Do not derive legacy/paywall behavior from token symbols.
 */
export type CreatorEconomyCapabilities = {
  hasCreatorCoin: boolean
  hasVault: boolean
  symbol: string | null
  logoUrl: string | null
  handleOrBasename: string | null
  creatorCoinAddress: Address | null
  vaultAddress: Address | null
  shareOftAddress: Address | null
  ccaLaunchArm: Address | null
  bundleStatus: CreatorEconomyBundleStatus
  activationComplete: boolean
  auctionState: CreatorEconomyAuctionState
  settlementComplete: boolean
  /** null = unknown; never force Trading live from null alone */
  hookAligned: boolean | null
  isLegacyStack: boolean
  verifiedStrategies: CreatorEconomyStrategyLeg[]
  tvlUsd: string | null
  sharePpsUsd: string | null
  claimableCreatorEarningsEth: string | null
  accountSigningStatus: CreatorEconomySigningStatus
  connectionsLinked: number
  connectionsTotal: number
  nextConnectionBonus: { label: string; points: number } | null
  shareOftBalance: string | null
  vaultShareBalance: string | null
  ownsCreatorEconomy: boolean
  /** Phase-3 plan weights from deployPlan when available (bps as display strings). */
  strategyPlanLabel: string | null
  hasShareHoldings: boolean
}

export type CreatorEconomyView = {
  role: CreatorEconomyRole
  headline: string
  statusLabel: string
  statusDetail: string | null
  networkLabel: 'Base'
  legacyBadge: string | null
  showThreeTokenRail: boolean
  railActive: boolean
  primaryAction: CreatorEconomyLink | null
  secondaryLink: CreatorEconomyLink | null
  showPaywall: boolean
  metrics: {
    tvlUsd: string | null
    sharePpsUsd: string | null
    claimableCreatorEarningsEth: string | null
  }
  holder: {
    shareOftBalance: string | null
    vaultShareBalance: string | null
  } | null
  launchAllocationLabel: string
  strategyPlanLabel: string | null
  infrastructureLabel: string
  accountSigningLabel: string
  connectionsSummary: string
  nextConnectionBonus: { label: string; points: number } | null
  symbolDisplay: string
  logoUrl: string | null
  handleOrBasename: string | null
  vaultHref: string | null
  preferEconomyTab: boolean
}
