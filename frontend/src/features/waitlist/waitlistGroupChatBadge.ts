import type { WaitlistChatStatus } from './waitlistChatCopy'

export type WaitlistChatBadge = {
  label: string
  tone: 'ready' | 'progress' | 'error'
}

/** Badge reflects local chat readiness first — never "Added" while the group is still missing locally. */
export function deriveWaitlistChatBadge(input: {
  chatReady: boolean
  hasGroupConversation: boolean
  joinStatus: WaitlistChatStatus
}): WaitlistChatBadge | null {
  const { chatReady, hasGroupConversation, joinStatus } = input
  if (!chatReady) return null

  if (hasGroupConversation) {
    return { label: 'In chat', tone: 'ready' }
  }

  if (joinStatus === 'failed' || joinStatus === 'error') {
    return { label: 'Join failed', tone: 'error' }
  }

  if (
    joinStatus === 'joining' ||
    joinStatus === 'pending' ||
    joinStatus === 'executing'
  ) {
    return { label: 'Joining…', tone: 'progress' }
  }

  if (joinStatus === 'executed') {
    return { label: 'Syncing…', tone: 'progress' }
  }

  if (joinStatus === 'awaiting_messaging' || joinStatus === 'idle') {
    return null
  }

  return null
}

export function waitlistChatBadgeClassName(tone: WaitlistChatBadge['tone']): string {
  switch (tone) {
    case 'ready':
      return 'bg-emerald-500/12 text-emerald-200'
    case 'error':
      return 'bg-red-500/12 text-red-200'
    case 'progress':
      return 'bg-brand-primary/12 text-brand-primary'
    default:
      return 'bg-zinc-500/12 text-zinc-300'
  }
}
