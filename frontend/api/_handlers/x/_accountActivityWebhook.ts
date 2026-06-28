import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions } from '@4626/server-core'

import { buildAccountActivityCrcResponseToken } from '../../../server/twitter/accountActivityCrc.js'
import { handleAccountActivityWebhookPayload } from '../../../server/twitter/accountActivityWebhook.js'
import { readTwitterConsumerSecret } from '../../../server/twitter/twitterEnv.js'

function readCrcToken(req: VercelRequest): string {
  const raw = req.query?.crc_token
  if (typeof raw === 'string') return raw.trim()
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0].trim()
  return ''
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
    try {
      await handleAccountActivityWebhookPayload(req.body)
    } catch {
      // Always ack delivery so X does not disable the webhook while we iterate.
    }
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'method_not_allowed' })
}
