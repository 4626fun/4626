import { describe, expect, it } from 'vitest'
import { decodeAbiParameters, getAddress, parseAbiParameters, type Address } from 'viem'

import { encodeCreatorPayoutRouterConstructorArgs } from './payoutRouterInitCode'

const addresses = Array.from({ length: 9 }, (_, index) =>
  getAddress(`0x${String(index + 1).padStart(40, '0')}`),
) as [
  Address,
  Address,
  Address,
  Address,
  Address,
  Address,
  Address,
  Address,
  Address,
]

describe('CreatorPayoutRouter constructor encoding', () => {
  it('encodes all nine constructor addresses in contract order', () => {
    const encoded = encodeCreatorPayoutRouterConstructorArgs({
      creatorToken: addresses[0],
      vault: addresses[1],
      burnStream: addresses[2],
      shareOFT: addresses[3],
      wrapper: addresses[4],
      owner: addresses[5],
      swapRouter: addresses[6],
      weth: addresses[7],
      protocolRewards: addresses[8],
    })

    expect((encoded.length - 2) / 2).toBe(9 * 32)
    expect(
      decodeAbiParameters(
        parseAbiParameters(
          'address,address,address,address,address,address,address,address,address',
        ),
        encoded,
      ),
    ).toEqual(addresses)
  })
})
