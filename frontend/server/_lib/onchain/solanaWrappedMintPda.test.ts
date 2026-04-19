import { describe, expect, it } from 'vitest'

import {
  BRIDGE_PROGRAM_BY_ENV,
  deriveWrappedMintPda,
  solanaPubkeyToBytes32,
} from './solanaWrappedMintPda'

const AKITA = '0x5b674196812451b7cec024fe9d22d2c0b172fa75' as const

describe('deriveWrappedMintPda — golden fixtures', () => {
  // These two fixtures MUST stay verified against the live onchain state.
  // If either diverges, the bridge program's PDA derivation changed and
  // the SHARED library here is out of sync with the Coinbase base/bridge
  // Solana program at `HNCne2FkVaNghhjKXapxJzPaBvAKDG1Ge3gqhZyfVWLM`.

  it('AKITA legacy mapping: "Zora Creator Coin" / "ZORA" -> HuY4...9ouR', () => {
    const out = deriveWrappedMintPda({
      name: 'Zora Creator Coin',
      symbol: 'ZORA',
      decimals: 9,
      remoteToken: AKITA,
      scalerExponent: 9,
      deployEnv: 'mainnet',
    })
    expect(out.mintPubkey).toBe('HuY4cQk5wJBfdaduUFnLJUiqhDXKyMR7mgSUHpZN9ouR')
    expect(out.mintBytes32).toBe(
      '0xfb3050a9d9a2540f6c7de77b1e0bd9df44e610912f20954146992916e08aeea8',
    )
    expect(out.bridgeProgram).toBe(BRIDGE_PROGRAM_BY_ENV.mainnet)
  })

  it('AKITA lowercase-parity mapping: "akita" / "akita" -> 9JWh...LJdp', () => {
    const out = deriveWrappedMintPda({
      name: 'akita',
      symbol: 'akita',
      decimals: 9,
      remoteToken: AKITA,
      scalerExponent: 9,
      deployEnv: 'mainnet',
    })
    expect(out.mintPubkey).toBe('9JWhbEAVpuHQdx1x5kSH62p6ZrWivqcBfARhvdLsLJdp')
    expect(out.mintBytes32).toBe(
      '0x7b59f36c2fc48080f7489f4100731c8ddc8f53b25d8ded62b81931892ac53a33',
    )
  })

  it('changing case produces a different mint (PDA binding is exact)', () => {
    const lower = deriveWrappedMintPda({
      name: 'akita', symbol: 'akita', decimals: 9, remoteToken: AKITA, scalerExponent: 9, deployEnv: 'mainnet',
    })
    const upper = deriveWrappedMintPda({
      name: 'AKITA', symbol: 'AKITA', decimals: 9, remoteToken: AKITA, scalerExponent: 9, deployEnv: 'mainnet',
    })
    expect(upper.mintPubkey).not.toBe(lower.mintPubkey)
  })

  it('changing decimals produces a different mint', () => {
    const d9 = deriveWrappedMintPda({
      name: 'akita', symbol: 'akita', decimals: 9, remoteToken: AKITA, scalerExponent: 9, deployEnv: 'mainnet',
    })
    const d6 = deriveWrappedMintPda({
      name: 'akita', symbol: 'akita', decimals: 6, remoteToken: AKITA, scalerExponent: 9, deployEnv: 'mainnet',
    })
    expect(d6.mintPubkey).not.toBe(d9.mintPubkey)
  })

  it('deployEnv switches the bridge program and thus the mint', () => {
    const mainnet = deriveWrappedMintPda({
      name: 'akita', symbol: 'akita', decimals: 9, remoteToken: AKITA, scalerExponent: 9, deployEnv: 'mainnet',
    })
    const testnetAlpha = deriveWrappedMintPda({
      name: 'akita', symbol: 'akita', decimals: 9, remoteToken: AKITA, scalerExponent: 9, deployEnv: 'testnet-alpha',
    })
    expect(mainnet.mintPubkey).not.toBe(testnetAlpha.mintPubkey)
    expect(mainnet.bridgeProgram).toBe(BRIDGE_PROGRAM_BY_ENV.mainnet)
    expect(testnetAlpha.bridgeProgram).toBe(BRIDGE_PROGRAM_BY_ENV['testnet-alpha'])
  })

  it('rejects invalid remoteToken', () => {
    expect(() =>
      deriveWrappedMintPda({
        name: 'x', symbol: 'x', decimals: 9, remoteToken: 'not-an-address' as any, scalerExponent: 9, deployEnv: 'mainnet',
      }),
    ).toThrow(/invalid remoteToken/)
  })

  it('rejects empty name or symbol', () => {
    expect(() =>
      deriveWrappedMintPda({
        name: '', symbol: 'x', decimals: 9, remoteToken: AKITA, scalerExponent: 9, deployEnv: 'mainnet',
      }),
    ).toThrow(/name must be a non-empty string/)
    expect(() =>
      deriveWrappedMintPda({
        name: 'x', symbol: '', decimals: 9, remoteToken: AKITA, scalerExponent: 9, deployEnv: 'mainnet',
      }),
    ).toThrow(/symbol must be a non-empty string/)
  })

  it('rejects out-of-range decimals and scalerExponent', () => {
    expect(() =>
      deriveWrappedMintPda({
        name: 'x', symbol: 'x', decimals: 256, remoteToken: AKITA, scalerExponent: 9, deployEnv: 'mainnet',
      }),
    ).toThrow(/decimals out of range/)
    expect(() =>
      deriveWrappedMintPda({
        name: 'x', symbol: 'x', decimals: 9, remoteToken: AKITA, scalerExponent: 256, deployEnv: 'mainnet',
      }),
    ).toThrow(/scalerExponent out of range/)
  })
})

describe('solanaPubkeyToBytes32', () => {
  it('matches the mintBytes32 from deriveWrappedMintPda for AKITA v2', () => {
    const expected = solanaPubkeyToBytes32('9JWhbEAVpuHQdx1x5kSH62p6ZrWivqcBfARhvdLsLJdp')
    expect(expected).toBe('0x7b59f36c2fc48080f7489f4100731c8ddc8f53b25d8ded62b81931892ac53a33')
  })
})
