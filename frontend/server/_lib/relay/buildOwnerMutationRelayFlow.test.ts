import { describe, expect, it } from 'vitest'

import { selectOwnerMutationRelayUserCall } from './buildOwnerMutationRelayFlow.js'
import { RELAY_DEPOSITORY_BASE, RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR } from '../../../src/lib/wallet/cswOwnerAbi.js'

const ROUTER = '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f' as const

describe('selectOwnerMutationRelayUserCall', () => {
  const routerMulticallData =
    '0xcd6e13f7000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

  const depositoryUserCall = {
    to: RELAY_DEPOSITORY_BASE,
    data: `${RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR}${'0'.repeat(120)}` as `0x${string}`,
    value: '0x1129e6ffe3f8' as `0x${string}`,
  }

  it('prefers golden router multicall when deposit value is fully funded', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: routerMulticallData,
        value: '18871666861048',
      },
      builtUserCallFromPaymentDetails: depositoryUserCall,
    })

    expect(selected?.userCallSource).toBe('quote_tx')
    expect(selected?.userCall.to).toBe(ROUTER)
    expect(selected?.userCall.value).toBe('0x1129e6ffe3f8')
  })

  it('falls back to depository depositNative when router value is underfunded', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: routerMulticallData,
        value: '2880000000000',
      },
      builtUserCallFromPaymentDetails: depositoryUserCall,
    })

    expect(selected?.userCallSource).toBe('built_from_payment_details')
    expect(selected?.userCall.to.toLowerCase()).toBe(RELAY_DEPOSITORY_BASE.toLowerCase())
  })

  it('keeps router multicall when depository build is unavailable', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: routerMulticallData,
        value: '18871666861048',
      },
      builtUserCallFromPaymentDetails: null,
    })

    expect(selected?.userCallSource).toBe('quote_tx')
    expect(selected?.userCall.to).toBe(ROUTER)
  })
})
