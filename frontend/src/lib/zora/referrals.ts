import { getAddress, isAddress, type Address } from 'viem'
import { getAppBaseUrl } from '@/lib/host'

const DEFAULT_PLATFORM_REFERRER = '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF'
const DEFAULT_INVITE_URL = 'https://zora.co/invite'

function normalizeHttpsUrl(raw: string | null | undefined): string | null {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return null
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

export function getZoraPlatformReferrerAddress(): Address {
  const env = (import.meta.env.VITE_ZORA_PLATFORM_REFERRER_ADDRESS as string | undefined)?.trim() ?? ''
  if (isAddress(env)) return getAddress(env)
  return getAddress(DEFAULT_PLATFORM_REFERRER)
}

export function getZoraInviteUrl(): string {
  const env = normalizeHttpsUrl((import.meta.env.VITE_ZORA_INVITE_URL as string | undefined) ?? '')
  return env ?? DEFAULT_INVITE_URL
}

type ZoraHandoffContext = 'agent' | 'vault' | 'signup' | 'coin'

export function buildZoraHandoffUrl(params: {
  returnPath: string
  context: ZoraHandoffContext
}): string {
  const base = getZoraInviteUrl()
  const url = new URL(base)
  const appBase = getAppBaseUrl().replace(/\/+$/, '')
  const normalizedPath = params.returnPath.startsWith('/') ? params.returnPath : `/${params.returnPath}`
  const returnUrl = `${appBase}${normalizedPath}`

  if (!url.searchParams.has('return_url')) url.searchParams.set('return_url', returnUrl)
  if (!url.searchParams.has('returnTo')) url.searchParams.set('returnTo', returnUrl)
  if (!url.searchParams.has('utm_source')) url.searchParams.set('utm_source', '4626.fun')
  if (!url.searchParams.has('utm_medium')) url.searchParams.set('utm_medium', 'zora_handoff')
  if (!url.searchParams.has('utm_campaign')) url.searchParams.set('utm_campaign', params.context)

  return url.toString()
}
