import { useCallback, useMemo } from 'react'
import { useActiveWallet, usePrivy, useWallets } from '@privy-io/react-auth'
import { useConfig } from 'wagmi'
import { useAccount, useConnect, useDisconnect, useWalletClient } from 'wagmi'

import {
  extractPrivyWalletsFromUser,
  useEnsurePrivyEmbeddedWallet,
} from '@/lib/privy/embeddedWallet'

import {
  isWaitlistMessagingWagmiConnector,
  prepareWaitlistMessagingWallet,
} from './prepareWaitlistMessagingWallet'

function mergePrivyWalletRecords(primary: unknown[], secondary: unknown[]): unknown[] {
  const merged = [...primary, ...secondary]
  const seen = new Set<string>()
  const deduped: unknown[] = []
  for (const wallet of merged) {
    const record = wallet && typeof wallet === 'object' ? (wallet as Record<string, unknown>) : null
    const address = typeof record?.address === 'string' ? record.address.trim().toLowerCase() : ''
    const key = address || JSON.stringify(record ?? wallet)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(wallet)
  }
  return deduped
}

export function usePrepareWaitlistMessagingWallet(enabled: boolean) {
  const wagmiConfig = useConfig()
  const privy = usePrivy()
  const { embeddedEoaAddress, ensureEmbeddedWallet } = useEnsurePrivyEmbeddedWallet()
  const { wallets } = useWallets()
  const { setActiveWallet } = useActiveWallet()
  const { address, connector } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { connectAsync, connectors } = useConnect()
  const { disconnectAsync } = useDisconnect()

  const mergedWallets = useMemo(
    () => mergePrivyWalletRecords(wallets as unknown[], extractPrivyWalletsFromUser(privy.user)),
    [privy.user, wallets],
  )

  const messagingWalletReady = Boolean(
    address && walletClient && isWaitlistMessagingWagmiConnector(connector?.id),
  )

  const prepare = useCallback(async () => {
    if (!enabled) {
      return { ok: false as const, error: 'Messaging setup is unavailable on this screen.' }
    }
    return prepareWaitlistMessagingWallet({
      wallets: mergedWallets,
      embeddedEoaAddress,
      ensureEmbeddedWallet,
      setActiveWallet,
      connectAsync,
      connectors,
      disconnectAsync,
      activeConnectorId: connector?.id ?? null,
      messagingWalletReady,
      wagmiConfig,
    })
  }, [
    connectAsync,
    connector?.id,
    connectors,
    disconnectAsync,
    embeddedEoaAddress,
    enabled,
    ensureEmbeddedWallet,
    mergedWallets,
    messagingWalletReady,
    setActiveWallet,
    wagmiConfig,
  ])

  return {
    prepare,
    walletReady: messagingWalletReady,
    embeddedEoaAddress,
    privyAuthenticated: Boolean(privy.authenticated),
  }
}
