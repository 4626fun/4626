import { useCallback, useEffect, useRef } from 'react'
import { useActiveWallet, useWallets } from '@privy-io/react-auth'
import { useAccount, useConnect, useReconnect, useWalletClient } from 'wagmi'

import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'

import { prepareWaitlistMessagingWallet } from './prepareWaitlistMessagingWallet'

export function usePrepareWaitlistMessagingWallet(enabled: boolean) {
  const { embeddedEoaAddress, ensureEmbeddedWallet } = useEnsurePrivyEmbeddedWallet()
  const { wallets } = useWallets()
  const { setActiveWallet } = useActiveWallet()
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { connectAsync, connectors } = useConnect()
  const { reconnectAsync } = useReconnect()
  const autoPrepareRef = useRef(false)

  const hasWagmiWallet = Boolean(address && walletClient)

  const prepare = useCallback(async () => {
    return prepareWaitlistMessagingWallet({
      wallets: wallets as unknown[],
      embeddedEoaAddress,
      ensureEmbeddedWallet,
      setActiveWallet,
      connectAsync,
      connectors,
      reconnectAsync,
      hasWagmiWallet,
    })
  }, [
    connectAsync,
    connectors,
    embeddedEoaAddress,
    ensureEmbeddedWallet,
    hasWagmiWallet,
    reconnectAsync,
    setActiveWallet,
    wallets,
  ])

  useEffect(() => {
    if (!enabled || hasWagmiWallet || autoPrepareRef.current) return
    autoPrepareRef.current = true
    void prepare().finally(() => {
      autoPrepareRef.current = false
    })
  }, [enabled, hasWagmiWallet, prepare])

  return {
    prepare,
    walletReady: hasWagmiWallet,
    embeddedEoaAddress,
  }
}
