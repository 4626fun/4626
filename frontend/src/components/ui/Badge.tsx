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

// CDS 8.66's Tag only ships 6 color schemes (green, blue, yellow, purple,
// red, gray). Passing anything else — e.g. `teal` or `orange` — causes a
// destructure crash inside `tagEmphasisColorMap[emphasis][colorScheme]`
// that throws on every render, triggering the nearest error boundary
// (`PrivyProviderSafetyBoundary`) which then rebuilds the tree and
// re-crashes. That infinite crash/reboot loop is why `/portfolio` felt
// glitchy and why WalletConnect re-initialized dozens of times. Keep
// every variant mapped to a scheme CDS actually exports.
const CDS_COLOR_MAP: Record<BadgeVariant, 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple'> = {
  default: 'gray',
  success: 'green',
  warning: 'yellow',
  error: 'red',
  info: 'blue',
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
      colorScheme={CDS_COLOR_MAP[variant]}
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
