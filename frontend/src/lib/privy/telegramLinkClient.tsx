import type { ReactNode } from 'react'

import { PrivyClientProvider } from './client'

type TelegramLinkPrivyProviderProps = {
  children: ReactNode
}

/**
 * Telegram Mini App link entry — thin wrapper over the shared PrivyClientProvider
 * with `mode="telegram-link"` (email-only login + createOnLogin embedded wallets).
 */
export function TelegramLinkPrivyProvider(props: TelegramLinkPrivyProviderProps) {
  return <PrivyClientProvider mode="telegram-link">{props.children}</PrivyClientProvider>
}
