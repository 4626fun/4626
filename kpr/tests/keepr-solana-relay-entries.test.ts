import { describe, expect, it } from 'vitest'

import {
  relayEntriesInstructionDiscriminator,
  settleFeesInstructionDiscriminator,
} from '../utils/hookInstructionDiscriminators.js'
import {
  EMERGENCY_RELAY_THRESHOLD,
  MAX_PENDING_ENTRIES,
  PENDING_ENTRIES_HEADER_SIZE,
  PENDING_ENTRIES_ENTRY_SIZE,
  parsePendingEntriesBuffer,
} from '../utils/pendingEntriesBuffer.js'

describe('hook instruction discriminators', () => {
  it('defaults to canonical relay_entries / settle_fees names', () => {
    const prev = process.env.SOLANA_HOOK_IX_SCHEMA
    delete process.env.SOLANA_HOOK_IX_SCHEMA
    try {
      expect(relayEntriesInstructionDiscriminator().toString('hex')).toBe('6334b6bb6b640527')
      expect(settleFeesInstructionDiscriminator().toString('hex')).toBe('3cdd82e5b7ea069f')
    } finally {
      if (prev === undefined) delete process.env.SOLANA_HOOK_IX_SCHEMA
      else process.env.SOLANA_HOOK_IX_SCHEMA = prev
    }
  })

  it('supports legacy schema only for pre-upgrade mainnet bytecode rollback', () => {
    expect(relayEntriesInstructionDiscriminator('legacy').toString('hex')).toBe('69457b107ad7794d')
    expect(settleFeesInstructionDiscriminator('legacy').toString('hex')).toBe('40c9211afcf5184f')
  })
})

describe('parsePendingEntriesBuffer', () => {
  it('returns null for undersized buffers', () => {
    expect(parsePendingEntriesBuffer(Buffer.alloc(32))).toBeNull()
  })

  it('parses a single queued entry', () => {
    const buyer = Buffer.alloc(32, 7)
    const buf = Buffer.alloc(PENDING_ENTRIES_HEADER_SIZE + PENDING_ENTRIES_ENTRY_SIZE)
    buf.writeUInt32LE(0, 40)
    buf.writeUInt32LE(1, 44)
    buf.writeBigUInt64LE(0n, 48)
    buyer.copy(buf, PENDING_ENTRIES_HEADER_SIZE)
    buf.writeBigUInt64LE(1_500_000_000n, PENDING_ENTRIES_HEADER_SIZE + 32)
    buf.writeBigUInt64LE(999n, PENDING_ENTRIES_HEADER_SIZE + 40)

    const parsed = parsePendingEntriesBuffer(buf)
    expect(parsed?.count).toBe(1)
    expect(parsed?.entries).toHaveLength(1)
    expect(parsed?.entries[0]?.amountSolanaUnits).toBe(1_500_000_000n)
    expect(parsed?.entries[0]?.slot).toBe(999n)
    expect(parsed?.emergencyRelay).toBe(false)
  })

  it('flags emergency relay near capacity', () => {
    const buf = Buffer.alloc(PENDING_ENTRIES_HEADER_SIZE)
    buf.writeUInt32LE(0, 40)
    buf.writeUInt32LE(EMERGENCY_RELAY_THRESHOLD, 44)
    const parsed = parsePendingEntriesBuffer(buf)
    expect(parsed?.emergencyRelay).toBe(true)
    expect(parsed?.entries).toHaveLength(0)
  })

  it('walks ring buffer from head when full', () => {
    const buf = Buffer.alloc(PENDING_ENTRIES_HEADER_SIZE + MAX_PENDING_ENTRIES * PENDING_ENTRIES_ENTRY_SIZE)
    buf.writeUInt32LE(1, 40)
    buf.writeUInt32LE(MAX_PENDING_ENTRIES, 44)

    const firstOffset = PENDING_ENTRIES_HEADER_SIZE + 1 * PENDING_ENTRIES_ENTRY_SIZE
    Buffer.alloc(32, 9).copy(buf, firstOffset)
    buf.writeBigUInt64LE(42n, firstOffset + 32)
    buf.writeBigUInt64LE(100n, firstOffset + 40)

    const parsed = parsePendingEntriesBuffer(buf)
    expect(parsed?.entries[0]?.amountSolanaUnits).toBe(42n)
  })
})
