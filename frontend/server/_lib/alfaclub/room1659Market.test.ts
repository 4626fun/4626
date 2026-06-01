import { describe, expect, it, vi } from 'vitest'

import { ALFACLUB } from '../wallet/alfaclub.js'
import {
  resolveRoom1659FriendKeyAddress,
  resolveRoom1659HyperliquidPortfolioUser,
} from './room1659Market.js'

describe('room1659 market constants', () => {
  it('uses canonical FriendKey address by default', () => {
    vi.stubEnv('ROOM_1659_FRIENDKEY_TOKEN', '')
    expect(resolveRoom1659FriendKeyAddress()).toBe(ALFACLUB.friendKey)
  })

  it('uses configured FriendKey override when valid', () => {
    vi.stubEnv('ROOM_1659_FRIENDKEY_TOKEN', '0x1111111111111111111111111111111111111111')
    expect(resolveRoom1659FriendKeyAddress()).toBe('0x1111111111111111111111111111111111111111')
  })

  it('uses room 1659 Hyperliquid portfolio default by default', () => {
    vi.stubEnv('ROOM_1659_HYPERLIQUID_PORTFOLIO_USER', '')
    expect(resolveRoom1659HyperliquidPortfolioUser()).toBe(
      '0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2',
    )
  })

  it('uses configured Hyperliquid portfolio override when valid', () => {
    vi.stubEnv('ROOM_1659_HYPERLIQUID_PORTFOLIO_USER', '0x2222222222222222222222222222222222222222')
    expect(resolveRoom1659HyperliquidPortfolioUser()).toBe(
      '0x2222222222222222222222222222222222222222',
    )
  })
})
