import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions } from '@4626/server-core'

import {
  buildAccountActivityCrcResponseToken,
  verifyAccountActivityWebhookSignature,
} from '../../../server/twitter/accountActivityCrc.js'
import { handleAccountActivityWebhookPayload } from '../../../server/twitter/accountActivityWebhook.js'
import { readTwitterConsumerSecret } from '../../../server/twitter/twitterEnv.js'

function readCrcToken(req: VercelRequest): string {
  const raw = req.query?.crc_token
  if (typeof raw === 'string') return raw.trim()
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0].trim()
  return ''
}

const MAX_WEBHOOK_BODY_BYTES = 1_000_000

function readHeader(req: VercelRequest, name: string): string {
  const value = req.headers?.[name]
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return ''
}

async function readRawWebhookBody(req: VercelRequest): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8')
  if (req.body != null) throw new Error('account_activity_raw_body_unavailable')

  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req as any) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > MAX_WEBHOOK_BODY_BYTES) throw new Error('account_activity_body_too_large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (handleOptions(req, res)) return

  if (req.method === 'GET') {
    const crcToken = readCrcToken(req)
    if (!crcToken) {
      return res.status(400).json({ error: 'missing_crc_token' })
    }

    const consumerSecret = readTwitterConsumerSecret()
    if (!consumerSecret) {
      return res.status(503).json({ error: 'twitter_consumer_secret_not_configured' })
    }

    try {
      const response_token = buildAccountActivityCrcResponseToken(crcToken, consumerSecret)
      return res.status(200).json({ response_token })
    } catch {
      return res.status(500).json({ error: 'account_activity_crc_failed' })
    }
  }

  if (req.method === 'POST') {
    const consumerSecret = readTwitterConsumerSecret()
    if (!consumerSecret) {
      return res.status(503).json({ error: 'twitter_consumer_secret_not_configured' })
    }

    let rawBody: Buffer
    try {
      rawBody = await readRawWebhookBody(req)
    } catch {
      return res.status(400).json({ error: 'invalid_webhook_body' })
    }

    const signature = readHeader(req, 'x-twitter-webhooks-signature')
    if (!verifyAccountActivityWebhookSignature({ rawBody, signature, consumerSecret })) {
      return res.status(401).json({ error: 'invalid_webhook_signature' })
    }

    let payload: unknown
    try {
      payload = JSON.parse(rawBody.toString('utf8'))
    } catch {
      return res.status(400).json({ error: 'invalid_webhook_json' })
    }

    try {
      await handleAccountActivityWebhookPayload(payload)
    } catch {
      // Ack authenticated deliveries so X does not disable the webhook while
      // downstream processing recovers.
    }
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'method_not_allowed' })
}
