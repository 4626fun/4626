import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Mail, RefreshCw, ShieldCheck, Wallet } from 'lucide-react'

import { apiFetch } from '@/lib/apiBase'
import { getMarketingBaseUrl } from '@/lib/host'
import { useSiweAuth } from '@/hooks/useSiweAuth'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type ConnectedAccount = {
  address: string
  chain: string | null
  walletType: string | null
  provider: string | null
  source: string
  isPrimary: boolean
  isCanonicalSmartWallet: boolean
  isEmbeddedEoa: boolean
  verifiedAt: string | null
}

type WaitlistMeResponse = {
  profileId: number
  email: string | null
  contactPreference: string | null
  primaryWallet: string | null
  embeddedWallet: string | null
  embeddedWalletChain: string | null
  embeddedWalletClientType: string | null
  cswAddress: string | null
  privyUserId: string | null
  appAccessStatus: string | null
  updatedAt: string | null
  connectedAccounts: ConnectedAccount[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function formatAddress(address: string): string {
  if (address.length <= 14) return address
  return `${address.slice(0, 8)}...${address.slice(-6)}`
}

function formatRole(account: ConnectedAccount): string[] {
  const labels: string[] = []
  if (account.isPrimary) labels.push('Primary')
  if (account.isCanonicalSmartWallet) labels.push('Canonical CSW')
  if (account.isEmbeddedEoa) labels.push('Embedded')
  if (labels.length === 0) labels.push('Connected')
  return labels
}

export function AccountSettings() {
  const auth = useSiweAuth()
  const [profile, setProfile] = useState<WaitlistMeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emailDraft, setEmailDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/waitlist/me', { method: 'GET' })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<WaitlistMeResponse | null> | null
      if (!res.ok || !json?.success) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to load account.')
      }
      const nextProfile = (json?.data ?? null) as WaitlistMeResponse | null
      setProfile(nextProfile)
      setEmailDraft(nextProfile?.email ?? '')
    } catch (e: any) {
      setProfile(null)
      setEmailDraft('')
      setError(typeof e?.message === 'string' ? e.message : 'Failed to load account.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!auth.sessionHydrated) return
    if (!auth.isSignedIn) {
      setLoading(false)
      return
    }
    void loadProfile()
  }, [auth.isSignedIn, auth.sessionHydrated, loadProfile])

  const canSaveEmail = useMemo(() => {
    const trimmed = emailDraft.trim().toLowerCase()
    if (!EMAIL_RE.test(trimmed)) return false
    return trimmed !== (profile?.email ?? '').trim().toLowerCase()
  }, [emailDraft, profile?.email])

  const onSaveEmail = useCallback(async () => {
    if (!canSaveEmail || saving) return
    setSaving(true)
    setSuccess(null)
    setError(null)
    try {
      const trimmedEmail = emailDraft.trim().toLowerCase()
      const res = await apiFetch('/api/waitlist/update-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          currentEmail: profile?.email ?? null,
          newEmail: trimmedEmail,
        }),
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<{ email: string }> | null
      if (!res.ok || !json?.success || !json.data?.email) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to update email.')
      }
      const nextEmail = String(json.data.email)
      setProfile((prev) => (prev ? { ...prev, email: nextEmail, contactPreference: 'email' } : prev))
      setEmailDraft(nextEmail)
      setSuccess('Email updated.')
      void loadProfile()
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Failed to update email.')
    } finally {
      setSaving(false)
    }
  }, [canSaveEmail, emailDraft, loadProfile, profile?.email, saving])

  if (!auth.sessionHydrated || loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="card rounded-xl p-8 text-zinc-300">Loading account…</div>
      </div>
    )
  }

  if (!auth.isSignedIn) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="card rounded-xl p-8 space-y-4">
          <div className="text-xl text-white">Sign in required</div>
          <div className="text-sm text-zinc-400">Connect wallet and complete Sign in to manage your email and connected accounts.</div>
          <button
            type="button"
            onClick={() => {
              void auth.signIn()
            }}
            disabled={auth.busy}
            className="btn-accent disabled:opacity-60"
          >
            {auth.busy ? 'Signing in…' : 'Sign in'}
          </button>
          <div>
            <a href={`${getMarketingBaseUrl()}/#waitlist`} className="text-sm text-zinc-400 hover:text-zinc-200">
              Back to waitlist
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Account</div>
          <h1 className="text-2xl text-white">Email and Connected Accounts</h1>
        </div>
        <button
          type="button"
          onClick={() => void loadProfile()}
          className="btn-secondary inline-flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {success ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{success}</div>
      ) : null}

      <section className="card rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-white">
          <Mail className="w-4 h-4" />
          <h2 className="text-lg">Email</h2>
        </div>
        <p className="text-sm text-zinc-400">Use a real email for updates and account recovery.</p>
        <div className="space-y-2">
          <label htmlFor="account-email" className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Email Address
          </label>
          <input
            id="account-email"
            type="email"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-brand-primary"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void onSaveEmail()}
            disabled={!canSaveEmail || saving}
            className="btn-accent disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Update Email'}
          </button>
          <span className="text-xs text-zinc-500">
            Current: {profile?.email ? profile.email : 'Not set'}
          </span>
        </div>
      </section>

      <section className="card rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-white">
          <Wallet className="w-4 h-4" />
          <h2 className="text-lg">Connected Accounts</h2>
        </div>
        <p className="text-sm text-zinc-400">Wallets and linked accounts associated with your profile.</p>

        {profile?.connectedAccounts?.length ? (
          <div className="space-y-3">
            {profile.connectedAccounts.map((account) => (
              <div key={account.address.toLowerCase()} className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-sm text-zinc-100">{formatAddress(account.address)}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {formatRole(account).map((label) => (
                      <span key={label} className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-300">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  {[account.walletType, account.provider, account.chain].filter(Boolean).join(' | ') || 'Wallet'}
                  {account.verifiedAt ? ` | verified ${new Date(account.verifiedAt).toLocaleString()}` : ''}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-400">
            No connected accounts found for this profile yet.
          </div>
        )}
      </section>

      <section className="card rounded-xl p-6 space-y-2">
        <div className="flex items-center gap-2 text-white">
          <ShieldCheck className="w-4 h-4" />
          <h2 className="text-lg">Access</h2>
        </div>
        <div className="text-sm text-zinc-400">
          App access status: <span className="text-zinc-200">{profile?.appAccessStatus ?? 'unknown'}</span>
        </div>
        <div className="text-sm text-zinc-400">
          Last updated: <span className="text-zinc-200">{profile?.updatedAt ? new Date(profile.updatedAt).toLocaleString() : '—'}</span>
        </div>
        {profile?.privyUserId ? (
          <div className="text-sm text-zinc-400">
            Privy user: <span className="font-mono text-zinc-300">{profile.privyUserId}</span>
          </div>
        ) : null}
        {success ? (
          <div className="mt-2 inline-flex items-center gap-2 text-emerald-300 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Changes saved
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default AccountSettings
