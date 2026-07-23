import { describe, expect, it } from 'vitest'

import {
  selectDevnetHookProgram,
} from '../../../scripts/ops/preflight-solana-devnet.js'
import { CREATOR_SHARE_HOOK_PROGRAM_ID } from './creatorShareHookPdas.js'

describe('devnet hook program selection', () => {
  it('uses the canonical program when no surrogate is configured', () => {
    expect(selectDevnetHookProgram('')).toMatchObject({
      mode: 'canonical',
      error: null,
      program: { toBase58: expect.any(Function) },
    })
    expect(selectDevnetHookProgram('').program.toBase58()).toBe(CREATOR_SHARE_HOOK_PROGRAM_ID)
  })

  it('accepts a distinct valid program only as a devnet surrogate selection', () => {
    const selected = selectDevnetHookProgram('11111111111111111111111111111111')
    expect(selected).toMatchObject({ mode: 'devnet_surrogate', error: null })
    expect(selected.program.toBase58()).toBe('11111111111111111111111111111111')
  })

  it('fails closed for an invalid surrogate program id', () => {
    expect(selectDevnetHookProgram('not-a-solana-program')).toMatchObject({
      mode: 'canonical',
      error: 'invalid_solana_devnet_hook_program_id',
    })
  })
})
