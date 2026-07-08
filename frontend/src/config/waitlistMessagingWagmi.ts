import { createConfig, createStorage, fallback, http, type Config } from 'wagmi'
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

const waitlistMessagingConfigCache = new Map<WaitlistConnectTrack, Config>()

/**
 * In-memory (non-persistent) storage for the waitlist-messaging wagmi config.
 * Deliberately not `localStorage` — this config is route-scoped to
 * `4626.fun/waitlist` and must not read/write connection state shared with
 * the main app's wagmi config or persist across full page reloads. A plain
 * object-backed store (rather than wagmi's `noopStorage`) still lets wagmi's
 * in-session state read back what it wrote within the same page load, which
 * `noopStorage` silently drops; the config itself is already cached per
 * `connectTrack` (see `waitlistMessagingConfigCache`), so this only matters
 * if wagmi internals ever read through `storage` mid-session instead of the
 * live in-memory account store.
 */
function createInMemoryWaitlistMessagingStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
  }
}

/**
 * Route-scoped wagmi config for waitlist XMTP messaging only.
 *
 * Email/Zora tracks use no eager connectors — the embedded EOA is wired via a
 * synthetic injected connector at connect time (see prepareWaitlistMessagingWallet).
 * Base App direct is the only track that mounts Coinbase Wallet SDK connectors.
 *
 * `ssr: true` keeps wagmi Hydrate from calling `onMount()` synchronously during
 * render (which force-rerenders hook consumers and triggers React warnings).
 * `reconnectOnMount: false` (set by the WagmiProvider consumer, not here) means
 * nothing is ever auto-restored from `storage` on a fresh page load — but an
 * in-memory (non-persistent, non-`localStorage`) store still lets wagmi read
 * back what it wrote earlier in the *same* page session, which the previous
 * `noopStorage` silently dropped. Configs are cached per connectTrack so
 * remounts/HMR reuse the same object instead of re-running hydrate() or losing
 * the live connection.
 */
export function createWaitlistMessagingWagmiConfig(connectTrack: WaitlistConnectTrack): Config {
  const cached = waitlistMessagingConfigCache.get(connectTrack)
  if (cached) return cached

  const connectors =
    connectTrack === 'base-app-direct'
      ? [
          coinbaseWallet({
            appName: '4626',
            preference: 'smartWalletOnly',
          }),
        ]
      : []

  const config = createConfig({
    chains: [base],
    connectors,
    multiInjectedProviderDiscovery: false,
    storage: createStorage({ storage: createInMemoryWaitlistMessagingStorage() }),
    ssr: true,
    transports: {
      [base.id]:
        BASE_READ_RPC_URLS.length > 0
          ? fallback(BASE_READ_RPC_URLS.map(buildBaseReadTransport))
          : http(),
    },
  })

  waitlistMessagingConfigCache.set(connectTrack, config)
  return config
}
