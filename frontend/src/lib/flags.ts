export function isPublicSiteMode(): boolean {
  const v = String(import.meta.env.VITE_PUBLIC_SITE_MODE ?? '')
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

const DEFAULT_PRIVY_APP_ID = 'cmk411efm034jl50cs618o8cy'
const DEFAULT_PRIVY_ALLOWED_ORIGINS = new Set<string>([
  'https://4626.fun',
  'https://v1.4626.fun',
  'http://localhost:5173',
  'http://localhost:5174',
])

function isTruthyEnv(v: unknown): boolean {
  const s = String(v ?? '')
    .trim()
    .toLowerCase()
  return s === '1' || s === 'true' || s === 'yes'
}

function normalizeOrigin(raw: string): string {
  const input = String(raw ?? '').trim()
  if (!input) return ''
  try {
    return new URL(input).origin.toLowerCase()
  } catch {
    return ''
  }
}

function getCurrentOrigin(): string | null {
  if (typeof window === 'undefined') return null
  return normalizeOrigin(window.location.origin)
}

function getPrivyAllowedOrigins(): Set<string> {
  const raw = String(import.meta.env.VITE_PRIVY_ALLOWED_ORIGINS ?? '').trim()
  if (!raw) return new Set(DEFAULT_PRIVY_ALLOWED_ORIGINS)
  const list = raw
    .split(/[\s,]+/g)
    .map((v) => normalizeOrigin(v))
    .filter(Boolean)
  return new Set(list.length > 0 ? list : Array.from(DEFAULT_PRIVY_ALLOWED_ORIGINS))
}

function isPrivyOriginAllowed(): boolean {
  const origin = getCurrentOrigin()
  if (!origin) return true
  return getPrivyAllowedOrigins().has(origin)
}

export function getPrivyAppId(): string | null {
  const appId = String(import.meta.env.VITE_PRIVY_APP_ID ?? '').trim()
  if (appId.length > 0) return appId
  return DEFAULT_PRIVY_APP_ID
}

export function isPrivyClientEnabled(): boolean {
  // Explicit enable flag (so Privy can't break production unexpectedly).
  if (!isTruthyEnv(import.meta.env.VITE_PRIVY_ENABLED)) return false
  if (!getPrivyAppId()) return false
  if (!isPrivyOriginAllowed()) return false
  return true
}

export function isLensGroveEnabled(): boolean {
  const raw = String(import.meta.env.VITE_ENABLE_LENS_GROVE ?? '')
    .trim()
    .toLowerCase()
  if (!raw) return true
  return raw === '1' || raw === 'true' || raw === 'yes'
}
