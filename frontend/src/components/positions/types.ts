export type TimelineCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number | null
}

export type TimelineTrade = {
  id: string
  time: number
  coin: string | null
  side: 'long' | 'short' | null
  action: 'entry' | 'add' | 'reduce' | 'close' | 'liquidated' | 'flip' | 'unknown'
  price: number | null
  size: number | null
  dir: string | null
  closedPnl: number
  fee: number
  market: string
}

export type TimelineChat = {
  id: string
  messageId: string
  senderAddress: string
  senderLabel: string | null
  senderAvatarUrl: string | null
  text: string
  time: number
  isHost: boolean
  isFirstFromSender: boolean
  replyId: string | null
  replyText: string | null
  replySender: string | null
  replySenderLabel: string | null
  market: string | null
}

export type MarketPosition = {
  market: string
  coin: string
  side: 'long' | 'short' | null
  sizeUsd: number | null
  entryPrice: number | null
  unrealizedPnlUsd: number | null
  liquidationPrice: number | null
  leverage: number | null
}

export type MarketSummary = {
  market: string
  coin: string
  realizedPnlUsd: number
  tradeCount: number
  closedCount: number
  winningClosedCount: number
  lastActionTime: number | null
  lastAction: TimelineTrade['action'] | null
  messageCount: number
  currentPosition: MarketPosition | null
}

export type TimelineResponse = {
  roomId: string
  symbol: string
  hostAddress: string | null
  generatedAt: string
  candles: TimelineCandle[]
  tradeEvents: TimelineTrade[]
  chatEvents: TimelineChat[]
  markets: string[]
  defaultMarket: string
  currentPositions: MarketPosition[]
  marketSummaries: MarketSummary[]
  roomWideMessageCount: number
}

export type PositionContextAtTime = {
  side: 'long' | 'short' | null
  size: number
  avgEntry: number | null
  markPrice: number | null
  unrealizedPnl: number | null
}

export type ChartOverlayEvent = {
  id: string
  time: number
  market: string | null
  kind: 'trade' | 'host-chat' | 'chat'
  action?: TimelineTrade['action']
  side?: TimelineTrade['side']
  price?: number | null
  size?: number | null
  closedPnl?: number
  dir?: string | null
  text?: string
  senderLabel?: string | null
  senderAvatarUrl?: string | null
  senderAddress?: string
  isFirstFromSender?: boolean
  /** Reconstructed room/host position state valued at this event's timestamp. */
  contextAtTime?: PositionContextAtTime | null
}
