export type BaseXmtpAgent = {
  id: string
  name: string
  handle?: string
  address?: `0x${string}`
  description: string
  category: 'trading' | 'creator' | 'prediction' | 'research' | 'sovereign' | 'launch'
}

export const BASE_XMTP_AGENTS: BaseXmtpAgent[] = [
  {
    id: 'jessexbt',
    name: 'jesseXBT',
    handle: 'jessexbt.base.eth',
    description: 'Base-native Jesse Pollak knowledge agent',
    category: 'creator',
  },
  {
    id: 'bankr',
    name: 'Bankr',
    handle: 'bankr.base.eth',
    description: 'Trade, transfer, portfolio, and market actions',
    category: 'trading',
  },
  {
    id: 'elsa',
    name: 'Elsa',
    handle: 'elsa.base.eth',
    description: 'DeFi data and x402-powered execution tools',
    category: 'trading',
  },
  {
    id: 'freysa',
    name: 'Freysa',
    handle: 'hifreysa.base.eth',
    description: 'Sovereign AI experiment on Base',
    category: 'sovereign',
  },
  {
    id: 'arma',
    name: 'Arma',
    handle: 'arma.base.eth',
    description: 'Base agent available over XMTP',
    category: 'research',
  },
  {
    id: 'neurobro',
    name: 'Neurobro',
    handle: 'oxneurobro.base.eth',
    description: 'AI agent for market context and trading strategy',
    category: 'research',
  },
  {
    id: 'flaunchy',
    name: 'Flaunchy',
    address: '0x557463b158f70e4e269bb7bccf6c587e3bc878f4',
    description: 'Launch and trade tokens through Flaunch',
    category: 'launch',
  },
  {
    id: 'bracky',
    name: 'Bracky',
    address: '0x62db4c5a8fdf004754b9efe92df39927ab68920d',
    description: 'Sports and prediction-market chat agent',
    category: 'prediction',
  },
]
