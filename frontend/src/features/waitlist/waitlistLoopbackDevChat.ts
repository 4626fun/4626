import { getAppBaseUrl } from '@/lib/env/host'

import { isWaitlistMessagingLoopbackHost } from './prepareWaitlistMessagingWallet'

/** Deep-link that mounts app-shell chat on /swap (see useChatActivation + ChatWidget). */
export function buildLoopbackAppChatHref(): string {
  const base = getAppBaseUrl().replace(/\/+$/, '')
  return `${base}/swap?chatAction=help`
}

export function shouldShowLoopbackAppChatShortcut(): boolean {
  return isWaitlistMessagingLoopbackHost()
}
