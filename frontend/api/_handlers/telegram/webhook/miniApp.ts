import { isPrivateChatId } from './env.js'
import { asTrimmed } from './utils.js'

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

export function buildTelegramLinkSwapNextPath(params: {
  token: string
  chatId: string
  telegramUsername?: string | null
}): string {
  const query = new URLSearchParams({
    tgMiniApp: '1',
    tgEntry: 'link',
    chatAction: 'link-account',
    tgChatId: params.chatId,
    tgLinkToken: params.token,
  })
  const username = asTrimmed(params.telegramUsername ?? '')
  if (username) {
    query.set('tgUsername', username)
  }
  return `/swap?${query.toString()}`
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
