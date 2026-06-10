import { type ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/shared/utils'

const alertVariants = cva('relative flex gap-3 rounded-xl border px-4 py-3 text-sm', {
  variants: {
    variant: {
      info: 'border-brand-500/25 bg-brand-500/8 text-brand-100',
      warning: 'border-amber-500/25 bg-amber-500/8 text-amber-100',
      error: 'border-red-500/30 bg-red-500/10 text-red-100',
      success: 'border-emerald-500/25 bg-emerald-500/8 text-emerald-100',
    },
  },
  defaultVariants: {
    variant: 'info',
  },
})

const ICON_MAP = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle2,
} as const

interface AlertProps extends VariantProps<typeof alertVariants> {
  title?: string
  children?: ReactNode
  action?: { label: string; onClick: () => void }
  onDismiss?: () => void
  className?: string
}

export function Alert({
  variant = 'info',
  title,
  children,
  action,
  onDismiss,
  className,
}: AlertProps) {
  const Icon = ICON_MAP[variant ?? 'info']

  return (
    <div className={cn(alertVariants({ variant }), className)} role="alert">
      <Icon className="mt-0.5 size-4 shrink-0 opacity-90" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-medium leading-snug">{title}</p> : null}
        {children ? <div className="text-[13px] leading-relaxed opacity-95">{children}</div> : null}
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-2 inline-flex items-center rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/15"
          >
            {action.label}
          </button>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 text-current/70 transition hover:bg-white/10 hover:text-current"
          aria-label="Dismiss"
        >
          <span className="sr-only">Dismiss</span>
          ×
        </button>
      ) : null}
    </div>
  )
}
