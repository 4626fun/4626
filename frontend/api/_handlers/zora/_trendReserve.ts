import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAddress } from 'viem'

import { handleOptions, setCors } from '../../../server/zora/_shared.js'
import { readRequestPrincipal } from '../../../server/_lib/requestPrincipal.js'
import { isAdminAddress } from '../../../server/_lib/session.js'
import {
  markTrendOpDeployed,
  markTrendOpDeploying,
  markTrendOpFailed,
  upsertTrendPrediction,
} from '../../../server/_lib/zoraTrendOpsStore.js'
import { preflightTrendTicker, reserveTrendTicker } from '../../../server/zora/trends.js'

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

