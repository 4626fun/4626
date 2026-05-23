import { describe, expect, it } from 'vitest'

import { selectOwnerMutationRelayUserCall } from './buildOwnerMutationRelayFlow.js'
import { RELAY_DEPOSITORY_BASE, RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR } from '../../../src/lib/wallet/cswOwnerAbi.js'

const ROUTER = '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f' as const

describe('selectOwnerMutationRelayUserCall', () => {
  const depositoryUserCall = {
    to: RELAY_DEPOSITORY_BASE,
    data: `${RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR}${'0'.repeat(120)}` as `0x${string}`,
    value: '0x1129e6ffe3f8' as `0x${string}`,
  }

  it('prefers depository depositNative when paymentDetails exceed echoed router value', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: '0xcd6e13f7000000000000000000000000000000000000000000000000000000000000000',
        value: '2880000000000',
      },
      builtUserCallFromPaymentDetails: depositoryUserCall,
    })

    expect(selected?.userCallSource).toBe('built_from_payment_details')
    expect(selected?.userCall.to.toLowerCase()).toBe(RELAY_DEPOSITORY_BASE.toLowerCase())
    expect(selected?.userCall.value).toBe('0x1129e6ffe3f8')
  })

  it('keeps router multicall when depository build is unavailable', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: '0xcd6e13f7000000000000000000000000000000000000000000000000000000000000000',
        value: '2880000000000',
      },
      builtUserCallFromPaymentDetails: null,
    })

    expect(selected?.userCallSource).toBe('quote_tx')
    expect(selected?.userCall.to).toBe(ROUTER)
  })
})
