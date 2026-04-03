import type { ReactNode } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'

import { getPrivyAppId, getPrivyClientId, isPrivyClientEnabled } from '@/lib/flags'

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
  const customOAuthRedirectUrl = typeof window !== 'undefined' ? window.location.origin : null

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
    <PrivyProvider appId={appId} {...(clientId ? { clientId } : null)} config={config}>
      {children}
    </PrivyProvider>
  )
}
