import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Compass, Sparkles, Wallet, X } from 'lucide-react'

/**
 * First-run nudge shown on /portfolio. Helps users who just entered the app
 * find the two or three highest-value starting actions. Dismissible, and the
 * dismissal persists in localStorage so it only appears once.
 *
 * Keeps all state client-local (no backend). When localStorage is unavailable,
 * falls back to in-memory state for the session.
 */

const DISMISS_STORAGE_KEY = 'cv:portfolio:first-actions-dismissed'

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(DISMISS_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeDismissed() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, '1')
  } catch {
    // ignore storage failures (private mode, quota)
  }
}

type FirstActionsNudgeProps = {
  /** When true (default), the nudge is allowed to render. */
  enabled?: boolean
  className?: string
}

type Action = {
  title: string
  description: string
  to: string
  icon: typeof Compass
}

const ACTIONS: readonly Action[] = [
  {
    title: 'Browse creator vaults',
    description: 'Find a creator whose upside you want to share in.',
    to: '/explore/vaults',
    icon: Compass,
  },
  {
    title: 'Swap into a position',
    description: 'Move any Base asset into a vault share in one flow.',
    to: '/swap',
    icon: Wallet,
  },
  {
    title: 'Deploy your own vault',
    description: 'Creators: spin up your ERC-4626 coin + share token.',
    to: '/deploy',
    icon: Sparkles,
  },
] as const

export function PortfolioFirstActionsNudge({ enabled = true, className = '' }: FirstActionsNudgeProps) {
  // Lazy initializer reads localStorage once during the first render so we
  // never render the nudge to a user who already dismissed it. Safe in Vite
  // SPA (no SSR) and in SSR runtimes because `readDismissed` guards window.
  const [dismissed, setDismissed] = useState(() => readDismissed())

  if (!enabled || dismissed) return null

  const handleDismiss = () => {
    writeDismissed()
    setDismissed(true)
  }

  return (
    <div
      className={`relative rounded-2xl border border-brand-primary/20 bg-gradient-to-br from-brand-primary/10 via-black/40 to-black/40 p-4 sm:p-5 ${className}`}
      role="region"
      aria-label="First actions"
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-black/30 text-zinc-400 transition-colors hover:text-white"
        aria-label="Dismiss"
        title="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>

      <div className="bv-kicker text-brand-300 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" /> Welcome to 4626
      </div>
      <div className="mt-1 text-sm text-zinc-200">
        Three things you can do right now — pick whichever fits first.
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.to}
              to={action.to}
              className="group rounded-xl border border-white/10 bg-black/30 p-3 transition-colors hover:border-brand-primary/40 hover:bg-brand-primary/5"
            >
              <div className="flex items-center gap-2 text-xs text-white">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-black/40 text-brand-300">
                  <Icon className="h-3 w-3" />
                </span>
                <span className="font-medium">{action.title}</span>
                <ArrowRight className="ml-auto h-3 w-3 text-zinc-500 transition-colors group-hover:text-brand-300" />
              </div>
              <div className="mt-1.5 text-[11px] text-zinc-500">{action.description}</div>
            </Link>
          )
        })}
      </div>

      <div className="mt-3 text-[10px] text-zinc-600">
        You can bring this back from the help menu any time.
      </div>
    </div>
  )
}

/** Exposed for cases where the help menu wants to re-show the nudge. */
export function resetPortfolioFirstActionsNudge() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(DISMISS_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export { DISMISS_STORAGE_KEY as PORTFOLIO_FIRST_ACTIONS_DISMISS_KEY }
