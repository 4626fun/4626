import { describe, expect, it } from 'vitest'
import { encodeFunctionData } from 'viem'

import {
  selectOwnerMutationRelayUserCall,
  validateSelectedOwnerMutationRelayUserCall,
} from './buildOwnerMutationRelayFlow.js'
import {
  RELAY_DEPOSITORY_ABI,
  RELAY_DEPOSITORY_BASE,
  RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR,
} from '../../../src/lib/wallet/cswOwnerAbi.js'

const ROUTER = '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f' as const

describe('selectOwnerMutationRelayUserCall', () => {
  const routerMulticallData =
    '0xcd6e13f7000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

  const depositoryUserCall = {
    to: RELAY_DEPOSITORY_BASE,
    data: `${RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR}${'0'.repeat(120)}` as `0x${string}`,
    value: '0x1129e6ffe3f8' as `0x${string}`,
  }

  it('prefers Depository depositNative for CSW self-auth (golden Part 1 shape)', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: routerMulticallData,
        value: '18871666861048',
      },
      builtUserCallFromPaymentDetails: depositoryUserCall,
      preferDepositoryDepositNative: true,
    })

    expect(selected?.isDepositoryDepositNative).toBe(true)
    expect(selected?.userCall.to).toBe(RELAY_DEPOSITORY_BASE)
    expect(selected?.userCall.data.slice(0, 10)).toBe(RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR)
    expect(selected?.userCall.value).toBe('0x1129e6ffe3f8')
  })

  it('prefers router multicall for external EOA funders when fully funded', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: routerMulticallData,
        value: '18871666861048',
      },
      builtUserCallFromPaymentDetails: depositoryUserCall,
      preferDepositoryDepositNative: false,
    })

    expect(selected?.isDepositoryDepositNative).toBe(false)
    expect(selected?.userCall.to).toBe(ROUTER)
    expect(selected?.userCall.value).toBe('0x1129e6ffe3f8')
  })

  it('rejects underfunded router multicall for external EOA funders', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: routerMulticallData,
        value: '2880000000000',
      },
      builtUserCallFromPaymentDetails: depositoryUserCall,
      preferDepositoryDepositNative: false,
    })

    expect(selected).toBeNull()
  })
})

describe('validateSelectedOwnerMutationRelayUserCall', () => {
  const routerMulticallData =
    '0xcd6e13f7000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

  const orderId =
    '0xb00755d1810713e0485fa287c8f5d326c5378de6149464662d186166c23b56f3' as const

  it('rejects underfunded deposits that match the broken 0xdfec2946 pattern', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: `0xcd6e13f7${'0'.repeat(120)}${orderId.slice(2)}` as `0x${string}`,
        value: '2880000000000',
      },
      builtUserCallFromPaymentDetails: null,
      preferDepositoryDepositNative: false,
    })
    expect(selected).not.toBeNull()
    expect(
      validateSelectedOwnerMutationRelayUserCall({
        requestBoundDepositId: orderId,
        selected: selected!,
      }),
    ).toMatch(/below minimum/)
  })

  it('accepts golden-scale depository depositNative with bound order id and depositor', () => {
    const depositor = '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF' as const
    const depositData = encodeFunctionData({
      abi: RELAY_DEPOSITORY_ABI,
      functionName: 'depositNative',
      args: [depositor, orderId],
    })
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: routerMulticallData,
        value: '18871666861048',
      },
      builtUserCallFromPaymentDetails: {
        to: RELAY_DEPOSITORY_BASE,
        data: depositData,
        value: '0x1129e6ffe3f8' as `0x${string}`,
      },
      preferDepositoryDepositNative: true,
    })
    expect(selected).not.toBeNull()
    expect(
      validateSelectedOwnerMutationRelayUserCall({
        requestBoundDepositId: orderId,
        selected: selected!,
        expectedDepositor: depositor,
      }),
    ).toBeNull()
  })

  it('rejects depository depositNative when depositor is not the funding CSW', () => {
    const wrongDepositor = '0x0000000000000000000000000000000000000001' as const
    const fundingCsw = '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF' as const
    const depositData = encodeFunctionData({
      abi: RELAY_DEPOSITORY_ABI,
      functionName: 'depositNative',
      args: [wrongDepositor, orderId],
    })
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: routerMulticallData,
        value: '18871666861048',
      },
      builtUserCallFromPaymentDetails: {
        to: RELAY_DEPOSITORY_BASE,
        data: depositData,
        value: '0x1129e6ffe3f8' as `0x${string}`,
      },
      preferDepositoryDepositNative: true,
    })
    expect(selected).not.toBeNull()
    expect(
      validateSelectedOwnerMutationRelayUserCall({
        requestBoundDepositId: orderId,
        selected: selected!,
        expectedDepositor: fundingCsw,
      }),
    ).toMatch(/depositor must be funding CSW/)
  })

  it('accepts golden-scale router multicall deposits with bound order id', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: `0xcd6e13f7${'0'.repeat(120)}${orderId.slice(2)}` as `0x${string}`,
        value: '18871666861048',
      },
      builtUserCallFromPaymentDetails: null,
      preferDepositoryDepositNative: false,
    })
    expect(selected).not.toBeNull()
    expect(
      validateSelectedOwnerMutationRelayUserCall({
        requestBoundDepositId: orderId,
        selected: selected!,
      }),
    ).toBeNull()
  })

  it('rejects sub-golden deposits that clear the broken-tx floor but miss Part 2 fill', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: `0xcd6e13f7${'0'.repeat(120)}${orderId.slice(2)}` as `0x${string}`,
        value: '18828082080000',
      },
      builtUserCallFromPaymentDetails: null,
      preferDepositoryDepositNative: false,
    })
    expect(selected).not.toBeNull()
    expect(
      validateSelectedOwnerMutationRelayUserCall({
        requestBoundDepositId: orderId,
        selected: selected!,
      }),
    ).toMatch(/below golden Part 1 minimum/)
  })
})
