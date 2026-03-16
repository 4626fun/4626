import { asTrimmed } from '../utils.js'

export function resolveHelpCallbackCommand(rawData: string): string | null {
  const token = asTrimmed(rawData).toLowerCase()
  if (token.startsWith('menu:')) {
    const action = token.slice(5)
    if (action === 'start') return '/start'
    if (action === 'connect') return '/link'
    if (action === 'link') return '/link'
    if (action === 'linked') return '/linked'
    if (action === 'unlink') return '/unlink'
    if (action === 'wallet' || action === 'portfolio') return '/wallet'
    if (action === 'buy') return '/buy'
    if (action === 'sell') return '/sell'
    if (action === 'bid') return '/bid'
    if (action === 'join') return '/join'
    if (action === 'eligibility') return '/eligibility'
    if (action === 'rooms') return '/rooms'
    if (action === 'vaults') return '/vaults'
    if (action === 'auctions') return '/auctions'
    if (action === 'mybids') return '/mybids'
    if (action === 'signals') return '/signals'
    if (action === 'deploy') return '/deploy'
    if (action === 'zora') return '/zora'
    if (action === 'help') return '/help'
    return null
  }
  if (!token.startsWith('help:')) return null
  const action = token.slice(5)
  if (!action || action === 'quick' || action === 'start') return '/help'
  if (action === 'inline') return '/inline'
  if (action === 'all') return '/help all'
  if (action === 'arena_tune') return '/arena tune attack=100 eco=2.1 expansion=2.4 retreat=0.55 defense=1.3 air=0.4 raid=14 safety=8'
  if (action === 'arena_rules') return '/arena rules ECO:6 TECH:7 DEF:4 AIR:3 ASSIST:6'
  if (action === 'arena_zones') return '/arena zones C:attack W:defend N:scout commander=SW'
  if (action === 'arena_control') return '/arena control ECO:6 TECH:7 C:attack NE:scout commander=SW'
  if (action === 'arena_play') return '/arena play'
  if (action === 'arena_find') return '/arena find'
  if (action === 'arena_state') return '/arena state'
  if (action === 'arena_result') return '/arena result'
  if (action === 'arena_watch_on') return '/arena watch on'
  if (action === 'arena_watch_status') return '/arena watch status'
  if (
    action === 'core' ||
    action === 'coin' ||
    action === 'market' ||
    action === 'social' ||
    action === 'ops' ||
    action === 'bankr' ||
    action === 'wallet' ||
    action === 'arena'
  ) {
    return `/help ${action}`
  }
  return null
}

export function resolveNavigationCallbackToast(rawData: string, mappedCommand: string | null): string {
  const token = asTrimmed(rawData).toLowerCase()
  if (token === 'menu:start') return 'Start menu'
  if (token === 'menu:more') return 'More tools'
  if (token === 'menu:trade') return 'Trade menu'
  if (token === 'menu:explore') return 'Explore menu'
  if (token === 'menu:topics') return 'Help topics'
  if (token === 'menu:wallet' || token === 'menu:portfolio') return 'Wallet ready'
  if (token === 'menu:vaults') return 'Vaults ready'
  if (token === 'menu:auctions') return 'Auctions ready'
  if (token === 'menu:mybids') return 'Bids ready'
  if (token === 'menu:signals') return 'Signals ready'
  if (token === 'menu:buy') return 'Buy flow'
  if (token === 'menu:sell') return 'Sell flow'
  if (token === 'menu:bid') return 'Bid flow'
  if (token === 'menu:deploy') return 'Deploy wizard'
  if (token === 'menu:zora') return 'Zora setup'
  if (token === 'menu:connect' || token === 'menu:link') return 'Connect flow'
  if (token === 'menu:linked') return 'Link status'
  if (token === 'menu:unlink') return 'Unlink flow'
  if (token === 'menu:join') return 'Join flow'
  if (token === 'menu:eligibility') return 'Eligibility check'
  if (token === 'menu:rooms') return 'Rooms list'
  if (token === 'help:arena_tune') return 'Arena tune template'
  if (token === 'help:arena_rules') return 'Arena rules template'
  if (token === 'help:arena_zones') return 'Arena zones template'
  if (token === 'help:arena_control') return 'Arena control template'
  if (token === 'help:arena_play') return 'Arena play'
  if (token === 'help:arena_find') return 'Arena find match'
  if (token === 'help:arena_state') return 'Arena state'
  if (token === 'help:arena_result') return 'Arena result'
  if (token === 'help:arena_watch_on') return 'Arena watch enabled'
  if (token === 'help:arena_watch_status') return 'Arena watch status'
  if (token === 'help:inline') return 'Inline shortcuts'
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
