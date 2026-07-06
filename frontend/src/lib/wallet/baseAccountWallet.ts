import { useConnectWallet, useActiveWallet } from '@privy-io/react-auth'

import { normalizeWalletAddress } from '@/lib/wallet/ensureCanonicalBaseAccountWallet'

export const BASE_ACCOUNT_WALLET_CLIENT_TYPES = ['base_account', 'coinbase_wallet'] as const

export type BaseAccountWalletLike = {
  address?: string
  walletClientType?: string
  wallet_client_type?: string
}

function normalizePrivyText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

export function isBaseAccountWallet(wallet: unknown): boolean {
  const record = wallet && typeof wallet === 'object' ? (wallet as Record<string, unknown>) : null
  const type = normalizePrivyText(record?.walletClientType ?? record?.wallet_client_type ?? record?.connector_type)
  return type === 'base_account' || type === 'coinbase_wallet'
}

export function findBaseAccountWalletInPrivyList(wallets: unknown[]): BaseAccountWalletLike | null {
  for (const wallet of wallets) {
    if (isBaseAccountWallet(wallet)) return wallet as BaseAccountWalletLike
  }
  return null
}

export type ConnectBaseAccountWalletOptions = {
  canonicalCswAddress?: string | null
  description?: string
}

export type ConnectBaseAccountWalletDeps = {
  wallets: unknown[]
  connectWallet: ReturnType<typeof useConnectWallet>['connectWallet']
  setActiveWallet?: ReturnType<typeof useActiveWallet>['setActiveWallet']
  connectedWalletRef?: { current: BaseAccountWalletLike | null }
}

export async function connectBaseAccountWalletWithPrivy(
  deps: ConnectBaseAccountWalletDeps,
  opts?: ConnectBaseAccountWalletOptions,
): Promise<{ ok: true; wallet: BaseAccountWalletLike } | { ok: false; error: Error }> {
  const expectedCanonical = normalizeWalletAddress(opts?.canonicalCswAddress)
  const walletMatchesCanonical = (wallet: BaseAccountWalletLike): boolean => {
    if (!expectedCanonical) return true
    return normalizeWalletAddress(wallet.address) === expectedCanonical
  }

  const existing = findBaseAccountWalletInPrivyList(deps.wallets)
  if (existing && walletMatchesCanonical(existing)) {
    if (deps.connectedWalletRef) deps.connectedWalletRef.current = existing
    if (typeof deps.setActiveWallet === 'function') {
      await Promise.resolve(deps.setActiveWallet(existing as Parameters<NonNullable<typeof deps.setActiveWallet>>[0])).catch(
        () => null,
      )
    }
    return { ok: true, wallet: existing }
  }

  try {
    const result = await Promise.resolve(
      deps.connectWallet({
        walletList: [...BASE_ACCOUNT_WALLET_CLIENT_TYPES],
        walletChainType: 'ethereum-only',
        description: opts?.description ?? 'Connect your Base App wallet to enable 4626 signing.',
      }),
    ).catch((connectError: unknown) => {
      const message = connectError instanceof Error ? connectError.message : String(connectError ?? '')
      if (message.toLowerCase().includes('user') && message.toLowerCase().includes('reject')) {
        return null
      }
      throw connectError
    })

    const selectedWallet =
      result && typeof result === 'object' && 'wallet' in (result as Record<string, unknown>)
        ? ((result as { wallet?: BaseAccountWalletLike }).wallet ?? null)
        : ((result as BaseAccountWalletLike | null) ?? null)

    if (selectedWallet && isBaseAccountWallet(selectedWallet) && deps.connectedWalletRef) {
      deps.connectedWalletRef.current = selectedWallet
    }

    if (selectedWallet && typeof deps.setActiveWallet === 'function') {
      await Promise.resolve(
        deps.setActiveWallet(selectedWallet as Parameters<NonNullable<typeof deps.setActiveWallet>>[0]),
      ).catch(() => null)
    }

    if (selectedWallet) {
      if (expectedCanonical && !walletMatchesCanonical(selectedWallet)) {
        return {
          ok: false,
          error: new Error(
            'Connected wallet does not match your canonical smart wallet. Sign out and use Sign in with Base.',
          ),
        }
      }
      return { ok: true, wallet: selectedWallet }
    }

    return { ok: false, error: new Error('Connect Base App first, then try again.') }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

export async function disconnectBaseAccountWalletWithPrivy(
  wallets: unknown[],
  disconnectWallet?: (wallet: BaseAccountWalletLike) => Promise<unknown>,
): Promise<boolean> {
  const baseWallet = findBaseAccountWalletInPrivyList(wallets)
  if (!baseWallet || typeof disconnectWallet !== 'function') return false
  try {
    await disconnectWallet(baseWallet)
    return true
  } catch {
    return false
  }
}
