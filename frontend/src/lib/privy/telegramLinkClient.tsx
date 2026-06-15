import type { ReactNode } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'

import { getPrivyApiUrl, getPrivyAppId, getPrivyClientId, isPrivyClientEnabled } from '@/lib/flags/flags'
import { CONFIGURED_APP_ORIGIN, resolveAuthRedirectOrigin } from '@/lib/env/host'

type PrivyProviderConfig = Parameters<typeof PrivyProvider>[0]['config']
type DefinedPrivyProviderConfig = NonNullable<PrivyProviderConfig>

type TelegramLinkPrivyProviderProps = {
  children: ReactNode
}

const TELEGRAM_LINK_APPEARANCE = {
  showWalletLoginFirst: false,
  walletChainType: 'ethereum-only',
  walletList: ['coinbase_wallet'],
  landingHeader: 'Verify email for 4626',
  loginMessage: 'Verify your email inline, then attach Telegram to the canonical 4626 account.',
  theme: '#0f1117',
} satisfies NonNullable<DefinedPrivyProviderConfig['appearance']>

export function TelegramLinkPrivyProvider(props: TelegramLinkPrivyProviderProps) {
  const { children } = props

  if (!isPrivyClientEnabled()) return <>{children}</>

  const appId = getPrivyAppId()
  if (!appId) return <>{children}</>

  const clientId = getPrivyClientId()
  const apiUrl = getPrivyApiUrl()
  const customOAuthRedirectUrl =
    typeof window !== 'undefined'
      ? resolveAuthRedirectOrigin({
          configuredOrigin: CONFIGURED_APP_ORIGIN,
          currentOrigin: window.location.origin,
        })
      : null

  const config: PrivyProviderConfig = {
    appearance: TELEGRAM_LINK_APPEARANCE,
    ...(customOAuthRedirectUrl ? { customOAuthRedirectUrl } : null),
    loginMethods: ['email'],
    embeddedWallets: {
      ethereum: {
        createOnLogin: 'all-users',
      },
    },
  }

  return (
    <PrivyProvider appId={appId} {...(clientId ? { clientId } : null)} {...(apiUrl ? ({ apiUrl } as any) : null)} config={config}>
      {children}
    </PrivyProvider>
  )
}
