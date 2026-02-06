import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parseWebhookEvent, verifyAppKeyWithNeynar } from '@farcaster/miniapp-node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../server/auth/_shared.js'
import { requireNeynarApiKey } from '../../server/_lib/neynarConfig.js'
import { getDb } from '../../server/_lib/postgres.js'

declare const process: { env: Record<string, string | undefined> }

type NotificationDetails = {
  url: string
  token: string
}

type MiniAppEvent = {
  event: string
  notificationDetails?: NotificationDetails | null
}

type ParsedWebhook = {
  fid: number
  appFid: number
  event: MiniAppEvent
}

type WebhookOk = { ok: true; event?: string; stored?: boolean }

let notificationsSchemaEnsured = false

async function ensureNotificationsSchema(db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }) {
  if (notificationsSchemaEnsured) return
  notificationsSchemaEnsured = true
  await db.sql`
    CREATE TABLE IF NOT EXISTS miniapp_notifications (
      fid BIGINT NOT NULL,
      app_fid BIGINT NOT NULL,
      token TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (fid, app_fid)
    );
  `
  await db.sql`CREATE INDEX IF NOT EXISTS miniapp_notifications_updated_idx ON miniapp_notifications (updated_at DESC);`
}

function isNotificationDetails(value: any): value is NotificationDetails {
  if (!value || typeof value !== 'object') return false
  const url = typeof value.url === 'string' ? value.url.trim() : ''
  const token = typeof value.token === 'string' ? value.token.trim() : ''
  return Boolean(url && token)
}

function coercePositiveInt(value: any): number | null {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return null
  const int = Math.floor(num)
  return int > 0 ? int : null
}

function normalizeParsedWebhook(raw: any): ParsedWebhook | null {
  if (!raw || typeof raw !== 'object') return null
  const payload = raw?.fid !== undefined || raw?.appFid !== undefined ? raw : raw?.data ?? raw
  const fid = coercePositiveInt(payload?.fid)
  const appFid = coercePositiveInt(payload?.appFid)
  const event = payload?.event
  if (!fid || !appFid || !event || typeof event !== 'object') return null
  const eventName = typeof event.event === 'string' ? event.event.trim() : ''
  if (!eventName) return null
  const notificationDetails = isNotificationDetails(event.notificationDetails) ? event.notificationDetails : null
  return { fid, appFid, event: { event: eventName, notificationDetails } }
}

async function parseWebhookPayload(raw: any): Promise<ParsedWebhook | null> {
  requireNeynarApiKey({ context: 'webhook' })
  const parsed = await parseWebhookEvent(raw, verifyAppKeyWithNeynar)
  return normalizeParsedWebhook(parsed)
}

async function upsertNotificationDetails(params: {
  fid: number
  appFid: number
  details: NotificationDetails
}): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  await ensureNotificationsSchema(db)
  await db.sql`
    INSERT INTO miniapp_notifications (fid, app_fid, token, url)
    VALUES (${params.fid}, ${params.appFid}, ${params.details.token}, ${params.details.url})
    ON CONFLICT (fid, app_fid)
    DO UPDATE SET token = EXCLUDED.token, url = EXCLUDED.url, updated_at = NOW();
  `
  return true
}

async function deleteNotificationDetails(params: { fid: number; appFid: number }): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  await ensureNotificationsSchema(db)
  await db.sql`
    DELETE FROM miniapp_notifications
    WHERE fid = ${params.fid} AND app_fid = ${params.appFid};
  `
  return true
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (req.method === 'GET') {
    return res.status(200).json({ success: true, data: { ok: true } satisfies WebhookOk } satisfies ApiEnvelope<WebhookOk>)
  }

  const body = await readJsonBody<any>(req, { maxBytes: 500_000 })
  if (!body) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  let parsed: ParsedWebhook | null = null
  try {
    parsed = await parseWebhookPayload(body)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    console.error('Webhook verification failed:', message)
    if (message === 'webhook_verification_unavailable' || message.startsWith('neynar_api_key_missing')) {
      return res.status(503).json({ success: false, error: 'Webhook verification unavailable' } satisfies ApiEnvelope<never>)
    }
    return res.status(401).json({ success: false, error: 'Invalid webhook signature' } satisfies ApiEnvelope<never>)
  }

  if (!parsed) {
    return res.status(400).json({ success: false, error: 'Invalid webhook payload' } satisfies ApiEnvelope<never>)
  }

  const { fid, appFid, event } = parsed
  const eventType = event.event
  const details = event.notificationDetails
  let stored = false

  if ((eventType === 'miniapp_added' || eventType === 'notifications_enabled') && details) {
    stored = await upsertNotificationDetails({ fid, appFid, details })
  } else if (eventType === 'miniapp_removed' || eventType === 'notifications_disabled') {
    stored = await deleteNotificationDetails({ fid, appFid })
  }

  return res.status(200).json({
    success: true,
    data: { ok: true, event: eventType, stored } satisfies WebhookOk,
  } satisfies ApiEnvelope<WebhookOk>)
}
