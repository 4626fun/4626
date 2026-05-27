import { executeKeeprAction } from '../../keepr/xmtpQueueExecutor.js'
import {
  formatTrustZoneDisabledError,
  isKeeprTrustZoneWriteEnabled,
  resolveKeeprTrustZone,
} from '../agentControl/trustZones.js'
import { WAITLIST_CHAT_VAULT_ADDRESS } from './waitlistXmtpChat.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

/** Keepr XMTP actions can stall in `executing` if the worker dies mid-flight. */
export const WAITLIST_CHAT_STALE_EXECUTING_SECONDS = 120

export type WaitlistChatJoinActionSnapshot = {
  actionId: number
  status: 'pending' | 'executing' | 'executed' | 'failed' | 'retry' | null
  lastError: string | null
}

export type WaitlistChatJoinExecutionOutcome = 'executed' | 'deferred' | 'failed'

export function buildWaitlistChatDedupeKey(groupId: string, xmtpMemberAddress: string): string {
  return `waitlist-chat:add:${groupId}:${xmtpMemberAddress.toLowerCase()}`
}

export async function readWaitlistChatJoinAction(
  db: Db,
  dedupeKey: string,
): Promise<WaitlistChatJoinActionSnapshot | null> {
  const result = await db.sql`
    SELECT id, status, last_error
    FROM keepr_actions
    WHERE dedupe_key = ${dedupeKey}
    ORDER BY created_at DESC
    LIMIT 1;
  `
  const row = result.rows?.[0] ?? null
  if (!row) return null
  const actionId = Number(row.id ?? 0)
  if (!Number.isInteger(actionId) || actionId <= 0) return null
  const status = typeof row.status === 'string' ? row.status : null
  if (
    status !== 'pending' &&
    status !== 'executing' &&
    status !== 'executed' &&
    status !== 'failed' &&
    status !== 'retry'
  ) {
    return { actionId, status: null, lastError: null }
  }
  return {
    actionId,
    status,
    lastError: typeof row.last_error === 'string' ? row.last_error : null,
  }
}

export async function executeWaitlistChatJoinActionNow(params: {
  db: Db
  actionId: number
  groupId: string
  action: Record<string, unknown>
  actionType?: string | null
  retryDelaySeconds?: number
}): Promise<{ outcome: WaitlistChatJoinExecutionOutcome; error?: string; retryable?: boolean }> {
  const trustZone = resolveKeeprTrustZone(params.actionType ?? 'xmtp.group.add_member')
  if (!isKeeprTrustZoneWriteEnabled(trustZone, process.env)) {
    return { outcome: 'deferred', error: formatTrustZoneDisabledError(trustZone) }
  }

  const existing = await params.db.sql`
    SELECT status
    FROM keepr_actions
    WHERE id = ${params.actionId}
    LIMIT 1;
  `
  const existingStatus = typeof existing.rows?.[0]?.status === 'string' ? existing.rows[0].status : null
  if (existingStatus === 'executed') {
    return { outcome: 'executed' }
  }

  const claim = await params.db.sql`
    UPDATE keepr_actions
    SET
      status = 'executing',
      attempt_count = attempt_count + 1,
      updated_at = NOW(),
      last_error = NULL
    WHERE id = ${params.actionId}
      AND (
        status IN ('pending', 'retry')
        OR (
          status = 'executing'
          AND updated_at < NOW() - (${WAITLIST_CHAT_STALE_EXECUTING_SECONDS} || ' seconds')::interval
        )
      )
    RETURNING id;
  `
  if ((claim.rows?.length ?? 0) === 0) {
    return { outcome: 'deferred' }
  }

  const result = await executeKeeprAction({
    id: params.actionId,
    vaultAddress: WAITLIST_CHAT_VAULT_ADDRESS,
    groupId: params.groupId,
    actionType: params.actionType ?? 'xmtp.group.add_member',
    action: params.action,
  })

  if (result.success) {
    await params.db.sql`
      UPDATE keepr_actions
      SET
        status = 'executed',
        executed_at = NOW(),
        updated_at = NOW(),
        last_error = NULL
      WHERE id = ${params.actionId}
        AND status = 'executing';
    `
    return { outcome: 'executed' }
  }

  const error = result.error ?? 'action_not_executed'
  const retryDelaySeconds = params.retryDelaySeconds ?? 60
  if (result.retryable) {
    await params.db.sql`
      UPDATE keepr_actions
      SET
        status = 'retry',
        last_error = ${String(error).slice(0, 2000)},
        next_attempt_at = NOW() + (${retryDelaySeconds} || ' seconds')::interval,
        updated_at = NOW()
      WHERE id = ${params.actionId}
        AND status = 'executing';
    `
    return { outcome: 'deferred', error, retryable: true }
  }

  await params.db.sql`
    UPDATE keepr_actions
    SET
      status = 'failed',
      last_error = ${String(error).slice(0, 2000)},
      updated_at = NOW()
    WHERE id = ${params.actionId}
      AND status = 'executing';
  `
  return { outcome: 'failed', error, retryable: false }
}
