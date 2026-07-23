import { Keypair, SystemProgram, Transaction } from '@solana/web3.js'
import { describe, expect, it, vi } from 'vitest'

import { sendAndConfirmSolanaTransactionOverHttp } from './solanaHttpTransaction.js'

function transactionFor(payer: Keypair): Transaction {
  return new Transaction().add(SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: Keypair.generate().publicKey,
    lamports: 1,
  }))
}

describe('sendAndConfirmSolanaTransactionOverHttp', () => {
  it('confirms through JSON-RPC status polling without WebSocket APIs', async () => {
    const payer = Keypair.generate()
    const getSignatureStatuses = vi.fn()
      .mockResolvedValueOnce({ value: [{ confirmationStatus: 'confirmed', err: null }] })
      .mockResolvedValueOnce({ value: [{ confirmationStatus: 'finalized', err: null }] })
    const connection = {
      getLatestBlockhash: vi.fn(async () => ({
        blockhash: '11111111111111111111111111111111',
        lastValidBlockHeight: 100,
      })),
      sendRawTransaction: vi.fn(async () => 'transaction-signature'),
      getSignatureStatuses,
    }

    await expect(sendAndConfirmSolanaTransactionOverHttp({
      connection: connection as any,
      transaction: transactionFor(payer),
      payer,
    })).resolves.toBe('transaction-signature')
    expect(connection.sendRawTransaction).toHaveBeenCalledOnce()
    expect(getSignatureStatuses).toHaveBeenCalledTimes(2)
  })

  it('fails with the submitted signature when JSON-RPC reports an error', async () => {
    const payer = Keypair.generate()
    const connection = {
      getLatestBlockhash: vi.fn(async () => ({
        blockhash: '11111111111111111111111111111111',
        lastValidBlockHeight: 100,
      })),
      sendRawTransaction: vi.fn(async () => 'failed-signature'),
      getSignatureStatuses: vi.fn(async () => ({ value: [{ err: { InstructionError: [0, 'custom'] } }] })),
    }

    await expect(sendAndConfirmSolanaTransactionOverHttp({
      connection: connection as any,
      transaction: transactionFor(payer),
      payer,
    })).rejects.toThrow('solana_transaction_failed:failed-signature')
  })
})
