import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

type ExplorePageShellProps = {
  leading?: ReactNode
  title?: string
  subtitle?: string
  headerContent?: ReactNode
  subnav: ReactNode
  table: ReactNode
  footer?: ReactNode
  /** List routes: hero lives in ExploreListLayout; only filters + table render here. */
  variant?: 'full' | 'table'
}

export function ExplorePageShell({
  leading,
  title,
  subtitle,
  headerContent,
  subnav,
  table,
  footer,
  variant = 'full',
}: ExplorePageShellProps) {
  const isTableVariant = variant === 'table'

  if (isTableVariant) {
    return (
      <>
        <div className="mb-6">{subnav}</div>
        <div className="vault-surface relative overflow-hidden">{table}</div>
        {footer ? <div className="mt-4 text-center text-xs text-zinc-600">{footer}</div> : null}
      </>
    )
  }

  return (
    <div className="relative min-h-screen pt-1 sm:pt-2">
      {leading}
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 pt-2 sm:pt-4 pb-4 sm:pb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-4 sm:mb-6"
        >
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-medium text-white mb-1 sm:mb-2">{title}</h1>
          <p className="text-zinc-400 text-[13px] sm:text-sm">{subtitle}</p>
          {headerContent}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-6"
        >
          {subnav}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="vault-surface relative overflow-hidden"
        >
          {table}
        </motion.div>

        {footer ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-4 text-center text-xs text-zinc-600"
          >
            {footer}
          </motion.div>
        ) : null}
      </div>
    </div>
  )
}
