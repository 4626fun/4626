import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ArrowRight, Copy, Loader2, Share2, Trophy, ExternalLink, Wallet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLinkAccount, usePrivy } from '@privy-io/react-auth'
import { LaunchCoinCard } from '../LaunchCoinCard'
import type { WaitlistState } from '../waitlistTypes'
import { apiFetch } from '@/lib/apiBase'
import { isPrivyClientEnabled } from '@/lib/flags'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { classifyPreprovisionResponse } from '../preprovisionStatus'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { Alert } from '@/components/ui/Alert'

const baseEase = [0.4, 0, 0.2, 1] as const
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: baseEase },
}
const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.18, ease: baseEase },
}

/** Official X (formerly Twitter) logo */
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

/** Official Farcaster logo (the "F" monogram mark) */
function FarcasterLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 1000" fill="currentColor" className={className} aria-hidden="true">
      <path d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z" />
      <path d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.444H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z" />
      <path d="M844.444 253.333H666.667V746.667C654.394 746.667 644.444 756.616 644.444 768.889V795.556H640C627.727 795.556 617.778 805.505 617.778 817.778V844.444H866.667V817.778C866.667 805.505 856.717 795.556 844.444 795.556H840V768.889C840 756.616 830.051 746.667 817.778 746.667V351.111H842.222L871.111 253.333H844.444Z" />
    </svg>
  )
}

let warnedPrivyHookFailure = false
function warnPrivyHookFailure(scope: string, error: unknown) {
  if (warnedPrivyHookFailure) return
  warnedPrivyHookFailure = true
  console.warn(`[waitlist] Privy hook unavailable in ${scope}; hiding X verification`, error)
}

function useSafePrivyHook(enabled: boolean) {
  try {
    const value = usePrivy() as any
    if (!enabled) {
      return { authenticated: false, user: null, getAccessToken: async () => null, login: async () => null } as any
    }
    return value
  } catch (error) {
    warnPrivyHookFailure('usePrivy', error)
    return { authenticated: false, user: null, getAccessToken: async () => null, login: async () => null } as any
  }
}

function useSafeLinkAccountHook(callbacks: any, enabled: boolean) {
  try {
    const value = useLinkAccount(callbacks) as any
    if (!enabled) return { linkTwitter: () => {} } as any
    return value
  } catch (error) {
    warnPrivyHookFailure('useLinkAccount', error)
    return { linkTwitter: () => {} } as any
  }
}

function extractPrivyTwitter(user: any): { subject: string | null; username: string | null } {
  const subjectDirect = typeof user?.twitter?.subject === 'string' ? String(user.twitter.subject).trim() : ''
  const usernameDirect = typeof user?.twitter?.username === 'string' ? String(user.twitter.username).trim() : ''
  if (subjectDirect) return { subject: subjectDirect, username: usernameDirect || null }
  const linked = Array.isArray(user?.linked_accounts) ? user.linked_accounts : Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
  for (const acct of linked) {
    const t = typeof acct?.type === 'string' ? String(acct.type) : ''
    if (t !== 'twitter_oauth') continue
    const subject = typeof acct?.subject === 'string' ? String(acct.subject).trim() : ''
    const username = typeof acct?.username === 'string' ? String(acct.username).trim() : ''
    if (subject) return { subject, username: username || null }
  }
  return { subject: null, username: null }
}

type PreprovData = {
  serverWalletAddress: string | null
  coinAddress: string | null
  coinSymbol: string | null
  farcasterUsername: string | null
  zoraHandle: string | null
  alreadyProvisioned?: boolean
}

type CreatorCoinSnap = {
  address: string
  symbol: string | null
  imageUrl: string | null
}

type DoneStepProps = {
  doneEmail: string | null
  displayEmail: string | null
  isBypassAdmin: boolean
  waitlistPosition: WaitlistState['waitlistPosition']
  referralCode: string | null
  referralLink: string
  primaryCta?:
    | {
        label: string
        href: string
        onClick?: () => void | Promise<void>
        disabled?: boolean
        busy?: boolean
        busyLabel?: string
      }
    | null
  deployAccessState?: 'checking' | 'ready' | 'waitlist'
  onCopyReferral: () => void
  copyToast?: string | null
  creatorCoinMissing?: boolean
  smartWalletAddress?: string | null
  ownerAddress?: string | null
  onCoinCreated?: (coinAddress: string, symbol: string) => void
  onRefreshPosition?: () => void | Promise<void>
  /** Creator coin data to display in wallet card and hero */
  creatorCoin?: CreatorCoinSnap | null
}

