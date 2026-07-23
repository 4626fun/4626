import { Keypair } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'

import {
  CREATOR_CONFIG_ACCOUNT_LEN,
  CREATOR_CONFIG_AMM_PROGRAM_COUNT_OFFSET,
  CREATOR_CONFIG_AMM_PROGRAMS_OFFSET,
  decodeCreatorConfigAmmPrograms,
  hasExactCreatorConfigAmmProgram,
} from './solanaCreatorConfig.js'

function configWithAmm(programIds: ReturnType<typeof Keypair.generate>['publicKey'][]): Buffer {
  const data = Buffer.alloc(CREATOR_CONFIG_ACCOUNT_LEN)
  data[CREATOR_CONFIG_AMM_PROGRAM_COUNT_OFFSET] = programIds.length
  programIds.forEach((programId, index) => {
    programId.toBuffer().copy(data, CREATOR_CONFIG_AMM_PROGRAMS_OFFSET + index * 32)
  })
  return data
}

describe('CreatorConfig AMM allowlist decoder', () => {
  it('accepts an exact one-program canonical allowlist', () => {
    const meteora = Keypair.generate().publicKey
    const data = configWithAmm([meteora])
    expect(decodeCreatorConfigAmmPrograms(data)).toMatchObject({ valid: true, programIds: [meteora.toBase58()] })
    expect(hasExactCreatorConfigAmmProgram(data, meteora.toBase58())).toBe(true)
  })

  it('rejects extra, duplicate, malformed, and non-zero-tail entries', () => {
    const first = Keypair.generate().publicKey
    const second = Keypair.generate().publicKey
    expect(hasExactCreatorConfigAmmProgram(configWithAmm([first, second]), first.toBase58())).toBe(false)
    expect(decodeCreatorConfigAmmPrograms(configWithAmm([first, first])).reason).toBe('creator_config_amm_program_duplicate')
    const malformed = Buffer.alloc(CREATOR_CONFIG_ACCOUNT_LEN)
    malformed[CREATOR_CONFIG_AMM_PROGRAM_COUNT_OFFSET] = 9
    expect(decodeCreatorConfigAmmPrograms(malformed).valid).toBe(false)
    const tail = configWithAmm([first])
    tail[CREATOR_CONFIG_AMM_PROGRAMS_OFFSET + 32] = 1
    expect(decodeCreatorConfigAmmPrograms(tail).reason).toBe('creator_config_amm_tail_nonzero')
  })
})
