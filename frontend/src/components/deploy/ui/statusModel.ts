/**
 * Shared presentation status model for the Deploy Vault cockpit.
 *
 * This is a display-layer vocabulary only — it never feeds back into deploy
 * logic. Mappers are exhaustive so adding a new status is a compile error
 * until every surface handles it.
 */

export type DeployStatus =
  | 'success'
  | 'warning'
  | 'error'
  | 'pending'
  | 'checking'
  | 'live'
  | 'localFork'
  | 'disabled'

export function deployStatusLabel(status: DeployStatus): string {
  switch (status) {
    case 'success':
      return 'Done'
    case 'warning':
      return 'Needs attention'
    case 'error':
      return 'Blocked'
    case 'pending':
      return 'Pending'
    case 'checking':
      return 'Checking'
    case 'live':
      return 'Live'
    case 'localFork':
      return 'Local fork'
    case 'disabled':
      return 'Disabled'
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

/** Badge tone classes per status — subtle fills, readable text, never neon. */
export function deployStatusBadgeClasses(status: DeployStatus): string {
  switch (status) {
    case 'success':
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
    case 'warning':
      return 'border-amber-500/25 bg-amber-500/10 text-amber-200'
    case 'error':
      return 'border-red-500/25 bg-red-500/10 text-red-300'
    case 'pending':
      return 'border-white/10 bg-white/[0.04] text-zinc-400'
    case 'checking':
      return 'border-sky-500/20 bg-sky-500/10 text-sky-300'
    case 'live':
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
    case 'localFork':
      return 'border-amber-500/25 bg-amber-500/10 text-amber-200'
    case 'disabled':
      return 'border-white/10 bg-white/[0.03] text-zinc-500'
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

/** Text tone for inline values (e.g. address text) per status. */
export function deployStatusTextClasses(status: DeployStatus): string {
  switch (status) {
    case 'success':
    case 'live':
      return 'text-zinc-200'
    case 'warning':
    case 'localFork':
      return 'text-amber-300/90'
    case 'error':
      return 'text-red-300'
    case 'pending':
      return 'text-zinc-400'
    case 'checking':
      return 'text-zinc-500'
    case 'disabled':
      return 'text-zinc-600'
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}