function truncAddr(addr: string): string {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function normalizeEvmAddress(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  return raw
}

/** Single-line address row: label | address | copy */
function AddrRow({ label, address, accent, icon }: {
  label: string
  address: string | null
  accent?: boolean
  icon?: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    if (!address) return
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [address])

  return (
    <div className={[
      'flex items-center gap-2.5 rounded-xl px-3 py-2',
      accent ? 'border border-brand-primary/20 bg-brand-primary/6' : 'border border-white/8 bg-black/15',
    ].join(' ')}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span className={['text-[11px] font-medium shrink-0 w-[80px]', accent ? 'text-brand-300' : 'text-zinc-300'].join(' ')}>
        {label}
      </span>
      <span className={['font-mono text-[12px] flex-1 truncate min-w-0', accent ? 'text-white' : 'text-zinc-200'].join(' ')}>
        {address ? truncAddr(address) : <span className="text-zinc-600 not-italic">—</span>}
      </span>
      {address && (
        <button
          type="button"
          onClick={handleCopy}
          title="Copy"
          className="shrink-0 p-1 rounded-md hover:bg-white/8 transition-colors"
        >
          {copied
            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            : <Copy className="w-3.5 h-3.5 text-zinc-500" />
          }
        </button>
      )}
    </div>
  )
}

function WalletSnapshotCard(props: {
  connectedOwnerAddress: string | null
  canonicalSmartWalletAddress: string | null
  creatorCoin?: CreatorCoinSnap | null
}) {
  const connectedOwnerAddress = normalizeEvmAddress(props.connectedOwnerAddress)
  const canonicalSmartWalletAddress = normalizeEvmAddress(props.canonicalSmartWalletAddress)

  return (
    <motion.div {...fadeUp} className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/6">
        <div className="inline-flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5 text-brand-primary" />
          <span className="text-[13px] font-medium text-zinc-200">Wallet</span>
        </div>
        <span className="rounded-full border border-brand-primary/25 bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-300">
          Account ready
        </span>
      </div>

      <div className="p-3 space-y-1.5">
        <AddrRow label="Owner wallet" address={connectedOwnerAddress} />
        <AddrRow label="Smart wallet" address={canonicalSmartWalletAddress} accent />
        {props.creatorCoin && (
          <AddrRow
            label="Creator coin"
            address={props.creatorCoin.address}
            icon={
              props.creatorCoin.imageUrl
                ? <img src={props.creatorCoin.imageUrl} className="w-4 h-4 rounded-full object-cover" alt="" />
                : <span className="w-4 h-4 rounded-full bg-brand-primary/20 flex items-center justify-center text-[8px] font-bold text-brand-300">$</span>
            }
          />
        )}
      </div>

      <div className="px-3 pb-3">
        <a
          href="https://4626.fun/account"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-[12px] font-medium text-zinc-300 hover:bg-white/6 hover:text-white transition-colors"
        >
          Open account
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </motion.div>
  )
}

function PreprovisionStatus({ onData }: { onData?: (data: PreprovData | null) => void }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  useEffect(() => {
    let cancelled = false
    async function run() {
      setStatus('loading')
      try {
        const res = await apiFetch('/api/waitlist/preprovision', { method: 'POST' })
        const json = await res.json().catch(() => null)
        const uiStatus = classifyPreprovisionResponse({ httpStatus: res.status, json })
        if (!cancelled) {
          if (uiStatus === 'done' && json?.data) onData?.(json.data as PreprovData)
          setStatus(uiStatus)
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    void run()
    return () => { cancelled = true }
  }, [onData])

  if (status === 'idle' || status === 'done' || status === 'error') return null

  return (
    <motion.div {...fadeUp} className="flex items-center gap-2 px-1 text-[12px] text-zinc-500">
      <Loader2 className="w-3 h-3 animate-spin text-indigo-400 shrink-0" />
      <span>Setting up your account…</span>
    </motion.div>
  )
}

function CtaLoadingSkeleton() {
  return (
    <motion.div {...fadeUp}>
      <div className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-white/6 bg-white/2">
        <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
        <span className="text-[14px] sm:text-[15px] text-zinc-500 font-medium">Checking access…</span>
      </div>
    </motion.div>
  )
}

/** CTA shown when the user is waitlisted (not yet approved). */
function WaitlistedCta({
  waitlistPosition,
  onCopyReferral,
  referralLink,
  copyToast,
}: {
  waitlistPosition: WaitlistState['waitlistPosition']
  onCopyReferral: () => void
  referralLink: string
  copyToast?: string | null
}) {
  const rank = waitlistPosition?.rank?.total
  const navigate = useNavigate()
  const nextBand = useMemo(() => {
    if (typeof rank !== 'number' || !Number.isFinite(rank) || rank <= 1) return null
    const bands = [500, 250, 100, 50, 25, 10, 5, 1]
    const target = bands.find((b) => rank > b)
    if (!target) return null
    return { target, remaining: Math.max(0, rank - target) }
  }, [rank])

  const xShareHref = `https://x.com/intent/tweet?text=${encodeURIComponent('I just joined the 4626 waitlist. Move up with me:')}&url=${encodeURIComponent(referralLink)}`
  const farcasterShareHref = `https://warpcast.com/~/compose?text=${encodeURIComponent('I just joined the 4626 waitlist. Move up with me: ' + referralLink)}`

  return (
    <motion.div {...fadeUp} className="space-y-3">
      {rank ? (
        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 px-4 py-3 text-center space-y-1">
          <div className="text-[14px] text-amber-200/95 font-medium">#{rank} on the waitlist</div>
          {nextBand ? (
            <div className="text-[11px] text-amber-200/70">{nextBand.remaining} invites to reach top {nextBand.target}</div>
          ) : (
            <div className="text-[12px] text-zinc-400">Share your link to move up faster</div>
          )}
        </div>
      ) : null}

      {/* Referral link with copy */}
      <div className="rounded-2xl border border-white/8 bg-white/2 p-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-medium text-zinc-300 mb-0.5">Your referral link</div>
            <div className="font-mono text-[12px] text-zinc-300 truncate">{referralLink}</div>
          </div>
          <button
            type="button"
            onClick={onCopyReferral}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/8 bg-white/3 text-[12px] font-medium text-zinc-200 hover:bg-white/6 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy
          </button>
        </div>
        {copyToast && <div className="text-[12px] text-emerald-400 mt-2">{copyToast}</div>}
      </div>

      {/* Social share */}
      <div className="grid grid-cols-2 gap-2">
        <a
          href={xShareHref}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-white/8 bg-white/2 text-zinc-200 text-[13px] font-medium hover:bg-white/5 transition-colors"
        >
          <XLogo className="w-3.5 h-3.5" />
          Share on X
        </a>
        <a
          href={farcasterShareHref}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-white/8 bg-white/2 text-zinc-200 text-[13px] font-medium hover:bg-white/5 transition-colors"
        >
          <FarcasterLogo className="w-3.5 h-3.5" />
          Farcaster
        </a>
      </div>

      <button
        type="button"
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-zinc-500 text-[13px] font-medium transition-colors hover:text-zinc-200"
        onClick={() => navigate('/leaderboard')}
      >
        <Trophy className="w-3.5 h-3.5" />
        View Leaderboard
      </button>
    </motion.div>
  )
}

export const DoneStep = memo(function DoneStep({
  doneEmail,
  displayEmail,
  waitlistPosition,
  referralCode,
  referralLink,
  primaryCta,
  deployAccessState,
  onCopyReferral,
  copyToast,
  creatorCoinMissing,
  smartWalletAddress,
  ownerAddress,
  onCoinCreated,
  onRefreshPosition,
  creatorCoin,
}: DoneStepProps) {
  const [exiting, setExiting] = useState(false)
  const [rankDelta, setRankDelta] = useState<number>(0)
  const [preprovData, setPreprovData] = useState<PreprovData | null>(null)
  const borderTier = waitlistPosition?.borderTier ?? 0

  const privyStatus = usePrivyClientStatus()
  const showPrivy = isPrivyClientEnabled()
  const privyHooksEnabled = showPrivy && privyStatus === 'ready'
  const { authenticated: privyAuthed, user: privyUser, getAccessToken, login } = useSafePrivyHook(privyHooksEnabled)
  const privyTwitter = useMemo(() => extractPrivyTwitter(privyUser), [privyUser])
  const twitterConnected = Boolean(privyTwitter.subject)

  const [xLinkBusy, setXLinkBusy] = useState(false)
  const [xLinkError, setXLinkError] = useState<string | null>(null)
  const [xSignInBusy, setXSignInBusy] = useState(false)
  const [xVerifyBusy, setXVerifyBusy] = useState(false)
  const [xVerifyError, setXVerifyError] = useState<string | null>(null)

  const { linkTwitter } = useSafeLinkAccountHook(
    {
      onSuccess: () => { setXLinkBusy(false); setXLinkError(null) },
      onError: (error: unknown) => {
        setXLinkBusy(false)
        const raw = error instanceof Error ? error.message : typeof (error as any)?.message === 'string' ? String((error as any).message) : String(error ?? '')
        const lower = raw.toLowerCase()
        setXLinkError(
          lower.includes('already been linked to another user') || lower.includes('linked to another user')
            ? 'This X account is already linked to another user.'
            : raw || 'Failed to connect X.'
        )
      },
    },
    privyHooksEnabled,
  )

  const handleConnectX = useCallback(() => {
    if (xLinkBusy) return
    setXLinkError(null)
    if (!privyAuthed) { setXLinkError('Sign in again to connect X.'); return }
    setXLinkBusy(true)
    try { linkTwitter() } catch (e: any) {
      setXLinkBusy(false)
      setXLinkError(e?.message ? String(e.message) : 'Failed to connect X.')
    }
  }, [linkTwitter, privyAuthed, xLinkBusy])

  const handleSignInForX = useCallback(async () => {
    if (xSignInBusy) return
    setXLinkError(null)
    setXSignInBusy(true)
    try { await Promise.resolve(login?.()) } catch (e: any) {
      setXLinkError(e?.message ? String(e.message) : 'Sign-in did not complete. Try again.')
    } finally { setXSignInBusy(false) }
  }, [login, xSignInBusy])

  const handleVerifyX = useCallback(async () => {
    if (xVerifyBusy || borderTier >= 1) return
    setXVerifyBusy(true)
    setXVerifyError(null)
    try {
      if (!doneEmail) throw new Error('Missing entry key. Refresh and try again.')
      if (!twitterConnected) throw new Error('Connect X first.')
      if (typeof getAccessToken !== 'function') throw new Error('Sign in again to verify.')
      const privyToken = await getAccessToken().catch(() => null)
      if (!privyToken) throw new Error('Sign in again to verify.')
      const res = await apiFetch('/api/waitlist/verify-x', {
        method: 'POST',
        withCredentials: true,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-privy-token': privyToken },
        body: JSON.stringify({ email: doneEmail }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json || json.success !== true) throw new Error(json?.error ?? `Verification failed (HTTP ${res.status})`)
      if (json?.data?.verified !== true) throw new Error('Follow @4626fun on X first, then click Verify.')
      await Promise.resolve(onRefreshPosition?.())
    } catch (e: any) {
      setXVerifyError(e?.message ? String(e.message) : 'Verification failed')
    } finally { setXVerifyBusy(false) }
  }, [borderTier, doneEmail, getAccessToken, onRefreshPosition, twitterConnected, xVerifyBusy])

  useEffect(() => {
    const currentRank = waitlistPosition?.rank?.total
    if (typeof currentRank !== 'number' || !Number.isFinite(currentRank) || currentRank <= 0) return
    const key = `cv:waitlist:last-rank:${referralCode || 'anon'}`
    let cancelled = false
    const applyRankDelta = (value: number) => { void Promise.resolve().then(() => { if (!cancelled) setRankDelta(value) }) }
    try {
      const prev = window.localStorage.getItem(key)
      const prevNum = prev ? Number(prev) : null
      applyRankDelta(typeof prevNum === 'number' && Number.isFinite(prevNum) && prevNum > currentRank ? prevNum - currentRank : 0)
      window.localStorage.setItem(key, String(currentRank))
    } catch { applyRankDelta(0) }
    return () => { cancelled = true }
  }, [referralCode, waitlistPosition?.rank?.total])

  const handleDeployClick = useCallback(async () => {
    if (!primaryCta?.onClick) return
    setExiting(true)
    await new Promise((r) => setTimeout(r, 280))
    try { await primaryCta.onClick() } catch { setExiting(false) }
  }, [primaryCta])

  const coinSeed = useMemo(() => {
    const raw = preprovData?.farcasterUsername ?? preprovData?.zoraHandle ?? null
    const trimmed = typeof raw === 'string' ? raw.trim() : ''
    if (!trimmed) return null
    return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
  }, [preprovData?.farcasterUsername, preprovData?.zoraHandle])

  const coinSeedSymbolClean = useMemo(() => {
    const raw = coinSeed ? coinSeed.toUpperCase() : ''
    return raw.replace(/[^A-Z0-9]/g, '').slice(0, 8)
  }, [coinSeed])

  const smartWalletAddressForCoin = smartWalletAddress ?? null
  const ownerAddressForCoin = ownerAddress ?? null
  const canOneClickLaunchCoin = Boolean(coinSeed && coinSeed.trim().length >= 2 && coinSeedSymbolClean.length >= 2)
  const shouldShowLaunchCoinCard =
    Boolean(creatorCoinMissing && smartWalletAddressForCoin && ownerAddressForCoin) &&
    canOneClickLaunchCoin &&
    !(preprovData?.coinAddress && preprovData?.coinSymbol)

  return (
    <AnimatePresence mode="wait">
      {!exiting ? (
        <motion.div
          key="done-card"
          {...fadeUp}
          exit={{ opacity: 0, scale: 0.96, y: -8 }}
          transition={{ duration: 0.24, ease: baseEase }}
          className="space-y-5"
        >
          {/* Completed stepper */}
          <StepIndicator
            steps={[
              { label: 'Connect', status: 'complete' },
              { label: 'Verify', status: 'complete' },
              { label: 'Join', status: 'complete' },
            ]}
          />

          {/* Success Header */}
          <motion.div {...scaleIn} className="text-center space-y-3 pt-1">
            <div className="flex justify-center">
              {creatorCoin?.imageUrl ? (
                /* Creator coin logo replaces the check icon */
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/12 shadow-lg">
                    <img src={creatorCoin.imageUrl} className="w-full h-full object-cover" alt={creatorCoin.symbol ?? 'Creator coin'} />
                  </div>
                  <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 border-2 border-vault-bg flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                </div>
              ) : (
                /* Fallback: simple check */
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-white" />
                  </div>
                  <motion.div
                    className="absolute inset-0 rounded-2xl border border-white/12"
                    initial={{ scale: 1, opacity: 0.4 }}
                    animate={{ scale: 1.6, opacity: 0 }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                  />
                </div>
              )}
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                You're on the waitlist
              </h1>
              {rankDelta > 0 && (
                <div className="mt-1.5 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-0.5 text-[11px] font-medium text-emerald-200">
                  ↑ Moved up {rankDelta} spots
                </div>
              )}
              {displayEmail && (
                <p className="text-[13px] text-zinc-300 mt-1.5 truncate px-2">{displayEmail}</p>
              )}
              <p className="text-[13px] text-zinc-400 mt-1 max-w-[38ch] mx-auto">
                We'll notify you when it's your turn.
              </p>
            </div>
          </motion.div>

          {/* Pre-provisioning status (loading only) */}
          <PreprovisionStatus onData={setPreprovData} />

          {/* Wallet snapshot */}
          <WalletSnapshotCard
            connectedOwnerAddress={ownerAddress ?? null}
            canonicalSmartWalletAddress={smartWalletAddress ?? null}
            creatorCoin={creatorCoin}
          />

          {/* X / social verification — earns a profile badge */}
          {borderTier >= 1 ? (
            <motion.div {...fadeUp} className="flex items-center gap-2.5 rounded-2xl border border-emerald-400/20 bg-emerald-500/6 px-4 py-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[13px] text-emerald-200 font-medium">Profile badge earned</span>
                <p className="text-[11px] text-emerald-300/60 mt-0.5">Your creator profile now shows a verified badge</p>
              </div>
              <span className="shrink-0 px-2 py-0.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 text-[10px] font-medium text-emerald-200">
                Tier {borderTier}
              </span>
            </motion.div>
          ) : showPrivy ? (
            <motion.div {...fadeUp} className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] text-white font-medium">Earn a profile badge</div>
                  <div className="text-[12px] text-zinc-400 mt-0.5 leading-relaxed">
                    Follow <span className="text-zinc-200">@4626fun</span> on X to unlock a verified badge on your creator profile.
                  </div>
                </div>
                <div className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10 bg-black/20 text-zinc-400">
                  Tier {borderTier}
                </div>
              </div>

              {!privyAuthed ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => void handleSignInForX()}
                    disabled={xSignInBusy}
                    className={['btn-primary w-full px-4 py-3 text-[14px]', xSignInBusy ? 'btn-no-icon' : ''].join(' ')}
                  >
                    {xSignInBusy ? <Loader2 className="w-4 h-4 animate-spin text-zinc-200" /> : <XLogo className="w-4 h-4" />}
                    {xSignInBusy ? 'Opening…' : 'Sign in to connect X'}
                  </button>
                  <div className="text-[12px] text-zinc-400">After signing in, connect X and click Verify.</div>
                  {xLinkError ? <Alert variant="error">{xLinkError}</Alert> : null}
                </div>
              ) : !twitterConnected ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleConnectX}
                    disabled={xLinkBusy}
                    className={['btn-primary w-full px-4 py-3 text-[14px]', xLinkBusy ? 'btn-no-icon' : ''].join(' ')}
                  >
                    {xLinkBusy ? <Loader2 className="w-4 h-4 animate-spin text-zinc-200" /> : <XLogo className="w-4 h-4" />}
                    {xLinkBusy ? 'Connecting…' : 'Connect X'}
                  </button>
                  {xLinkError ? <Alert variant="error">{xLinkError}</Alert> : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <a
                      href="https://x.com/4626fun"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl border border-white/8 bg-white/2 text-zinc-200 text-[13px] hover:bg-white/5 transition-colors"
                    >
                      <XLogo className="w-3.5 h-3.5" />
                      Follow @4626fun
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleVerifyX()}
                      disabled={xVerifyBusy}
                      className={['btn-primary btn-compact w-full rounded-xl px-3 py-2.5 text-[13px]', xVerifyBusy ? 'btn-no-icon' : ''].join(' ')}
                    >
                      {xVerifyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {xVerifyBusy ? 'Verifying…' : 'Verify'}
                    </button>
                  </div>
                  {privyTwitter.username && (
                    <div className="text-[11px] text-zinc-400">Connected as @{privyTwitter.username}</div>
                  )}
                  {xVerifyError ? <Alert variant="warning">{xVerifyError}</Alert> : null}
                </div>
              )}
            </motion.div>
          ) : null}

          {/* Launch Creator Coin */}
          {shouldShowLaunchCoinCard ? (
            <LaunchCoinCard
              mode="one-click"
              defaultName={coinSeed}
              defaultSymbol={coinSeed}
              smartWalletAddress={smartWalletAddressForCoin}
              ownerAddress={ownerAddressForCoin}
              onCoinCreated={onCoinCreated}
            />
          ) : null}

          {/* CTA area */}
          {deployAccessState === 'checking' && !primaryCta ? (
            <CtaLoadingSkeleton />
          ) : primaryCta ? (
            <motion.div {...fadeUp} className="space-y-3">
              <button
                type="button"
                disabled={primaryCta.disabled}
                onClick={handleDeployClick}
                className={['btn-primary w-full px-4 py-3.5 text-[15px]', primaryCta.busy ? 'btn-no-icon' : ''].join(' ')}
              >
                {primaryCta.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {primaryCta.busy ? primaryCta.busyLabel ?? primaryCta.label : primaryCta.label}
                {!primaryCta.busy && <ArrowRight className="w-4 h-4" />}
              </button>

              {/* Compact share row for approved users */}
              {referralCode && (
                <div className="flex items-center gap-2 rounded-xl border border-white/6 bg-white/2 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-zinc-300 mb-0.5">Share with friends</div>
                    <div className="font-mono text-[11px] text-zinc-400 truncate">{referralLink}</div>
                  </div>
                  <button type="button" onClick={onCopyReferral} className="shrink-0 p-1.5 rounded-lg hover:bg-white/8 transition-colors">
                    <Share2 className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                  {copyToast && <span className="text-[11px] text-emerald-400 shrink-0">{copyToast}</span>}
                </div>
              )}
            </motion.div>
          ) : deployAccessState === 'waitlist' ? (
            <WaitlistedCta
              waitlistPosition={waitlistPosition ?? null}
              onCopyReferral={onCopyReferral}
              referralLink={referralLink}
              copyToast={copyToast}
            />
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
})

export default DoneStep
