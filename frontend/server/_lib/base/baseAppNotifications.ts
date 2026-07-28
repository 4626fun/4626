/**
 * Base Dashboard Notifications API (server-only).
 *
 * Env (never VITE_*):
 * - BASE_APP_API_KEY — Settings → API Key on the app.4626.fun Base Build project
 * - BASE_APP_NOTIFICATIONS_APP_URL — optional; default https://app.4626.fun
 *
 * Used by AMOE daily quest reminders:
 * `/api/v1/lottery/amoe/daily-quest-reminder-cron`
 */

/**
 * Base Dashboard Notifications API client.
 *
 * Docs: https://docs.base.org/apps/technical-guides/base-notifications
 *
 * Server-only. Requires `BASE_APP_API_KEY` (never `VITE_*`).
 * Registered App URL for 4626 is `https://app.4626.fun`.
 */

export const BASE_APP_NOTIFICATIONS_URL = 'https://app.4626.fun'
export const BASE_APP_NOTIFICATIONS_API_BASE = 'https://dashboard.base.org/api/v1/notifications'

export type BaseAppNotificationUser = {
  address: `0x${string}`
  notificationsEnabled: boolean
}

export type BaseAppSendResult = {
  success: boolean
  sentCount: number
  failedCount: number
  results: Array<{
    walletAddress: string
    sent: boolean
    failureReason?: string
  }>
}

function readApiKey(env: Record<string, string | undefined> = process.env): string {
  const primary = (env.BASE_APP_API_KEY ?? '').trim()
  if (primary) return primary
  // Accept the lowercase local name some operators used when pasting the key.
  return (env.base_app_api_key ?? '').trim()
}

export function isBaseAppNotificationsConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return readApiKey(env).length > 0
}

export function resolveBaseAppNotificationsAppUrl(env: Record<string, string | undefined> = process.env): string {
  const configured = (env.BASE_APP_NOTIFICATIONS_APP_URL ?? '').trim()
  if (configured) return configured.replace(/\/+$/, '')
  return BASE_APP_NOTIFICATIONS_URL
}

async function baseNotificationsFetch<T>(params: {
  path: string
  method: 'GET' | 'POST'
  body?: unknown
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
}): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const env = params.env ?? process.env
  const apiKey = readApiKey(env)
  if (!apiKey) {
    return { ok: false, status: 503, error: 'BASE_APP_API_KEY is not configured' }
  }

  const fetchImpl = params.fetchImpl ?? fetch
  const response = await fetchImpl(`${BASE_APP_NOTIFICATIONS_API_BASE}${params.path}`, {
    method: params.method,
    headers: {
      'x-api-key': apiKey,
      ...(params.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
  })

  const text = await response.text()
  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = null
  }

  if (!response.ok) {
    const error =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error?: unknown }).error ?? text).slice(0, 256)
        : text.slice(0, 256) || `http_${response.status}`
    return { ok: false, status: response.status, error }
  }

  return { ok: true, data: parsed as T }
}

function normalizeAddress(value: string): `0x${string}` | null {
  const trimmed = value.trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return null
  return trimmed.toLowerCase() as `0x${string}`
}

export async function listBaseAppNotificationUsers(params: {
  notificationEnabled?: boolean
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
  limitPerPage?: number
  maxPages?: number
}): Promise<
  | { ok: true; users: BaseAppNotificationUser[] }
  | { ok: false; status: number; error: string }
> {
  const appUrl = resolveBaseAppNotificationsAppUrl(params.env)
  const users: BaseAppNotificationUser[] = []
  let cursor: string | undefined
  const limit = Math.min(500, Math.max(1, params.limitPerPage ?? 500))
  const maxPages = Math.min(50, Math.max(1, params.maxPages ?? 20))

  for (let page = 0; page < maxPages; page += 1) {
    const search = new URLSearchParams({
      app_url: appUrl,
      limit: String(limit),
    })
    if (params.notificationEnabled === true) {
      search.set('notification_enabled', 'true')
    }
    if (cursor) search.set('cursor', cursor)

    const result = await baseNotificationsFetch<{
      success?: boolean
      users?: Array<{ address?: string; notificationsEnabled?: boolean }>
      nextCursor?: string
    }>({
      path: `/app/users?${search.toString()}`,
      method: 'GET',
      env: params.env,
      fetchImpl: params.fetchImpl,
    })

    if (!result.ok) return result

    for (const row of result.data.users ?? []) {
      const address = normalizeAddress(String(row.address ?? ''))
      if (!address) continue
      users.push({
        address,
        notificationsEnabled: row.notificationsEnabled === true,
      })
    }

    const next = typeof result.data.nextCursor === 'string' ? result.data.nextCursor.trim() : ''
    if (!next) break
    cursor = next
  }

  return { ok: true, users }
}

export async function sendBaseAppNotifications(params: {
  walletAddresses: string[]
  title: string
  message: string
  targetPath?: string
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
}): Promise<{ ok: true; data: BaseAppSendResult } | { ok: false; status: number; error: string }> {
  const title = params.title.trim()
  const message = params.message.trim()
  if (!title || title.length > 30) {
    return { ok: false, status: 400, error: 'title must be 1-30 characters' }
  }
  if (!message || message.length > 200) {
    return { ok: false, status: 400, error: 'message must be 1-200 characters' }
  }

  const wallets = Array.from(
    new Set(
      params.walletAddresses
        .map((value) => normalizeAddress(value))
        .filter((value): value is `0x${string}` => Boolean(value)),
    ),
  )
  if (wallets.length === 0) {
    return { ok: false, status: 400, error: 'wallet_addresses required' }
  }
  if (wallets.length > 1000) {
    return { ok: false, status: 400, error: 'wallet_addresses exceeds 1000' }
  }

  const targetPath = params.targetPath?.trim()
  if (targetPath && (!targetPath.startsWith('/') || targetPath.length > 500)) {
    return { ok: false, status: 400, error: 'target_path must start with / and be <= 500 chars' }
  }

  const result = await baseNotificationsFetch<BaseAppSendResult>({
    path: '/send',
    method: 'POST',
    body: {
      app_url: resolveBaseAppNotificationsAppUrl(params.env),
      wallet_addresses: wallets,
      title,
      message,
      ...(targetPath ? { target_path: targetPath } : {}),
    },
    env: params.env,
    fetchImpl: params.fetchImpl,
  })

  if (!result.ok) return result
  return {
    ok: true,
    data: {
      success: result.data.success === true,
      sentCount: Number(result.data.sentCount ?? 0),
      failedCount: Number(result.data.failedCount ?? 0),
      results: Array.isArray(result.data.results) ? result.data.results : [],
    },
  }
}
