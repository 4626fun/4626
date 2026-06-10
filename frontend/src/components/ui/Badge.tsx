import { type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/shared/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-white/10 bg-white/5 text-zinc-300',
        success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
        warning: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
        error: 'border-red-500/25 bg-red-500/10 text-red-300',
        info: 'border-brand-500/30 bg-brand-500/10 text-brand-200',
        canonical: 'border-brand-500/35 bg-brand-500/15 text-brand-100',
        eoa: 'border-white/10 bg-white/5 text-zinc-400',
        muted: 'border-transparent bg-white/5 text-zinc-500',
      },
      size: {
        xs: 'px-1.5 py-0 text-[9px] uppercase tracking-wide',
        sm: 'px-2 py-0.5 text-[10px] uppercase tracking-wide',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  },
)

interface BadgeProps extends VariantProps<typeof badgeVariants> {
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
    <span className={cn(badgeVariants({ variant, size }), className)}>
      {dot ? (
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
          {children}
        </span>
      ) : (
        children
      )}
    </span>
  )
}
