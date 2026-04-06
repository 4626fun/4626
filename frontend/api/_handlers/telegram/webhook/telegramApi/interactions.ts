import { asTrimmed } from '../utils.js'

type TelegramCallbackQueryPayload = {
  callback_query_id: string
  text?: string
  show_alert?: boolean
  url?: string
  cache_time?: number
}

type TelegramPreCheckoutPayload = {
  pre_checkout_query_id: string
  ok: boolean
  error_message?: string
}

export async function answerTelegramCallbackQuery(params: {
  botToken: string
  callbackQueryId: string
  text?: string
  showAlert?: boolean
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/answerCallbackQuery`
  const payload: TelegramCallbackQueryPayload = {
    callback_query_id: params.callbackQueryId,
  }
  if (asTrimmed(params.text).length > 0) {
    payload.text = asTrimmed(params.text)
  }
  if (typeof params.showAlert === 'boolean') {
    payload.show_alert = params.showAlert
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`telegram_callback_answer_failed_${response.status}:${details.slice(0, 180)}`)
  }
}

export async function answerTelegramPreCheckoutQuery(params: {
  botToken: string
  preCheckoutQueryId: string
  ok: boolean
  errorMessage?: string
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/answerPreCheckoutQuery`
  const payload: TelegramPreCheckoutPayload = {
    pre_checkout_query_id: params.preCheckoutQueryId,
    ok: params.ok,
  }
  if (!params.ok) {
    payload.error_message = asTrimmed(params.errorMessage ?? '') || 'Tip is not available right now.'
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`telegram_precheckout_answer_failed_${response.status}:${details.slice(0, 180)}`)
  }
}
