import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleSlash2,
  FlaskConical,
  Loader2,
  Radio,
  XCircle,
} from 'lucide-react'

import { cn } from '@/lib/shared/utils'
import { deployStatusBadgeClasses, deployStatusLabel, type DeployStatus } from './statusModel'

function StatusIcon({ status }: { status: DeployStatus }) {
  const cls = cn('size-3 shrink-0', status === 'checking' && 'animate-spin motion-reduce:animate-none')
  switch (status) {
    case 'success':
      return <CheckCircle2 className={cls} aria-hidden />
    case 'warning':
      return <AlertTriangle className={cls} aria-hidden />
    case 'error':
      return <XCircle className={cls} aria-hidden />
    case 'pending':
      return <CircleDashed className={cls} aria-hidden />
    case 'checking':
      return <Loader2 className={cls} aria-hidden />
    case 'live':
      return <Radio className={cls} aria-hidden />
    case 'localFork':
      return <FlaskConical className={cls} aria-hidden />
    case 'disabled':
      return <CircleSlash2 className={cls} aria-hidden />
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: DeployStatus
  /** Override the default status label (icon + tone still follow the status). */
  label?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-300 motion-reduce:transition-none',
        deployStatusBadgeClasses(status),
        className,
      )}
    >
      <StatusIcon status={status} />
      {label ?? deployStatusLabel(status)}
    </span>
  )
}
