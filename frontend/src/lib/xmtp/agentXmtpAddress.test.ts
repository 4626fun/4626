import { afterEach, describe, expect, it, vi } from 'vitest'

import { CANONICAL_CSW_ADDRESS } from '@/wallet/canonicalWalletPolicy'

import { resolveClientAgentXmtpAddress } from './agentXmtpAddress'

describe('resolveClientAgentXmtpAddress', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to CANONICAL_CSW_ADDRESS when VITE_AGENT_XMTP_ADDRESS is unset', () => {
    vi.stubEnv('VITE_AGENT_XMTP_ADDRESS', '')
    expect(resolveClientAgentXmtpAddress()).toBe(CANONICAL_CSW_ADDRESS)
  })

  it('honors VITE_AGENT_XMTP_ADDRESS when set to a valid address', () => {
    vi.stubEnv('VITE_AGENT_XMTP_ADDRESS', '0x1111111111111111111111111111111111111111')
    expect(resolveClientAgentXmtpAddress()).toBe('0x1111111111111111111111111111111111111111')
  })

  it('falls back to policy constant for invalid env override', () => {
    vi.stubEnv('VITE_AGENT_XMTP_ADDRESS', 'not-an-address')
    expect(resolveClientAgentXmtpAddress()).toBe(CANONICAL_CSW_ADDRESS)
  })
})
