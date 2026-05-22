import { createClient, MAINNET_RELAY_API } from '@relayprotocol/relay-sdk'
import type { paths } from '@relayprotocol/relay-sdk'
import { base as baseChain } from 'viem/chains'

import { NATIVE_CURRENCY_ADDRESS } from '@/lib/wallet/cswOwnerAbi'
import { encodeExecuteWithoutChainIdValidation } from '@/lib/wallet/onboardingWalletReplayable'

export type RelayQuoteBody = paths['/quote/v2']['post']['requestBody']['content']['application/json']

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

/** Relay Settlement client scoped to Base mainnet owner-mutation flows. */
export function createOwnerMutationRelayClient(source: string) {
  return createClient({
    baseApiUrl: MAINNET_RELAY_API,
    source,
    chains: [RELAY_BASE_CHAIN],
  })
}

export type BuildOwnerMutationQuoteOptionsParams = {
  /** EOA that pays the Relay deposit transaction (`user` in /quote/v2). */
  funderAddress: `0x${string}`
  /** Canonical CSW that receives the executed mutation (`recipient`). */
  cswAddress: `0x${string}`
  /** Raw CSW mutation calldata (addOwnerAddress / removeOwnerAtIndex). */
  mutationCalldata: `0x${string}`
  /** Decimal-string wei amount from preview `paymentDetails.amount` or `userCall.value`. */
  depositAmountWei: string
  /** Defaults true — matches remove-owner and Relay solver sponsorship expectations. */
  subsidizeFees?: boolean
}

/**
 * Canonical /quote/v2 body for CSW owner mutations on Base.
 * Matches relay-kit + Privy wallet example patterns with owner-mutation-specific fields.
 */
export function buildOwnerMutationQuoteOptions(
  params: BuildOwnerMutationQuoteOptionsParams,
): RelayQuoteBody {
  return {
    user: params.funderAddress,
    recipient: params.cswAddress,
    originChainId: baseChain.id,
    destinationChainId: baseChain.id,
    originCurrency: NATIVE_CURRENCY_ADDRESS,
    destinationCurrency: NATIVE_CURRENCY_ADDRESS,
    tradeType: 'EXACT_OUTPUT',
    amount: params.depositAmountWei,
    originGasOverhead: 300_000,
    subsidizeFees: params.subsidizeFees ?? true,
    txs: [
      {
        to: params.cswAddress,
        data: encodeExecuteWithoutChainIdValidation(params.mutationCalldata),
        value: '0',
      },
    ],
  }
}
