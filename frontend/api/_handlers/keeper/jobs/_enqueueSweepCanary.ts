import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import { enqueueKeeperJob, type KeeperJob } from '../../../../server/_lib/keeperJobs/keeperJobs.js'

type SweepCanaryResponse = {
  enabled: boolean
  job: KeeperJob | null
  reason?: string
}

type PayoutRecipientMode = 'gauge' | 'payout_router'

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function envAddress(name: string): `0x${string}` | null {
  const value = env(name).toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(value) ? (value as `0x${string}`) : null
}

function payoutRecipientMode(): PayoutRecipientMode {
  return env('KEEPER_SWEEP_CANARY_PAYOUT_RECIPIENT_MODE') === 'payout_router' ? 'payout_router' : 'gauge'
}

function enforceInvariants(): boolean {
  return env('KEEPER_SWEEP_CANARY_ENFORCE_INVARIANTS').toLowerCase() !== 'false'
}

function readInvariantConfig():
  | {
      ok: true
      invariants: {
        creatorCoinAddress: `0x${string}`
        shareTokenAddress: `0x${string}`
        gaugeControllerAddress: `0x${string}`
        burnStreamAddress?: `0x${string}`
        payoutRouterAddress?: `0x${string}`
        payoutRecipientMode: PayoutRecipientMode
      }
    }
  | { ok: false; reason: string } {
  const creatorCoinAddress = envAddress('KEEPER_SWEEP_CANARY_CREATOR_COIN_ADDRESS')
  const shareTokenAddress = envAddress('KEEPER_SWEEP_CANARY_SHARE_TOKEN_ADDRESS')
  const gaugeControllerAddress = envAddress('KEEPER_SWEEP_CANARY_GAUGE_CONTROLLER_ADDRESS')
  if (!creatorCoinAddress || !shareTokenAddress || !gaugeControllerAddress) {
    return { ok: false, reason: 'missing_required_invariant_env' }
  }

  const mode = payoutRecipientMode()
  if (mode === 'payout_router') {
    const burnStreamAddress = envAddress('KEEPER_SWEEP_CANARY_BURN_STREAM_ADDRESS')
    const payoutRouterAddress = envAddress('KEEPER_SWEEP_CANARY_PAYOUT_ROUTER_ADDRESS')
    if (!burnStreamAddress || !payoutRouterAddress) {
      return { ok: false, reason: 'missing_router_invariant_env' }
    }
    return {
      ok: true,
      invariants: {
        creatorCoinAddress,
        shareTokenAddress,
        gaugeControllerAddress,
        burnStreamAddress,
        payoutRouterAddress,
        payoutRecipientMode: mode,
      },
    }
  }

  return {
    ok: true,
    invariants: {
      creatorCoinAddress,
      shareTokenAddress,
      gaugeControllerAddress,
      payoutRecipientMode: mode,
    },
  }
}

function markSettledConfig(): { vaultAddress: `0x${string}` } | null {
  const vaultAddress = envAddress('KEEPER_SWEEP_CANARY_VAULT_ADDRESS')
  return vaultAddress ? { vaultAddress } : null
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

  const ccaStrategyAddress = envAddress('KEEPER_SWEEP_CANARY_CCA_STRATEGY_ADDRESS')
  if (!ccaStrategyAddress) {
    return res.status(200).json({
      success: true,
      data: { enabled: false, job: null, reason: 'not_configured' },
    } satisfies ApiEnvelope<SweepCanaryResponse>)
  }

  const shouldEnforceInvariants = enforceInvariants()
  const invariantConfig = shouldEnforceInvariants ? readInvariantConfig() : null
  if (invariantConfig && !invariantConfig.ok) {
    return res.status(503).json({
      success: false,
      error: invariantConfig.reason,
    } satisfies ApiEnvelope<never>)
  }

  const body = {
    ccaStrategyAddress,
    enforceInvariants: shouldEnforceInvariants,
    ...(invariantConfig?.ok ? { invariants: invariantConfig.invariants } : null),
    ...(markSettledConfig() ? { markSettled: markSettledConfig() } : null),
  }
  const job = await enqueueKeeperJob({
    kind: 'internal_api',
    dedupeKey: `sweep-canary:${ccaStrategyAddress}`,
    source: 'keeper-sweep-canary',
    payload: {
      path: '/api/keeper/sweep',
      body,
    },
    maxAttempts: 3,
  })

  return res.status(200).json({
    success: true,
    data: { enabled: true, job },
  } satisfies ApiEnvelope<SweepCanaryResponse>)
}
