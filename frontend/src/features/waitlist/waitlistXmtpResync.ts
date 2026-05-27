import { apiFetch } from '@/lib/api/apiBase'

function formatWaitlistResyncError(raw: string | null | undefined): string | null {
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

export async function resyncWaitlistGroupMembership(): Promise<{
  ok: boolean
  error: string | null
}> {
  try {
    const response = await apiFetch('/api/waitlist/xmtp-resync', { method: 'POST' })
    const json = (await response.json().catch(() => null)) as {
      success?: boolean
      error?: string
      data?: { error?: string | null }
    } | null
    if (!response.ok || !json?.success) {
      return {
        ok: false,
        error: formatWaitlistResyncError(json?.data?.error ?? json?.error ?? `waitlist_xmtp_resync_${response.status}`),
      }
    }
    return { ok: true, error: null }
  } catch (err) {
    return {
      ok: false,
      error: formatWaitlistResyncError(err instanceof Error ? err.message : String(err)),
    }
  }
}
