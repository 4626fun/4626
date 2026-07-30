/**
 * Canonical Creator Vault economics for the marketing mechanism sim.
 * Source of truth: operator terminology + creatorvault business-logic audit.
 * Do NOT import STORY_CONTENT here — marketing story numbers still drift.
 */

export type ShareAllocationWeights = {
  /** CCA fair-launch arm */
  cca: number
  /** Creator vesting */
  vesting: number
  /** Solana share-mesh arm (not a Phase-3 leg) */
  solanaArm: number
  /** LP reserve */
  lpReserve: number
}

export type LegWeights = {
  charm: number
  ajna: number
  idle: number
}

export type GaugeSplitWeights = {
  burn: number
  jackpot: number
  creatorTreasury: number
  protocol: number
}

export type CreatorVaultSimParams = {
  /** Creator coin deposited per second (accelerated) */
  depositRate: number
  /** ■ trade events per second */
  tradeActivity: number
  /** Trade fee in bps applied to ■ notional (funds tradeFeeCollector → gauge) */
  tradingFeeBps: number
  /** CCA graduation threshold in share units */
  ccaThreshold: number
  /** Fraction of new ▢ that wraps to ■ for trading (0–1) */
  wrapRatio: number
  /** External creator-coin earnings routed via PayoutRouter per second */
  payoutInflowRate: number
  legs: LegWeights
  gauge: GaugeSplitWeights
  shareAllocation: ShareAllocationWeights
}

export const DEFAULT_SHARE_ALLOCATION: ShareAllocationWeights = {
  cca: 30,
  vesting: 30,
  solanaArm: 30,
  lpReserve: 10,
}

export const DEFAULT_LEG_WEIGHTS: LegWeights = {
  charm: 45,
  ajna: 45,
  idle: 10,
}

export const DEFAULT_GAUGE_SPLIT: GaugeSplitWeights = {
  burn: 40,
  jackpot: 30,
  creatorTreasury: 10,
  protocol: 20,
}

export const DEFAULT_PARAMS: CreatorVaultSimParams = {
  depositRate: 80_000,
  tradeActivity: 1.5,
  tradingFeeBps: 100,
  ccaThreshold: 30_000_000,
  wrapRatio: 0.55,
  payoutInflowRate: 2_500,
  legs: { ...DEFAULT_LEG_WEIGHTS },
  gauge: { ...DEFAULT_GAUGE_SPLIT },
  shareAllocation: { ...DEFAULT_SHARE_ALLOCATION },
}

export const CREATOR_TOKEN_SYMBOL = '$CREATOR'
export const SHARE_BOX_SYMBOL = '▢'
export const SHARE_OFT_SYMBOL = '■'
