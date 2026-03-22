import { apiFetch, type ApiFetchInit } from './apiBase'

type TelegramThemeParams = Record<string, string | undefined>

type TelegramSafeAreaInset = {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

export type TelegramInlineQueryChatType = 'users' | 'bots' | 'groups' | 'channels'

type TelegramWebAppLike = {
  initData?: string
  colorScheme?: 'light' | 'dark' | string
  viewportHeight?: number
  viewportStableHeight?: number
  themeParams?: TelegramThemeParams
  safeAreaInset?: TelegramSafeAreaInset
  contentSafeAreaInset?: TelegramSafeAreaInset
  ready?: () => void
  expand?: () => void
  switchInlineQuery?: (query: string, chooseChatTypes?: TelegramInlineQueryChatType[]) => void
  onEvent?: (eventType: string, eventHandler: () => void) => void
  offEvent?: (eventType: string, eventHandler: () => void) => void
}

type TelegramNamespace = {
  WebApp?: TelegramWebAppLike
}

declare global {
  interface Window {
    Telegram?: TelegramNamespace
  }
}

type MiniAppSessionEnvelope = {
  success: boolean
  data?: {
    sessionToken: string
    expiresAt: string
    telegramUserId: string
    telegramUsername: string | null
    chatId: string | null
    chatType: string | null
    chatInstance: string | null
  }
  error?: string
}

export type TelegramMiniAppSession = {
  initData: string
  sessionToken: string
  expiresAt: string
  telegramUserId: string
  telegramUsername: string | null
  chatId: string | null
  chatType: string | null
  chatInstance: string | null
}

const TELEGRAM_WEB_APP_SCRIPT_URL = 'https://telegram.org/js/telegram-web-app.js?61'
const TELEGRAM_SESSION_STORAGE_KEY = 'cv_tg_miniapp_session_v1'
const TELEGRAM_SESSION_REQUEST_TIMEOUT_MS = 12_000
let telegramScriptLoadPromise: Promise<void> | null = null
let memoizedMiniAppSession: TelegramMiniAppSession | null = null
let inFlightMiniAppSessionInitData = ''
let inFlightMiniAppSessionPromise: Promise<EnsureTelegramMiniAppSessionResult> | null = null

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readTelegramWebAppUnsafe(): TelegramWebAppLike | null {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

function isTimestampFresh(isoString: string): boolean {
  const parsed = Date.parse(isoString)
  if (!Number.isFinite(parsed)) return false
  // Keep 10s buffer to avoid racing expiring tokens.
  return parsed > Date.now() + 10_000
}

function readStoredSession(): TelegramMiniAppSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(TELEGRAM_SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TelegramMiniAppSession>
    const session: TelegramMiniAppSession = {
      initData: asTrimmed(parsed.initData ?? ''),
      sessionToken: asTrimmed(parsed.sessionToken ?? ''),
      expiresAt: asTrimmed(parsed.expiresAt ?? ''),
      telegramUserId: asTrimmed(parsed.telegramUserId ?? ''),
      telegramUsername: asTrimmed(parsed.telegramUsername ?? '') || null,
      chatId: asTrimmed(parsed.chatId ?? '') || null,
      chatType: asTrimmed(parsed.chatType ?? '') || null,
      chatInstance: asTrimmed(parsed.chatInstance ?? '') || null,
    }
    if (!session.initData || !session.sessionToken || !isTimestampFresh(session.expiresAt)) return null
    return session
  } catch {
    return null
  }
}

function storeSession(session: TelegramMiniAppSession): void {
  memoizedMiniAppSession = session
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(TELEGRAM_SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Ignore storage failures in strict browser contexts.
  }
}

function clearStoredSession(): void {
  memoizedMiniAppSession = null
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(TELEGRAM_SESSION_STORAGE_KEY)
  } catch {
    // Ignore storage failures.
  }
}

function resolveCachedMiniAppSession(initData: string): TelegramMiniAppSession | null {
  const cached = memoizedMiniAppSession ?? readStoredSession()
  if (!cached) return null
  if (cached.initData !== initData) return null
  if (!isTimestampFresh(cached.expiresAt)) return null
  memoizedMiniAppSession = cached
  return cached
}

function setCssVar(name: string, value: string): void {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty(name, value)
}

