export type ArenaCommandName =
  | 'status'
  | 'assets'
  | 'join'
  | 'activate-unified-account'
  | 'add-api-wallet'
  | 'deposit'
  | 'trade'
  | 'register'

export type ArenaTradeAction = 'open' | 'close'
export type ArenaTradeSide = 'long' | 'short'
export type ArenaTradeMarket = 'crypto' | 'hip3'

export type ArenaPairValidationResult =
  | {
      ok: true
      normalizedPair: string
      market: ArenaTradeMarket
    }
  | {
      ok: false
      reason:
        | 'empty_pair'
        | 'invalid_pair_format'
        | 'hip3_prefix_required'
        | 'asset_not_allowlisted'
      message: string
    }

export type ArenaTradeRequest = {
  action: ArenaTradeAction
  pair: string
  side?: ArenaTradeSide
  sizeUsd?: number
  leverage?: number
}

export type ArenaRunResult = {
  ok: boolean
  command: string
  args: string[]
  cwd: string
  stdout: string
  stderr: string
  code: number | null
  timedOut: boolean
  dryRun: boolean
  error?: string
}

export type ArenaOpResult = {
  ok: boolean
  message: string
  details?: Record<string, unknown>
  run?: ArenaRunResult
}

export type ArenaCreateResult = ArenaOpResult & {
  agentId?: string
  agentWalletAddress?: string
  hlApiWalletAddress?: string
}
