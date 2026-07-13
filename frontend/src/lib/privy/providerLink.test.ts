import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildPrivyUnlinkMethodArgs,
  isRecoverableOAuthLinkError,
  linkAndSyncPrivyProvider,
  linkPrivyProvider,
  syncAccountsProviderLink,
  unlinkPrivyProvider,
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

const assertPrivySessionMarkerCookie = vi.fn()
vi.mock('@/lib/privy/loopbackSessionMarkerShim', () => ({
  assertPrivySessionMarkerCookie: (...args: unknown[]) => assertPrivySessionMarkerCookie(...args),
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

    it('asserts the loopback session marker cookie before calling the Privy SDK', async () => {
      const privy = { authenticated: true, linkTwitter: vi.fn(async () => ({ id: 'user' })) }

      await linkPrivyProvider({ privy, provider: 'twitter' })

      expect(assertPrivySessionMarkerCookie).toHaveBeenCalled()
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

    it('refreshes the 4626 session before syncing an external wallet link', async () => {
      vi.mocked(apiFetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { address: '0x00000000000000000000000000000000000000aa' },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { privyUserId: 'did:privy:test', linkedMethods: { external_eoa: ['0xabc'] } },
          }),
        } as Response)
      const privy = {
        authenticated: true,
        linkWallet: vi.fn(async () => ({ id: 'user' })),
      }

      await linkAndSyncPrivyProvider({
        privy,
        provider: 'external_eoa',
        getAccessToken: async () => 'privy-token',
      })

      expect(apiFetch).toHaveBeenNthCalledWith(
        1,
        '/api/auth/privy',
        expect.objectContaining({
          method: 'POST',
          withCredentials: true,
          headers: expect.objectContaining({ Authorization: 'Bearer privy-token' }),
        }),
      )
      expect(apiFetch).toHaveBeenNthCalledWith(
        2,
        '/api/accounts/link',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  describe('buildPrivyUnlinkMethodArgs', () => {
    it('passes wallet addresses as plain strings for external_eoa', () => {
      expect(buildPrivyUnlinkMethodArgs('external_eoa', '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD')).toEqual([
        '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      ])
    })

    it('passes twitter subjects as plain strings', () => {
      expect(buildPrivyUnlinkMethodArgs('twitter', 'twitter-subject-123')).toEqual(['twitter-subject-123'])
    })

    it('returns empty args when the identifier is missing', () => {
      expect(buildPrivyUnlinkMethodArgs('external_eoa', null)).toEqual([])
    })
  })

  describe('unlinkPrivyProvider', () => {
    it('calls unlinkWallet with the address string, not a value wrapper', async () => {
      const unlinkWallet = vi.fn(async () => ({ id: 'user' }))
      const privy = { unlinkWallet }

      await unlinkPrivyProvider({
        privy,
        provider: 'external_eoa',
        value: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      })

      expect(unlinkWallet).toHaveBeenCalledWith('0xB05Cf01231cF2fF99499682E64D3780d57c80FdD')
    })

    it('calls unlinkTwitter with the subject string', async () => {
      const unlinkTwitter = vi.fn(async () => ({ id: 'user' }))
      const privy = { unlinkTwitter }

      await unlinkPrivyProvider({
        privy,
        provider: 'twitter',
        value: 'twitter-subject-123',
      })

      expect(unlinkTwitter).toHaveBeenCalledWith('twitter-subject-123')
    })

    it('asserts the loopback session marker cookie before calling the Privy SDK', async () => {
      const unlinkWallet = vi.fn(async () => ({ id: 'user' }))
      const privy = { unlinkWallet }

      await unlinkPrivyProvider({
        privy,
        provider: 'external_eoa',
        value: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      })

      expect(assertPrivySessionMarkerCookie).toHaveBeenCalled()
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
