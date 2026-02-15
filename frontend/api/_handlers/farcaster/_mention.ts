/**
 * Farcaster Mention Webhook Handler
 *
 * Receives Neynar webhook events when the Keepr account is mentioned
 * in a cast. Routes the mention through ElizaOS to generate a reply
 * and posts it as a threaded reply via Neynar.
 *
 * Endpoint: POST /api/farcaster/mention
 *
 * Neynar webhook setup:
 *   POST https://api.neynar.com/v2/farcaster/webhook
 *   { "name": "keepr-mentions", "url": "https://4626.fun/api/farcaster/mention", "subscription": { "cast.created": { "mentioned_fids": [<KEEPR_FID>] } } }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac } from 'node:crypto'

import { readNeynarApiKey } from '../../../server/_lib/neynarConfig.js'
import { logger } from '../../../server/_lib/logger.js'
import { resolveMentionThroughElizaToolchain } from '../../../server/agent/eliza/mentionToolchain.js'

declare const process: { env: Record<string, string | undefined> }

const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster'

// Rate limit: max 10 replies per minute
const replyTimestamps: number[] = []
const MAX_REPLIES_PER_MINUTE = 10

function canReply(): boolean {
  const now = Date.now()
  // Remove entries older than 60s
  while (replyTimestamps.length > 0 && replyTimestamps[0] < now - 60_000) {
    replyTimestamps.shift()
  }
  return replyTimestamps.length < MAX_REPLIES_PER_MINUTE
}

function recordReply() {
  replyTimestamps.push(Date.now())
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = (process.env.FC_MENTION_WEBHOOK_SECRET ?? '').trim()
  if (!secret) {
    // If no secret is configured, skip verification (but log a warning)
    logger.warn('[fc/mention] FC_MENTION_WEBHOOK_SECRET not set — skipping webhook verification')
    return true
  }

  const hmac = createHmac('sha512', secret)
  hmac.update(body)
  const expected = hmac.digest('hex')
  return signature === expected
}

// ---------------------------------------------------------------------------
// Reply posting
// ---------------------------------------------------------------------------

async function postReply(params: {
  text: string
  parentHash: string
  apiKey: string
  signerUuid: string
}): Promise<{ hash: string } | null> {
  try {
    const response = await fetch(`${NEYNAR_API_BASE}/cast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        api_key: params.apiKey,
      },
      body: JSON.stringify({
        signer_uuid: params.signerUuid,
        text: params.text,
        parent: params.parentHash,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      logger.error('[fc/mention] Reply failed', { status: response.status, err: err.slice(0, 300) })
      return null
    }

    const data = (await response.json()) as any
    return { hash: String(data?.cast?.hash ?? data?.hash ?? 'unknown') }
  } catch (err) {
    logger.error('[fc/mention] Reply error', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Simple response generation for mentions
// ---------------------------------------------------------------------------

function generateMentionResponse(castText: string, authorUsername: string): string {
  const cleanText = castText
    .replace(/@\w+/g, '') // remove @mentions
    .trim()
    .toLowerCase()

  // Simple keyword-based responses for now
  if (cleanText.includes('vault') || cleanText.includes('tvl') || cleanText.includes('deposit')) {
    return `Hey @${authorUsername}! Check out our vaults at https://4626.fun — you can explore Creator Vaults, deposit, and earn yield. Type any questions in our XMTP chat!`
  }

  if (cleanText.includes('coin') || cleanText.includes('token') || cleanText.includes('buy') || cleanText.includes('trade')) {
    return `Hey @${authorUsername}! You can explore Creator Coins at https://4626.fun — create, buy, and sell Content Coins paired to creators. DM me on XMTP for more!`
  }

  if (cleanText.includes('help') || cleanText.includes('how')) {
    return `Hey @${authorUsername}! I'm Keepr, the CreatorVault assistant. DM me on XMTP to manage vaults, trade coins, and more. Start here: https://4626.fun`
  }

  // Default response
  return `Hey @${authorUsername}! I'm Keepr from CreatorVault. DM me on XMTP for vault management, coin trading, and more. https://4626.fun`
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Neynar-Signature')
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify webhook signature
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
  const signature = (req.headers['x-neynar-signature'] as string) ?? ''

  if (!verifyWebhookSignature(rawBody, signature)) {
    logger.warn('[fc/mention] Invalid webhook signature')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  // Rate limit
  if (!canReply()) {
    logger.warn('[fc/mention] Rate limited')
    return res.status(429).json({ error: 'Rate limited' })
  }

  // Parse the webhook payload
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const eventType = body?.type ?? ''

  // Only handle cast.created events
  if (eventType !== 'cast.created') {
    return res.status(200).json({ ok: true, skipped: true, reason: `event type: ${eventType}` })
  }

  const cast = body?.data
  if (!cast?.hash || !cast?.text) {
    return res.status(200).json({ ok: true, skipped: true, reason: 'no cast data' })
  }

  const authorUsername = cast.author?.username ?? 'anon'
  const authorFidRaw = Number(cast.author?.fid)
  const authorFid = Number.isFinite(authorFidRaw) && authorFidRaw > 0 ? Math.floor(authorFidRaw) : null
  const castHash = String(cast.hash)
  const castText = String(cast.text)

  logger.info('[fc/mention] Mention received', {
    author: authorUsername,
    castHash,
    textPreview: castText.slice(0, 100),
  })

  // Check Neynar credentials
  const apiKey = readNeynarApiKey({ context: 'farcaster/mention' })
  const signerUuid = (process.env.NEYNAR_SIGNER_UUID ?? '').trim()

  if (!apiKey || !signerUuid) {
    logger.warn('[fc/mention] Neynar not configured')
    return res.status(200).json({ ok: true, skipped: true, reason: 'neynar not configured' })
  }

  // Route through Eliza toolchain first for high-confidence workflows (e.g., waitlist status).
  const toolchainResponse = await resolveMentionThroughElizaToolchain({
    castText,
    authorUsername,
    authorFid,
  })

  // Fallback to simple keyword responder when no tool workflow matches.
  const responseText = toolchainResponse ?? generateMentionResponse(castText, authorUsername)

  // Post reply
  const result = await postReply({
    text: responseText,
    parentHash: castHash,
    apiKey,
    signerUuid,
  })

  if (result) {
    recordReply()
    logger.info('[fc/mention] Reply posted', { replyHash: result.hash, parentHash: castHash })
    return res.status(200).json({ ok: true, replyHash: result.hash })
  }

  return res.status(200).json({ ok: true, skipped: true, reason: 'reply failed' })
}
