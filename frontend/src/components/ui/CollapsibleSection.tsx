import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  icon?: ReactNode
  defaultOpen?: boolean
  badge?: string | number | null
  children: ReactNode
  className?: string
}

export function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  badge,
  children,
  className = '',
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const prefersReduced = useReducedMotion()

  return (
    <section className={`card rounded-xl overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 p-5 sm:p-6 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 text-white min-w-0">
          {icon ? <span className="shrink-0 text-zinc-400" aria-hidden="true">{icon}</span> : null}
          <h2 className="text-lg font-medium truncate">{title}</h2>
          {badge != null ? (
            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400 tabular-nums">
              {badge}
            </span>
          ) : null}
        </div>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 text-zinc-500 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="content"
            initial={prefersReduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReduced ? undefined : { height: 0, opacity: 0 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 sm:px-6 sm:pb-6 space-y-4">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
