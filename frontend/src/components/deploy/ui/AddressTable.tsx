import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/utils'

/** Grouped address rows inside a phase card, with an optional group heading. */
export function AddressTable({
  title,
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-0.5', className)}>
      {title ? (
        <div className="px-2.5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          {title}
        </div>
      ) : null}
      {children}
    </div>
  )
}
