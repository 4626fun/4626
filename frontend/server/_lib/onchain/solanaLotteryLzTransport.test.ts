import { afterEach, describe, expect, it } from 'vitest'
import { decodeAbiParameters } from 'viem'
import {
  assessSolanaLotteryLzTransportReadiness,
  buildSolanaLotteryLzV3Payload,
  hashSolanaLotterySourceEventId,
  MSG_TYPE_LOTTERY_ENTRY,
  SOLANA_LOTTERY_EOA_SUBMIT_FORBIDDEN,
  SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE,
  submitSolanaLotteryEntryViaLz,
  CANONICAL_LOTTERY_MANAGER_PEER_BYTES32,
} from './solanaLotteryLzTransport.js'

describe('solanaLotteryLzTransport', () => {
  const envKeys = [
    'SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED',
    'SOLANA_LOTTERY_LZ_TRANSPORT_READY',
    'SOLANA_LOTTERY_OAPP_PEER_BYTES32',
    'LOTTERY_MANAGER',
    'LOTTERY_MANAGER_ADDRESS',
    'VITE_LOTTERY_MANAGER',
    'SOLANA_BRIDGE_ADAPTER_ADDRESS',
    'SOLANA_LOTTERY_ALLOW_EOA_PROCESS_SWAP',
    'SOLANA_LOTTERY_OAPP_SENDER_MODE',
    'SOLANA_LOTTERY_OAPP_ALLOW_MOCK_SEND',
    'SOLANA_LOTTERY_OAPP_SEND_URL',
    'SOLANA_LOTTERY_OAPP_SEND_TOKEN',
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
      SOLANA_LOTTERY_OAPP_PEER_BYTES32: CANONICAL_LOTTERY_MANAGER_PEER_BYTES32,
      LOTTERY_MANAGER_ADDRESS: '0xb68f359e01626ec5d15c624037311c70dacaba43',
      SOLANA_BRIDGE_ADAPTER_ADDRESS: '0x9A61814082A26192DD9Cb201b44058506685Be60',
    })
    expect(readiness.reasons).toContain('retired_twin_adapter_configured')
    expect(readiness.ready).toBe(false)
  })

  it('accepts canonical LotteryManager env names when all readiness gates are set', () => {
    const readiness = assessSolanaLotteryLzTransportReadiness({
      SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED: '1',
      SOLANA_LOTTERY_LZ_TRANSPORT_READY: '1',
      SOLANA_LOTTERY_OAPP_PEER_BYTES32: CANONICAL_LOTTERY_MANAGER_PEER_BYTES32,
      LOTTERY_MANAGER: '0xb45e68a5867935a5734e4185977f81c528006650',
      SOLANA_LOTTERY_OAPP_SENDER_MODE: 'mock',
      SOLANA_LOTTERY_OAPP_ALLOW_MOCK_SEND: '1',
    })
    expect(readiness.ready).toBe(true)
    expect(readiness.lotteryManager).toBe('0xb45e68a5867935a5734e4185977f81c528006650')
  })

  it('allows only the canary lane to bypass the production relay flag', () => {
    const readiness = assessSolanaLotteryLzTransportReadiness({
      SOLANA_LOTTERY_LZ_TRANSPORT_READY: '1',
      SOLANA_LOTTERY_OAPP_PEER_BYTES32: CANONICAL_LOTTERY_MANAGER_PEER_BYTES32,
      LOTTERY_MANAGER: '0xb45e68a5867935a5734e4185977f81c528006650',
      SOLANA_LOTTERY_OAPP_SENDER_MODE: 'mock',
      SOLANA_LOTTERY_OAPP_ALLOW_MOCK_SEND: '1',
    }, { allowCanary: true })
    expect(readiness.ready).toBe(true)
    expect(readiness.relayEntriesEnabled).toBe(false)
  })

  it('fails before submit fencing when the HTTP sender URL or token is missing', () => {
    const readiness = assessSolanaLotteryLzTransportReadiness({
      SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED: '1',
      SOLANA_LOTTERY_LZ_TRANSPORT_READY: '1',
      SOLANA_LOTTERY_OAPP_PEER_BYTES32: CANONICAL_LOTTERY_MANAGER_PEER_BYTES32,
      LOTTERY_MANAGER: '0xb45e68a5867935a5734e4185977f81c528006650',
      SOLANA_LOTTERY_OAPP_SENDER_MODE: 'http',
    })
    expect(readiness.ready).toBe(false)
    expect(readiness.reasons).toEqual(expect.arrayContaining(['missing_oapp_send_url', 'missing_oapp_send_token']))
  })

  it('rejects a non-canonical OApp peer even when other transport gates are set', () => {
    const readiness = assessSolanaLotteryLzTransportReadiness({
      SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED: '1',
      SOLANA_LOTTERY_LZ_TRANSPORT_READY: '1',
      SOLANA_LOTTERY_OAPP_PEER_BYTES32: `0x${'11'.repeat(32)}`,
      LOTTERY_MANAGER: '0xb45e68a5867935a5734e4185977f81c528006650',
      SOLANA_LOTTERY_OAPP_SENDER_MODE: 'mock',
      SOLANA_LOTTERY_OAPP_ALLOW_MOCK_SEND: '1',
    })
    expect(readiness.ready).toBe(false)
    expect(readiness.reasons).toContain('noncanonical_solana_lottery_oapp_peer')
  })

  it('rejects a retired LotteryManager even when other gates are set', () => {
    const readiness = assessSolanaLotteryLzTransportReadiness({
      SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED: '1',
      SOLANA_LOTTERY_LZ_TRANSPORT_READY: '1',
      SOLANA_LOTTERY_OAPP_PEER_BYTES32: CANONICAL_LOTTERY_MANAGER_PEER_BYTES32,
      LOTTERY_MANAGER: '0xb68f359e01626ec5d15c624037311c70dacaba43',
    })
    expect(readiness.ready).toBe(false)
    expect(readiness.reasons).toContain('noncanonical_lottery_manager')
  })

  it('builds V3 payload with coverage zero and a source-event replay key', () => {
    const sourceEventId = hashSolanaLotterySourceEventId('g:p:s:0:0')
    const payload = buildSolanaLotteryLzV3Payload({
      buyer: '0x1111111111111111111111111111111111111111',
      tokenIn: '0x2222222222222222222222222222222222222222',
      amount: 123n,
      sourceChainId: 0,
      buyerCurrentShareBalance: 0n,
      sourceEventId,
    })
    const decoded = decodeAbiParameters(
      [
        { type: 'uint16' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint32' },
        { type: 'uint256' },
        { type: 'bytes32' },
      ],
      payload,
    )
    expect(decoded[0]).toBe(MSG_TYPE_LOTTERY_ENTRY)
    expect(decoded[5]).toBe(0n)
    expect(decoded[6]).toBe(sourceEventId)
  })

  it('rejects non-zero coverage (boost unavailable)', () => {
    expect(() =>
      buildSolanaLotteryLzV3Payload({
        buyer: '0x1111111111111111111111111111111111111111',
        tokenIn: '0x2222222222222222222222222222222222222222',
        amount: 1n,
        sourceChainId: 0,
        buyerCurrentShareBalance: 1n,
        sourceEventId: hashSolanaLotterySourceEventId('g:p:s:0:0'),
      }),
    ).toThrow('solana_lottery_coverage_must_be_zero')
  })

  it('rejects an empty source-event replay key', () => {
    expect(() => hashSolanaLotterySourceEventId('   ')).toThrow('invalid_source_event_id')
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

  it('submits via configured mock OApp sender when readiness passes', async () => {
    process.env.SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED = '1'
    process.env.SOLANA_LOTTERY_LZ_TRANSPORT_READY = '1'
    process.env.SOLANA_LOTTERY_OAPP_PEER_BYTES32 = CANONICAL_LOTTERY_MANAGER_PEER_BYTES32
    process.env.LOTTERY_MANAGER = '0xB45E68a5867935a5734E4185977F81c528006650'
    process.env.SOLANA_LOTTERY_OAPP_SENDER_MODE = 'mock'
    process.env.SOLANA_LOTTERY_OAPP_ALLOW_MOCK_SEND = '1'

    const result = await submitSolanaLotteryEntryViaLz({
      sourceEventId: 'g:p:s:0:0',
      buyer: '0x1111111111111111111111111111111111111111',
      tokenIn: '0x2222222222222222222222222222222222222222',
      amount: 1n,
    })
    expect(result.ok).toBe(true)
    expect(result.lzGuid).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('submits one authorized canary while production relay remains disabled', async () => {
    process.env.SOLANA_LOTTERY_LZ_TRANSPORT_READY = '1'
    process.env.SOLANA_LOTTERY_OAPP_PEER_BYTES32 = CANONICAL_LOTTERY_MANAGER_PEER_BYTES32
    process.env.LOTTERY_MANAGER = '0xB45E68a5867935a5734E4185977F81c528006650'
    process.env.SOLANA_LOTTERY_OAPP_SENDER_MODE = 'mock'
    process.env.SOLANA_LOTTERY_OAPP_ALLOW_MOCK_SEND = '1'

    const result = await submitSolanaLotteryEntryViaLz({
      sourceEventId: 'g:p:canary:0:0',
      buyer: '0x1111111111111111111111111111111111111111',
      tokenIn: '0x2222222222222222222222222222222222222222',
      amount: 1n,
    }, { canaryAuthorized: true })
    expect(result.ok).toBe(true)
  })

})
