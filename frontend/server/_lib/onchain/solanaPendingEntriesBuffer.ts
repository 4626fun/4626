import { createHash } from 'node:crypto'
import { PublicKey } from '@solana/web3.js'

export const SOLANA_PENDING_ENTRIES_CAPACITY = 256
export const SOLANA_PENDING_ENTRIES_ACCOUNT_LEN = 12_352
const HEADER_OFFSET = 8
const ENTRIES_OFFSET = 64
const ENTRY_LEN = 48
const DISCRIMINATOR = createHash('sha256').update('account:PendingEntries').digest().subarray(0, 8)

export type PendingEntriesBufferAudit = {
  status: 'healthy' | 'stale' | 'overflowed' | 'malformed'
  creatorMint: string | null
  head: number | null
  count: number | null
  overflowCount: bigint | null
  oldestActiveSlot: bigint | null
  reason: string | null
}

/** Strict read-only decoder. This buffer is reconciliation evidence, never eligibility. */
export function auditPendingEntriesBuffer(params: {
  data: Buffer
  expectedCreatorMint: string
  finalizedSlot: bigint
  staleAfterSlots?: bigint
}): PendingEntriesBufferAudit {
  const malformed = (reason: string): PendingEntriesBufferAudit => ({
    status: 'malformed', creatorMint: null, head: null, count: null,
    overflowCount: null, oldestActiveSlot: null, reason,
  })
  const { data } = params
  if (data.length !== SOLANA_PENDING_ENTRIES_ACCOUNT_LEN) {
    return malformed(data.length < SOLANA_PENDING_ENTRIES_ACCOUNT_LEN ? 'pending_entries_truncated' : 'pending_entries_extra_bytes')
  }
  if (!data.subarray(0, 8).equals(DISCRIMINATOR)) return malformed('pending_entries_discriminator_mismatch')
  const creatorMint = new PublicKey(data.subarray(HEADER_OFFSET, HEADER_OFFSET + 32)).toBase58()
  let expectedCreatorMint: string
  try {
    expectedCreatorMint = new PublicKey(params.expectedCreatorMint).toBase58()
  } catch {
    return malformed('pending_entries_expected_mint_invalid')
  }
  if (creatorMint !== expectedCreatorMint) return malformed('pending_entries_creator_mint_mismatch')
  const head = data.readUInt32LE(40)
  const count = data.readUInt32LE(44)
  const overflowCount = data.readBigUInt64LE(48)
  if (head >= SOLANA_PENDING_ENTRIES_CAPACITY) return malformed('pending_entries_head_out_of_range')
  if (count > SOLANA_PENDING_ENTRIES_CAPACITY) return malformed('pending_entries_count_out_of_range')
  if (!data.subarray(57, 64).equals(Buffer.alloc(7))) return malformed('pending_entries_padding_nonzero')

  const start = count < SOLANA_PENDING_ENTRIES_CAPACITY ? 0 : head
  let oldestActiveSlot: bigint | null = null
  for (let i = 0; i < count; i++) {
    const index = (start + i) % SOLANA_PENDING_ENTRIES_CAPACITY
    const offset = ENTRIES_OFFSET + index * ENTRY_LEN
    const buyer = data.subarray(offset, offset + 32)
    const amount = data.readBigUInt64LE(offset + 32)
    const slot = data.readBigUInt64LE(offset + 40)
    if (buyer.equals(Buffer.alloc(32)) || amount === 0n || slot === 0n) {
      return malformed(`pending_entries_active_entry_invalid:${index}`)
    }
    if (oldestActiveSlot == null || slot < oldestActiveSlot) oldestActiveSlot = slot
  }
  if (overflowCount > 0n) {
    return { status: 'overflowed', creatorMint, head, count, overflowCount, oldestActiveSlot, reason: 'pending_entries_overflow_requires_log_reconciliation' }
  }
  const staleAfterSlots = params.staleAfterSlots ?? 10_000n
  if (oldestActiveSlot != null && params.finalizedSlot > oldestActiveSlot + staleAfterSlots) {
    return { status: 'stale', creatorMint, head, count, overflowCount, oldestActiveSlot, reason: 'pending_entries_stale_residue' }
  }
  return { status: 'healthy', creatorMint, head, count, overflowCount, oldestActiveSlot, reason: null }
}
