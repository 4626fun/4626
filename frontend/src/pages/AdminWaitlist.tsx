import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  RefreshCw,
  Search,
  Bot,
  Coins,
  User,
  CheckCircle,
  Clock,
  XCircle,
  Zap,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react'
import { useAccount } from 'wagmi'

import { useSiweAuth } from '@/hooks/useSiweAuth'
import { apiFetch } from '@/lib/apiBase'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type WaitlistListItem = {
  id: number
  email: string
  persona: string | null
  primaryWallet: string | null
  cswAddress: string | null
  solanaWallet: string | null
  embeddedWallet: string | null
  embeddedWalletChain: string | null
  embeddedWalletClientType: string | null
  referralCode: string | null
  contactPreference: string | null
  appAccessStatus: string | null
  appAccessDecidedAt: string | null
  createdAt: string
  updatedAt: string
  preprovisioned: boolean
  preprovFarcasterUsername: string | null
  preprovZoraHandle: string | null
  preprovCoinSymbol: string | null
}

type AdminWaitlistListResponse = {
  admin: string
  items: WaitlistListItem[]
}

type WaitlistDetail = {
  id: number
  email: string
  persona: string | null
  primaryWallet: string | null
  solanaWallet: string | null
  privyUserId: string | null
  embeddedWallet: string | null
  embeddedWalletChain: string | null
  embeddedWalletClientType: string | null
  baseSubAccount: string | null
  hasCreatorCoin: boolean | null
  farcasterFid: number | null
  contactPreference: string | null
  verifications: unknown | null
  appAccessStatus: string | null
  appAccessDecisionNote: string | null
  appAccessDecidedAt: string | null
  appAccessDecidedBy: string | null
  referralCode: string | null
  referredByCode: string | null
  referredBySignupId: number | null
  referralClaimedAt: string | null
  profileCompletedAt: string | null
  cswAddress: string | null
  createdAt: string
  updatedAt: string
  // Pre-provisioning
  preprovisionedAt: string | null
  preprovServerWalletId: string | null
  preprovServerWalletAddress: string | null
  preprovCoinAddress: string | null
  preprovCoinSymbol: string | null
  preprovFarcasterUsername: string | null
  preprovZoraHandle: string | null
  walletGraph: Array<{
    address: string
    walletType: string | null
    provider: string | null
    chain: string | null
    isPrimary: boolean
    isCanonicalSmartWallet: boolean
    isEmbeddedEoa: boolean
  }>
  resolvedPrimaryWallet: string | null
  resolvedCswAddress: string | null
  resolvedCswOwners: string[]
  embeddedWallet4626: string | null
  embeddedWalletZora: string | null
  privySmartWallet: string | null
  crossAppEmbeddedWallets: string[]
  crossAppSmartWallets: string[]
}

type AdminWaitlistDetailResponse = {
  admin: string
  signup: WaitlistDetail | null
}

