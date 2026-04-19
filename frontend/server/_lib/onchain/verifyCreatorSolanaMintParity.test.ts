import { describe, expect, it, vi } from 'vitest'

import { verifyCreatorSolanaMintParity } from './verifyCreatorSolanaMintParity'

const AKITA = '0x5b674196812451b7cec024fe9d22d2c0b172fa75' as const
const V2_ADAPTER = '0x653326dD0145656eC3b598943C0E84d7405aE6Ae' as const
const AKITA_V2_MINT_BYTES32 =
  '0x7b59f36c2fc48080f7489f4100731c8ddc8f53b25d8ded62b81931892ac53a33' as const
const AKITA_V2_MINT_PUBKEY = '9JWhbEAVpuHQdx1x5kSH62p6ZrWivqcBfARhvdLsLJdp'

function makeBaseClient(reads: Record<string, unknown>) {
  return {
    readContract: vi.fn(async (args: any) => {
      const key = `${args.address.toLowerCase()}:${args.functionName}`
      if (key in reads) return reads[key]
      throw new Error(`unmocked read ${key}`)
    }),
  }
}

describe('verifyCreatorSolanaMintParity', () => {
  it('returns matched=true when all three layers agree (AKITA v2)', async () => {
    const baseClient = makeBaseClient({
      [`${AKITA}:name`]: 'akita',
      [`${AKITA}:symbol`]: 'akita',
      [`${V2_ADAPTER.toLowerCase()}:isRegistered`]: true,
      [`${V2_ADAPTER.toLowerCase()}:tokenToSolanaMint`]: AKITA_V2_MINT_BYTES32,
      [`${V2_ADAPTER.toLowerCase()}:tokenToSolanaDecimals`]: 9,
    })
    const solanaFetcher = vi.fn(async (mint: string) => ({
      name: 'akita',
      symbol: 'akita',
      decimals: 9,
      supply: '1',
      hasTokenMetadataExtension: true,
    }))
    const result = await verifyCreatorSolanaMintParity({
      creatorToken: AKITA,
      adapterAddress: V2_ADAPTER,
      deployEnv: 'mainnet',
      expectedDecimals: 9,
      expectedScalerExponent: 9,
      basePublicClient: baseClient as any,
      solanaMintMetadataFetcher: solanaFetcher,
    })
    expect(result.matched).toBe(true)
    expect(result.drift).toEqual([])
    expect(result.expectedMintPubkey).toBe(AKITA_V2_MINT_PUBKEY)
    expect(result.adapterRegisteredMint).toBe(AKITA_V2_MINT_BYTES32)
    expect(solanaFetcher).toHaveBeenCalledWith(AKITA_V2_MINT_PUBKEY)
  })

  it('detects base-vs-onchain casing drift on the Solana mint', async () => {
    const baseClient = makeBaseClient({
      [`${AKITA}:name`]: 'akita',
      [`${AKITA}:symbol`]: 'akita',
      [`${V2_ADAPTER.toLowerCase()}:isRegistered`]: true,
      [`${V2_ADAPTER.toLowerCase()}:tokenToSolanaMint`]: AKITA_V2_MINT_BYTES32,
      [`${V2_ADAPTER.toLowerCase()}:tokenToSolanaDecimals`]: 9,
    })
    const solanaFetcher = vi.fn(async () => ({
      name: 'AKITA', // drift!
      symbol: 'akita',
      decimals: 9,
      supply: '1',
      hasTokenMetadataExtension: true,
    }))
    const result = await verifyCreatorSolanaMintParity({
      creatorToken: AKITA,
      adapterAddress: V2_ADAPTER,
      deployEnv: 'mainnet',
      expectedDecimals: 9,
      expectedScalerExponent: 9,
      basePublicClient: baseClient as any,
      solanaMintMetadataFetcher: solanaFetcher,
    })
    expect(result.matched).toBe(false)
    expect(result.drift.some((d) => d.includes('solana_mint_name_mismatch'))).toBe(true)
  })

  it('detects adapter-vs-derived mint mismatch (legacy v1 case)', async () => {
    // Simulate the v1 adapter case: Base returns "akita"/"akita" but the
    // adapter still registers the ZORA-labeled PDA HuY4... .
    const V1_MINT_BYTES32 =
      '0xfb3050a9d9a2540f6c7de77b1e0bd9df44e610912f20954146992916e08aeea8'
    const V1_ADAPTER = '0x90F578A4e23c1cB8DDFE63fd496ED7F4474f2b00'
    const baseClient = makeBaseClient({
      [`${AKITA}:name`]: 'akita',
      [`${AKITA}:symbol`]: 'akita',
      [`${V1_ADAPTER.toLowerCase()}:isRegistered`]: true,
      [`${V1_ADAPTER.toLowerCase()}:tokenToSolanaMint`]: V1_MINT_BYTES32,
      [`${V1_ADAPTER.toLowerCase()}:tokenToSolanaDecimals`]: 9,
    })
    const solanaFetcher = vi.fn(async (mint: string) => ({
      name: 'akita',
      symbol: 'akita',
      decimals: 9,
      supply: '1',
      hasTokenMetadataExtension: true,
    }))
    const result = await verifyCreatorSolanaMintParity({
      creatorToken: AKITA,
      adapterAddress: V1_ADAPTER as any,
      deployEnv: 'mainnet',
      expectedDecimals: 9,
      expectedScalerExponent: 9,
      basePublicClient: baseClient as any,
      solanaMintMetadataFetcher: solanaFetcher,
    })
    expect(result.matched).toBe(false)
    expect(result.drift.some((d) => d.includes('adapter_mint_mismatch'))).toBe(true)
  })

  it('detects adapter-not-registered state', async () => {
    const baseClient = makeBaseClient({
      [`${AKITA}:name`]: 'akita',
      [`${AKITA}:symbol`]: 'akita',
      [`${V2_ADAPTER.toLowerCase()}:isRegistered`]: false,
      [`${V2_ADAPTER.toLowerCase()}:tokenToSolanaMint`]:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      [`${V2_ADAPTER.toLowerCase()}:tokenToSolanaDecimals`]: 0,
    })
    const solanaFetcher = vi.fn(async () => ({
      name: 'akita',
      symbol: 'akita',
      decimals: 9,
      supply: '1',
      hasTokenMetadataExtension: true,
    }))
    const result = await verifyCreatorSolanaMintParity({
      creatorToken: AKITA,
      adapterAddress: V2_ADAPTER,
      deployEnv: 'mainnet',
      expectedDecimals: 9,
      expectedScalerExponent: 9,
      basePublicClient: baseClient as any,
      solanaMintMetadataFetcher: solanaFetcher,
    })
    expect(result.matched).toBe(false)
    expect(result.drift.some((d) => d.includes('adapter_not_registered'))).toBe(true)
  })

  it('flags missing tokenMetadata extension on Solana side', async () => {
    const baseClient = makeBaseClient({
      [`${AKITA}:name`]: 'akita',
      [`${AKITA}:symbol`]: 'akita',
      [`${V2_ADAPTER.toLowerCase()}:isRegistered`]: true,
      [`${V2_ADAPTER.toLowerCase()}:tokenToSolanaMint`]: AKITA_V2_MINT_BYTES32,
      [`${V2_ADAPTER.toLowerCase()}:tokenToSolanaDecimals`]: 9,
    })
    const solanaFetcher = vi.fn(async () => ({
      name: null,
      symbol: null,
      decimals: 9,
      supply: '0',
      hasTokenMetadataExtension: false,
    }))
    const result = await verifyCreatorSolanaMintParity({
      creatorToken: AKITA,
      adapterAddress: V2_ADAPTER,
      deployEnv: 'mainnet',
      expectedDecimals: 9,
      expectedScalerExponent: 9,
      basePublicClient: baseClient as any,
      solanaMintMetadataFetcher: solanaFetcher,
    })
    expect(result.matched).toBe(false)
    expect(
      result.drift.some((d) => d.includes('solana_mint_missing_tokenMetadata_extension')),
    ).toBe(true)
  })

  it('flags Base read failures without crashing', async () => {
    const baseClient = {
      readContract: vi.fn(async (args: any) => {
        if (args.functionName === 'name') throw new Error('rpc_down')
        return 'never'
      }),
    }
    const solanaFetcher = vi.fn(async () => ({
      name: 'akita',
      symbol: 'akita',
      decimals: 9,
      supply: '1',
      hasTokenMetadataExtension: true,
    }))
    const result = await verifyCreatorSolanaMintParity({
      creatorToken: AKITA,
      adapterAddress: V2_ADAPTER,
      deployEnv: 'mainnet',
      expectedDecimals: 9,
      expectedScalerExponent: 9,
      basePublicClient: baseClient as any,
      solanaMintMetadataFetcher: solanaFetcher,
    })
    expect(result.matched).toBe(false)
    expect(result.drift.some((d) => d.includes('base_erc20_read_failed'))).toBe(true)
  })
})
