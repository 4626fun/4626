import type { VercelRequest, VercelResponse } from '@vercel/node'

import { readNeynarApiKey } from '../../../server/_lib/neynarConfig.js'
import { logger } from '../../../server/_lib/logger.js'
import { trackFarcasterRolloutEvent } from '../../../server/_lib/farcasterRolloutTelemetry.js'

declare const process: { env: Record<string, string | undefined> }

const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster'

type ValidationMode = 'best-effort' | 'strict'

function readValidationMode(): ValidationMode {
  const configured = String(process.env.FRAMES_VALIDATION_MODE ?? '').trim().toLowerCase()
  if (configured === 'strict' || configured === 'best-effort') return configured
  const envName = String(process.env.APP_ENV ?? process.env.VERCEL_ENV ?? '').trim().toLowerCase()
  if (envName === 'staging' || envName === 'preview') return 'strict'
  return 'best-effort'
}

function normalizeEmail(value: unknown): string | null {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!v) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null
  return v
}

async function submitWaitlistSignup(params: {
  appUrl: string
  email: string
  fid: number | null
}): Promise<{ ok: boolean; error?: string }> {
  const { appUrl, email, fid } = params
  try {
    const res = await fetch(new URL('/api/waitlist', appUrl).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email,
        intent: {
          persona: 'creator',
          ...(typeof fid === 'number' && Number.isFinite(fid) && fid > 0 ? { fid } : null),
        },
        verifications: [
          {
            method: 'farcaster.frame',
            subject: typeof fid === 'number' && Number.isFinite(fid) && fid > 0 ? `fid:${fid}` : 'fid:unknown',
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    })

    if (!res.ok) {
      return { ok: false, error: `waitlist_${res.status}` }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'waitlist_unreachable' }
  }
}


const frameJoinIdempotency = new Map<string, number>()
const IDEMPOTENCY_TTL_MS = 10 * 60_000

function cleanupIdempotency(now: number) {
  for (const [k, ts] of frameJoinIdempotency.entries()) {
    if (now - ts > IDEMPOTENCY_TTL_MS) frameJoinIdempotency.delete(k)
  }
}

function getJoinIdempotencyKey(params: { fid: number | null; email: string; frameUrl?: string }): string {
  const fidPart = typeof params.fid === 'number' && Number.isFinite(params.fid) && params.fid > 0 ? String(params.fid) : 'unknown'
  const framePart = typeof params.frameUrl === 'string' && params.frameUrl.trim() ? params.frameUrl.trim().toLowerCase() : '-'
  return `${fidPart}|${params.email.toLowerCase()}|${framePart}`
}

/**
 * Farcaster Frame Action Handler
 *
 * POST /api/frames/action
 *
 * Validates frame action messages and handles button presses.
 * Validation mode:
 * - best-effort (default): proceeds when verification is unavailable.
 * - strict: requires verified trustedData validation.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let body: any = req.body
  if (typeof req.body === 'string') {
    try {
      body = JSON.parse(req.body)
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' })
    }
  }
  const validationMode = readValidationMode()

  const trustedData = body?.trustedData?.messageBytes
  const untrustedData = body?.untrustedData

  if (!trustedData && !untrustedData) {
    return res.status(400).json({ error: 'Missing frame action data' })
  }

  let validatedAction: any = null
  const apiKey = readNeynarApiKey({ context: 'frames/action' })

  if (apiKey && trustedData) {
    try {
      const validateResponse = await fetch(`${NEYNAR_API_BASE}/frame/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          api_key: apiKey,
        },
        body: JSON.stringify({ message_bytes_in_hex: trustedData }),
      })

      if (validateResponse.ok) {
        validatedAction = await validateResponse.json()
      } else {
        logger.warn('[frames/action] Frame validation failed', {
          status: validateResponse.status,
          validationMode,
        })
      }
    } catch (err) {
      logger.error('[frames/action] Frame validation error', err)
    }
  }

  const validated = Boolean(validatedAction)
  const validationSource = validated ? 'neynar' : 'untrusted'

  if (validationMode === 'strict' && !validated) {
    return res.status(401).json({
      error: 'Frame action could not be verified in strict mode',
      validationMode,
      validationSource,
    })
  }

  const buttonIndex = validatedAction?.action?.tapped_button?.index ?? untrustedData?.buttonIndex ?? 1
  const fid = validatedAction?.action?.interactor?.fid ?? untrustedData?.fid
  const inputText = validatedAction?.action?.input?.text ?? untrustedData?.inputText ?? ''
  const frameUrl = untrustedData?.url ?? ''

  logger.info('[frames/action] Frame action', {
    buttonIndex,
    fid,
    inputText: inputText.slice(0, 100),
    frameUrl,
    validationMode,
    validationSource,
  })

  const appUrl = (process.env.VITE_APP_URL ?? 'https://4626.fun').trim()
  const waitlistUrl = (() => {
    const u = new URL('/waitlist', appUrl)
    u.searchParams.set('from', 'farcaster-frame')
    if (typeof fid === 'number' && Number.isFinite(fid) && fid > 0) {
      u.searchParams.set('fid', String(fid))
    }
    const email = normalizeEmail(inputText)
    if (email) u.searchParams.set('email', email)
    if (typeof frameUrl === 'string' && frameUrl.trim()) {
      u.searchParams.set('frame', frameUrl.trim())
    }
    return u.toString()
  })()

  const inputEmail = normalizeEmail(inputText)
  const isJoinWaitlistTap = Number(buttonIndex) === 1
  let waitlistJoined = false
  let waitlistJoinError: string | null = null
  if (isJoinWaitlistTap && inputEmail) {
    const normalizedFid = typeof fid === 'number' && Number.isFinite(fid) ? fid : null
    const now = Date.now()
    cleanupIdempotency(now)
    const idempotencyKey = getJoinIdempotencyKey({ fid: normalizedFid, email: inputEmail, frameUrl })
    const previous = frameJoinIdempotency.get(idempotencyKey)
    if (previous && now - previous <= IDEMPOTENCY_TTL_MS) {
      waitlistJoined = true
    } else {
      const signupResult = await submitWaitlistSignup({
        appUrl,
        email: inputEmail,
        fid: normalizedFid,
      })
      waitlistJoined = signupResult.ok
      waitlistJoinError = signupResult.ok ? null : signupResult.error ?? 'waitlist_failed'
      if (signupResult.ok) frameJoinIdempotency.set(idempotencyKey, now)
    }
  }

  const bodyMessage = waitlistJoined
    ? 'You are on the waitlist. We will notify you when access opens.'
    : inputEmail && isJoinWaitlistTap
      ? 'Could not auto-submit waitlist from frame. Open waitlist to finish.'
      : 'CreatorVault — manage vaults and trade coins on Base'

  const responseHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${appUrl}/og-image.png" />
  <meta property="fc:frame:button:1" content="${waitlistJoined ? '✅ Waitlist Joined' : 'Join Waitlist'}" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${waitlistUrl}" />
  <meta property="fc:frame:button:2" content="Open CreatorVault" />
  <meta property="fc:frame:button:2:action" content="link" />
  <meta property="fc:frame:button:2:target" content="${appUrl}" />
  <meta property="fc:frame:button:3" content="Chat with Keepr" />
  <meta property="fc:frame:button:3:action" content="link" />
  <meta property="fc:frame:button:3:target" content="https://xmtp.chat/dm/${process.env.VITE_AGENT_XMTP_ADDRESS ?? ''}" />
  <meta property="og:title" content="CreatorVault" />
  <meta property="og:image" content="${appUrl}/og-image.png" />
</head>
<body>
  <p>${bodyMessage}</p>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('X-Frames-Validation-Mode', validationMode)
  res.setHeader('X-Frames-Validation-Source', validationSource)
  if (waitlistJoinError) {
    res.setHeader('X-Frames-Waitlist-Join-Error', waitlistJoinError)
  }

  void trackFarcasterRolloutEvent({
    category: 'frame_validation',
    endpoint: '/api/frames/action',
    mode: validationMode,
    source: validationSource,
    statusCode: 200,
    metadata: {
      waitlistJoined,
      waitlistJoinError,
      buttonIndex: Number(buttonIndex),
    },
  })

  return res.status(200).send(responseHtml)
}
