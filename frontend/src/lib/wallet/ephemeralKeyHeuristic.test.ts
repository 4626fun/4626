import { describe, expect, it, vi } from 'vitest'
import type { PublicClient } from 'viem'

import { checkEphemeralKey } from './ephemeralKeyHeuristic'

const ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as const

function makeClient(opts: {
  code?: `0x${string}` | undefined
  codeError?: Error
  txCount?: bigint | number
  txCountError?: Error
}): PublicClient {
  return {
    getCode: vi.fn(async () => {
      if (opts.codeError) throw opts.codeError
      return opts.code
    }),
    getTransactionCount: vi.fn(async () => {
      if (opts.txCountError) throw opts.txCountError
      return opts.txCount ?? 0
    }),
  } as unknown as PublicClient
}

describe('checkEphemeralKey', () => {
  it('flags an EOA with no code and zero transactions as ephemeral', async () => {
    const client = makeClient({ code: undefined, txCount: 0 })
    const signal = await checkEphemeralKey(client, ADDRESS)
    expect(signal.address).toBe(ADDRESS)
    expect(signal.code).toBe('0x')
    expect(signal.txCount).toBe(0)
    expect(signal.isEphemeralCandidate).toBe(true)
  })

  it('does not flag an address that has contract code, even with zero txs', async () => {
    const client = makeClient({ code: '0x6080604052', txCount: 0 })
    const signal = await checkEphemeralKey(client, ADDRESS)
    expect(signal.code).toBe('0x6080604052')
    expect(signal.txCount).toBe(0)
    expect(signal.isEphemeralCandidate).toBe(false)
  })

  it('does not flag an EOA with prior transaction history', async () => {
    const client = makeClient({ code: undefined, txCount: 5 })
    const signal = await checkEphemeralKey(client, ADDRESS)
    expect(signal.code).toBe('0x')
    expect(signal.txCount).toBe(5)
    expect(signal.isEphemeralCandidate).toBe(false)
  })

  it('returns null code/txCount and does not flag when both lookups fail', async () => {
    const client = makeClient({
      codeError: new Error('rpc down'),
      txCountError: new Error('rpc down'),
    })
    const signal = await checkEphemeralKey(client, ADDRESS)
    expect(signal.code).toBeNull()
    expect(signal.txCount).toBeNull()
    expect(signal.isEphemeralCandidate).toBe(false)
  })
})
