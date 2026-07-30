import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

import { WAITLIST_JOIN_POINTS } from '@/features/waitlist/waitlistGameConstants'
import { PROVIDER_POINTS } from '@/features/waitlist/waitlistTiers'
import { WAITLIST_X_ENGAGEMENT_STEP_POINTS } from '@/features/waitlist/waitlistTwitterEngagement'
import { cn } from '@/lib/shared/utils'

type TaskRowProps = {
  title: string
  description: string
  points: number
  done: boolean
  children?: ReactNode
}

function TaskRow({ title, description, points, done, children }: TaskRowProps) {
  return (
    <div
      className={cn(
        'rounded-xl px-3.5 py-3 transition backdrop-blur-md',
        done
          ? 'bg-emerald-500/[0.06]'
          : 'bg-white/[0.03]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {done ? (
              <Check className="size-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
            ) : null}
            <p
              className={cn(
                'text-[14px] font-medium text-zinc-100',
                done && 'text-zinc-400 line-through decoration-zinc-600',
              )}
            >
              {title}
            </p>
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{description}</p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
            done
              ? 'bg-emerald-500/10 text-emerald-400/90'
              : 'bg-[rgb(var(--brand-gold)/0.12)] text-[rgb(var(--brand-gold))]',
          )}
        >
          {done ? 'Done' : `+${points}`}
        </span>
      </div>
      {!done && children ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}

export type WaitlistTaskStepKey = 'x' | 'wallet' | 'zora'

export type WaitlistTasksPanelProps = {
  joinDone: boolean
  twitterLinked: boolean
  xPhaseDone: boolean
  walletLinked: boolean
  zoraLinked: boolean
  activeStepKey: WaitlistTaskStepKey | null
  /** Live Link X / engagement / wallet / Zora panel for the current step. */
  activeStep: ReactNode
  /** Skipped-step reminders (Link now). */
  reminders?: ReactNode
}

/**
 * Checklist surface for climb actions. Live panels stay server-backed via
 * `activeStep` — only one incomplete step renders the action UI at a time.
 */
export function WaitlistTasksPanel(props: WaitlistTasksPanelProps) {
  const {
    joinDone,
    twitterLinked,
    xPhaseDone,
    walletLinked,
    zoraLinked,
    activeStepKey,
    activeStep,
    reminders,
  } = props

  const xDone = twitterLinked && xPhaseDone

  return (
    <div className="space-y-2.5" data-testid="waitlist-tasks-panel">
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Climb the list
        </h2>
        <p className="mt-1 text-[12px] text-zinc-500">
          Complete tasks, invite creators, and climb toward private beta access.
        </p>
      </div>

      <TaskRow
        title="Join the waitlist"
        description="Email verified. Your spot is reserved."
        points={WAITLIST_JOIN_POINTS}
        done={joinDone}
      />

      <TaskRow
        title="Link X"
        description="Connect your X account, then complete follow and engagement steps."
        points={(PROVIDER_POINTS.twitter ?? 0) + WAITLIST_X_ENGAGEMENT_STEP_POINTS.follow}
        done={xDone}
      >
        {activeStepKey === 'x' ? activeStep : null}
      </TaskRow>

      <TaskRow
        title="Link a wallet"
        description="Optional. Connect an external wallet for identity."
        points={PROVIDER_POINTS.external_eoa ?? 0}
        done={walletLinked}
      >
        {activeStepKey === 'wallet' ? activeStep : null}
      </TaskRow>

      <TaskRow
        title="Link Zora"
        description="Optional. Connect Zora for creator identity."
        points={PROVIDER_POINTS.zora_cross_app ?? 0}
        done={zoraLinked}
      >
        {activeStepKey === 'zora' ? activeStep : null}
      </TaskRow>

      {reminders}
    </div>
  )
}
