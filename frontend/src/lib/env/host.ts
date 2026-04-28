export type HostMode = 'app' | 'marketing'

type LoopbackOriginResolutionInput = {
  configuredOrigin: string
  currentOrigin: string
}

type MarketingToAppBaseUrlResolutionInput = {
  preferredAppOrigin: string
  currentOrigin: string
  fallbackPublicAppOrigin?: string
}

type LoopbackRedirectResolutionInput = {
  configuredOrigin: string
  currentHref: string
}

let warnedLoopbackAppOriginOnPublicHost = false
const ALLOWED_LOOPBACK_PORTS = new Set([
  '5173',
  '5174',
  '3000',
  '4173',
])

function isLoopbackHostname(hostname: string): boolean {
  const h = String(hostname || '').trim().toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]'
}

function isAllowedLoopbackPort(port: string): boolean {
  const normalized = String(port || '').trim()
  if (!normalized) return true
  return ALLOWED_LOOPBACK_PORTS.has(normalized)
}

/**
 * Keep local dev redirects on the active loopback origin when only the port is stale.
 * This avoids cross-origin bounces like localhost:5173 -> localhost:5174 when only one
 * Vite server is running.
 */
export function resolveLoopbackOriginForCurrentWindow(input: LoopbackOriginResolutionInput): string {
  try {
    const configured = new URL(input.configuredOrigin)
    const current = new URL(input.currentOrigin)

    if (!isLoopbackHostname(configured.hostname) || !isLoopbackHostname(current.hostname)) {
      return input.configuredOrigin
    }

    const sameScheme = configured.protocol === current.protocol
    const sameHost = configured.hostname === current.hostname
    const samePort = configured.port === current.port
    if (sameScheme && sameHost && samePort) return input.configuredOrigin

    const configuredPortAllowed = isAllowedLoopbackPort(configured.port)
    const currentPortAllowed = isAllowedLoopbackPort(current.port)
    if (!currentPortAllowed && configuredPortAllowed) {
      return input.configuredOrigin
    }
    if (currentPortAllowed) {
      return current.origin
    }

    return input.configuredOrigin
  } catch {
    return input.configuredOrigin
  }
}

export function resolveDisallowedLoopbackRedirectUrl(input: LoopbackRedirectResolutionInput): string | null {
  try {
    const configured = new URL(input.configuredOrigin)
    const current = new URL(input.currentHref)

    if (!isLoopbackHostname(configured.hostname) || !isLoopbackHostname(current.hostname)) {
      return null
    }
    if (configured.protocol !== current.protocol) return null
    if (configured.hostname === current.hostname && configured.port === current.port) return null
    if (isAllowedLoopbackPort(current.port)) return null
    if (!isAllowedLoopbackPort(configured.port)) return null

    const target = new URL(current.pathname + current.search + current.hash, configured.origin)
    return target.toString()
  } catch {
    return null
  }
}

export function isCurrentWindowUrl(target: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return new URL(target, window.location.origin).href === window.location.href
  } catch {
    return false
  }
}

function resolveConfiguredOrigin(rawOrigin: string): string {
  if (typeof window === 'undefined') return rawOrigin
  return resolveLoopbackOriginForCurrentWindow({
    configuredOrigin: rawOrigin,
    currentOrigin: window.location.origin,
  })
}

/**
 * When rendering the marketing host, never route users to loopback app origins.
 * This protects against accidentally shipping VITE_APP_ORIGIN=localhost in a
 * public build while preserving local-dev behavior.
 */
