import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ExternalLink, ChevronDown, ShieldCheck, Sparkles } from 'lucide-react'
import { useAccount, usePublicClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { getAddress, isAddress } from 'viem'

import { useMiniAppContext } from '@/hooks/useMiniAppContext'
import { useFarcasterAuth } from '@/hooks/useFarcasterAuth'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { getAppBaseUrl, getMarketingBaseUrl } from '@/lib/host'
import { getBasenameProfile } from '@/lib/basename-api'
import { getOnchainReputation } from '@/lib/reputation-aggregator'
import { useZoraProfile } from '@/lib/zora/hooks'
import { usePrivy, useWallets } from '@privy-io/react-auth'

const COINBASE_SMART_WALLET_OWNER_LINK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

function shortAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function safeHttpUrl(url: string | null | undefined): string | null {
  const s = typeof url === 'string' ? url.trim() : ''
  if (!s) return null
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  return null
}

export function IdentityHub() {
  const location = useLocation()

  const mini = useMiniAppContext()
  const farcasterAuth = useFarcasterAuth()
  const siwe = useSiweAuth()
  const { address: wagmiAddress, isConnected } = useAccount()
  const publicClient = usePublicClient()

  const { authenticated: privyAuthed } = usePrivy()
  const { wallets: privyWallets } = useWallets()

  const [menuOpen, setMenuOpen] = useState(false)
  const [embeddedEoa, setEmbeddedEoa] = useState<string | null>(null)

  const canonicalCswAddress = useMemo(() => {
    const ws = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    const normalizeType = (w: any) =>
      String(w?.wallet_client_type ?? w?.walletClientType ?? w?.connector_type ?? w?.connectorType ?? w?.type ?? '')
        .trim()
        .toLowerCase()
    const csw = ws.find((w) => {
      const t = normalizeType(w)
      return t.includes('coinbase_smart_wallet') || t.includes('coinbase-smart-wallet')
    })
    const raw = typeof (csw as any)?.address === 'string' ? String((csw as any).address) : ''
    return isAddress(raw) ? getAddress(raw) : null
  }, [privyWallets])

  const embeddedPrivyWallet = useMemo(() => {
    const ws = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    const normalizeType = (w: any) =>
      String(w?.wallet_client_type ?? w?.walletClientType ?? w?.connector_type ?? w?.connectorType ?? w?.type ?? '')
        .trim()
        .toLowerCase()
    return (
      ws.find((w) => {
        const t = normalizeType(w)
        return t === 'privy' || t.includes('privy') || t.includes('embedded')
      }) ?? null
    )
  }, [privyWallets])

  // Best-effort: fetch the embedded EOA from the embedded wallet provider.
  useEffect(() => {
    let cancelled = false
    if (!privyAuthed || !embeddedPrivyWallet) {
      setEmbeddedEoa(null)
      return
    }
    ;(async () => {
      try {
        const provider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!provider?.request) return
        const accounts = (await provider.request({ method: 'eth_accounts' })) as string[] | null
        const a0 = Array.isArray(accounts) ? accounts[0] : null
        const addr = typeof a0 === 'string' && isAddress(a0) ? getAddress(a0) : null
        if (!cancelled) setEmbeddedEoa(addr)
      } catch {
        if (!cancelled) setEmbeddedEoa(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [embeddedPrivyWallet, privyAuthed])

  const effectiveAddress = useMemo(() => {
    const a =
      (typeof wagmiAddress === 'string' && isAddress(wagmiAddress) ? getAddress(wagmiAddress) : null) ||
      (typeof siwe.authAddress === 'string' && isAddress(siwe.authAddress) ? getAddress(siwe.authAddress) : null) ||
      (typeof farcasterAuth.session?.primaryAddress === 'string' && isAddress(farcasterAuth.session.primaryAddress)
        ? getAddress(farcasterAuth.session.primaryAddress)
        : null)
    return a
  }, [farcasterAuth.session?.primaryAddress, siwe.authAddress, wagmiAddress])

  const basenameQuery = useQuery({
    queryKey: ['basenameProfile', effectiveAddress],
    enabled: !!effectiveAddress,
    queryFn: () => getBasenameProfile(effectiveAddress as string),
    staleTime: 60_000,
    retry: 0,
  })

  const zoraProfileQuery = useZoraProfile(effectiveAddress ?? undefined)

  const reputationQuery = useQuery({
    queryKey: ['onchainReputation', effectiveAddress],
    enabled: !!effectiveAddress,
    queryFn: () => getOnchainReputation(effectiveAddress as string),
    staleTime: 60_000,
    retry: 0,
  })

  const gasFreeQuery = useQuery({
    queryKey: ['cswOwner', canonicalCswAddress, embeddedEoa],
    enabled: !!canonicalCswAddress && !!embeddedEoa && !!publicClient,
    queryFn: async () => {
      const ok = await (publicClient as any).readContract({
        address: canonicalCswAddress,
        abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
        functionName: 'isOwnerAddress',
        args: [embeddedEoa],
      })
      return ok === true
    },
    staleTime: 20_000,
    retry: 0,
  })

  const state = useMemo(() => {
    if (!privyAuthed) return 'guest' as const
    if (gasFreeQuery.data === true) return 'gasfree' as const
    return 'waitlisted' as const
  }, [gasFreeQuery.data, privyAuthed])

  const displayName = useMemo(() => {
    const farcasterName = typeof mini.username === 'string' && mini.username.trim().length > 0 ? `@${mini.username.trim()}` : null
    const bn = basenameQuery.data?.displayName || basenameQuery.data?.name || null
    const zoraHandle = typeof (zoraProfileQuery.data as any)?.handle === 'string' ? String((zoraProfileQuery.data as any).handle) : null
    const zoraDisplay = typeof (zoraProfileQuery.data as any)?.displayName === 'string' ? String((zoraProfileQuery.data as any).displayName) : null
    const best = farcasterName || zoraDisplay || (zoraHandle ? `@${zoraHandle}` : null) || bn
    if (best) return best
    return effectiveAddress ? shortAddress(effectiveAddress) : 'Guest'
  }, [basenameQuery.data?.displayName, basenameQuery.data?.name, effectiveAddress, mini.username, zoraProfileQuery.data])

  const avatarUrl = useMemo(() => {
    const farcasterPfp = safeHttpUrl((mini.context as any)?.user?.pfpUrl)
    const bn = safeHttpUrl((basenameQuery.data as any)?.avatar)
    const zoraAvatar =
      safeHttpUrl((zoraProfileQuery.data as any)?.avatar?.medium) || safeHttpUrl((zoraProfileQuery.data as any)?.avatar?.small)
    return farcasterPfp || zoraAvatar || bn
  }, [basenameQuery.data, mini.context, zoraProfileQuery.data])

  const joinWaitlistHref = useMemo(() => {
    const base = getMarketingBaseUrl()
    const path = location.pathname === '/' ? '/#waitlist' : '/waitlist'
    return base.startsWith('http') ? `${base}${path}` : path
  }, [location.pathname])

  const continueHref = useMemo(() => {
    const base = getAppBaseUrl()
    return base.startsWith('http') ? `${base}/deploy` : '/deploy'
  }, [])

  const enableGasFreeHref = useMemo(() => {
    const base = getAppBaseUrl()
    return base.startsWith('http') ? `${base}/deploy#gasfree` : '/deploy#gasfree'
  }, [])

  const deployHref = useMemo(() => {
    const base = getAppBaseUrl()
    return base.startsWith('http') ? `${base}/deploy` : '/deploy'
  }, [])

  const showJoinWaitlist = state === 'guest'
  const showEnableGasFree = state === 'waitlisted' && !!canonicalCswAddress && !!embeddedEoa && gasFreeQuery.data !== true

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="btn-primary flex items-center gap-3"
        title={mini.isBaseApp ? 'Running in Base App' : undefined}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="w-6 h-6 rounded-full object-cover border border-white/10"
            loading="lazy"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10" />
        )}
        <span className="text-sm text-zinc-200 max-w-[140px] truncate">{displayName}</span>
        <ChevronDown className={`w-3 h-3 text-zinc-600 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </button>

      {menuOpen ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-4 w-[320px] card p-4 z-50 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-600">Identity</div>
                <div className="text-sm text-white truncate">{displayName}</div>
                {effectiveAddress ? (
                  <div className="text-[11px] text-zinc-600 font-mono truncate">{shortAddress(effectiveAddress)}</div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {state === 'gasfree' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">
                    <ShieldCheck className="w-3 h-3" />
                    Gas-free
                  </span>
                ) : state === 'waitlisted' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/3 px-2 py-1 text-[10px] text-zinc-400">
                    <ShieldCheck className="w-3 h-3 text-zinc-500" />
                    Waitlisted
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/3 px-2 py-1 text-[10px] text-zinc-500">
                    Guest
                  </span>
                )}
              </div>
            </div>

            {/* Aggregated links (client-agnostic) */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-600">Links</div>
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={mini.username ? `https://farcaster.xyz/${mini.username}` : 'https://farcaster.xyz/4626'}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-zinc-200 hover:border-white/20 transition-colors inline-flex items-center justify-between gap-2"
                >
                  Farcaster <ExternalLink className="w-3 h-3 text-zinc-600" />
                </a>
                <a
                  href={
                    (typeof (zoraProfileQuery.data as any)?.handle === 'string' && (zoraProfileQuery.data as any).handle)
                      ? `https://zora.co/@${String((zoraProfileQuery.data as any).handle)}`
                      : 'https://zora.co/@4626'
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-zinc-200 hover:border-white/20 transition-colors inline-flex items-center justify-between gap-2"
                >
                  Zora <ExternalLink className="w-3 h-3 text-zinc-600" />
                </a>
                <a
                  href="https://base.org/@4626"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-zinc-200 hover:border-white/20 transition-colors inline-flex items-center justify-between gap-2"
                >
                  Base <ExternalLink className="w-3 h-3 text-zinc-600" />
                </a>
              </div>
            </div>

            {/* Reputation (best-effort) */}
            {effectiveAddress ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-600">Reputation</div>
                  <div className="text-[11px] text-zinc-600">
                    {reputationQuery.isLoading ? 'Loading…' : reputationQuery.data ? `${reputationQuery.data.aggregated.totalScore}/100` : '—'}
                  </div>
                </div>
                {reputationQuery.data ? (
                  <div className="text-xs text-zinc-400 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
                    <span className="truncate">
                      {reputationQuery.data.aggregated.reputationLevel}
                      {reputationQuery.data.aggregated.badges.length > 0 ? ` · ${reputationQuery.data.aggregated.badges.slice(0, 2).join(' · ')}` : ''}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-600">No data yet.</div>
                )}
              </div>
            ) : null}

            <div className="grid gap-2">
              {showJoinWaitlist ? (
                (joinWaitlistHref.startsWith('http') ? (
                  <a href={joinWaitlistHref} onClick={() => setMenuOpen(false)} className="btn-accent w-full text-center">
                    Join waitlist
                  </a>
                ) : (
                  <Link to={joinWaitlistHref} onClick={() => setMenuOpen(false)} className="btn-accent w-full text-center">
                    Join waitlist
                  </Link>
                ))
              ) : (
                continueHref.startsWith('http') ? (
                  <a href={continueHref} onClick={() => setMenuOpen(false)} className="btn-primary w-full text-center">
                    Continue
                  </a>
                ) : (
                  <Link to={continueHref} onClick={() => setMenuOpen(false)} className="btn-primary w-full text-center">
                    Continue
                  </Link>
                )
              )}

              {showEnableGasFree ? (
                <a href={enableGasFreeHref} className="btn-primary w-full text-center" onClick={() => setMenuOpen(false)}>
                  Enable Gas-Free Deploys
                </a>
              ) : null}

              {state === 'gasfree' ? (
                <a href={deployHref} className="btn-accent w-full text-center" onClick={() => setMenuOpen(false)}>
                  1‑Click Deploy (Gas‑Free)
                </a>
              ) : null}

              {/* Loading indicator removed after domain merge (was marketing-only) */}

              {mini.isBaseApp ? (
                <div className="text-[11px] text-zinc-600">Base App detected · {isConnected ? 'wallet connected' : 'no wallet connection'}</div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

