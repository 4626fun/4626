import { CANONICAL_SWAP_ROUTE } from '@/lib/routes/canonicalRoutes'

export const APP_ENTRY_DEFAULT_NEXT = CANONICAL_SWAP_ROUTE

export function readSafeNextPath(value: string | null | undefined): string {
  const raw = String(value ?? '').trim()
  if (!raw.startsWith('/')) return APP_ENTRY_DEFAULT_NEXT
  if (raw.startsWith('//')) return APP_ENTRY_DEFAULT_NEXT
  return raw
}

export function buildAppEntryPath(next: string = APP_ENTRY_DEFAULT_NEXT): string {
  const safeNext = readSafeNextPath(next)
  const params = new URLSearchParams({
    from: 'waitlist',
    autologin: '1',
    next: safeNext,
  })
  return `/continue?${params.toString()}`
}

export function buildAppEntryUrl(baseUrl: string, next: string = APP_ENTRY_DEFAULT_NEXT): string {
  const base = String(baseUrl ?? '').replace(/\/+$/, '')
  return `${base}${buildAppEntryPath(next)}`
}
