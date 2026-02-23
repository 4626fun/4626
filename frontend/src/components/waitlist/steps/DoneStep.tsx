import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ArrowRight, Copy, Bot, Coins, User, Loader2, Share2, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { WaitlistDoneCelebrationBackground } from '../WaitlistDoneCelebrationBackground'
import { LaunchCoinCard } from '../LaunchCoinCard'
import type { WaitlistState } from '../waitlistTypes'
import { apiFetch } from '@/lib/apiBase'
import { getAppBaseUrl } from '@/lib/host'
import { classifyPreprovisionResponse } from '../preprovisionStatus'

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

type PreprovData = {
  serverWalletAddress: string | null
  coinAddress: string | null
  coinSymbol: string | null
  farcasterUsername: string | null
  zoraHandle: string | null
  alreadyProvisioned?: boolean
}

type DoneStepProps = {
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
  /** Current state of the deploy access check: checking, ready, or waitlist. */
  deployAccessState?: 'checking' | 'ready' | 'waitlist'
  onCopyReferral: () => void
  copyToast?: string | null
  /** Whether the user has no Creator Coin and should see the coin creation card */
  creatorCoinMissing?: boolean
  /** The user's CSW address for coin creation */
  smartWalletAddress?: string | null
  /** The EOA owner address for signing the UserOp */
  ownerAddress?: string | null
  /** Callback when a coin is successfully created */
  onCoinCreated?: (coinAddress: string, symbol: string) => void
}

function truncAddr(addr: string): string {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function AdminDeployLink() {
  const navigate = useNavigate()
  const deployPath = '/deploy?from=waitlist&autologin=1&auth=wallet'
  const deployUrl = useMemo(() => `${getAppBaseUrl()}${deployPath}`, [])
  const handleClick = useCallback(() => {
    if (deployUrl.startsWith('http')) {
      window.location.href = deployUrl
    } else {
      navigate(deployPath)
    }
  }, [deployPath, deployUrl, navigate])
  return (
    <button type="button" onClick={handleClick} className="text-[#0052FF] hover:text-[#3373FF] transition-colors py-1">
      Deploy (Admin)
    </button>
  )
}

function PreprovisionStatus({ onData }: { onData?: (data: PreprovData | null) => void }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [data, setData] = useState<PreprovData | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setStatus('loading')
      try {
        const res = await apiFetch('/api/waitlist/preprovision', { method: 'POST' })
        const json = await res.json().catch(() => null)
        const uiStatus = classifyPreprovisionResponse({ httpStatus: res.status, json })
        if (!cancelled) {
          if (uiStatus === 'done' && json?.data) {
            const next = json.data as PreprovData
            setData(next)
            onData?.(next)
          }
          setStatus(uiStatus)
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    void run()
    return () => { cancelled = true }
  }, [onData])

  if (status === 'idle') return null

  return (
    <motion.div
      {...fadeUp}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2"
    >
      <div className="text-[11px] uppercase tracking-wider text-zinc-600 flex items-center gap-2">
        {status === 'loading' ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin text-indigo-400 shrink-0" />
            <span>Preparing your account...</span>
          </>
        ) : status === 'error' ? (
          'Account prep will retry later'
        ) : (
          <>
            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>Account pre-configured</span>
          </>
        )}
      </div>

      {status === 'done' && data && (
        <div className="space-y-1.5">
          {data.serverWalletAddress && (
            <div className="flex items-center gap-2 text-[11px] min-w-0">
              <Bot className="w-3 h-3 text-zinc-600 shrink-0" />
              <span className="text-zinc-500 shrink-0">Agent signer</span>
              <span className="text-zinc-600 font-mono truncate text-right">{truncAddr(data.serverWalletAddress)}</span>
            </div>
          )}
          {data.coinSymbol && data.coinAddress && (
            <div className="flex items-center gap-2 text-[11px] min-w-0">
              <Coins className="w-3 h-3 text-zinc-600 shrink-0" />
              <span className="text-zinc-500 shrink-0">Creator coin</span>
              <span className="text-zinc-600 font-mono truncate text-right">${data.coinSymbol}</span>
            </div>
          )}
          {(data.farcasterUsername || data.zoraHandle) && (
            <div className="flex items-center gap-2 text-[11px] min-w-0">
              <User className="w-3 h-3 text-zinc-600 shrink-0" />
              <span className="text-zinc-500 shrink-0">Identity</span>
              <span className="text-zinc-600 truncate text-right">
                {[
                  data.farcasterUsername ? `@${data.farcasterUsername}` : null,
                  data.zoraHandle ? `${data.zoraHandle}` : null,
                ].filter(Boolean).join(' / ')}
              </span>
            </div>
          )}
          <div className="text-[10px] text-zinc-700 pt-1">
            When approved, you'll just need one transaction to activate your agent.
          </div>
        </div>
      )}
    </motion.div>
  )
}

