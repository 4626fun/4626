/**
 * AlfaClub API auth + request fingerprint policy (single source of truth).
 *
 * This module centralizes:
 * - env parsing for read/write/JWT credentials,
 * - API base/proxy resolution,
 * - browser-like header shaping used by AlfaClub-protected endpoints.
 *
 * Keep all auth/fingerprint decisions here so callers (chat bridge, room
 * market context, future helpers) do not fork behavior.
 */
declare const process: { env: Record<string, string | undefined> }

const DEFAULT_API_BASE_URL = 'https://api.alfaclub.app'

export type AlfaClubApiAuthFlags = {
  apiBaseUrl: string
  apiProxyUrl: string | null
  apiProxySecret: string | null
  jwt: string | null
  botToken: string | null
  readBotToken: string | null
}

function normalizeEnvScalar(raw: string | undefined): string {
  const value = (raw ?? '').trim()
  if (!value) return ''
  const quoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  return quoted ? value.slice(1, -1).trim() : value
}

function normalizeApiBaseUrl(raw: string | undefined): string {
  const value = normalizeEnvScalar(raw) || DEFAULT_API_BASE_URL
  try {
    const url = new URL(value)
    return `${url.origin}`
  } catch {
    return DEFAULT_API_BASE_URL
  }
}

function normalizeApiProxyUrl(raw: string | undefined): string | null {
  const value = normalizeEnvScalar(raw)
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    return `${url.origin}`
  } catch {
    return null
  }
}

function normalizeApiProxySecret(raw: string | undefined): string | null {
  const value = normalizeEnvScalar(raw)
  return value || null
}

function normalizeAlfaClubBotToken(raw: string | undefined): string | null {
  const value = normalizeEnvScalar(raw)
  return value || null
}

function toOrigin(value: string): string {
  try {
    return new URL(value).origin
  } catch {
    return value
  }
}

export function resolveAlfaClubOriginHeaders(baseUrl: string): Record<string, string> {
  const origin = toOrigin(baseUrl)
  if (
    origin === 'https://api.alfaclub.app' ||
    origin === 'https://alfaclub.app' ||
    origin.endsWith('.alfaclub.app')
  ) {
    return {
      Origin: 'https://alfaclub.app',
      Referer: 'https://alfaclub.app/',
      'Sec-Fetch-Site': 'same-site',
    }
  }
  return {}
}

/**
 * Origin-agnostic browser headers sent to AlfaClub API routes.
 * The request-specific origin triplet is layered by `buildAlfaClubApiHeaders`.
 */
export const ALFACLUB_API_COMMON_BROWSER_HEADERS = Object.freeze({
  Accept: 'application/json, text/plain, */*',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
} as const)

/**
 * Build authenticated headers for JWT-backed AlfaClub API calls.
 * If a proxy secret is configured, include it without exposing caller details.
 */
export function buildAlfaClubApiHeaders(params: {
  jwt: string
  fingerprintBaseUrl: string
  proxySecret?: string | null
}): Record<string, string> {
  const proxySecret = (params.proxySecret ?? '').trim()
  return {
    ...ALFACLUB_API_COMMON_BROWSER_HEADERS,
    ...resolveAlfaClubOriginHeaders(params.fingerprintBaseUrl),
    Authorization: `Bearer ${params.jwt}`,
    ...(proxySecret ? { 'x-proxy-secret': proxySecret } : {}),
  }
}

/**
 * Read and normalize all AlfaClub HTTP auth inputs from env.
 * Supports separate read/write bot tokens plus legacy aliases.
 */
export function readAlfaClubApiAuthFlags(): AlfaClubApiAuthFlags {
  return {
    apiBaseUrl: normalizeApiBaseUrl(process.env.ALFACLUB_CHAT_API_BASE_URL),
    apiProxyUrl: normalizeApiProxyUrl(process.env.ALFACLUB_CHAT_API_PROXY_URL),
    apiProxySecret: normalizeApiProxySecret(process.env.ALFACLUB_CHAT_API_PROXY_SECRET),
    jwt: normalizeEnvScalar(process.env.ALFACLUB_CHAT_JWT) || null,
    readBotToken: normalizeAlfaClubBotToken(
      process.env.ALFACLUB_READ_BOT_TOKEN ?? process.env.ALFACLUB_CHAT_READ_BOT_TOKEN,
    ),
    botToken: normalizeAlfaClubBotToken(
      process.env.ALFACLUB_API_KEY ??
        process.env.alfaclub_api_key ??
        process.env.ALFACLUB_BOT_TOKEN,
    ),
  }
}

/**
 * Resolve the actual outbound URL base (proxy preferred when configured).
 */
export function resolveAlfaClubApiCallBaseUrl(flags: {
  apiBaseUrl: string
  apiProxyUrl: string | null
}): string {
  return flags.apiProxyUrl || flags.apiBaseUrl
}

/**
 * Emit proxy secret only when requests are routed through proxy origin.
 */
export function resolveAlfaClubProxySecret(flags: {
  apiProxyUrl: string | null
  apiProxySecret: string | null
}): string | null {
  return flags.apiProxyUrl ? flags.apiProxySecret : null
}

