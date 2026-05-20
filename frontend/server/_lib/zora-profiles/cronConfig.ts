// SPDX-License-Identifier: MIT
//
// Env helpers for the Zora profiles refresh cron (Looker / outreach cache).

declare const process: { env: Record<string, string | undefined> }

export const ZORA_PROFILES_TABLE = 'zora_profiles'
export const ZORA_PROFILES_REFRESH_STATE_TABLE = 'zora_profiles_refresh_state'
export const LAST_REFRESH_TICK_KEY = 'last_tick'

/**
 * Master kill-switch. Default off until enabled on Vercel.
 * Set `ZORA_PROFILES_REFRESH_ENABLED=1` to run the scheduled cron.
 */
export function isZoraProfilesRefreshEnabled(): boolean {
  return String(process.env.ZORA_PROFILES_REFRESH_ENABLED ?? '').trim() === '1'
}

export function readProfileRefreshTargetCount(): number {
  const raw = String(process.env.PROFILE_REFRESH_TARGET_COUNT ?? '').trim()
  if (!raw) return 250
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 250
  return Math.min(Math.floor(n), 2000)
}

export function readProfileRefreshPageSize(): number {
  const raw = String(process.env.PROFILE_REFRESH_PAGE_SIZE ?? '').trim()
  if (!raw) return 50
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 50
  return Math.min(Math.floor(n), 100)
}

export function readProfileRefreshRequestIntervalMs(): number {
  const raw = String(process.env.PROFILE_REFRESH_INTERVAL_MS ?? '').trim()
  if (!raw) return 0
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

export function readProfileRefreshWalletBudget(): number {
  const raw = String(process.env.PROFILE_REFRESH_WALLET_BUDGET ?? '').trim()
  if (!raw) return 25
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 25
  return Math.min(Math.floor(n), 500)
}

export function readProfileRefreshWalletConcurrency(): number {
  const raw = String(process.env.PROFILE_REFRESH_WALLET_CONCURRENCY ?? '').trim()
  if (!raw) return 6
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 6
  return Math.min(Math.floor(n), 20)
}

export function readProfileRefreshListType(): string {
  return String(process.env.PROFILE_REFRESH_LIST_TYPE ?? 'most_valuable_creators').trim() || 'most_valuable_creators'
}

export function resolveZoraServerApiKey(): string | null {
  const server = String(process.env.ZORA_SERVER_API_KEY ?? '').trim()
  if (server) return server
  const publicKey = String(process.env.VITE_ZORA_PUBLIC_API_KEY ?? '').trim()
  return publicKey || null
}
