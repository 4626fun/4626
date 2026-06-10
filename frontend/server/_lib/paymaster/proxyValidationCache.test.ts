import { getAddress, type Address, type Hex } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearProxyValidationCachesForTests,
  PAYMASTER_PROXY_VALIDATION_CACHE_MS,
  readSessionAllowlistCache,
  readSessionOwnershipCache,
  readSponsoredSwapValidationCache,
  sessionAllowlistCacheKey,
  sessionOwnershipCacheKey,
  writeSessionAllowlistCache,
  writeSessionOwnershipCache,
  writeSponsoredSwapValidationCache,
} from './proxyValidationCache.js'

const SENDER = getAddress('0xab6d5c10b03300326cd7fab7267ae192842967b5')
const SESSION = getAddress('0xcecA13F2686ed061c57620Ecdf67E1b8C0F285e9')
const CALL_DATA = '0x1234' as Hex

describe('proxyValidationCache', () => {
  beforeEach(() => {
    clearProxyValidationCachesForTests()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('caches sponsored swap validation by sender+callData', () => {
    writeSponsoredSwapValidationCache(SENDER, CALL_DATA, {
      mode: 'swap',
      expectedCreatorToken: SENDER,
    })
    const hit = readSponsoredSwapValidationCache(SENDER, CALL_DATA)
    expect(hit?.mode).toBe('swap')
    expect(hit?.expectedCreatorToken).toBe(SENDER)
    expect(readSponsoredSwapValidationCache(SENDER, '0xabcd' as Hex)).toBeNull()
  })

  it('does not cache non-swap modes', () => {
    writeSponsoredSwapValidationCache(SENDER, CALL_DATA, { mode: 'deploy_session_setup' })
    expect(readSponsoredSwapValidationCache(SENDER, CALL_DATA)).toBeNull()
  })

  it('expires swap validation after TTL', () => {
    writeSponsoredSwapValidationCache(SENDER, CALL_DATA, { mode: 'swap' })
    vi.advanceTimersByTime(PAYMASTER_PROXY_VALIDATION_CACHE_MS + 1)
    expect(readSponsoredSwapValidationCache(SENDER, CALL_DATA)).toBeNull()
  })

  it('caches session ownership and allowlist independently', () => {
    const ownershipKey = sessionOwnershipCacheKey({ sender: SENDER, sessionAddress: SESSION, initCode: null })
    writeSessionOwnershipCache(ownershipKey)
    expect(readSessionOwnershipCache(ownershipKey)).toBe(true)

    const allowlistKey = sessionAllowlistCacheKey(SESSION, SENDER as Address)
    writeSessionAllowlistCache(allowlistKey)
    expect(readSessionAllowlistCache(allowlistKey)).toBe(true)

    vi.advanceTimersByTime(PAYMASTER_PROXY_VALIDATION_CACHE_MS + 1)
    expect(readSessionOwnershipCache(ownershipKey)).toBe(false)
    expect(readSessionAllowlistCache(allowlistKey)).toBe(false)
  })
})
