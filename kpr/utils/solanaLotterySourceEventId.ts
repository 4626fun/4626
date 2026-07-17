/**
 * Re-export / mirror of durable Solana lottery source-event identity for KPR.
 * Canonical format matches frontend/server/_lib/onchain/solanaLotterySourceEventId.ts
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
