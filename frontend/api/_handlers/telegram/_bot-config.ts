import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import {
  resolveTelegramBotToken,
  setTelegramWebhook,
  setTelegramChatMenuButton,
  setTelegramMyCommands,
} from '../../../server/_lib/telegramBotApi.js'
import { getTelegramWebhookConfig } from './webhook/config.js'
import {
  TELEGRAM_ADMIN_BOT_COMMANDS,
  TELEGRAM_GROUP_BOT_COMMANDS,
  TELEGRAM_PRIVATE_BOT_COMMANDS,
} from './webhook/constants.js'
import { buildTelegramMiniAppUrl } from './webhook/miniApp.js'
import { verifyBotConfigSecret } from './webhook/services/access.js'
import { asTrimmed } from './webhook/utils.js'

type BotConfigBody = {
  dryRun?: boolean
  menuMode?: 'web_app' | 'commands'
  menuText?: string
  miniAppUrl?: string
  webhookUrl?: string
  chatId?: string | number
  dropPendingUpdates?: boolean
}

function resolveMiniAppUrl(body: BotConfigBody, configured: string): string {
  const bodyUrl = asTrimmed(body.miniAppUrl)
  const baseUrl = bodyUrl && /^https?:\/\//i.test(bodyUrl)
    ? bodyUrl
    : configured && /^https?:\/\//i.test(configured)
      ? configured
      : 'https://v1.4626.fun'
  return buildTelegramMiniAppUrl({
    baseUrl,
    pathname: '/telegram/menu',
  })
}

function readChatId(body: BotConfigBody): string {
  const value = body.chatId
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value))
  if (typeof value === 'string') return value.trim()
  return ''
}

function resolveWebhookUrl(req: VercelRequest, body: BotConfigBody, configured: string): string {
  const explicitUrl = asTrimmed(body.webhookUrl)
  if (explicitUrl && /^https?:\/\//i.test(explicitUrl)) return explicitUrl
  if (configured && /^https?:\/\//i.test(configured)) return configured

  const host = asTrimmed(req.headers['x-forwarded-host'] || req.headers.host || '')
  if (!host) return ''
  const proto = asTrimmed(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'http' ? 'http' : 'https'
  return `${proto}://${host}/api/telegram/webhook`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  if (!verifyBotConfigSecret(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<BotConfigBody>(req).catch(() => null)) ?? (req.body as BotConfigBody | null) ?? {}
  const config = getTelegramWebhookConfig()
  const botToken = resolveTelegramBotToken()
  if (!botToken) {
    return res.status(503).json({ success: false, error: 'Telegram bot token missing' } satisfies ApiEnvelope<never>)
  }

  const dryRun = body.dryRun === true
  const menuMode = asTrimmed(body.menuMode || config.menuButtonMode || 'web_app').toLowerCase() === 'commands'
    ? 'commands'
    : 'web_app'
  const menuText = asTrimmed(body.menuText || config.menuButtonText || 'Link 4626') || 'Link 4626'
  const miniAppUrl = resolveMiniAppUrl(body, config.miniAppUrl)
  const webhookUrl = resolveWebhookUrl(req, body, config.webhookUrl)
  const chatId = readChatId(body)

  const scopes = [
    { scope: { type: 'all_private_chats' as const }, commands: TELEGRAM_PRIVATE_BOT_COMMANDS },
    { scope: { type: 'all_group_chats' as const }, commands: TELEGRAM_GROUP_BOT_COMMANDS },
    { scope: { type: 'all_chat_administrators' as const }, commands: TELEGRAM_ADMIN_BOT_COMMANDS },
  ] as const

  if (!dryRun) {
    if (webhookUrl) {
      await setTelegramWebhook({
        botToken,
        url: webhookUrl,
        secretToken: config.webhookSecret,
        dropPendingUpdates: body.dropPendingUpdates === true,
        allowedUpdates: ['message', 'callback_query', 'inline_query', 'chosen_inline_result', 'pre_checkout_query'],
      })
    }
    for (const row of scopes) {
      await setTelegramMyCommands({
        botToken,
        commands: row.commands,
        scope: row.scope,
      })
    }
    await setTelegramChatMenuButton({
      botToken,
      chatId: chatId || undefined,
      menuButton:
        menuMode === 'commands'
          ? { type: 'commands' }
          : {
              type: 'web_app',
              text: menuText,
              web_app: { url: miniAppUrl },
            },
    })
  }

  return res.status(200).json({
    success: true,
    data: {
      dryRun,
      scopesApplied: scopes.length,
      menuMode,
      menuText,
      miniAppUrl,
      webhookUrl: webhookUrl || null,
      chatId: chatId || null,
    },
  } satisfies ApiEnvelope<{
    dryRun: boolean
    scopesApplied: number
    menuMode: 'web_app' | 'commands'
    menuText: string
    miniAppUrl: string
    webhookUrl: string | null
    chatId: string | null
  }>)
}
