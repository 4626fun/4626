import { describe, expect, it } from 'vitest'

import {
  deriveHasActivePendingAuctionStorageSlot,
  derivePendingAuctionTokenOwnerKey,
} from './ensurePendingAuctionGateClearOnFork.js'

describe('ensurePendingAuctionGateClearOnFork', () => {
  it('derives tokenOwnerKey like DeploymentBatcher._recordFinalizePhase2Effects', () => {
    const creatorToken = '0x1111111111111111111111111111111111111111' as const
    const owner = '0x2222222222222222222222222222222222222222' as const
    const key = derivePendingAuctionTokenOwnerKey({ creatorToken, owner })
    expect(key).toMatch(/^0x[a-f0-9]{64}$/)
    expect(key.toLowerCase()).not.toBe(creatorToken.toLowerCase())
  })

  it('derives stable storage slot for mapping slot 5', () => {
    const creatorToken = '0x1111111111111111111111111111111111111111' as const
    const owner = '0x2222222222222222222222222222222222222222' as const
    const tokenOwnerKey = derivePendingAuctionTokenOwnerKey({ creatorToken, owner })
    const slot = deriveHasActivePendingAuctionStorageSlot(tokenOwnerKey)
    expect(slot).toMatch(/^0x[a-f0-9]{64}$/)
    expect(deriveHasActivePendingAuctionStorageSlot(tokenOwnerKey)).toBe(slot)
  })
})
