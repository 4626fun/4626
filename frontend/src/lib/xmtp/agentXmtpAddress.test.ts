import { describe, expect, it, vi } from 'vitest'

import { CANONICAL_CSW_ADDRESS } from '@/wallet/canonicalWalletPolicy'

import { resolveClientAgentXmtpAddress } from './agentXmtpAddress'

describe('resolveClientAgentXmtpAddress', () => {
  it('defaults to CANONICAL_CSW_ADDRESS when VITE_CANONICAL_CSW_ADDRESS is unset', () => {
    vi.stubEnv('VITE_CANONICAL_CSW_ADDRESS', '')
    expect(resolveClientAgentXmtpAddress()).toBe(CANONICAL_CSW_ADDRESS)
  })

  it('honors VITE_CANONICAL_CSW_ADDRESS when set to a valid address', () => {
    vi.stubEnv('VITE_CANONICAL_CSW_ADDRESS', '0x1111111111111111111111111111111111111111')
    expect(resolveClientAgentXmtpAddress()).toBe('0x1111111111111111111111111111111111111111')
  })

  it('ignores invalid VITE_CANONICAL_CSW_ADDRESS override', () => {
    vi.stubEnv('VITE_CANONICAL_CSW_ADDRESS', 'not-an-address')
    expect(resolveClientAgentXmtpAddress()).toBe(CANONICAL_CSW_ADDRESS)
  })
})
