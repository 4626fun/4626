import { describe, expect, it } from 'vitest'

import {
  buildWalletSendCallsPayload,
  chainIdToHex,
  WALLET_SEND_CALLS_VERSION,
} from './walletSendCallsPayload.js'

const CSW = '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF' as const

describe('buildWalletSendCallsPayload', () => {
  it('uses wallet_sendCalls v2.0.0 with from and chainId', () => {
    const payload = buildWalletSendCallsPayload({
      from: CSW,
      chainId: 8453,
      calls: [
        {
          to: CSW,
          data: '0xabcdef',
          value: 0n,
        },
      ],
    })

    expect(payload.version).toBe(WALLET_SEND_CALLS_VERSION)
    expect(payload.from).toBe(CSW)
    expect(payload.chainId).toBe('0x2105')
    expect(payload.atomicRequired).toBe(true)
    expect(payload.calls).toEqual([
      {
        to: CSW,
        data: '0xabcdef',
        value: '0x0',
      },
    ])
  })

  it('hex-encodes bigint call values', () => {
    const payload = buildWalletSendCallsPayload({
      from: CSW,
      chainId: 8453,
      atomicRequired: false,
      calls: [
        {
          to: CSW,
          data: '0x',
          value: 18_871_666_861_048n,
        },
      ],
    })

    expect(payload.atomicRequired).toBe(false)
    expect(payload.calls[0]?.value).toBe('0x1129e6ffe3f8')
  })

  it('supports addOwnerAddress self-call shape', () => {
    const addOwnerData =
      '0x0f0f3f24000000000000000000000000b2aad65a5402714bf428a66731ae62ba5c45cac0' as const
    const payload = buildWalletSendCallsPayload({
      from: CSW,
      chainId: 8453,
      calls: [{ to: CSW, data: addOwnerData, value: '0x0' }],
    })

    expect(payload.calls[0]?.to).toBe(CSW)
    expect(payload.calls[0]?.data).toBe(addOwnerData)
    expect(payload.from).toBe(CSW)
  })

  it('rejects empty calls', () => {
    expect(() =>
      buildWalletSendCallsPayload({
        from: CSW,
        chainId: 8453,
        calls: [],
      }),
    ).toThrow(/at least one call/)
  })
})

describe('chainIdToHex', () => {
  it('encodes Base mainnet', () => {
    expect(chainIdToHex(8453)).toBe('0x2105')
  })
})
