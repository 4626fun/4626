import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  requireKeeprApiKey,
  requireOptionalHeaderEnvAuth,
  setCors,
  setNoStore,
  getDb,
  isDbConfigured,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  RATE_LIMITS,
} from '../../../../packages/server-core/src/index.js'

import { getKeeprVaultAutomationByVaultAddress } from '../../../../server/_lib/keeprAutomation.js'

import { enqueueKeeprAction } from '../../../../server/_lib/keeprRegistry.js'
import {
  KEEPR_TRUST_ZONE_KEY_HEADER,
  formatTrustZoneDisabledError,
  resolveKeeprEffectiveActionType,
  getKeeprTrustZoneEnvKey,
  isKeeprTrustZoneWriteEnabled,
  resolveKeeprTrustZone,
} from '../../../../server/_lib/agentControl/trustZones.js'

declare const process: { env: Record<string, string | undefined> }

type EnqueueBody = {
  vaultAddress?: string
  groupId?: string
  actionType?: string | null
  dedupeKey?: string | null
  action?: Record<string, unknown>
}

type EnqueueResponse = {
  id: number
  trustZone: string
}

const AJNA_AUTOMATION_SCOPE = 'ajna_min_bucket_only'
const AJNA_ACTION_TYPES = new Set([
  'strategy.ajna.rebucket',
  'ajna_rebucket',
  'ajnaRebucket',
])

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function isAjnaRebucketAction(actionType: string | null): boolean {
  return actionType !== null && AJNA_ACTION_TYPES.has(actionType)
}

function getAjnaAutomationPrecheckError(
  row: Awaited<ReturnType<typeof getKeeprVaultAutomationByVaultAddress>>,
): string | null {
  if (
    !row?.canonicalCswAddress ||
    !isAddressLike(row.canonicalCswAddress) ||
    !row?.embeddedEoaAddress ||
    !isAddressLike(row.embeddedEoaAddress) ||
    !row?.privyWalletId
  ) {
    return 'Ajna automation is not enabled for this vault'
  }
  if (!row.automationEnabled || row.revokedAt) {
    return 'Ajna automation is disabled for this vault'
  }
  if (row.automationScope !== AJNA_AUTOMATION_SCOPE) {
    return 'Ajna automation scope is invalid for this vault'
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  const limiter = checkRateLimit(rateLimitKey('keepr:actions:enqueue', getClientIp(req)), RATE_LIMITS.creRuntimeDecisionsWrite)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res, { missingSecretError: 'Server misconfigured' })) return

  const body = (await readJsonBody(req, { maxBytes: 512_000 })) ?? {}
  const vaultAddressRaw = typeof body.vaultAddress === 'string' ? body.vaultAddress.trim().toLowerCase() : ''
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : ''
  const actionType = typeof body.actionType === 'string' ? body.actionType.trim() : null
  const dedupeKey = typeof body.dedupeKey === 'string' ? body.dedupeKey.trim() : null
  const action =
    body.action && typeof body.action === 'object' && !Array.isArray(body.action)
      ? body.action
      : null

  if (!isAddressLike(vaultAddressRaw)) {
    return res.status(400).json({ success: false, error: 'Invalid vaultAddress' } satisfies ApiEnvelope<never>)
  }
  if (!groupId) {
    return res.status(400).json({ success: false, error: 'Invalid groupId' } satisfies ApiEnvelope<never>)
  }
  if (!action) {
    return res.status(400).json({ success: false, error: 'Invalid action payload' } satisfies ApiEnvelope<never>)
  }
  if (!actionType) {
    return res.status(400).json({ success: false, error: 'Invalid actionType' } satisfies ApiEnvelope<never>)
  }
  if (dedupeKey !== null && dedupeKey.length === 0) {
    return res.status(400).json({ success: false, error: 'Invalid dedupeKey' } satisfies ApiEnvelope<never>)
  }

  const effectiveActionType = resolveKeeprEffectiveActionType(actionType, action) ?? actionType
  const trustZone = resolveKeeprTrustZone(effectiveActionType)
  const trustZoneEnvKey = getKeeprTrustZoneEnvKey(trustZone)
  if (
    !requireOptionalHeaderEnvAuth(req, res, {
      envKey: trustZoneEnvKey,
      headerName: KEEPR_TRUST_ZONE_KEY_HEADER,
      unauthorizedError: `Unauthorized trust zone: ${trustZone}`,
    })
  ) {
    return
  }
  if (!isKeeprTrustZoneWriteEnabled(trustZone, process.env)) {
    return res.status(503).json({
      success: false,
      error: formatTrustZoneDisabledError(trustZone),
    } satisfies ApiEnvelope<never>)
  }

  try {
    if (isAjnaRebucketAction(effectiveActionType)) {
      const automation = await getKeeprVaultAutomationByVaultAddress(vaultAddressRaw as `0x${string}`)
      if (!automation) {
        const db = isDbConfigured() ? await getDb() : null
        if (!db) {
          return res.status(503).json({
            success: false,
            error: 'Ajna automation backend unavailable',
          } satisfies ApiEnvelope<never>)
        }
      }
      const precheckError = getAjnaAutomationPrecheckError(automation)
      if (precheckError) {
        return res.status(409).json({ success: false, error: precheckError } satisfies ApiEnvelope<never>)
      }
    }

    const { id } = await enqueueKeeprAction({
      vaultAddress: vaultAddressRaw,
      groupId,
      action,
      actionType: effectiveActionType,
      dedupeKey: dedupeKey || null,
    })
    return res.status(200).json({
      success: true,
      data: { id, trustZone },
    } satisfies ApiEnvelope<EnqueueResponse>)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
