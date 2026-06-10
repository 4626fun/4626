import { useId, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/shared/utils'

/**
 * Accessible disclosure for raw values, salts, debug state, and logs.
 * Collapsed by default; animation respects `prefers-reduced-motion`.
 */
export function AdvancedDetails({
  summary,
  children,
  defaultOpen = false,
  className,
  summaryClassName,
}: {
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
  summaryClassName?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const reducedMotion = useReducedMotion()
  const contentId = useId()

  return (
    <div className={cn('rounded-xl border border-white/[0.06] bg-white/[0.015]', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs text-zinc-400 transition-colors hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500/70',
          summaryClassName,
        )}
      >
        <span className="min-w-0">{summary}</span>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={contentId}
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
