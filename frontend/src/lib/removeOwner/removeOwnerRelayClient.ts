import { createClient, MAINNET_RELAY_API } from '@relayprotocol/relay-sdk'
import { base as baseChain } from 'viem/chains'

import { NATIVE_CURRENCY_ADDRESS } from '@/lib/wallet/cswOwnerAbi'

const RELAY_BASE_CHAIN = {
  id: baseChain.id,
  name: 'base',
  displayName: 'Base',
  httpRpcUrl: baseChain.rpcUrls.default.http[0] ?? 'https://mainnet.base.org',
  wsRpcUrl:
    ((((baseChain as unknown as { rpcUrls?: { default?: { webSocket?: string[] } } }).rpcUrls?.default
      ?.webSocket?.[0] as string | undefined) ??
      '')),
  icon: {
    dark: `https://assets.relay.link/icons/${baseChain.id}/dark.png`,
    light: `https://assets.relay.link/icons/${baseChain.id}/light.png`,
    squaredDark: `https://assets.relay.link/icons/square/${baseChain.id}/dark.png`,
    squaredLight: `https://assets.relay.link/icons/square/${baseChain.id}/light.png`,
  },
  currency: {
    address: NATIVE_CURRENCY_ADDRESS,
    name: baseChain.nativeCurrency.name,
    symbol: baseChain.nativeCurrency.symbol,
    decimals: baseChain.nativeCurrency.decimals,
  },
  explorerUrl: baseChain.blockExplorers?.default.url ?? 'https://basescan.org',
  vmType: 'evm' as const,
  depositEnabled: true,
  viemChain: baseChain,
}

export function createRemoveOwnerRelayClient() {
  return createClient({
    baseApiUrl: MAINNET_RELAY_API,
    source: '4626-remove-owner',
    chains: [RELAY_BASE_CHAIN],
  })
}
