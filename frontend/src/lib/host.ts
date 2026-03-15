export type HostMode = 'app' | 'marketing'

type LoopbackOriginResolutionInput = {
  configuredOrigin: string
  currentOrigin: string
}

function isLoopbackHostname(hostname: string): boolean {
  const h = String(hostname || '').trim().toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]'
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

    const sameHost = configured.hostname === current.hostname
    if (!sameHost) return input.configuredOrigin

    const sameScheme = configured.protocol === current.protocol
    const samePort = configured.port === current.port
    if (sameScheme && samePort) return input.configuredOrigin

    return current.origin
  } catch {
    return input.configuredOrigin
  }
}

function resolveConfiguredOrigin(rawOrigin: string): string {
  if (typeof window === 'undefined') return rawOrigin
  return resolveLoopbackOriginForCurrentWindow({
    configuredOrigin: rawOrigin,
    currentOrigin: window.location.origin,
  })
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
  return mode === 'app' ? window.location.origin : APP_ORIGIN
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
