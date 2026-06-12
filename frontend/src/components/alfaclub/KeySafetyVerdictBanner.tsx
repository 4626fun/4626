import { CircleAlert, CircleCheck, CircleDollarSign, Info } from 'lucide-react'

import { cn } from '@/lib/shared/utils'
import type { KeyDefenseVerdict } from '@/lib/alfaclub/keyDefense'

type VerdictPresentation = {
  label: string
  icon: typeof CircleCheck
  className: string
  iconClassName: string
}

function verdictPresentation(verdict: KeyDefenseVerdict): VerdictPresentation {
  switch (verdict) {
    case 'safe':
      return {
        label: 'Safe',
        icon: CircleCheck,
        className: 'bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]',
        iconClassName: 'text-zinc-100',
      }
    case 'economically-protected':
      return {
        label: 'Economically protected',
        icon: CircleDollarSign,
        className: 'bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]',
        iconClassName: 'text-zinc-100',
      }
    case 'at-risk':
      return {
        label: 'At risk',
        icon: CircleAlert,
        className: 'bg-red-500/[0.12] shadow-[inset_0_0_0_1px_rgba(239,68,68,0.3)]',
        iconClassName: 'text-red-300',
      }
    case 'not-applicable':
      return {
        label: 'Not applicable',
        icon: Info,
        className: 'bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]',
        iconClassName: 'text-zinc-400',
      }
    default: {
      const exhaustive: never = verdict
      throw new Error(`Unknown verdict: ${String(exhaustive)}`)
    }
  }
}

export type KeySafetyVerdictBannerProps = {
  verdict: KeyDefenseVerdict
  reason: string
}

export function KeySafetyVerdictBanner({ verdict, reason }: KeySafetyVerdictBannerProps) {
  const presentation = verdictPresentation(verdict)
  const Icon = presentation.icon
  return (
    <div role="status" className={cn('flex items-start gap-3 rounded-2xl p-4', presentation.className)}>
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', presentation.iconClassName)} aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{presentation.label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{reason}</p>
      </div>
    </div>
  )
}
