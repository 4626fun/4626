import { type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type AlertVariant = 'info' | 'warning' | 'error' | 'success'

const variantConfig: Record<
  AlertVariant,
  { icon: typeof Info; containerClass: string; iconClass: string; textClass: string; titleClass: string }
> = {
  info: {
    icon: Info,
    containerClass: 'bg-white/[0.03] border-white/8 text-zinc-300',
    iconClass: 'text-zinc-400',
    textClass: 'text-zinc-400',
    titleClass: 'text-zinc-300',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'bg-amber-400/[0.04] border-amber-400/15 text-amber-200',
    iconClass: 'text-amber-400',
    textClass: 'text-amber-300/80',
    titleClass: 'text-amber-300',
  },
  error: {
    icon: XCircle,
    containerClass: 'bg-rose-400/[0.04] border-rose-400/15 text-rose-200',
    iconClass: 'text-rose-400',
    textClass: 'text-rose-300/80',
    titleClass: 'text-rose-300',
  },
  success: {
    icon: CheckCircle2,
    containerClass: 'bg-emerald-400/[0.04] border-emerald-400/15 text-emerald-200',
    iconClass: 'text-emerald-400',
    textClass: 'text-emerald-300/80',
    titleClass: 'text-emerald-300',
  },
}

interface AlertProps {
  variant?: AlertVariant
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
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex gap-2.5 p-3 rounded-xl border text-sm',
        config.containerClass,
        className,
      )}
    >
      <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', config.iconClass)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && (
          <p className={cn('font-medium text-[11px] mb-1', config.titleClass)}>
            {title}
          </p>
        )}
        {children && (
          <div className={cn('text-xs leading-relaxed', config.textClass)}>
            {children}
          </div>
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={cn(
              'mt-2 text-[11px] font-medium underline underline-offset-2 hover:no-underline transition-colors',
              config.titleClass,
            )}
          >
            {action.label}
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 opacity-40 hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary rounded"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
