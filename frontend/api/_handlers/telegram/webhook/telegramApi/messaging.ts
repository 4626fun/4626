import { formatTelegramOutboundText } from '../markdown.js'
import { splitTelegramMessage } from '../utils.js'

export async function sendTelegramMessage(params: {
  botToken: string
  chatId: string
  text: string
  replyToMessageId?: number
  messageThreadId?: number
  replyMarkup?: Record<string, unknown>
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/sendMessage`
  const formatted = formatTelegramOutboundText(params.text)
  const sendOnce = async (replyToMessageId?: number): Promise<Response> => {
    const payload: Record<string, unknown> = {
      chat_id: params.chatId,
      text: formatted.text,
      disable_web_page_preview: true,
      ...(formatted.parseMode ? { parse_mode: formatted.parseMode } : {}),
    }
    if (typeof replyToMessageId === 'number') {
      payload.reply_to_message_id = replyToMessageId
    }
    if (typeof params.messageThreadId === 'number') {
      payload.message_thread_id = params.messageThreadId
    }
    if (params.replyMarkup && typeof params.replyMarkup === 'object') {
      payload.reply_markup = params.replyMarkup
    }
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  const firstResponse = await sendOnce(params.replyToMessageId)
  if (firstResponse.ok) return

  const firstDetails = await firstResponse.text().catch(() => '')
  const firstDetailsLower = firstDetails.toLowerCase()
  const retryWithoutReplyTarget =
    typeof params.replyToMessageId === 'number' &&
    firstResponse.status === 400 &&
    firstDetailsLower.includes('message to be replied not found')

  if (retryWithoutReplyTarget) {
    const retryResponse = await sendOnce(undefined)
    if (retryResponse.ok) return
    const retryDetails = await retryResponse.text().catch(() => '')
    throw new Error(`telegram_send_failed_${retryResponse.status}:${retryDetails.slice(0, 180)}`)
  }

  throw new Error(`telegram_send_failed_${firstResponse.status}:${firstDetails.slice(0, 180)}`)
}

export async function editTelegramMessage(params: {
  botToken: string
  chatId: string
  messageId: number
  text: string
  replyMarkup?: Record<string, unknown>
}): Promise<boolean> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/editMessageText`
  const formatted = formatTelegramOutboundText(params.text)
  const payload: Record<string, unknown> = {
    chat_id: params.chatId,
    message_id: params.messageId,
    text: formatted.text,
    disable_web_page_preview: true,
    ...(formatted.parseMode ? { parse_mode: formatted.parseMode } : {}),
  }
  if (params.replyMarkup && typeof params.replyMarkup === 'object') {
    payload.reply_markup = params.replyMarkup
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (response.ok) return true
  const details = await response.text().catch(() => '')
  const detailsLower = details.toLowerCase()
  if (response.status === 400 && detailsLower.includes('message is not modified')) {
    return true
  }
  if (response.status === 400 && detailsLower.includes("message can't be edited")) {
    return false
  }
  throw new Error(`telegram_edit_failed_${response.status}:${details.slice(0, 180)}`)
}

export async function deleteTelegramMessage(params: {
  botToken: string
  chatId: string
  messageId: number
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/deleteMessage`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: params.chatId,
      message_id: params.messageId,
    }),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    const detailsLower = details.toLowerCase()
    if (response.status === 400 && (detailsLower.includes('message to delete not found') || detailsLower.includes("message can't be deleted"))) {
      return
    }
    throw new Error(`telegram_delete_failed_${response.status}:${details.slice(0, 180)}`)
  }
}

export async function replaceTelegramMenuMessage(params: {
  botToken: string
  chatId: string
  messageId: number
  text: string
  replyMarkup?: Record<string, unknown>
}): Promise<void> {
  const chunks = splitTelegramMessage(params.text)
  const firstChunk = chunks[0] ?? 'Command received.'
  let edited = false
  try {
    edited = await editTelegramMessage({
      botToken: params.botToken,
      chatId: params.chatId,
      messageId: params.messageId,
      text: firstChunk,
      replyMarkup: params.replyMarkup,
    })
  } catch {
    edited = false
  }
  if (!edited) {
    await sendTelegramMessage({
      botToken: params.botToken,
      chatId: params.chatId,
      text: firstChunk,
      replyMarkup: params.replyMarkup,
    })
    await deleteTelegramMessage({
      botToken: params.botToken,
      chatId: params.chatId,
      messageId: params.messageId,
    }).catch(() => {})
  }

  for (let idx = 1; idx < chunks.length; idx += 1) {
    const chunk = chunks[idx]
    if (!chunk) continue
    await sendTelegramMessage({
      botToken: params.botToken,
      chatId: params.chatId,
      text: chunk,
    })
  }
}
