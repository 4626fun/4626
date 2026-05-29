import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '@4626/server-core'
import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import { enqueueKeeprAction } from '../../../../server/_lib/keepr/keeprRegistry.js'
import { isKeeprTrustZoneWriteEnabled } from '../../../../server/_lib/agentControl/trustZones.js'

type StrategySignalTarget = {
  actionType?: string
  vaultAddress?: string
  groupId?: string
  dedupeKey?: string
  action?: Record<string, unknown>
}

type StrategySignalResponse = {
  enabled: boolean
  jobs: Array<{ id: number; actionType: string; dedupeKey: string }>
  reason?: string
}

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function enabled(): boolean {
  return ['1', 'true', 'yes'].includes(env('KEEPER_STRATEGY_SIGNALS_ENABLED').toLowerCase())
}

function isAddressLike(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

function readTargets(): StrategySignalTarget[] {
  const raw = env('KEEPER_STRATEGY_SIGNALS_TARGETS_JSON')
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === 'object') : []
  } catch {
    return []
  }
}

function validActionType(value: unknown): 'strategy.ajna.rebucket' | 'strategy.charm.rebalance' | null {
  if (value === 'strategy.ajna.rebucket' || value === 'strategy.charm.rebalance') return value
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ success: false, error: 'unauthorized' } satisfies ApiEnvelope<never>)
  }

  if (!enabled()) {
    return res.status(200).json({
      success: true,
      data: { enabled: false, jobs: [], reason: 'disabled' },
    } satisfies ApiEnvelope<StrategySignalResponse>)
  }
  if (!isKeeprTrustZoneWriteEnabled('financial_execution', process.env)) {
    return res.status(503).json({
      success: false,
      error: 'financial_execution_trust_zone_disabled',
    } satisfies ApiEnvelope<never>)
  }

  const jobs: StrategySignalResponse['jobs'] = []
  for (const target of readTargets()) {
    const actionType = validActionType(target.actionType)
    const vaultAddress = isAddressLike(target.vaultAddress) ? target.vaultAddress.toLowerCase() as `0x${string}` : null
    const groupId = typeof target.groupId === 'string' ? target.groupId.trim() : ''
    const action = target.action && typeof target.action === 'object' && !Array.isArray(target.action) ? target.action : null
    if (!actionType || !vaultAddress || !groupId || !action) continue
    const dedupeKey =
      typeof target.dedupeKey === 'string' && target.dedupeKey.trim()
        ? target.dedupeKey.trim()
        : `strategy-signal:${actionType}:${vaultAddress}:${JSON.stringify(action).slice(0, 120)}`

    const { id } = await enqueueKeeprAction({
      vaultAddress,
      groupId,
      actionType,
      dedupeKey,
      action: {
        ...action,
        action: actionType,
        actionType,
        vaultAddress,
      },
    })
    jobs.push({ id, actionType, dedupeKey })
  }

  return res.status(200).json({
    success: true,
    data: { enabled: true, jobs },
  } satisfies ApiEnvelope<StrategySignalResponse>)
}
