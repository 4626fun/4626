import { asTrimmed } from '../utils.js'

const MENU_CALLBACK_COMMANDS: Readonly<Record<string, string>> = {
  start: '/start',
  connect: '/link',
  linked: '/linked',
  wallet: '/wallet',
  buy: '/buy',
  sell: '/sell',
  bid: '/bid',
  rooms: '/rooms',
  vaults: '/vaults',
  auctions: '/auctions',
  mybids: '/mybids',
  deploy: '/deploy',
  vaultdeploy: '/vaultdeploy akita v1.6.1',
  zora: '/zora',
  help: '/help',
}

const CRE_CALLBACK_COMMANDS: Readonly<Record<string, string>> = {
  status: '/cre status',
  auction: '/cre auction',
  solana: '/cre solana',
  health: '/cre health',
  tend: '/cre tend',
  report: '/cre report',
  'settle-fees': '/cre settle-fees',
  'relay-entries': '/cre relay-entries',
}

const HELP_CALLBACK_COMMANDS: Readonly<Record<string, string>> = {
  all: '/help all',
}

const HELP_TOPIC_ACTIONS = new Set([
  'core',
  'coin',
  'social',
  'ops',
  'wallet',
])

const CALLBACK_TOASTS: Readonly<Record<string, string>> = {
  'menu:start': 'Start menu',
  'menu:more': 'More tools',
  'menu:trade': 'Trade menu',
  'menu:explore': 'Explore menu',
  'menu:cre': 'CRE ops',
  'menu:solana': 'Solana ops',
  'menu:topics': 'Help topics',
  'menu:wallet': 'Wallet ready',
  'menu:vaults': 'Vaults ready',
  'menu:auctions': 'Auctions ready',
  'menu:mybids': 'Bids ready',
  'menu:buy': 'Buy flow',
  'menu:sell': 'Sell flow',
  'menu:bid': 'Bid flow',
  'menu:deploy': 'Deploy wizard',
  'menu:vaultdeploy': 'Vault deploy',
  'menu:zora': 'Zora setup',
  'onboard:begin': 'Onboarding',
  'onboard:csw:link': 'CSW check',
  'onboard:csw:create': 'CSW check',
  'menu:connect': 'Connect flow',
  'menu:linked': 'Link status',
  'menu:rooms': 'Rooms list',
  'cre:status': 'CRE status',
  'cre:auction': 'Auction status',
  'cre:solana': 'Solana status',
  'cre:health': 'CRE health',
  'cre:tend': 'Tending vaults',
  'cre:report': 'Reporting vaults',
  'cre:settle-fees': 'Settling fees',
  'cre:relay-entries': 'Relaying entries',
}

function resolveNamespacedCallbackCommand(
  token: string,
  namespace: string,
  commands: Readonly<Record<string, string>>,
): string | null {
  if (!token.startsWith(namespace)) return null
  return commands[token.slice(namespace.length)] ?? null
}

export function resolveHelpCallbackCommand(rawData: string): string | null {
  const token = asTrimmed(rawData).toLowerCase()
  const menuCommand = resolveNamespacedCallbackCommand(token, 'menu:', MENU_CALLBACK_COMMANDS)
  if (menuCommand) return menuCommand

  const creCommand = resolveNamespacedCallbackCommand(token, 'cre:', CRE_CALLBACK_COMMANDS)
  if (creCommand) return creCommand

  if (!token.startsWith('help:')) return null
  const action = token.slice(5)
  const directHelpCommand = HELP_CALLBACK_COMMANDS[action]
  if (directHelpCommand) return directHelpCommand
  if (HELP_TOPIC_ACTIONS.has(action)) return `/help ${action}`
  return null
}

export function resolveNavigationCallbackToast(rawData: string, mappedCommand: string | null): string {
  const token = asTrimmed(rawData).toLowerCase()
  const exactToast = CALLBACK_TOASTS[token]
  if (exactToast) return exactToast
  if (token.startsWith('help:')) return 'Help topic'
  if (mappedCommand === '/help' || mappedCommand?.startsWith('/help ')) return 'Help'
  return ''
}

type ImmediateToastInput = {
  parsedTradeFlowCallback:
    | { kind: 'vault'; actionType: 'buy' | 'sell' | 'bid'; vaultAddress: `0x${string}` }
    | { kind: 'percent'; actionType: 'buy' | 'sell' | 'bid'; vaultAddress: `0x${string}`; percentBps: number }
    | { kind: 'custom'; actionType: 'buy' | 'sell' | 'bid'; vaultAddress: `0x${string}` }
    | null
  parsedTradeCallback: { kind: 'accept' | 'decline'; token: string } | { kind: 'edit'; actionType: 'buy' | 'sell' | 'bid' } | null
  parsedDeployCallback:
    | { kind: 'type'; deployType: 'trend' | 'content' | 'creator' | 'zora' }
    | { kind: 'confirm' | 'decline'; token: string }
    | null
  callbackData: string
  mappedCommand: string | null
}

export function resolveImmediateCallbackToast(params: ImmediateToastInput): string {
  const tradeFlow = params.parsedTradeFlowCallback
  if (tradeFlow) {
    if (tradeFlow.kind === 'vault') return 'Loading sizes...'
    if (tradeFlow.kind === 'percent') return 'Building preview...'
    return 'Send custom %'
  }
  const trade = params.parsedTradeCallback
  if (trade) {
    if (trade.kind === 'accept') return 'Processing...'
    if (trade.kind === 'decline') return 'Declining...'
    return 'Edit command'
  }
  const deploy = params.parsedDeployCallback
  if (deploy) {
    if (deploy.kind === 'confirm') return 'Deploying...'
    if (deploy.kind === 'decline') return 'Deploy declined'
    if (deploy.kind === 'type') return deploy.deployType === 'zora' ? 'Zora setup' : 'Preparing template...'
    return ''
  }
  return resolveNavigationCallbackToast(params.callbackData, params.mappedCommand)
}
