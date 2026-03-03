import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ArrowRight, Copy, Loader2, Trophy, ExternalLink, Wallet, ChevronDown, Share2 } from 'lucide-react'
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
import { deriveWaitlistRewards } from '@/lib/rewards/waitlistRewards'

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
      accent ? 'border border-brand-primary/15 bg-brand-primary/5' : 'border border-white/6 bg-black/10',
    ].join(' ')}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span className={['text-[11px] font-medium shrink-0 w-[80px]', accent ? 'text-brand-300' : 'text-zinc-400'].join(' ')}>
        {label}
      </span>
      <span className={['font-mono text-[12px] flex-1 truncate min-w-0', accent ? 'text-zinc-100' : 'text-zinc-300'].join(' ')}>
        {address ? truncAddr(address) : <span className="text-zinc-600 not-italic">—</span>}
      </span>
      {address && (
        <button
          type="button"
          onClick={handleCopy}
          title="Copy"
          className="shrink-0 rounded-md p-1 transition-colors hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
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

function WalletCardCollapsed(props: {
  ownerWallet: string | null
  smartWallet: string | null
  creatorCoin?: CreatorCoinSnap | null
}) {
  const [expanded, setExpanded] = useState(false)
  const ownerWallet = normalizeEvmAddress(props.ownerWallet)
  const smartWallet = normalizeEvmAddress(props.smartWallet)
  const detailsId = 'waitlist-wallet-card-details'

  return (
    <motion.section {...fadeUp} className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-[12px] font-medium text-zinc-300">Wallets</span>
          </div>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-white/8 px-2.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/4 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
          >
            {expanded ? 'Hide details' : 'Show details'}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>

        <AddrRow label="Owner wallet" address={ownerWallet} />

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              id={detailsId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: baseEase }}
              className="overflow-hidden space-y-2"
            >
              <AddrRow label="Smart wallet" address={smartWallet} accent />
              {props.creatorCoin ? (
                <AddrRow
                  label="Creator coin"
                  address={props.creatorCoin.address}
                  icon={
                    props.creatorCoin.imageUrl ? (
                      <img src={props.creatorCoin.imageUrl} className="h-4 w-4 rounded-full object-cover" alt="" />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-primary/20 text-[8px] font-bold text-brand-300">
                        $
                      </span>
                    )
                  }
                />
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="border-t border-white/6 bg-white/2 p-3">
        <a
          href="https://4626.fun/account"
          target="_blank"
          rel="noreferrer"
          className="btn-secondary min-h-10 w-full justify-center border-white/8 text-[12px] text-zinc-300"
        >
          Open account
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </motion.section>
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

function RewardsCard({
  pointsBalance,
  tierLabel,
  badgeEarned,
  referralUrl,
  rank,
  onEarnMore,
  onViewLeaderboard,
  onReferralCopied,
  copyHint,
}: {
  pointsBalance: number
  tierLabel: string
  badgeEarned: boolean
  referralUrl: string
  rank: number | null
  onEarnMore: () => void
  onViewLeaderboard: () => void
  onReferralCopied?: () => void
  copyHint?: string | null
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const shareMenuRef = useRef<HTMLDivElement | null>(null)
  const shareMenuId = 'waitlist-share-menu'
  const xShareHref = `https://x.com/intent/tweet?text=${encodeURIComponent("I'm on the 4626 waitlist. Join with my link:")}&url=${encodeURIComponent(referralUrl)}`
  const farcasterShareHref = `https://warpcast.com/~/compose?text=${encodeURIComponent(`I'm on the 4626 waitlist. Join with my link: ${referralUrl}`)}`

  const onCopyReferral = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralUrl)
      onReferralCopied?.()
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1800)
    } catch {
      setCopyState('error')
      window.setTimeout(() => setCopyState('idle'), 1800)
    }
  }, [onReferralCopied, referralUrl])

  useEffect(() => {
    if (!shareMenuOpen) return
    const onMouseDown = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShareMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShareMenuOpen(false)
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [shareMenuOpen])

  return (
    <motion.section {...fadeUp} className="rounded-2xl border border-white/5 bg-white/3 p-6 sm:p-7">
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
            <div className="inline-flex items-baseline gap-2">
              <span className="text-[44px] leading-[0.92] font-semibold tabular-nums tracking-tight text-white sm:text-[48px]">
                {pointsBalance}
              </span>
              <span className="text-[13px] font-medium tracking-wide text-zinc-400">pts</span>
            </div>
            <span className="rounded-full border border-white/12 bg-white/4 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
              {tierLabel}
            </span>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <CheckCircle2 className={`h-3.5 w-3.5 ${badgeEarned ? 'text-emerald-300' : 'text-zinc-500'}`} aria-hidden="true" />
              <span>{badgeEarned ? 'Your profile is verified' : 'Profile verification pending'}</span>
            </div>
            {rank && rank > 0 ? (
              <div className="text-[12px] text-zinc-500">You&apos;re ranked #{rank} on the leaderboard</div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 border-t border-white/6 pt-4">
          <div className="text-[11px] font-medium text-zinc-500">Referral link</div>
          <div className="font-mono text-[12px] text-zinc-300 truncate" title={referralUrl}>
            {referralUrl}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void onCopyReferral()}
              className="btn-secondary min-h-10 border-brand-primary/25 bg-brand-primary/12 px-3 text-[12px] text-brand-300 hover:border-brand-primary/35 hover:bg-brand-primary/18"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy link
            </button>

            <div ref={shareMenuRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={shareMenuOpen}
                aria-controls={shareMenuOpen ? shareMenuId : undefined}
                onClick={() => setShareMenuOpen((prev) => !prev)}
                className="btn-secondary min-h-10 border-white/8 px-3 text-[12px] text-zinc-300"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${shareMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              <AnimatePresence>
                {shareMenuOpen ? (
                  <motion.div
                    id={shareMenuId}
                    role="menu"
                    aria-label="Share referral link"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease: baseEase }}
                    className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-white/8 bg-[#111214]/92 p-1 shadow-lg backdrop-blur"
                  >
                    <a
                      role="menuitem"
                      href={xShareHref}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setShareMenuOpen(false)}
                      className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-[12px] text-zinc-200 transition-colors hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
                    >
                      <XLogo className="h-3.5 w-3.5" />
                      Share on X
                    </a>
                    <a
                      role="menuitem"
                      href={farcasterShareHref}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setShareMenuOpen(false)}
                      className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-[12px] text-zinc-200 transition-colors hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
                    >
                      <FarcasterLogo className="h-3.5 w-3.5" />
                      Share on Farcaster
                    </a>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {copyState !== 'idle' ? (
              <span aria-live="polite" className={`text-[11px] ${copyState === 'copied' ? 'text-emerald-300' : 'text-rose-300'}`}>
                {copyState === 'copied' ? 'Copied' : 'Copy failed'}
              </span>
            ) : null}
          </div>
          {copyState === 'idle' && copyHint ? <div className="text-[11px] text-emerald-400">{copyHint}</div> : null}
        </div>

        <div className="space-y-3 pt-2">
          <button type="button" onClick={onEarnMore} className="btn-accent btn-no-icon min-h-12 w-full text-[14px]">
            Earn more points
          </button>
          <button
            type="button"
            onClick={onViewLeaderboard}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-1 text-[12px] font-medium text-zinc-400 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
          >
            <Trophy className="h-3.5 w-3.5" />
            View leaderboard
          </button>
        </div>
      </div>
    </motion.section>
  )
}

function HeaderStatusSection(props: {
  displayEmail: string | null
  handle: string | null
  rankDelta: number
}) {
  const identityLabel = props.handle ? `@${props.handle}` : props.displayEmail

  return (
    <motion.section {...scaleIn} className="text-center space-y-4 pt-1">
      <StepIndicator
        steps={[
          { label: 'Connect', status: 'complete' },
          { label: 'Verify', status: 'complete' },
          { label: 'Join', status: 'complete' },
        ]}
      />

      <div className="flex justify-center pt-2">
        <div className="relative">
          <div className="h-12 w-12 rounded-xl border border-white/8 bg-white/4 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-zinc-100" />
          </div>
          <motion.div
            className="absolute inset-0 rounded-xl border border-white/10"
            initial={{ scale: 1, opacity: 0.28 }}
            animate={{ scale: 1.45, opacity: 0 }}
            transition={{ duration: 2.1, repeat: Infinity, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">You&apos;re on the waitlist</h1>
        {identityLabel ? <p className="truncate px-2 text-[13px] text-zinc-300">{identityLabel}</p> : null}
        <div className="flex items-center justify-center gap-2">
          <span className="rounded-full border border-white/12 bg-white/4 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
            Active
          </span>
          {props.rankDelta > 0 ? (
            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/8 px-2.5 py-1 text-[11px] font-medium text-emerald-200/90">
              Moved up {props.rankDelta}
            </span>
          ) : null}
        </div>
      </div>
    </motion.section>
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
  const canOneClickLaunchCoin = Boolean(coinSeed && coinSeed.trim().length >= 2 && coinSeedSymbolClean.length >= 2)
  const shouldShowLaunchCoinCard =
    Boolean(creatorCoinMissing && smartWalletAddressForCoin) &&
    canOneClickLaunchCoin &&
    !(preprovData?.coinAddress && preprovData?.coinSymbol)

  const navigate = useNavigate()
  const referralHandle = useMemo(() => {
    const seeds = [
      preprovData?.farcasterUsername ?? null,
      preprovData?.zoraHandle ?? null,
      displayEmail ? displayEmail.split('@')[0] : null,
    ]
    for (const seed of seeds) {
      const trimmed = typeof seed === 'string' ? seed.trim() : ''
      if (!trimmed) continue
      const cleaned = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
      if (cleaned) return cleaned
    }
    return null
  }, [displayEmail, preprovData?.farcasterUsername, preprovData?.zoraHandle])

  const rewards = useMemo(
    () =>
      deriveWaitlistRewards({
        position: waitlistPosition ?? null,
        fallbackBorderTier: borderTier,
        handle: referralHandle,
        referralCode,
        referralBaseUrl: 'https://4626.fun',
      }),
    [borderTier, referralCode, referralHandle, waitlistPosition],
  )
  const rewardReferralUrl = rewards.referralRef ? rewards.referralUrl : referralLink
  const handleEarnMore = useCallback(() => navigate('/account#account-points-tasks'), [navigate])
  const handleViewLeaderboard = useCallback(() => navigate('/leaderboard'), [navigate])
  const isEnterAppCta = (primaryCta?.label ?? '').trim().toLowerCase() === 'enter app'

  return (
    <AnimatePresence mode="wait">
      {!exiting ? (
        <motion.div
          key="done-card"
          {...fadeUp}
          exit={{ opacity: 0, scale: 0.96, y: -8 }}
          transition={{ duration: 0.24, ease: baseEase }}
          className="space-y-6"
        >
          <HeaderStatusSection displayEmail={displayEmail} handle={referralHandle} rankDelta={rankDelta} />

          <PreprovisionStatus onData={setPreprovData} />

          <RewardsCard
            pointsBalance={rewards.pointsBalance}
            tierLabel={rewards.tierLabel}
            badgeEarned={rewards.badgeEarned}
            referralUrl={rewardReferralUrl}
            rank={rewards.rankTotal}
            onEarnMore={handleEarnMore}
            onViewLeaderboard={handleViewLeaderboard}
          />

          {deployAccessState === 'checking' && !primaryCta ? (
            <CtaLoadingSkeleton />
          ) : primaryCta ? (
            <motion.div {...fadeUp}>
              <button
                type="button"
                disabled={primaryCta.disabled}
                onClick={handleDeployClick}
                className={
                  isEnterAppCta
                    ? 'btn-secondary w-full justify-center rounded-2xl border-white/12 bg-white/4 px-4 py-3 text-[14px] font-semibold text-zinc-100 hover:bg-white/8'
                    : ['btn-primary w-full px-4 py-3.5 text-[15px]', primaryCta.busy ? 'btn-no-icon' : ''].join(' ')
                }
              >
                {primaryCta.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {primaryCta.busy ? primaryCta.busyLabel ?? primaryCta.label : primaryCta.label}
                {!primaryCta.busy ? <ArrowRight className="w-4 h-4" /> : null}
              </button>
            </motion.div>
          ) : deployAccessState === 'waitlist' ? (
            <motion.div {...fadeUp} className="rounded-xl border border-white/8 bg-white/2 px-3 py-2 text-[12px] text-zinc-400">
              We&apos;ll notify you as soon as access opens.
            </motion.div>
          ) : null}

          <WalletCardCollapsed
            ownerWallet={ownerAddress ?? null}
            smartWallet={smartWalletAddress ?? null}
            creatorCoin={creatorCoin}
          />

          {/* X / social verification — earns a profile badge */}
          {borderTier < 1 && showPrivy ? (
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
                  {privyTwitter.username ? (
                    <div className="text-[11px] text-zinc-400">Connected as @{privyTwitter.username}</div>
                  ) : null}
                  {xVerifyError ? <Alert variant="warning">{xVerifyError}</Alert> : null}
                </div>
              )}
            </motion.div>
          ) : null}

          {shouldShowLaunchCoinCard ? (
            <LaunchCoinCard
              mode="one-click"
              defaultName={coinSeed}
              defaultSymbol={coinSeed}
              smartWalletAddress={smartWalletAddressForCoin}
              ownerAddress={ownerAddress ?? null}
              onCoinCreated={onCoinCreated}
            />
          ) : null}

        </motion.div>
      ) : null}
    </AnimatePresence>
  )
})

export default DoneStep
