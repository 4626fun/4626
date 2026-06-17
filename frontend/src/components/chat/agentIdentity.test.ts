import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CANONICAL_CSW_ADDRESS, CANONICAL_CSW_ALLOWED_OWNER_EOAS } from '@/wallet/canonicalWalletPolicy'

/**
 * Stubs the three env vars `agentIdentity.ts` reads at module load so each
 * dynamic import resolves against known defaults instead of ambient env.
 * Tests that intentionally override `VITE_CANONICAL_CSW_ADDRESS` should call
 * this first, then re-stub that one key.
 */
function stubDefaultAgentIdentityEnv() {
  vi.stubEnv('VITE_CANONICAL_CSW_ADDRESS', '')
  vi.stubEnv('VITE_AGENT_DISPLAY_NAME', '')
  vi.stubEnv('VITE_AGENT_AVATAR_URL', '')
}

describe('getAgentIdentity', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('returns the agent identity for the canonical CSW inbox address', async () => {
    stubDefaultAgentIdentityEnv()
    const { getAgentIdentity } = await import('./agentIdentity')

    const result = getAgentIdentity(CANONICAL_CSW_ADDRESS)

    expect(result).not.toBeNull()
    expect(result?.name).toBe('akita')
    expect(result?.avatar).toBe('/base/base-square-blue.svg')
  })

  it('matches the canonical CSW regardless of casing', async () => {
    stubDefaultAgentIdentityEnv()
    const { getAgentIdentity } = await import('./agentIdentity')

    // Uppercase / checksummed canonical CSW must still resolve.
    const uppercased = CANONICAL_CSW_ADDRESS.toUpperCase()
    const result = getAgentIdentity(uppercased)

    expect(result).not.toBeNull()
    expect(result?.name).toBe('akita')
  })

  it('returns null for the Privy embedded EOA owner (delegated signer, not identity)', async () => {
    stubDefaultAgentIdentityEnv()
    const { getAgentIdentity } = await import('./agentIdentity')

    const privyEmbeddedEoa = CANONICAL_CSW_ALLOWED_OWNER_EOAS[3]

    expect(getAgentIdentity(privyEmbeddedEoa)).toBeNull()
  })

  it('returns null for every delegated owner EOA', async () => {
    stubDefaultAgentIdentityEnv()
    const { getAgentIdentity } = await import('./agentIdentity')

    for (const ownerEoa of CANONICAL_CSW_ALLOWED_OWNER_EOAS) {
      expect(getAgentIdentity(ownerEoa)).toBeNull()
    }
  })

  it('returns null for null, undefined, and empty string', async () => {
    stubDefaultAgentIdentityEnv()
    const { getAgentIdentity } = await import('./agentIdentity')

    expect(getAgentIdentity(null)).toBeNull()
    expect(getAgentIdentity(undefined)).toBeNull()
    expect(getAgentIdentity('')).toBeNull()
  })

  it('honors VITE_CANONICAL_CSW_ADDRESS override at module load time', async () => {
    vi.stubEnv('VITE_CANONICAL_CSW_ADDRESS', '0x1111111111111111111111111111111111111111')
    vi.stubEnv('VITE_AGENT_DISPLAY_NAME', '')
    vi.stubEnv('VITE_AGENT_AVATAR_URL', '')
    const { getAgentIdentity } = await import('./agentIdentity')

    // Override address is the agent inbox; canonical CSW no longer matches.
    expect(getAgentIdentity(CANONICAL_CSW_ADDRESS)).toBeNull()
    expect(getAgentIdentity('0x1111111111111111111111111111111111111111')).not.toBeNull()
  })
})
