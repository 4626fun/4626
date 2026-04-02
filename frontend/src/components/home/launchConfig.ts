export const DEFAULT_DEPOSIT_TOKENS = '50,000,000'
export const DEFAULT_AUCTION_WINDOW = '7 days'
export const DEFAULT_AUCTION_EPOCH = 'Thursday 00:00 UTC'

export const SHARE_DISTRIBUTION_ROWS = [
  {
    title: 'Uniswap CCA launch',
    percent: '40%',
    numericPercent: 40,
    amount: '20,000,000',
    route: '/distribute/cca-launch',
    description: 'Allocated to the weekly Thursday 00:00 UTC launch window for market price discovery.',
    icon: '/protocols/uniswap.svg' as string | null,
  },
  {
    title: 'Creator vesting',
    percent: '40%',
    numericPercent: 40,
    amount: '20,000,000',
    route: '/distribute/creator-vesting',
    description: 'Assigned to the creator on a linear 365-day vest instead of immediate liquidity.',
    icon: null as string | null,
  },
  {
    title: 'LP reserve',
    percent: '20%',
    numericPercent: 20,
    amount: '10,000,000',
    route: '/distribute/lp-reserve',
    description: 'Reserved for post-auction liquidity migration and not routed to protocol treasury.',
    icon: null as string | null,
  },
] as const

export const STRATEGY_CARDS = [
  {
    label: 'Charm',
    percent: '30%',
    numericPercent: 30,
    amount: '15,000,000',
    apy: '8–12%',
    route: '/deploy/charm',
    description: 'Managed Uniswap V3 CREATOR/USDC LP',
    icon: '/protocols/charm.png' as string | null,
    iconAlt: 'Charm',
    iconClassName: 'h-3.5 w-3.5 rounded-sm opacity-90',
  },
  {
    label: 'Ajna',
    percent: '30%',
    numericPercent: 30,
    amount: '15,000,000',
    apy: '5–9%',
    route: '/deploy/ajna',
    description: 'Permissionless lending exposure',
    icon: '/protocols/ajna.svg' as string | null,
    iconAlt: 'Ajna',
    iconClassName: 'h-3.5 w-3.5 opacity-90',
  },
  {
    label: 'Solana',
    percent: '30%',
    numericPercent: 30,
    amount: '15,000,000',
    apy: '10–18%',
    route: '/deploy/solana',
    description: 'Cross-chain bridge route deployment',
    icon: '/protocols/solana.svg' as string | null,
    iconAlt: 'Solana',
    iconClassName: 'h-3.5 w-auto opacity-90',
  },
  {
    label: 'Idle Reserve',
    percent: '10%',
    numericPercent: 10,
    amount: '5,000,000',
    apy: '—',
    route: '/deploy/idle',
    description: 'Kept liquid for withdrawals and execution flexibility',
    icon: null as string | null,
    iconAlt: 'Idle Reserve',
    iconClassName: '',
  },
] as const

export const BLENDED_APY = '~8–12%'

export const SHARE_SPLIT_LABEL = SHARE_DISTRIBUTION_ROWS.map((row) => row.percent.replace('%', '')).join(' / ')
