import type { VercelRequest } from '@vercel/node'

declare const process: { env: Record<string, string | undefined> }

export type TelegramWebhookIngressLane = 'canonical' | 'hermit'

function normalizeHost(raw: string | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .split(':')[0]
}

export function readTelegramWebhookHost(req: Pick<VercelRequest, 'headers'>): string {
  const forwarded = req.headers?.['x-forwarded-host']
  const host = req.headers?.host
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded ?? (Array.isArray(host) ? host[0] : host)
  return normalizeHost(raw)
}

/** When set, Telegram → AlfaClub relay runs only on this host (e.g. hermit.4626.fun). */
export function readTelegramToAlfaclubIngressHost(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const host = normalizeHost(env.TELEGRAM_TO_ALFACLUB_INGRESS_HOST)
  return host || null
}

export function resolveTelegramWebhookIngressLane(
  req: Pick<VercelRequest, 'headers'>,
  env: Record<string, string | undefined> = process.env,
): TelegramWebhookIngressLane {
  const ingressHost = readTelegramToAlfaclubIngressHost(env)
  if (!ingressHost) return 'canonical'
  return readTelegramWebhookHost(req) === ingressHost ? 'hermit' : 'canonical'
}

export function shouldRelayTelegramToAlfaclubOnCanonicalWebhook(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readTelegramToAlfaclubIngressHost(env) == null
}

export function readHermitTelegramWebhookSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  return String(env.ALFACLUB_TELEGRAM_WEBHOOK_SECRET ?? '').trim()
}

export function readHermitTelegramBotToken(
  env: Record<string, string | undefined> = process.env,
): string {
  return String(env.ALFACLUB_TELEGRAM_BOT_TOKEN ?? '').trim()
}
