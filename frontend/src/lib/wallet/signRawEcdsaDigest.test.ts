import { describe, expect, it, vi } from 'vitest'

import { isRawEcdsaDigest, signRawEcdsaDigest } from '@/lib/wallet/signRawEcdsaDigest'

const DIGEST = `0x${'ab'.repeat(32)}` as const
const SIG = `0x${'11'.repeat(65)}` as const
const SIGNER = '0xcECa13F2686ed061c57620Ecdf67E1b8C0F285e9'

describe('signRawEcdsaDigest', () => {
  it('recognizes 32-byte digests', () => {
    expect(isRawEcdsaDigest(DIGEST)).toBe(true)
    expect(isRawEcdsaDigest('0x1234')).toBe(false)
  })

  it('prefers secp256k1_sign over personal_sign', async () => {
    const request = vi.fn(async (args: { method: string }) => {
      if (args.method === 'secp256k1_sign') return SIG
      throw new Error('should not reach personal_sign')
    })
    const signMessage = vi.fn()

    const out = await signRawEcdsaDigest({
      digest: DIGEST,
      signerAddress: SIGNER,
      walletClient: { request, signMessage },
    })

    expect(out).toBe(SIG)
    expect(request).toHaveBeenCalledWith({ method: 'secp256k1_sign', params: [DIGEST] })
    expect(signMessage).not.toHaveBeenCalled()
  })

  it('falls back to eth_sign when secp256k1_sign is unavailable', async () => {
    const request = vi.fn(async (args: { method: string; params?: unknown[] | Record<string, unknown> }) => {
      if (args.method === 'secp256k1_sign') throw new Error('unsupported method')
      if (args.method === 'eth_sign') return SIG
      throw new Error('unexpected method')
    })

    const out = await signRawEcdsaDigest({
      digest: DIGEST,
      signerAddress: SIGNER,
      walletClient: { request },
    })

    expect(out).toBe(SIG)
    expect(request).toHaveBeenNthCalledWith(1, { method: 'secp256k1_sign', params: [DIGEST] })
    expect(request).toHaveBeenNthCalledWith(2, { method: 'secp256k1_sign', params: { hash: DIGEST } })
    expect(request).toHaveBeenNthCalledWith(3, {
      method: 'secp256k1_sign',
      params: [SIGNER, DIGEST],
    })
    expect(request).toHaveBeenNthCalledWith(4, {
      method: 'eth_sign',
      params: [SIGNER, DIGEST],
    })
  })

  it('reports method-level failures when raw digest signing is unavailable', async () => {
    const request = vi.fn(async () => {
      throw new Error('provider_unsupported')
    })

    await expect(
      signRawEcdsaDigest({
        digest: DIGEST,
        signerAddress: SIGNER,
        walletClient: { request },
      }),
    ).rejects.toThrow(/Raw digest signing is unavailable/)
    await expect(
      signRawEcdsaDigest({
        digest: DIGEST,
        signerAddress: SIGNER,
        walletClient: { request },
      }),
    ).rejects.toThrow(/Method failures:/)
  })

  it('retries raw signing after auth refresh when token is missing', async () => {
    let refreshed = false
    const request = vi.fn(async (args: { method: string }) => {
      if (args.method === 'secp256k1_sign') {
        if (!refreshed) throw new Error('Missing auth token.')
        return SIG
      }
      if (args.method === 'eth_sign') {
        throw new Error('Method not supported: eth_sign')
      }
      if (args.method === 'eth_requestAccounts') {
        refreshed = true
        return [SIGNER]
      }
      throw new Error('unexpected method')
    })

    const out = await signRawEcdsaDigest({
      digest: DIGEST,
      signerAddress: SIGNER,
      walletClient: { request },
    })

    expect(out).toBe(SIG)
    expect(request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' })
    expect(request.mock.calls.filter(([call]) => call.method === 'secp256k1_sign').length).toBeGreaterThanOrEqual(3)
  })

  it('refreshes proactively when refreshSession is wired', async () => {
    const request = vi.fn(async (args: { method: string }) => {
      if (args.method === 'secp256k1_sign') return SIG
      throw new Error(`unexpected method ${args.method}`)
    })
    const refreshSession = vi.fn(async () => true)

    const out = await signRawEcdsaDigest({
      digest: DIGEST,
      signerAddress: SIGNER,
      walletClient: { request, refreshSession },
    })

    expect(out).toBe(SIG)
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('prefers the provided refreshSession callback over eth_requestAccounts on auth failure', async () => {
    let refreshed = false
    const request = vi.fn(async (args: { method: string }) => {
      if (args.method === 'secp256k1_sign') {
        if (!refreshed) throw new Error('Missing auth token.')
        return SIG
      }
      if (args.method === 'eth_sign') throw new Error('Method not supported: eth_sign')
      throw new Error(`unexpected method ${args.method}`)
    })
    const refreshSession = vi.fn(async () => {
      refreshed = true
      return true
    })

    const out = await signRawEcdsaDigest({
      digest: DIGEST,
      signerAddress: SIGNER,
      walletClient: { request },
      refreshSession,
    })

    expect(out).toBe(SIG)
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(request.mock.calls.some(([call]) => call.method === 'eth_requestAccounts')).toBe(false)
  })

  it('uses walletClient.refreshSession when provided on the client object', async () => {
    let refreshed = false
    const request = vi.fn(async (args: { method: string }) => {
      if (args.method === 'secp256k1_sign') {
        if (!refreshed) throw new Error('Missing auth token.')
        return SIG
      }
      if (args.method === 'eth_sign') throw new Error('Method not supported: eth_sign')
      throw new Error(`unexpected method ${args.method}`)
    })
    const refreshSession = vi.fn(async () => {
      refreshed = true
      return true
    })

    const out = await signRawEcdsaDigest({
      digest: DIGEST,
      signerAddress: SIGNER,
      walletClient: { request, refreshSession },
    })

    expect(out).toBe(SIG)
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('surfaces refreshSession failure diagnostics (expired Privy session)', async () => {
    const request = vi.fn(async (args: { method: string }) => {
      if (args.method === 'secp256k1_sign') throw new Error('Missing auth token.')
      if (args.method === 'eth_sign') throw new Error('Method not supported: eth_sign')
      throw new Error(`unexpected method ${args.method}`)
    })
    const refreshSession = vi.fn(async () => {
      throw new Error('Privy access token refresh returned no token (session expired — sign in again)')
    })

    await expect(
      signRawEcdsaDigest({
        digest: DIGEST,
        signerAddress: SIGNER,
        walletClient: { request },
        refreshSession,
      }),
    ).rejects.toThrow(/session expired — sign in again/)
  })

  it('includes refresh diagnostics when auth refresh attempt fails', async () => {
    const request = vi.fn(async (args: { method: string }) => {
      if (args.method === 'secp256k1_sign') throw new Error('Missing auth token.')
      if (args.method === 'eth_sign') throw new Error('Method not supported: eth_sign')
      if (args.method === 'eth_accounts') throw new Error('Missing auth token.')
      if (args.method === 'eth_requestAccounts') throw new Error('Missing auth token.')
      throw new Error('unexpected method')
    })

    await expect(
      signRawEcdsaDigest({
        digest: DIGEST,
        signerAddress: SIGNER,
        walletClient: { request },
      }),
    ).rejects.toThrow(/Your signing session could not be refreshed: Missing auth token/)
    await expect(
      signRawEcdsaDigest({
        digest: DIGEST,
        signerAddress: SIGNER,
        walletClient: { request },
      }),
    ).rejects.toThrow(/Sign out and sign in again/)
  })

  it('retries after disconnected signer errors by refreshing the session', async () => {
    let refreshed = false
    const request = vi.fn(async (args: { method: string }) => {
      if (args.method === 'secp256k1_sign') {
        if (!refreshed) throw new Error('Disconnected')
        return SIG
      }
      if (args.method === 'eth_sign') throw new Error('Disconnected')
      throw new Error(`unexpected method ${args.method}`)
    })
    const refreshSession = vi.fn(async () => {
      refreshed = true
      return true
    })

    const out = await signRawEcdsaDigest({
      digest: DIGEST,
      signerAddress: SIGNER,
      walletClient: { request },
      refreshSession,
    })

    expect(out).toBe(SIG)
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('retries after Privy wallet RPC authorization signature 401 by refreshing the session', async () => {
    let refreshed = false
    const auth401 =
      'No valid authorization signatures were provided. Your payload may be malformed or your signing keys may be incorrect or expired.'
    const request = vi.fn(async (args: { method: string }) => {
      if (args.method === 'secp256k1_sign') {
        if (!refreshed) throw new Error(auth401)
        return SIG
      }
      if (args.method === 'eth_sign') {
        if (!refreshed) throw new Error(auth401)
        return SIG
      }
      throw new Error(`unexpected method ${args.method}`)
    })
    const refreshSession = vi.fn(async () => {
      refreshed = true
      return true
    })

    const out = await signRawEcdsaDigest({
      digest: DIGEST,
      signerAddress: SIGNER,
      walletClient: { request },
      refreshSession,
    })

    expect(out).toBe(SIG)
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })
})
