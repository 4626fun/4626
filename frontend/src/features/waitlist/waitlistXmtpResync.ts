import { apiFetch } from '@/lib/api/apiBase'

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
        error: json?.data?.error ?? json?.error ?? `waitlist_xmtp_resync_${response.status}`,
      }
    }
    return { ok: true, error: null }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
