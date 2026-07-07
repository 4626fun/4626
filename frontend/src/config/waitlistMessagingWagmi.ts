import { createConfig, fallback, http, type Config } from 'wagmi'
import { base } from 'viem/chains'
import { coinbaseWallet } from 'wagmi/connectors'

import {
  BASE_RPC_PROXY_PATH,
  BROWSER_BASE_PUBLIC_RPC_FALLBACK,
  buildSameOriginRpcProxyTransport,
  isBrowserRestrictedBaseRpc,
} from '@/lib/base/baseReadRpcPolicy'

import type { WaitlistConnectTrack } from '@/features/waitlist/waitlistFlowState'

const IS_BROWSER = typeof window !== 'undefined'

function buildBaseReadTransport(url: string) {
  const normalized = String(url || '').trim()
  if (normalized.startsWith('/api/rpc?chain=')) {
    return buildSameOriginRpcProxyTransport(normalized)
  }
  return http(normalized)
}

const BASE_READ_RPC_URLS = [
  ...(IS_BROWSER ? [BASE_RPC_PROXY_PATH, BROWSER_BASE_PUBLIC_RPC_FALLBACK] : ['https://mainnet.base.org']),
].filter((url) => !(IS_BROWSER && isBrowserRestrictedBaseRpc(url)))

/**
 * Route-scoped wagmi config for waitlist XMTP messaging only.
 *
 * Email/Zora tracks use no eager connectors — the embedded EOA is wired via a
 * synthetic injected connector at connect time (see prepareWaitlistMessagingWallet).
 * Base App direct is the only track that mounts Coinbase Wallet SDK connectors.
 */
export function createWaitlistMessagingWagmiConfig(connectTrack: WaitlistConnectTrack): Config {
  const connectors =
    connectTrack === 'base-app-direct'
      ? [
          coinbaseWallet({
            appName: '4626',
            preference: 'smartWalletOnly',
          }),
        ]
      : []

  return createConfig({
    chains: [base],
    connectors,
    multiInjectedProviderDiscovery: false,
    transports: {
      [base.id]:
        BASE_READ_RPC_URLS.length > 0
          ? fallback(BASE_READ_RPC_URLS.map(buildBaseReadTransport))
          : http(),
    },
  })
}
