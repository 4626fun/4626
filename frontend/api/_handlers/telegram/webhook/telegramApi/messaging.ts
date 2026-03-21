import { formatTelegramOutboundText } from '../markdown.js'
import { isPrivateChatId } from '../env.js'
import { asTrimmed, splitTelegramMessage } from '../utils.js'

const TELEGRAM_DISMISS_CALLBACK = 'message:delete' as const

function shouldRetryWithoutParseMode(status: number, detailsLower: string): boolean {
  if (status !== 400) return false
  return (
    detailsLower.includes("can't parse entities") ||
    detailsLower.includes('unsupported start tag') ||
    detailsLower.includes("can't find end tag")
  )
}

function stripTelegramFormatting(value: string): string {
  return value
    .replace(/<\/?(?:b|strong|i|em|u|s|code|pre|a|blockquote)\b[^>]*>/gi, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function buildDismissButton(): Record<string, string> {
  return { text: '🗑', callback_data: TELEGRAM_DISMISS_CALLBACK }
}

function withDismissButton(params: {
  chatId?: string
  replyMarkup?: Record<string, unknown>
}): Record<string, unknown> | undefined {
  if (!params.chatId || !isPrivateChatId(params.chatId)) {
    return params.replyMarkup
  }
  const dismissButton = buildDismissButton()
  if (!params.replyMarkup || typeof params.replyMarkup !== 'object') {
    return { inline_keyboard: [[dismissButton]] }
  }

  const inlineKeyboard = Array.isArray((params.replyMarkup as any).inline_keyboard)
    ? ([...(params.replyMarkup as any).inline_keyboard] as Array<Array<Record<string, unknown>>>)
    : null
  if (!inlineKeyboard) return params.replyMarkup

  const hasDismissButton = inlineKeyboard.some((row) =>
    Array.isArray(row) && row.some((button) => button?.callback_data === TELEGRAM_DISMISS_CALLBACK),
  )
  if (hasDismissButton) return params.replyMarkup

  return {
    ...params.replyMarkup,
    inline_keyboard: [...inlineKeyboard, [dismissButton]],
  }
}

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
  const sendOnce = async (input?: {
    replyToMessageId?: number
    text?: string
    parseMode?: string | null
  }): Promise<Response> => {
    const payload: Record<string, unknown> = {
      chat_id: params.chatId,
      text: input?.text ?? formatted.text,
      disable_web_page_preview: true,
      ...(input?.parseMode ? { parse_mode: input.parseMode } : {}),
    }
    if (typeof input?.replyToMessageId === 'number') {
      payload.reply_to_message_id = input.replyToMessageId
    }
    if (typeof params.messageThreadId === 'number') {
      payload.message_thread_id = params.messageThreadId
    }
    const replyMarkup = withDismissButton({ chatId: params.chatId, replyMarkup: params.replyMarkup })
    if (replyMarkup) payload.reply_markup = replyMarkup
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  let replyToMessageId = params.replyToMessageId
  let response = await sendOnce({
    replyToMessageId,
    parseMode: formatted.parseMode,
  })
  if (response.ok) return

  let details = await response.text().catch(() => '')
  let detailsLower = details.toLowerCase()
  const retryWithoutReplyTarget =
    typeof replyToMessageId === 'number' &&
    response.status === 400 &&
    detailsLower.includes('message to be replied not found')

  if (retryWithoutReplyTarget) {
    replyToMessageId = undefined
    response = await sendOnce({
      replyToMessageId,
      parseMode: formatted.parseMode,
    })
    if (response.ok) return
    details = await response.text().catch(() => '')
    detailsLower = details.toLowerCase()
  }

  if (formatted.parseMode && shouldRetryWithoutParseMode(response.status, detailsLower)) {
    const plainText = stripTelegramFormatting(formatted.text)
    const retryWithoutParseMode = await sendOnce({
      replyToMessageId,
      text: plainText,
      parseMode: null,
    })
    if (retryWithoutParseMode.ok) return
    const retryDetails = await retryWithoutParseMode.text().catch(() => '')
    throw new Error(`telegram_send_failed_${retryWithoutParseMode.status}:${retryDetails.slice(0, 180)}`)
  }

  throw new Error(`telegram_send_failed_${response.status}:${details.slice(0, 180)}`)
}

export async function sendTelegramPhoto(params: {
  botToken: string
  chatId: string
  photo: Uint8Array
  filename?: string
  contentType?: string
  caption?: string
  replyToMessageId?: number
  messageThreadId?: number
  replyMarkup?: Record<string, unknown>
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/sendPhoto`
  const formattedCaption = formatTelegramOutboundText(asTrimmed(params.caption ?? ''))
  const form = new FormData()
  const photoBuffer = Buffer.from(params.photo)
  form.append('chat_id', params.chatId)
  form.append('photo', new Blob([photoBuffer], { type: params.contentType ?? 'image/png' }), params.filename ?? 'card.png')
  if (formattedCaption.text) {
    form.append('caption', formattedCaption.text)
    if (formattedCaption.parseMode) form.append('parse_mode', formattedCaption.parseMode)
  }
  if (typeof params.replyToMessageId === 'number') {
    form.append('reply_to_message_id', String(params.replyToMessageId))
  }
  if (typeof params.messageThreadId === 'number') {
    form.append('message_thread_id', String(params.messageThreadId))
  }
  const replyMarkup = withDismissButton({ chatId: params.chatId, replyMarkup: params.replyMarkup })
  if (replyMarkup) {
    form.append('reply_markup', JSON.stringify(replyMarkup))
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    body: form,
  })
  if (response.ok) return
  const details = await response.text().catch(() => '')
  throw new Error(`telegram_photo_failed_${response.status}:${details.slice(0, 180)}`)
}

export async function editTelegramMessage(params: {
  botToken: string
  chatId: string
  messageId: number
  text: string
  replyMarkup?: Record<string, unknown>
}): Promise<boolean> {
  return editTelegramMessageInternal({
    botToken: params.botToken,
    text: params.text,
    replyMarkup: withDismissButton({ chatId: params.chatId, replyMarkup: params.replyMarkup }),
    target: {
      chat_id: params.chatId,
      message_id: params.messageId,
    },
  })
}

export async function editTelegramInlineMessage(params: {
  botToken: string
  inlineMessageId: string
  text: string
  replyMarkup?: Record<string, unknown>
}): Promise<boolean> {
  const inlineMessageId = asTrimmed(params.inlineMessageId)
  if (!inlineMessageId) return false
  return editTelegramMessageInternal({
    botToken: params.botToken,
    text: params.text,
    replyMarkup: params.replyMarkup,
    target: {
      inline_message_id: inlineMessageId,
    },
  })
}

async function editTelegramMessageInternal(params: {
  botToken: string
  text: string
  replyMarkup?: Record<string, unknown>
  target:
    | { chat_id: string; message_id: number }
    | { inline_message_id: string }
}): Promise<boolean> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/editMessageText`
  const formatted = formatTelegramOutboundText(params.text)
  const payload: Record<string, unknown> = {
    text: formatted.text,
    disable_web_page_preview: true,
    ...(formatted.parseMode ? { parse_mode: formatted.parseMode } : {}),
    ...params.target,
  }
  if (params.replyMarkup) payload.reply_markup = params.replyMarkup
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
