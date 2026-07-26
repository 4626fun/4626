import { afterEach, describe, expect, it, vi } from 'vitest'

const flagState = {
  clientId: null as string | null,
}

vi.mock('@/lib/flags/flags', () => ({
  getPrivyAppId: () => 'cltestappid000000000000000',
  getPrivyApiUrl: () => 'https://privy.4626.fun',
  getPrivyClientId: () => flagState.clientId,
  isPrivyHostModeAllowed: () => true,
}))

vi.mock('@/lib/flags/featureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/flags/featureFlags')>()
  return {
    ...actual,
    resolveEffectivePrivyClientId: () =>
      flagState.clientId ?? actual.resolveEffectivePrivyClientId(),
  }
})

const assertPrivySessionMarkerCookie = vi.fn()
vi.mock('@/lib/privy/loopbackSessionMarkerShim', () => ({
  assertPrivySessionMarkerCookie: (...args: unknown[]) => assertPrivySessionMarkerCookie(...args),
}))

import {
  isPrivyUnifiedStackWallet,
  privyAuthorizedWalletPersonalSign,
  privyAuthorizedWalletSecp256k1Sign,
  privyAuthorizedWalletSignTypedData,
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

  it('rejects a wallet id when the requested signer address disagrees', () => {
    expect(
      resolvePrivyUnifiedWalletId({
        wallet: { id: WALLET_ID, address: ADDRESS },
        address: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
      }),
    ).toBeNull()
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


describe('privyAuthorizedWalletSecp256k1Sign signer guard', () => {
  it('fails closed on expectedSignerAddress mismatch before fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      privyAuthorizedWalletSecp256k1Sign({
        walletId: WALLET_ID,
        hash: DIGEST,
        walletAddress: ADDRESS,
        expectedSignerAddress: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
        generateAuthorizationSignature: async () => ({ signature: 'sig' }),
      }),
    ).rejects.toThrow(/does not match the signing owner address/i)
    expect(fetchMock).not.toHaveBeenCalled()
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
        headers: expect.objectContaining({
          'privy-app-id': 'cltestappid000000000000000',
          'privy-request-expiry': expect.stringMatching(/^\d+$/),
        }),
      }),
    )

    expect(fetchMock).toHaveBeenCalledWith(
      `https://auth.privy.io/api/v1/wallets/${WALLET_ID}/rpc`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'privy-authorization-signature': 'auth-sig-base64',
          'privy-request-expiry': expect.stringMatching(/^\d+$/),
        }),
      }),
    )
  })

  it('asserts the loopback session marker cookie before reading the access token', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { signature: SIG } }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    await privyAuthorizedWalletSecp256k1Sign({
      walletId: WALLET_ID,
      hash: DIGEST,
      generateAuthorizationSignature: vi.fn(async () => ({ signature: 'auth-sig-base64' })),
      getToken: async () => 'access-token',
    })

    expect(assertPrivySessionMarkerCookie).toHaveBeenCalled()
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

