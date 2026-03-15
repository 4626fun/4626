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
    containerClass: 'bg-linear-to-b from-white/8 to-white/3 border-white/12 text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
    iconClass: 'text-zinc-400',
    textClass: 'text-zinc-400',
    titleClass: 'text-zinc-300',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'bg-linear-to-b from-amber-400/12 to-amber-500/6 border-amber-300/30 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
    iconClass: 'text-amber-400',
    textClass: 'text-amber-300/80',
    titleClass: 'text-amber-300',
  },
  error: {
    icon: XCircle,
    containerClass: 'bg-linear-to-b from-rose-400/12 to-rose-500/6 border-rose-300/28 text-rose-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
    iconClass: 'text-rose-400',
    textClass: 'text-rose-300/80',
    titleClass: 'text-rose-300',
  },
  success: {
    icon: CheckCircle2,
    containerClass: 'bg-linear-to-b from-emerald-400/12 to-emerald-500/6 border-emerald-300/28 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
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
        'flex gap-2.5 rounded-xl border p-3 text-sm backdrop-blur-md',
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
              'mt-2 inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium transition-all duration-200 hover:-translate-y-px',
              'border-current/30 bg-black/20 hover:bg-black/28',
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
