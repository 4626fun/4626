import { describe, expect, it } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'

import {
  resolveCharmAutomationAuthorization,
  resolveProtocolAjnaKeeperAddress,
} from './protocolTreasurySafe.js'

describe('resolveProtocolAjnaKeeperAddress', () => {
  it('prefers explicit PROTOCOL_AJNA_KEEPER', () => {
    const resolved = resolveProtocolAjnaKeeperAddress({
      PROTOCOL_AJNA_KEEPER: '0x1111111111111111111111111111111111111111',
      '4626_KEEPER_AUTOMATION_PUBLIC_KEY': '0x2222222222222222222222222222222222222222',
    })
    expect(resolved).toBe('0x1111111111111111111111111111111111111111')
  })

  it('falls back to configured 4626 keeper public key', () => {
    const resolved = resolveProtocolAjnaKeeperAddress({
      '4626_KEEPER_AUTOMATION_PUBLIC_KEY': '0x2222222222222222222222222222222222222222',
    })
    expect(resolved).toBe('0x2222222222222222222222222222222222222222')
  })

  it('derives from automation private keys when public keys are unset', () => {
    const privateKey = '0x59c6995e998f97a5a0044966f0945388cf7c5d6d5b3b9f8b9b7f59b3f4c9b6d2'
    const expected = privateKeyToAccount(privateKey).address
    const resolved = resolveProtocolAjnaKeeperAddress({
      PROTOCOL_AUTOMATION_SAFE_OWNER_PK: privateKey,
    })
    expect(resolved).toBe(expected)
  })

  it('does not derive Ajna keeper from PRIVATE_KEY alone', () => {
    const adminPrivateKey = '0x59c6995e998f97a5a0044966f0945389cf7c5d6d5b3b9f8b9b7f59b3f4c9b6d2'
    const resolved = resolveProtocolAjnaKeeperAddress({
      PRIVATE_KEY: adminPrivateKey,
    })
    expect(resolved).toBeNull()
  })
})

describe('resolveCharmAutomationAuthorization', () => {
  it('defers a legacy delegate CSW to the executor owner check', () => {
    expect(resolveCharmAutomationAuthorization({
      managerAddress: null,
      delegateAddress: '0x3333333333333333333333333333333333333333',
      charmKeeper: '0x4444444444444444444444444444444444444444',
      charmOwner: '0x5555555555555555555555555555555555555555',
      keeperAddress: '0x2222222222222222222222222222222222222222',
    })).toEqual({
      authorized: true,
      lane: 'delegate_csw_owner_check_required',
    })
  })
})
