import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ArrowRight, Copy, Loader2, Trophy, Wallet, Share2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLinkAccount, usePrivy } from '@privy-io/react-auth'
import { LaunchCoinCard } from '../LaunchCoinCard'
import type { WaitlistState } from '../waitlistTypes'
import { apiFetch } from '@/lib/apiBase'
import { isPrivyClientEnabled } from '@/lib/flags'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { classifyPreprovisionResponse } from '../preprovisionStatus'
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
const panelClass = 'bv-panel'

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

function WalletFooter(props: { ownerWallet: string | null }) {
  const [copied, setCopied] = useState(false)
  const address = normalizeEvmAddress(props.ownerWallet)

  const handleCopy = useCallback(() => {
    if (!address) return
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [address])

  if (!address) return null

  return (
    <motion.div {...fadeUp} className="flex items-center gap-2 px-1">
      <Wallet className="h-3 w-3 shrink-0 text-vault-muted" aria-hidden="true" />
      <span className="font-mono text-[11px] text-vault-muted truncate flex-1 min-w-0">
        {truncAddr(address)}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        title="Copy address"
        aria-label="Copy wallet address"
        className="shrink-0 rounded p-0.5 text-vault-muted transition-colors hover:text-vault-subtext focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/40"
      >
        {copied
          ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          : <Copy className="h-3 w-3" />
        }
      </button>
      <span className="text-vault-muted text-[11px]">·</span>
      <a
        href="https://4626.fun/account"
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-[11px] text-vault-muted transition-colors hover:text-vault-subtext focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/40 rounded"
      >
        Account ↗
      </a>
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
    <motion.div {...fadeUp} className="flex items-center gap-2 px-1 text-[12px] text-vault-subtext">
      <Loader2 className="w-3 h-3 animate-spin text-indigo-400 shrink-0" />
      <span>Setting up your account…</span>
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
  primaryCta,
  deployAccessState,
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
  primaryCta?: {
    label: string
    disabled?: boolean
    busy?: boolean
    busyLabel?: string
    onClick?: () => void | Promise<void>
  } | null
  deployAccessState?: 'checking' | 'ready' | 'waitlist'
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

  const isTopRank = typeof rank === 'number' && rank > 0 && rank <= 3

  return (
    <motion.section {...fadeUp} className={`${panelClass} p-4 sm:p-5`}>
      <div className="space-y-4">
        {/* Stats row */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="inline-flex items-baseline gap-1.5">
            <span
              className="text-[40px] leading-[0.92] font-semibold tabular-nums tracking-tight sm:text-[44px]"
              style={{
                background: 'linear-gradient(135deg, #6BA8FF 0%, #C8DCFF 55%, #ffffff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {pointsBalance}
            </span>
            <span className="text-[13px] font-medium tracking-wide text-vault-subtext">pts</span>
          </div>
          <span className="rounded-full border border-vault-borderStrong/55 bg-vault-cardRaised/70 px-2.5 py-1 text-[11px] font-medium text-vault-subtext">
            {tierLabel}
          </span>
        </div>

        {/* Status line */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="inline-flex items-center gap-1.5 text-[12px] text-vault-subtext">
            <CheckCircle2 className={`h-3.5 w-3.5 ${badgeEarned ? 'text-emerald-300' : 'text-zinc-500'}`} aria-hidden="true" />
            <span>{badgeEarned ? 'Profile verified' : 'Verification pending'}</span>
          </div>
          {rank && rank > 0 ? (
            <span className={`inline-flex items-center gap-1 text-[12px] font-medium ${isTopRank ? 'text-amber-300' : 'text-vault-muted'}`}>
              {isTopRank ? <Trophy className="h-3 w-3" aria-hidden="true" /> : null}
              #{rank} on leaderboard
            </span>
          ) : null}
        </div>

        {/* Primary CTA — inside the card, between stats and referral */}
        {deployAccessState === 'checking' && !primaryCta ? (
          <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-vault-border/90 bg-vault-card/70">
            <Loader2 className="w-4 h-4 animate-spin text-vault-subtext" />
            <span className="text-[14px] text-vault-subtext font-medium">Checking access…</span>
          </div>
        ) : primaryCta ? (
          <button
            type="button"
            disabled={primaryCta.disabled}
            onClick={primaryCta.onClick}
            className={['btn-primary w-full px-4 py-3.5 text-[15px]', primaryCta.busy ? 'btn-no-icon' : ''].join(' ')}
          >
            {primaryCta.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {primaryCta.busy ? primaryCta.busyLabel ?? primaryCta.label : primaryCta.label}
            {!primaryCta.busy ? <ArrowRight className="w-4 h-4" /> : null}
          </button>
        ) : deployAccessState === 'waitlist' ? (
          <div className="rounded-xl border border-vault-border/90 bg-vault-card/70 px-3 py-2 text-[12px] text-vault-subtext">
            We&apos;ll notify you as soon as access opens.
          </div>
        ) : null}

        {/* Referral — compact single row with framing */}
        <div className="border-t border-vault-border/80 pt-3 space-y-2">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-medium text-vault-subtext tracking-wide uppercase">Share your link</span>
            <span className="text-[11px] text-vault-muted">+10 pts per invite</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-vault-muted truncate flex-1 min-w-0" title={referralUrl}>
              {referralUrl}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => void onCopyReferral()}
                title="Copy referral link"
                aria-label="Copy referral link"
                className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-vault-border/80 bg-vault-cardRaised/50 text-vault-subtext transition-colors hover:bg-vault-cardRaised/80 hover:text-vault-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
              >
                {copyState === 'copied'
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  : copyState === 'error'
                    ? <Copy className="h-3.5 w-3.5 text-rose-400" />
                    : <Copy className="h-3.5 w-3.5" />
                }
              </button>

              <div ref={shareMenuRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={shareMenuOpen}
                  aria-controls={shareMenuOpen ? shareMenuId : undefined}
                  onClick={() => setShareMenuOpen((prev) => !prev)}
                  title="Share referral link"
                  aria-label="Share referral link"
                  className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-vault-border/80 bg-vault-cardRaised/50 text-vault-subtext transition-colors hover:bg-vault-cardRaised/80 hover:text-vault-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
                >
                  <Share2 className="h-3.5 w-3.5" />
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
                      className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-vault-border/90 bg-vault-card/92 p-1 shadow-lg backdrop-blur"
                    >
                      <a
                        role="menuitem"
                        href={xShareHref}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setShareMenuOpen(false)}
                        className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-[12px] text-vault-text transition-colors hover:bg-vault-cardRaised/72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
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
                        className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-[12px] text-vault-text transition-colors hover:bg-vault-cardRaised/72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
                      >
                        <FarcasterLogo className="h-3.5 w-3.5" />
                        Share on Farcaster
                      </a>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>
          {copyHint ? <div className="text-[11px] text-emerald-400">{copyHint}</div> : null}
        </div>

        {/* Secondary links — inline, minimal */}
        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={onEarnMore}
            className="text-[12px] font-medium text-vault-subtext transition-colors hover:text-vault-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 rounded"
          >
            Earn more points
          </button>
          <span className="text-vault-muted text-[11px]">·</span>
          <button
            type="button"
            onClick={onViewLeaderboard}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-vault-subtext transition-colors hover:text-vault-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 rounded"
          >
            <Trophy className="h-3 w-3" />
            Leaderboard
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
    <motion.section {...scaleIn} className="text-center space-y-2">
      <div className="flex justify-center">
        <motion.div
          className="relative"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 20, delay: 0.05 }}
        >
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(0,52,204,0.35) 0%, rgba(91,168,255,0.18) 100%)', border: '1px solid rgba(91,168,255,0.28)' }}
          >
            <CheckCircle2 className="h-5 w-5 text-[#7DBCFF]" />
          </div>
          <motion.div
            className="absolute inset-0 rounded-xl"
            style={{ border: '1px solid rgba(91,168,255,0.35)' }}
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.55, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
          />
        </motion.div>
      </div>

      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-vault-text">You&apos;re on the waitlist</h1>
        <div className="flex items-center justify-center gap-1.5 text-[12px] text-vault-subtext">
          {identityLabel ? <span className="truncate max-w-[180px]">{identityLabel}</span> : null}
          {identityLabel ? <span className="text-vault-muted">·</span> : null}
          <span className="text-emerald-300/90">Active</span>
          {props.rankDelta > 0 ? (
            <>
              <span className="text-vault-muted">·</span>
              <span className="text-emerald-200/90">↑{props.rankDelta}</span>
            </>
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

  return (
    <AnimatePresence mode="wait">
      {!exiting ? (
        <motion.div
          key="done-card"
          {...fadeUp}
          exit={{ opacity: 0, scale: 0.96, y: -8 }}
          transition={{ duration: 0.24, ease: baseEase }}
          className="space-y-4"
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
            primaryCta={primaryCta ? { ...primaryCta, onClick: handleDeployClick } : null}
            deployAccessState={deployAccessState}
          />

          <WalletFooter ownerWallet={ownerAddress ?? null} />

          {/* X / social verification — earns a profile badge */}
          {borderTier < 1 && showPrivy ? (
            <motion.div {...fadeUp} className={`${panelClass} p-4 space-y-3`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] text-vault-text font-medium">Earn a profile badge</div>
                  <div className="text-[12px] text-vault-subtext mt-0.5 leading-relaxed">
                    Follow <span className="text-vault-text">@4626fun</span> on X to unlock a verified badge on your creator profile.
                  </div>
                </div>
                <div className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border border-vault-borderStrong/55 bg-vault-cardRaised/72 text-vault-subtext">
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
                  <div className="text-[12px] text-vault-subtext">After signing in, connect X and click Verify.</div>
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
                      className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl border border-vault-border bg-vault-cardRaised/65 text-vault-text text-[13px] hover:bg-vault-cardRaised/80 transition-colors"
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
                    <div className="text-[11px] text-vault-subtext">Connected as @{privyTwitter.username}</div>
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
