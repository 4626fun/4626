export function formatWaitlistChatError(raw: string | null | undefined): string | null {
  if (!raw) return null
  const message = raw.trim()
  if (!message) return null
  if (message.includes('PRIVY_WALLET_AUTHORIZATION_KEY')) {
    return 'Waitlist chat is still syncing. Try refresh in a moment.'
  }
  if (message === 'waitlist_chat_not_configured' || message === 'waitlist_chat_vault_not_configured') {
    return 'Waitlist chat is not configured yet.'
  }
  if (message === 'chat_not_ready' || message.includes('embedded_owner_not_installed')) {
    return 'Finish wallet setup to join waitlist chat.'
  }
  return message
}
