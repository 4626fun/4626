// model/storyContent.ts
// Single source of truth for all narrative copy, data, icons, tokens.
// No renderer may import launchConfig.ts or define its own copy.
// All renderers receive this via StoryRendererProps.content.

export type DistributionDestination = {
  title: string
  percent: string
  numericPercent: number
  amount: string
  route: string
  purposeCopy: string // audience-first benefit framing (not mechanic-first)
  icon: string | null
}

export type StrategyCard = {
  label: string
  percent: string
  numericPercent: number
  amount: string
  apy: string
  route: string
  purposeCopy: string // audience-first benefit framing
  icon: string | null
  iconAlt: string
  iconClassName: string
}

export type EarningTogetherCopy = {
  title: string
  subtitle: string
  summary: string
}

export type StoryContent = {
  creatorName: string
  creatorTokenSymbol: string
  shareTokenSymbol: string
  shareTokenBadgeSrc: string
  defaultDepositTokens: string
  defaultAuctionWindow: string
  defaultAuctionEpoch: string
  distribution: readonly DistributionDestination[]
  strategies: readonly StrategyCard[]
  blendedApy: string
  copy?: {
    earningTogether?: EarningTogetherCopy
  }
}

export const STORY_CONTENT: StoryContent = {
  creatorName: 'akita.base.eth',
  creatorTokenSymbol: '$AKITA',
  shareTokenSymbol: '■AKITA',
  shareTokenBadgeSrc: '/akita-share-token-badge.webp',
  defaultDepositTokens: '50,000,000',
  defaultAuctionWindow: '7 days',
  defaultAuctionEpoch: 'Thursday 00:00 UTC',

  distribution: [
    {
      title: 'CCA Launch',
      percent: '40%',
      numericPercent: 40,
      amount: '20,000,000',
      route: '/cca',
      purposeCopy: 'Price discovery that benefits early supporters.',
      icon: '/protocols/uniswap.svg',
    },
    {
      title: 'Creator vesting',
      percent: '40%',
      numericPercent: 40,
      amount: '20,000,000',
      route: '/distribute/creator-vesting',
      purposeCopy: 'The creator earns alongside participants — on a one-year schedule.',
      icon: '/akita-share-token-badge.webp',
    },
    {
      title: 'LP reserve',
      percent: '20%',
      numericPercent: 20,
      amount: '10,000,000',
      route: '/distribute/lp-reserve',
      purposeCopy: 'Liquidity for anyone who wants to exit.',
      icon: '/protocols/uniswap.svg',
    },
  ] as const,

  strategies: [
    {
      label: 'Charm',
      percent: '30%',
      numericPercent: 30,
      amount: '15,000,000',
      apy: '1–99%',
      route: '/deploy/charm',
      purposeCopy: 'Active Uniswap V3 LP — managed for range efficiency.',
      icon: '/protocols/charm.png',
      iconAlt: 'Charm',
      iconClassName: 'h-3.5 w-3.5 rounded-sm opacity-90',
    },
    {
      label: 'Ajna',
      percent: '30%',
      numericPercent: 30,
      amount: '15,000,000',
      apy: '1–99%',
      route: '/deploy/ajna',
      purposeCopy: 'Permissionless lending. Yield without counterparty risk.',
      icon: '/protocols/ajna.svg',
      iconAlt: 'Ajna',
      iconClassName: 'h-3.5 w-3.5 opacity-90',
    },
    {
      label: 'Solana',
      percent: '30%',
      numericPercent: 30,
      amount: '15,000,000',
      apy: '1–99%',
      route: '/deploy/solana',
      purposeCopy: 'Cross-chain yield — same principal, different market.',
      icon: '/protocols/solana.svg',
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
      purposeCopy: 'Always available for withdrawals. The liquidity floor.',
      icon: null,
      iconAlt: 'Idle Reserve',
      iconClassName: '',
    },
  ] as const,

  blendedApy: '1–99%+',

  copy: {
    earningTogether: {
      title: 'The vault runs.',
      subtitle: 'entry point, not ending',
      summary: 'Creator earns. Participants earn. Value keeps flowing.',
    },
  },
}