function shortAddr(value: string | null): string {
  if (!value) return 'N/A'
  if (value.length < 10) return value
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function formatDate(value: string | null): string {
  if (!value) return 'N/A'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function relativeTime(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? 'pending'
  const config =
    s === 'approved'
      ? { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' }
      : s === 'denied'
        ? { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' }
        : { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' }
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${config.bg} ${config.color}`}>
      <Icon className="w-2.5 h-2.5 shrink-0" />
      {s}
    </span>
  )
}

function DetailField({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600 mb-0.5">{label}</div>
      <div className={`text-[13px] ${mono ? 'font-mono text-[12px]' : ''} text-zinc-300 break-all leading-snug`}>{value || 'N/A'}</div>
    </div>
  )
}

async function fetchWaitlistList(params: { q?: string | null }): Promise<AdminWaitlistListResponse> {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  const res = await apiFetch(`/api/admin/waitlist/list?${qs.toString()}`, { method: 'GET', headers: { Accept: 'application/json' } })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AdminWaitlistListResponse> | null
  if (!res.ok || !json) throw new Error(`Failed to load (${res.status})`)
  if (!json.success) throw new Error(json.error || 'Failed to load')
  if (!json.data) throw new Error('Missing data')
  return json.data
}

async function fetchWaitlistDetail(params: { id: number }): Promise<AdminWaitlistDetailResponse> {
  const qs = new URLSearchParams()
  qs.set('id', String(params.id))
  const res = await apiFetch(`/api/admin/waitlist/detail?${qs.toString()}`, { method: 'GET', headers: { Accept: 'application/json' } })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AdminWaitlistDetailResponse> | null
  if (!res.ok || !json) throw new Error(`Failed to load detail (${res.status})`)
  if (!json.success) throw new Error(json.error || 'Failed to load detail')
  if (!json.data) throw new Error('Missing detail data')
  return json.data
}

// ---------------------------------------------------------------------------
// List Item
// ---------------------------------------------------------------------------

function ListItem({
  item,
  isActive,
  onSelect,
}: {
  item: WaitlistListItem
  isActive: boolean
  onSelect: () => void
}) {
  const displayName = item.preprovFarcasterUsername
    ? `@${item.preprovFarcasterUsername}`
    : item.preprovZoraHandle
      ? `@${item.preprovZoraHandle}`
      : null
  const displayWallet = item.cswAddress || item.primaryWallet || item.embeddedWallet || item.solanaWallet

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-3 sm:px-4 py-3 transition-colors ${
        isActive ? 'bg-brand-primary/10 border-l-2 border-l-indigo-500' : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="min-w-0 flex items-center gap-1.5 sm:gap-2">
          {displayName ? (
            <span className="text-[13px] sm:text-sm text-zinc-200 truncate font-medium">{displayName}</span>
          ) : (
            <span className="text-[13px] sm:text-sm text-zinc-400 truncate">{item.email}</span>
          )}
          {item.preprovisioned && (
            <Zap className="w-3 h-3 text-indigo-400 shrink-0" aria-label="Pre-provisioned" />
          )}
        </div>
        <StatusBadge status={item.appAccessStatus} />
      </div>
      <div className="mt-1 flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-zinc-600 min-w-0">
        {displayWallet && (
          <span className="font-mono truncate">{shortAddr(displayWallet)}</span>
        )}
        {item.preprovCoinSymbol && (
          <span className="flex items-center gap-0.5 shrink-0">
            <Coins className="w-2.5 h-2.5" />${item.preprovCoinSymbol}
          </span>
        )}
        <span className="ml-auto shrink-0">{relativeTime(item.createdAt)}</span>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Detail Panel
// ---------------------------------------------------------------------------

function DetailPanel({
  detail,
  decisionNote,
  setDecisionNote,
  decisionBusy,
  onApprove,
  onDeny,
  onDelete,
}: {
  detail: WaitlistDetail
  decisionNote: string
  setDecisionNote: (v: string) => void
  decisionBusy: boolean
  onApprove: () => void
  onDeny: () => void
  onDelete: () => void
}) {
  const resolvedPrimaryWallet = detail.resolvedPrimaryWallet || detail.primaryWallet
  const resolvedCswOwners = (Array.isArray(detail.resolvedCswOwners) ? detail.resolvedCswOwners : []).filter(
    (owner): owner is string => typeof owner === 'string' && owner.length > 0,
  )
  const crossAppEmbeddedWallets = (Array.isArray(detail.crossAppEmbeddedWallets) ? detail.crossAppEmbeddedWallets : []).filter(
    (address): address is string => typeof address === 'string' && address.length > 0,
  )
  const crossAppSmartWallets = (Array.isArray(detail.crossAppSmartWallets) ? detail.crossAppSmartWallets : []).filter(
    (address): address is string => typeof address === 'string' && address.length > 0,
  )
  return (
    <div className="space-y-4">
      {/* Access decision */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">App access</div>
            <div className="mt-1">
              <StatusBadge status={detail.appAccessStatus} />
            </div>
            <div className="text-[10px] sm:text-[11px] text-zinc-600 mt-1">
              {Boolean(detail.appAccessDecidedAt) ? `Decided ${formatDate(detail.appAccessDecidedAt)}` : 'Not decided yet'}
              {Boolean(detail.appAccessDecidedBy) ? ` by ${shortAddr(detail.appAccessDecidedBy)}` : ''}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-accent text-xs px-3 py-1.5 sm:px-4 sm:py-2"
              disabled={decisionBusy}
              onClick={onApprove}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn-secondary text-xs px-3 py-1.5 sm:px-4 sm:py-2"
              disabled={decisionBusy}
              onClick={onDeny}
            >
              Deny
            </button>
            <button
              type="button"
              className="text-xs px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              disabled={decisionBusy}
              onClick={onDelete}
            >
              Delete
            </button>
          </div>
        </div>
        <textarea
          value={decisionNote}
          onChange={(e) => setDecisionNote(e.target.value)}
          placeholder="Decision note (optional)"
          className="w-full min-h-[50px] sm:min-h-[60px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
        />
      </div>

      {/* Pre-provisioning section */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Pre-provisioning</div>
          {Boolean(detail.preprovisionedAt) ? (
            <span className="ml-auto text-[10px] text-emerald-400 flex items-center gap-1 shrink-0">
              <CheckCircle className="w-2.5 h-2.5" /> Ready
            </span>
          ) : (
            <span className="ml-auto text-[10px] text-zinc-600 flex items-center gap-1 shrink-0">
              <Clock className="w-2.5 h-2.5" /> Not yet
            </span>
          )}
        </div>
        {Boolean(detail.preprovisionedAt) ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div className="flex items-start gap-2">
                <Bot className="w-3.5 h-3.5 text-zinc-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-zinc-600">Server signer</div>
                  <div className="text-[12px] font-mono text-zinc-300 truncate">
                    {detail.preprovServerWalletAddress ? shortAddr(detail.preprovServerWalletAddress) : 'N/A'}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Coins className="w-3.5 h-3.5 text-zinc-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-zinc-600">Creator coin</div>
                  <div className="text-[12px] text-zinc-300">
                    {detail.preprovCoinSymbol ? `$${detail.preprovCoinSymbol}` : 'Not detected'}
                  </div>
                  {Boolean(detail.preprovCoinAddress) && (
                    <div className="text-[10px] font-mono text-zinc-700 truncate">{shortAddr(detail.preprovCoinAddress)}</div>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="w-3.5 h-3.5 text-zinc-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-zinc-600">Farcaster</div>
                  <div className="text-[12px] text-zinc-300 truncate">
                    {detail.preprovFarcasterUsername ? `@${detail.preprovFarcasterUsername}` : 'Not found'}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="w-3.5 h-3.5 text-zinc-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-zinc-600">Zora</div>
                  <div className="text-[12px] text-zinc-300 truncate">
                    {detail.preprovZoraHandle ? `@${detail.preprovZoraHandle}` : 'Not found'}
                  </div>
                </div>
              </div>
            </div>
            <div className="text-[10px] text-zinc-700">
              Provisioned {formatDate(detail.preprovisionedAt)}
            </div>
          </div>
        ) : (
          <div className="text-[11px] sm:text-[12px] text-zinc-600">
            Pre-provisioning runs automatically at signup. Server wallet, creator coin, and social identities will appear here once resolved.
          </div>
        )}
      </div>

      {/* Identity & Wallets */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-3 sm:p-4 space-y-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Identity & Wallets</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
          <DetailField label="Email" value={detail.email} />
          <DetailField label="Persona" value={detail.persona} />
          <DetailField label="Primary wallet (resolved EOA)" value={detail.resolvedPrimaryWallet || detail.primaryWallet} mono />
          <DetailField label="Canonical CSW (resolved)" value={detail.resolvedCswAddress || detail.cswAddress} mono />
          <DetailField label="Privy smart wallet (4626.fun)" value={detail.privySmartWallet} mono />
          <DetailField label="Privy embedded EOA (4626.fun)" value={detail.embeddedWallet4626 || detail.embeddedWallet} mono />
          <DetailField label="Privy embedded EOA (Zora cross-app)" value={detail.embeddedWalletZora} mono />
          {crossAppEmbeddedWallets.length > 0 && (
            <DetailField label="Cross-app embedded wallets" value={crossAppEmbeddedWallets.join(', ')} mono />
          )}
          {crossAppSmartWallets.length > 0 && (
            <DetailField label="Cross-app smart wallets" value={crossAppSmartWallets.join(', ')} mono />
          )}
          <DetailField label="Legacy profile primary wallet" value={detail.primaryWallet} mono />
          <DetailField label="Legacy CSW address" value={detail.cswAddress} mono />
          <DetailField label="Embedded wallet" value={detail.embeddedWallet} mono />
          {(detail.embeddedWalletChain || detail.embeddedWalletClientType) && (
            <DetailField
              label="Embedded type"
              value={[detail.embeddedWalletChain, detail.embeddedWalletClientType].filter(Boolean).join(' / ')}
            />
          )}
          <DetailField label="Solana wallet" value={detail.solanaWallet} mono />
          <DetailField label="Base sub-account" value={detail.baseSubAccount} mono />
          <DetailField label="Farcaster FID" value={detail.farcasterFid ? String(detail.farcasterFid) : null} />
          <DetailField label="Contact preference" value={detail.contactPreference} />
          <DetailField label="Privy user ID" value={detail.privyUserId} mono />
          <DetailField label="Has creator coin" value={detail.hasCreatorCoin === null ? null : detail.hasCreatorCoin ? 'Yes' : 'No'} />
        </div>
        {resolvedCswOwners.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-white/5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Resolved CSW owners</div>
            <div className="space-y-1">
              {resolvedCswOwners.map((owner) => (
                <div key={owner} className="text-[12px] font-mono text-zinc-300 break-all">
                  {owner}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Referral info */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-3 sm:p-4 space-y-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Referral</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
          <DetailField label="Referral code" value={detail.referralCode} />
          <DetailField label="Referred by" value={detail.referredByCode} />
          <DetailField label="Code claimed" value={formatDate(detail.referralClaimedAt)} />
          {Boolean(detail.referredBySignupId) && (
            <DetailField label="Referrer signup ID" value={String(detail.referredBySignupId)} />
          )}
        </div>
      </div>

      {/* Timestamps */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-3 sm:p-4 space-y-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Timestamps</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
          <DetailField label="Signed up" value={formatDate(detail.createdAt)} />
          <DetailField label="Last updated" value={formatDate(detail.updatedAt)} />
          <DetailField label="Profile completed" value={formatDate(detail.profileCompletedAt)} />
        </div>
      </div>

      {/* Verifications */}
      {Boolean(detail.verifications) && (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 sm:p-4 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Verifications</div>
          <pre className="rounded-lg border border-white/10 bg-black/40 p-2 sm:p-3 text-[10px] sm:text-[11px] text-zinc-300 overflow-auto max-h-40 sm:max-h-48">
            {JSON.stringify(detail.verifications, null, 2)}
          </pre>
        </div>
      )}

      {/* Quick links */}
      {resolvedPrimaryWallet && (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          <a
            href={`https://basescan.org/address/${resolvedPrimaryWallet}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors py-1"
          >
            Basescan <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <a
            href={`https://zora.co/@${detail.preprovZoraHandle || resolvedPrimaryWallet}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors py-1"
          >
            Zora <ExternalLink className="w-2.5 h-2.5" />
          </a>
          {Boolean(detail.preprovFarcasterUsername) && (
            <a
              href={`https://warpcast.com/${detail.preprovFarcasterUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors py-1"
            >
              Warpcast <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function AdminWaitlist() {
  const { isConnected } = useAccount()
  const { isSignedIn } = useSiweAuth()

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // On mobile: null = show list, non-null + mobileShowDetail = show detail
  const [mobileShowDetail, setMobileShowDetail] = useState(false)
  const [decisionNote, setDecisionNote] = useState('')
  const [decisionBusy, setDecisionBusy] = useState(false)
  const [decisionError, setDecisionError] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['adminWaitlistList', query.trim().toLowerCase()],
    enabled: isConnected && isSignedIn,
    queryFn: () => fetchWaitlistList({ q: query.trim().length > 0 ? query.trim().toLowerCase() : null }),
    staleTime: 5_000,
    retry: 0,
  })

  const detailQuery = useQuery({
    queryKey: ['adminWaitlistDetail', selectedId],
    enabled: isConnected && isSignedIn && selectedId !== null,
    queryFn: () => fetchWaitlistDetail({ id: selectedId as number }),
    staleTime: 5_000,
    retry: 0,
  })

  // Auto-select first item on desktop (don't switch to detail view on mobile)
  useEffect(() => {
    if (selectedId !== null) return
    const first = listQuery.data?.items?.[0]
    if (first) setSelectedId(first.id)
  }, [listQuery.data?.items, selectedId])

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items])
  const detail = detailQuery.data?.signup ?? null

  useEffect(() => {
    if (!detail) return
    setDecisionNote(detail.appAccessDecisionNote ?? '')
  }, [detail])

  const errorMessage = useMemo(() => {
    const e = listQuery.error || detailQuery.error
    if (!(e instanceof Error)) return null
    return e.message
  }, [detailQuery.error, listQuery.error])

  const stats = useMemo(() => {
    const total = items.length
    const approved = items.filter((i) => i.appAccessStatus === 'approved').length
    const pending = items.filter((i) => !i.appAccessStatus || i.appAccessStatus === 'pending').length
    const preprovisioned = items.filter((i) => i.preprovisioned).length
    return { total, approved, pending, preprovisioned }
  }, [items])

  function handleSelectItem(id: number) {
    setSelectedId(id)
    setMobileShowDetail(true)
  }

  function handleMobileBack() {
    setMobileShowDetail(false)
  }

  const applyDecision = async (action: 'approve' | 'deny' | 'delete') => {
    if (!selectedId) return
    if (action === 'delete' && !window.confirm(`Permanently delete profile #${selectedId}? This cannot be undone.`)) return
    setDecisionBusy(true)
    setDecisionError(null)
    try {
      const res = await apiFetch(`/api/admin/waitlist/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: selectedId, note: decisionNote.trim().length > 0 ? decisionNote.trim() : null }),
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<any> | null
      if (!res.ok || !json || json.success !== true) {
        throw new Error((json && typeof json.error === 'string' && json.error) || `Update failed (HTTP ${res.status})`)
      }
      if (action === 'delete') {
        setSelectedId(null)
        setMobileShowDetail(false)
      }
      await Promise.all([listQuery.refetch(), action !== 'delete' ? detailQuery.refetch() : Promise.resolve()])
    } catch (e: any) {
      setDecisionError(e?.message ? String(e.message) : 'Update failed')
    } finally {
      setDecisionBusy(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 sm:space-y-1 min-w-0">
          <h1 className="headline text-xl sm:text-2xl lg:text-3xl">Waitlist</h1>
          <div className="text-[11px] sm:text-xs text-zinc-600 hidden sm:block">Review signups, pre-provisioned identities, and manage access.</div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs text-zinc-300 hover:text-white hover:border-white/20 transition-colors shrink-0"
          onClick={() => {
            void listQuery.refetch()
            if (selectedId !== null) void detailQuery.refetch()
          }}
        >
          <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-zinc-300' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-400' },
          { label: 'Approved', value: stats.approved, color: 'text-emerald-400' },
          { label: 'Ready', value: stats.preprovisioned, color: 'text-indigo-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 sm:px-3 sm:py-2.5">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-600">{s.label}</div>
            <div className={`text-base sm:text-lg font-medium ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-lg border border-white/10 bg-black/30 pl-8 sm:pl-9 pr-3 py-2 text-[13px] sm:text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          />
        </div>
        <div className="text-[10px] sm:text-[11px] text-zinc-600 shrink-0">{items.length}</div>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 sm:px-4 py-2.5 sm:py-3 text-[11px] sm:text-xs text-red-200">
          {errorMessage.includes('403') ? 'Admin only' : errorMessage}
        </div>
      ) : null}

      {decisionError ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 sm:px-4 py-2.5 sm:py-3 text-[11px] sm:text-xs text-red-200">{decisionError}</div>
      ) : null}

      {/* Main grid — on mobile, toggle between list and detail */}
      <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-4">

        {/* List panel — hidden on mobile when detail is open */}
        <div className={`rounded-xl border border-white/10 bg-black/30 overflow-hidden ${mobileShowDetail && selectedId ? 'hidden lg:block' : ''}`}>
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/10 text-[11px] sm:text-xs text-zinc-600 flex items-center justify-between">
            <span>Signups</span>
            <span className="text-[10px] sm:text-[11px]">{listQuery.isFetching ? 'Loading...' : ''}</span>
          </div>
          <div className="max-h-[50vh] sm:max-h-[56vh] lg:max-h-[640px] overflow-auto divide-y divide-white/5">
            {items.length === 0 ? (
              <div className="px-3 sm:px-4 py-6 text-[13px] sm:text-sm text-zinc-600">No waitlist entries found.</div>
            ) : (
              items.map((item) => (
                <ListItem
                  key={item.id}
                  item={item}
                  isActive={item.id === selectedId}
                  onSelect={() => handleSelectItem(item.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Detail panel — hidden on mobile when list is shown */}
        <div className={`rounded-xl border border-white/10 bg-black/30 overflow-hidden mt-4 lg:mt-0 ${!mobileShowDetail || !selectedId ? 'hidden lg:block' : ''}`}>
          {/* Mobile back header */}
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/10 flex items-center gap-2">
            <button
              type="button"
              onClick={handleMobileBack}
              className="lg:hidden flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors py-0.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <span className="text-[11px] sm:text-xs text-zinc-600">
              {detail ? `#${detail.id}` : 'Details'}
            </span>
          </div>
          <div className="p-3 sm:p-4 max-h-[70vh] sm:max-h-[60vh] lg:max-h-[600px] overflow-auto">
            {!detail ? (
              <div className="text-[13px] sm:text-sm text-zinc-600">{selectedId ? 'Loading...' : 'Select a signup to view details.'}</div>
            ) : (
              <DetailPanel
                detail={detail}
                decisionNote={decisionNote}
                setDecisionNote={setDecisionNote}
                decisionBusy={decisionBusy}
                onApprove={() => void applyDecision('approve')}
                onDeny={() => void applyDecision('deny')}
                onDelete={() => void applyDecision('delete')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
