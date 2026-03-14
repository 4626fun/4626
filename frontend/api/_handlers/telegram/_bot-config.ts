import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import {
  resolveTelegramBotToken,
  setTelegramChatMenuButton,
  setTelegramMyCommands,
  type TelegramBotCommand,
} from '../../../server/_lib/telegramBotApi.js'

type BotConfigBody = {
  dryRun?: boolean
  menuMode?: 'web_app' | 'commands'
  menuText?: string
  miniAppUrl?: string
  chatId?: string | number
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

function verifyBotConfigSecret(req: VercelRequest): boolean {
  const configured = asTrimmed(process.env.TELEGRAM_BOT_CONFIG_SECRET ?? process.env.TELEGRAM_LINK_API_SECRET)
  if (!configured) return true
  const provided = asTrimmed(req.headers['x-telegram-link-secret'])
  return provided === configured
}

function resolveMiniAppUrl(body: BotConfigBody): string {
  const bodyUrl = asTrimmed(body.miniAppUrl)
  if (bodyUrl && /^https?:\/\//i.test(bodyUrl)) return bodyUrl
  const envUrl = asTrimmed(process.env.TELEGRAM_MINI_APP_URL)
  if (envUrl && /^https?:\/\//i.test(envUrl)) return envUrl
  return 'https://app.4626.fun'
}

function readChatId(body: BotConfigBody): string {
  const value = body.chatId
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value))
  if (typeof value === 'string') return value.trim()
  return ''
}

function privateCommands(): TelegramBotCommand[] {
  return [
    { command: 'help', description: 'Open minimal command menu' },
    { command: 'link', description: 'Link Telegram to your 4626 wallet' },
    { command: 'linked', description: 'Check link and wallet status' },
    { command: 'zora', description: 'Open Zora signup/linking flow' },
    { command: 'deploy', description: 'Guided trend/content/creator deploy' },
    { command: 'portfolio', description: 'View positions and recent actions' },
    { command: 'buy', description: 'Preview buy in 4626 vault scope' },
    { command: 'sell', description: 'Preview sell in 4626 vault scope' },
    { command: 'bid', description: 'Preview USD bid for CCA auction' },
  ]
}

function groupCommands(): TelegramBotCommand[] {
  return [
    { command: 'help', description: 'Open command menu' },
    { command: 'zora', description: 'Open Zora signup/linking flow' },
    { command: 'deploy', description: 'Guided trend/content/creator deploy' },
    { command: 'vaults', description: 'List scoped vaults in this chat' },
    { command: 'auctions', description: 'List active CCA auctions' },
    { command: 'signals', description: 'Recent trade signals in this chat' },
    { command: 'buy', description: 'Preview buy for scoped vault' },
    { command: 'sell', description: 'Preview sell for scoped vault' },
    { command: 'bid', description: 'Preview bid for scoped auction' },
  ]
}

function adminCommands(): TelegramBotCommand[] {
  return [
    { command: 'help', description: 'Open command menu' },
    { command: 'zora', description: 'Open Zora signup/linking flow' },
    { command: 'deploy', description: 'Guided trend/content/creator deploy' },
    { command: 'inline', description: 'Open one-tap command templates' },
    { command: 'x', description: 'Draft X post (confirm required)' },
    { command: 'portfolio', description: 'View linked account activity' },
  ]
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
  const botToken = resolveTelegramBotToken()
  if (!botToken) {
    return res.status(503).json({ success: false, error: 'Telegram bot token missing' } satisfies ApiEnvelope<never>)
  }

  const dryRun = parseBoolean(body.dryRun, false)
  const menuMode = asTrimmed(body.menuMode || process.env.TELEGRAM_MENU_BUTTON_MODE || 'web_app').toLowerCase() === 'commands'
    ? 'commands'
    : 'web_app'
  const menuText = asTrimmed(body.menuText || process.env.TELEGRAM_MENU_BUTTON_TEXT || '4626 Mini App') || '4626 Mini App'
  const miniAppUrl = resolveMiniAppUrl(body)
  const chatId = readChatId(body)

  const scopes = [
    { scope: { type: 'all_private_chats' }, commands: privateCommands() },
    { scope: { type: 'all_group_chats' }, commands: groupCommands() },
    { scope: { type: 'all_chat_administrators' }, commands: adminCommands() },
  ] as const

  if (!dryRun) {
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
      chatId: chatId || null,
    },
  } satisfies ApiEnvelope<{
    dryRun: boolean
    scopesApplied: number
    menuMode: 'web_app' | 'commands'
    menuText: string
    miniAppUrl: string
    chatId: string | null
  }>)
}
