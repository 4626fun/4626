import { logger } from './logger.js'

declare const process: { env: Record<string, string | undefined> }

function parseBool(value: string | undefined, fallback: boolean): boolean {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return fallback
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return fallback
}

function parseNumber(value: string | undefined, fallback: number): number {
  const n = Number(String(value ?? '').trim())
  return Number.isFinite(n) ? n : fallback
}

function telemetryEnabled(): boolean {
  return parseBool(process.env.ELIZA_TELEMETRY_ENABLED, false)
}

function telemetrySampledIn(): boolean {
  const sampleRate = Math.max(0, Math.min(1, parseNumber(process.env.ELIZA_TELEMETRY_SAMPLE_RATE, 1)))
  return Math.random() <= sampleRate
}

function telemetryWebhookUrl(): string | null {
  const raw = String(process.env.ELIZA_TELEMETRY_WEBHOOK_URL ?? '').trim()
  return raw || null
}

export async function emitTelemetryEvent(
  event: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!telemetryEnabled()) return
  if (!telemetrySampledIn()) return

  const body = {
    event,
    ts: new Date().toISOString(),
    payload,
  }

  logger.info('[eliza/telemetry] event', body)

  const webhook = telemetryWebhookUrl()
  if (!webhook) return

  const timeoutMs = Math.max(250, Math.floor(parseNumber(process.env.ELIZA_TELEMETRY_TIMEOUT_MS, 1_500)))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    logger.warn('[eliza/telemetry] webhook delivery failed', {
      event,
      error: error instanceof Error ? error.message : String(error),
    })
  } finally {
    clearTimeout(timer)
  }
}
