import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/flags/flags', () => ({
  getPrivyAppId: () => 'cltestappid000000000000000',
  getPrivyApiUrl: () => 'https://privy.4626.fun',
  getPrivyClientId: () => null,
  isPrivyHostModeAllowed: () => true,
}))

import {
  isPrivyUnifiedStackWallet,
  privyAuthorizedWalletSecp256k1Sign,
  resolvePrivyUnifiedWalletId,
} from '@/lib/privy/privyAuthorizedWalletRpc'

const DIGEST = `0x${'cd'.repeat(32)}` as const
const SIG = `0x${'22'.repeat(65)}` as const
const WALLET_ID = 'l8pocg69pnk3djdrp6t4lm0n'
const ADDRESS = '0xcECa13F2686ed061c57620Ecdf67E1b8C0F285e9'

describe('resolvePrivyUnifiedWalletId', () => {
  it('reads id from live wallet object', () => {
    expect(
      resolvePrivyUnifiedWalletId({
        wallet: { id: WALLET_ID, address: ADDRESS },
      }),
    ).toBe(WALLET_ID)
  })

  it('falls back to user linked wallet metadata by address', () => {
    expect(
      resolvePrivyUnifiedWalletId({
        user: {
          linkedAccounts: [{ type: 'wallet', address: ADDRESS, id: WALLET_ID }],
        },
        address: ADDRESS,
      }),
    ).toBe(WALLET_ID)
  })
})

describe('isPrivyUnifiedStackWallet', () => {
  it('detects privy-v2 recovery method', () => {
    expect(isPrivyUnifiedStackWallet({ id: WALLET_ID, recovery_method: 'privy-v2' })).toBe(true)
  })

  it('detects owner_id on the wallet record', () => {
    expect(isPrivyUnifiedStackWallet({ id: WALLET_ID, owner_id: 'g2ws6oixx80rw412h8kxvcia' })).toBe(true)
  })

  it('detects owner_id from user linked account metadata', () => {
    expect(
      isPrivyUnifiedStackWallet(
        { id: WALLET_ID, address: ADDRESS },
        { linkedAccounts: [{ type: 'wallet', address: ADDRESS, owner_id: 'g2ws6oixx80rw412h8kxvcia' }] },
      ),
    ).toBe(true)
  })
})

describe('privyAuthorizedWalletSecp256k1Sign', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends privy-authorization-signature on wallet RPC via canonical Privy origin', async () => {
    vi.stubEnv('VITE_PRIVY_APP_ID', 'cltestappid000000000000000')
    vi.stubEnv('VITE_PRIVY_API_URL', 'https://privy.4626.fun')

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { signature: SIG } }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const generateAuthorizationSignature = vi.fn(async () => ({ signature: 'auth-sig-base64' }))

    const out = await privyAuthorizedWalletSecp256k1Sign({
      walletId: WALLET_ID,
      hash: DIGEST,
      generateAuthorizationSignature,
      getToken: async () => 'access-token',
    })

    expect(out).toBe(SIG)
    expect(generateAuthorizationSignature).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        method: 'POST',
        url: `https://auth.privy.io/api/v1/wallets/${WALLET_ID}/rpc`,
        body: {
          chain_type: 'ethereum',
          method: 'secp256k1_sign',
          params: { hash: DIGEST },
        },
      }),
    )

    expect(fetchMock).toHaveBeenCalledWith(
      `https://auth.privy.io/api/v1/wallets/${WALLET_ID}/rpc`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'privy-authorization-signature': 'auth-sig-base64',
        }),
      }),
    )
  })

  it('rejects malformed non-32-byte hash before calling Privy', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const generateAuthorizationSignature = vi.fn(async () => ({ signature: 'auth-sig-base64' }))

    await expect(
      privyAuthorizedWalletSecp256k1Sign({
        walletId: WALLET_ID,
        hash: ADDRESS as `0x${string}`,
        generateAuthorizationSignature,
        getToken: async () => 'access-token',
      }),
    ).rejects.toThrow('requires a 32-byte digest hash')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(generateAuthorizationSignature).not.toHaveBeenCalled()
  })
})
