import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, setCors } from '../../../server/auth/_shared.js'
import { resolveFarcasterProfile } from '../../../server/_lib/farcasterProvider.js'
import { trackFarcasterRolloutEvent } from '../../../server/_lib/farcasterRolloutTelemetry.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { address, fid } = req.query

  const addressParam = typeof address === 'string' ? address : null
  const fidParam = typeof fid === 'string' ? fid : null

  if (!addressParam && !fidParam) {
    return res.status(400).json({ success: false, error: 'Address or fid parameter is required' })
  }

  const fidNumber = fidParam && /^\d+$/.test(fidParam) ? Number(fidParam) : null
  if (fidParam && (!fidNumber || !Number.isFinite(fidNumber) || fidNumber <= 0)) {
    return res.status(400).json({ success: false, error: 'Invalid fid parameter' })
  }

  // Keep cache short to reduce rate-limit risk while still de-duping bursts.
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')

  try {
    const { profile, source, mode } = await resolveFarcasterProfile({
      address: addressParam,
      fid: fidNumber,
    })

    res.setHeader('X-Farcaster-Provider-Mode', mode)
    res.setHeader('X-Farcaster-Provider-Source', source)

    if (!profile) {
      void trackFarcasterRolloutEvent({
        category: 'provider_resolution',
        endpoint: '/api/social/farcaster',
        mode,
        source,
        statusCode: 200,
        metadata: { hasProfile: false },
      })
      return res.status(200).json({ success: true, data: null, source, mode })
    }

    void trackFarcasterRolloutEvent({
      category: 'provider_resolution',
      endpoint: '/api/social/farcaster',
      mode,
      source,
      statusCode: 200,
      metadata: { hasProfile: true },
    })

    return res.status(200).json({ success: true, data: profile, source, mode })
  } catch {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch Farcaster profile',
    })
  }
}