export function resolveMarketingToAppBaseUrl(input: MarketingToAppBaseUrlResolutionInput): string {
  const fallback = (input.fallbackPublicAppOrigin ?? 'https://app.4626.fun').trim()
  try {
    const preferred = new URL(input.preferredAppOrigin)
    const current = new URL(input.currentOrigin)
    if (isLoopbackHostname(preferred.hostname) && isLoopbackHostname(current.hostname)) {
      return resolveLoopbackOriginForCurrentWindow({
        configuredOrigin: input.preferredAppOrigin,
        currentOrigin: input.currentOrigin,
      })
    }
    if (isLoopbackHostname(preferred.hostname) && !isLoopbackHostname(current.hostname)) {
      if (!warnedLoopbackAppOriginOnPublicHost && typeof window !== 'undefined') {
        warnedLoopbackAppOriginOnPublicHost = true
        console.warn(
          '[host] VITE_APP_ORIGIN resolved to loopback on a public host; using canonical app origin fallback.',
          { preferred: input.preferredAppOrigin, current: input.currentOrigin, fallback },
        )
      }
      return fallback
    }
  } catch {
    // Fall through to preferred origin below.
  }
  return input.preferredAppOrigin
}

/** Canonical marketing/waitlist domain origin. */
export const MARKETING_ORIGIN =
  resolveConfiguredOrigin((import.meta.env.VITE_MARKETING_ORIGIN as string)?.trim() || 'https://4626.fun')

/** Canonical app domain origin (post-acceptance). */
export const APP_ORIGIN =
  resolveConfiguredOrigin((import.meta.env.VITE_APP_ORIGIN as string)?.trim() || 'https://app.4626.fun')

/**
 * Optional explicit base URL for waitlist referral links.
 * When set, waitlist share links are built from this origin instead of MARKETING_ORIGIN.
 */
export const WAITLIST_REFERRAL_BASE_URL =
  (import.meta.env.VITE_WAITLIST_REFERRAL_BASE_URL as string)?.trim() || ''

const MARKETING_HOSTNAMES = ['4626.fun', 'www.4626.fun']

function isMarketingHost(hostname: string): boolean {
  const h = hostname?.toLowerCase().trim() ?? ''
  return MARKETING_HOSTNAMES.some((m) => h === m)
}

function hostModeOverride(): HostMode | null {
  const raw = (import.meta.env.VITE_HOST_MODE_OVERRIDE as string | undefined) ?? ''
  const v = raw.trim().toLowerCase()
  if (v === 'app' || v === 'marketing') return v
  return null
}

/**
 * Host mode detection.
 *
 * - 4626.fun (or www.4626.fun) = marketing (waitlist landing)
 * - app.4626.fun (or localhost) = app
 */
export function getHostMode(): HostMode {
  if (typeof window === 'undefined') return 'app'
  const override = hostModeOverride()
  if (override) return override
  const hostname = window.location.hostname ?? ''
  return isMarketingHost(hostname) ? 'marketing' : 'app'
}

/**
 * Base URL for the app (explore, deploy, vault, admin).
 *
 * When on marketing domain, returns app.4626.fun so links point to the app.
 * When on app domain, returns current origin.
 */
export function getAppBaseUrl(): string {
  if (typeof window === 'undefined') return APP_ORIGIN
  const mode = getHostMode()
  if (mode === 'app') {
    return resolveLoopbackOriginForCurrentWindow({
      configuredOrigin: APP_ORIGIN,
      currentOrigin: window.location.origin,
    })
  }
  return resolveMarketingToAppBaseUrl({
    preferredAppOrigin: APP_ORIGIN,
    currentOrigin: window.location.origin,
  })
}

/**
 * Base URL for the marketing/waitlist site.
 *
 * When on marketing domain, returns current origin.
 * When on app domain, returns 4626.fun.
 */
export function getMarketingBaseUrl(): string {
  if (typeof window === 'undefined') return MARKETING_ORIGIN
  const mode = getHostMode()
  return mode === 'marketing' ? window.location.origin : MARKETING_ORIGIN
}

/**
 * Base URL used for user-facing waitlist referral links.
 */
export function getWaitlistReferralBaseUrl(): string {
  const override = WAITLIST_REFERRAL_BASE_URL.replace(/\/+$/, '')
  if (!override) return getMarketingBaseUrl()
  return override
}
