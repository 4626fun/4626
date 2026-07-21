import { describe, expect, it } from 'vitest'

import { sameSwapAsset, swapAssetId } from './swapAssetIdentity'

describe('swap asset identity', () => {
  const akita = { kind: 'erc20' as const, chainId: 8453, address: '0x5B674196812451b7CeC024fE9d22D2c0B172Fa75' as const }
  const key1659 = { kind: 'erc1155-key' as const, chainId: 8453 as const, contractAddress: '0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F' as const, tokenId: 1659n }

  it('keeps the creator coin and FriendKey distinct even when their presentation overlaps', () => {
    expect(swapAssetId(akita)).toBe('erc20:8453:0x5b674196812451b7cec024fe9d22d2c0b172fa75')
    expect(swapAssetId(key1659)).toBe('erc1155-key:8453:0xaf0bf8593dc6ca973df2132731b0f9b5f974fa9f:1659')
    expect(sameSwapAsset(akita, key1659)).toBe(false)
  })
})
