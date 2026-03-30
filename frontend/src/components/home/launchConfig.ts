export const DEFAULT_DEPOSIT_TOKENS = '50,000,000'
export const DEFAULT_AUCTION_WINDOW = '7 days'
export const DEFAULT_AUCTION_EPOCH = 'Thursday 00:00 UTC'

export const SHARE_DISTRIBUTION_ROWS = [
  {
    title: 'Uniswap CCA launch',
    percent: '40%',
    description: 'Allocated to the weekly Thursday 00:00 UTC launch window for market price discovery.',
  },
  {
    title: 'Creator vesting',
    percent: '40%',
    description: 'Assigned to the creator on a linear 365-day vest instead of immediate liquidity.',
  },
  {
    title: 'LP reserve',
    percent: '20%',
    description: 'Reserved for post-auction liquidity migration and not routed to protocol treasury.',
  },
] as const

export const SHARE_SPLIT_LABEL = SHARE_DISTRIBUTION_ROWS.map((row) => row.percent.replace('%', '')).join(' / ')
