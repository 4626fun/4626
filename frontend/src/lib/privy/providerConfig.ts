import { PrivyProvider } from '@privy-io/react-auth'
import { base } from 'viem/chains'

import { canUsePrivyEmbeddedWallets } from '@/lib/flags/flags'
import { resolveWaitlistPrivyOAuthRedirectUrl } from '@/lib/env/waitlistOAuthRedirect'
import { CONFIGURED_APP_ORIGIN, resolveAuthRedirectOrigin } from '@/lib/env/host'
import {
  createPrivyAppearance,
  WAITLIST_WALLET_JOINED_LOGIN_LIST,
} from './clientAppearance'

/**
 * Named Privy provider modes.
 *
 * | Mode | Surface | Embedded wallets |
 * |------|---------|------------------|
 * | `default` | App shell | users-without-wallets (secure context) |
 * | `waitlist` | Marketing waitlist signup + explicit wallet linking | off |
 * | `telegram-link` | Telegram Mini App link entry | off (server-owned ensure) |
 */
export type PrivyClientMode =
  | 'default'
  | 'waitlist'
  | 'telegram-link'

export const ZORA_PRIVY_APP_ID = 'clpgf04wn04hnkw0fv1m11mnb'
export const PRIVY_CANONICAL_API_URL = 'https://auth.privy.io'

export function resolvePrivyProviderApiUrl(params: {
  configuredApiUrl: string | null
  bypassCustomPrivyDomain: boolean
}): string | null {
  if (params.bypassCustomPrivyDomain) return PRIVY_CANONICAL_API_URL
  return params.configuredApiUrl
}

/** Waitlist routes must not inherit dashboard embedded-wallet defaults (privy.4626.fun iframe → server-cookie mode). */
export const WAITLIST_EMBEDDED_WALLETS_OFF = {
  ethereum: { createOnLogin: 'off' as const },
  solana: { createOnLogin: 'off' as const },
  showWalletUIs: false,
}

export const TELEGRAM_LINK_APPEARANCE = {
  showWalletLoginFirst: false,
  walletChainType: 'ethereum-only' as const,
  walletList: ['coinbase_wallet'] as const,
  landingHeader: 'Verify email for 4626',
  loginMessage: 'Verify your email inline, then attach Telegram to the canonical 4626 account.',
  theme: '#0f1117',
}

type PrivyProviderConfig = Parameters<typeof PrivyProvider>[0]['config']

export function isWaitlistPrivyMode(mode: PrivyClientMode): boolean {
  return mode === 'waitlist'
}

function isLoopbackHostname(hostname: string): boolean {
  const h = String(hostname || '').trim().toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]'
}

export function coerceLoopbackAuthRedirectOrigin(input: {
  resolvedOrigin: string
  currentOrigin: string
}): string {
  try {
    const resolved = new URL(input.resolvedOrigin)
    const current = new URL(input.currentOrigin)
    if (!isLoopbackHostname(current.hostname)) return input.resolvedOrigin
    if (!isLoopbackHostname(resolved.hostname)) return current.origin
    if (resolved.port !== current.port) return current.origin
    return input.resolvedOrigin
  } catch {
    return input.currentOrigin
  }
}

export function resolvePrivyLoginMethods(mode: PrivyClientMode): readonly string[] {
  if (mode === 'waitlist') return ['email', 'wallet', 'twitter']
  if (mode === 'telegram-link') return ['email']
  return ['email', 'wallet']
}

export function resolvePrivyEmbeddedWallets(mode: PrivyClientMode) {
  if (isWaitlistPrivyMode(mode)) return WAITLIST_EMBEDDED_WALLETS_OFF
  if (!canUsePrivyEmbeddedWallets()) return undefined
  if (mode === 'telegram-link') return WAITLIST_EMBEDDED_WALLETS_OFF
  return {
    ethereum: { createOnLogin: 'users-without-wallets' as const },
    solana: { createOnLogin: 'users-without-wallets' as const },
  }
}

