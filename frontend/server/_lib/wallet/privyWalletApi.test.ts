import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'

// The Privy authorization signature path calls node:crypto.sign('sha256', ...)
// with a PKCS#8 key. We generate an ephemeral P-256 EC key per test so the
// signing path produces a real SHA-256-capable signature (whose value we ignore).

const attestationGateMock = vi.fn()

vi.mock('../agent/teeAttestationGate.js', () => ({
  assertTeeAttestationOrThrow: (...args: unknown[]) => attestationGateMock(...args),
}))

async function buildTestAuthKey(): Promise<string> {
  const { generateKeyPairSync } = await import('node:crypto')
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
  const b64 = pem
    .split('\n')
    .filter((l) => l && !l.startsWith('-----'))
    .join('')
  return `wallet-auth:${b64}`
}

describe('walletRpc caip2 behavior', () => {
  const originalFetch = globalThis.fetch
  const originalEnv = { ...process.env }

  beforeEach(async () => {
    vi.resetModules()
    attestationGateMock.mockResolvedValue(undefined)

    process.env.PRIVY_APP_ID = 'test-app-id'
    process.env.PRIVY_APP_SECRET = 'test-app-secret'
    process.env.PRIVY_WALLET_OWNER_ID = 'test-owner'
    process.env.PRIVY_WALLET_AUTHORIZATION_KEY = await buildTestAuthKey()
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    process.env = { ...originalEnv }
  })

  it('includes top-level caip2 in the request body when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ method: 'eth_sendTransaction', data: { hash: '0xdeadbeef' } }),
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { walletRpc, BASE_CAIP2 } = await import('./privyWalletApi')
    await walletRpc({
      walletId: 'wallet-1',
      method: 'eth_sendTransaction',
      caip2: BASE_CAIP2,
      rpcParams: {
        transaction: {
          to: '0x1111111111111111111111111111111111111111',
          value: '0x0',
          chain_id: 8453,
        },
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.privy.io/v1/wallets/wallet-1/rpc')

    const body = JSON.parse(String(init.body))
    expect(body.caip2).toBe('eip155:8453')
    expect(body.method).toBe('eth_sendTransaction')
    expect(body.chain_type).toBe('ethereum')
    expect(body.params?.transaction?.to).toBe('0x1111111111111111111111111111111111111111')
  })

  it('omits caip2 from the request body when not provided (signing methods)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ method: 'secp256k1_sign', data: { signature: '0xdead' } }),
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { walletRpc } = await import('./privyWalletApi')
    await walletRpc({
      walletId: 'wallet-1',
      method: 'secp256k1_sign',
      rpcParams: { hash: '0xabcdef' },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect('caip2' in body).toBe(false)
    expect(body.method).toBe('secp256k1_sign')
  })

  it('exposes BASE_CAIP2 as the canonical Base identifier', async () => {
    const { BASE_CAIP2 } = await import('./privyWalletApi')
    expect(BASE_CAIP2).toBe('eip155:8453')
  })
})
