import type { XmtpStatus } from '@/lib/xmtp/provider'

import type { WaitlistChatStatus } from './waitlistChatCopy'
import { waitlistChatStatusMessage } from './waitlistChatCopy'

export type WaitlistXmtpPhase =
  | 'blocked_signing'
  | 'loading_status'
  | 'status_error'
  | 'not_configured'
  | 'service_unavailable'
  | 'local_reset_required'
  | 'connect_prompt'
  | 'connecting'
  | 'join_in_progress'
  | 'group_syncing'
  | 'chat_ready'
  | 'connect_error'

export function deriveWaitlistXmtpPhase(input: {
  signingReady: boolean
  statusLoading: boolean
  statusError: boolean
  configured: boolean
  serviceUnavailable: boolean
  chatReady: boolean
  localStateResetRequired: boolean
  xmtpStatus: XmtpStatus
  joinStatus: WaitlistChatStatus
  hasGroupConversation: boolean
  syncTimedOut: boolean
  needsConnectMessaging: boolean
  prepareError: string | null
  xmtpError: string | null
}): WaitlistXmtpPhase {
  if (!input.signingReady) return 'blocked_signing'
  if (input.statusLoading) return 'loading_status'
  if (input.statusError) return 'status_error'
  if (!input.configured) return 'not_configured'
  if (input.serviceUnavailable) return 'service_unavailable'
  if (input.localStateResetRequired) return 'local_reset_required'
  if (input.hasGroupConversation) return 'chat_ready'
  if (
    input.joinStatus === 'executed' &&
    (input.xmtpStatus === 'connected' || input.syncTimedOut)
  ) {
    return 'group_syncing'
  }
  if (
    input.joinStatus === 'joining' ||
    input.joinStatus === 'pending' ||
    input.joinStatus === 'executing'
  ) {
    return 'join_in_progress'
  }
  if (input.needsConnectMessaging || input.xmtpStatus === 'error') {
    if (input.prepareError || input.xmtpError) return 'connect_error'
    return 'connect_prompt'
  }
  if (input.xmtpStatus === 'signing' || input.xmtpStatus === 'connecting') {
    return 'connecting'
  }
  if (input.xmtpStatus === 'connected' && input.joinStatus === 'awaiting_messaging') {
    return 'connect_prompt'
  }
  return 'connect_prompt'
}

export function waitlistXmtpPhaseMessage(
  phase: WaitlistXmtpPhase,
  context: {
    joinStatus: WaitlistChatStatus
    walletReady: boolean
    error: string | null
    syncTimedOut: boolean
  },
): string {
  switch (phase) {
    case 'blocked_signing':
      return 'Enable 4626 signing to unlock waitlist chat.'
    case 'loading_status':
      return 'Loading waitlist chat…'
    case 'status_error':
      return 'Could not load waitlist chat status. Retry in a moment.'
    case 'not_configured':
      return 'Waitlist chat is not configured yet. Ask an admin to set the waitlist XMTP group.'
    case 'service_unavailable':
      return 'Waitlist chat status is temporarily unavailable. Retry loading status.'
    case 'local_reset_required':
      return 'This browser’s XMTP cache no longer validates. Reset local messaging state to reconnect.'
    case 'connect_prompt':
      return context.walletReady
        ? 'One tap connects messaging and adds you to the waitlist group.'
        : 'Connect messaging to create your inbox, then we add you to the waitlist group.'
    case 'connecting':
      return 'Connecting to XMTP…'
    case 'join_in_progress':
      return waitlistChatStatusMessage(context.joinStatus)
    case 'group_syncing':
      return context.syncTimedOut
        ? 'Waitlist chat is still syncing in this browser.'
        : 'Pulling waitlist chat into this browser…'
    case 'chat_ready':
      return ''
    case 'connect_error':
      return context.error ?? 'Could not connect messaging. Try again.'
    default:
      return 'Waiting for waitlist chat.'
  }
}

export const WAITLIST_CHAT_SHELL_MIN_HEIGHT_PX = 320
