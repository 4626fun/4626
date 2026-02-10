import { memo, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, ArrowRight, Copy, Bot, Coins, User, Loader2 } from 'lucide-react'
import { WaitlistDoneCelebrationBackground } from '../WaitlistDoneCelebrationBackground'
import type { WaitlistState } from '../waitlistTypes'
import { apiFetch } from '@/lib/apiBase'

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
  appUrl: string
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
  onCopyReferral: () => void
  copyToast?: string | null
}

function truncAddr(addr: string): string {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function PreprovisionStatus() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [data, setData] = useState<PreprovData | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setStatus('loading')
      try {
        const res = await apiFetch('/api/waitlist/preprovision', { method: 'POST' })
        const json = await res.json().catch(() => null)
        if (!cancelled && json?.success && json.data) {
          setData(json.data as PreprovData)
          setStatus('done')
        } else if (!cancelled) {
          setStatus(res.status === 404 ? 'idle' : 'error')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    void run()
    return () => { cancelled = true }
  }, [])

  if (status === 'idle') return null

  return (
    <motion.div
      {...fadeUp}
      className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 space-y-2"
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

export const DoneStep = memo(function DoneStep({
  displayEmail,
  isBypassAdmin,
  appUrl,
  referralCode,
  referralLink,
  primaryCta,
  onCopyReferral,
  copyToast,
}: DoneStepProps) {
  return (
    <motion.div {...fadeUp} className="relative overflow-hidden space-y-5 sm:space-y-6">
      {/* Celebration background */}
      <div className="absolute inset-0 -z-10">
        <WaitlistDoneCelebrationBackground className="absolute inset-0" />
        <div className="absolute inset-0 bg-[#020202]/60" />
      </div>

      {/* Success Header */}
      <motion.div {...scaleIn} className="text-center space-y-3 sm:space-y-4">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#0052FF]/10 border border-[#0052FF]/20 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 text-[#0052FF]" />
            </div>
            <motion.div
              className="absolute inset-0 rounded-2xl border border-[#0052FF]/30"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
            />
          </div>
        </div>
        
        <div>
          <h1 className="text-[24px] sm:text-[28px] font-light text-white tracking-tight">
            You're on the waitlist!
          </h1>
          {displayEmail && (
            <p className="text-[13px] sm:text-[14px] text-zinc-500 mt-1 truncate px-2">{displayEmail}</p>
          )}
          <p className="text-[12px] sm:text-[13px] text-zinc-600 mt-2">
            We'll notify you when it's your turn.
          </p>
        </div>
      </motion.div>

      {/* Pre-provisioning status */}
      <PreprovisionStatus />

      {/* Primary CTA */}
      {primaryCta ? (
        <motion.div {...fadeUp}>
          <a
            href={primaryCta.href}
            onClick={async (e) => {
              if (primaryCta.disabled) {
                e.preventDefault()
                return
              }
              if (typeof primaryCta.onClick === 'function') {
                e.preventDefault()
                await primaryCta.onClick()
              }
            }}
            aria-disabled={primaryCta.disabled ? 'true' : undefined}
            className={[
              'w-full flex items-center justify-center gap-2 px-4 py-3 sm:py-3.5 rounded-xl bg-[#0052FF] text-white text-[14px] sm:text-[15px] font-medium transition-all duration-200 active:scale-[0.98]',
              primaryCta.disabled
                ? 'opacity-60 cursor-not-allowed pointer-events-none'
                : 'hover:bg-[#0047E1] cursor-pointer',
            ].join(' ')}
          >
            {primaryCta.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {primaryCta.busy ? primaryCta.busyLabel ?? primaryCta.label : primaryCta.label}
            <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>
      ) : null}

      {/* Quick Referral Link */}
      {referralCode && (
        <motion.div {...fadeUp} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-zinc-600 mb-1">Share with friends</div>
              <div className="font-mono text-[11px] sm:text-[12px] text-zinc-400 truncate">
                {referralLink}
              </div>
            </div>
            <button
              type="button"
              className="p-2.5 sm:p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors shrink-0"
              onClick={onCopyReferral}
            >
              <Copy className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
          {copyToast && (
            <div className="text-[11px] text-emerald-400 mt-2">{copyToast}</div>
          )}
        </motion.div>
      )}

      {/* Admin Link */}
      {isBypassAdmin && (
        <motion.div {...fadeUp} className="flex items-center justify-center text-[13px]">
          <a
            href={`${appUrl}/deploy`}
            className="text-[#0052FF] hover:text-[#3373FF] transition-colors py-1"
          >
            Deploy (Admin)
          </a>
        </motion.div>
      )}
    </motion.div>
  )
})

export default DoneStep
