import type { WaitlistChatExecutionTrack } from './useWaitlistXmtpStatus'

export type WaitlistChatStatus =
  | 'idle'
  | 'awaiting_messaging'
  | 'joining'
  | 'pending'
  | 'executing'
  | 'executed'
  | 'failed'
  | 'blocked'
  | 'config'
  | 'error'

export type WaitlistJoinActionStatus = 'pending' | 'executing' | 'executed' | 'failed' | 'retry' | null

export function mapJoinActionStatus(status: WaitlistJoinActionStatus): WaitlistChatStatus | null {
  switch (status) {
    case 'pending':
    case 'retry':
      return 'pending'
    case 'executing':
      return 'executing'
    case 'executed':
      return 'executed'
    case 'failed':
      return 'failed'
    default:
      return null
  }
}

export function waitlistChatBlockedMessage(params: {
  executionTrack?: WaitlistChatExecutionTrack | null
  joinBlockedReason?: string | null
}): string {
  if (params.joinBlockedReason === 'service_unavailable') {
    return 'Waitlist chat status is temporarily unavailable. Retry in a moment.'
  }
  if (params.joinBlockedReason === 'sub_account_not_registered') {
    return 'Connect Base App and finish app-wallet setup to join waitlist chat.'
  }
  if (params.executionTrack === 'sub-account') {
    return 'Connect messaging with your 4626 app wallet to join waitlist chat.'
  }
  return 'Enable 4626 signing to join waitlist chat.'
}

export function waitlistChatStatusMessage(status: WaitlistChatStatus): string {
  switch (status) {
    case 'awaiting_messaging':
      return 'Connect messaging first so your waitlist inbox exists, then we can add you to the group.'
    case 'joining':
      return 'Adding your wallet to waitlist chat…'
    case 'pending':
      return 'Adding you to the waitlist group…'
    case 'executing':
      return 'Finalizing your waitlist group membership…'
    case 'executed':
      return 'You were added. Pulling the group into this browser — this usually takes a few seconds.'
    case 'failed':
      return 'Could not add you to waitlist chat yet. Refresh and try Connect messaging again.'
    case 'blocked':
      return 'Finish wallet setup to join waitlist chat.'
    case 'config':
      return 'Waitlist chat is not configured yet. Ask an admin to set the waitlist XMTP group.'
    case 'error':
      return 'Chat join is temporarily unavailable. Refresh the page to retry.'
    default:
      return 'Waiting to join waitlist chat.'
  }
}

export function isTerminalWaitlistJoinStatus(status: WaitlistChatStatus): boolean {
  return (
    status === 'executed' ||
    status === 'failed' ||
    status === 'blocked' ||
    status === 'config' ||
    status === 'error'
  )
}

export function shouldRetryWaitlistJoin(status: WaitlistChatStatus): boolean {
  return (
    status === 'idle' ||
    status === 'awaiting_messaging' ||
    status === 'failed' ||
    status === 'error'
  )
}
