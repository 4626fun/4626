import { createHash } from 'node:crypto'
import { Keypair, PublicKey } from '@solana/web3.js'
import { describe, expect, it, vi } from 'vitest'
import { CREATOR_SHARE_HOOK_PROGRAM_ID } from './creatorShareHookPdas.js'
import { recordSolanaLotteryWinner, winnerRecordMatches } from './solanaLotteryWinnerSettlement.js'

vi.mock('./solanaHttpTransaction.js', () => ({
  sendAndConfirmSolanaTransactionOverHttp: vi.fn(async () => 'settlement-signature'),
}))

function winRecord(params: { mint: PublicKey; winId: `0x${string}`; winner: PublicKey; shares: bigint }): Buffer {
  const data = Buffer.alloc(121)
  createHash('sha256').update('account:WinIdRecord').digest().subarray(0, 8).copy(data)
  params.mint.toBuffer().copy(data, 8)
  Buffer.from(params.winId.slice(2), 'hex').copy(data, 40)
  params.winner.toBuffer().copy(data, 72)
  data.writeBigUInt64LE(params.shares, 104)
  return data
}

function winnerRecord(params: { mint: PublicKey; winner: PublicKey; shares: bigint }): Buffer {
  const data = Buffer.alloc(89)
  createHash('sha256').update('account:WinnerRecord').digest().subarray(0, 8).copy(data)
  params.mint.toBuffer().copy(data, 8)
  params.winner.toBuffer().copy(data, 40)
  data.writeBigUInt64LE(params.shares, 72)
  return data
}

function creatorConfig(params: { mint: PublicKey; keeper: PublicKey; lotteryEnabled?: boolean }): Buffer {
  const data = Buffer.alloc(501)
  params.mint.toBuffer().copy(data, 8)
  params.keeper.toBuffer().copy(data, 72)
  data[178] = params.lotteryEnabled === false ? 0 : 1
  return data
}

