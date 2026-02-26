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
  default: 'bg-zinc-800 text-zinc-300 border-zinc-700/50',
  success: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  warning: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  error: 'bg-rose-400/10 text-rose-400 border-rose-400/20',
  info: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20',
  canonical: 'bg-brand-primary/10 text-brand-accent border-brand-primary/20',
  eoa: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30',
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
        'inline-flex items-center gap-1 rounded-full border font-medium',
        size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
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
