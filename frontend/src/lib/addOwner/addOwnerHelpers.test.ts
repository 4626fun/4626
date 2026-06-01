import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import {
  sanitizeAddOwnerRelayPreview,
  type AddOwnerPreview,
} from '@/lib/addOwner/addOwnerHelpers'
import {
  RELAY_DEPOSITORY_BASE,
  RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR,
  RELAY_MULTICALL_SELECTOR,
} from '@/lib/wallet/cswOwnerAbi'
import { CANONICAL_CSW_ADDRESS } from '@/wallet/canonicalWalletPolicy'

const CSW = getAddress(CANONICAL_CSW_ADDRESS)

const BASE_PREVIEW: AddOwnerPreview = {
  txRequest: {
    chainId: 8453,
    to: CSW,
    data: '0x0f0f3f24000000000000000000000000b2aad65a5402714bf428a66731ae62ba5c45cac0',
    value: '0x0',
  },
  calls: [],
  relay: null,
  preflight: {
    ownerToAdd: '0xB2aaD65A5402714bf428a66731ae62BA5c45CAC0',
    alreadyOwner: false,
    simulation: { ok: true, error: null },
    relayQuoteError: null,
    relayDepositSimulation: null,
    relayQuoteDiagnostics: null,
  },
}

describe('sanitizeAddOwnerRelayPreview', () => {
  it('passes through native depository depositNative previews', () => {
    const preview: AddOwnerPreview = {
      ...BASE_PREVIEW,
      relay: {
        requestId: '0x1234',
        orderId: '0x1234',
        paymentDetails: {
          chainId: 8453,
          depository: RELAY_DEPOSITORY_BASE,
          currency: '0x0000000000000000000000000000000000000000',
          amount: '18871666861048',
        },
        userCall: {
          to: RELAY_DEPOSITORY_BASE,
          data: `${RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR}${'0'.repeat(120)}`,
          value: '0x1129e6ffe3f8',
        },
        feeUsd: '0.0003',
      },
    }
    expect(sanitizeAddOwnerRelayPreview(preview)).toBe(preview)
  })

  it('strips router multicall relay quotes and surfaces a blocker', () => {
    const preview: AddOwnerPreview = {
      ...BASE_PREVIEW,
      relay: {
        requestId: '0x1234',
        orderId: '0x1234',
        paymentDetails: null,
        userCall: {
          to: '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f',
          data: `${RELAY_MULTICALL_SELECTOR}${'0'.repeat(120)}`,
          value: '0x1129e6ffe3f8',
        },
        feeUsd: null,
      },
    }
    const sanitized = sanitizeAddOwnerRelayPreview(preview)
    expect(sanitized.relay).toBeNull()
    expect(sanitized.calls).toEqual([])
    expect(sanitized.preflight.relayQuoteError).toMatch(/Depository\.depositNative/)
  })
})
