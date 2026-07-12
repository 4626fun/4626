import { formatEther, formatUnits, type Address } from 'viem'

import { getProductionBaseReadClient } from '@/lib/base/productionBaseReadClient'
import { resolveVaultByAnyAddress, type VaultResolved } from '@/lib/onchain/vaultResolve'
import { readVaultSharePriceSnapshot } from '@/lib/onchain/vaultSharePrice'
import type { FeatureListResponse } from '@/pages/CreatorStrategyFeatures.types'

import type {
  CreatorEconomyAuctionState,
  CreatorEconomyBundleStatus,
  CreatorEconomyStrategyLeg,
} from './types'

const VAULT_TOTAL_ASSETS_ABI = [
  {
    type: 'function',
    name: 'totalAssets',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const

export type AuctionStatusApiData = {
  isActive?: boolean
  isGraduated?: boolean
  lifecycleCurrencySwept?: boolean
  lifecycleMigrated?: boolean
  lifecycleFailedFinalized?: boolean
  lifecycleAuctionWindowOpen?: boolean
  lifecyclePhase?: number
  currencyRaised?: string | null
}

export type CreatorEconomyOnchainSnapshot = {
  resolved: VaultResolved | null
  auction: AuctionStatusApiData | null
  deployPlan: FeatureListResponse['deployPlan'] | null
  activations: FeatureListResponse['activations']
  tvlUsd: string | null
  sharePpsUsd: string | null
  shareOftBalance: string | null
  vaultShareBalance: string | null
  auctionState: CreatorEconomyAuctionState
  settlementComplete: boolean
  bundleStatus: CreatorEconomyBundleStatus
  isLegacyStack: boolean
  verifiedStrategies: CreatorEconomyStrategyLeg[]
  activationComplete: boolean
  strategyPlanLabel: string | null
}

function formatUsdFrom1e18(raw: bigint | null | undefined): string | null {
  if (raw == null) return null
  const value = Number(formatUnits(raw, 18))
  if (!Number.isFinite(value) || value <= 0) return null
  if (value >= 1000) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
}

function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function formatTokenBalance(raw: bigint, decimals: number): string {
  const value = Number(formatUnits(raw, decimals))
  if (!Number.isFinite(value)) return '0'
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function deriveAuctionState(auction: AuctionStatusApiData | null): CreatorEconomyAuctionState {
  if (!auction) return 'none'
  if (auction.lifecycleFailedFinalized) return 'failed'
  if (auction.isGraduated) return 'graduated'
  if (auction.isActive || auction.lifecycleAuctionWindowOpen) return 'live'
  // LifecyclePhase.AuctionScheduled === 7 in auction status handler
  if (auction.lifecyclePhase === 7) return 'scheduled'
  return 'none'
}

export function deriveSettlementComplete(auction: AuctionStatusApiData | null): boolean {
  if (!auction) return false
  return Boolean(auction.lifecycleCurrencySwept && auction.lifecycleMigrated)
}

function bpsToPercentLabel(bps: string | null | undefined): string | null {
  if (!bps) return null
  const n = Number(bps)
  if (!Number.isFinite(n)) return null
  return `${(n / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
}

export function deriveStrategyPlanLabel(
  plan: FeatureListResponse['deployPlan'] | null,
): string | null {
  if (!plan) return null
  const charm = bpsToPercentLabel(plan.charmWeightBps)
  const ajna = bpsToPercentLabel(plan.ajnaWeightBps)
  const idle = bpsToPercentLabel(plan.idleReserveBps)
  if (!charm || !ajna || !idle) return null
  return `${charm} Charm · ${ajna} Ajna · ${idle} idle`
}

export function deriveVerifiedStrategies(
  plan: FeatureListResponse['deployPlan'] | null,
  isLegacyStack: boolean,
): CreatorEconomyStrategyLeg[] {
  const legs: CreatorEconomyStrategyLeg[] = []
  if (!plan) {
    // Legacy vaults without feature rows still commonly run Charm + Ajna + Solana mesh.
    if (isLegacyStack) return ['Charm', 'Ajna', 'Solana']
    return legs
  }
  if (plan.reasons.charm === 'paid' || Number(plan.charmWeightBps) > 0) legs.push('Charm')
  if (plan.reasons.ajna === 'paid' || Number(plan.ajnaWeightBps) > 0) legs.push('Ajna')
  if (plan.reasons.solana === 'paid' || plan.activeFeatureKeys.includes('solana_ovault_mesh')) {
    legs.push('Solana')
  }
  if (legs.length === 0 && isLegacyStack) return ['Charm', 'Ajna', 'Solana']
  return legs
}

/**
 * Bundle paywall is only required for greenfield creators with no vault yet
 * and no unlocked deploy plan. Legacy / already-deployed economies never need it.
 */
export function deriveBundleStatus(params: {
  hasVault: boolean
  isLegacyStack: boolean
  deployPlan: FeatureListResponse['deployPlan'] | null
}): CreatorEconomyBundleStatus {
  if (params.hasVault || params.isLegacyStack) return 'not_required'
  if (!params.deployPlan) return 'required'
  if (params.deployPlan.deployable) return 'unlocked'
  if (params.deployPlan.activeFeatureKeys.includes('vault_full_deploy')) return 'unlocked'
  return 'required'
}

export async function fetchCreatorStrategyList(
  creatorToken: Address,
): Promise<FeatureListResponse | null> {
  try {
    const res = await fetch(`/api/creator/strategy/list?creator=${creatorToken}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const raw = (await res.json()) as { success?: boolean; data?: FeatureListResponse }
    return raw.data ?? null
  } catch {
    return null
  }
}

export async function fetchAuctionStatus(
  ccaLaunchArm: Address,
): Promise<AuctionStatusApiData | null> {
  try {
    const res = await fetch(`/api/v1/auction/status?ccaLaunchArm=${ccaLaunchArm}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const raw = (await res.json()) as { success?: boolean; data?: AuctionStatusApiData }
    return raw.data ?? null
  } catch {
    return null
  }
}

async function readTokenBalance(
  token: Address,
  holder: Address,
): Promise<string | null> {
  const client = getProductionBaseReadClient()
  try {
    const [raw, decimals] = await Promise.all([
      client.readContract({
        address: token,
        abi: ERC20_BALANCE_ABI,
        functionName: 'balanceOf',
        args: [holder],
      }),
      client.readContract({
        address: token,
        abi: ERC20_BALANCE_ABI,
        functionName: 'decimals',
      }),
    ])
    return formatTokenBalance(raw, decimals)
  } catch {
    return null
  }
}

/**
 * Wagmi-free onchain + API snapshot for creator-economy trays.
 * Safe to call from waitlist (marketing host) and the app tray.
 */
export async function fetchCreatorEconomyOnchainSnapshot(params: {
  creatorCoinAddress: Address
  holderAddress?: Address | null
  assetPriceUsd?: number | null
}): Promise<CreatorEconomyOnchainSnapshot> {
  const client = getProductionBaseReadClient()
  let resolved: VaultResolved | null = null
  try {
    resolved = await resolveVaultByAnyAddress(client, params.creatorCoinAddress)
  } catch {
    resolved = null
  }

  const hasVault = Boolean(resolved?.info.vault)

  const [featureList, auction] = await Promise.all([
    fetchCreatorStrategyList(params.creatorCoinAddress),
    resolved?.ccaLaunchArm
      ? fetchAuctionStatus(resolved.ccaLaunchArm)
      : Promise.resolve(null),
  ])

  const deployPlan = featureList?.deployPlan ?? null
  const activations = featureList?.activations ?? []
  const hasActiveFeatureRows = activations.some((row) => row.status === 'active')
  const hasGrantedFeatureKeys = (deployPlan?.activeFeatureKeys?.length ?? 0) > 0
  // Grandfathered / pre-bundle vaults: onchain vault without paid feature-activation rows.
  const legacy = Boolean(hasVault && !hasActiveFeatureRows && !hasGrantedFeatureKeys)

  const auctionState = deriveAuctionState(auction)
  const settlementComplete = deriveSettlementComplete(auction)
  const bundleStatus = deriveBundleStatus({
    hasVault,
    isLegacyStack: legacy,
    deployPlan,
  })
  const verifiedStrategies = deriveVerifiedStrategies(deployPlan, legacy)
  const strategyPlanLabel = deriveStrategyPlanLabel(deployPlan)

  const activationComplete =
    auctionState === 'scheduled' ||
    auctionState === 'live' ||
    auctionState === 'graduated' ||
    auctionState === 'failed' ||
    settlementComplete

  let tvlUsd: string | null = null
  let sharePpsUsd: string | null = null
  let shareOftBalance: string | null = null
  let vaultShareBalance: string | null = null

  const vaultAddress = resolved?.info.vault ?? null
  const oracle = resolved?.info.oracle ?? null
  const shareOft = resolved?.info.shareOFT ?? null

  if (vaultAddress) {
    try {
      const [totalAssets, pps] = await Promise.all([
        client.readContract({
          address: vaultAddress,
          abi: VAULT_TOTAL_ASSETS_ABI,
          functionName: 'totalAssets',
        }),
        readVaultSharePriceSnapshot(client, { vault: vaultAddress, oracle }),
      ])
      sharePpsUsd = formatUsdFrom1e18(pps.ppsUsd)
      if (params.assetPriceUsd != null && Number.isFinite(params.assetPriceUsd)) {
        // Creator coins are typically 18 decimals on Zora/Base.
        const assets = Number(formatUnits(totalAssets, 18))
        if (Number.isFinite(assets) && assets > 0) {
          tvlUsd = formatCompactUsd(assets * params.assetPriceUsd)
        }
      }
    } catch {
      // Metrics stay null when reads fail.
    }
  }

  if (params.holderAddress) {
    const holder = params.holderAddress
    const balanceReads: Promise<void>[] = []
    if (shareOft) {
      balanceReads.push(
        readTokenBalance(shareOft, holder).then((value) => {
          shareOftBalance = value
        }),
      )
    }
    if (vaultAddress) {
      balanceReads.push(
        readTokenBalance(vaultAddress, holder).then((value) => {
          vaultShareBalance = value
        }),
      )
    }
    await Promise.all(balanceReads)
  }

  return {
    resolved,
    auction,
    deployPlan,
    activations,
    tvlUsd,
    sharePpsUsd,
    shareOftBalance,
    vaultShareBalance,
    auctionState,
    settlementComplete,
    bundleStatus,
    isLegacyStack: legacy,
    verifiedStrategies,
    activationComplete,
    strategyPlanLabel,
  }
}

export function formatClaimableEth(wei: bigint | null | undefined): string | null {
  if (wei == null || wei <= 0n) return null
  const value = Number(formatEther(wei))
  if (!Number.isFinite(value) || value <= 0) return null
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH`
}
