import type { ReactNode } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'

import { WaitlistInvitedBy } from '@/features/waitlist/WaitlistInvitedBy'
import { siteAssets } from '@/config/site'
import { getMarketingBaseUrl } from '@/lib/env/host'

export type WaitlistJoinPanelProps = {
  referralCode: string | null
  children: ReactNode
  returningWallet?: ReactNode
}

/**
 * Minimal pre-join chrome around the email OTP form (children).
 * Auth handlers stay in WaitlistFlow — this is presentation only.
 */
export function WaitlistJoinPanel({
  referralCode,
  children,
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
      className="space-y-9 sm:space-y-11"
      data-testid="waitlist-join-panel"
      variants={stagger}
      initial={reduceMotion ? false : 'hidden'}
      animate={reduceMotion ? undefined : 'show'}
    >
      <motion.div variants={item} className="flex flex-col items-center text-center">
        <a
          href={getMarketingBaseUrl()}
          aria-label="Back to 4626.fun"
          title="Back to 4626.fun"
          className="brand-mark-3d flex size-12 items-center justify-center overflow-hidden rounded-2xl sm:size-14"
        >
          <img
            src={siteAssets.logo}
            alt="4626"
            width={56}
            height={56}
            draggable={false}
            className="size-full scale-[1.316] select-none object-contain"
          />
        </a>
        <h1 className="headline mt-4 text-2xl leading-[1.05] tracking-[-0.02em] sm:text-3xl">
          4626<span className="text-[rgb(var(--brand-gold))]">.</span>fun
        </h1>
        <p className="mt-2 text-lg text-zinc-400">Join the waitlist</p>
      </motion.div>

      <motion.div variants={item} className="space-y-3">
        {children}
        <WaitlistInvitedBy referralCode={referralCode} />
      </motion.div>

      {returningWallet ? <motion.div variants={item}>{returningWallet}</motion.div> : null}
    </motion.div>
  )
}
