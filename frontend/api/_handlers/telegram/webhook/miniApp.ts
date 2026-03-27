import { getTelegramWebhookConfig } from './config.js'
import { asTrimmed } from './utils.js'

export const TELEGRAM_MINI_APP_LINK_PATH = '/telegram/link'
export const TELEGRAM_MINI_APP_ORIGIN = 'https://4626.fun'

function isPrivateChatId(chatId: string): boolean {
  return !chatId.startsWith('-')
}

export function normalizeTelegramMiniAppBaseUrl(value: string): string {
  const trimmed = asTrimmed(value)
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return ''
  try {
    const url = new URL(trimmed)
    if (/^v\d+\.4626\.fun$/i.test(url.hostname)) {
      url.hostname = '4626.fun'
    }
    return url.origin
  } catch {
    return ''
  }
}

export function resolveTelegramMiniAppUrl(): string {
  const configured = normalizeTelegramMiniAppBaseUrl(getTelegramWebhookConfig().miniAppUrl)
  if (configured) return configured
  return TELEGRAM_MINI_APP_ORIGIN
}

export function buildTelegramMiniAppUrl(params: {
  baseUrl: string
  pathname?: string
  query?: Record<string, string>
}): string {
  try {
    const url = new URL(params.baseUrl)
    if (params.pathname) {
      url.pathname = params.pathname
    }
    const query = params.query ?? {}
    for (const [key, value] of Object.entries(query)) {
      if (!asTrimmed(value)) continue
      url.searchParams.set(key, value)
    }
    return url.toString()
  } catch {
    return params.baseUrl
  }
}

export function buildMiniAppLaunchButton(params: {
  chatId: string
  text: string
  url: string
}): Record<string, unknown> {
  if (isPrivateChatId(params.chatId)) {
    return { text: params.text, web_app: { url: params.url } }
  }
  return { text: params.text, url: params.url }
}
