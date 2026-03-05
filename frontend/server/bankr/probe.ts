import {
  normalizePolicyAddress,
  resolvePolicyCanonicalAddress,
  TARGET_CANONICAL_CSW_ADDRESS,
} from '../../src/wallet/canonicalWalletPolicy'
import { bankrGetMe, isBankrConfigured, type BankrMeResponse } from './client.js'

type WalletProbeReason =
  | 'bankr_not_configured'
  | 'bankr_identity_unavailable'
  | 'bankr_evm_wallet_missing'
  | 'wallet_mismatch'
  | 'wallet_match'

export type BankrCanonicalProbe = {
  configured: boolean
  walletMatch: boolean
  reason: WalletProbeReason
  expectedCanonical: string
  signerWallet: string | null
  bankrEvmWallet: string | null
  bankrEvmWallets: string[]
  bankrError: string | null
}

function toAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return normalizePolicyAddress(value)
}

function collectEvmWallets(me: BankrMeResponse): string[] {
  const wallets = Array.isArray(me.wallets) ? me.wallets : []
  const out = new Set<string>()
  for (const wallet of wallets) {
    const chain = String(wallet?.chain ?? '').trim().toLowerCase()
    if (chain !== 'evm') continue
    const normalized = toAddress(wallet?.address)
    if (normalized) out.add(normalized)
  }
  return Array.from(out)
}

function resolveExpectedCanonical(params: {
  canonicalWallet: string | null
  signerWallet: string | null
}): string {
  return (
    resolvePolicyCanonicalAddress({
      canonicalAddress: params.canonicalWallet,
      signerAddress: params.signerWallet,
    }) ?? TARGET_CANONICAL_CSW_ADDRESS
  )
}

export async function probeBankrCanonicalWalletMatch(params: {
  canonicalWallet: string | null
  signerWallet: string | null
}): Promise<BankrCanonicalProbe> {
  const signerWallet = toAddress(params.signerWallet)
  const expectedCanonical = resolveExpectedCanonical({
    canonicalWallet: toAddress(params.canonicalWallet),
    signerWallet,
  })

  if (!isBankrConfigured()) {
    return {
      configured: false,
      walletMatch: false,
      reason: 'bankr_not_configured',
      expectedCanonical,
      signerWallet,
      bankrEvmWallet: null,
      bankrEvmWallets: [],
      bankrError: 'BANKR_API_KEY is not configured',
    }
  }

  const me = await bankrGetMe()
  if (!me.ok) {
    return {
      configured: true,
      walletMatch: false,
      reason: 'bankr_identity_unavailable',
      expectedCanonical,
      signerWallet,
      bankrEvmWallet: null,
      bankrEvmWallets: [],
      bankrError: me.error,
    }
  }

  const bankrEvmWallets = collectEvmWallets(me.data)
  const bankrEvmWallet = bankrEvmWallets[0] ?? null
  if (bankrEvmWallets.length === 0) {
    return {
      configured: true,
      walletMatch: false,
      reason: 'bankr_evm_wallet_missing',
      expectedCanonical,
      signerWallet,
      bankrEvmWallet: null,
      bankrEvmWallets,
      bankrError: null,
    }
  }

  const walletMatch = bankrEvmWallets.includes(expectedCanonical)
  return {
    configured: true,
    walletMatch,
    reason: walletMatch ? 'wallet_match' : 'wallet_mismatch',
    expectedCanonical,
    signerWallet,
    bankrEvmWallet,
    bankrEvmWallets,
    bankrError: null,
  }
}
