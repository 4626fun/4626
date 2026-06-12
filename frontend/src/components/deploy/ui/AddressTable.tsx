import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/utils'

/**
 * Grouped address rows with an ownership-aware heading:
 * `yours` = contracts created for this deploy (blue), `shared` = protocol
 * infrastructure reused by every deploy (sky).
 */
export function AddressTable({
  title,
  tone,
  description,
  iconSrc,
  children,
  className,
}: {
  title?: string
  tone?: 'yours' | 'shared'
  description?: ReactNode
  /** Optional protocol logo rendered in place of the tone dot. */
  iconSrc?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-0.5', className)}>
      {title ? (
        <div className="flex items-center gap-1.5 pb-1 pt-2">
          {iconSrc ? (
            <img src={iconSrc} alt="" aria-hidden="true" loading="lazy" className="size-3.5 shrink-0 opacity-90" />
          ) : (
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 rounded-full',
                tone === 'yours' && 'bg-blue-400',
                tone === 'shared' && 'bg-sky-400/70',
                !tone && 'bg-zinc-600',
              )}
            />
          )}
          <span
            className={cn(
              'text-[10px] font-medium uppercase tracking-wider',
              tone === 'yours' ? 'text-blue-300/90' : tone === 'shared' ? 'text-sky-300/80' : 'text-zinc-600',
            )}
          >
            {title}
          </span>
        </div>
      ) : null}
      {description ? <div className="pb-1 text-[11px] leading-relaxed text-zinc-600">{description}</div> : null}
      {children}
    </div>
  )
}
