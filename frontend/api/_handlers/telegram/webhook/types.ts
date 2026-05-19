export type TelegramFrom = {
  id?: number | string
  is_bot?: boolean
  username?: string
}

export type TelegramChat = {
  id?: number | string
}

export type TelegramSuccessfulPayment = {
  currency?: string
  total_amount?: number
  invoice_payload?: string
  telegram_payment_charge_id?: string
  provider_payment_charge_id?: string
}

export type TelegramSharedUser = {
  user_id?: number | string
  first_name?: string
  last_name?: string
  username?: string
}

export type TelegramUsersShared = {
  request_id?: number
  users?: TelegramSharedUser[]
}

export type TelegramChatShared = {
  request_id?: number
  chat_id?: number | string
  title?: string
  username?: string
}

export type TelegramMessage = {
  message_id?: number
  text?: string
  caption?: string
  message_thread_id?: number
  from?: TelegramFrom
  chat?: TelegramChat
  reply_to_message?: TelegramMessage
  successful_payment?: TelegramSuccessfulPayment
  users_shared?: TelegramUsersShared
  chat_shared?: TelegramChatShared
}

export type TelegramInlineQuery = {
  id?: string | number
  query?: string
  offset?: string
  chat_type?: TelegramInlineQueryChatType
  from?: TelegramFrom
  location?: TelegramLocation
}

export type TelegramInlineQueryChatType = 'sender' | 'private' | 'group' | 'supergroup' | 'channel'

export type TelegramLocation = {
  latitude?: number
  longitude?: number
  horizontal_accuracy?: number
  live_period?: number
  heading?: number
  proximity_alert_radius?: number
}

export type TelegramChosenInlineResult = {
  result_id?: string
  from?: TelegramFrom
  location?: TelegramLocation
  inline_message_id?: string
  query?: string
}

export type TelegramCallbackQuery = {
  id?: string | number
  data?: string
  from?: TelegramFrom
  message?: TelegramMessage
  inline_message_id?: string
}

export type TelegramPreCheckoutQuery = {
  id?: string | number
  from?: TelegramFrom
  currency?: string
  total_amount?: number
  invoice_payload?: string
}

export type TelegramUpdate = {
  update_id?: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  channel_post?: TelegramMessage
  inline_query?: TelegramInlineQuery
  chosen_inline_result?: TelegramChosenInlineResult
  callback_query?: TelegramCallbackQuery
  pre_checkout_query?: TelegramPreCheckoutQuery
}

export type TelegramWebhookOk = {
  ok: true
  ignored?: boolean
  updateId?: number | null
}

export type TelegramCommandResponse = {
  text: string
  replyMarkup?: Record<string, unknown>
  signalText?: string
  signalReplyMarkup?: Record<string, unknown>
  callbackToast?: string
}

export type ParsedTelegramTradeIntent =
  | {
      actionType: 'buy' | 'sell'
      identifier: string
      amountInput: string
      amount: number
      amountUnit: 'ETH' | 'SHARE'
    }
  | {
      actionType: 'bid'
      identifier: string
      amountInput: string
      amount: number
      amountUnit: 'USD'
    }

export type InteractiveTradeAction = 'buy' | 'sell' | 'bid'

export type DeployWizardType = 'trend' | 'content' | 'creator'

export type DeployCurrencyInput = 'ETH' | 'ZORA' | 'CREATOR_COIN' | 'CONTENT_COIN'

export type CommandCoinCurrency = 'ETH' | 'ZORA' | 'CREATOR_COIN'

export type ParsedTelegramDeployIntent =
  | { kind: 'menu' }
  | { kind: 'zora' }
  | { kind: 'usage'; text: string }
  | { kind: 'trend'; ticker: string }
  | {
      kind: 'coin'
      coinType: Exclude<DeployWizardType, 'trend'>
      name: string
      symbol: string
      metadataUri: string
      currencyInput: DeployCurrencyInput
      commandCurrency: CommandCoinCurrency
    }

export type CcaAuctionQuote = {
  auctionAddress: `0x${string}`
  ccaStrategyAddress: `0x${string}`
  clearingPriceQ96: bigint
  maxPriceQ96: bigint
  tokenDecimals: number
  tokenSymbol: string
  clearingPriceWeiPerToken: bigint
  maxPriceWeiPerToken: bigint
  amountWei: bigint
  amountEth: number
  usdIntent: number
}

export type PrivyWalletOwnerContext = {
  walletId: string
  ownerAddress: `0x${string}`
}

export type ScopedVaultRow = {
  vaultAddress: `0x${string}`
  creatorCoinAddress: `0x${string}`
  chainId: number
  groupId: string
  isSettled: boolean
  ccaStrategyAddress: `0x${string}`
}