describe('privyAuthorizedWalletPersonalSign', () => {
  afterEach(() => {
    flagState.clientId = null
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends hex message (without 0x) and privy-authorization-signature via canonical origin', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { signature: SIG } }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const generateAuthorizationSignature = vi.fn(async () => ({ signature: 'auth-sig-base64' }))
    const messageHex = `0x${Buffer.from('XMTP inbox signature').toString('hex')}`

    const out = await privyAuthorizedWalletPersonalSign({
      walletId: WALLET_ID,
      messageHex,
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
          method: 'personal_sign',
          params: { message: messageHex.slice(2), encoding: 'hex' },
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

  it('sends waitlist loopback privy-client-id when generic loopback client id is disabled', async () => {
    vi.stubEnv('VITE_PRIVY_CLIENT_ID_ENABLED', '1')
    vi.stubEnv('VITE_PRIVY_CLIENT_ID', 'client_waitlist_123')
    vi.stubEnv('VITE_PRIVY_CLIENT_ID_ON_LOOPBACK', '')

    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:5174' },
    } as Window & typeof globalThis)

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { signature: SIG } }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const generateAuthorizationSignature = vi.fn(async () => ({ signature: 'auth-sig-base64' }))
    const messageHex = `0x${Buffer.from('XMTP inbox signature').toString('hex')}`

    await privyAuthorizedWalletPersonalSign({
      walletId: WALLET_ID,
      messageHex,
      generateAuthorizationSignature,
      getToken: async () => 'access-token',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `https://auth.privy.io/api/v1/wallets/${WALLET_ID}/rpc`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'privy-client-id': 'client_waitlist_123',
        }),
      }),
    )
  })

  it('rejects non-hex messages before calling Privy', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const generateAuthorizationSignature = vi.fn(async () => ({ signature: 'auth-sig-base64' }))

    await expect(
      privyAuthorizedWalletPersonalSign({
        walletId: WALLET_ID,
        messageHex: 'plain text message',
        generateAuthorizationSignature,
        getToken: async () => 'access-token',
      }),
    ).rejects.toThrow('0x-prefixed hex-encoded message')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(generateAuthorizationSignature).not.toHaveBeenCalled()
  })

  it('retries via the first-party proxy host when the canonical origin returns 401', async () => {
    const messageHex = `0x${Buffer.from('XMTP inbox signature').toString('hex')}`
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('https://auth.privy.io/')) {
        return {
          ok: false,
          status: 401,
          text: async () => JSON.stringify({ error: 'Missing auth token.' }),
        }
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: { signature: SIG } }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const generateAuthorizationSignature = vi.fn(async () => ({ signature: 'auth-sig-base64' }))

    const out = await privyAuthorizedWalletPersonalSign({
      walletId: WALLET_ID,
      messageHex,
      generateAuthorizationSignature,
      getToken: async () => 'access-token',
    })

    expect(out).toBe(SIG)
    // Re-sign for the proxy URL — Privy requires the signed url to match the request target.
    expect(generateAuthorizationSignature).toHaveBeenCalledTimes(2)
    expect(generateAuthorizationSignature).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ url: `https://auth.privy.io/api/v1/wallets/${WALLET_ID}/rpc` }),
    )
    expect(generateAuthorizationSignature).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ url: `https://privy.4626.fun/api/v1/wallets/${WALLET_ID}/rpc` }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `https://auth.privy.io/api/v1/wallets/${WALLET_ID}/rpc`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `https://privy.4626.fun/api/v1/wallets/${WALLET_ID}/rpc`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
    warnSpy.mockRestore()
  })

  it('surfaces the proxy failure when both origins return 401', async () => {
    const messageHex = `0x${Buffer.from('XMTP inbox signature').toString('hex')}`
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'Missing auth token.' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(
      privyAuthorizedWalletPersonalSign({
        walletId: WALLET_ID,
        messageHex,
        generateAuthorizationSignature: vi.fn(async () => ({ signature: 'auth-sig-base64' })),
        getToken: async () => 'access-token',
      }),
    ).rejects.toThrow('personal_sign failed (401)')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    warnSpy.mockRestore()
  })

  it('sends privy-client-id when an app client is configured', async () => {
    flagState.clientId = 'client-test-id'
    try {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: { signature: SIG } }),
      }))
      vi.stubGlobal('fetch', fetchMock)

      const messageHex = `0x${Buffer.from('XMTP inbox signature').toString('hex')}`
      await privyAuthorizedWalletPersonalSign({
        walletId: WALLET_ID,
        messageHex,
        generateAuthorizationSignature: vi.fn(async () => ({ signature: 'auth-sig-base64' })),
        getToken: async () => 'access-token',
      })

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ 'privy-client-id': 'client-test-id' }),
        }),
      )
    } finally {
      flagState.clientId = null
    }
  })
})

describe('privyAuthorizedWalletSignTypedData', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends eth_signTypedData_v4 with typed_data payload via canonical origin', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { signature: SIG } }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const typedData = {
      domain: {
        name: 'Coinbase Smart Wallet',
        version: '1',
        chainId: 8453,
        verifyingContract: ADDRESS,
      },
      types: {
        CoinbaseSmartWalletMessage: [{ name: 'hash', type: 'bytes32' }],
      },
      primaryType: 'CoinbaseSmartWalletMessage',
      message: { hash: DIGEST },
    }

    const out = await privyAuthorizedWalletSignTypedData({
      walletId: WALLET_ID,
      typedData,
      address: ADDRESS,
      generateAuthorizationSignature: vi.fn(async () => ({ signature: 'auth-sig-base64' })),
      getToken: async () => 'access-token',
    })

    expect(out).toBe(SIG)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://auth.privy.io/api/v1/wallets/${WALLET_ID}/rpc`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'privy-authorization-signature': 'auth-sig-base64',
        }),
        body: JSON.stringify({
          chain_type: 'ethereum',
          method: 'eth_signTypedData_v4',
          params: {
            typed_data: {
              domain: typedData.domain,
              message: typedData.message,
              types: typedData.types,
              primary_type: typedData.primaryType,
            },
          },
          address: ADDRESS,
        }),
      }),
    )
  })

  it('rejects malformed typed data before calling Privy', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      privyAuthorizedWalletSignTypedData({
        walletId: WALLET_ID,
        typedData: { domain: {}, message: {} },
        generateAuthorizationSignature: vi.fn(async () => ({ signature: 'auth-sig-base64' })),
        getToken: async () => 'access-token',
      }),
    ).rejects.toThrow('requires typed data with domain, message, types, and primaryType')

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
