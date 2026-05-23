import { describe, expect, it } from 'vitest'

import {
  decodeDepositoryDepositNativeOrderId,
  RELAY_DEPOSITORY_NATIVE_DEPOSIT_LOG_TOPIC,
} from '@/lib/relay/relayPart1DepositLookup'
import { encodeFunctionData } from 'viem'
import { RELAY_DEPOSITORY_ABI } from '@/lib/wallet/cswOwnerAbi'

describe('relayPart1DepositLookup', () => {
  it('decodes depositNative order id from calldata', () => {
    const orderId = `0x${'ab'.repeat(32)}` as `0x${string}`
    const data = encodeFunctionData({
      abi: RELAY_DEPOSITORY_ABI,
      functionName: 'depositNative',
      args: ['0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF', orderId],
    })
    const decoded = decodeDepositoryDepositNativeOrderId(data)
    expect(decoded?.orderId.toLowerCase()).toBe(orderId.toLowerCase())
    expect(decoded?.depositor.toLowerCase()).toBe('0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef')
  })

  it('pins live NativeDeposit log topic', () => {
    expect(RELAY_DEPOSITORY_NATIVE_DEPOSIT_LOG_TOPIC).toBe(
      '0x8032066556caf3967d8fec4ad22a2d9e1e9576556b2903a0fcd5b1fd201e3477',
    )
  })
})
