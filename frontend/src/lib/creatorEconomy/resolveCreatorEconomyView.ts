import type {
  CreatorEconomyCapabilities,
  CreatorEconomyLink,
  CreatorEconomyRole,
  CreatorEconomySigningStatus,
  CreatorEconomyView,
} from './types'

const LAUNCH_ALLOCATION_LABEL = '30% auction · 30% vesting · 30% Solana · 10% LP'

const DEFAULT_STRATEGY_PLAN_LABEL = '45% Charm · 45% Ajna · 10% idle'

function signingLabel(status: CreatorEconomySigningStatus): string {
  switch (status) {
    case 'ready':
      return 'Ready'
    case 'setup':
      return 'Setup in progress'
    case 'unavailable':
      return 'Signing unavailable'
    case 'external':
      return 'External signer connected'
    case 'action_required':
      return 'Action required'
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function symbolDisplay(symbol: string | null): string {
  if (!symbol) return 'Creator'
  const trimmed = symbol.trim()
  if (!trimmed) return 'Creator'
  return trimmed.startsWith('$') ? trimmed : `$${trimmed}`
}

function vaultHref(caps: CreatorEconomyCapabilities): string | null {
  if (caps.vaultAddress) return `/vault/${caps.vaultAddress}`
  if (caps.creatorCoinAddress) return `/vault/${caps.creatorCoinAddress}`
  return null
}

function auctionHref(caps: CreatorEconomyCapabilities): string | null {
  if (caps.ccaLaunchArm) return `/auction/bid/${caps.ccaLaunchArm}`
  return vaultHref(caps)
}

function isTradingLive(caps: CreatorEconomyCapabilities): boolean {
  return (
    caps.auctionState === 'graduated' &&
    caps.settlementComplete &&
    caps.hookAligned !== false
  )
}

function resolveRole(caps: CreatorEconomyCapabilities): CreatorEconomyRole {
  if (caps.ownsCreatorEconomy && caps.hasCreatorCoin && !caps.hasVault) {
    return 'prelaunch_creator'
  }
  if (caps.ownsCreatorEconomy && caps.hasCreatorCoin) {
    return 'creator'
  }
  if (!caps.ownsCreatorEconomy && caps.hasShareHoldings) {
    return 'holder'
  }
  if (caps.hasCreatorCoin && !caps.ownsCreatorEconomy && caps.hasVault) {
    // Viewing someone else's economy via holdings path already covered;
    // coin without ownership and without holdings → none
    return caps.hasShareHoldings ? 'holder' : 'none'
  }
  return 'none'
}

function legacyBadge(caps: CreatorEconomyCapabilities): string | null {
  if (!caps.isLegacyStack || caps.verifiedStrategies.length === 0) return null
  return caps.verifiedStrategies.join(' · ')
}

function infrastructureLabel(caps: CreatorEconomyCapabilities): string {
  const hasSolana = caps.verifiedStrategies.includes('Solana')
  return hasSolana ? 'Base primary · Solana share bridge' : 'Base primary'
}

type LifecycleResolution = {
  statusLabel: string
  headline: string
  statusDetail: string | null
  primaryAction: CreatorEconomyLink | null
  secondaryLink: CreatorEconomyLink | null
  showPaywall: boolean
}

function resolveLifecycle(caps: CreatorEconomyCapabilities): LifecycleResolution {
  const vault = vaultHref(caps)
  const auction = auctionHref(caps)
  const secondaryVault: CreatorEconomyLink | null = vault
    ? { label: 'View vault', href: vault }
    : null

  if (caps.accountSigningStatus === 'action_required') {
    return {
      statusLabel: 'Account action required',
      headline: 'Account action required',
      statusDetail: 'Finish signing setup before vault actions.',
      primaryAction: { label: 'Fix account setup', href: '/accounts' },
      secondaryLink: secondaryVault,
      showPaywall: false,
    }
  }

  if (!caps.hasCreatorCoin) {
    return {
      statusLabel: 'No creator economy yet',
      headline: 'No creator economy yet',
      statusDetail: null,
      primaryAction: { label: 'Launch or link coin', href: '/deploy/coin' },
      secondaryLink: null,
      showPaywall: false,
    }
  }

  if (!caps.hasVault) {
    if (caps.bundleStatus === 'required') {
      return {
        statusLabel: 'Launch bundle required',
        headline: `${symbolDisplay(caps.symbol)} is ready`,
        statusDetail: 'Unlock the launch bundle to deploy your vault economy.',
        primaryAction: { label: 'Unlock deployment', href: '/creator/strategy/features' },
        secondaryLink: { label: 'Review vault launch', href: '/deploy/vault' },
        showPaywall: true,
      }
    }
    return {
      statusLabel: 'Creator coin ready for a vault',
      headline: `${symbolDisplay(caps.symbol)} is ready`,
      statusDetail: 'No 4626 vault deployed yet.',
      primaryAction: { label: 'Continue launch', href: '/deploy/vault' },
      secondaryLink: null,
      showPaywall: false,
    }
  }

  // Vault exists
  if (!caps.activationComplete && caps.auctionState === 'none') {
    return {
      statusLabel: 'Vault deployed · activation required',
      headline: `${symbolDisplay(caps.symbol)} economy`,
      statusDetail: 'Contracts are onchain. Activate to fund the vault and schedule the auction.',
      primaryAction: { label: 'Activate vault', href: '/deploy/vault' },
      secondaryLink: secondaryVault,
      showPaywall: false,
    }
  }

  if (caps.auctionState === 'scheduled') {
    return {
      statusLabel: 'Auction scheduled',
      headline: `${symbolDisplay(caps.symbol)} economy`,
      statusDetail: 'Fair-launch auction is scheduled on Base.',
      primaryAction: {
        label: 'View launch',
        href: auction ?? vault ?? '/deploy/vault',
      },
      secondaryLink: secondaryVault,
      showPaywall: false,
    }
  }

  if (caps.auctionState === 'live') {
    return {
      statusLabel: 'Fair-launch auction live',
      headline: `${symbolDisplay(caps.symbol)} economy`,
      statusDetail: null,
      primaryAction: {
        label: 'Join or monitor auction',
        href: auction ?? vault ?? '/deploy/vault',
      },
      secondaryLink: secondaryVault,
      showPaywall: false,
    }
  }

  if (
    (caps.auctionState === 'graduated' || caps.auctionState === 'failed') &&
    !caps.settlementComplete
  ) {
    return {
      statusLabel: 'Settlement in progress',
      headline: `${symbolDisplay(caps.symbol)} economy`,
      statusDetail:
        caps.auctionState === 'failed'
          ? 'Auction ended without graduation. Settlement or relaunch may be required.'
          : 'Auction finished. Sweep and migration are still completing.',
      primaryAction: {
        label: 'View status',
        href: vault ? `/status?vault=${caps.vaultAddress}` : '/deploy/vault',
      },
      secondaryLink: secondaryVault,
      showPaywall: false,
    }
  }

  if (isTradingLive(caps)) {
    return {
      statusLabel: 'Trading live',
      headline: `${symbolDisplay(caps.symbol)} economy`,
      statusDetail: null,
      primaryAction: secondaryVault ?? { label: 'View vault', href: '/deploy/vault' },
      secondaryLink: caps.ownsCreatorEconomy
        ? { label: 'Earnings', href: '/creator/earnings' }
        : {
            label: 'Deposit / withdraw',
            href: vault ?? '/deploy/vault',
          },
      showPaywall: false,
    }
  }

  // Fallback: vault present, activated-ish, but not fully live
  return {
    statusLabel: caps.activationComplete ? 'Activated' : 'Vault deployed',
    headline: `${symbolDisplay(caps.symbol)} economy`,
    statusDetail: 'Waiting for the next launch milestone.',
    primaryAction: secondaryVault ?? { label: 'View vault', href: '/deploy/vault' },
    secondaryLink: null,
    showPaywall: false,
  }
}

/**
 * Pure capability → tray view model.
 * Lifecycle copy and the single primary CTA are derived here so UI stays thin.
 */
export function resolveCreatorEconomyView(
  caps: CreatorEconomyCapabilities,
): CreatorEconomyView {
  const role = resolveRole(caps)
  const lifecycle = resolveLifecycle(caps)
  const vault = vaultHref(caps)
  const tradingLive = isTradingLive(caps)
  const showThreeTokenRail = caps.hasCreatorCoin
  const railActive = caps.hasVault && (caps.activationComplete || tradingLive || caps.auctionState !== 'none')

  const holder =
    role === 'holder'
      ? {
          shareOftBalance: caps.shareOftBalance,
          vaultShareBalance: caps.vaultShareBalance,
        }
      : null

  // Holder-specific headline when not the economy owner
  let headline = lifecycle.headline
  let statusDetail = lifecycle.statusDetail
  if (role === 'holder') {
    headline = `Your ${symbolDisplay(caps.symbol)} position`
    statusDetail = lifecycle.statusLabel
  } else if (role === 'prelaunch_creator') {
    headline = `${symbolDisplay(caps.symbol)} is ready`
  }

  const preferEconomyTab =
    caps.ownsCreatorEconomy || caps.hasShareHoldings || (caps.hasCreatorCoin && caps.hasVault)

  return {
    role,
    headline,
    statusLabel: lifecycle.statusLabel,
    statusDetail,
    networkLabel: 'Base',
    legacyBadge: legacyBadge(caps),
    showThreeTokenRail,
    railActive,
    primaryAction: lifecycle.primaryAction,
    secondaryLink: lifecycle.secondaryLink,
    showPaywall: lifecycle.showPaywall && caps.bundleStatus === 'required',
    metrics: {
      tvlUsd: caps.tvlUsd,
      sharePpsUsd: caps.sharePpsUsd,
      claimableCreatorEarningsEth: caps.claimableCreatorEarningsEth,
    },
    holder,
    launchAllocationLabel: LAUNCH_ALLOCATION_LABEL,
    strategyPlanLabel: caps.strategyPlanLabel ?? (caps.hasVault ? DEFAULT_STRATEGY_PLAN_LABEL : null),
    infrastructureLabel: infrastructureLabel(caps),
    accountSigningLabel: signingLabel(caps.accountSigningStatus),
    connectionsSummary: `${caps.connectionsLinked} of ${caps.connectionsTotal}`,
    nextConnectionBonus: caps.nextConnectionBonus,
    symbolDisplay: symbolDisplay(caps.symbol),
    logoUrl: caps.logoUrl,
    handleOrBasename: caps.handleOrBasename,
    vaultHref: vault,
    preferEconomyTab,
  }
}

/** Fixture helper — build a complete capabilities object with sensible defaults. */
export function createCreatorEconomyCapabilitiesFixture(
  overrides: Partial<CreatorEconomyCapabilities> = {},
): CreatorEconomyCapabilities {
  return {
    hasCreatorCoin: false,
    hasVault: false,
    symbol: null,
    logoUrl: null,
    handleOrBasename: null,
    creatorCoinAddress: null,
    vaultAddress: null,
    shareOftAddress: null,
    ccaLaunchArm: null,
    bundleStatus: 'not_required',
    activationComplete: false,
    auctionState: 'none',
    settlementComplete: false,
    hookAligned: null,
    isLegacyStack: false,
    verifiedStrategies: [],
    tvlUsd: null,
    sharePpsUsd: null,
    claimableCreatorEarningsEth: null,
    accountSigningStatus: 'ready',
    connectionsLinked: 0,
    connectionsTotal: 7,
    nextConnectionBonus: null,
    shareOftBalance: null,
    vaultShareBalance: null,
    ownsCreatorEconomy: false,
    strategyPlanLabel: null,
    hasShareHoldings: false,
    ...overrides,
  }
}