function toPx(value: unknown): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0px'
  return `${Math.max(0, Math.round(num))}px`
}

function applyTelegramWebAppCssVars(webApp: TelegramWebAppLike | null): void {
  if (!webApp || typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.tgColorScheme = asTrimmed(webApp.colorScheme ?? '') || root.dataset.tgColorScheme || ''

  setCssVar('--cv-tg-viewport-height', toPx(webApp.viewportHeight))
  setCssVar('--cv-tg-viewport-stable-height', toPx(webApp.viewportStableHeight))

  setCssVar('--cv-tg-safe-top', toPx(webApp.safeAreaInset?.top))
  setCssVar('--cv-tg-safe-bottom', toPx(webApp.safeAreaInset?.bottom))
  setCssVar('--cv-tg-safe-left', toPx(webApp.safeAreaInset?.left))
  setCssVar('--cv-tg-safe-right', toPx(webApp.safeAreaInset?.right))

  setCssVar('--cv-tg-content-safe-top', toPx(webApp.contentSafeAreaInset?.top))
  setCssVar('--cv-tg-content-safe-bottom', toPx(webApp.contentSafeAreaInset?.bottom))
  setCssVar('--cv-tg-content-safe-left', toPx(webApp.contentSafeAreaInset?.left))
  setCssVar('--cv-tg-content-safe-right', toPx(webApp.contentSafeAreaInset?.right))
}

export function readTelegramWebApp(): TelegramWebAppLike | null {
  return readTelegramWebAppUnsafe()
}

export function switchTelegramMiniAppInlineQuery(params?: {
  query?: string
  chatTypes?: TelegramInlineQueryChatType[]
}): boolean {
  const webApp = readTelegramWebAppUnsafe()
  if (!webApp?.switchInlineQuery) return false
  try {
    webApp.switchInlineQuery(asTrimmed(params?.query ?? ''), params?.chatTypes ?? [])
    return true
  } catch {
    return false
  }
}

export function readTelegramMiniAppInitData(): string {
  return asTrimmed(readTelegramWebAppUnsafe()?.initData ?? '')
}

export function isTelegramMiniAppContext(): boolean {
  return readTelegramMiniAppInitData().length > 0
}

export function hasTelegramMiniAppEntrypointContext(): boolean {
  if (isTelegramMiniAppContext()) return true
  return Boolean(readStoredSession())
}

function hashString(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return `tg-${Math.abs(hash)}`
}

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') ||
    ((error as { name?: unknown } | null)?.name === 'AbortError')
  )
}

export function readTelegramMiniAppIdentityKey(): string {
  const initData = readTelegramMiniAppInitData()
  if (!initData) return ''
  return hashString(initData)
}

export type PrivyTelegramLaunchParams = {
  initDataRaw?: string
}

export function readPrivyTelegramLaunchParams(): PrivyTelegramLaunchParams | null {
  const initDataRaw = readTelegramMiniAppInitData()
  if (!initDataRaw) return null
  return { initDataRaw }
}

export async function loadTelegramWebApp(): Promise<TelegramWebAppLike | null> {
  const existing = readTelegramWebAppUnsafe()
  if (existing) return existing
  if (typeof window === 'undefined' || typeof document === 'undefined') return null
  if (!telegramScriptLoadPromise) {
    telegramScriptLoadPromise = new Promise<void>((resolve, reject) => {
      const found = Array.from(document.getElementsByTagName('script')).find((script) =>
        String(script.src || '').includes('telegram-web-app.js'),
      )
      if (found) {
        found.addEventListener('load', () => resolve(), { once: true })
        found.addEventListener('error', () => reject(new Error('telegram_script_load_failed')), { once: true })
        // Also resolve shortly in case the script already loaded before listeners attached.
        window.setTimeout(() => resolve(), 0)
        return
      }
      const script = document.createElement('script')
      script.async = true
      script.src = TELEGRAM_WEB_APP_SCRIPT_URL
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('telegram_script_load_failed'))
      document.head.appendChild(script)
    }).catch(() => {})
  }
  await telegramScriptLoadPromise
  return readTelegramWebAppUnsafe()
}

