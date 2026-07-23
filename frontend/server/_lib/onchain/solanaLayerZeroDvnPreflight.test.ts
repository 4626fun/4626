import { describe, expect, it } from 'vitest'

import {
  MAINNET_BASE_SOLANA_DVNS,
  readSolanaLayerZeroDvnPreflight,
} from '../../../scripts/ops/preflight-solana-lz-dvns.js'
import {
  matchOptionalDvnsToActiveMetadata,
  resolveFinalUlnConfig,
} from '../../../scripts/ops/preflight-solana-lottery-oapp.js'
import { PublicKey } from '@solana/web3.js'

function metadata(names: readonly string[], options?: { deprecated?: string }): Record<string, unknown> {
  return Object.fromEntries(names.map((name, index) => [
    `dvn-${index}`,
    {
      canonicalName: name,
      version: 2,
      ...(options?.deprecated === name ? { deprecated: true } : {}),
    },
  ]))
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('LayerZero DVN metadata preflight', () => {
  it('accepts the active shared 3-of-5 policy', async () => {
    const result = await readSolanaLayerZeroDvnPreflight({
      fetchImpl: async () => response({
        base: { chainName: 'base', environment: 'mainnet', dvns: metadata(MAINNET_BASE_SOLANA_DVNS) },
        solana: { chainName: 'solana', environment: 'mainnet', dvns: metadata(MAINNET_BASE_SOLANA_DVNS) },
      }),
    })
    expect(result.ok).toBe(true)
    expect(result.checks.active_shared_dvns).toBe(true)
    expect(result.threshold).toBe(3)
  })

  it('fails closed when a shared DVN is deprecated on one chain', async () => {
    const result = await readSolanaLayerZeroDvnPreflight({
      fetchImpl: async () => response({
        base: { chainName: 'base', environment: 'mainnet', dvns: metadata(MAINNET_BASE_SOLANA_DVNS) },
        solana: {
          chainName: 'solana',
          environment: 'mainnet',
          dvns: metadata(MAINNET_BASE_SOLANA_DVNS, { deprecated: 'Google' }),
        },
      }),
    })
    expect(result.ok).toBe(false)
    expect(result.checks.active_shared_dvns).toBe(false)
  })

  it('fails closed on metadata transport errors', async () => {
    const result = await readSolanaLayerZeroDvnPreflight({
      fetchImpl: async () => response({ error: 'unavailable' }, 503),
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('dvn_metadata_http_503')
  })

  it('resolves an OApp custom ULN config without treating NIL counts as a fallback', () => {
    const dvns = Array.from({ length: 5 }, (_, index) => new PublicKey(new Uint8Array(32).fill(index + 1)))
    const defaults = {
      uln: {
        requiredDvnCount: 0,
        optionalDvnCount: 5,
        optionalDvnThreshold: 3,
        requiredDvns: [],
        optionalDvns: dvns,
      },
    }
    const resolved = resolveFinalUlnConfig(defaults, {
      uln: {
        requiredDvnCount: 255,
        optionalDvnCount: 255,
        optionalDvnThreshold: 0,
        requiredDvns: [],
        optionalDvns: [],
      },
    })
    expect(resolved.requiredDvnCount).toBe(0)
    expect(resolved.optionalDvnCount).toBe(0)
    expect(resolved.optionalDvnThreshold).toBe(0)
  })

  it('requires every on-chain DVN to match one active Solana metadata entry', async () => {
    const addresses = MAINNET_BASE_SOLANA_DVNS.map((_, index) => new PublicKey(new Uint8Array(32).fill(index + 1)))
    const metadataResult = await readSolanaLayerZeroDvnPreflight({
      fetchImpl: async () => response({
        base: { chainName: 'base', environment: 'mainnet', dvns: metadata(MAINNET_BASE_SOLANA_DVNS) },
        solana: {
          chainName: 'solana',
          environment: 'mainnet',
          dvns: Object.fromEntries(addresses.map((address, index) => [
            address.toBase58(),
            { canonicalName: MAINNET_BASE_SOLANA_DVNS[index], version: 2 },
          ])),
        },
      }),
    })
    expect(matchOptionalDvnsToActiveMetadata(addresses, metadataResult)).toMatchObject({ ok: true })
    const unknown = [...addresses]
    unknown[0] = new PublicKey(new Uint8Array(32).fill(31))
    expect(matchOptionalDvnsToActiveMetadata(unknown, metadataResult).ok).toBe(false)
  })

  it('accepts the official Base Sepolia and Solana Devnet 2-of-2 policy', async () => {
    const names = ['LayerZero Labs', 'P2P'] as const
    const addresses = [
      new PublicKey('4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb'),
      new PublicKey('29EKzmCscUg8mf4f5uskwMqvu2SXM8hKF1gWi1cCBoKT'),
    ]
    const metadataResult = await readSolanaLayerZeroDvnPreflight({
      stage: 'testnet',
      chains: ['base-sepolia', 'solana-testnet'],
      expectedDvns: names,
      threshold: 2,
      fetchImpl: async () => response({
        'basesep-testnet': {
          chainKey: 'base-sepolia',
          deployments: [{ chainKey: 'base-sepolia', stage: 'testnet', version: 2 }],
          dvns: {
            '0xe1a12515f9ab2764b887bf60b923ca494ebbb2d6': { canonicalName: 'LayerZero Labs', version: 2 },
            '0xbf6ff58f60606edb2f190769b951d825bcb214e2': {
              canonicalName: 'LayerZero Labs',
              version: 2,
              lzReadCompatible: true,
            },
            '0x63ef73671245d1a290f2a675be9d906090f72a8d': { canonicalName: 'P2P', version: 2 },
          },
        },
        'solana-testnet': {
          chainKey: 'solana-testnet',
          deployments: [{ chainKey: 'solana-testnet', stage: 'testnet', version: 2 }],
          dvns: Object.fromEntries(addresses.map((address, index) => [
            address.toBase58(),
            { canonicalName: names[index], version: 2 },
          ])),
        },
      }),
    })
    expect(metadataResult).toMatchObject({ ok: true, threshold: 2 })
    expect(metadataResult.candidates['LayerZero Labs'].filter((candidate) => candidate.chain === 'base-sepolia')).toHaveLength(1)
    expect(matchOptionalDvnsToActiveMetadata(addresses, metadataResult, names, 'solana-testnet')).toMatchObject({ ok: true })
  })
})
