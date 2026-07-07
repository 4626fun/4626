import { useCallback, useMemo } from 'react'
import { useActiveWallet, usePrivy, useWallets } from '@privy-io/react-auth'
import { useAccount, useConfig, useConnect, useDisconnect, useWalletClient } from 'wagmi'

import {
  extractPrivyWalletsFromUser,
  useEnsurePrivyEmbeddedWallet,
} from '@/lib/privy/embeddedWallet'

import {
  isWaitlistMessagingWagmiConnector,
  prepareWaitlistMessagingWallet,
  type PrepareWaitlistMessagingWalletInput,
} from './prepareWaitlistMessagingWallet'
import type { WaitlistConnectTrack } from './waitlistFlowState'

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

function normalizeAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^0x[a-f0-9]{40}$/.test(raw) ? raw : null
}

function isCoinbaseMessagingConnectorId(connectorId: string | null | undefined): boolean {
  const id = String(connectorId ?? '').trim().toLowerCase()
  return id.includes('coinbase')
}

export function usePrepareWaitlistMessagingWallet(params: {
  enabled: boolean
  connectTrack: WaitlistConnectTrack
  canonicalCswAddress?: string | null
}) {
  const privy = usePrivy()
  const wagmiConfig = useConfig()
  const { embeddedEoaAddress, ensureEmbeddedWallet } = useEnsurePrivyEmbeddedWallet()
  const { wallets } = useWallets()
  const { setActiveWallet } = useActiveWallet()
  const getToken = useCallback(
    () =>
      (typeof privy.getAccessToken === 'function' ? privy.getAccessToken() : Promise.resolve(null)).catch(
        () => null,
      ),
    [privy],
  )
  const { address, connector } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { connectAsync, connectors } = useConnect()
  const { disconnectAsync } = useDisconnect()

  const mergedWallets = useMemo(
    () => mergePrivyWalletRecords(wallets as unknown[], extractPrivyWalletsFromUser(privy.user)),
    [privy.user, wallets],
  )

  const expectedCanonical = normalizeAddress(params.canonicalCswAddress)
  const connectedAddress = normalizeAddress(address)

  const messagingWalletReady =
    params.connectTrack === 'base-app-direct'
      ? Boolean(
          connectedAddress &&
            walletClient &&
            expectedCanonical &&
            connectedAddress === expectedCanonical &&
            isCoinbaseMessagingConnectorId(connector?.id),
        )
      : Boolean(address && walletClient && isWaitlistMessagingWagmiConnector(connector?.id))

  const prepare = useCallback(async () => {
    if (!params.enabled) {
      return { ok: false as const, error: 'Messaging setup is unavailable on this screen.' }
    }
    return prepareWaitlistMessagingWallet({
      wallets: mergedWallets,
      embeddedEoaAddress,
      ensureEmbeddedWallet,
      setActiveWallet: setActiveWallet as PrepareWaitlistMessagingWalletInput['setActiveWallet'],
      getToken,
      connectAsync: connectAsync as PrepareWaitlistMessagingWalletInput['connectAsync'],
      connectors,
      disconnectAsync,
      activeConnectorId: connector?.id ?? null,
      messagingWalletReady,
      wagmiConfig,
      connectTrack: params.connectTrack,
      canonicalCswAddress: params.canonicalCswAddress ?? null,
    })
  }, [
    connectAsync,
    connector?.id,
    connectors,
    disconnectAsync,
    embeddedEoaAddress,
    ensureEmbeddedWallet,
    getToken,
    mergedWallets,
    messagingWalletReady,
    params.canonicalCswAddress,
    params.connectTrack,
    params.enabled,
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
