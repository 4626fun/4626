import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import { CANONICAL_CSW_ADDRESS } from '@/wallet/canonicalWalletPolicy'
import {
  buildDeployVaultFromCoinPath,
  formatZoraPlatformReferrerLabel,
  getZoraPlatformReferrerAddress,
} from './referrals'

describe('zora referrals', () => {
  it('defaults platform referrer to the operator canonical CSW', () => {
    expect(getZoraPlatformReferrerAddress()).toBe(getAddress(CANONICAL_CSW_ADDRESS))
  })

  it('formats a short platform referrer label', () => {
    const address = getZoraPlatformReferrerAddress()
    expect(formatZoraPlatformReferrerLabel(address)).toBe(
      `${address.slice(0, 6)}…${address.slice(-4)}`,
    )
  })

  it('builds a vault handoff path that DeployVault can seed from', () => {
    const coin = '0xab6d5c10b03300326cd7fab7267ae192842967b5'
    expect(buildDeployVaultFromCoinPath(coin)).toBe(
      `/deploy/vault?creatorToken=${getAddress(coin)}&from=coin`,
    )
  })

  it('rejects invalid coin addresses for vault handoff', () => {
    expect(() => buildDeployVaultFromCoinPath('not-an-address')).toThrow(/valid coin address/i)
  })
})
