/**
 * Stable finalized Solana lottery source-event identity (SOL-P0-02).
 *
 * Format: `${genesis}:${programId}:${signature}:${instructionIndex}:${eventIndex}`
 * Stronger than (buyer, amount, slot) which collides and is not durable across
 * ring-buffer reuse.
 */

export type SolanaLotterySourceEventParts = {
  clusterGenesisHash: string
  programId: string
  signature: string
  instructionIndex: number
  eventIndex: number
}

export function buildSolanaLotterySourceEventId(parts: SolanaLotterySourceEventParts): string {
  const clusterGenesisHash = parts.clusterGenesisHash.trim()
  const programId = parts.programId.trim()
  const signature = parts.signature.trim()
  if (!clusterGenesisHash) throw new Error('invalid_cluster_genesis_hash')
  if (!programId) throw new Error('invalid_program_id')
  if (!signature) throw new Error('invalid_signature')
  if (!Number.isInteger(parts.instructionIndex) || parts.instructionIndex < 0) {
    throw new Error('invalid_instruction_index')
  }
  if (!Number.isInteger(parts.eventIndex) || parts.eventIndex < 0) {
    throw new Error('invalid_event_index')
  }
  return `${clusterGenesisHash}:${programId}:${signature}:${parts.instructionIndex}:${parts.eventIndex}`
}

export function parseSolanaLotterySourceEventId(id: string): SolanaLotterySourceEventParts {
  const raw = String(id ?? '').trim()
  const parts = raw.split(':')
  if (parts.length !== 5) throw new Error('invalid_source_event_id')
  const [clusterGenesisHash, programId, signature, ixRaw, evtRaw] = parts
  const instructionIndex = Number(ixRaw)
  const eventIndex = Number(evtRaw)
  buildSolanaLotterySourceEventId({
    clusterGenesisHash,
    programId,
    signature,
    instructionIndex,
    eventIndex,
  })
  return {
    clusterGenesisHash,
    programId,
    signature,
    instructionIndex,
    eventIndex,
  }
}
