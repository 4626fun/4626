import { useCallback, useEffect, useRef, useState } from 'react'
import { useBaseAccountSdk } from '@privy-io/react-auth'

import { useSubAccountSetup } from '@/hooks/useSubAccountSetup'
import { usePrivyWalletsFromContext } from '@/lib/privy/walletHooksContext'
import {
  findBaseAccountWalletInList,
  isCanonicalBaseAccountWalletReady,
  readBaseAccountProviderAccounts,
} from '@/lib/wallet/ensureCanonicalBaseAccountWallet'

type EnsureCanonicalBaseAccountWalletParams = {
  enabled: boolean
  canonicalCswAddress: string | null | undefined
  autoConnect?: boolean
}

export function useEnsureCanonicalBaseAccountWallet(params: EnsureCanonicalBaseAccountWalletParams) {
  const wallets = usePrivyWalletsFromContext()
  const { baseAccountSdk } = useBaseAccountSdk()
  const { connectBaseAccountWallet, error: setupError } = useSubAccountSetup()
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [providerAccounts, setProviderAccounts] = useState<string[] | null>(null)
  const autoAttemptedRef = useRef(false)

  const ready = isCanonicalBaseAccountWalletReady({
    wallets,
    canonicalCswAddress: params.canonicalCswAddress,
    providerAccounts,
  })

  const refreshProviderAccounts = useCallback(async (): Promise<string[]> => {
    const accounts = await readBaseAccountProviderAccounts(baseAccountSdk)
    setProviderAccounts(accounts)
    return accounts
  }, [baseAccountSdk])

  const link = useCallback(async (): Promise<boolean> => {
    setLinking(true)
    setLinkError(null)
    try {
      const accountsBefore = await refreshProviderAccounts()
      if (
        params.canonicalCswAddress &&
        isCanonicalBaseAccountWalletReady({
          wallets,
          canonicalCswAddress: params.canonicalCswAddress,
          providerAccounts: accountsBefore,
        })
      ) {
        return true
      }

      const connected = await connectBaseAccountWallet({
        canonicalCswAddress: params.canonicalCswAddress,
        requireEmbeddedEoa: false,
      })
      if (!connected) {
        setLinkError(
          setupError?.message ??
            'Could not link your Base Account wallet. Approve the connect prompt in Base App.',
        )
        return false
      }

      const accountsAfter = await refreshProviderAccounts()
      if (!params.canonicalCswAddress) {
        // CSW may appear on profile after wallet sync — caller should refresh /api/accounts/me.
        const hasBaseProvider =
          findBaseAccountWalletInList(wallets) != null || accountsAfter.length > 0
        if (!hasBaseProvider) {
          setLinkError('Approve the Base Account connect prompt, then try again.')
          return false
        }
        return true
      }

      if (
        !isCanonicalBaseAccountWalletReady({
          wallets,
          canonicalCswAddress: params.canonicalCswAddress,
          providerAccounts: accountsAfter,
        })
      ) {
        setLinkError(
          'Base App is still not connected as your canonical smart wallet. Sign out, then use Sign in with Base.',
        )
        return false
      }

      return true
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : 'Failed to link Base Account wallet.')
      return false
    } finally {
      setLinking(false)
    }
  }, [
    connectBaseAccountWallet,
    params.canonicalCswAddress,
    refreshProviderAccounts,
    setupError?.message,
    wallets,
  ])

  useEffect(() => {
    if (!params.enabled || !params.canonicalCswAddress) return
    void refreshProviderAccounts()
  }, [params.canonicalCswAddress, params.enabled, refreshProviderAccounts, wallets])

  useEffect(() => {
    if (!params.enabled || !params.autoConnect || ready || !params.canonicalCswAddress) return
    if (autoAttemptedRef.current) return
    autoAttemptedRef.current = true
    void link()
  }, [link, params.autoConnect, params.canonicalCswAddress, params.enabled, ready])

  return {
    ready,
    linking,
    linkError,
    link,
    refreshProviderAccounts,
    providerAccounts,
  }
}
