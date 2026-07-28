import type { ReactNode } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'

import { WaitlistInvitedBy } from '@/features/waitlist/WaitlistInvitedBy'
import { siteAssets } from '@/config/site'
import { getMarketingBaseUrl } from '@/lib/env/host'

export type WaitlistJoinPanelProps = {
  referralCode: string | null
  children: ReactNode
  socialProof?: ReactNode
  returningWallet?: ReactNode
}

/**
 * Pre-join campaign landing chrome around the email OTP form (children).
 * Auth handlers stay in WaitlistFlow — this is presentation only.
 */
export function WaitlistJoinPanel({
  referralCode,
  children,
  socialProof,
  returningWallet,
}: WaitlistJoinPanelProps) {
  const reduceMotion = useReducedMotion()
  const stagger: Variants | undefined = reduceMotion
    ? undefined
    : {
        hidden: {},
        show: { transition: { staggerChildren: 0.07 } },
      }
  const item: Variants | undefined = reduceMotion
    ? undefined
    : {
        hidden: { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
        },
      }

  return (
    <motion.div
      className="space-y-6 sm:space-y-7"
      data-testid="waitlist-join-panel"
      variants={stagger}
      initial={reduceMotion ? false : 'hidden'}
      animate={reduceMotion ? undefined : 'show'}
    >
      <motion.div variants={item} className="flex items-center justify-between gap-3">
        <a
          href={getMarketingBaseUrl()}
          aria-label="Back to 4626.fun"
          title="Back to 4626.fun"
          className="brand-mark-3d flex size-11 items-center justify-center overflow-hidden rounded-2xl sm:size-12"
        >
          <img
            src={siteAssets.logo}
            alt="4626"
            width={48}
            height={48}
            draggable={false}
            className="size-full scale-[1.316] select-none object-contain"
          />
        </a>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium tracking-[0.08em] text-zinc-400">
          <span
            className="size-1 rounded-full bg-[rgb(var(--brand-primary))]"
            aria-hidden="true"
          />
          Base · Private beta
        </span>
      </motion.div>

      <motion.div variants={item} className="space-y-3 text-center">
        <h1 className="headline text-3xl leading-[1.02] tracking-[-0.03em] sm:text-4xl">
          Creator Vaults.
        </h1>
        <p className="font-serif text-lg italic tracking-[-0.01em] text-[rgb(var(--brand-gold))] sm:text-xl">
          Earn Together.
        </p>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-zinc-400">
          Private beta access for the next generation of creator economies. Join early. Climb the
          list.
        </p>
      </motion.div>

      <motion.div variants={item} className="space-y-3">
        {children}
        <WaitlistInvitedBy referralCode={referralCode} />
      </motion.div>

      {socialProof ? <motion.div variants={item}>{socialProof}</motion.div> : null}
      {returningWallet ? <motion.div variants={item}>{returningWallet}</motion.div> : null}

      <motion.p
        variants={item}
        className="text-center text-[11px] leading-relaxed text-zinc-600"
      >
        Built for creators on Base. No spam. Leave anytime.
      </motion.p>
    </motion.div>
  )
}
