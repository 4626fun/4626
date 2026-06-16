import { describe, expect, it } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'

import { resolveProtocolAjnaKeeperAddress } from './protocolTreasurySafe.js'

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

  it('derives from fallback keeper private keys when public keys are unset', () => {
    const privateKey = '0x59c6995e998f97a5a0044966f0945388cf7c5d6d5b3b9f8b9b7f59b3f4c9b6d2'
    const expected = privateKeyToAccount(privateKey).address
    const resolved = resolveProtocolAjnaKeeperAddress({
      PROTOCOL_AUTOMATION_SAFE_OWNER_PK: privateKey,
    })
    expect(resolved).toBe(expected)
  })
})
