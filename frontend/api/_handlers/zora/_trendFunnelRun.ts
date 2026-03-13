import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAddress, parseEther } from 'viem'

import { handleOptions, setCors } from '../../../server/zora/_shared.js'
import { readRequestPrincipal } from '../../../server/_lib/requestPrincipal.js'
import { isAdminAddress } from '../../../server/_lib/session.js'
import { upsertTrendPrediction } from '../../../server/_lib/zoraTrendOpsStore.js'
import { runTrendFunnel } from '../../../server/zora/trendFunnel.js'
import { preflightTrendTicker } from '../../../server/zora/trends.js'

function isAuthorizedAdmin(req: VercelRequest): { ok: boolean; actorAddress: string | null } {
  const principal = readRequestPrincipal(req)
  if (!principal?.address) return { ok: false, actorAddress: null }
  const actorAddress = principal.address.toLowerCase()
  if (!isAdminAddress(actorAddress as `0x${string}`)) return { ok: false, actorAddress }
  return { ok: true, actorAddress }
}

function readBody(req: VercelRequest): Record<string, unknown> {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body as Record<string, unknown>
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      const parsed = JSON.parse(req.body)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch {}
  }
  return {}
}

function parseNotionalWei(body: Record<string, unknown>): bigint | undefined {
  const notionalWeiRaw = String(body.notionalWei ?? '').trim()
  if (notionalWeiRaw) {
    try {
      const v = BigInt(notionalWeiRaw)
      if (v > 0n) return v
    } catch {}
  }

  const notionalEthRaw = String(body.notionalEth ?? '').trim()
  if (notionalEthRaw) {
    try {
      const v = parseEther(notionalEthRaw)
      if (v > 0n) return v
    } catch {}
  }
  return undefined
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const auth = isAuthorizedAdmin(req)
  if (!auth.ok) {
    return res.status(403).json({ success: false, error: 'Admin authorization required' })
  }

  const body = readBody(req)
  const ticker = String(body.ticker ?? '').trim()
  const creatorTokenRaw = String(body.creatorToken ?? '').trim()
  const groupId = String(body.groupId ?? 'api').trim() || 'api'
  const vaultAddress = String(body.vaultAddress ?? '').trim().toLowerCase() || null

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
        source: 'api_trend_funnel_run',
      },
    })

    const result = await runTrendFunnel({
      ticker: preflight.ticker,
      tickerHash: preflight.tickerHash,
      trendCoinAddress: preflight.predictedAddress,
      creatorToken: creatorTokenRaw.toLowerCase() as `0x${string}`,
      groupId,
      notionalWei: parseNotionalWei(body),
    })

    return res.status(200).json({
      success: true,
      data: {
        ticker: preflight.ticker,
        tickerHash: preflight.tickerHash,
        trendCoinAddress: preflight.predictedAddress,
        result,
      },
    })
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: String(error?.message ?? 'trend_funnel_failed').slice(0, 220),
    })
  }
}

