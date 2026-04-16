import { Spinner as CdsSpinner } from '@coinbase/cds-web/loaders'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP: Record<NonNullable<SpinnerProps['size']>, number> = {
  sm: 16,
  md: 24,
  lg: 32,
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span className={className} role="status" aria-label="Loading">
      <CdsSpinner size={SIZE_MAP[size]} color="fgPrimary" />
    </span>
  )
}
