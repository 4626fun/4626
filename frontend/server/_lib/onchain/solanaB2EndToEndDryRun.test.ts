import { Keypair, PublicKey } from '@solana/web3.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { encodeLotteryEntryRecordedProgramData } from './solanaLotteryAnchorEvents.js'
import { parseLotteryEntryRecordedFromLogs } from './solanaLotteryIngest.js'
import { deriveLotteryOappStoreBytes32 } from './solanaLotteryOappClient.js'
import { readSolanaLotteryLzReceipt } from './solanaLotteryLzReceipt.js'
import { submitSolanaLotteryEntryViaLz } from './solanaLotteryLzTransport.js'
import { deriveSolanaWinnerWinId } from './solanaLotteryWinnerSettlement.js'

describe('Solana B2 successful end-to-end dry-run', () => {
  afterEach(() => {
    for (const key of ['SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED', 'SOLANA_LOTTERY_LZ_TRANSPORT_READY', 'SOLANA_LOTTERY_OAPP_PEER_BYTES32', 'LOTTERY_MANAGER', 'SOLANA_LOTTERY_OAPP_SENDER_MODE', 'SOLANA_LOTTERY_OAPP_ALLOW_MOCK_SEND']) delete process.env[key]
  })

  it('binds one finalized buy to one OApp GUID, one Base receipt, and one replay-stable winner id', async () => {
    const programId = 'EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU'
    const mint = Keypair.generate().publicKey
    const buyer = Keypair.generate().publicKey
    const encoded = encodeLotteryEntryRecordedProgramData({ creatorMint: mint, buyer, amount: 42n, slot: 100, bufferCount: 1 })
    const events = parseLotteryEntryRecordedFromLogs({
      programId, signature: 'dry-run-signature', slot: 100, blockTime: null,
      logMessages: [`Program ${programId} invoke [1]`, `Program data: ${encoded}`, `Program ${programId} success`],
    })
    expect(events).toHaveLength(1)

    process.env.SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED = '1'
    process.env.SOLANA_LOTTERY_LZ_TRANSPORT_READY = '1'
    process.env.LOTTERY_MANAGER = '0xB45E68a5867935a5734E4185977F81c528006650'
    process.env.SOLANA_LOTTERY_OAPP_PEER_BYTES32 = `0x${'0'.repeat(24)}b45e68a5867935a5734e4185977f81c528006650`
    process.env.SOLANA_LOTTERY_OAPP_SENDER_MODE = 'mock'
    process.env.SOLANA_LOTTERY_OAPP_ALLOW_MOCK_SEND = '1'
    const guid = `0x${'ab'.repeat(32)}`
    const sourceTx = '2'.repeat(64)
    const sender = { send: vi.fn(async () => ({ lzGuid: guid, baseTxHash: null, solanaSignature: sourceTx })) }
    const submitted = await submitSolanaLotteryEntryViaLz({
      sourceEventId: `devnet:${programId}:dry-run-signature:0:0`,
      buyer: `0x${'11'.repeat(20)}`, tokenIn: `0x${'22'.repeat(20)}`, amount: 42n,
    }, { sender })
    expect(sender.send).toHaveBeenCalledTimes(1)
    expect(submitted.lzGuid).toBe(guid)

    const oappProgram = new PublicKey('8XdQnMpcRBfNTM8KAQfoz4QVCrYz6BS1LTr7E54ofRtC')
    const storeBytes32 = deriveLotteryOappStoreBytes32(oappProgram)
    const storeBase58 = new PublicKey(Buffer.from(storeBytes32.slice(2), 'hex')).toBase58()
    const baseTxHash = `0x${'cd'.repeat(32)}`
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: [{
      guid, pathway: { srcEid: 30168, dstEid: 30184, sender: { address: storeBase58 } },
      source: { tx: { txHash: sourceTx } }, destination: { status: 'SUCCEEDED', tx: { txHash: baseTxHash } },
      status: { name: 'DELIVERED', message: 'Delivered' },
    }] }), { status: 200, headers: { 'content-type': 'application/json' } })) as any
    await expect(readSolanaLotteryLzReceipt({ lzGuid: guid, senderBytes32: storeBytes32, sourceTxHash: sourceTx, fetchImpl }))
      .resolves.toEqual({ state: 'confirmed', status: 'DELIVERED', baseTxHash })

    const winnerIdentity = { baseChainId: 8453n, baseTxHash: baseTxHash as `0x${string}`, baseLogIndex: 7,
      creatorToken: `0x${'22'.repeat(20)}` as const, beneficiaryCsw: `0x${'11'.repeat(20)}` as const, requestId: 99n }
    expect(deriveSolanaWinnerWinId(winnerIdentity)).toBe(deriveSolanaWinnerWinId(winnerIdentity))
  })
})
