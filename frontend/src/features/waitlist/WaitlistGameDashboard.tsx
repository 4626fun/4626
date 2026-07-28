import type { ReactNode } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'

import { WaitlistInviteCard } from '@/features/waitlist/WaitlistInviteCard'
import { WaitlistMiniLeaderboard } from '@/features/waitlist/WaitlistMiniLeaderboard'
import { WaitlistStatsRow } from '@/features/waitlist/WaitlistStatsRow'
import { WaitlistTasksPanel, type WaitlistTasksPanelProps } from '@/features/waitlist/WaitlistTasksPanel'
import type { WaitlistGameHqData } from '@/features/waitlist/useWaitlistGameHq'
import { siteAssets } from '@/config/site'
import { cn } from '@/lib/shared/utils'

export type WaitlistGameDashboardProps = {
  appAccepted: boolean
  greeting: ReactNode
  hq: WaitlistGameHqData
  tasks: Omit<WaitlistTasksPanelProps, 'joinDone'>
  /** Enter app / Return to AlfaClub CTA when approved. */
  continueSlot?: ReactNode
  socialProof?: ReactNode
}

export function WaitlistGameDashboard(props: WaitlistGameDashboardProps) {
  const { appAccepted, greeting, hq, tasks, continueSlot, socialProof } = props
  const reduceMotion = useReducedMotion()

  const stagger: Variants | undefined = reduceMotion
    ? undefined
    : {
        hidden: {},
        show: { transition: { staggerChildren: 0.06 } },
      }
  const item: Variants | undefined = reduceMotion
    ? undefined
    : {
        hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
        show: {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
        },
      }

  return (
    <motion.div
      className="space-y-5 sm:space-y-6"
      data-testid="waitlist-game-dashboard"
      variants={stagger}
      initial={reduceMotion ? false : 'hidden'}
      animate={reduceMotion ? undefined : 'show'}
    >
      <motion.div variants={item} className="text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="brand-mark-3d flex size-12 items-center justify-center overflow-hidden rounded-2xl sm:size-14">
            <img
              src={siteAssets.logo}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="size-full scale-[1.316] select-none object-contain"
            />
          </span>
          <p
            className={cn(
              'text-[11px] font-semibold uppercase tracking-[0.16em]',
              'text-[rgb(var(--brand-gold))]',
            )}
          >
            {appAccepted ? "You're approved" : "You're on the list"}
          </p>
          <div className="space-y-1">{greeting}</div>
          {!appAccepted ? (
            <p className="max-w-xs text-sm leading-relaxed text-zinc-400">
              Complete tasks, invite creators, and climb toward private beta access.
            </p>
          ) : null}
          {continueSlot ? <div className="w-full pt-1">{continueSlot}</div> : null}
        </div>
      </motion.div>

      <motion.div variants={item}>
        <WaitlistStatsRow
          points={hq.points}
          rank={hq.rank}
          referrals={hq.referrals}
          loading={hq.loading && hq.points === 0}
        />
      </motion.div>

      <motion.div variants={item}>
        <WaitlistInviteCard
          inviteUrl={hq.inviteUrl}
          displayPath={hq.inviteDisplayPath}
          referralCode={hq.referralCode}
        />
      </motion.div>

      <motion.div variants={item}>
        <WaitlistTasksPanel joinDone {...tasks} />
      </motion.div>

      <motion.div variants={item}>
        <WaitlistMiniLeaderboard
          topRows={hq.topRows}
          me={hq.me}
          meOutsideTop={hq.meOutsideTop}
          loading={hq.loading}
        />
      </motion.div>

      {socialProof ? <motion.div variants={item}>{socialProof}</motion.div> : null}

      <motion.p variants={item} className="text-center text-[11px] leading-relaxed text-zinc-600">
        Points update when you complete actions. Rank refreshes as the list moves.
      </motion.p>
    </motion.div>
  )
}
