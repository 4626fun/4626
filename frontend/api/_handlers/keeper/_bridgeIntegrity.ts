/**
 * POST /api/keeper/bridge-integrity
 *
 * Read-only bridge integrity fallback. Inspects existing Solana infra status
 * and returns normalized ok/warning/critical findings for the keeper queue.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  checkRateLimit,
  getClientIp,
  handleOptions,
  rateLimitKey,
  requireKeeprApiKey,
  setCors,
  setNoStore,
  RATE_LIMITS,
} from '../../../packages/server-core/src/index.js'

type BridgeIntegrityResponse = {
  status: 'ok' | 'warning' | 'critical'
  checksRun: number
  criticalFindings: string[]
  warningFindings: string[]
  infraStatus: {
    readyForAutoRegistration?: boolean
    blockers?: string[]
    bridgeLivenessEnforced?: boolean
    bridgeLivenessHealthy?: boolean | null
    defaultMintRouteReady?: boolean | null
    defaultRouteBridgeTokenAllowlisted?: boolean | null
  } | null
}

function getBaseUrl(req: VercelRequest): string {
  const configured = String(process.env.KEEPER_COORDINATION_BASE_URL ?? '').trim()
  if (configured) return configured.replace(/\/+$/, '')
  const host = typeof req.headers.host === 'string' ? req.headers.host : ''
  if (!host) return ''
  const proto = String(req.headers['x-forwarded-proto'] ?? 'https').split(',')[0]?.trim() || 'https'
  return `${proto}://${host}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res)) return

  const limiter = checkRateLimit(
    rateLimitKey('keeper-bridge-integrity', getClientIp(req)),
    RATE_LIMITS.keeperTriggerWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const baseUrl = getBaseUrl(req)
  const apiKey = String(process.env.KPR_API_KEY ?? '').trim()
  if (!baseUrl || !apiKey) {
    return res.status(500).json({ success: false, error: 'bridge_integrity_not_configured' } satisfies ApiEnvelope<never>)
  }

  try {
    const response = await fetch(`${baseUrl}/api/deploy/solanaInfraStatus`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(20_000),
    })
    const json = (await response.json().catch(() => null)) as {
      success?: boolean
      data?: Record<string, unknown>
      error?: string
    } | null
    if (!response.ok || json?.success !== true || !json.data) {
      return res.status(502).json({
        success: false,
        error: json?.error || `solana_infra_status_failed:${response.status}`,
      } satisfies ApiEnvelope<never>)
    }

    const data = json.data
    const blockers = Array.isArray(data.blockers) ? data.blockers.map(String).filter(Boolean) : []
    const criticalFindings = [...blockers]
    const warningFindings: string[] = []
    if (data.readyForAutoRegistration === false && criticalFindings.length === 0) {
      warningFindings.push('Solana infra is not ready for auto registration, but no explicit blocker was reported.')
    }
    if (data.bridgeLivenessEnforced === true && data.bridgeLivenessHealthy === false) {
      criticalFindings.push('Bridge liveness is enforced and currently unhealthy.')
    }
    if (data.defaultMintRouteReady === false) {
      criticalFindings.push('Default Solana mint route is not ready.')
    }
    if (data.defaultRouteBridgeTokenAllowlisted === false) {
      criticalFindings.push('Default route bridge token is outside the canonical allowlist.')
    }

    const status: BridgeIntegrityResponse['status'] =
      criticalFindings.length > 0 ? 'critical' : warningFindings.length > 0 ? 'warning' : 'ok'
    return res.status(200).json({
      success: true,
      data: {
        status,
        checksRun: 1,
        criticalFindings,
        warningFindings,
        infraStatus: {
          readyForAutoRegistration: data.readyForAutoRegistration as boolean | undefined,
          blockers,
          bridgeLivenessEnforced: data.bridgeLivenessEnforced as boolean | undefined,
          bridgeLivenessHealthy: data.bridgeLivenessHealthy as boolean | null | undefined,
          defaultMintRouteReady: data.defaultMintRouteReady as boolean | null | undefined,
          defaultRouteBridgeTokenAllowlisted: data.defaultRouteBridgeTokenAllowlisted as boolean | null | undefined,
        },
      },
    } satisfies ApiEnvelope<BridgeIntegrityResponse>)
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'bridge_integrity_failed',
    } satisfies ApiEnvelope<never>)
  }
}
