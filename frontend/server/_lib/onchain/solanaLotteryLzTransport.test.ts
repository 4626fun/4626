import { afterEach, describe, expect, it } from 'vitest'
import { decodeAbiParameters } from 'viem'
import {
  assessSolanaLotteryLzTransportReadiness,
  buildSolanaLotteryLzV2Payload,
  MSG_TYPE_LOTTERY_ENTRY,
  SOLANA_LOTTERY_EOA_SUBMIT_FORBIDDEN,
  SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE,
  submitSolanaLotteryEntryViaLz,
  submitSolanaLotteryWinnerViaLz,
} from './solanaLotteryLzTransport.js'

describe('solanaLotteryLzTransport', () => {
  const envKeys = [
    'SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED',
    'SOLANA_LOTTERY_LZ_TRANSPORT_READY',
    'SOLANA_LOTTERY_OAPP_PEER_BYTES32',
    'LOTTERY_MANAGER_ADDRESS',
    'SOLANA_BRIDGE_ADAPTER_ADDRESS',
    'SOLANA_LOTTERY_ALLOW_EOA_PROCESS_SWAP',
  ] as const

  afterEach(() => {
    for (const key of envKeys) delete process.env[key]
  })

  it('fail-closes when relay flag disabled by default', () => {
    const readiness = assessSolanaLotteryLzTransportReadiness({})
    expect(readiness.ready).toBe(false)
    expect(readiness.reasons).toContain('relay_flag_disabled')
  })

  it('fail-closes when transport missing', () => {
    const readiness = assessSolanaLotteryLzTransportReadiness({
      SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED: '1',
    })
    expect(readiness.ready).toBe(false)
    expect(readiness.reasons).toContain('transport_ready_env_unset')
    expect(readiness.reasons).toContain('missing_solana_lottery_oapp_peer')
  })

  it('rejects retired Twin adapter in active config', () => {
    const readiness = assessSolanaLotteryLzTransportReadiness({
      SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED: '1',
      SOLANA_LOTTERY_LZ_TRANSPORT_READY: '1',
      SOLANA_LOTTERY_OAPP_PEER_BYTES32: `0x${'11'.repeat(32)}`,
      LOTTERY_MANAGER_ADDRESS: '0xb68f359e01626ec5d15c624037311c70dacaba43',
      SOLANA_BRIDGE_ADAPTER_ADDRESS: '0x9A61814082A26192DD9Cb201b44058506685Be60',
    })
    expect(readiness.reasons).toContain('retired_twin_adapter_configured')
    expect(readiness.ready).toBe(false)
  })

  it('builds V2 payload with coverage forced to zero (base-odds-only)', () => {
    const payload = buildSolanaLotteryLzV2Payload({
      buyer: '0x1111111111111111111111111111111111111111',
      tokenIn: '0x2222222222222222222222222222222222222222',
      amount: 123n,
      sourceChainId: 0,
      buyerCurrentShareBalance: 0n,
    })
    const decoded = decodeAbiParameters(
      [
        { type: 'uint16' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint32' },
        { type: 'uint256' },
      ],
      payload,
    )
    expect(decoded[0]).toBe(MSG_TYPE_LOTTERY_ENTRY)
    expect(decoded[5]).toBe(0n)
  })

  it('rejects non-zero coverage (boost unavailable)', () => {
    expect(() =>
      buildSolanaLotteryLzV2Payload({
        buyer: '0x1111111111111111111111111111111111111111',
        tokenIn: '0x2222222222222222222222222222222222222222',
        amount: 1n,
        sourceChainId: 0,
        buyerCurrentShareBalance: 1n,
      }),
    ).toThrow('solana_lottery_coverage_must_be_zero')
  })

  it('submit fails closed when transport unavailable', async () => {
    await expect(
      submitSolanaLotteryEntryViaLz({
        sourceEventId: 'g:p:s:0:0',
        buyer: '0x1111111111111111111111111111111111111111',
        tokenIn: '0x2222222222222222222222222222222222222222',
        amount: 1n,
      }),
    ).rejects.toThrow(SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE)
  })

  it('forbids EOA processSwapLottery escape hatch', async () => {
    process.env.SOLANA_LOTTERY_ALLOW_EOA_PROCESS_SWAP = '1'
    await expect(
      submitSolanaLotteryEntryViaLz({
        sourceEventId: 'g:p:s:0:0',
        buyer: '0x1111111111111111111111111111111111111111',
        tokenIn: '0x2222222222222222222222222222222222222222',
        amount: 1n,
      }),
    ).rejects.toThrow(SOLANA_LOTTERY_EOA_SUBMIT_FORBIDDEN)
  })

  it('winner relay fails closed on win_id path', async () => {
    await expect(
      submitSolanaLotteryWinnerViaLz({
        winId: `0x${'ab'.repeat(32)}`,
        creatorMint: 'mint',
        winnerSolana: '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY',
        sharesPaid: 1n,
      }),
    ).rejects.toThrow(/winner_relay_not_implemented/)
  })
})
