import { describe, expect, it, vi } from 'vitest'

import { executeWaitlistBootstrapPipeline } from './waitlistBootstrapPipeline'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

const BOOTSTRAP_PAYLOAD = {
  success: true,
  data: {
    requiresPrivyAuth: false,
    email: 'user@example.com',
    emailVerified: true,
    privyUserId: 'did:privy:test-user',
    linkedMethods: { email: ['user@example.com'] },
    accountSignals: {},
  },
}

describe('executeWaitlistBootstrapPipeline', () => {
  it('calls waitlist bootstrap before canonicalization', async () => {
    const callOrder: string[] = []

    const result = await executeWaitlistBootstrapPipeline({
      token: 'privy-token',
      activeReferralCode: null,
      fetchWaitlistBootstrap: async () => {
        callOrder.push('waitlist/bootstrap')
        return jsonResponse(BOOTSTRAP_PAYLOAD)
      },
      runCanonicalization: async () => {
        callOrder.push('auth/privy')
        return {
          onboardingBootstrapped: false,
          onboarding: null,
          flags: { needsEmbeddedWallet: false },
        }
      },
      ensureEmbeddedWallet: async () => {
        callOrder.push('embedded-wallet')
        return { address: '0xabc' }
      },
    })

    expect(callOrder).toEqual(['waitlist/bootstrap', 'auth/privy'])
    expect(result.kind).toBe('success')
  })

  it('still succeeds when canonicalization reports recovery after bootstrap settled identity', async () => {
    const result = await executeWaitlistBootstrapPipeline({
      token: 'privy-token',
      activeReferralCode: null,
      fetchWaitlistBootstrap: async () => jsonResponse(BOOTSTRAP_PAYLOAD),
      runCanonicalization: async () => {
        const err = new Error('Recovery required') as Error & { recoveryRequired?: boolean; code?: string }
        err.recoveryRequired = true
        err.code = 'RECOVERY_REQUIRED_EMAIL_BOUND'
        throw err
      },
      ensureEmbeddedWallet: async () => ({ address: '0xabc' }),
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.payload.emailVerified).toBe(true)
      expect(result.bootstrappedCanonicalWallet).toBeNull()
    }
  })

  it('throws recovery errors from waitlist bootstrap before canonicalization runs', async () => {
    const runCanonicalization = vi.fn(async () => ({
      onboardingBootstrapped: false,
      onboarding: null,
      flags: { needsEmbeddedWallet: false },
    }))

    await expect(
      executeWaitlistBootstrapPipeline({
        token: 'privy-token',
        activeReferralCode: null,
        fetchWaitlistBootstrap: async () =>
          jsonResponse(
            {
              success: false,
              error: 'Recovery required',
              code: 'RECOVERY_REQUIRED_EMAIL_BOUND',
              recoveryRequired: true,
            },
            200,
          ),
        runCanonicalization,
        ensureEmbeddedWallet: async () => ({ address: '0xabc' }),
      }),
    ).rejects.toMatchObject({ recoveryRequired: true })

    expect(runCanonicalization).not.toHaveBeenCalled()
  })

  it('provisions embedded wallet only after bootstrap succeeds', async () => {
    const callOrder: string[] = []
    let canonicalizationCalls = 0

    await executeWaitlistBootstrapPipeline({
      token: 'privy-token',
      activeReferralCode: null,
      fetchWaitlistBootstrap: async () => {
        callOrder.push('waitlist/bootstrap')
        return jsonResponse(BOOTSTRAP_PAYLOAD)
      },
      runCanonicalization: async () => {
        canonicalizationCalls += 1
        callOrder.push(`auth/privy:${canonicalizationCalls}`)
        return {
          onboardingBootstrapped: false,
          onboarding: null,
          flags: { needsEmbeddedWallet: canonicalizationCalls === 1 },
        }
      },
      ensureEmbeddedWallet: async () => {
        callOrder.push('embedded-wallet')
        return { address: '0xabc' }
      },
    })

    expect(callOrder).toEqual(['waitlist/bootstrap', 'auth/privy:1', 'embedded-wallet', 'auth/privy:2'])
  })
})
