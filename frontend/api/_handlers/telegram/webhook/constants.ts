import type { DeployCurrencyInput } from './types.js'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

export const TELEGRAM_NATIVE_COMMANDS = new Set([
  'link',
  'linked',
  'unlink',
  'zora',
  'deploy',
  'join',
  'rooms',
  'eligibility',
  'portfolio',
  'vaults',
  'list',
  'auctions',
  'mybids',
  'signals',
  'buy',
  'sell',
  'bid',
  'tip',
])

export const TELEGRAM_COMMAND_HEADS = [
  'help',
  'keepr',
  'link',
  'linked',
  'unlink',
  'zora',
  'deploy',
  'join',
  'rooms',
  'eligibility',
  'portfolio',
  'vaults',
  'list',
  'auctions',
  'mybids',
  'signals',
  'buy',
  'sell',
  'bid',
  'tip',
  'inline',
  'shortcuts',
  'x',
  'tweet',
  'ai',
  'mkt',
  'coin',
] as const

export const TELEGRAM_COMMAND_HEADS_PATTERN = TELEGRAM_COMMAND_HEADS.join('|')

export const TELEGRAM_COMMAND_MICRO_HINTS: Array<{ pattern: RegExp; hint: string }> = [
  {
    pattern: /\/coin\s+create\s+<name>\s+<symbol>\s+<(?:uri|url)>/i,
    hint: 'name: 1-24 chars, symbol: 2-6 chars, url: https://...',
  },
  {
    pattern: /\/mkt\s+quote\s+<symbol>/i,
    hint: 'symbol: ticker, e.g. BTC',
  },
  {
    pattern: /\/buy\b/i,
    hint: 'interactive: pick vault, choose size, then Accept',
  },
  {
    pattern: /\/sell\b/i,
    hint: 'interactive: pick vault, choose size, then Accept',
  },
  {
    pattern: /\/bid\b/i,
    hint: 'interactive: pick vault, choose ETH %, then Accept',
  },
  {
    pattern: /\/join\s+<vault\|ticker>/i,
    hint: 'vault|ticker: scoped vault address or symbol',
  },
  {
    pattern: /\/eligibility\s+<vault\|ticker>/i,
    hint: 'checks holder-room threshold for a scoped vault',
  },
]

export type TelegramBotMenuCommand = {
  command: string
  description: string
}

export const TELEGRAM_PRIVATE_BOT_COMMANDS: TelegramBotMenuCommand[] = [
  { command: 'help', description: 'Start here: menu and examples' },
  { command: 'link', description: 'Connect Telegram to your wallet' },
  { command: 'linked', description: 'Check wallet link status' },
  { command: 'buy', description: 'Buy in guided flow' },
  { command: 'sell', description: 'Sell in guided flow' },
  { command: 'bid', description: 'Bid in guided flow' },
  { command: 'portfolio', description: 'View your positions and activity' },
  { command: 'vaults', description: 'Browse active vaults' },
  { command: 'auctions', description: 'View live auctions' },
  { command: 'signals', description: 'See recent buy and sell signals' },
  { command: 'deploy', description: 'Create your own vault' },
]

export const TELEGRAM_GROUP_BOT_COMMANDS: TelegramBotMenuCommand[] = [
  { command: 'help', description: 'Start here: command menu' },
  { command: 'link', description: 'Connect your wallet to trade' },
  { command: 'buy', description: 'Buy in guided flow' },
  { command: 'sell', description: 'Sell in guided flow' },
  { command: 'bid', description: 'Bid in guided flow' },
  { command: 'vaults', description: 'Browse vaults in this chat' },
  { command: 'auctions', description: 'View active auctions in this chat' },
  { command: 'signals', description: 'See recent trade signals' },
]

export const TELEGRAM_ADMIN_BOT_COMMANDS: TelegramBotMenuCommand[] = [
  { command: 'help', description: 'Start here: admin command menu' },
  { command: 'deploy', description: 'Create a vault from Telegram' },
  { command: 'inline', description: 'Open one-tap command templates' },
  { command: 'vaults', description: 'Browse vaults in this chat' },
  { command: 'auctions', description: 'View active auctions in this chat' },
  { command: 'signals', description: 'See recent trade signals' },
  { command: 'x', description: 'Draft and post to X (confirm required)' },
  { command: 'tweet', description: 'Alias for /x post' },
  { command: 'portfolio', description: 'View linked account activity' },
]

export const DEPLOY_CURRENCY_VALUES: DeployCurrencyInput[] = ['ETH', 'ZORA', 'CREATOR_COIN', 'CONTENT_COIN']

export const SUPPORTED_METADATA_URI_PREFIXES = ['https://', 'http://', 'ipfs://', 'ar://', 'data:'] as const

export const CCA_LAUNCH_STRATEGY_ABI = [
  {
    name: 'getAuctionStatus',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'auction', type: 'address' },
      { name: 'isActive', type: 'bool' },
      { name: 'isGraduated', type: 'bool' },
      { name: 'clearingPrice', type: 'uint256' },
      { name: 'currencyRaised', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'auctionToken',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
] as const

export const ERC20_VIEW_ABI = [
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    name: 'symbol',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
] as const

export const CCA_AUCTION_ABI = [
  {
    name: 'submitBid',
    type: 'function',
    inputs: [
      { name: 'maxPrice', type: 'uint256' },
      { name: 'amount', type: 'uint128' },
      { name: 'owner', type: 'address' },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [{ name: 'bidId', type: 'uint256' }],
    stateMutability: 'payable',
  },
] as const

export const UINT128_MAX = (1n << 128n) - 1n
export const Q96 = 2n ** 96n

export const TRADE_ACTION_PRESET_BPS = [2500, 5000, 7500, 9900] as const
