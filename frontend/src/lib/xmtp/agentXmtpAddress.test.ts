import { describe, expect, it, vi } from 'vitest'

import { PROTOCOL_CSW_ADDRESS } from '@/wallet/canonicalWalletPolicy'

import { resolveClientAgentXmtpAddress } from './agentXmtpAddress'

describe('resolveClientAgentXmtpAddress', () => {
  it('defaults to PROTOCOL_CSW_ADDRESS when overrides are unset', () => {
    vi.stubEnv('VITE_PROTOCOL_CSW_ADDRESS', '')
    vi.stubEnv('VITE_CANONICAL_CSW_ADDRESS', '')
    expect(resolveClientAgentXmtpAddress()).toBe(PROTOCOL_CSW_ADDRESS)
  })

  it('honors VITE_PROTOCOL_CSW_ADDRESS when set to a valid address', () => {
    vi.stubEnv('VITE_PROTOCOL_CSW_ADDRESS', '0x1111111111111111111111111111111111111111')
    expect(resolveClientAgentXmtpAddress()).toBe('0x1111111111111111111111111111111111111111')
  })

  it('falls back to VITE_CANONICAL_CSW_ADDRESS when protocol override is unset', () => {
    vi.stubEnv('VITE_PROTOCOL_CSW_ADDRESS', '')
    vi.stubEnv('VITE_CANONICAL_CSW_ADDRESS', '0x2222222222222222222222222222222222222222')
    expect(resolveClientAgentXmtpAddress()).toBe('0x2222222222222222222222222222222222222222')
  })

  it('ignores invalid VITE_PROTOCOL_CSW_ADDRESS override', () => {
    vi.stubEnv('VITE_PROTOCOL_CSW_ADDRESS', 'not-an-address')
    vi.stubEnv('VITE_CANONICAL_CSW_ADDRESS', '')
    expect(resolveClientAgentXmtpAddress()).toBe(PROTOCOL_CSW_ADDRESS)
  })
})
