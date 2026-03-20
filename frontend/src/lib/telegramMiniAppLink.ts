const TELEGRAM_LINK_ENTRY = 'link'
const TELEGRAM_LINK_QUERY_KEYS = [
  'tgMiniApp',
  'tgEntry',
  'chatAction',
  'tgChatId',
  'tgLinkToken',
  'tgUsername',
  'tgZoraBranch',
  'tgCswIntent',
] as const

const TELEGRAM_LINK_CONTEXT_STORAGE_KEY = 'cv_tg_link_context_v1'
const TELEGRAM_LINK_CONTEXT_MAX_AGE_MS = 30 * 60_000

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

export function persistTelegramMiniAppLinkContext(context: TelegramMiniAppLinkContext | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!context || !normalize(context.linkToken)) {
      window.sessionStorage.removeItem(TELEGRAM_LINK_CONTEXT_STORAGE_KEY)
      return
    }
    window.sessionStorage.setItem(
      TELEGRAM_LINK_CONTEXT_STORAGE_KEY,
      JSON.stringify({
        linkToken: context.linkToken,
        chatId: context.chatId,
        telegramUsername: context.telegramUsername,
        savedAtMs: Date.now(),
      }),
    )
  } catch {
    // Ignore storage failures in restrictive contexts.
  }
}

export function readStoredTelegramMiniAppLinkContext(): TelegramMiniAppLinkContext | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(TELEGRAM_LINK_CONTEXT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      linkToken?: unknown
      chatId?: unknown
      telegramUsername?: unknown
      savedAtMs?: unknown
    }
    const linkToken = normalize(typeof parsed.linkToken === 'string' ? parsed.linkToken : null)
    if (!linkToken) return null
    const savedAtMs = Number(parsed.savedAtMs ?? NaN)
    if (!Number.isFinite(savedAtMs) || Date.now() - savedAtMs > TELEGRAM_LINK_CONTEXT_MAX_AGE_MS) {
      window.sessionStorage.removeItem(TELEGRAM_LINK_CONTEXT_STORAGE_KEY)
      return null
    }
    const chatId = normalize(typeof parsed.chatId === 'string' ? parsed.chatId : null) || null
    const telegramUsername = normalize(typeof parsed.telegramUsername === 'string' ? parsed.telegramUsername : null) || null
    return { linkToken, chatId, telegramUsername }
  } catch {
    return null
  }
}

export function clearStoredTelegramMiniAppLinkContext(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(TELEGRAM_LINK_CONTEXT_STORAGE_KEY)
  } catch {
    // Ignore storage failures.
  }
}

export function resolveTelegramMiniAppLinkContext(searchParams: URLSearchParams): TelegramMiniAppLinkContext | null {
  const fromQuery = readTelegramMiniAppLinkContext(searchParams)
  if (fromQuery) {
    persistTelegramMiniAppLinkContext(fromQuery)
    return fromQuery
  }
  return readStoredTelegramMiniAppLinkContext()
}

export function stripTelegramMiniAppLinkParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams)
  for (const key of TELEGRAM_LINK_QUERY_KEYS) {
    next.delete(key)
  }
  return next
}

