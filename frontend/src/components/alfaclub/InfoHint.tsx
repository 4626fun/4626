import { HelpCircle } from 'lucide-react'
import { type ReactNode } from 'react'

import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/shared/utils'

type InfoHintProps = {
  /** Accessible label + tooltip body. */
  label: string
  content: ReactNode
  className?: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * Subtle inline "?" affordance. Hover/focus reveals a short explanation so the
 * "how it works" guidance lives next to the thing it explains instead of in a
 * separate section.
 */
export function InfoHint({ label, content, className, placement = 'top' }: InfoHintProps) {
  return (
    <Tooltip
      content={<div className="space-y-1.5 leading-relaxed">{content}</div>}
      placement={placement}
      contentClassName="max-w-[16rem] text-zinc-200"
    >
      <button
        type="button"
        aria-label={label}
        className={cn(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-zinc-500 outline-none transition-colors hover:text-zinc-300 focus-visible:text-zinc-200 focus-visible:ring-1 focus-visible:ring-sky-500/50',
          className,
        )}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
      </button>
    </Tooltip>
  )
}
