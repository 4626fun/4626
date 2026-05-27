/**
 * Parse PendingEntries zero-copy account data from creator-share-hook.
 * Layout must stay aligned with programs/creator-share-hook/src/state/pending_entries.rs.
 */

/** 8-byte Anchor discriminator + PendingEntries fields through `_padding` (7 bytes). */
export const PENDING_ENTRIES_HEADER_SIZE = 8 + 32 + 4 + 4 + 8 + 1 + 7
export const PENDING_ENTRIES_ENTRY_SIZE = 48
export const MAX_PENDING_ENTRIES = 256
export const EMERGENCY_RELAY_THRESHOLD = Math.floor(MAX_PENDING_ENTRIES * 0.8)

export type ParsedPendingEntry = {
  buyerSolanaPubkey: `0x${string}`
  amountSolanaUnits: bigint
  slot: bigint
}

export type ParsedPendingEntriesSnapshot = {
  head: number
  count: number
  overflowCount: number
  entries: ParsedPendingEntry[]
  emergencyRelay: boolean
}

export function parsePendingEntriesBuffer(data: Buffer): ParsedPendingEntriesSnapshot | null {
  if (data.length < PENDING_ENTRIES_HEADER_SIZE) return null

  const head = data.readUInt32LE(40)
  const count = data.readUInt32LE(44)
  const overflowCount = Number(data.readBigUInt64LE(48))

  if (count === 0) {
    return {
      head,
      count,
      overflowCount,
      entries: [],
      emergencyRelay: false,
    }
  }

  const startIdx = count < MAX_PENDING_ENTRIES ? 0 : head
  const entries: ParsedPendingEntry[] = []

  for (let i = 0; i < count; i += 1) {
    const idx = (startIdx + i) % MAX_PENDING_ENTRIES
    const offset = PENDING_ENTRIES_HEADER_SIZE + idx * PENDING_ENTRIES_ENTRY_SIZE
    if (offset + PENDING_ENTRIES_ENTRY_SIZE > data.length) break

    const buyerBytes = data.subarray(offset, offset + 32)
    const amount = data.readBigUInt64LE(offset + 32)
    const slot = data.readBigUInt64LE(offset + 40)

    if (buyerBytes.every((b) => b === 0)) continue

    entries.push({
      buyerSolanaPubkey: (`0x${Buffer.from(buyerBytes).toString('hex')}`) as `0x${string}`,
      amountSolanaUnits: amount,
      slot,
    })
  }

  return {
    head,
    count,
    overflowCount,
    entries,
    emergencyRelay: count >= EMERGENCY_RELAY_THRESHOLD,
  }
}
