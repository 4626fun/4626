import { describe, expect, it } from 'vitest'

import {
  assessOappReceiverBinding,
  isExactDestinationUlnPolicy,
  matchEvmOptionalDvnsToActiveMetadata,
  resolveOappPreflightRoute,
} from '../../../scripts/ops/preflight-solana-lottery-oapp.js'

describe('solana lottery OApp preflight route selection', () => {
  it('keeps the default route bound to the canonical Base mainnet receiver', () => {
    const route = resolveOappPreflightRoute({ BASE_RPC_URL: 'https://base.example' })
    expect(route).toMatchObject({
      name: 'mainnet',
      destinationEid: 30_184,
      sourceEid: 30_168,
      receiver: '0xB45E68a5867935a5734E4185977F81c528006650',
    })
    expect(route.dvn).toMatchObject({ threshold: 3, expected: expect.arrayContaining(['Google', 'Nethermind']) })
  })

  it('requires an explicit isolated Base Sepolia receiver and verified DVN policy for the test route', () => {
    expect(() => resolveOappPreflightRoute({ SOLANA_LOTTERY_OAPP_ROUTE: 'testnet' }))
      .toThrow('test_route_receiver_missing_or_invalid')
    expect(() => resolveOappPreflightRoute({
      SOLANA_LOTTERY_OAPP_ROUTE: 'testnet',
      SOLANA_LOTTERY_TEST_RECEIVER: '0x1111111111111111111111111111111111111111',
    })).toThrow('test_route_base_sepolia_rpc_missing')

    expect(() => resolveOappPreflightRoute({
      SOLANA_LOTTERY_OAPP_ROUTE: 'testnet',
      SOLANA_LOTTERY_TEST_RECEIVER: '0x1111111111111111111111111111111111111111',
      BASE_SEPOLIA_RPC_URL: 'https://base-sepolia.example',
    })).toThrow('test_route_dvn_policy_missing_or_invalid')

    const configuredRoute = resolveOappPreflightRoute({
      SOLANA_LOTTERY_OAPP_ROUTE: 'testnet',
      SOLANA_LOTTERY_TEST_RECEIVER: '0x1111111111111111111111111111111111111111',
      BASE_SEPOLIA_RPC_URL: 'https://base-sepolia.example',
      SOLANA_LOTTERY_TEST_DVN_NAMES: 'LayerZero Labs,Brale,P2P',
      SOLANA_LOTTERY_TEST_DVN_THRESHOLD: '2',
    })
    expect(configuredRoute).toMatchObject({
      name: 'testnet',
      destinationEid: 40_245,
      sourceEid: 40_168,
      expectedPeer: `0x${'0'.repeat(24)}${'11'.repeat(20)}`,
    })
    expect(configuredRoute.dvn).toMatchObject({ threshold: 2, expected: ['LayerZero Labs', 'Brale', 'P2P'] })
  })

  it('fails closed for an unknown route name', () => {
    expect(() => resolveOappPreflightRoute({ SOLANA_LOTTERY_OAPP_ROUTE: 'mainnet-but-not-really' }))
      .toThrow('invalid_solana_lottery_oapp_route')
  })

  it('requires a real Base receiver endpoint, exact Store peer, and authorization', () => {
    const store = `0x${'11'.repeat(32)}` as const
    const base = {
      expectedStoreBytes32: store,
      receiverPeer: store,
      receiverEndpoint: '0x1111111111111111111111111111111111111111' as const,
      authorized: true,
    }
    expect(assessOappReceiverBinding(base)).toEqual({ ok: true })
    expect(assessOappReceiverBinding({ ...base, receiverPeer: `0x${'22'.repeat(32)}` as const }))
      .toEqual({ ok: false, reason: 'oapp_receiver_peer_mismatch' })
    expect(assessOappReceiverBinding({ ...base, receiverEndpoint: '0x0000000000000000000000000000000000000000' }))
      .toEqual({ ok: false, reason: 'oapp_receiver_endpoint_zero' })
    expect(assessOappReceiverBinding({ ...base, authorized: false }))
      .toEqual({ ok: false, reason: 'base_lottery_manager_oapp_store_unauthorized' })
  })

  it('requires the destination receive policy to use every non-read metadata DVN exactly once', () => {
    const layerZero = '0xe1a12515f9ab2764b887bf60b923ca494ebbb2d6' as const
    const p2p = '0x63ef73671245d1a290f2a675be9d906090f72a8d' as const
    const metadata = {
      ok: true,
      url: 'https://metadata.example/testnet',
      stage: 'testnet',
      chains: ['base-sepolia', 'solana-testnet'],
      threshold: 2,
      expectedDvns: ['LayerZero Labs', 'P2P'],
      checks: { 'LayerZero Labs': true, P2P: true },
      candidates: {
        'LayerZero Labs': [{ chain: 'base-sepolia', address: layerZero, canonicalName: 'LayerZero Labs', version: 2 }],
        P2P: [{ chain: 'base-sepolia', address: p2p, canonicalName: 'P2P', version: 2 }],
      },
    } as Parameters<typeof matchEvmOptionalDvnsToActiveMetadata>[1]
    const config = {
      confirmations: 10n,
      requiredDvnCount: 0,
      optionalDvnCount: 2,
      optionalDvnThreshold: 2,
      requiredDvns: [],
      optionalDvns: [p2p, layerZero],
    }

    expect(isExactDestinationUlnPolicy(config, 2, 2)).toBe(true)
    expect(matchEvmOptionalDvnsToActiveMetadata(config.optionalDvns, metadata, ['LayerZero Labs', 'P2P'], 'base-sepolia'))
      .toMatchObject({ ok: true, matchedNames: ['P2P', 'LayerZero Labs'] })
    expect(matchEvmOptionalDvnsToActiveMetadata([layerZero, p2p], metadata, ['LayerZero Labs', 'P2P'], 'base-sepolia'))
      .toMatchObject({ ok: false, reason: 'destination_optional_dvn_metadata_mismatch' })
  })
})
