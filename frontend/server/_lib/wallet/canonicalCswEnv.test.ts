import { afterEach, describe, expect, it } from 'vitest'

import {
  hasCanonicalCswRuntimeConfig,
  hasProtocolCswRuntimeConfig,
  listRetiredCanonicalCswEnvKeys,
  readCanonicalCswAddressEnv,
  readCanonicalCswPrivyWalletIdEnv,
  readCanonicalCswSkipEnforcementEnv,
  readProtocolCswAddressEnv,
  readProtocolCswOwnerIndexEnv,
  readProtocolCswPrivyWalletIdEnv,
  resolveServerAgentCswAddress,
  resolveServerAgentInboxAddress,
  RETIRED_CANONICAL_CSW_ENV_KEYS,
} from './canonicalCswEnv.js'

const ENV_KEYS = [
  'CANONICAL_CSW_ADDRESS',
  'CANONICAL_CSW_PRIVY_WALLET_ID',
  'CANONICAL_CSW_SKIP_ENFORCEMENT',
  'PROTOCOL_CSW_ADDRESS',
  'PROTOCOL_CSW_OWNER_INDEX',
  'PROTOCOL_CSW_PRIVY_WALLET_ID',
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
  it('reads CANONICAL_CSW_ADDRESS when set', () => {
    process.env.CANONICAL_CSW_ADDRESS = '0x1111111111111111111111111111111111111111'
    expect(readCanonicalCswAddressEnv()).toBe('0x1111111111111111111111111111111111111111')
  })

  it('reads PROTOCOL_CSW_ADDRESS when set', () => {
    process.env.PROTOCOL_CSW_ADDRESS = '0x793ca28123cba3ca3c20b9c6c67f37510c89c145'
    expect(readProtocolCswAddressEnv()).toBe('0x793ca28123cba3ca3c20b9c6c67f37510c89c145')
  })

  it('falls back protocol privy wallet id to canonical env', () => {
    delete process.env.PROTOCOL_CSW_PRIVY_WALLET_ID
    process.env.CANONICAL_CSW_PRIVY_WALLET_ID = 'wallet-abc'
    expect(readProtocolCswPrivyWalletIdEnv()).toBe('wallet-abc')
  })

  it('detects full runtime config from canonical env names', () => {
    process.env.CANONICAL_CSW_ADDRESS = '0xab6d5c10b03300326cd7fab7267ae192842967b5'
    process.env.CANONICAL_CSW_PRIVY_WALLET_ID = 'wallet-abc'
    expect(hasCanonicalCswRuntimeConfig()).toBe(true)
    expect(readCanonicalCswPrivyWalletIdEnv()).toBe('wallet-abc')
  })

  it('detects protocol runtime config from privy wallet env', () => {
    process.env.CANONICAL_CSW_PRIVY_WALLET_ID = 'wallet-abc'
    expect(hasProtocolCswRuntimeConfig()).toBe(true)
  })

  it('reads skip enforcement flag', () => {
    process.env.CANONICAL_CSW_SKIP_ENFORCEMENT = 'true'
    expect(readCanonicalCswSkipEnforcementEnv()).toBe(true)
  })

  it('resolveServerAgentCswAddress prefers PROTOCOL_CSW_ADDRESS env', () => {
    process.env.PROTOCOL_CSW_ADDRESS = '0x793ca28123cba3ca3c20b9c6c67f37510c89c145'
    expect(resolveServerAgentCswAddress()).toBe('0x793ca28123cba3ca3c20b9c6c67f37510c89c145')
    expect(resolveServerAgentInboxAddress()).toBe('0x793ca28123cba3ca3c20b9c6c67f37510c89c145')
  })

  it('resolveServerAgentCswAddress falls back to policy constant', () => {
    for (const key of ENV_KEYS) delete process.env[key]
    expect(resolveServerAgentCswAddress()).toBe('0x793ca28123cba3ca3c20b9c6c67f37510c89c145')
  })

  it('reads protocol owner index env', () => {
    process.env.PROTOCOL_CSW_OWNER_INDEX = '2'
    expect(readProtocolCswOwnerIndexEnv()).toBe('2')
  })

  it('lists retired env keys when still set in the environment', () => {
    for (const key of RETIRED_CANONICAL_CSW_ENV_KEYS) delete process.env[key]
    process.env.XMTP_AGENT_CSW_ADDRESS = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
    expect(listRetiredCanonicalCswEnvKeys()).toEqual(['XMTP_AGENT_CSW_ADDRESS'])
    delete process.env.XMTP_AGENT_CSW_ADDRESS
    expect(listRetiredCanonicalCswEnvKeys()).toEqual([])
  })
})