export function setupTelegramMiniAppUi(params?: { requestExpand?: boolean }): () => void {
  const webApp = readTelegramWebAppUnsafe()
  if (!webApp) return () => {}

  try {
    webApp.ready?.()
  } catch {
    // Ignore SDK errors.
  }
  if (params?.requestExpand) {
    try {
      webApp.expand?.()
    } catch {
      // Ignore SDK errors.
    }
  }

  const sync = () => applyTelegramWebAppCssVars(webApp)
  sync()
  const events = ['themeChanged', 'viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged']
  for (const eventName of events) {
    try {
      webApp.onEvent?.(eventName, sync)
    } catch {
      // Ignore listener registration errors.
    }
  }
  return () => {
    for (const eventName of events) {
      try {
        webApp.offEvent?.(eventName, sync)
      } catch {
        // Ignore listener cleanup errors.
      }
    }
  }
}

type EnsureTelegramMiniAppSessionResult =
  | { ok: true; session: TelegramMiniAppSession }
  | { ok: false; error: string; statusCode: number }

export async function ensureTelegramMiniAppSession(params?: {
  fetcher?: (path: string, init?: ApiFetchInit) => Promise<Response>
  timeoutMs?: number
}): Promise<EnsureTelegramMiniAppSessionResult> {
  const webApp = await loadTelegramWebApp()
  const initData = asTrimmed(webApp?.initData ?? '')
  if (!initData) {
    clearStoredSession()
    return {
      ok: false,
      error: 'Telegram Mini App session unavailable. Open this flow from Telegram.',
      statusCode: 400,
    }
  }

  const cached = resolveCachedMiniAppSession(initData)
  if (cached) {
    return { ok: true, session: cached }
  }

  if (inFlightMiniAppSessionPromise && inFlightMiniAppSessionInitData === initData) {
    return inFlightMiniAppSessionPromise
  }

  const fetcher = params?.fetcher ?? apiFetch
  const timeoutMs = Math.max(1_000, Math.floor(params?.timeoutMs ?? TELEGRAM_SESSION_REQUEST_TIMEOUT_MS))
  const requestPromise = (async (): Promise<EnsureTelegramMiniAppSessionResult> => {
    const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timeoutId =
      abortController !== null
        ? globalThis.setTimeout(() => {
            abortController.abort()
          }, timeoutMs)
        : null
    let response: Response
    try {
      response = await fetcher('/api/telegram/miniapp/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ initData }),
        ...(abortController ? { signal: abortController.signal } : null),
      })
    } catch (error) {
      clearStoredSession()
      return {
        ok: false,
        error: isAbortError(error) ? 'telegram_miniapp_session_timeout' : 'telegram_miniapp_session_unreachable',
        statusCode: isAbortError(error) ? 504 : 503,
      }
    } finally {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId)
      }
    }
    const json = (await response.json().catch(() => null)) as MiniAppSessionEnvelope | null
    if (!response.ok || !json?.success || !json.data) {
      return {
        ok: false,
        error: asTrimmed(json?.error ?? '') || 'telegram_miniapp_session_failed',
        statusCode: response.status || 500,
      }
    }

    const session: TelegramMiniAppSession = {
      initData,
      sessionToken: asTrimmed(json.data.sessionToken),
      expiresAt: asTrimmed(json.data.expiresAt),
      telegramUserId: asTrimmed(json.data.telegramUserId),
      telegramUsername: asTrimmed(json.data.telegramUsername ?? '') || null,
      chatId: asTrimmed(json.data.chatId ?? '') || null,
      chatType: asTrimmed(json.data.chatType ?? '') || null,
      chatInstance: asTrimmed(json.data.chatInstance ?? '') || null,
    }
    if (!session.sessionToken || !session.telegramUserId || !isTimestampFresh(session.expiresAt)) {
      clearStoredSession()
      return {
        ok: false,
        error: 'telegram_miniapp_session_invalid_response',
        statusCode: 500,
      }
    }

    storeSession(session)
    return { ok: true, session }
  })()

  const wrappedPromise = requestPromise.finally(() => {
    if (inFlightMiniAppSessionPromise === wrappedPromise) {
      inFlightMiniAppSessionPromise = null
      inFlightMiniAppSessionInitData = ''
    }
  })
  inFlightMiniAppSessionInitData = initData
  inFlightMiniAppSessionPromise = wrappedPromise
  return wrappedPromise
}
