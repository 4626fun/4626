import { encodeFunctionData } from 'viem'
import { describe, expect, it } from 'vitest'

import { CSW_OWNER_MUTATION_ABI } from '@/lib/wallet/cswOwnerAbi'
import { buildSilentServerOwnerUserOp } from './silentServerOwnerUserOp'

const CSW = '0x1111111111111111111111111111111111111111'
const EMBEDDED = '0x2222222222222222222222222222222222222222'
const SERVER = '0x3333333333333333333333333333333333333333'
const ARBITRARY = '0x4444444444444444444444444444444444444444'

function addOwnerData(owner: `0x${string}`) {
  return encodeFunctionData({
    abi: CSW_OWNER_MUTATION_ABI,
    functionName: 'addOwnerAddress',
    args: [owner],
  })
}

describe('silent server-owner UserOp', () => {
  it('uses parent CSW as sender and target with embedded signer and expected server owner', () => {
    const result = buildSilentServerOwnerUserOp({
      parentCsw: CSW,
      embeddedEoa: EMBEDDED,
      expectedServerWallet: SERVER,
      txRequest: {
        chainId: 8453,
        to: CSW,
        data: addOwnerData(SERVER),
        value: '0x0',
      },
    })

    expect(result).toEqual({
      smartWallet: CSW,
      ownerAddress: EMBEDDED,
      calls: [{ to: CSW, data: addOwnerData(SERVER), value: 0n }],
    })
  })

  it('rejects an arbitrary server-owner target', () => {
    expect(() =>
      buildSilentServerOwnerUserOp({
        parentCsw: CSW,
        embeddedEoa: EMBEDDED,
        expectedServerWallet: SERVER,
        txRequest: {
          chainId: 8453,
          to: CSW,
          data: addOwnerData(ARBITRARY),
          value: '0x0',
        },
      }),
    ).toThrow(/active Privy embedded EOA/i)
  })

  it('rejects nonzero value and non-self-call targets', () => {
    expect(() =>
      buildSilentServerOwnerUserOp({
        parentCsw: CSW,
        embeddedEoa: EMBEDDED,
        expectedServerWallet: SERVER,
        txRequest: {
          chainId: 8453,
          to: CSW,
          data: addOwnerData(SERVER),
          value: '0x1' as '0x0',
        },
      }),
    ).toThrow(/zero native value/i)

    expect(() =>
      buildSilentServerOwnerUserOp({
        parentCsw: CSW,
        embeddedEoa: EMBEDDED,
        expectedServerWallet: SERVER,
        txRequest: {
          chainId: 8453,
          to: ARBITRARY,
          data: addOwnerData(SERVER),
          value: '0x0',
        },
      }),
    ).toThrow(/canonical CSW/i)
  })
})
