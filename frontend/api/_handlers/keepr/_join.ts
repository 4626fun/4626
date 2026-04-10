import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  getDb,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  RATE_LIMITS,
} from '../../../packages/server-core/src/index.js'

import { checkSharesEligibility, getKeeprBaseRpcUrls } from '../../../server/_lib/keeprGating.js'
import { enqueueKeeprAction, getKeeprVaultByVaultAddress, isKeeprJoinLocked } from '../../../server/_lib/keeprRegistry.js'
import { ensureKeeprSchema } from '../../../server/_lib/keeprSchema.js'

import { verifyKeeprJoinProof } from '../../../server/_lib/keeprProof.js'

type JoinBody = {
  vaultAddress?: string
  message?: string
  signature?: string
}

type JoinResponse = {
  eligible: boolean
  reason: string
  lensGroupAddress?: `0x${string}`
  nextSteps?: string[]
  action?: any
  actionId?: number
  actionStatus?: 'queued' | 'watching' | 'needs_user_setup' | 'failed'
  evidence?: any
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

async function markJoinRequestQueued(params: {
  vaultAddress: `0x${string}`
  groupId: string
  wallet: `0x${string}`
  actionId: number
  reason: string
}) {
  try {
    const db = await getDb()
    if (!db) return
    await ensureKeeprSchema()

    await db.sql`
      UPDATE keepr_join_requests
      SET
        status = 'queued',
        group_id = ${params.groupId},
        action_id = ${params.actionId},
        last_reason = ${params.reason},
        last_checked_at = NOW(),
        next_check_at = NULL,
        updated_at = NOW()
      WHERE vault_address = ${String(params.vaultAddress).toLowerCase()}
        AND wallet_address = ${params.wallet}
        AND status IN ('watching', 'failed', 'cancelled', 'queued');
    `
    await db.sql`
      INSERT INTO keepr_join_requests (vault_address, group_id, wallet_address, status, last_reason, last_checked_at, next_check_at, action_id, updated_at)
      SELECT
        ${String(params.vaultAddress).toLowerCase()},
        ${params.groupId},
        ${params.wallet},
        ${'queued'},
        ${params.reason},
        NOW(),
        NULL,
        ${params.actionId},
        NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM keepr_join_requests
        WHERE vault_address = ${String(params.vaultAddress).toLowerCase()}
          AND wallet_address = ${params.wallet}
          AND status IN ('queued', 'added')
      );
    `
  } catch {
    // best effort
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  const limiter = checkRateLimit(rateLimitKey('keepr:join', getClientIp(req)), RATE_LIMITS.creatorQuickstart)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody(req, { maxBytes: 512_000 })) ?? {}
  const vaultRaw = typeof body?.vaultAddress === 'string' ? body.vaultAddress.trim() : ''
  const vaultAddress = isAddressLike(vaultRaw) ? (vaultRaw.toLowerCase() as `0x${string}`) : null
  if (!vaultAddress) {
    return res.status(400).json({ success: false, error: 'Missing vaultAddress' } satisfies ApiEnvelope<never>)
  }

  const message = typeof body?.message === 'string' ? body.message : ''
  const signature = typeof body?.signature === 'string' ? body.signature : ''
  if (!message || !signature) {
    return res.status(400).json({ success: false, error: 'Missing message or signature' } satisfies ApiEnvelope<never>)
  }

  let wallet: `0x${string}`
  try {
    const verified = await verifyKeeprJoinProof({
      req,
      message,
      signature,
      expectedVaultAddress: vaultAddress,
    })
    wallet = verified.wallet
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid proof'
    return res.status(401).json({
      success: true,
      data: {
        eligible: false,
        reason: msg,
        nextSteps: ['Request a fresh nonce', 'Sign the join message', 'Retry join'],
      } satisfies JoinResponse,
    } satisfies ApiEnvelope<JoinResponse>)
  }

  const vault = await getKeeprVaultByVaultAddress(vaultAddress)
  if (!vault) {
    return res.status(404).json({
      success: true,
      data: {
        eligible: false,
        reason: 'vault_not_registered',
        nextSteps: ['The vault is not yet configured for Keepr. Contact the creator to finish setup.'],
      } satisfies JoinResponse,
    } satisfies ApiEnvelope<JoinResponse>)
  }

  if (vault.chainId !== 8453) {
    return res.status(400).json({
      success: true,
      data: {
        eligible: false,
        reason: 'unsupported_chain',
        nextSteps: ['This vault is not configured for Base (8453).'],
      } satisfies JoinResponse,
    } satisfies ApiEnvelope<JoinResponse>)
  }

  const sharedJoinContext = {
    lensGroupAddress: vault.lensGroupAddress ?? undefined,
  }

  if (isKeeprJoinLocked(vault)) {
    return res.status(200).json({
      success: true,
      data: {
        ...sharedJoinContext,
        eligible: false,
        reason: 'join_locked',
        actionStatus: 'needs_user_setup',
        nextSteps: ['Joins are temporarily locked for this vault. Contact the creator/admin to reopen access.'],
      } satisfies JoinResponse,
    } satisfies ApiEnvelope<JoinResponse>)
  }

  if (!vault.gatingEnabled || vault.gatingMode === 'none') {
    // Gating disabled: allow join (this endpoint is already proof-based).

    const action = {
      action: 'xmtp.group.add_member',
      groupId: vault.groupId,
      wallet,
      reason: 'gating_disabled',
      evidence: { blockNumber: null },
    }
    const dedupeKey = `join:add_member:${vaultAddress}:${vault.groupId}:${wallet}`
    const { id } = await enqueueKeeprAction({ vaultAddress, groupId: vault.groupId, action, actionType: 'xmtp.group.add_member', dedupeKey })
    await markJoinRequestQueued({
      vaultAddress,
      groupId: vault.groupId,
      wallet,
      actionId: id,
      reason: 'gating_disabled',
    })
    return res.status(200).json({
      success: true,
      data: { ...sharedJoinContext, eligible: true, reason: 'eligible', action, actionId: id, actionStatus: 'queued' } satisfies JoinResponse,
    } satisfies ApiEnvelope<JoinResponse>)
  }

  if (vault.gatingMode !== 'shares') {
    return res.status(400).json({
      success: true,
      data: {
        ...sharedJoinContext,
        eligible: false,
        reason: 'unsupported_gating_mode',
        nextSteps: ['This vault is not configured for share-based gating.'],
      } satisfies JoinResponse,
    } satisfies ApiEnvelope<JoinResponse>)
  }

  const shareToken = vault.shareTokenAddress
  const minSharesRaw = vault.minShares
  const minShares = minSharesRaw
    ? (() => {
        try {
          return BigInt(minSharesRaw)
        } catch {
          return null
        }
      })()
    : null

  if (!shareToken || !minShares) {
    return res.status(400).json({
      success: true,
      data: {
        ...sharedJoinContext,
        eligible: false,
        reason: 'vault_misconfigured',
        nextSteps: ['The vault gating config is incomplete. Contact the creator.'],
      } satisfies JoinResponse,
    } satisfies ApiEnvelope<JoinResponse>)
  }

  const eligibility = await checkSharesEligibility({
    wallet,
    shareToken,
    minShares,
  })

  // Production-MVP hardening: require a second successful read to allow joins.
  // Fail closed if we can't establish onchain truth with reasonable confidence.
  const urls = getKeeprBaseRpcUrls()
  const remaining = eligibility.evidence.rpcUrl ? urls.filter((u) => u !== eligibility.evidence.rpcUrl) : urls
  const eligibility2 = await checkSharesEligibility({
    wallet,
    shareToken,
    minShares,
    rpcUrls: remaining.slice(0, 3),
  })

  const allowJoin = eligibility.eligible && eligibility2.eligible
  const combinedEvidence = {
    primary: eligibility.evidence,
    secondary: eligibility2.evidence,
  }

  if ((!allowJoin && (eligibility.reason === 'onchain_read_failed' || eligibility2.reason === 'onchain_read_failed')) && vault.failClosed) {
    return res.status(200).json({
      success: true,
      data: {
        ...sharedJoinContext,
        eligible: false,
        reason: 'verification_failed',
        actionStatus: 'watching',
        nextSteps: ['Try again in a minute. If this persists, contact the creator.'],
        evidence: combinedEvidence,
      } satisfies JoinResponse,
    } satisfies ApiEnvelope<JoinResponse>)
  }

  if (!allowJoin) {
    // Opt-in auto-add: if they're ineligible today, keep watching this wallet for this vault.
    // When they become eligible, Keepr will auto-enqueue an add_member action.
    try {
      const db = await getDb()
      if (db) {
        await ensureKeeprSchema()
        // Best-effort upsert without a unique constraint:
        // 1) Update existing row if present, else 2) insert a new row.
        await db.sql`
          UPDATE keepr_join_requests
            SET status = 'watching',
                group_id = ${vault.groupId},
                last_reason = ${'ineligible'},
                last_checked_at = NOW(),
                next_check_at = NOW() + INTERVAL '2 minutes',
                updated_at = NOW()
          WHERE vault_address = ${String(vaultAddress).toLowerCase()}
            AND wallet_address = ${wallet}
            AND status IN ('watching', 'failed', 'cancelled');
        `
        await db.sql`
          INSERT INTO keepr_join_requests (vault_address, group_id, wallet_address, status, last_reason, last_checked_at, next_check_at, updated_at)
          SELECT
            ${String(vaultAddress).toLowerCase()},
            ${vault.groupId},
            ${wallet},
            ${'watching'},
            ${'ineligible'},
            NOW(),
            NOW() + INTERVAL '2 minutes',
            NOW()
          WHERE NOT EXISTS (
            SELECT 1 FROM keepr_join_requests
            WHERE vault_address = ${String(vaultAddress).toLowerCase()}
              AND wallet_address = ${wallet}
              AND status = 'watching'
          );
        `
      }
    } catch {
      // ignore
    }
    return res.status(200).json({
      success: true,
      data: {
        ...sharedJoinContext,
        eligible: false,
        reason: 'ineligible',
        actionStatus: 'watching',
        nextSteps: ['Acquire the required vault shares', 'Keepr will auto-add you when you qualify'],
        evidence: combinedEvidence,
      } satisfies JoinResponse,
    } satisfies ApiEnvelope<JoinResponse>)
  }

  const action = {
    action: 'xmtp.group.add_member',
    groupId: vault.groupId,
    wallet,
    reason: eligibility.reason,
    evidence: combinedEvidence,
  }

  const dedupeKey = `join:add_member:${vaultAddress}:${vault.groupId}:${wallet}`
  const { id } = await enqueueKeeprAction({ vaultAddress, groupId: vault.groupId, action, actionType: 'xmtp.group.add_member', dedupeKey })
  await markJoinRequestQueued({
    vaultAddress,
    groupId: vault.groupId,
    wallet,
    actionId: id,
    reason: String(eligibility.reason),
  })

  return res.status(200).json({
    success: true,
    data: {
      ...sharedJoinContext,
      eligible: true,
      reason: 'eligible',
      action,
      actionId: id,
      actionStatus: 'queued',
      evidence: combinedEvidence,
    } satisfies JoinResponse,
  } satisfies ApiEnvelope<JoinResponse>)
}
