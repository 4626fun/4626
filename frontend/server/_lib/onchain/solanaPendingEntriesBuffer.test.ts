import { createHash } from 'node:crypto'
import { Keypair } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'
import { auditPendingEntriesBuffer, SOLANA_PENDING_ENTRIES_ACCOUNT_LEN } from './solanaPendingEntriesBuffer.js'

const mint = Keypair.generate().publicKey
function buffer(slot = 100n): Buffer {
  const data = Buffer.alloc(SOLANA_PENDING_ENTRIES_ACCOUNT_LEN)
  createHash('sha256').update('account:PendingEntries').digest().subarray(0, 8).copy(data, 0)
  mint.toBuffer().copy(data, 8)
  data.writeUInt32LE(1, 40)
  data.writeUInt32LE(1, 44)
  Keypair.generate().publicKey.toBuffer().copy(data, 64)
  data.writeBigUInt64LE(5n, 96)
  data.writeBigUInt64LE(slot, 104)
  return data
}

describe('PendingEntries reconciliation buffer audit', () => {
  it('rejects malformed/truncated and impossible active entries', () => {
    expect(auditPendingEntriesBuffer({ data: Buffer.alloc(40), expectedCreatorMint: mint.toBase58(), finalizedSlot: 100n }).status).toBe('malformed')
    expect(auditPendingEntriesBuffer({ data: Buffer.alloc(SOLANA_PENDING_ENTRIES_ACCOUNT_LEN + 1), expectedCreatorMint: mint.toBase58(), finalizedSlot: 100n })).toMatchObject({
      status: 'malformed', reason: 'pending_entries_extra_bytes',
    })
    expect(auditPendingEntriesBuffer({ data: buffer(), expectedCreatorMint: 'not-a-solana-mint', finalizedSlot: 100n })).toMatchObject({
      status: 'malformed', reason: 'pending_entries_expected_mint_invalid',
    })
    const malformed = buffer()
    malformed.fill(0, 64, 96)
    expect(auditPendingEntriesBuffer({ data: malformed, expectedCreatorMint: mint.toBase58(), finalizedSlot: 100n })).toMatchObject({
      status: 'malformed', reason: 'pending_entries_active_entry_invalid:0',
    })
  })

  it('fail-closes stale residue instead of treating it as new eligibility', () => {
    expect(auditPendingEntriesBuffer({ data: buffer(100n), expectedCreatorMint: mint.toBase58(), finalizedSlot: 20_000n, staleAfterSlots: 1_000n })).toMatchObject({
      status: 'stale', reason: 'pending_entries_stale_residue',
    })
  })

  it('requires explicit reconciliation after overflow', () => {
    const data = buffer()
    data.writeBigUInt64LE(1n, 48)
    expect(auditPendingEntriesBuffer({ data, expectedCreatorMint: mint.toBase58(), finalizedSlot: 100n })).toMatchObject({ status: 'overflowed' })
  })
})
