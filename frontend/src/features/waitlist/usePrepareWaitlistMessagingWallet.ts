import { useCallback, useEffect, useRef } from 'react'
import { useActiveWallet, useWallets } from '@privy-io/react-auth'
import { useAccount, useConnect, useDisconnect, useWalletClient } from 'wagmi'

import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'

import {
  isWaitlistMessagingWagmiConnector,
  prepareWaitlistMessagingWallet,
} from './prepareWaitlistMessagingWallet'

export function usePrepareWaitlistMessagingWallet(enabled: boolean) {
  const { embeddedEoaAddress, ensureEmbeddedWallet } = useEnsurePrivyEmbeddedWallet()
  const { wallets } = useWallets()
  const { setActiveWallet } = useActiveWallet()
  const { address, connector } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { connectAsync, connectors } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const autoPrepareRef = useRef(false)

  const messagingWalletReady = Boolean(
    address && walletClient && isWaitlistMessagingWagmiConnector(connector?.id),
  )

  const prepare = useCallback(async () => {
    return prepareWaitlistMessagingWallet({
      wallets: wallets as unknown[],
      embeddedEoaAddress,
      ensureEmbeddedWallet,
      setActiveWallet,
      connectAsync,
      connectors,
      disconnectAsync,
      activeConnectorId: connector?.id ?? null,
      messagingWalletReady,
    })
  }, [
    connectAsync,
    connector?.id,
    connectors,
    disconnectAsync,
    embeddedEoaAddress,
    ensureEmbeddedWallet,
    messagingWalletReady,
    setActiveWallet,
    wallets,
  ])

  useEffect(() => {
    if (!enabled || messagingWalletReady || autoPrepareRef.current) return
    autoPrepareRef.current = true
    void prepare().finally(() => {
      autoPrepareRef.current = false
    })
  }, [enabled, messagingWalletReady, prepare])

  return {
    prepare,
    walletReady: messagingWalletReady,
    embeddedEoaAddress,
  }
}
