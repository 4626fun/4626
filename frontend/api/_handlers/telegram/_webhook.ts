import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { handleKeeprCommand } from '../../../server/keepr/commands.js'
import { handleTwitterCommand } from '../../../server/twitter/commands.js'

declare const process: { env: Record<string, string | undefined> }

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

type TelegramFrom = {
  id?: number | string
  is_bot?: boolean
}

type TelegramChat = {
  id?: number | string
}

type TelegramMessage = {
  message_id?: number
  text?: string
  caption?: string
  from?: TelegramFrom
  chat?: TelegramChat
}

type TelegramInlineQuery = {
  id?: string | number
  query?: string
  from?: TelegramFrom
}

type TelegramUpdate = {
  update_id?: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  channel_post?: TelegramMessage
  inline_query?: TelegramInlineQuery
}

type TelegramWebhookOk = {
  ok: true
  ignored?: boolean
  updateId?: number | null
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseBoolean(value: unknown, defaultValue: boolean): boolean {
  const raw = asTrimmed(value).toLowerCase()
  if (!raw) return defaultValue
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return defaultValue
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function parseJsonObject(raw: string | undefined): Record<string, unknown> {
  const source = asTrimmed(raw ?? '')
  if (!source) return {}
  try {
    const parsed = JSON.parse(source) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function parseAdminUserIds(): Set<string> {
  const raw = asTrimmed(process.env.TELEGRAM_ADMIN_USER_IDS ?? '')
  if (!raw) return new Set()
  return new Set(
    raw
      .split(/[\s,]+/g)
      .map((part) => part.trim())
      .filter(Boolean),
  )
}

function parseAllowedChatIds(): Set<string> {
  const explicit = asTrimmed(process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
  if (explicit) {
    return new Set(
      explicit
        .split(/[\s,]+/g)
        .map((part) => part.trim())
        .filter(Boolean),
    )
  }

  const fallback = asTrimmed(process.env.TELEGRAM_TARGET_CHAT_ID ?? '')
  return fallback ? new Set([fallback]) : new Set()
}

function isPrivateChatId(chatId: string): boolean {
  // Telegram groups/channels are negative, private chats are positive.
  return !chatId.startsWith('-')
}

function resolveSenderWallet(userId: string): `0x${string}` {
  const userWalletMap = parseJsonObject(process.env.TELEGRAM_USER_WALLET_MAP_JSON)
  const mapped = asTrimmed(userWalletMap[userId])
  if (isAddressLike(mapped)) return mapped.toLowerCase() as `0x${string}`

  const fallback = asTrimmed(process.env.TELEGRAM_DEFAULT_SENDER_WALLET ?? '')
  if (isAddressLike(fallback)) return fallback.toLowerCase() as `0x${string}`

  return ZERO_ADDRESS
}

function resolveGroupId(chatId: string): string {
  const groupMap = parseJsonObject(process.env.TELEGRAM_GROUP_ID_MAP_JSON)
  const mapped = asTrimmed(groupMap[chatId])
  if (mapped) return mapped

  const fallback = asTrimmed(process.env.TELEGRAM_DEFAULT_GROUP_ID ?? '')
  if (fallback) return fallback

  return `telegram:${chatId}`
}

function extractUpdateMessage(update: TelegramUpdate): TelegramMessage | null {
  const m = update?.message
  if (m && typeof m === 'object') return m
  const em = update?.edited_message
  if (em && typeof em === 'object') return em
  const cp = update?.channel_post
  if (cp && typeof cp === 'object') return cp
  return null
}

function splitTelegramMessage(text: string, maxLen = 3500): string[] {
  const value = asTrimmed(text)
  if (!value) return []
  if (value.length <= maxLen) return [value]

  const parts: string[] = []
  let cursor = 0
  while (cursor < value.length) {
    const end = Math.min(cursor + maxLen, value.length)
    parts.push(value.slice(cursor, end))
    cursor = end
  }
  return parts
}

function isTwitterCommand(rawText: string): boolean {
  const lower = asTrimmed(rawText).toLowerCase()
  return /^(\/x|x)(\s|$)/.test(lower) || /^(\/tweet|tweet)(\s|$)/.test(lower)
}

function isInlineLauncherCommand(rawText: string): boolean {
  const lower = asTrimmed(rawText).toLowerCase()
  return /^(\/inline|inline|\/shortcuts|shortcuts)(\s|$)/.test(lower)
}

function normalizeInlineDraft(rawQuery: string): string {
  const compact = asTrimmed(rawQuery).replace(/\s+/g, ' ')
  const stripped = compact
    .replace(/^\/?x\s+post\s+/i, '')
    .replace(/^\/?tweet\s+/i, '')
    .replace(/\s*--confirm\b/gi, '')
    .trim()
  const truncated = stripped.slice(0, 240).trim()
  return truncated || 'your update here'
}

function inferMarketSymbol(rawQuery: string): string {
  const token = asTrimmed(rawQuery).split(/\s+/g)[0] ?? ''
  return /^[a-zA-Z]{1,10}$/.test(token) ? token.toUpperCase() : 'BTC'
}

function buildInlineQueryResults(rawQuery: string): Array<Record<string, unknown>> {
  const query = asTrimmed(rawQuery)
  const xPostCommand = `/x post ${normalizeInlineDraft(query)} --confirm`
  const aiPrompt = query ? `/ai ${query}` : '/ai What should I do next?'
  const marketQuote = `/mkt quote ${inferMarketSymbol(query)}`

  return [
    {
      type: 'article',
      id: 'help',
      title: 'Keepr Help',
      description: 'Insert /help',
      input_message_content: { message_text: '/help' },
    },
    {
      type: 'article',
      id: 'status',
      title: 'Vault Status',
      description: 'Insert /keepr status',
      input_message_content: { message_text: '/keepr status' },
    },
    {
      type: 'article',
      id: 'xpost',
      title: 'Draft X Post',
      description: 'Insert /x post ... --confirm',
      input_message_content: { message_text: xPostCommand },
    },
    {
      type: 'article',
      id: 'ai',
      title: 'Ask Keepr AI',
      description: 'Insert /ai <question>',
      input_message_content: { message_text: aiPrompt },
    },
    {
      type: 'article',
      id: 'mkt',
      title: 'Market Quote',
      description: 'Insert /mkt quote <symbol>',
      input_message_content: { message_text: marketQuote },
    },
  ]
}

function buildInlineLauncherReplyMarkup(): Record<string, unknown> {
  return {
    inline_keyboard: [
      [{ text: 'Draft X post', switch_inline_query_current_chat: 'x post your update here' }],
      [
        { text: 'Ask AI', switch_inline_query_current_chat: 'ai What should I do next?' },
        { text: 'Vault status', switch_inline_query_current_chat: 'keepr status' },
      ],
      [{ text: 'Market quote', switch_inline_query_current_chat: 'mkt quote BTC' }],
    ],
  }
}

async function sendTelegramMessage(params: {
  botToken: string
  chatId: string
  text: string
  replyToMessageId?: number
  replyMarkup?: Record<string, unknown>
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/sendMessage`
  const sendOnce = async (replyToMessageId?: number): Promise<Response> => {
    const payload: Record<string, unknown> = {
      chat_id: params.chatId,
      text: params.text,
      disable_web_page_preview: true,
    }
    if (typeof replyToMessageId === 'number') {
      payload.reply_to_message_id = replyToMessageId
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

async function answerTelegramInlineQuery(params: {
  botToken: string
  inlineQueryId: string
  query: string
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/answerInlineQuery`
  const payload = {
    inline_query_id: params.inlineQueryId,
    cache_time: 5,
    is_personal: true,
    results: buildInlineQueryResults(params.query),
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`telegram_inline_answer_failed_${response.status}:${details.slice(0, 180)}`)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      data: { ok: true } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const botToken = asTrimmed(process.env.TELEGRAM_BOT_TOKEN ?? '')
  if (!botToken) {
    return res.status(503).json({ success: false, error: 'Telegram bot is not configured' } satisfies ApiEnvelope<never>)
  }

  const configuredSecret = asTrimmed(process.env.TELEGRAM_WEBHOOK_SECRET ?? '')
  if (configuredSecret) {
    const providedSecret = asTrimmed(req.headers?.['x-telegram-bot-api-secret-token'])
    if (providedSecret !== configuredSecret) {
      return res.status(401).json({ success: false, error: 'Invalid Telegram webhook secret' } satisfies ApiEnvelope<never>)
    }
  }

  const update = await readJsonBody<TelegramUpdate>(req, { maxBytes: 512_000 })
  if (!update) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  const inlineQuery = update.inline_query
  if (inlineQuery && typeof inlineQuery === 'object') {
    const inlineQueryId = String(inlineQuery.id ?? '').trim()
    if (!inlineQueryId) {
      return res.status(200).json({
        success: true,
        data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }

    try {
      await answerTelegramInlineQuery({
        botToken,
        inlineQueryId,
        query: asTrimmed(inlineQuery.query ?? ''),
      })
    } catch (error) {
      console.error('[telegram/webhook] inline query failed', {
        updateId: update.update_id ?? null,
        inlineQueryId,
        err: error instanceof Error ? error.message : String(error),
      })
    }

    return res.status(200).json({
      success: true,
      data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const message = extractUpdateMessage(update)
  if (!message) {
    return res.status(200).json({
      success: true,
      data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const chatId = String(message?.chat?.id ?? '').trim()
  const userId = String(message?.from?.id ?? '').trim()
  const fromBot = Boolean(message?.from?.is_bot)
  const text = asTrimmed(message.text ?? message.caption ?? '')
  if (!chatId || !text) {
    return res.status(200).json({
      success: true,
      data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  if (fromBot) {
    return res.status(200).json({
      success: true,
      data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const adminUserIds = parseAdminUserIds()
  const isAdmin = userId ? adminUserIds.has(userId) : false
  const allowAdminDm = parseBoolean(process.env.TELEGRAM_ALLOW_ADMIN_DM, true)
  const allowedChatIds = parseAllowedChatIds()
  const allowedByChat = allowedChatIds.size === 0 || allowedChatIds.has(chatId)
  const allowedByAdminDm = allowAdminDm && isAdmin && isPrivateChatId(chatId)
  if (!allowedByChat && !allowedByAdminDm) {
    return res.status(200).json({
      success: true,
      data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  if (isInlineLauncherCommand(text)) {
    await sendTelegramMessage({
      botToken,
      chatId,
      text:
        'Inline shortcuts are ready. Tap a button below to pre-fill a draft in this chat, then send it.',
      replyToMessageId: message.message_id,
      replyMarkup: buildInlineLauncherReplyMarkup(),
    })
    return res.status(200).json({
      success: true,
      data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const senderWallet = resolveSenderWallet(userId)
  const groupId = resolveGroupId(chatId)

  let responseText = ''
  try {
    if (isTwitterCommand(text)) {
      const twitterResult = await handleTwitterCommand({
        groupId,
        senderWallet,
        text,
        role: isAdmin ? 'ADMIN' : 'MEMBER',
      })
      responseText = asTrimmed(twitterResult.response)
    } else {
      const keeprResult = await handleKeeprCommand({
        groupId,
        senderWallet,
        text,
      })
      responseText = asTrimmed(keeprResult.response)
    }
  } catch (error) {
    console.error('[telegram/webhook] command handling failed', {
      updateId: update.update_id ?? null,
      chatId,
      err: error instanceof Error ? error.message : String(error),
    })
    responseText = 'Request failed. Please try again in a few seconds.'
  }

  if (!responseText) {
    responseText = 'Command received.'
  }

  const chunks = splitTelegramMessage(responseText)
  for (let idx = 0; idx < chunks.length; idx += 1) {
    const chunk = chunks[idx]
    if (!chunk) continue
    await sendTelegramMessage({
      botToken,
      chatId,
      text: chunk,
      replyToMessageId: idx === 0 ? message.message_id : undefined,
    })
  }

  return res.status(200).json({
    success: true,
    data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
  } satisfies ApiEnvelope<TelegramWebhookOk>)
}
