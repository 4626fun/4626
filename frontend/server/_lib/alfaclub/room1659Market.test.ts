import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import { ALFACLUB } from '../wallet/alfaclub.js'
import {
  resolveRoom1659FriendKeyAddress,
  resolveRoom1659HyperliquidUserForSnapshot,
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

describe('room1659 market auth boundary', () => {
  it('does not import chatBridge or chatTokenStore directly', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const source = readFileSync(resolve(here, 'room1659Market.ts'), 'utf8')
    expect(source).not.toContain("from './chatBridge.js'")
    expect(source).not.toContain("from './chatTokenStore.js'")
  })
})

describe('room1659 Hyperliquid user selection', () => {
  it('does not depend on sender wallet for room 1659 snapshots', () => {
    vi.stubEnv('ROOM_1659_HYPERLIQUID_PORTFOLIO_USER', '')
    const expected = '0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2'

    expect(resolveRoom1659HyperliquidUserForSnapshot('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(
      expected,
    )
    expect(resolveRoom1659HyperliquidUserForSnapshot('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).toBe(
      expected,
    )
  })

  it('uses configured room 1659 portfolio wallet for every sender', () => {
    vi.stubEnv('ROOM_1659_HYPERLIQUID_PORTFOLIO_USER', '0x3333333333333333333333333333333333333333')
    const expected = '0x3333333333333333333333333333333333333333'

    expect(resolveRoom1659HyperliquidUserForSnapshot('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(
      expected,
    )
    expect(resolveRoom1659HyperliquidUserForSnapshot('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).toBe(
      expected,
    )
  })
})
