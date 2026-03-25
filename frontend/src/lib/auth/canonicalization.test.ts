import { describe, expect, it, vi } from 'vitest'

import { runCanonicalizationPipeline } from './canonicalization'

describe('runCanonicalizationPipeline', () => {
  it('degrades non-strict onboarding bootstrap saturation into a soft result', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          success: false,
          error: 'Max client connections reached',
          code: 'ONBOARDING_BOOTSTRAP_UNAVAILABLE',
          retryable: true,
        }),
      } as Response)

    const result = await runCanonicalizationPipeline({
      privyToken: 'privy-token',
      fetcher,
    })

    expect(result).toEqual({
      privySynced: true,
      onboardingBootstrapped: false,
      onboarding: null,
      flags: {
        needsEmbeddedWallet: false,
        needsBaseAppSetup: false,
        baseAppUrl: null,
      },
    })
  })

  it('keeps strict onboarding bootstrap failures fatal', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          success: false,
          error: 'Max client connections reached',
          code: 'ONBOARDING_BOOTSTRAP_UNAVAILABLE',
          retryable: true,
        }),
      } as Response)

    await expect(
      runCanonicalizationPipeline({
        privyToken: 'privy-token',
        strictOnboardingBootstrap: true,
        fetcher,
      }),
    ).rejects.toThrow('Max client connections reached')
  })
})
