import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '@4626/server-core'

declare const process: { env: Record<string, string | undefined> }

/**
 * Only `ui` category flag keys are eligible for remote evaluation.
 * Security, operational, and debug flags stay env-only.
 */
const REMOTE_ELIGIBLE_KEYS = ['lens-grove'] as const

type EvaluateResponse = Record<string, unknown>

/**
 * GET /api/flags/evaluate
 *
 * Evaluates Vercel-managed flags server-side using @vercel/flags-core,
 * returning resolved values for `ui` category flags only.
 *
 * Requires the FLAGS environment variable (Vercel SDK key) to be set.
 * When FLAGS is absent, returns an empty object so the client falls
 * back to local env-based defaults.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    } satisfies ApiEnvelope<never>)
  }

  const sdkKey = process.env.FLAGS
  if (!sdkKey) {
    return res.status(200).json({
      success: true,
      data: {},
    } satisfies ApiEnvelope<EvaluateResponse>)
  }

  try {
    const { createClient } = await import('@vercel/flags-core')
    const client = createClient(sdkKey)
    await client.initialize()

    const results: EvaluateResponse = {}

    for (const key of REMOTE_ELIGIBLE_KEYS) {
      try {
        const result = await client.evaluate(key)
        if (result.value !== undefined) {
          results[key] = result.value
        }
      } catch {
        // Flag not found in Vercel dashboard — skip, client uses local default
      }
    }

    await client.shutdown()

    return res.status(200).json({
      success: true,
      data: results,
    } satisfies ApiEnvelope<EvaluateResponse>)
  } catch (err) {
    return res.status(200).json({
      success: true,
      data: {},
    } satisfies ApiEnvelope<EvaluateResponse>)
  }
}
