import { describe, expect, it } from 'vitest'
import {
  buildSolanaLotterySourceEventId,
  parseSolanaLotterySourceEventId,
} from './solanaLotterySourceEventId.js'

describe('solanaLotterySourceEventId', () => {
  it('builds stable finalized source identity', () => {
    const id = buildSolanaLotterySourceEventId({
      clusterGenesisHash: 'Genesis111',
      programId: 'EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU',
      signature: '5SigAbc',
      instructionIndex: 2,
      eventIndex: 0,
    })
    expect(id).toBe(
      'Genesis111:EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU:5SigAbc:2:0',
    )
  })

  it('rejects negative indexes', () => {
    expect(() =>
      buildSolanaLotterySourceEventId({
        clusterGenesisHash: 'g',
        programId: 'p',
        signature: 's',
        instructionIndex: -1,
        eventIndex: 0,
      }),
    ).toThrow('invalid_instruction_index')
  })

  it('round-trips parse', () => {
    const parts = {
      clusterGenesisHash: 'g',
      programId: 'p',
      signature: 's',
      instructionIndex: 1,
      eventIndex: 3,
    }
    expect(parseSolanaLotterySourceEventId(buildSolanaLotterySourceEventId(parts))).toEqual(parts)
  })

  it('distinguishes two ixs in one tx via instruction index', () => {
    const a = buildSolanaLotterySourceEventId({
      clusterGenesisHash: 'g',
      programId: 'p',
      signature: 'sameSig',
      instructionIndex: 0,
      eventIndex: 0,
    })
    const b = buildSolanaLotterySourceEventId({
      clusterGenesisHash: 'g',
      programId: 'p',
      signature: 'sameSig',
      instructionIndex: 1,
      eventIndex: 0,
    })
    expect(a).not.toBe(b)
  })
})
