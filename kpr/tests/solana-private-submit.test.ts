import { afterEach, describe, expect, it, vi } from 'vitest'

const { sendRawTransactionMock, confirmTransactionMock, getLatestBlockhashMock } = vi.hoisted(() => ({
  sendRawTransactionMock: vi.fn(async () => 'rpc-sig'),
  confirmTransactionMock: vi.fn(async () => undefined),
  getLatestBlockhashMock: vi.fn(async () => ({
    blockhash: 'bh',
    lastValidBlockHeight: 1,
  })),
}))

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual<any>('@solana/web3.js')
  return {
    ...actual,
    Connection: class {
      sendRawTransaction = sendRawTransactionMock
      confirmTransaction = confirmTransactionMock
      getLatestBlockhash = getLatestBlockhashMock
    },
  }
})

import { Connection, VersionedTransaction } from '@solana/web3.js'
import { sendSolanaTransactionPrivate } from '../utils/solanaPrivateSubmit.js'

describe('solana private submit', () => {
  const envKeys = ['JITO_SUBMIT_ENABLED', 'SOLANA_FORWARD_REQUIRE_PRIVATE_SUBMIT', 'JITO_BLOCK_ENGINE_URL'] as const
  const original = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]))

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    for (const key of envKeys) {
      const value = original[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('fails closed when private submit is required but Jito is off', async () => {
    delete process.env.JITO_SUBMIT_ENABLED
    process.env.SOLANA_FORWARD_REQUIRE_PRIVATE_SUBMIT = '1'
    const connection = new Connection('https://solana.invalid')
    const signed = {
      serialize: () => new Uint8Array([1, 2, 3]),
    } as unknown as VersionedTransaction

    await expect(
      sendSolanaTransactionPrivate({ connection, signedTransaction: signed, requirePrivate: true }),
    ).rejects.toThrow('solana_private_submit_required')
  })

  it('uses public RPC when private is not required', async () => {
    delete process.env.JITO_SUBMIT_ENABLED
    delete process.env.SOLANA_FORWARD_REQUIRE_PRIVATE_SUBMIT
    const connection = new Connection('https://solana.invalid')
    const signed = {
      serialize: () => new Uint8Array([1, 2, 3]),
    } as unknown as VersionedTransaction

    const sig = await sendSolanaTransactionPrivate({
      connection,
      signedTransaction: signed,
      requirePrivate: false,
    })
    expect(sig).toBe('rpc-sig')
    expect(sendRawTransactionMock).toHaveBeenCalled()
    expect(confirmTransactionMock).toHaveBeenCalled()
  })

  it('confirms Jito-accepted transactions before returning', async () => {
    process.env.JITO_SUBMIT_ENABLED = '1'
    delete process.env.SOLANA_FORWARD_REQUIRE_PRIVATE_SUBMIT
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ result: 'jito-sig' }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const connection = new Connection('https://solana.invalid')
    const signed = {
      serialize: () => new Uint8Array([1, 2, 3]),
    } as unknown as VersionedTransaction

    const sig = await sendSolanaTransactionPrivate({
      connection,
      signedTransaction: signed,
    })
    expect(sig).toBe('jito-sig')
    expect(fetchMock).toHaveBeenCalled()
    expect(confirmTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({ signature: 'jito-sig' }),
      'confirmed',
    )
  })
})
