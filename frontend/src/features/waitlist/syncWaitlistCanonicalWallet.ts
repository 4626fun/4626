import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'

type WalletSyncResponse = {
  canonicalSmartWallet: { address: string; provider: string } | null
}

export type SyncWaitlistCanonicalWalletResult =
  | { ok: true; canonicalAddress: string | null }
  | { ok: false; error: string }

const DEFAULT_ATTEMPTS = 4
const RETRY_DELAY_MS = 800

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function normalizeAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  return /^0x[a-fA-F0-9]{40}$/.test(raw) ? raw : null
}

/**
 * Push freshly provisioned Privy wallets to the server profile via `/api/wallet/sync`.
 * Retries briefly while Privy's server-side user payload catches up with the client.
 */
export async function syncWaitlistCanonicalWallet(params?: {
  maxAttempts?: number
}): Promise<SyncWaitlistCanonicalWalletResult> {
  const maxAttempts = Math.max(1, params?.maxAttempts ?? DEFAULT_ATTEMPTS)
  let lastError = 'Could not sync your 4626 wallet to your profile yet.'

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const res = await apiFetch('/api/wallet/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({}),
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<WalletSyncResponse> | null
      if (!res.ok || !json?.success) {
        lastError = json?.error ?? `Wallet sync failed (${res.status}).`
      } else {
        const canonicalAddress = normalizeAddress(json.data?.canonicalSmartWallet?.address ?? null)
        if (canonicalAddress) {
          return { ok: true, canonicalAddress }
        }
        lastError =
          'Your smart wallet was created in Privy but is not on your 4626 profile yet. Wait a moment and retry.'
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError
    }

    if (attempt < maxAttempts - 1) {
      await sleep(RETRY_DELAY_MS * (attempt + 1))
    }
  }

  return { ok: false, error: lastError }
}
