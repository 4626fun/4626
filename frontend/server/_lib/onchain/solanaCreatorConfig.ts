import { PublicKey } from '@solana/web3.js'

export const CREATOR_CONFIG_ACCOUNT_LEN = 501
export const MAX_CREATOR_CONFIG_AMM_PROGRAMS = 8
export const CREATOR_CONFIG_AMM_PROGRAMS_OFFSET = 180
export const CREATOR_CONFIG_AMM_PROGRAM_COUNT_OFFSET = 179

export type DecodedCreatorConfigAmmPrograms = {
  valid: boolean
  reason: string
  programIds: string[]
}

/**
 * Decode only the fixed-width AMM allowlist from the canonical CreatorConfig
 * account. This is deliberately strict: an unknown or non-zero tail is
 * treated as corruption instead of being ignored by a readiness gate.
 */
export function decodeCreatorConfigAmmPrograms(data: Buffer): DecodedCreatorConfigAmmPrograms {
  if (data.length !== CREATOR_CONFIG_ACCOUNT_LEN) {
    return { valid: false, reason: 'creator_config_invalid_size', programIds: [] }
  }
  const count = data[CREATOR_CONFIG_AMM_PROGRAM_COUNT_OFFSET] ?? 0
  if (count > MAX_CREATOR_CONFIG_AMM_PROGRAMS) {
    return { valid: false, reason: 'creator_config_amm_count_invalid', programIds: [] }
  }
  const programIds: string[] = []
  try {
    for (let index = 0; index < count; index += 1) {
      const start = CREATOR_CONFIG_AMM_PROGRAMS_OFFSET + index * 32
      programIds.push(new PublicKey(data.subarray(start, start + 32)).toBase58())
    }
  } catch {
    return { valid: false, reason: 'creator_config_amm_program_invalid', programIds: [] }
  }
  if (new Set(programIds).size !== programIds.length) {
    return { valid: false, reason: 'creator_config_amm_program_duplicate', programIds }
  }
  const tailStart = CREATOR_CONFIG_AMM_PROGRAMS_OFFSET + count * 32
  if (data.subarray(tailStart, CREATOR_CONFIG_AMM_PROGRAMS_OFFSET + MAX_CREATOR_CONFIG_AMM_PROGRAMS * 32).some((value) => value !== 0)) {
    return { valid: false, reason: 'creator_config_amm_tail_nonzero', programIds }
  }
  return { valid: true, reason: count === 0 ? 'empty' : `count=${count}`, programIds }
}

export function hasExactCreatorConfigAmmProgram(data: Buffer, expectedProgramId: string): boolean {
  const decoded = decodeCreatorConfigAmmPrograms(data)
  if (!decoded.valid || decoded.programIds.length !== 1) return false
  try {
    return decoded.programIds[0] === new PublicKey(expectedProgramId).toBase58()
  } catch {
    return false
  }
}
