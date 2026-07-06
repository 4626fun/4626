import { describe, expect, it } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'

import {
  CANONICAL_KEEPER_AUTOMATION_EOA,
  isCanonicalKeeperAutomationEoa,
} from './keeperAutomationPolicy.js'
import { resolveProtocolAjnaKeeperAddress } from './protocolTreasurySafe.js'

describe('keeperAutomationPolicy', () => {
  it('pins the live AKITA keeper EOA', () => {
    expect(isCanonicalKeeperAutomationEoa(CANONICAL_KEEPER_AUTOMATION_EOA)).toBe(true)
    expect(isCanonicalKeeperAutomationEoa('0xed401e824df0F3de05Da00C939e81Df60c68a0Cd')).toBe(false)
  })
})

describe('resolveProtocolAjnaKeeperAddress — consolidated KPR lane', () => {
  it('derives Ajna keeper from KPR_PRIVATE_KEY when pins are unset', () => {
    const privateKey = '0x59c6995e998f97a5a0044966f0945389cf7c5d6d5b3b9f8b9b7f59b3f4c9b6d2'
    const expected = privateKeyToAccount(privateKey).address
    const resolved = resolveProtocolAjnaKeeperAddress({ KPR_PRIVATE_KEY: privateKey })
    expect(resolved).toBe(expected)
  })

  it('rejects mismatched legacy automation public key when PROTOCOL_AJNA_KEEPER is canonical', () => {
    const resolved = resolveProtocolAjnaKeeperAddress({
      PROTOCOL_AJNA_KEEPER: CANONICAL_KEEPER_AUTOMATION_EOA,
      '4626_KEEPER_AUTOMATION_PUBLIC_KEY': '0xed401e824df0F3de05Da00C939e81Df60c68a0Cd',
    })
    expect(resolved?.toLowerCase()).toBe(CANONICAL_KEEPER_AUTOMATION_EOA)
  })
})
