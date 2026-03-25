import {
  TELEGRAM_COMMAND_HEADS as SHARED_TELEGRAM_COMMAND_HEADS,
  TELEGRAM_COMMAND_HEADS_PATTERN as SHARED_TELEGRAM_COMMAND_HEADS_PATTERN,
  TELEGRAM_NATIVE_COMMAND_HEADS,
  buildTelegramBotCommands,
  type TelegramBotMenuCommand,
} from '../../../../server/commands/registry.js'

import type { DeployCurrencyInput } from './types.js'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

export { type TelegramBotMenuCommand }

export const TELEGRAM_NATIVE_COMMANDS = new Set(TELEGRAM_NATIVE_COMMAND_HEADS)

export const TELEGRAM_COMMAND_HEADS = SHARED_TELEGRAM_COMMAND_HEADS

export const TELEGRAM_COMMAND_HEADS_PATTERN = SHARED_TELEGRAM_COMMAND_HEADS_PATTERN

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

export const TELEGRAM_PRIVATE_BOT_COMMANDS: TelegramBotMenuCommand[] = buildTelegramBotCommands('private')

export const TELEGRAM_GROUP_BOT_COMMANDS: TelegramBotMenuCommand[] = buildTelegramBotCommands('group')

export const TELEGRAM_ADMIN_BOT_COMMANDS: TelegramBotMenuCommand[] = buildTelegramBotCommands('admin')

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
