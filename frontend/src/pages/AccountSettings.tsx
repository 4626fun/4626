import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Copy, ExternalLink, Mail, RefreshCw, ShieldCheck, Wallet } from 'lucide-react'
import type { Address } from 'viem'
import { useExportWallet } from '@privy-io/react-auth'

import { apiFetch } from '@/lib/apiBase'
import { getMarketingBaseUrl } from '@/lib/host'
import { isPrivyClientEnabled } from '@/lib/flags'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { getFarcasterUserByAddress, getFarcasterUserByFid } from '@/lib/neynar-api'
import { useZoraCoin, useZoraProfile } from '@/lib/zora/hooks'

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
  primarySmartWallet: string | null
  primaryEmbeddedEoa: string | null
  baseSubAccount: string | null
  embeddedWallet: string | null
  embeddedWalletChain: string | null
  embeddedWalletClientType: string | null
  cswAddress: string | null
  solanaWallet: string | null
  farcasterFid: number | null
  preprovCoinAddress: string | null
  preprovCoinSymbol: string | null
  preprovFarcasterUsername: string | null
  preprovZoraHandle: string | null
  lensHandle: string | null
  lensAccountAddress: string | null
  lensOwnerAddress: string | null
  privyUserId: string | null
  appAccessStatus: string | null
  updatedAt: string | null
  connectedAccounts: ConnectedAccount[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isEvmAddress(value: string | null | undefined): value is string {
  const input = typeof value === 'string' ? value.trim() : ''
  return /^0x[a-fA-F0-9]{40}$/.test(input)
}

function formatRole(account: ConnectedAccount): string[] {
  const labels: string[] = []
  if (account.isPrimary) labels.push('Primary')
  if (account.isCanonicalSmartWallet) labels.push('Canonical Smart Wallet')
  if (account.isEmbeddedEoa) labels.push('Embedded EOA')
  if (!account.isCanonicalSmartWallet && (account.walletType ?? '').toLowerCase() === 'smart_wallet') labels.push('App Smart Wallet')
  if (labels.length === 0) labels.push('Connected')
  return labels
}

function humanizeToken(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const byWords = raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!byWords) return null
  return byWords.replace(/\b\w/g, (m) => m.toUpperCase())
}

function formatWalletTypeLabel(value: string | null | undefined): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (raw === 'smart_wallet') return 'Smart Wallet'
  if (raw === 'embedded_eoa') return 'Embedded EOA'
  if (raw === 'external_eoa') return 'External EOA'
  return humanizeToken(value) ?? 'Wallet'
}

function formatChainLabel(value: string | null | undefined): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!raw) return 'EVM'
  if (raw === 'evm') return 'EVM'
  return humanizeToken(raw) ?? 'EVM'
}

function inferProviderLabel(account: ConnectedAccount): string {
  const providerRaw = typeof account.provider === 'string' ? account.provider.trim().toLowerCase() : ''
  const provider = providerRaw.replace(/[_-]+/g, ' ')
  const walletType = typeof account.walletType === 'string' ? account.walletType.trim().toLowerCase() : ''

  if (
    provider.includes('coinbase') ||
    provider.includes('base account') ||
    provider.includes('coinbase smart wallet') ||
    (walletType === 'smart_wallet' && account.isCanonicalSmartWallet)
  ) {
    return 'Coinbase Smart Wallet'
  }
  if (provider.includes('metamask')) return 'MetaMask'
  if (provider.includes('walletconnect')) return 'WalletConnect'
  if (provider.includes('privy')) return 'Privy'
  if (walletType === 'embedded_eoa') return 'Privy Embedded'
  if (walletType === 'smart_wallet') return 'Coinbase Smart Wallet'
  return humanizeToken(providerRaw) ?? 'Unknown'
}

function formatDateTime(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const ms = Date.parse(raw)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toLocaleString()
}

