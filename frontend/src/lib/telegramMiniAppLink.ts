const TELEGRAM_LINK_ENTRY = 'link'
const TELEGRAM_LINK_QUERY_KEYS = [
  'tgMiniApp',
  'tgEntry',
  'chatAction',
  'tgChatId',
  'tgLinkToken',
  'tgUsername',
] as const

export type TelegramMiniAppLinkContext = {
  linkToken: string
  chatId: string | null
  telegramUsername: string | null
}

function normalize(value: string | null): string {
  return String(value ?? '').trim()
}

export function readTelegramMiniAppLinkContext(searchParams: URLSearchParams): TelegramMiniAppLinkContext | null {
  const entry = normalize(searchParams.get('tgEntry')).toLowerCase()
  if (entry !== TELEGRAM_LINK_ENTRY) return null
  const linkToken = normalize(searchParams.get('tgLinkToken'))
  if (!linkToken) return null

  const chatId = normalize(searchParams.get('tgChatId'))
  const telegramUsername = normalize(searchParams.get('tgUsername'))
  return {
    linkToken,
    chatId: chatId || null,
    telegramUsername: telegramUsername || null,
  }
}

export function stripTelegramMiniAppLinkParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams)
  for (const key of TELEGRAM_LINK_QUERY_KEYS) {
    next.delete(key)
  }
  return next
}