export function resolvePrivyCustomOAuthRedirectUrl(mode: PrivyClientMode): string | null {
  if (typeof window === 'undefined') return null
  if (mode === 'waitlist') {
    return resolveWaitlistPrivyOAuthRedirectUrl(window.location.origin)
  }
  return coerceLoopbackAuthRedirectOrigin({
    resolvedOrigin: resolveAuthRedirectOrigin({
      configuredOrigin: CONFIGURED_APP_ORIGIN,
      currentOrigin: window.location.origin,
    }),
    currentOrigin: window.location.origin,
  })
}

export function resolvePrivyAppearance(params: {
  mode: PrivyClientMode
  showWalletLoginFirst?: boolean
  walletList?: readonly string[]
  walletChainType?: 'ethereum-only' | 'solana-only' | 'ethereum-and-solana'
}) {
  const { mode, showWalletLoginFirst = false, walletList, walletChainType } = params
  if (mode === 'telegram-link') {
    return {
      ...TELEGRAM_LINK_APPEARANCE,
      ...(walletList ? { walletList } : null),
      ...(walletChainType ? { walletChainType } : null),
    }
  }
  return createPrivyAppearance({
    showWalletLoginFirst,
    ...(walletList
      ? { walletList }
      : mode === 'waitlist'
        ? { walletList: WAITLIST_WALLET_JOINED_LOGIN_LIST }
        : null),
    ...(walletChainType ? { walletChainType } : null),
  })
}

export function buildPrivyExternalWallets(params: {
  mode: PrivyClientMode
  solanaConnectors: { onMount: () => void; onUnmount: () => void; get: () => unknown[] }
}) {
  const { mode, solanaConnectors } = params
  const sharedWalletConnectors = {
    walletConnect: { enabled: true },
    coinbaseWallet: { connectionOptions: 'all' as const },
    solana: { connectors: solanaConnectors },
  }

  if (mode === 'telegram-link') {
    return {
      solana: { connectors: solanaConnectors },
    }
  }

  if (mode === 'waitlist') {
    return {
      walletConnect: { enabled: true },
      coinbaseWallet: { connectionOptions: 'all' as const },
      solana: { connectors: solanaConnectors },
      crossApp: {
        providerAppIds: [ZORA_PRIVY_APP_ID],
      },
    }
  }

  return {
    ...sharedWalletConnectors,
    crossApp: {
      providerAppIds: [ZORA_PRIVY_APP_ID],
    },
  }
}

export function buildPrivyProviderConfigs(params: {
  mode: PrivyClientMode
  showWalletLoginFirst?: boolean
  walletList?: readonly string[]
  walletChainType?: 'ethereum-only' | 'solana-only' | 'ethereum-and-solana'
  externalWallets: ReturnType<typeof buildPrivyExternalWallets>
}): { baseConfig: PrivyProviderConfig; safeConfig: PrivyProviderConfig } {
  const appearance = resolvePrivyAppearance(params)
  const loginMethods = resolvePrivyLoginMethods(params.mode)
  const embeddedWallets = resolvePrivyEmbeddedWallets(params.mode)
  const customOAuthRedirectUrl = resolvePrivyCustomOAuthRedirectUrl(params.mode)

  const baseConfig = {
    appearance,
    ...(customOAuthRedirectUrl ? { customOAuthRedirectUrl } : {}),
    ...(embeddedWallets ? { embeddedWallets } : {}),
    loginMethods,
    defaultChain: base,
    supportedChains: [base],
    externalWallets: params.externalWallets,
  } as unknown as PrivyProviderConfig

  const safeConfig = {
    appearance,
    ...(customOAuthRedirectUrl ? { customOAuthRedirectUrl } : {}),
    // Intentionally omit `embeddedWallets` so HTTP/insecure dev origins don't crash the app.
    loginMethods,
    defaultChain: base,
    supportedChains: [base],
    externalWallets: params.externalWallets,
  } as unknown as PrivyProviderConfig

  return { baseConfig, safeConfig }
}
