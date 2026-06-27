import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  isAddress } from 'viem'

import { handleOptions,
  setCors } from '../../../server/zora/_shared.js'
import {
  readBoundedJsonObjectBody,
  readRequestPrincipal,
  isAdminAddress,
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'


import {
  markTrendOpDeployed,
  markTrendOpDeploying,
  markTrendOpFailed,
  upsertTrendPrediction,
} from '../../../server/_lib/zora/zoraTrendOpsStore.js'
import { preflightTrendTicker, reserveTrendTicker } from '../../../server/zora/trends.js'

function isAuthorizedAdmin(req: VercelRequest): { ok: boolean; actorAddress: string | null } {
  const principal = readRequestPrincipal(req)
  if (!principal?.address) return { ok: false, actorAddress: null }
  const actorAddress = principal.address.toLowerCase()
  if (!isAdminAddress(actorAddress as `0x${string}`)) return { ok: false, actorAddress }
  return { ok: true, actorAddress }
}

async function readBody(req: VercelRequest): Promise<Record<string, unknown>> {
  const TREND_RESERVE_MAX_BODY_BYTES = 16_384
  try {
    return (await readBoundedJsonObjectBody(req, { maxBytes: TREND_RESERVE_MAX_BODY_BYTES })) ?? {}
  } catch {
    throw new Error('body_too_large')
  }
}

function readBoolean(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v
  const raw = String(v ?? '').trim().toLowerCase()
  if (!raw) return fallback
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return fallback
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  res.setHeader('Cache-Control', 'no-store')
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const limiter = await checkDurableRateLimit(
    rateLimitKey('zora-trend-reserve', getClientIp(req)),
    RATE_LIMITS.adminAction,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const auth = isAuthorizedAdmin(req)
  if (!auth.ok) {
    return res.status(403).json({ success: false, error: 'Admin authorization required' })
  }

  let body: Record<string, unknown>
  try {
    body = await readBody(req)
  } catch {
    return res.status(413).json({ success: false, error: 'Request body too large' })
  }
  const ticker = String(body.ticker ?? '').trim()
  const creatorTokenRaw = String(body.creatorToken ?? '').trim()
  const groupId = String(body.groupId ?? 'api').trim() || 'api'
  const vaultAddress = String(body.vaultAddress ?? '').trim().toLowerCase() || null
  const waitForReceipt = readBoolean(body.waitForReceipt, true)

  if (!ticker) {
    return res.status(400).json({ success: false, error: 'Missing ticker' })
  }
  if (!isAddress(creatorTokenRaw)) {
    return res.status(400).json({ success: false, error: 'Invalid creatorToken address' })
  }

  try {
    const preflight = await preflightTrendTicker({ ticker })
    await upsertTrendPrediction({
      ticker: preflight.ticker,
      tickerHash: preflight.tickerHash,
      predictedCoinAddress: preflight.predictedAddress,
      actorWallet: auth.actorAddress,
      groupId,
      vaultAddress,
      funnelMetadata: {
        source: 'api_trend_reserve',
      },
    })

    if (preflight.deployed) {
      await markTrendOpDeployed({
        tickerHash: preflight.tickerHash,
        deployedCoinAddress: preflight.predictedAddress,
      })
      return res.status(200).json({
        success: true,
        data: {
          status: 'already_deployed',
          preflight,
          txHash: null,
        },
      })
    }

    await markTrendOpDeploying({ tickerHash: preflight.tickerHash })
    try {
      const reserve = await reserveTrendTicker({
        ticker: preflight.ticker,
        creatorToken: creatorTokenRaw.toLowerCase() as `0x${string}`,
        groupId,
        waitForReceipt,
      })

      if (reserve.status === 'deployed' || reserve.status === 'already_deployed') {
        await markTrendOpDeployed({
          tickerHash: preflight.tickerHash,
          deployedCoinAddress: reserve.deployedAddress,
          txHash: reserve.txHash,
          actorWallet: reserve.walletAddress,
        })
      } else {
        await markTrendOpDeploying({
          tickerHash: preflight.tickerHash,
          txHash: reserve.txHash,
          actorWallet: reserve.walletAddress,
        })
      }

      return res.status(200).json({
        success: true,
        data: reserve,
      })
    } catch (error: any) {
      await markTrendOpFailed({
        tickerHash: preflight.tickerHash,
        lastError: String(error?.message ?? 'trend_reserve_failed'),
      })
      throw error
    }
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: String(error?.message ?? 'trend_reserve_failed').slice(0, 220),
    })
  }
}
