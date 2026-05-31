import { afterEach, describe, expect, it } from 'vitest'

import {
  hasCanonicalCswRuntimeConfig,
  readCanonicalCswAddressEnv,
  readCanonicalCswPrivyWalletIdEnv,
  readCanonicalCswSkipEnforcementEnv,
  resolveServerAgentInboxAddress,
} from './canonicalCswEnv.js'

const ENV_KEYS = [
  'CANONICAL_CSW_ADDRESS',
  'CANONICAL_CSW_PRIVY_WALLET_ID',
  'XMTP_AGENT_CSW_ADDRESS',
  'XMTP_AGENT_PRIVY_WALLET_ID',
  'CANONICAL_CSW_SKIP_ENFORCEMENT',
  'XMTP_AGENT_CSW_SKIP_CANONICAL',
  'XMTP_AGENT_ADDRESS',
  'VITE_AGENT_XMTP_ADDRESS',
] as const

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
  (typeof ENV_KEYS)[number],
  string | undefined
>

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key]
    if (typeof value === 'string') process.env[key] = value
    else delete process.env[key]
  }
})

describe('canonicalCswEnv', () => {
  it('prefers CANONICAL_CSW_* over legacy XMTP_AGENT_CSW_*', () => {
    process.env.CANONICAL_CSW_ADDRESS = '0x1111111111111111111111111111111111111111'
    process.env.XMTP_AGENT_CSW_ADDRESS = '0x2222222222222222222222222222222222222222'
    expect(readCanonicalCswAddressEnv()).toBe('0x1111111111111111111111111111111111111111')
  })

  it('falls back to legacy XMTP_AGENT_CSW_* when CANONICAL_CSW_* is unset', () => {
    delete process.env.CANONICAL_CSW_ADDRESS
    process.env.XMTP_AGENT_CSW_ADDRESS = '0x3333333333333333333333333333333333333333'
    expect(readCanonicalCswAddressEnv()).toBe('0x3333333333333333333333333333333333333333')
  })

  it('detects full runtime config from canonical env names', () => {
    process.env.CANONICAL_CSW_ADDRESS = '0xab6d5c10b03300326cd7fab7267ae192842967b5'
    process.env.CANONICAL_CSW_PRIVY_WALLET_ID = 'wallet-abc'
    expect(hasCanonicalCswRuntimeConfig()).toBe(true)
    expect(readCanonicalCswPrivyWalletIdEnv()).toBe('wallet-abc')
  })

  it('reads skip enforcement from canonical or legacy flag', () => {
    delete process.env.CANONICAL_CSW_SKIP_ENFORCEMENT
    process.env.XMTP_AGENT_CSW_SKIP_CANONICAL = 'true'
    expect(readCanonicalCswSkipEnforcementEnv()).toBe(true)
  })

  it('resolveServerAgentInboxAddress prefers CANONICAL_CSW_ADDRESS env', () => {
    process.env.CANONICAL_CSW_ADDRESS = '0x1111111111111111111111111111111111111111'
    delete process.env.XMTP_AGENT_ADDRESS
    delete process.env.VITE_AGENT_XMTP_ADDRESS
    expect(resolveServerAgentInboxAddress()).toBe('0x1111111111111111111111111111111111111111')
  })

  it('resolveServerAgentInboxAddress falls back to policy constant', () => {
    for (const key of ENV_KEYS) delete process.env[key]
    expect(resolveServerAgentInboxAddress()).toBe('0xab6d5c10b03300326cd7fab7267ae192842967b5')
  })
})
