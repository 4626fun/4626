export function formatWaitlistChatError(raw: string | null | undefined): string | null {
  if (!raw) return null
  const message = raw.trim()
  if (!message) return null

  if (message.includes('resource has been exhausted') || message.includes('rate limit')) {
    return 'XMTP is rate limiting welcome sync for this network. Wait about a minute, then tap Refresh.'
  }
  if (message.includes('PRIVY_WALLET_AUTHORIZATION_KEY')) {
    return 'Waitlist chat is still syncing. Try refresh in a moment.'
  }
  if (message.includes('Messaging signer is not ready yet')) {
    return 'Messaging signer is not ready yet. Click Connect messaging again.'
  }
  if (message.includes('Privy sign-in is not loaded')) {
    return message
  }
  if (message === 'waitlist_chat_not_configured' || message === 'waitlist_chat_vault_not_configured') {
    return 'Waitlist chat is not configured yet.'
  }
  if (message === 'chat_not_ready' || message.includes('embedded_owner_not_installed')) {
    return 'Finish wallet setup to join waitlist chat.'
  }
  if (message.includes('wagmi is still syncing')) {
    return 'Wallet is still connecting. Wait a moment, then retry Connect messaging.'
  }
  if (
    message.toLowerCase().includes('missing auth token') ||
    (message.toLowerCase().includes('unknownrpcerror') && message.toLowerCase().includes('auth token')) ||
    message.toLowerCase().includes('embedded signer')
  ) {
    return 'Sign-in for chat expired.'
  }

  return message
}
