import { type ReactNode } from 'react'
import { Tag } from '@coinbase/cds-web/tag'
import { cn } from '@/lib/shared/utils'

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'canonical'
  | 'eoa'
  | 'muted'

const CDS_COLOR_MAP: Record<BadgeVariant, string> = {
  default: 'gray',
  success: 'green',
  warning: 'orange',
  error: 'red',
  info: 'teal',
  canonical: 'blue',
  eoa: 'gray',
  muted: 'gray',
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
    <Tag
      colorScheme={CDS_COLOR_MAP[variant] as any}
      emphasis={variant === 'muted' ? 'low' : 'high'}
      className={cn(
        size === 'xs' && 'text-[9px]',
        className,
      )}
    >
      {dot ? (
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {children}
        </span>
      ) : (
        children
      )}
    </Tag>
  )
}
