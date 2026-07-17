/**
 * Durable Solana lottery entry inbox (SOL-P0-02 / SOL-P1-01 / SOL-P1-02).
 *
 * Exactly-once: unique source_event_id, FOR UPDATE SKIP LOCKED leases,
 * crash-after-submit recovery via submitted/confirmed receipts before retry.
 */

import { ensureSolanaLotteryEntryInboxSchema } from '../db/schemaBootstrap.js'
import { buildSolanaLotterySourceEventId } from './solanaLotterySourceEventId.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type SolanaLotteryInboxStatus =
  | 'pending'
  | 'leased'
  | 'submitting'
  | 'submitted'
  | 'confirmed'
  | 'quarantined'
  | 'skipped_pricing'
  | 'skipped_identity'

export type SolanaLotteryInstructionKind = 'buy_path' | 'relay_entries_reemit'

export type SolanaLotteryInboxRow = {
  id: number
  sourceEventId: string
  clusterGenesisHash: string
  programId: string
  signature: string
  instructionIndex: number
  eventIndex: number
  instructionKind: SolanaLotteryInstructionKind
  creatorMint: string
  buyerSolana: string
  amountRaw: string
  slot: number
  blockTime: string | null
  commitment: 'finalized'
  status: SolanaLotteryInboxStatus
  beneficiaryCsw: string | null
  profileId: string | null
  shareOft: string | null
  amountScaled: string | null
  coverageShareBalance: string
  leaseOwner: string | null
  leaseExpiresAt: string | null
  leasedAt: string | null
  quarantineReason: string | null
  skipReason: string | null
  lzGuid: string | null
  baseTxHash: string | null
  submittedAt: string | null
  confirmedAt: string | null
  attemptCount: number
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export type UpsertInboxEventInput = {
  clusterGenesisHash: string
  programId: string
  signature: string
  instructionIndex: number
  eventIndex: number
  instructionKind: SolanaLotteryInstructionKind
  creatorMint: string
  buyerSolana: string
  amountRaw: string | number | bigint
  slot: number
  blockTime?: Date | string | null
}

let schemaEnsured = false

/** Test-only: reset schema-once cache. */
export function __resetSolanaLotteryEntryInboxSchemaEnsuredForTest(): void {
  schemaEnsured = false
}

async function ensureSchema(db: Db): Promise<void> {
  if (schemaEnsured) return
  await ensureSolanaLotteryEntryInboxSchema(db)
  schemaEnsured = true
}

function mapRow(row: any): SolanaLotteryInboxRow {
  return {
    id: Number(row.id),
    sourceEventId: String(row.source_event_id ?? ''),
    clusterGenesisHash: String(row.cluster_genesis_hash ?? ''),
    programId: String(row.program_id ?? ''),
    signature: String(row.signature ?? ''),
    instructionIndex: Number(row.instruction_index ?? 0),
    eventIndex: Number(row.event_index ?? 0),
    instructionKind: String(row.instruction_kind ?? 'buy_path') as SolanaLotteryInstructionKind,
    creatorMint: String(row.creator_mint ?? ''),
    buyerSolana: String(row.buyer_solana ?? ''),
    amountRaw: String(row.amount_raw ?? '0'),
    slot: Number(row.slot ?? 0),
    blockTime: row.block_time ? new Date(row.block_time).toISOString() : null,
    commitment: 'finalized',
    status: String(row.status ?? 'pending') as SolanaLotteryInboxStatus,
    beneficiaryCsw: row.beneficiary_csw ? String(row.beneficiary_csw) : null,
    profileId: row.profile_id ? String(row.profile_id) : null,
    shareOft: row.share_oft ? String(row.share_oft) : null,
    amountScaled: row.amount_scaled != null ? String(row.amount_scaled) : null,
    coverageShareBalance: String(row.coverage_share_balance ?? '0'),
    leaseOwner: row.lease_owner ? String(row.lease_owner) : null,
    leaseExpiresAt: row.lease_expires_at ? new Date(row.lease_expires_at).toISOString() : null,
    leasedAt: row.leased_at ? new Date(row.leased_at).toISOString() : null,
    quarantineReason: row.quarantine_reason ? String(row.quarantine_reason) : null,
    skipReason: row.skip_reason ? String(row.skip_reason) : null,
    lzGuid: row.lz_guid ? String(row.lz_guid) : null,
    baseTxHash: row.base_tx_hash ? String(row.base_tx_hash) : null,
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
    attemptCount: Number(row.attempt_count ?? 0),
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: new Date(row.created_at ?? Date.now()).toISOString(),
    updatedAt: new Date(row.updated_at ?? Date.now()).toISOString(),
  }
}

/** Insert buy-path events; ignore relay_entries re-emits as eligibility (still upsert for audit). */
export async function upsertSolanaLotteryInboxEvent(
  db: Db,
  input: UpsertInboxEventInput,
): Promise<{ row: SolanaLotteryInboxRow; inserted: boolean }> {
  await ensureSchema(db)
  const sourceEventId = buildSolanaLotterySourceEventId({
    clusterGenesisHash: input.clusterGenesisHash,
    programId: input.programId,
    signature: input.signature,
    instructionIndex: input.instructionIndex,
    eventIndex: input.eventIndex,
  })
  const amountRaw = String(input.amountRaw)
  const blockTime = input.blockTime ? new Date(input.blockTime) : null

  const result = await db.sql`
    INSERT INTO solana_lottery_entry_inbox (
      source_event_id,
      cluster_genesis_hash,
      program_id,
      signature,
      instruction_index,
      event_index,
      instruction_kind,
      creator_mint,
      buyer_solana,
      amount_raw,
      slot,
      block_time,
      commitment,
      status
    ) VALUES (
      ${sourceEventId},
      ${input.clusterGenesisHash.trim()},
      ${input.programId.trim()},
      ${input.signature.trim()},
      ${input.instructionIndex},
      ${input.eventIndex},
      ${input.instructionKind},
      ${input.creatorMint.trim()},
      ${input.buyerSolana.trim()},
      ${amountRaw},
      ${input.slot},
      ${blockTime},
      'finalized',
      'pending'
    )
    ON CONFLICT (source_event_id) DO UPDATE
      SET updated_at = solana_lottery_entry_inbox.updated_at
    RETURNING *, (xmax = 0) AS inserted
  `

  const row = result.rows?.[0]
  if (!row) throw new Error('inbox_upsert_failed')
  return { row: mapRow(row), inserted: Boolean(row.inserted) }
}

export async function findInboxBySourceEventId(
  db: Db,
  sourceEventId: string,
): Promise<SolanaLotteryInboxRow | null> {
  await ensureSchema(db)
  const result = await db.sql`
    SELECT * FROM solana_lottery_entry_inbox
    WHERE source_event_id = ${sourceEventId}
    LIMIT 1
  `
  const row = result.rows?.[0]
  return row ? mapRow(row) : null
}

const DEFAULT_LEASE_MS = 120_000

/**
 * Claim pending buy_path rows for submit workers.
 * Uses FOR UPDATE SKIP LOCKED so concurrent replicas do not double-process.
 */
export async function claimSolanaLotteryInboxLeases(params: {
  db: Db
  leaseOwner: string
  limit?: number
  leaseMs?: number
}): Promise<SolanaLotteryInboxRow[]> {
  await ensureSchema(params.db)
  const limit = Math.max(1, Math.min(params.limit ?? 10, 50))
  const leaseMs = Math.max(5_000, params.leaseMs ?? DEFAULT_LEASE_MS)
  const leaseOwner = params.leaseOwner.trim()
  if (!leaseOwner) throw new Error('invalid_lease_owner')

  const result = await params.db.sql`
    WITH candidates AS (
      SELECT id
      FROM solana_lottery_entry_inbox
      WHERE instruction_kind = 'buy_path'
        AND (
          status = 'pending'
          OR (status = 'leased' AND lease_expires_at IS NOT NULL AND lease_expires_at < NOW())
          -- Never auto-claim expired submitting — reclaimStrandedSubmittingQuarantine handles that.
        )
      ORDER BY id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE solana_lottery_entry_inbox AS inbox
    SET
      status = 'leased',
      lease_owner = ${leaseOwner},
      leased_at = NOW(),
      lease_expires_at = NOW() + (${leaseMs} || ' milliseconds')::interval,
      attempt_count = inbox.attempt_count + 1,
      updated_at = NOW()
    FROM candidates
    WHERE inbox.id = candidates.id
    RETURNING inbox.*
  `

  return (result.rows ?? []).map(mapRow)
}

export async function markInboxIdentity(params: {
  db: Db
  id: number
  beneficiaryCsw: string
  profileId: string
  shareOft: string
  amountScaled: string
}): Promise<SolanaLotteryInboxRow> {
  await ensureSchema(params.db)
  const result = await params.db.sql`
    UPDATE solana_lottery_entry_inbox
    SET
      beneficiary_csw = ${params.beneficiaryCsw.toLowerCase()},
      profile_id = ${params.profileId},
      share_oft = ${params.shareOft.toLowerCase()},
      amount_scaled = ${params.amountScaled},
      coverage_share_balance = 0,
      updated_at = NOW()
    WHERE id = ${params.id}
    RETURNING *
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('inbox_mark_identity_failed')
  return mapRow(row)
}

export async function markInboxSkippedIdentity(params: {
  db: Db
  id: number
  leaseOwner: string
  reason: string
}): Promise<SolanaLotteryInboxRow> {
  await ensureSchema(params.db)
  const leaseOwner = params.leaseOwner.trim()
  if (!leaseOwner) throw new Error('invalid_lease_owner')
  const result = await params.db.sql`
    UPDATE solana_lottery_entry_inbox
    SET
      status = 'skipped_identity',
      skip_reason = ${params.reason},
      lease_owner = NULL,
      lease_expires_at = NULL,
      updated_at = NOW()
    WHERE id = ${params.id}
      AND lease_owner = ${leaseOwner}
      AND status IN ('leased', 'submitting')
      AND lease_expires_at IS NOT NULL
      AND lease_expires_at > NOW()
    RETURNING *
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('inbox_skip_identity_failed')
  return mapRow(row)
}

export async function markInboxSkippedPricing(params: {
  db: Db
  id: number
  leaseOwner: string
  reason: string
}): Promise<SolanaLotteryInboxRow> {
  await ensureSchema(params.db)
  const leaseOwner = params.leaseOwner.trim()
  if (!leaseOwner) throw new Error('invalid_lease_owner')
  const result = await params.db.sql`
    UPDATE solana_lottery_entry_inbox
    SET
      status = 'skipped_pricing',
      skip_reason = ${params.reason},
      lease_owner = NULL,
      lease_expires_at = NULL,
      updated_at = NOW()
    WHERE id = ${params.id}
      AND lease_owner = ${leaseOwner}
      AND status IN ('leased', 'submitting')
      AND lease_expires_at IS NOT NULL
      AND lease_expires_at > NOW()
    RETURNING *
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('inbox_skip_pricing_failed')
  return mapRow(row)
}

export async function markInboxQuarantined(params: {
  db: Db
  id: number
  reason: string
  leaseOwner?: string
}): Promise<SolanaLotteryInboxRow> {
  await ensureSchema(params.db)
  const leaseOwner = params.leaseOwner?.trim() || null
  const result = leaseOwner
    ? await params.db.sql`
        UPDATE solana_lottery_entry_inbox
        SET
          status = 'quarantined',
          quarantine_reason = ${params.reason},
          lease_owner = NULL,
          lease_expires_at = NULL,
          last_error = ${params.reason},
          updated_at = NOW()
        WHERE id = ${params.id}
          AND lease_owner = ${leaseOwner}
          AND status IN ('leased', 'submitting')
        RETURNING *
      `
    : await params.db.sql`
        UPDATE solana_lottery_entry_inbox
        SET
          status = 'quarantined',
          quarantine_reason = ${params.reason},
          lease_owner = NULL,
          lease_expires_at = NULL,
          last_error = ${params.reason},
          updated_at = NOW()
        WHERE id = ${params.id}
          AND status = 'submitting'
          AND lease_expires_at IS NOT NULL
          AND lease_expires_at < NOW()
          AND lz_guid IS NULL
          AND base_tx_hash IS NULL
        RETURNING *
      `
  const row = result.rows?.[0]
  if (!row) throw new Error('inbox_quarantine_failed')
  return mapRow(row)
}

/**
 * Persist submit intent before any external LZ send.
 * Requires owning an unexpired lease.
 */
export async function beginInboxSubmit(params: {
  db: Db
  id: number
  leaseOwner: string
}): Promise<SolanaLotteryInboxRow> {
  await ensureSchema(params.db)
  const leaseOwner = params.leaseOwner.trim()
  if (!leaseOwner) throw new Error('invalid_lease_owner')
  const result = await params.db.sql`
    UPDATE solana_lottery_entry_inbox
    SET
      status = 'submitting',
      updated_at = NOW()
    WHERE id = ${params.id}
      AND status = 'leased'
      AND lease_owner = ${leaseOwner}
      AND lease_expires_at IS NOT NULL
      AND lease_expires_at > NOW()
    RETURNING *
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('inbox_begin_submit_failed')
  return mapRow(row)
}

/**
 * Mark submitted after transport accepted the message.
 * Requires receipt + matching lease owner on a submitting row.
 */
export async function markInboxSubmitted(params: {
  db: Db
  id: number
  leaseOwner: string
  lzGuid?: string | null
  baseTxHash?: string | null
}): Promise<SolanaLotteryInboxRow> {
  await ensureSchema(params.db)
  const leaseOwner = params.leaseOwner.trim()
  if (!leaseOwner) throw new Error('invalid_lease_owner')
  const lzGuid = params.lzGuid ? String(params.lzGuid).trim() : ''
  const baseTxHash = params.baseTxHash ? String(params.baseTxHash).trim() : ''
  if (!lzGuid && !baseTxHash) throw new Error('inbox_submitted_requires_receipt')

  const result = await params.db.sql`
    UPDATE solana_lottery_entry_inbox
    SET
      status = 'submitted',
      lz_guid = COALESCE(${lzGuid || null}, lz_guid),
      base_tx_hash = COALESCE(${baseTxHash || null}, base_tx_hash),
      submitted_at = NOW(),
      lease_owner = NULL,
      lease_expires_at = NULL,
      updated_at = NOW()
    WHERE id = ${params.id}
      AND status = 'submitting'
      AND lease_owner = ${leaseOwner}
      AND lease_expires_at IS NOT NULL
      AND lease_expires_at > NOW()
    RETURNING *
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('inbox_mark_submitted_failed')
  return mapRow(row)
}

export async function markInboxConfirmed(params: {
  db: Db
  id: number
  lzGuid?: string | null
  baseTxHash?: string | null
}): Promise<SolanaLotteryInboxRow> {
  await ensureSchema(params.db)
  const result = await params.db.sql`
    UPDATE solana_lottery_entry_inbox
    SET
      status = 'confirmed',
      lz_guid = COALESCE(${params.lzGuid ?? null}, lz_guid),
      base_tx_hash = COALESCE(${params.baseTxHash ?? null}, base_tx_hash),
      confirmed_at = NOW(),
      lease_owner = NULL,
      lease_expires_at = NULL,
      updated_at = NOW()
    WHERE id = ${params.id}
      AND status IN ('submitted', 'confirmed')
    RETURNING *
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('inbox_mark_confirmed_failed')
  return mapRow(row)
}

/** Release a lease back to pending after a fail-closed transport error (retryable). */
export async function releaseInboxLease(params: {
  db: Db
  id: number
  leaseOwner: string
  lastError: string
}): Promise<SolanaLotteryInboxRow> {
  await ensureSchema(params.db)
  const leaseOwner = params.leaseOwner.trim()
  if (!leaseOwner) throw new Error('invalid_lease_owner')
  const result = await params.db.sql`
    UPDATE solana_lottery_entry_inbox
    SET
      status = 'pending',
      lease_owner = NULL,
      lease_expires_at = NULL,
      last_error = ${params.lastError},
      updated_at = NOW()
    WHERE id = ${params.id}
      AND lease_owner = ${leaseOwner}
      AND status IN ('leased', 'submitting')
    RETURNING *
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('inbox_release_lease_failed')
  return mapRow(row)
}

/**
 * Expired submitting rows without a receipt are quarantined — never auto-resubmitted.
 */
export async function reclaimStrandedSubmittingQuarantine(params: {
  db: Db
  limit?: number
}): Promise<number> {
  await ensureSchema(params.db)
  const limit = Math.max(1, Math.min(params.limit ?? 50, 200))
  const result = await params.db.sql`
    WITH stranded AS (
      SELECT id
      FROM solana_lottery_entry_inbox
      WHERE status = 'submitting'
        AND lease_expires_at IS NOT NULL
        AND lease_expires_at < NOW()
        AND lz_guid IS NULL
        AND base_tx_hash IS NULL
      ORDER BY id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE solana_lottery_entry_inbox AS inbox
    SET
      status = 'quarantined',
      quarantine_reason = 'submit_crash_unconfirmed',
      last_error = 'submit_crash_unconfirmed',
      lease_owner = NULL,
      lease_expires_at = NULL,
      updated_at = NOW()
    FROM stranded
    WHERE inbox.id = stranded.id
    RETURNING inbox.id
  `
  return Array.isArray(result.rows) ? result.rows.length : 0
}

/**
 * Explicit recovery path: re-open quarantined rows for replay.
 * Not used by ambient cron — operator/recovery only.
 */
export async function replayQuarantinedInboxEvent(params: {
  db: Db
  sourceEventId: string
}): Promise<SolanaLotteryInboxRow> {
  await ensureSchema(params.db)
  const result = await params.db.sql`
    UPDATE solana_lottery_entry_inbox
    SET
      status = 'pending',
      quarantine_reason = NULL,
      lease_owner = NULL,
      lease_expires_at = NULL,
      last_error = NULL,
      updated_at = NOW()
    WHERE source_event_id = ${params.sourceEventId}
      AND status = 'quarantined'
    RETURNING *
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('inbox_replay_not_quarantined')
  return mapRow(row)
}

/**
 * Crash-after-submit: if already submitted/confirmed with a receipt, do not
 * create another Base entry — return the existing row for confirmation only.
 */
export async function getInboxSubmitRecoveryState(
  db: Db,
  sourceEventId: string,
): Promise<{
  canSubmit: boolean
  reason: string
  row: SolanaLotteryInboxRow | null
}> {
  const row = await findInboxBySourceEventId(db, sourceEventId)
  if (!row) return { canSubmit: false, reason: 'missing', row: null }
  if (row.status === 'confirmed') {
    return { canSubmit: false, reason: 'already_confirmed', row }
  }
  if (row.status === 'submitted' && (row.lzGuid || row.baseTxHash)) {
    return { canSubmit: false, reason: 'already_submitted_has_receipt', row }
  }
  if (row.status === 'submitting') {
    return { canSubmit: false, reason: 'submit_in_flight_or_crash', row }
  }
  if (row.status === 'quarantined' || row.status === 'skipped_identity' || row.status === 'skipped_pricing') {
    return { canSubmit: false, reason: `terminal_${row.status}`, row }
  }
  if (row.instructionKind !== 'buy_path') {
    return { canSubmit: false, reason: 'not_buy_path', row }
  }
  return { canSubmit: true, reason: 'ok', row }
}

export async function getIngestCursor(
  db: Db,
  cursorKey: string,
): Promise<{ lastSignature: string | null; lastSlot: number | null } | null> {
  await ensureSchema(db)
  const result = await db.sql`
    SELECT last_signature, last_slot
    FROM solana_lottery_ingest_cursor
    WHERE cursor_key = ${cursorKey}
    LIMIT 1
  `
  const row = result.rows?.[0]
  if (!row) return null
  return {
    lastSignature: row.last_signature ? String(row.last_signature) : null,
    lastSlot: row.last_slot != null ? Number(row.last_slot) : null,
  }
}

export async function advanceIngestCursor(params: {
  db: Db
  cursorKey: string
  programId: string
  lastSignature: string
  lastSlot: number
}): Promise<void> {
  await ensureSchema(params.db)
  await params.db.sql`
    INSERT INTO solana_lottery_ingest_cursor (
      cursor_key, program_id, last_signature, last_slot, commitment, updated_at
    ) VALUES (
      ${params.cursorKey},
      ${params.programId},
      ${params.lastSignature},
      ${params.lastSlot},
      'finalized',
      NOW()
    )
    ON CONFLICT (cursor_key) DO UPDATE SET
      last_signature = EXCLUDED.last_signature,
      last_slot = EXCLUDED.last_slot,
      program_id = EXCLUDED.program_id,
      updated_at = NOW()
  `
}