describe('Solana winner one-shot replay protection', () => {
  it('returns already_recorded only for an exact existing WinId readback', async () => {
    const mint = Keypair.generate().publicKey
    const winner = Keypair.generate().publicKey
    const payer = Keypair.generate()
    const winId = `0x${'44'.repeat(32)}` as const
    const owner = new PublicKey(CREATOR_SHARE_HOOK_PROGRAM_ID)
    const connection = { getMultipleAccountsInfo: vi.fn(async () => [
      { owner, data: creatorConfig({ mint, keeper: payer.publicKey }) }, { owner, data: winnerRecord({ mint, winner: PublicKey.default, shares: 0n }) },
      { owner, data: winRecord({ mint, winId, winner, shares: 42n }) },
    ]) }
    await expect(recordSolanaLotteryWinner({ connection: connection as any, payer, request: {
      creatorMint: mint.toBase58(), winnerSolana: winner.toBase58(), sharesPaid: 42n, winId,
    } })).resolves.toMatchObject({ status: 'already_recorded', signature: null })
  })

  it('rejects a conflicting replay and zero-share settlement', async () => {
    const mint = Keypair.generate().publicKey
    const winner = Keypair.generate().publicKey
    const winId = `0x${'44'.repeat(32)}` as const
    const payer = Keypair.generate()
    const owner = new PublicKey(CREATOR_SHARE_HOOK_PROGRAM_ID)
    const connection = { getMultipleAccountsInfo: vi.fn(async () => [
      { owner, data: creatorConfig({ mint, keeper: payer.publicKey }) }, { owner, data: winnerRecord({ mint, winner: PublicKey.default, shares: 0n }) },
      { owner, data: winRecord({ mint, winId, winner, shares: 41n }) },
    ]) }
    await expect(recordSolanaLotteryWinner({ connection: connection as any, payer, request: {
      creatorMint: mint.toBase58(), winnerSolana: winner.toBase58(), sharesPaid: 42n, winId,
    } })).rejects.toThrow('winner_replay_record_mismatch')
    await expect(recordSolanaLotteryWinner({ connection: connection as any, payer, request: {
      creatorMint: mint.toBase58(), winnerSolana: winner.toBase58(), sharesPaid: 0n, winId,
    } })).rejects.toThrow('winner_shares_paid_must_be_positive')
  })

  it('fails before sending when the payer is not the configured keeper', async () => {
    const mint = Keypair.generate().publicKey
    const winner = Keypair.generate().publicKey
    const payer = Keypair.generate()
    const configuredKeeper = Keypair.generate().publicKey
    const winId = `0x${'45'.repeat(32)}` as const
    const owner = new PublicKey(CREATOR_SHARE_HOOK_PROGRAM_ID)
    const connection = { getMultipleAccountsInfo: vi.fn(async () => [
      { owner, data: creatorConfig({ mint, keeper: configuredKeeper }) },
      { owner, data: winnerRecord({ mint, winner: PublicKey.default, shares: 0n }) },
      null,
    ]) }
    await expect(recordSolanaLotteryWinner({ connection: connection as any, payer, request: {
      creatorMint: mint.toBase58(), winnerSolana: winner.toBase58(), sharesPaid: 42n, winId,
    } })).rejects.toThrow('winner_keeper_not_authorized')
  })

  it('requires exact winner readback after a new settlement', async () => {
    const mint = Keypair.generate().publicKey
    const winner = Keypair.generate().publicKey
    const payer = Keypair.generate()
    const winId = `0x${'55'.repeat(32)}` as const
    const owner = new PublicKey(CREATOR_SHARE_HOOK_PROGRAM_ID)
    const initial = winnerRecord({ mint, winner: PublicKey.default, shares: 0n })
    const winIdData = winRecord({ mint, winId, winner, shares: 42n })
    const connection = { getMultipleAccountsInfo: vi.fn()
      .mockResolvedValueOnce([
        { owner, data: creatorConfig({ mint, keeper: payer.publicKey }) }, { owner, data: initial }, null,
      ])
      .mockResolvedValueOnce([
        { owner, data: winnerRecord({ mint, winner, shares: 42n }) }, { owner, data: winIdData },
      ]) }
    await expect(recordSolanaLotteryWinner({ connection: connection as any, payer, request: {
      creatorMint: mint.toBase58(), winnerSolana: winner.toBase58(), sharesPaid: 42n, winId,
    } })).resolves.toMatchObject({ status: 'recorded', signature: 'settlement-signature' })
    expect(connection.getMultipleAccountsInfo).toHaveBeenCalledTimes(2)
  })

  it('rejects a malformed or mismatched mutable winner readback', async () => {
    const mint = Keypair.generate().publicKey
    const winner = Keypair.generate().publicKey
    const winId = `0x${'66'.repeat(32)}` as const
    const payer = Keypair.generate()
    const owner = new PublicKey(CREATOR_SHARE_HOOK_PROGRAM_ID)
    const connection = { getMultipleAccountsInfo: vi.fn()
      .mockResolvedValueOnce([
        { owner, data: creatorConfig({ mint, keeper: payer.publicKey }) }, { owner, data: winnerRecord({ mint, winner: PublicKey.default, shares: 0n }) }, null,
      ])
      .mockResolvedValueOnce([
        { owner, data: winnerRecord({ mint, winner, shares: 41n }) },
        { owner, data: winRecord({ mint, winId, winner, shares: 42n }) },
      ]) }
    await expect(recordSolanaLotteryWinner({ connection: connection as any, payer, request: {
      creatorMint: mint.toBase58(), winnerSolana: winner.toBase58(), sharesPaid: 42n, winId,
    } })).rejects.toThrow('winner_record_readback_failed')
    expect(winnerRecordMatches(Buffer.alloc(89), {
      creatorMint: mint.toBase58(), winnerSolana: winner.toBase58(), sharesPaid: 42n, winId,
    })).toBe(false)
  })
})
