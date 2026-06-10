import { describe, expect, it } from 'vitest'
import { encodeAbiParameters, parseAbiParameters } from 'viem'

import {
  extractMigratedCoinAddressFromLog,
  parseMinimalProxyImplementation,
} from './migrationScan'

const MIGRATION_DATA_ABI = parseAbiParameters(
  '(address,address,uint24,int24,address),bytes32,(address,address,uint24,int24,address),bytes32',
)

describe('migrations helpers', () => {
  it('extracts migrated coin when log source and pool keys are consistent', () => {
    const coin = '0x1de553883334a880e7149597f3d67ffdf2e0fa85'
    const data = encodeAbiParameters(MIGRATION_DATA_ABI, [
      ['0x1111111111166b7fe7bd91427724b487980afc69', coin, 30_000, 200, '0xfff800b76768da8ab6aab527021e4a6a91219040'],
      '0xcf4efcb82f84ae2cd6542c959d4c50f2e304124d3797eb808324ab6d45d76ef4',
      ['0x1111111111166b7fe7bd91427724b487980afc69', coin, 30_000, 200, '0x5e5d19d22c85a4aef7c1fdf25fb22a5a38f71040'],
      '0x30ce7b1bccbca555d6e51fa6154ec739c74a1ece444cf5d0e4f6bdf6e5be2136',
    ])

    const extracted = extractMigratedCoinAddressFromLog({
      address: coin,
      data,
    })

    expect(extracted).toBe(coin.toLowerCase())
  })

  it('rejects logs whose emitter is not one of the pool currencies', () => {
    const coin = '0x1de553883334a880e7149597f3d67ffdf2e0fa85'
    const data = encodeAbiParameters(MIGRATION_DATA_ABI, [
      ['0x1111111111166b7fe7bd91427724b487980afc69', coin, 30_000, 200, '0xfff800b76768da8ab6aab527021e4a6a91219040'],
      '0xcf4efcb82f84ae2cd6542c959d4c50f2e304124d3797eb808324ab6d45d76ef4',
      ['0x1111111111166b7fe7bd91427724b487980afc69', coin, 30_000, 200, '0x5e5d19d22c85a4aef7c1fdf25fb22a5a38f71040'],
      '0x30ce7b1bccbca555d6e51fa6154ec739c74a1ece444cf5d0e4f6bdf6e5be2136',
    ])

    const extracted = extractMigratedCoinAddressFromLog({
      address: '0x3333333333333333333333333333333333333333',
      data,
    })

    expect(extracted).toBeNull()
  })

  it('rejects logs when old/new pool currency pairs diverge', () => {
    const coin = '0x1de553883334a880e7149597f3d67ffdf2e0fa85'
    const data = encodeAbiParameters(MIGRATION_DATA_ABI, [
      ['0x1111111111166b7fe7bd91427724b487980afc69', coin, 30_000, 200, '0xfff800b76768da8ab6aab527021e4a6a91219040'],
      '0xcf4efcb82f84ae2cd6542c959d4c50f2e304124d3797eb808324ab6d45d76ef4',
      ['0x1111111111166b7fe7bd91427724b487980afc69', '0x4444444444444444444444444444444444444444', 30_000, 200, '0x5e5d19d22c85a4aef7c1fdf25fb22a5a38f71040'],
      '0x30ce7b1bccbca555d6e51fa6154ec739c74a1ece444cf5d0e4f6bdf6e5be2136',
    ])

    const extracted = extractMigratedCoinAddressFromLog({
      address: coin,
      data,
    })

    expect(extracted).toBeNull()
  })

  it('parses EIP-1167 implementation addresses', () => {
    const bytecode =
      '0x363d3d373d3d3d363d7388cc4e08c7608723f3e44e17ac669fb43b6a83135af43d82803e903d91602b57fd5bf3'
    expect(parseMinimalProxyImplementation(bytecode)).toBe(
      '0x88cc4e08c7608723f3e44e17ac669fb43b6a8313',
    )
    expect(parseMinimalProxyImplementation('0x1234')).toBeNull()
  })
})
