export type BaseXmtpAgentBadgeTone = 'base' | 'zora'

export type BaseXmtpAgent = {
  id: string
  name: string
  handle?: string
  address?: `0x${string}`
  logoText: string
  logoTone: 'blue' | 'green' | 'violet' | 'gold' | 'cyan' | 'pink' | 'orange' | 'slate'
  description: string
  category: 'trading' | 'creator' | 'prediction' | 'research' | 'sovereign' | 'launch'
  badgeLabel?: string
  badgeTone?: BaseXmtpAgentBadgeTone
}

export const ZORA_XMTP_AGENT_ADDRESS =
  '0x363ba1a1ac1903ffbce5383d1b1865f64946eea8' as const satisfies `0x${string}`

export const BASE_XMTP_AGENTS: BaseXmtpAgent[] = [
  {
    id: 'zora',
    name: 'Zora',
    address: ZORA_XMTP_AGENT_ADDRESS,
    logoText: 'Z',
    logoTone: 'pink',
    description: 'Creator coins, trading, and Zora agent actions',
    category: 'creator',
    badgeLabel: 'Zora',
    badgeTone: 'zora',
  },
  {
    id: 'jessexbt',
    name: 'jesseXBT',
    handle: 'jessexbt.base.eth',
    logoText: 'JX',
    logoTone: 'blue',
    description: 'Base-native Jesse Pollak knowledge agent',
    category: 'creator',
  },
  {
    id: 'bankr',
    name: 'Bankr',
    handle: 'bankr.base.eth',
    logoText: 'B',
    logoTone: 'green',
    description: 'Trade, transfer, portfolio, and market actions',
    category: 'trading',
  },
  {
    id: 'elsa',
    name: 'Elsa',
    handle: 'elsa.base.eth',
    logoText: 'E',
    logoTone: 'cyan',
    description: 'DeFi data and x402-powered execution tools',
    category: 'trading',
  },
  {
    id: 'freysa',
    name: 'Freysa',
    handle: 'hifreysa.base.eth',
    logoText: 'F',
    logoTone: 'violet',
    description: 'Sovereign AI experiment on Base',
    category: 'sovereign',
  },
  {
    id: 'arma',
    name: 'Arma',
    handle: 'arma.base.eth',
    logoText: 'A',
    logoTone: 'gold',
    description: 'Base agent available over XMTP',
    category: 'research',
  },
  {
    id: 'neurobro',
    name: 'Neurobro',
    handle: 'oxneurobro.base.eth',
    logoText: 'N',
    logoTone: 'pink',
    description: 'AI agent for market context and trading strategy',
    category: 'research',
  },
  {
    id: 'flaunchy',
    name: 'Flaunchy',
    address: '0x557463b158f70e4e269bb7bccf6c587e3bc878f4',
    logoText: 'FL',
    logoTone: 'orange',
    description: 'Launch and trade tokens through Flaunch',
    category: 'launch',
  },
  {
    id: 'bracky',
    name: 'Bracky',
    address: '0x62db4c5a8fdf004754b9efe92df39927ab68920d',
    logoText: 'BR',
    logoTone: 'slate',
    description: 'Sports and prediction-market chat agent',
    category: 'prediction',
  },
]
