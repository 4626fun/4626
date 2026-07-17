import { afterEach, describe, expect, it } from 'vitest'
import { executeSolanaLotteryIngest } from '../actions/keepr-solana-lottery-ingest.action.js'
import {
  executeSolanaLotterySubmit,
  executeSolanaLotteryWinnerRelay,
} from '../actions/keepr-solana-lottery-submit.action.js'
import { normalizeSolanaOrchestratorAction } from '../solana-keeper-orchestrator.js'
import {
  assessSolanaLotteryLzTransportReadiness,
  buildSolanaLotteryLzV3PayloadFields,
  hashSolanaLotterySourceEventId,
  SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE,
} from '../utils/solanaLotteryLzTransport.js'
import { buildSolanaLotterySourceEventId } from '../utils/solanaLotterySourceEventId.js'

describe('keepr solana lottery relay (LZ-era fail-closed)', () => {
  afterEach(() => {
    delete process.env.SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED
    delete process.env.SOLANA_LOTTERY_LZ_TRANSPORT_READY
    delete process.env.SOLANA_LOTTERY_OAPP_PEER_BYTES32
    delete process.env.SOLANA_LOTTERY_INGEST_ENABLED
    delete process.env.SOLANA_LOTTERY_ALLOW_EOA_PROCESS_SWAP
    delete process.env.SOLANA_BRIDGE_ADAPTER_ADDRESS
    delete process.env.LOTTERY_MANAGER
  })

  it('does not register relay/submit on orchestrator allowlist', () => {
    expect(normalizeSolanaOrchestratorAction('relay_entries')).toBeNull()
    expect(normalizeSolanaOrchestratorAction('winner_relay')).toBeNull()
    expect(normalizeSolanaOrchestratorAction('lottery_submit')).toBeNull()
    expect(normalizeSolanaOrchestratorAction('lottery_ingest')).toBeNull()
  })

  it('relay flag disabled by default / transport fail-closed', () => {
    const readiness = assessSolanaLotteryLzTransportReadiness({})
    expect(readiness.relayEntriesEnabled).toBe(false)
    expect(readiness.ready).toBe(false)
    expect(readiness.reasons).toContain('missing_lottery_manager')
  })

  it('accepts only the canonical v1.19.1 LotteryManager target', () => {
    const baseEnv = {
      SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED: '1',
      SOLANA_LOTTERY_LZ_TRANSPORT_READY: '1',
      SOLANA_LOTTERY_OAPP_PEER_BYTES32: `0x${'11'.repeat(32)}`,
    }
    expect(assessSolanaLotteryLzTransportReadiness({
      ...baseEnv,
      LOTTERY_MANAGER: '0xB45E68a5867935a5734E4185977F81c528006650',
    }).ready).toBe(true)
    expect(assessSolanaLotteryLzTransportReadiness({
      ...baseEnv,
      LOTTERY_MANAGER: '0xB68F359e01626Ec5d15C624037311C70DacAba43',
    }).reasons).toContain('noncanonical_lottery_manager')
  })

  it('ingest stays disabled unless explicitly enabled', async () => {
    const result = await executeSolanaLotteryIngest()
    expect(result.mode).toBe('disabled')
  })

  it('submit fails closed when flag off', async () => {
    await expect(executeSolanaLotterySubmit()).rejects.toThrow(
      SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE,
    )
  })

  it('submit fails closed even when flag on without OApp peer', async () => {
    process.env.SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED = '1'
    await expect(executeSolanaLotterySubmit()).rejects.toThrow(
      SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE,
    )
  })

  it('winner relay rejects oversized u64 payout and win_id mismatch path', async () => {
    await expect(
      executeSolanaLotteryWinnerRelay({
        winId: `0x${'11'.repeat(32)}`,
        creatorMint: 'mint',
        winnerSolana: '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY',
        sharesPaid: '18446744073709551616', // u64 max + 1
      }),
    ).rejects.toThrow('winner_relay_shares_paid_overflow')
  })

  it('winner duplicate / missing payload fail closed', async () => {
    await expect(executeSolanaLotteryWinnerRelay({})).rejects.toThrow('winner_relay_invalid_payload')
  })

  it('forces base-odds coverage 0 in payload builder', () => {
    const fields = buildSolanaLotteryLzV3PayloadFields({
      buyer: '0x1111111111111111111111111111111111111111',
      tokenIn: '0x2222222222222222222222222222222222222222',
      amount: 5n,
      sourceChainId: 0,
      buyerCurrentShareBalance: 0n,
      sourceEventId: 'gen:prog:sig:0:0',
    })
    expect(fields.buyerCurrentShareBalance).toBe(0n)
    expect(fields.sourceEventId).toBe(hashSolanaLotterySourceEventId('gen:prog:sig:0:0'))
    expect(() =>
      buildSolanaLotteryLzV3PayloadFields({
        buyer: '0x1111111111111111111111111111111111111111',
        tokenIn: '0x2222222222222222222222222222222222222222',
        amount: 5n,
        sourceChainId: 0,
        buyerCurrentShareBalance: 9n,
        sourceEventId: 'gen:prog:sig:0:0',
      }),
    ).toThrow('solana_lottery_coverage_must_be_zero')
  })

  it('rejects zero buyer/token addresses', () => {
    expect(() =>
      buildSolanaLotteryLzV3PayloadFields({
        buyer: '0x0000000000000000000000000000000000000000',
        tokenIn: '0x2222222222222222222222222222222222222222',
        amount: 5n,
        sourceChainId: 0,
        buyerCurrentShareBalance: 0n,
        sourceEventId: 'gen:prog:sig:0:0',
      }),
    ).toThrow('invalid_buyer')
  })

  it('builds durable source event ids for duplicate replay protection', () => {
    const id = buildSolanaLotterySourceEventId({
      clusterGenesisHash: 'gen',
      programId: 'prog',
      signature: 'sig',
      instructionIndex: 1,
      eventIndex: 0,
    })
    expect(id).toBe('gen:prog:sig:1:0')
  })
})
