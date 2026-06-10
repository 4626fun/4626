export function formatWaitlistChatJoinError(
  raw: string | null | undefined,
  status: 'pending' | 'executing' | 'executed' | 'failed' | 'retry' | null,
): string | null {
  if (status === 'executed') return null
  if (!raw) return null
  const message = raw.trim()
  if (!message) return null
  if (message.includes('PRIVY_WALLET_AUTHORIZATION_KEY')) {
    return 'Waitlist chat join is still processing. Try refresh in a moment.'
  }
  return message
}
