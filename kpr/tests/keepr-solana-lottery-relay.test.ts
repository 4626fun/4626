import { afterEach, describe, expect, it, vi } from 'vitest'
import { executeSolanaLotteryIngest } from '../actions/keepr-solana-lottery-ingest.action.js'
import {
  executeSolanaLotterySubmit,
} from '../actions/keepr-solana-lottery-submit.action.js'
import { normalizeSolanaOrchestratorAction } from '../solana-keeper-orchestrator.js'
import {
  assessSolanaLotteryLzTransportReadiness,
  buildSolanaLotteryLzV3PayloadFields,
  hashSolanaLotterySourceEventId,
  submitSolanaLotteryEntryViaLz,
  SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE,
  CANONICAL_LOTTERY_MANAGER_PEER_BYTES32,
} from '../utils/solanaLotteryLzTransport.js'
import { buildSolanaLotterySourceEventId } from '../utils/solanaLotterySourceEventId.js'

describe('keepr solana lottery relay (LZ-era fail-closed)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED
    delete process.env.SOLANA_LOTTERY_LZ_TRANSPORT_READY
    delete process.env.SOLANA_LOTTERY_OAPP_PEER_BYTES32
    delete process.env.SOLANA_LOTTERY_INGEST_ENABLED
    delete process.env.SOLANA_LOTTERY_ALLOW_EOA_PROCESS_SWAP
    delete process.env.SOLANA_B2_CANARY_AUTHORIZATION_ENABLED
    delete process.env.KPR_API_KEY
    delete process.env.SOLANA_BRIDGE_ADAPTER_ADDRESS
    delete process.env.LOTTERY_MANAGER
  })

  it('registers only the replacement inbox workers, not retired relay labels', () => {
    expect(normalizeSolanaOrchestratorAction('relay_entries')).toBeNull()
    expect(normalizeSolanaOrchestratorAction('winner_relay')).toBeNull()
    expect(normalizeSolanaOrchestratorAction('lottery_submit')).toBe('lottery_submit')
    expect(normalizeSolanaOrchestratorAction('lottery_ingest')).toBe('lottery_ingest')
    expect(normalizeSolanaOrchestratorAction('lottery_confirm')).toBe('lottery_confirm')
  })

  it('relay flag disabled by default / transport fail-closed', () => {
    const readiness = assessSolanaLotteryLzTransportReadiness({})
    expect(readiness.relayEntriesEnabled).toBe(false)
    expect(readiness.ready).toBe(false)
    expect(readiness.reasons).toContain('missing_lottery_manager')
  })

  it('allows the canary lane to bypass only the production relay flag', () => {
    const readiness = assessSolanaLotteryLzTransportReadiness({
      SOLANA_LOTTERY_LZ_TRANSPORT_READY: '1',
      SOLANA_LOTTERY_OAPP_PEER_BYTES32: CANONICAL_LOTTERY_MANAGER_PEER_BYTES32,
      LOTTERY_MANAGER: '0xB45E68a5867935a5734E4185977F81c528006650',
    }, { allowCanary: true })
    expect(readiness.ready).toBe(true)
    expect(readiness.relayEntriesEnabled).toBe(false)
  })

  it('accepts only the canonical v1.19.1 LotteryManager target', () => {
    const baseEnv = {
      SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED: '1',
      SOLANA_LOTTERY_LZ_TRANSPORT_READY: '1',
      SOLANA_LOTTERY_OAPP_PEER_BYTES32: CANONICAL_LOTTERY_MANAGER_PEER_BYTES32,
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

  it('rejects a non-canonical OApp peer', () => {
    const readiness = assessSolanaLotteryLzTransportReadiness({
      SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED: '1',
      SOLANA_LOTTERY_LZ_TRANSPORT_READY: '1',
      SOLANA_LOTTERY_OAPP_PEER_BYTES32: `0x${'11'.repeat(32)}`,
      LOTTERY_MANAGER: '0xB45E68a5867935a5734E4185977F81c528006650',
    })
    expect(readiness.ready).toBe(false)
    expect(readiness.reasons).toContain('noncanonical_solana_lottery_oapp_peer')
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

  it('canary lane reaches machine-auth gate without enabling production relay flag', async () => {
    process.env.SOLANA_B2_CANARY_AUTHORIZATION_ENABLED = '1'
    process.env.SOLANA_LOTTERY_LZ_TRANSPORT_READY = '1'
    process.env.SOLANA_LOTTERY_OAPP_PEER_BYTES32 = CANONICAL_LOTTERY_MANAGER_PEER_BYTES32
    process.env.LOTTERY_MANAGER = '0xB45E68a5867935a5734E4185977F81c528006650'
    process.env.KPR_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { released: 1 } }), { status: 200 }),
    ))
    await expect(executeSolanaLotterySubmit()).resolves.toMatchObject({ released: 1 })
    expect(fetch).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
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

  it('passes the canonical 224-byte V3 payload to the OApp sender', async () => {
    process.env.SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED = '1'
    process.env.SOLANA_LOTTERY_LZ_TRANSPORT_READY = '1'
    process.env.SOLANA_LOTTERY_OAPP_PEER_BYTES32 = CANONICAL_LOTTERY_MANAGER_PEER_BYTES32
    process.env.LOTTERY_MANAGER = '0xb45e68a5867935a5734e4185977f81c528006650'
    const send = vi.fn(async (request: { payload: string }) => {
      expect(request.payload).toMatch(/^0x[0-9a-f]{448}$/i)
      return {
        lzGuid: `0x${'ab'.repeat(32)}`,
        baseTxHash: null,
        solanaSignature: '1'.repeat(64),
      }
    })

    await expect(submitSolanaLotteryEntryViaLz({
      sourceEventId: 'gen:program:signature:0:0',
      buyer: '0x1111111111111111111111111111111111111111',
      tokenIn: '0x2222222222222222222222222222222222222222',
      amount: 5n,
    }, { sender: { send } })).resolves.toMatchObject({
      ok: true,
      lzGuid: `0x${'ab'.repeat(32)}`,
    })
    expect(send).toHaveBeenCalledOnce()
  })
})