function normalizeHandle(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  return raw.startsWith('@') ? raw.slice(1) : raw
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function formatUsdCompact(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

function formatCountCompact(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

type KnownAddress = {
  address: string
  badges: string[]
  subtitle: string | null
  rank: number
}

type AssociatedAccount = {
  label: string
  value: string
  href?: string
  mono?: boolean
}

function useSafeExportWalletHook(enabled: boolean) {
  try {
    const value = useExportWallet() as any
    if (!enabled || !value || typeof value.exportWallet !== 'function') {
      return {
        exportWallet: async () => {
          throw new Error('Embedded wallet export is unavailable.')
        },
      } as { exportWallet: (options?: { address: string }) => Promise<void> }
    }
    return value as { exportWallet: (options?: { address: string }) => Promise<void> }
  } catch {
    return {
      exportWallet: async () => {
        throw new Error('Embedded wallet export is unavailable.')
      },
    } as { exportWallet: (options?: { address: string }) => Promise<void> }
  }
}

export function AccountSettings() {
  const auth = useSiweAuth()
  const privyEnabled = isPrivyClientEnabled()
  const { exportWallet } = useSafeExportWalletHook(privyEnabled)
  const [profile, setProfile] = useState<WaitlistMeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emailDraft, setEmailDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)

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

  const onCopyAddress = useCallback((address: string) => {
    void navigator.clipboard.writeText(address).then(() => {
      setCopiedAddress(address.toLowerCase())
      window.setTimeout(() => setCopiedAddress((prev) => (prev === address.toLowerCase() ? null : prev)), 1500)
    }).catch(() => {
      // ignore clipboard failures
    })
  }, [])

  const knownAddresses = useMemo<KnownAddress[]>(() => {
    if (!profile) return []
    type Draft = { address: string; badges: Set<string>; subtitle: string | null; rank: number }
    const map = new Map<string, Draft>()
    const upsert = (address: string | null | undefined, badge: string, rank: number, subtitle?: string | null) => {
      if (!isEvmAddress(address)) return
      const normalized = address.toLowerCase()
      const existing = map.get(normalized)
      if (!existing) {
        map.set(normalized, {
          address,
          badges: new Set([badge]),
          subtitle: subtitle ?? null,
          rank,
        })
        return
      }
      existing.badges.add(badge)
      if (rank > existing.rank) {
        existing.rank = rank
        existing.subtitle = subtitle ?? existing.subtitle
      } else if (!existing.subtitle && subtitle) {
        existing.subtitle = subtitle
      }
    }

    upsert(profile.cswAddress, 'Canonical Smart Wallet', 100, 'Coinbase Smart Wallet')
    upsert(profile.primarySmartWallet, 'Primary Smart Wallet', 95, 'Coinbase Smart Wallet')
    upsert(profile.baseSubAccount, 'Base Sub-account', 90, 'Coinbase Smart Wallet')
    upsert(profile.primaryWallet, 'Primary Wallet', 80, 'External Wallet')
    upsert(profile.primaryEmbeddedEoa, 'Primary Embedded EOA', 70, 'Privy Embedded')
    upsert(profile.embeddedWallet, 'Embedded Wallet', 65, 'Privy Embedded')

    for (const account of profile.connectedAccounts ?? []) {
      const roles = formatRole(account)
      const subtitle = [formatWalletTypeLabel(account.walletType), inferProviderLabel(account), formatChainLabel(account.chain)]
        .filter(Boolean)
        .join(' · ')
      const baseRank = account.isCanonicalSmartWallet ? 100 : account.isPrimary ? 80 : account.isEmbeddedEoa ? 70 : 50
      if (roles.length === 0) {
        upsert(account.address, 'Connected', baseRank, subtitle)
      } else {
        for (const role of roles) upsert(account.address, role, baseRank, subtitle)
      }
    }

    return Array.from(map.values())
      .map((item) => ({
        address: item.address,
        badges: Array.from(item.badges.values()),
        subtitle: item.subtitle,
        rank: item.rank,
      }))
      .sort((a, b) => b.rank - a.rank || a.address.localeCompare(b.address))
  }, [profile])

  const canonicalSmartWalletAddress = useMemo(() => {
    if (!profile) return null
    if (isEvmAddress(profile.cswAddress)) return profile.cswAddress
    if (isEvmAddress(profile.primarySmartWallet)) return profile.primarySmartWallet
    if (isEvmAddress(profile.baseSubAccount)) return profile.baseSubAccount
    return null
  }, [profile])

  const zoraProfileIdentifier = useMemo(() => {
    const fromHandle = normalizeHandle(profile?.preprovZoraHandle)
    if (fromHandle) return fromHandle
    if (canonicalSmartWalletAddress) return canonicalSmartWalletAddress
    if (isEvmAddress(profile?.primaryWallet)) return profile.primaryWallet
    return undefined
  }, [canonicalSmartWalletAddress, profile?.preprovZoraHandle, profile?.primaryWallet])

  const zoraProfileQuery = useZoraProfile(zoraProfileIdentifier)
  const zoraProfile = zoraProfileQuery.data ?? null
  const zoraHandle = normalizeHandle(typeof zoraProfile?.handle === 'string' ? zoraProfile.handle : null)

  const creatorCoinAddress = useMemo(() => {
    const fromProfile = isEvmAddress(zoraProfile?.creatorCoin?.address) ? zoraProfile.creatorCoin.address : null
    if (fromProfile) return fromProfile.toLowerCase() as Address
    if (isEvmAddress(profile?.preprovCoinAddress)) return profile.preprovCoinAddress.toLowerCase() as Address
    return undefined
  }, [profile?.preprovCoinAddress, zoraProfile?.creatorCoin?.address])

  const zoraCoinQuery = useZoraCoin(creatorCoinAddress)
  const creatorCoin = zoraCoinQuery.data ?? null

  const farcasterIdentityQuery = useQuery({
    queryKey: ['accountFarcasterIdentity', profile?.farcasterFid ?? 'none', canonicalSmartWalletAddress ?? profile?.primaryWallet ?? 'none'],
    enabled: Boolean((typeof profile?.farcasterFid === 'number' && profile.farcasterFid > 0) || canonicalSmartWalletAddress || profile?.primaryWallet),
    staleTime: 60_000,
    retry: 0,
    queryFn: async () => {
      const fid = typeof profile?.farcasterFid === 'number' && profile.farcasterFid > 0 ? profile.farcasterFid : null
      if (fid) return await getFarcasterUserByFid(fid)
      const fallbackAddress = canonicalSmartWalletAddress ?? (isEvmAddress(profile?.primaryWallet) ? profile.primaryWallet : null)
      if (!fallbackAddress) return null
      return await getFarcasterUserByAddress(fallbackAddress)
    },
  })

  const farcasterIdentity = farcasterIdentityQuery.data ?? null
  const effectiveFid = typeof farcasterIdentity?.fid === 'number' && farcasterIdentity.fid > 0 ? farcasterIdentity.fid : profile?.farcasterFid ?? null
  const farcasterUsername = normalizeHandle(
    typeof farcasterIdentity?.username === 'string'
      ? farcasterIdentity.username
      : profile?.preprovFarcasterUsername,
  )

  const creatorCoinDisplaySymbol = useMemo(() => {
    const fromCoin = typeof creatorCoin?.symbol === 'string' && creatorCoin.symbol.trim() ? creatorCoin.symbol.trim() : null
    if (fromCoin) return fromCoin
    const fromPreprov = typeof profile?.preprovCoinSymbol === 'string' && profile.preprovCoinSymbol.trim() ? profile.preprovCoinSymbol.trim() : null
    return fromPreprov ?? 'Creator Coin'
  }, [creatorCoin?.symbol, profile?.preprovCoinSymbol])

  const creatorCoinStats = useMemo(() => {
    const marketCap = asNumber(creatorCoin?.marketCap) ?? asNumber(zoraProfile?.creatorCoin?.marketCap)
    const volume24h = asNumber(creatorCoin?.volume24h)
    const holders = asNumber(creatorCoin?.uniqueHolders)
    return {
      marketCap,
      volume24h,
      holders,
    }
  }, [creatorCoin?.marketCap, creatorCoin?.volume24h, creatorCoin?.uniqueHolders, zoraProfile?.creatorCoin?.marketCap])

  const embeddedExportAddress = useMemo(() => {
    if (isEvmAddress(profile?.primaryEmbeddedEoa)) return profile.primaryEmbeddedEoa
    if (isEvmAddress(profile?.embeddedWallet)) return profile.embeddedWallet
    const embedded = (profile?.connectedAccounts ?? []).find((a) => a.isEmbeddedEoa && isEvmAddress(a.address))
    if (embedded) return embedded.address
    return null
  }, [profile?.connectedAccounts, profile?.embeddedWallet, profile?.primaryEmbeddedEoa])

  const onExportEmbeddedWallet = useCallback(async () => {
    if (exportBusy) return
    if (!privyEnabled) {
      setExportMessage('Privy wallet features are disabled in this environment.')
      return
    }
    if (!embeddedExportAddress) {
      setExportMessage('No embedded wallet found to export.')
      return
    }
    setExportBusy(true)
    setExportMessage(null)
    try {
      await exportWallet({ address: embeddedExportAddress })
      setExportMessage('Export flow opened. Complete the secure modal to export your embedded wallet.')
    } catch (e: any) {
      const raw = typeof e?.message === 'string' ? e.message : 'Wallet export failed.'
      setExportMessage(raw)
    } finally {
      setExportBusy(false)
    }
  }, [embeddedExportAddress, exportBusy, exportWallet, privyEnabled])

  const associatedAccounts = useMemo<AssociatedAccount[]>(() => {
    const rows: AssociatedAccount[] = []
    const seen = new Set<string>()
    const add = (row: AssociatedAccount) => {
      const key = `${row.label}:${row.value}`.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      rows.push(row)
    }

    if (effectiveFid) {
      add({
        label: 'Farcaster FID',
        value: String(effectiveFid),
        href: `https://warpcast.com/~/profiles/${effectiveFid}`,
      })
    }

    if (farcasterUsername) {
      add({
        label: 'Farcaster',
        value: `@${farcasterUsername}`,
        href: `https://warpcast.com/${farcasterUsername}`,
      })
    }

    if (zoraHandle) {
      add({
        label: 'Zora',
        value: `@${zoraHandle}`,
        href: `https://zora.co/@${zoraHandle}`,
      })
    }

    const lensHandle = normalizeHandle(profile?.lensHandle)
    if (lensHandle) {
      add({
        label: 'Lens',
        value: `@${lensHandle}`,
        href: `https://hey.xyz/u/${lensHandle}`,
      })
    }

    if (profile?.solanaWallet) {
      add({ label: 'Solana Wallet', value: profile.solanaWallet, mono: true })
    }
    if (isEvmAddress(profile?.lensAccountAddress)) {
      add({ label: 'Lens Account Address', value: profile.lensAccountAddress, mono: true })
    }
    if (isEvmAddress(profile?.lensOwnerAddress)) {
      add({ label: 'Lens Owner Address', value: profile.lensOwnerAddress, mono: true })
    }
    if (isEvmAddress(farcasterIdentity?.custodyAddress)) {
      add({ label: 'Farcaster Custody Wallet', value: farcasterIdentity.custodyAddress, mono: true })
    }
    for (const wallet of farcasterIdentity?.verifiedEthAddresses ?? []) {
      if (!isEvmAddress(wallet)) continue
      add({ label: 'Farcaster Verified Wallet', value: wallet, mono: true })
    }

    const zoraLinkedWallets = Array.isArray(zoraProfile?.linkedWallets?.edges) ? zoraProfile.linkedWallets.edges : []
    for (const edge of zoraLinkedWallets) {
      const walletAddress = edge?.node?.walletAddress
      if (!isEvmAddress(walletAddress)) continue
      add({ label: 'Zora Linked Wallet', value: walletAddress, mono: true })
    }

    const social = zoraProfile?.socialAccounts
    const twitterHandle = normalizeHandle(social?.twitter?.username)
    if (twitterHandle) add({ label: 'X', value: `@${twitterHandle}`, href: `https://x.com/${twitterHandle}` })
    const instagramHandle = normalizeHandle(social?.instagram?.username)
    if (instagramHandle) add({ label: 'Instagram', value: `@${instagramHandle}`, href: `https://instagram.com/${instagramHandle}` })
    const tiktokHandle = normalizeHandle(social?.tiktok?.username)
    if (tiktokHandle) add({ label: 'TikTok', value: `@${tiktokHandle}`, href: `https://tiktok.com/@${tiktokHandle}` })

    return rows
  }, [
    effectiveFid,
    farcasterIdentity?.custodyAddress,
    farcasterIdentity?.verifiedEthAddresses,
    farcasterUsername,
    profile?.lensAccountAddress,
    profile?.lensHandle,
    profile?.lensOwnerAddress,
    profile?.solanaWallet,
    zoraHandle,
    zoraProfile?.linkedWallets?.edges,
    zoraProfile?.socialAccounts,
  ])

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

        {knownAddresses.length > 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
            <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">Known Addresses</div>
            <div className="space-y-2">
              {knownAddresses.map((item) => (
                <div key={`known:${item.address.toLowerCase()}`} className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="font-mono text-xs sm:text-sm text-zinc-100 break-all">{item.address}</div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://basescan.org/address/${item.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 hover:text-zinc-100"
                      >
                        BaseScan
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => onCopyAddress(item.address)}
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 hover:text-zinc-100"
                      >
                        {copiedAddress === item.address.toLowerCase() ? 'Copied' : 'Copy'}
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {item.badges.map((badge) => (
                      <span key={`${item.address}:${badge}`} className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-300">
                        {badge}
                      </span>
                    ))}
                  </div>
                  {item.subtitle ? <div className="mt-2 text-[11px] text-zinc-500">{item.subtitle}</div> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {profile?.connectedAccounts?.length ? (
          <div className="space-y-3">
            {profile.connectedAccounts.map((account) => {
              const verifiedLabel = formatDateTime(account.verifiedAt)
              return (
                <div key={account.address.toLowerCase()} className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-mono text-xs sm:text-sm text-zinc-100 break-all">{account.address}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      {formatRole(account).map((label) => (
                        <span key={label} className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-300">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    {[formatWalletTypeLabel(account.walletType), inferProviderLabel(account), formatChainLabel(account.chain)].filter(Boolean).join(' · ') ||
                      'Wallet'}
                    {verifiedLabel ? ` · Verified ${verifiedLabel}` : ''}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-400">
            No connected accounts found for this profile yet.
          </div>
        )}
      </section>

      <section className="card rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-white">
          <ShieldCheck className="w-4 h-4" />
          <h2 className="text-lg">Creator Profile</h2>
        </div>
        <p className="text-sm text-zinc-400">Creator coin, public profile stats, and associated identities.</p>

        {creatorCoinAddress ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-zinc-100">{creatorCoinDisplaySymbol}</div>
                <div className="font-mono text-xs text-zinc-400 break-all">{creatorCoinAddress}</div>
              </div>
              <a
                href={`https://zora.co/coin/base:${creatorCoinAddress}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 hover:text-zinc-100"
              >
                View on Zora
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-zinc-800 bg-black/30 px-2 py-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Market Cap</div>
                <div className="mt-1 text-sm text-zinc-100">{formatUsdCompact(creatorCoinStats.marketCap)}</div>
              </div>
              <div className="rounded-md border border-zinc-800 bg-black/30 px-2 py-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">24h Volume</div>
                <div className="mt-1 text-sm text-zinc-100">{formatUsdCompact(creatorCoinStats.volume24h)}</div>
              </div>
              <div className="rounded-md border border-zinc-800 bg-black/30 px-2 py-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Holders</div>
                <div className="mt-1 text-sm text-zinc-100">{formatCountCompact(creatorCoinStats.holders)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-400">
            No creator coin detected yet for this account.
          </div>
        )}

        {associatedAccounts.length > 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 space-y-2">
            <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">Associated Accounts</div>
            <div className="space-y-2">
              {associatedAccounts.map((item) => (
                <div key={`${item.label}:${item.value}`} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                  <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">{item.label}</div>
                  {item.href ? (
                    <a href={item.href} target="_blank" rel="noreferrer" className={`text-sm text-zinc-200 hover:text-white ${item.mono ? 'font-mono' : ''}`}>
                      {item.value}
                    </a>
                  ) : (
                    <div className={`text-sm text-zinc-200 ${item.mono ? 'font-mono break-all' : ''}`}>{item.value}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-400">
            No associated social accounts found yet.
          </div>
        )}

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3 space-y-2">
          <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">Embedded Wallet Export</div>
          <div className="text-sm text-zinc-300">
            {embeddedExportAddress ? (
              <>
                Export your Privy embedded EOA: <span className="font-mono text-zinc-200 break-all">{embeddedExportAddress}</span>
              </>
            ) : (
              'No embedded wallet detected for this account yet.'
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void onExportEmbeddedWallet()}
              disabled={!embeddedExportAddress || exportBusy || !privyEnabled}
              className="btn-secondary disabled:opacity-50"
            >
              {exportBusy ? 'Opening export…' : 'Export Embedded Wallet'}
            </button>
            <div className="text-xs text-zinc-500">Privy handles key export in a secure iframe; this app cannot read your private key.</div>
          </div>
          {exportMessage ? <div className="text-xs text-zinc-400">{exportMessage}</div> : null}
        </div>
      </section>

      <section className="card rounded-xl p-6 space-y-2">
        <div className="flex items-center gap-2 text-white">
          <ShieldCheck className="w-4 h-4" />
          <h2 className="text-lg">Access</h2>
        </div>
        <div className="text-sm text-zinc-400">
          App access status: <span className="text-zinc-200">{humanizeToken(profile?.appAccessStatus) ?? 'Unknown'}</span>
        </div>
        <div className="text-sm text-zinc-400">
          Last updated: <span className="text-zinc-200">{formatDateTime(profile?.updatedAt) ?? '—'}</span>
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
