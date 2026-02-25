import { type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

type AlertVariant = 'success' | 'warning' | 'error' | 'info'

interface AlertProps {
  variant: AlertVariant
  children: ReactNode
  className?: string
}

const config: Record<AlertVariant, { border: string; bg: string; icon: typeof Info; iconColor: string }> = {
  success: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', icon: CheckCircle2, iconColor: 'text-emerald-400' },
  warning: { border: 'border-amber-500/20', bg: 'bg-amber-500/5', icon: AlertTriangle, iconColor: 'text-amber-400' },
  error: { border: 'border-red-500/20', bg: 'bg-red-500/5', icon: XCircle, iconColor: 'text-red-400' },
  info: { border: 'border-[#0052FF]/20', bg: 'bg-[#0052FF]/6', icon: Info, iconColor: 'text-[#8AB5FF]' },
}

export function Alert({ variant, children, className = '' }: AlertProps) {
  const { border, bg, icon: Icon, iconColor } = config[variant]

  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-2xl border ${border} ${bg} px-4 py-3 text-[13px] leading-relaxed text-zinc-200 ${className}`}
    >
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconColor}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
