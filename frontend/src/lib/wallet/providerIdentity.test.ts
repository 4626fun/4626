import { describe, expect, it } from 'vitest'

import { inferWalletProvider, walletProviderLabel } from './providerIdentity'

describe('inferWalletProvider', () => {
  it('detects MetaMask provider', () => {
    expect(inferWalletProvider({ provider: 'metamask' })).toBe('metamask')
  })

  it('detects Rabby provider', () => {
    expect(inferWalletProvider({ provider: 'rabby_wallet' })).toBe('rabby')
  })

  it('detects WalletConnect provider aliases', () => {
    expect(inferWalletProvider({ provider: 'wallet_connect' })).toBe('walletconnect')
    expect(inferWalletProvider({ provider: 'wc' })).toBe('walletconnect')
  })

  it('detects Privy before smart-wallet fallback', () => {
    expect(inferWalletProvider({ provider: 'privy', walletType: 'smart_wallet' })).toBe('privy')
  })

  it('detects Coinbase from connector id', () => {
    expect(inferWalletProvider({ connectorId: 'coinbaseWalletSDK' })).toBe('coinbase')
    expect(inferWalletProvider({ connectorId: 'com.coinbase.wallet' })).toBe('coinbase')
  })

  it('falls back to Coinbase for canonical smart wallet addresses', () => {
    expect(inferWalletProvider({ walletType: 'smart_wallet', isCanonicalSmartWallet: true })).toBe('coinbase')
  })

  it('returns unknown for unmatched providers', () => {
    expect(inferWalletProvider({ provider: 'unknown_provider' })).toBe('unknown')
  })
})

describe('walletProviderLabel', () => {
  it('returns user-facing labels', () => {
    expect(walletProviderLabel('coinbase')).toBe('Coinbase')
    expect(walletProviderLabel('privy')).toBe('Privy')
    expect(walletProviderLabel('metamask')).toBe('MetaMask')
    expect(walletProviderLabel('rabby')).toBe('Rabby')
    expect(walletProviderLabel('walletconnect')).toBe('WalletConnect')
    expect(walletProviderLabel('unknown')).toBe('Wallet')
  })
})