/** Pulsing skeleton button shown while the allowlist check is in flight. */
function CtaLoadingSkeleton() {
  return (
    <motion.div {...fadeUp}>
      <div className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
        <span className="text-[14px] sm:text-[15px] text-zinc-500 font-medium">Checking access...</span>
      </div>
    </motion.div>
  )
}

/** CTA shown when the user is waitlisted (not yet approved). */
function WaitlistedCta({
  waitlistPosition,
  onCopyReferral,
}: {
  waitlistPosition: WaitlistState['waitlistPosition']
  onCopyReferral: () => void
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

  const xShareHref = useMemo(() => {
    return `https://x.com/intent/tweet?text=${encodeURIComponent('I just joined the 4626 waitlist. Move up with me:')}`
  }, [])

  const farcasterShareHref = useMemo(() => {
    return `https://warpcast.com/~/compose?text=${encodeURIComponent('I just joined the 4626 waitlist. Move up with me:')}`
  }, [])

  return (
    <motion.div {...fadeUp} className="space-y-4">
      <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 px-4 py-3.5 text-center space-y-1.5">
        <div className="text-[14px] text-amber-200/95 font-medium">
          {rank ? `You're #${rank} on the waitlist` : "You're on the waitlist"}
        </div>
        <div className="text-[12px] text-zinc-500">
          Share your link to move up. We approve in batches.
        </div>
        {nextBand ? (
          <div className="text-[11px] text-amber-200/80">Only {nextBand.remaining} invites to reach top {nextBand.target}.</div>
        ) : null}
      </div>

      <button
        type="button"
        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] text-white text-[14px] sm:text-[15px] font-medium transition-all duration-200 hover:bg-white/[0.06] active:scale-[0.99] cursor-pointer"
        onClick={onCopyReferral}
      >
        <Share2 className="w-4 h-4" />
        Copy Referral Link
      </button>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={xShareHref}
          target="_blank"
          rel="noreferrer"
          className="w-full text-center px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.02] text-zinc-300 text-[12px] hover:bg-white/[0.05]"
        >
          Share on X
        </a>
        <a
          href={farcasterShareHref}
          target="_blank"
          rel="noreferrer"
          className="w-full text-center px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.02] text-zinc-300 text-[12px] hover:bg-white/[0.05]"
        >
          Share on Farcaster
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
  displayEmail,
  isBypassAdmin,
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
}: DoneStepProps) {
  const [exiting, setExiting] = useState(false)
  const [rankDelta, setRankDelta] = useState<number>(0)
  const [preprovData, setPreprovData] = useState<PreprovData | null>(null)

  useEffect(() => {
    const currentRank = waitlistPosition?.rank?.total
    if (typeof currentRank !== 'number' || !Number.isFinite(currentRank) || currentRank <= 0) return
    const key = `cv:waitlist:last-rank:${referralCode || 'anon'}`
    let cancelled = false
    const applyRankDelta = (value: number) => {
      // Avoid synchronous setState inside effect (lint + cascading renders).
      void Promise.resolve().then(() => {
        if (cancelled) return
        setRankDelta(value)
      })
    }
    try {
      const prevRaw = window.localStorage.getItem(key)
      const prev = prevRaw ? Number(prevRaw) : null
      if (typeof prev === 'number' && Number.isFinite(prev) && prev > currentRank) {
        applyRankDelta(prev - currentRank)
      } else {
        applyRankDelta(0)
      }
      window.localStorage.setItem(key, String(currentRank))
    } catch {
      applyRankDelta(0)
    }
    return () => {
      cancelled = true
    }
  }, [referralCode, waitlistPosition?.rank?.total])

  const handleDeployClick = useCallback(async () => {
    if (!primaryCta?.onClick) return
    setExiting(true)
    // Let the exit animation play, then navigate
    await new Promise((r) => setTimeout(r, 280))
    try {
      await primaryCta.onClick()
    } catch {
      // If handoff fails, restore the Done state so the user can retry.
      setExiting(false)
    }
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
          className="relative overflow-hidden space-y-6 sm:space-y-7"
        >
          {/* Celebration background */}
          <div className="absolute inset-0 -z-10">
            <WaitlistDoneCelebrationBackground className="absolute inset-0" />
            <div className="absolute inset-0 bg-[#0a0a0b]/40" />
          </div>

          {/* Success Header */}
          <motion.div {...scaleIn} className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl bg-[#0052FF]/15 border border-[#0052FF]/25 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9 text-[#0052FF]" />
                </div>
                <motion.div
                  className="absolute inset-0 rounded-2xl border-2 border-[#0052FF]/20"
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 1.4, opacity: 0 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                />
              </div>
            </div>

            <div>
              <h1 className="font-doto text-[26px] sm:text-[30px] font-bold text-white tracking-tight">
                You're on the waitlist!
              </h1>
              {rankDelta > 0 ? (
                <div className="mt-2 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-emerald-200">
                  Moved up {rankDelta} spots
                </div>
              ) : null}
              {displayEmail && (
                <p className="text-[13px] sm:text-[14px] text-zinc-500 mt-1.5 truncate px-2">{displayEmail}</p>
              )}
              <p className="text-[12px] sm:text-[13px] text-zinc-600 mt-2 max-w-[36ch] mx-auto">
                We'll notify you when it's your turn. Share your link to move up.
              </p>
            </div>
          </motion.div>

          {/* Pre-provisioning status */}
          <PreprovisionStatus onData={setPreprovData} />

          {/* Launch Creator Coin — shown when the user has no existing Creator Coin */}
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

          {/* CTA area: loading skeleton, deploy button, or waitlisted state */}
          {deployAccessState === 'checking' && !primaryCta ? (
            <CtaLoadingSkeleton />
          ) : primaryCta ? (
            <motion.div {...fadeUp}>
              <button
                type="button"
                disabled={primaryCta.disabled}
                onClick={handleDeployClick}
                className={[
                  'w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-[#0052FF] text-white text-[15px] font-semibold transition-all duration-200 active:scale-[0.99]',
                  primaryCta.disabled
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:bg-[#1a66ff] cursor-pointer shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_8px_32px_-8px_rgba(0,82,255,0.5)]',
                ].join(' ')}
              >
                {primaryCta.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {primaryCta.busy ? primaryCta.busyLabel ?? primaryCta.label : primaryCta.label}
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          ) : deployAccessState === 'waitlist' ? (
            <WaitlistedCta
              waitlistPosition={waitlistPosition ?? null}
              onCopyReferral={onCopyReferral}
            />
          ) : null}

          {/* Quick Referral Link */}
          {referralCode && (
            <motion.div {...fadeUp} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-zinc-500 mb-1">Share with friends</div>
                  <div className="font-mono text-[12px] sm:text-[13px] text-zinc-400 truncate">
                    {referralLink}
                  </div>
                </div>
                <button
                  type="button"
                  className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.02] transition-colors shrink-0"
                  onClick={onCopyReferral}
                >
                  <Copy className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
              {copyToast && (
                <div className="text-[12px] text-emerald-400 mt-2">{copyToast}</div>
              )}
            </motion.div>
          )}

          {/* Admin Link */}
          {isBypassAdmin && (
            <motion.div {...fadeUp} className="flex items-center justify-center text-[13px]">
              <AdminDeployLink />
            </motion.div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
})

export default DoneStep
