import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'canonical'
  | 'eoa'
  | 'muted'

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-linear-to-b from-zinc-700/45 to-zinc-800/35 text-zinc-300 border-zinc-600/50',
  success: 'bg-linear-to-b from-emerald-400/18 to-emerald-500/10 text-emerald-300 border-emerald-300/32',
  warning: 'bg-linear-to-b from-amber-400/20 to-amber-500/10 text-amber-300 border-amber-300/34',
  error: 'bg-linear-to-b from-rose-400/20 to-rose-500/10 text-rose-300 border-rose-300/34',
  info: 'bg-linear-to-b from-cyan-400/20 to-cyan-500/10 text-cyan-300 border-cyan-300/34',
  canonical: 'bg-linear-to-b from-brand-primary/24 to-brand-primary/12 text-blue-100 border-brand-primary/40',
  eoa: 'bg-linear-to-b from-zinc-600/40 to-zinc-700/28 text-zinc-300 border-zinc-500/30',
  muted: 'bg-transparent text-vault-subtext border-transparent',
}

interface BadgeProps {
  variant?: BadgeVariant
  size?: 'xs' | 'sm'
  dot?: boolean
  className?: string
  children: ReactNode
}

export function Badge({
  variant = 'default',
  size = 'sm',
  dot = false,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium uppercase tracking-[0.08em]',
        size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]',
        variantClasses[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            variant === 'canonical' && 'bg-emerald-400',
            variant === 'eoa' && 'bg-zinc-500',
            variant === 'success' && 'bg-emerald-400',
            variant === 'warning' && 'bg-amber-400',
            variant === 'error' && 'bg-rose-400',
            !['canonical', 'eoa', 'success', 'warning', 'error'].includes(variant) &&
              'bg-current',
          )}
        />
      )}
      {children}
    </span>
  )
}
