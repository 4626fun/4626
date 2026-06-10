import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/utils'

/**
 * Card surface for the deploy cockpit: soft border, low-opacity glass fill,
 * generous radius. Layered on the existing dark vault palette.
 */
export function DeployCard({
  title,
  subtitle,
  actions,
  children,
  className,
  contentClassName,
  tone = 'default',
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  tone?: 'default' | 'warning' | 'info'
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border bg-white/[0.025] backdrop-blur-[2px]',
        tone === 'default' && 'border-white/[0.08]',
        tone === 'warning' && 'border-amber-500/20 bg-amber-500/[0.04]',
        tone === 'info' && 'border-blue-500/20 bg-blue-500/[0.04]',
        className,
      )}
    >
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title ? <h3 className="text-sm font-medium text-zinc-100">{title}</h3> : null}
            {subtitle ? <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn('px-5 py-4', contentClassName)}>{children}</div>
    </section>
  )
}
