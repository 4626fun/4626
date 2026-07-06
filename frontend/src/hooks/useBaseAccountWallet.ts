import { useCallback, useRef } from 'react'
import { useConnectWallet, useActiveWallet, usePrivy } from '@privy-io/react-auth'

import { usePrivyWalletsFromContext } from '@/lib/privy/walletHooksContext'
import {
  connectBaseAccountWalletWithPrivy,
  disconnectBaseAccountWalletWithPrivy,
  type BaseAccountWalletLike,
} from '@/lib/wallet/baseAccountWallet'

export function useBaseAccountWallet() {
  const wallets = usePrivyWalletsFromContext()
  const { connectWallet } = useConnectWallet()
  const { setActiveWallet } = useActiveWallet()
  const { disconnect: privyDisconnect } = usePrivy() as { disconnect?: (wallet: unknown) => Promise<void> }
  const connectedWalletRef = useRef<BaseAccountWalletLike | null>(null)

  const connectBaseAccountWallet = useCallback(
    async (opts?: { canonicalCswAddress?: string | null; description?: string }): Promise<boolean> => {
      const result = await connectBaseAccountWalletWithPrivy(
        {
          wallets,
          connectWallet,
          setActiveWallet,
          connectedWalletRef,
        },
        opts,
      )
      return result.ok
    },
    [connectWallet, setActiveWallet, wallets],
  )

  const disconnectBaseAccountWallet = useCallback(async (): Promise<boolean> => {
    connectedWalletRef.current = null
    return disconnectBaseAccountWalletWithPrivy(wallets, privyDisconnect)
  }, [privyDisconnect, wallets])

  return {
    connectBaseAccountWallet,
    disconnectBaseAccountWallet,
    connectedWalletRef,
  }
}
