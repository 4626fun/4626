import { readTelegramToAlfaclubIngressHost } from './ingress.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_HERMIT_WEBHOOK_PATH = '/api/telegram/hermit-webhook'
const DEFAULT_HERMIT_WEBHOOK_ORIGIN = 'https://app.4626.fun'

function normalizeEnvScalar(value: string | undefined): string {
  return String(value ?? '').trim()
}

function normalizePublicUrl(raw: string): string | null {
  const trimmed = normalizeEnvScalar(raw)
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

/** Explicit override for hermit4626bot setWebhook when ingress host DNS is not on Vercel yet. */
export function readHermitTelegramWebhookUrlOverride(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return normalizePublicUrl(env.HERMIT_TELEGRAM_WEBHOOK_URL ?? '')
}

/**
 * Canonical public URL for hermit4626bot Telegram setWebhook.
 *
 * Priority:
 * 1. HERMIT_TELEGRAM_WEBHOOK_URL (ops override — use app.4626.fun path while DNS migrates)
 * 2. https://{TELEGRAM_TO_ALFACLUB_INGRESS_HOST}/api/telegram/webhook
 * 3. https://app.4626.fun/api/telegram/hermit-webhook
 */
export function resolveHermitTelegramWebhookPublicUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const override = readHermitTelegramWebhookUrlOverride(env)
  if (override) return override

  const ingressHost = readTelegramToAlfaclubIngressHost(env)
  if (ingressHost) {
    return `https://${ingressHost}/api/telegram/webhook`
  }

  const origin = normalizePublicUrl(env.VITE_APP_ORIGIN ?? '') ?? DEFAULT_HERMIT_WEBHOOK_ORIGIN
  return `${origin}${DEFAULT_HERMIT_WEBHOOK_PATH}`
}
