export type TimelineCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export type TimelineTrade = {
  id: string
  time: number
  coin: string | null
  side: 'long' | 'short' | null
  action: 'entry' | 'add' | 'reduce' | 'close' | 'flip' | 'unknown'
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
}

export type ChartOverlayEvent = {
  id: string
  time: number
  market: string | null
  kind: 'trade' | 'host-chat' | 'chat'
  action?: TimelineTrade['action']
  side?: TimelineTrade['side']
  price?: number | null
  text?: string
  senderLabel?: string | null
  senderAddress?: string
  isFirstFromSender?: boolean
}
