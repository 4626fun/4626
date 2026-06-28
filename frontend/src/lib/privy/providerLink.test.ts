import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isRecoverableOAuthLinkError,
  linkAndSyncPrivyProvider,
  linkPrivyProvider,
  syncAccountsProviderLink,
} from '@/lib/privy/providerLink'

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('@/hooks/siweAuthCrossApp', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/siweAuthCrossApp')>()
  return {
    ...actual,
    sanitizeCrossAppRedirectUrlForAuth: () => null,
  }
})

vi.mock('@/lib/telegram/telegramWebApp', () => ({
  readPrivyTelegramLaunchParams: () => null,
}))

vi.mock('@/lib/privy/accessToken', () => ({
  readPrivyAccessTokenWithRetries: vi.fn(async () => 'privy-token'),
}))

import { apiFetch } from '@/lib/api/apiBase'

describe('providerLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isRecoverableOAuthLinkError', () => {
    it('treats generic Privy auth failures as recoverable', () => {
      expect(isRecoverableOAuthLinkError(new Error('Authentication failed'))).toBe(true)
      expect(isRecoverableOAuthLinkError(new Error('Redirect URL is not allowed'))).toBe(true)
    })

    it('does not treat unrelated errors as recoverable', () => {
      expect(isRecoverableOAuthLinkError(new Error('User rejected request'))).toBe(false)
      expect(isRecoverableOAuthLinkError(new Error('oauth provider unavailable'))).toBe(false)
    })
  })

  describe('linkPrivyProvider', () => {
    it('requires an authenticated Privy session', async () => {
      await expect(
        linkPrivyProvider({ privy: { authenticated: false }, provider: 'twitter' }),
      ).rejects.toThrow(/sign in before linking/i)
    })

    it('falls back to twitter login when link helpers fail recoverably', async () => {
      const privy = {
        authenticated: true,
        linkTwitter: vi.fn(() => {
          throw new Error('Authentication failed')
        }),
      }
      const login = vi.fn()

      const result = await linkPrivyProvider({ privy, provider: 'twitter', login })

      expect(privy.linkTwitter).toHaveBeenCalledTimes(1)
      expect(login).toHaveBeenCalledWith({ loginMethods: ['twitter'] })
      expect(result).toBe(true)
    })
  })

  describe('linkAndSyncPrivyProvider', () => {
    it('skips backend sync when OAuth navigation is pending', async () => {
      const privy = {
        authenticated: true,
        linkTwitter: vi.fn(() => {
          throw new Error('Authentication failed')
        }),
      }
      const login = vi.fn()

      const data = await linkAndSyncPrivyProvider({
        privy,
        provider: 'twitter',
        login,
        getAccessToken: async () => 'token',
      })

      expect(data).toBeNull()
      expect(apiFetch).not.toHaveBeenCalled()
    })
  })

  describe('syncAccountsProviderLink', () => {
    it('retries when Privy has not hydrated the linked provider yet', async () => {
      vi.mocked(apiFetch)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            success: false,
            error: 'No linked value found for provider "twitter".',
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { privyUserId: 'did:privy:test', linkedMethods: { twitter: ['@4626'] } },
          }),
        } as Response)

      const data = await syncAccountsProviderLink({
        provider: 'twitter',
        getAccessToken: async () => 'token',
        attempts: 2,
        delayMs: 0,
      })

      expect(apiFetch).toHaveBeenCalledTimes(2)
      expect(data.linkedMethods?.twitter).toEqual(['@4626'])
    })

    it('surfaces recovery-required API failures', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: 'Recovery required: this email is already linked to another account.',
          code: 'RECOVERY_REQUIRED_EMAIL_BOUND',
          recoveryRequired: true,
        }),
      } as Response)

      await expect(
        syncAccountsProviderLink({
          provider: 'twitter',
          getAccessToken: async () => 'token',
          attempts: 1,
          delayMs: 0,
        }),
      ).rejects.toMatchObject({
        recoveryRequired: true,
        code: 'RECOVERY_REQUIRED_EMAIL_BOUND',
      })
    })
  })
})
