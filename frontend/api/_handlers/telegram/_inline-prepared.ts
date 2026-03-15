import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureTelegramTradingSchema } from '../../../server/_lib/telegramTrading.js'
import { getTelegramWebhookConfig } from './webhook/config.js'
import { isTelegramInlinePreparedEnabled } from './webhook/env.js'
import { verifyTelegramMiniAppInitData, resolveTelegramMiniAppVerificationStatusCode } from './webhook/miniAppAuth.js'
import { buildTelegramMiniAppUrl, resolveTelegramMiniAppUrl } from './webhook/miniApp.js'
import { classifyInlineQuery } from './webhook/parsers/inline.js'
import { emitTelegramFunnelEvent } from './webhook/services/funnel.js'
import { isTelegramMiniAppSessionEnabled, verifyTelegramLinkApiSecret } from './webhook/services/access.js'
import { saveTelegramPreparedInlineMessage } from './webhook/telegramApi/inline.js'
import { asTrimmed } from './webhook/utils.js'

type PreparedInlineBody = {
  initData?: string
  telegramUserId?: string | number
  chatId?: string | number
  command?: string
  text?: string
  title?: string
  description?: string
  switchInlineQuery?: string
}

function readHeader(req: Pick<VercelRequest, 'headers'>, key: string): string {
  const value = req.headers?.[key]
  if (Array.isArray(value)) {
    for (const row of value) {
      const parsed = asTrimmed(row)
      if (parsed) return parsed
    }
    return ''
  }
  return asTrimmed(value)
}

function readTelegramId(value: unknown): string {
  const raw = typeof value === 'number' ? String(Math.trunc(value)) : asTrimmed(value)
  return /^\d+$/.test(raw) ? raw : ''
}

function readChatId(value: unknown): string {
  const raw = typeof value === 'number' ? String(Math.trunc(value)) : asTrimmed(value)
  return /^-?\d+$/.test(raw) ? raw : ''
}

function resolvePreparedCommand(body: PreparedInlineBody): string {
  const command = asTrimmed(body.command ?? '')
  if (command.startsWith('/')) return command.slice(0, 512)
  const text = asTrimmed(body.text ?? '')
  if (text) return `/ai ${text}`.slice(0, 512)
  return '/help'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  if (!isTelegramInlinePreparedEnabled()) {
    return res.status(404).json({ success: false, error: 'Inline prepared messages disabled' } satisfies ApiEnvelope<never>)
  }

  const config = getTelegramWebhookConfig()
  if (!config.botToken) {
    return res.status(503).json({ success: false, error: 'Telegram bot not configured' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<PreparedInlineBody>(req).catch(() => null)) ?? (req.body as PreparedInlineBody | null) ?? {}
  const initData = asTrimmed(body.initData ?? '') || readHeader(req, 'x-telegram-init-data')
  const hasSecret = verifyTelegramLinkApiSecret(req)

  let telegramUserId = ''
  let chatId = ''
  if (initData) {
    const verified = verifyTelegramMiniAppInitData({
      initData,
      botToken: config.botToken,
      maxAgeSeconds: config.miniAppInitDataMaxAgeSeconds,
    })
    if (!verified.ok) {
      return res.status(resolveTelegramMiniAppVerificationStatusCode(verified.reason)).json({
        success: false,
        error: `Mini App auth failed (${verified.reason})`,
      } satisfies ApiEnvelope<never>)
    }
    telegramUserId = verified.identity.telegramUserId
    chatId = verified.identity.chatId ?? ''
  } else {
    if (!hasSecret) {
      return res.status(401).json({ success: false, error: 'Unauthorized' } satisfies ApiEnvelope<never>)
    }
    telegramUserId = readTelegramId(body.telegramUserId)
    chatId = readChatId(body.chatId)
  }

  if (!telegramUserId) {
    return res.status(400).json({ success: false, error: 'telegramUserId is required' } satisfies ApiEnvelope<never>)
  }

  if (!isTelegramMiniAppSessionEnabled({ chatId: chatId || null, userId: telegramUserId })) {
    return res.status(403).json({ success: false, error: 'Mini App session disabled for this scope' } satisfies ApiEnvelope<never>)
  }

  const command = resolvePreparedCommand(body)
  const title = asTrimmed(body.title ?? '') || 'Share from 4626'
  const description = asTrimmed(body.description ?? '') || 'Prepared inline message from Mini App'
  const switchInlineQuery = asTrimmed(body.switchInlineQuery ?? '') || command.replace(/^\//, '')
  const switchBackMiniAppUrl = buildTelegramMiniAppUrl({
    baseUrl: resolveTelegramMiniAppUrl(),
    pathname: '/swap',
    query: {
      tgMiniApp: '1',
      tgEntry: 'inline-prepared',
      tgInline: switchInlineQuery || 'help',
    },
  })

  const saveResult = await saveTelegramPreparedInlineMessage({
    botToken: config.botToken,
    userId: telegramUserId,
    result: {
      type: 'article',
      id: `prepared-${Date.now()}`,
      title,
      description,
      input_message_content: { message_text: command },
    },
    allowUserChats: true,
    allowBotChats: true,
    allowGroupChats: true,
    allowChannelChats: true,
  })

  const db = await getDb().catch(() => null)
  if (db) {
    await ensureTelegramTradingSchema(db as any).catch(() => {})
    emitTelegramFunnelEvent({
      db: db as any,
      telegramUserId,
      chatId: chatId || null,
      eventName: 'inline_prepared_sent',
      actionType: 'inline',
      context: {
        source: 'inline',
        queryClass: classifyInlineQuery(command),
        resultType: 'article',
        preparedInlineMessageId: saveResult.preparedInlineMessageId,
        switchInlineQuery,
      },
    })
  }

  return res.status(200).json({
    success: true,
    data: {
      preparedInlineMessageId: saveResult.preparedInlineMessageId,
      switchInlineQuery,
      switchBackMiniAppUrl,
      command,
      title,
      description,
    },
  } satisfies ApiEnvelope<{
    preparedInlineMessageId: string | null
    switchInlineQuery: string
    switchBackMiniAppUrl: string
    command: string
    title: string
    description: string
  }>)
}
