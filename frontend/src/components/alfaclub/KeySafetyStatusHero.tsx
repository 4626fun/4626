import { AlertTriangle, CheckCircle2, ShieldAlert, type LucideIcon } from 'lucide-react'

export type KeySafetyStatus = 'safe' | 'caution' | 'at-risk'

export type KeySafetyStatusMeta = {
  label: string
  headline: string
  detail: string
  icon: LucideIcon
  ring: string
  glow: string
  badge: string
  iconClass: string
}

export function keySafetyStatusMeta(status: KeySafetyStatus): KeySafetyStatusMeta {
  switch (status) {
    case 'safe':
      return {
        label: 'Safe',
        headline: 'This room is resistant to a hostile takeover',
        detail:
          'At current staking and pot size, seizing the distribution vote would cost more than it could return — so holders are well protected today.',
        icon: CheckCircle2,
        ring: 'ring-sky-400/40',
        glow: 'from-sky-500/20 via-sky-500/5 to-transparent',
        badge: 'bg-sky-500/15 text-sky-100 ring-sky-400/30',
        iconClass: 'text-sky-300',
      }
    case 'caution':
      return {
        label: 'Caution',
        headline: 'Protected for now, but close to the edge',
        detail:
          'A larger pot or more concentrated keys could tip this room into takeover range. Worth watching and shoring up staked share.',
        icon: ShieldAlert,
        ring: 'ring-amber-400/40',
        glow: 'from-amber-500/20 via-amber-500/5 to-transparent',
        badge: 'bg-amber-500/15 text-amber-100 ring-amber-400/30',
        iconClass: 'text-amber-300',
      }
    case 'at-risk':
      return {
        label: 'At risk',
        headline: 'This room is exposed to a hostile takeover',
        detail:
          'A concentrated holder could profitably force a distribution. Raising staked share or trimming the exposed pot would protect holders.',
        icon: AlertTriangle,
        ring: 'ring-red-400/40',
        glow: 'from-red-500/20 via-red-500/5 to-transparent',
        badge: 'bg-red-500/15 text-red-100 ring-red-400/30',
        iconClass: 'text-red-300',
      }
    default: {
      const exhaustive: never = status
      throw new Error(`Unknown status: ${String(exhaustive)}`)
    }
  }
}
