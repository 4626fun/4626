import { TELEGRAM_LINK_DESCRIPTION } from '@/lib/seo/siteMeta'

export const PAGE_META = {
  home: {
    title: '4626.fun - ERC-4626 Creator Vaults on Base',
    description: 'ERC-4626 creator vaults on Base.',
  },
  waitlist: {
    title: 'Join the Waitlist — 4626.fun',
    description: 'Get early access to ERC-4626 creator vaults on Base.',
  },
  explore: {
    title: 'Explore Creators',
    description: 'Discover creator-vault previews and creator activity on Base.',
  },
  deploy: {
    title: 'Deploy Vault',
    description: 'Launch an ERC-4626 creator coin vault on Base.',
  },
  swap: {
    title: 'Swap',
    description: 'Swap tokens on Base using 4626 — best-price routing via Uniswap.',
  },
  gaugeVoting: {
    title: 'Gauge Voting',
    description: 'Vote on 4626 gauge allocations to direct protocol rewards.',
  },
  leaderboard: {
    title: 'Leaderboard',
    description: 'See the top creators and contributors on 4626 ranked by total points.',
  },
  auctionBid: {
    title: 'Auction Bid',
    description: 'Participate in the vault auction on 4626.',
  },
  agents: {
    title: 'Creator Agents',
    description: 'Browse and message creator XMTP agents.',
  },
  agentRegister: {
    title: 'Register Agent',
    description: 'Register and activate your 4626 agent stack (ERC-8004, XMTP, SIWA, Lens/Grove).',
  },
  faq: {
    title: 'FAQ',
    description: 'Frequently asked questions about 4626 — vaults, creator coins, fees, and getting started.',
  },
  telegramLink: {
    title: 'Telegram Link',
    description: TELEGRAM_LINK_DESCRIPTION,
  },
  vault: (symbol: string) => ({
    title: `${symbol} Vault`,
    description: `Deposit and manage ${symbol} in 4626.`,
  }),
  creator: (name: string) => ({
    title: name,
    description: `${name}'s creator vault and earnings on 4626.`,
  }),
} as const
