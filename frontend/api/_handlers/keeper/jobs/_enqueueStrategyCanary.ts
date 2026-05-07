import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import { enqueueKeeprAction } from '../../../../server/_lib/keepr/keeprRegistry.js'
import { isKeeprTrustZoneWriteEnabled } from '../../../../server/_lib/agentControl/trustZones.js'

type StrategyCanaryJob = {
  id: number
  actionType: string
  dedupeKey: string
}

type StrategyCanaryResponse = {
  enabled: boolean
  jobs: StrategyCanaryJob[]
  reason?: string
}

const VALID_ACTIONS = new Set(['ajna', 'charm'])

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function enabled(): boolean {
  return ['1', 'true', 'yes'].includes(env('KEEPER_STRATEGY_CANARY_ENABLED').toLowerCase())
}

function envAddress(name: string): `0x${string}` | null {
  const value = env(name).toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(value) ? (value as `0x${string}`) : null
}

function readActions(): Array<'ajna' | 'charm'> {
  const raw = env('KEEPER_STRATEGY_CANARY_ACTIONS')
  if (!raw) return []
  const out: Array<'ajna' | 'charm'> = []
  for (const part of raw.split(/[\s,]+/g)) {
    const action = part.trim().toLowerCase()
    if (VALID_ACTIONS.has(action) && !out.includes(action as 'ajna' | 'charm')) {
      out.push(action as 'ajna' | 'charm')
    }
  }
  return out
}

function readTargetBucket(): string | null {
  const raw = env('KEEPER_STRATEGY_CANARY_AJNA_TARGET_BUCKET')
  if (!/^\d+$/.test(raw)) return null
  const value = BigInt(raw)
  return value >= 0n && value <= 7388n ? raw : null
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
    } satisfies ApiEnvelope<StrategyCanaryResponse>)
  }
  if (!isKeeprTrustZoneWriteEnabled('financial_execution', process.env)) {
    return res.status(503).json({
      success: false,
      error: 'financial_execution_trust_zone_disabled',
    } satisfies ApiEnvelope<never>)
  }

  const vaultAddress = envAddress('KEEPER_STRATEGY_CANARY_VAULT_ADDRESS')
  const groupId = env('KEEPER_STRATEGY_CANARY_GROUP_ID')
  if (!vaultAddress || !groupId) {
    return res.status(200).json({
      success: true,
      data: { enabled: false, jobs: [], reason: 'missing_vault_or_group' },
    } satisfies ApiEnvelope<StrategyCanaryResponse>)
  }

  const jobs: StrategyCanaryJob[] = []
  for (const action of readActions()) {
    if (action === 'ajna') {
      const authAddress = envAddress('KEEPER_STRATEGY_CANARY_AJNA_AUTH_ADDRESS')
      const strategyAddress = envAddress('KEEPER_STRATEGY_CANARY_AJNA_STRATEGY_ADDRESS')
      const targetBucket = readTargetBucket()
      if (!authAddress || !targetBucket) continue
      const actionType = 'strategy.ajna.rebucket'
      const dedupeKey = `strategy-canary:ajna:${vaultAddress}:${authAddress}:${targetBucket}`
      const { id } = await enqueueKeeprAction({
        vaultAddress,
        groupId,
        actionType,
        dedupeKey,
        action: {
          action: actionType,
          actionType,
          vaultAddress,
          authAddress,
          targetAddress: authAddress,
          ...(strategyAddress ? { strategyAddress } : null),
          targetBucket,
          method: 'setMinBucketIndex',
        },
      })
      jobs.push({ id, actionType, dedupeKey })
    }

    if (action === 'charm') {
      const charmVaultAddress = envAddress('KEEPER_STRATEGY_CANARY_CHARM_VAULT_ADDRESS')
      if (!charmVaultAddress) continue
      const actionType = 'strategy.charm.rebalance'
      const dedupeKey = `strategy-canary:charm:${vaultAddress}:${charmVaultAddress}`
      const { id } = await enqueueKeeprAction({
        vaultAddress,
        groupId,
        actionType,
        dedupeKey,
        action: {
          action: actionType,
          actionType,
          vaultAddress,
          charmVaultAddress,
          strategyAddress: charmVaultAddress,
        },
      })
      jobs.push({ id, actionType, dedupeKey })
    }
  }

  return res.status(200).json({
    success: true,
    data: { enabled: true, jobs },
  } satisfies ApiEnvelope<StrategyCanaryResponse>)
}
