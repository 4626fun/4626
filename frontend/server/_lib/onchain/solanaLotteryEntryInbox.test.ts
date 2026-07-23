import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/schemaBootstrap.js', () => ({
  ensureSolanaLotteryEntryInboxSchema: vi.fn(async () => {}),
}))

import {
  __resetSolanaLotteryEntryInboxSchemaEnsuredForTest,
  beginInboxSubmit,
  claimSolanaLotteryInboxLeases,
  getInboxSubmitRecoveryState,
  markInboxIdentity,
  markInboxConfirmed,
  markInboxSubmitted,
  reclaimStrandedSubmittingQuarantine,
  releaseInboxLease,
  replayQuarantinedInboxEvent,
  upsertSolanaLotteryInboxEvent,
} from './solanaLotteryEntryInbox.js'

interface SqlCall {
  strings: TemplateStringsArray
  values: unknown[]
}

function createDb(queue: Array<{ rows: any[] }>) {
  const calls: SqlCall[] = []
  const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ strings, values })
    if (queue.length === 0) return { rows: [] }
    return queue.shift()!
  })
  return { db: { sql }, calls }
}

const baseRow = {
  id: 1,
  source_event_id: 'g:p:sig:0:0',
  cluster_genesis_hash: 'g',
  program_id: 'p',
  signature: 'sig',
  instruction_index: 0,
  event_index: 0,
  instruction_kind: 'buy_path',
  creator_mint: 'mint',
  buyer_solana: '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY',
  amount_raw: '100',
  slot: 10,
  block_time: null,
  commitment: 'finalized',
  status: 'pending',
  beneficiary_csw: null,
  profile_id: null,
  share_oft: null,
  amount_scaled: null,
  coverage_share_balance: '0',
  lease_owner: null,
  lease_expires_at: null,
  leased_at: null,
  quarantine_reason: null,
  skip_reason: null,
  lz_guid: null,
  base_tx_hash: null,
  submitted_at: null,
  confirmed_at: null,
  submit_attempt_id: null,
  attempt_count: 0,
  last_error: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

describe('solanaLotteryEntryInbox', () => {
  beforeEach(() => {
    __resetSolanaLotteryEntryInboxSchemaEnsuredForTest()
  })

  it('upserts with unique source_event_id (duplicate replay is no-op insert)', async () => {
    const { db, calls } = createDb([{ rows: [{ ...baseRow, inserted: true }] }])
    const { inserted, row } = await upsertSolanaLotteryInboxEvent(db, {
      clusterGenesisHash: 'g',
      programId: 'p',
      signature: 'sig',
      instructionIndex: 0,
      eventIndex: 0,
      instructionKind: 'buy_path',
      creatorMint: 'mint',
      buyerSolana: '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY',
      amountRaw: '100',
      slot: 10,
    })
    expect(inserted).toBe(true)
    expect(row.sourceEventId).toBe('g:p:sig:0:0')
    expect(String(calls[0].strings.join('?'))).toContain('ON CONFLICT')
  })

  it('claims with FOR UPDATE SKIP LOCKED and excludes submitting', async () => {
    const { db, calls } = createDb([
      { rows: [{ ...baseRow, status: 'leased', lease_owner: 'worker-a', attempt_count: 1 }] },
    ])
    const leased = await claimSolanaLotteryInboxLeases({
      db,
      leaseOwner: 'worker-a',
      limit: 1,
    })
    expect(leased).toHaveLength(1)
    const sql = calls[0].strings.join(' ')
    expect(sql).toContain('FOR UPDATE SKIP LOCKED')
    expect(sql).toContain('submitting')
  })

  it('beginInboxSubmit requires lease owner predicate', async () => {
    const { db, calls } = createDb([
      { rows: [{ ...baseRow, status: 'submitting', lease_owner: 'worker-a' }] },
    ])
    const row = await beginInboxSubmit({
      db,
      id: 1,
      leaseOwner: 'worker-a',
      submitAttemptId: 'attempt-a',
    })
    expect(row.status).toBe('submitting')
    expect(calls[0].strings.join(' ')).toContain('lease_owner')
    expect(calls[0].strings.join(' ')).toContain('submit_attempt_id')
    expect(calls[0].strings.join(' ')).toContain('beneficiary_csw IS NOT NULL')
  })

  it('identity mapping requires the active lease owner', async () => {
    const { db, calls } = createDb([{ rows: [{ ...baseRow, status: 'leased' }] }])
    await markInboxIdentity({
      db,
      id: 1,
      beneficiaryCsw: '0x1111111111111111111111111111111111111111',
      profileId: 'profile-1',
      shareOft: '0x2222222222222222222222222222222222222222',
      amountScaled: '100',
      leaseOwner: 'worker-a',
    })
    const sql = calls[0].strings.join(' ')
    expect(sql).toContain("status = 'leased'")
    expect(sql).toContain('lease_owner')
    expect(sql).toContain('lease_expires_at > NOW()')
  })

  it('rejects receipt-less markInboxSubmitted', async () => {
    const { db } = createDb([])
    await expect(
      markInboxSubmitted({
        db,
        id: 1,
        leaseOwner: 'worker-a',
        submitAttemptId: 'attempt-a',
      }),
    ).rejects.toThrow('inbox_submitted_requires_receipt')
  })

  it('mark submitted requires lease owner + receipt from submitting', async () => {
    const { db, calls } = createDb([
      {
        rows: [
          {
            ...baseRow,
            status: 'submitted',
            lz_guid: `0x${'ab'.repeat(32)}`,
            base_tx_hash: `0x${'cd'.repeat(32)}`,
          },
        ],
      },
    ])
    const row = await markInboxSubmitted({
      db,
      id: 1,
      leaseOwner: 'worker-a',
      submitAttemptId: 'attempt-a',
      lzGuid: `0x${'ab'.repeat(32)}`,
      baseTxHash: `0x${'cd'.repeat(32)}`,
    })
    expect(row.status).toBe('submitted')
    const sql = calls[0].strings.join(' ')
    expect(sql).toContain("status = 'submitting'")
    expect(sql).toContain('lease_owner')
    expect(sql).toContain('submit_attempt_id')
    expect(sql).not.toContain('lease_expires_at > NOW()')
  })

  it('never releases a submitting intent back to pending', async () => {
    const { db, calls } = createDb([])
    await expect(releaseInboxLease({
      db,
      id: 1,
      leaseOwner: 'worker-a',
      lastError: 'uncertain_send',
    })).rejects.toThrow('inbox_release_lease_failed')
    const sql = calls[0].strings.join(' ')
    expect(sql).toContain("status = 'leased'")
    expect(sql).not.toContain("'submitting'")
  })

  it('can attach a matching late receipt after crash quarantine', async () => {
    const { db, calls } = createDb([{
      rows: [{
        ...baseRow,
        status: 'submitted',
        submit_attempt_id: 'attempt-a',
        lz_guid: `0x${'ab'.repeat(32)}`,
      }],
    }])
    await markInboxSubmitted({
      db,
      id: 1,
      leaseOwner: 'worker-a',
      submitAttemptId: 'attempt-a',
      lzGuid: `0x${'ab'.repeat(32)}`,
    })
    const sql = calls[0].strings.join(' ')
    expect(sql).toContain("status = 'quarantined'")
    expect(sql).toContain("quarantine_reason = 'submit_crash_unconfirmed'")
  })

  it('rejects malformed transport receipts before persistence', async () => {
    const { db } = createDb([])
    await expect(markInboxSubmitted({
      db,
      id: 1,
      leaseOwner: 'worker-a',
      submitAttemptId: 'attempt-a',
      lzGuid: 'guid-not-hex',
    })).rejects.toThrow('inbox_submitted_invalid_lz_guid')
    await expect(markInboxSubmitted({
      db,
      id: 1,
      leaseOwner: 'worker-a',
      submitAttemptId: 'attempt-a',
      baseTxHash: '0xshort',
    })).rejects.toThrow('inbox_submitted_invalid_base_tx_hash')
    await expect(markInboxSubmitted({
      db,
      id: 1,
      leaseOwner: 'worker-a',
      submitAttemptId: 'attempt-a',
      lzGuid: `0x${'ab'.repeat(32)}`,
      transportSourceTxHash: 'not-a-solana-signature',
    })).rejects.toThrow('inbox_submitted_invalid_source_tx_hash')
  })

  it('requires valid confirmation receipts and preserves existing values on replay', async () => {
    const { db, calls } = createDb([{ rows: [{ ...baseRow, status: 'confirmed' }] }])
    const lzGuid = `0x${'ab'.repeat(32)}`
    const baseTxHash = `0x${'cd'.repeat(32)}`
    await expect(markInboxConfirmed({ db, id: 1 })).rejects.toThrow('inbox_confirmed_invalid_lz_guid')
    await expect(markInboxConfirmed({ db, id: 1, lzGuid, baseTxHash: '0xshort' })).rejects.toThrow('inbox_confirmed_invalid_base_tx_hash')
    await markInboxConfirmed({ db, id: 1, lzGuid, baseTxHash })
    const sql = calls[0].strings.join(' ')
    expect(sql).toContain("status IN ('submitted', 'confirmed')")
    expect(sql).toContain('lz_guid IS NULL OR lz_guid =')
    expect(sql).toContain('base_tx_hash IS NULL OR base_tx_hash =')
  })

  it('crash after send: submitting blocks auto re-submit', async () => {
    const { db } = createDb([
      { rows: [{ ...baseRow, status: 'submitting', lease_owner: 'worker-a' }] },
    ])
    const recovery = await getInboxSubmitRecoveryState(db, 'g:p:sig:0:0')
    expect(recovery.canSubmit).toBe(false)
    expect(recovery.reason).toBe('submit_in_flight_or_crash')
  })

  it('reclaims expired submitting into quarantine (no auto-resubmit)', async () => {
    const { db, calls } = createDb([{ rows: [{ id: 1 }, { id: 2 }] }])
    const n = await reclaimStrandedSubmittingQuarantine({ db })
    expect(n).toBe(2)
    expect(calls[0].strings.join(' ')).toContain('submit_crash_unconfirmed')
  })

  it('stale cursor recovery allows pending submit', async () => {
    const { db } = createDb([{ rows: [{ ...baseRow, status: 'pending' }] }])
    const recovery = await getInboxSubmitRecoveryState(db, 'g:p:sig:0:0')
    expect(recovery.canSubmit).toBe(true)
  })

  it('does not allow a leased row or receipt-less submitted row to resubmit', async () => {
    const leased = createDb([
      { rows: [{ ...baseRow, status: 'leased', lease_owner: 'worker-a' }] },
    ])
    await expect(getInboxSubmitRecoveryState(leased.db, 'g:p:sig:0:0')).resolves.toMatchObject({
      canSubmit: false,
      reason: 'submit_in_flight_or_crash',
    })

    const submitted = createDb([
      { rows: [{ ...baseRow, status: 'submitted' }] },
    ])
    await expect(getInboxSubmitRecoveryState(submitted.db, 'g:p:sig:0:0')).resolves.toMatchObject({
      canSubmit: false,
      reason: 'submitted_missing_receipt',
    })
  })

  it('replay quarantine only via explicit recovery path and requires null receipts', async () => {
    const { db, calls } = createDb([
      { rows: [{ ...baseRow, status: 'pending', quarantine_reason: null }] },
    ])
    const row = await replayQuarantinedInboxEvent({ db, sourceEventId: 'g:p:sig:0:0' })
    expect(row.status).toBe('pending')
    const sql = String(calls[0].strings.join('?'))
    expect(sql).toContain("status = 'quarantined'")
    expect(sql).toContain('lz_guid IS NULL')
    expect(sql).toContain('base_tx_hash IS NULL')
  })

  it('refuses to replay quarantined rows that already have a receipt', async () => {
    const { db } = createDb([{ rows: [] }])
    await expect(
      replayQuarantinedInboxEvent({ db, sourceEventId: 'g:p:sig:0:0' }),
    ).rejects.toThrow('inbox_replay_not_quarantined_or_has_receipt')
  })
})
