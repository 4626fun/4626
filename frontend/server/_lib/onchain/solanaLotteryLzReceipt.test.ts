import { describe, expect, it } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import { readSolanaLotteryLzReceipt } from './solanaLotteryLzReceipt.js'

const guid = `0x${'ab'.repeat(32)}`
const peerBytes = Buffer.alloc(32, 7)
const peer = `0x${peerBytes.toString('hex')}`
const peerBase58 = new PublicKey(peerBytes).toBase58()
const solanaTx = '2'.repeat(64)
const baseTx = `0x${'cd'.repeat(32)}`

function response(message: Record<string, unknown>, status = 200): typeof fetch {
  return (async () => new Response(JSON.stringify({ data: [message] }), {
    status, headers: { 'content-type': 'application/json' },
  })) as typeof fetch
}

function message(overrides: Record<string, unknown> = {}) {
  return {
    guid,
    pathway: { srcEid: 30168, dstEid: 30184, sender: { address: peerBase58 } },
    source: { tx: { txHash: solanaTx } },
    destination: { status: 'SUCCEEDED', tx: { txHash: baseTx } },
    status: { name: 'DELIVERED', message: 'Delivered' },
    ...overrides,
  }
}

describe('readSolanaLotteryLzReceipt', () => {
  it('confirms only a delivered Solana-to-Base message with matching sender and source tx', async () => {
    await expect(readSolanaLotteryLzReceipt({
      lzGuid: guid, senderBytes32: peer, sourceTxHash: solanaTx, fetchImpl: response(message()),
    })).resolves.toEqual({ state: 'confirmed', status: 'DELIVERED', baseTxHash: baseTx })
  })

  it('keeps inflight messages pending', async () => {
    const pending = message({ destination: { status: 'WAITING' }, status: { name: 'INFLIGHT' } })
    await expect(readSolanaLotteryLzReceipt({
      lzGuid: guid, senderBytes32: peer, sourceTxHash: solanaTx, fetchImpl: response(pending),
    })).resolves.toMatchObject({ state: 'pending', status: 'INFLIGHT' })
  })

  it('keeps failed destination execution retryable without confirming or resending', async () => {
    const failed = message({ destination: { status: 'SIMULATION_REVERTED' }, status: { name: 'FAILED', message: 'revert' } })
    await expect(readSolanaLotteryLzReceipt({
      lzGuid: guid, senderBytes32: peer, sourceTxHash: solanaTx, fetchImpl: response(failed),
    })).resolves.toMatchObject({ state: 'retryable', status: 'FAILED', reason: 'revert' })
  })

  it('classifies burned or skipped packets as terminal', async () => {
    const burned = message({ destination: { status: 'FAILED' }, status: { name: 'APPLICATION_BURNED', message: 'burned' } })
    await expect(readSolanaLotteryLzReceipt({
      lzGuid: guid, senderBytes32: peer, sourceTxHash: solanaTx, fetchImpl: response(burned),
    })).resolves.toMatchObject({ state: 'terminal_failed', status: 'APPLICATION_BURNED', reason: 'burned' })
  })

  it('rejects a mismatched pathway, sender, or source transaction', async () => {
    await expect(readSolanaLotteryLzReceipt({
      lzGuid: guid, senderBytes32: peer, sourceTxHash: solanaTx,
      fetchImpl: response(message({ pathway: { srcEid: 30168, dstEid: 30101, sender: { address: peerBase58 } } })),
    })).rejects.toThrow('layerzero_receipt_pathway_mismatch')
    await expect(readSolanaLotteryLzReceipt({
      lzGuid: guid, senderBytes32: peer, sourceTxHash: solanaTx,
      fetchImpl: response(message({ pathway: { srcEid: 30168, dstEid: 30184, sender: { address: 'bad' } } })),
    })).rejects.toThrow('layerzero_receipt_sender_mismatch')
    await expect(readSolanaLotteryLzReceipt({
      lzGuid: guid, senderBytes32: peer, sourceTxHash: '3'.repeat(64), fetchImpl: response(message()),
    })).rejects.toThrow('layerzero_receipt_source_tx_mismatch')
  })
})
