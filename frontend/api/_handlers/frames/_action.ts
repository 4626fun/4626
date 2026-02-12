import type { VercelRequest, VercelResponse } from '@vercel/node'

import { readNeynarApiKey } from '../../../server/_lib/neynarConfig.js'
import { logger } from '../../../server/_lib/logger.js'

declare const process: { env: Record<string, string | undefined> }

const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster'

/**
 * Farcaster Frame Action Handler
 *
 * POST /api/frames/action
 *
 * Validates frame action messages and handles button presses:
 * - For "link" actions: redirects to the target URL
 * - For "post" actions: returns updated frame HTML
 * - For "tx" actions: returns transaction calldata
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

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body

  // Validate the frame action message via Neynar
  const trustedData = body?.trustedData?.messageBytes
  const untrustedData = body?.untrustedData

  if (!trustedData && !untrustedData) {
    return res.status(400).json({ error: 'Missing frame action data' })
  }

  // Try to validate with Neynar if API key is available
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
        body: JSON.stringify({
          message_bytes_in_hex: trustedData,
        }),
      })

      if (validateResponse.ok) {
        validatedAction = await validateResponse.json()
      } else {
        logger.warn('[frames/action] Frame validation failed', {
          status: validateResponse.status,
        })
      }
    } catch (err) {
      logger.error('[frames/action] Frame validation error', err)
    }
  }

  // Extract action details
  const buttonIndex = validatedAction?.action?.tapped_button?.index ??
    untrustedData?.buttonIndex ?? 1
  const fid = validatedAction?.action?.interactor?.fid ?? untrustedData?.fid
  const inputText = validatedAction?.action?.input?.text ?? untrustedData?.inputText ?? ''
  const castHash = validatedAction?.action?.cast?.hash ?? untrustedData?.castId?.hash ?? ''
  const frameUrl = untrustedData?.url ?? ''

  logger.info('[frames/action] Frame action', {
    buttonIndex,
    fid,
    inputText: inputText.slice(0, 100),
    frameUrl,
  })

  // Determine the frame type from the URL
  const appUrl = (process.env.VITE_APP_URL ?? 'https://4626.fun').trim()

  // Route based on the button and frame context
  // For now, return a simple confirmation frame
  // Future: return transaction calldata for on-chain actions

  const responseHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${appUrl}/og-image.png" />
  <meta property="fc:frame:button:1" content="Visit CreatorVault" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${appUrl}" />
  <meta property="fc:frame:button:2" content="Chat with Keepr" />
  <meta property="fc:frame:button:2:action" content="link" />
  <meta property="fc:frame:button:2:target" content="https://xmtp.chat/dm/${process.env.VITE_AGENT_XMTP_ADDRESS ?? ''}" />
  <meta property="og:title" content="CreatorVault" />
  <meta property="og:image" content="${appUrl}/og-image.png" />
</head>
<body>
  <p>CreatorVault — manage vaults and trade coins on Base</p>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(200).send(responseHtml)
}
