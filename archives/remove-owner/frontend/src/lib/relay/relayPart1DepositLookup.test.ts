import { describe, expect, it, vi } from 'vitest'
import { encodeFunctionData } from 'viem'

import {
  decodeDepositoryDepositNativeOrderId,
  relayPart1StorageKey,
  RELAY_DEPOSITORY_NATIVE_DEPOSIT_LOG_TOPIC,
  readPersistedRelayPart1DepositTx,
  persistRelayPart1DepositTx,
} from '@/lib/relay/relayPart1DepositLookup'
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

  it('persists and reads part1 tx hints by order id', () => {
    const orderId = `0x${'cd'.repeat(32)}` as `0x${string}`
    const txHash = `0x${'ef'.repeat(32)}` as `0x${string}`
    const key = relayPart1StorageKey(orderId)
    expect(key).toContain('4626:relay_part1_tx:')

    const store = new Map<string, string>()
    const sessionStorageMock = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
    }
    vi.stubGlobal('window', { sessionStorage: sessionStorageMock })

    persistRelayPart1DepositTx({ orderId, txHash })
    expect(readPersistedRelayPart1DepositTx(orderId)).toBe(txHash)
    sessionStorageMock.removeItem(key)
    vi.unstubAllGlobals()
  })
})
