import { describe, expect, it, vi } from 'vitest'

import { captureWalletSessionSnapshot } from './walletSessionSnapshot'

const CSW = '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef' as const
const SUB_ACCOUNT = '0x1111111111111111111111111111111111111111' as const

function makeRequest(handlers: Record<string, () => unknown>) {
  return vi.fn(async ({ method }: { method: string; params?: unknown[] }) => {
    const handler = handlers[method]
    if (!handler) throw new Error(`method ${method} not supported`)
    return handler()
  })
}

describe('captureWalletSessionSnapshot', () => {
  it('returns green when eth_accounts[0] matches the configured CSW', async () => {
    const request = makeRequest({
      eth_accounts: () => [CSW],
      eth_chainId: () => '0x2105',
      wallet_getCapabilities: () => ({ paymasterService: { supported: true } }),
    })

    const snapshot = await captureWalletSessionSnapshot({
      request,
      wagmiAddress: CSW,
      cswAddress: CSW,
    })

    expect(snapshot.warningState).toBe('green')
    expect(snapshot.ethAccountsAddress).toBe(CSW.toLowerCase())
    expect(snapshot.ethChainIdHex).toBe('0x2105')
    expect(snapshot.walletCapabilities).toEqual({ paymasterService: { supported: true } })
    expect(snapshot.errors.ethAccounts).toBeNull()
    expect(snapshot.errors.ethChainId).toBeNull()
    expect(snapshot.errors.walletCapabilities).toBeNull()
    expect(snapshot.message).toContain('CSW directly')
  })

  it('returns amber when eth_accounts[0] is a sub-account address (Base App)', async () => {
    const request = makeRequest({
      eth_accounts: () => [SUB_ACCOUNT],
      eth_chainId: () => '0x2105',
      wallet_getCapabilities: () => {
        throw new Error('method not supported')
      },
    })

    const snapshot = await captureWalletSessionSnapshot({
      request,
      wagmiAddress: SUB_ACCOUNT,
      cswAddress: CSW,
    })

    expect(snapshot.warningState).toBe('amber')
    expect(snapshot.ethAccountsAddress).toBe(SUB_ACCOUNT.toLowerCase())
    expect(snapshot.cswAddress).toBe(CSW.toLowerCase())
    expect(snapshot.walletCapabilities).toBeNull()
    expect(snapshot.errors.walletCapabilities).toBe('method not supported')
    expect(snapshot.message).toMatch(/sub-account/i)
    expect(snapshot.message).toMatch(/EOA-owner submission lane/i)
  })

  it('returns yellow when the provider request fn rejects on eth_accounts', async () => {
    const request = makeRequest({
      eth_accounts: () => {
        throw new Error('user disconnected')
      },
      eth_chainId: () => '0x2105',
    })

    const snapshot = await captureWalletSessionSnapshot({
      request,
      wagmiAddress: null,
      cswAddress: CSW,
    })

    expect(snapshot.warningState).toBe('yellow')
    expect(snapshot.ethAccountsAddress).toBeNull()
    expect(snapshot.errors.ethAccounts).toBe('user disconnected')
    expect(snapshot.message).toMatch(/Could not read eth_accounts/i)
  })

  it('returns yellow with a clear message when no provider request fn is available', async () => {
    const snapshot = await captureWalletSessionSnapshot({
      request: null,
      wagmiAddress: null,
      cswAddress: CSW,
    })

    expect(snapshot.warningState).toBe('yellow')
    expect(snapshot.ethAccountsAddress).toBeNull()
    expect(snapshot.errors.ethAccounts).toBe('no provider request fn')
    expect(snapshot.message).toMatch(/no wallet provider/i)
  })
})
