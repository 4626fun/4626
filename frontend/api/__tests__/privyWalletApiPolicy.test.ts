import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from './helpers'

describe('privy wallet policy enforcement', () => {
  let restoreEnv: (() => void) | null = null
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    restoreEnv = null
  })

  afterEach(() => {
    restoreEnv?.()
    globalThis.fetch = originalFetch
  })

  it('fails closed in production when PRIVY_WALLET_POLICY_ID is missing', async () => {
    restoreEnv = applyEnv({
      NODE_ENV: 'production',
      VERCEL: '1',
      PRIVY_WALLET_OWNER_ID: 'owner_123',
      PRIVY_WALLET_POLICY_ID: '',
    })

    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const mod = await import('../../server/_lib/privyWalletApi.ts')

    await expect(mod.createAgentWallet()).rejects.toThrow('PRIVY_WALLET_POLICY_ID missing in production')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
