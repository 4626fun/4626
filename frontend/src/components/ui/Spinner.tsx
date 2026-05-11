import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP: Record<NonNullable<SpinnerProps['size']>, number> = {
  xs: 12,
  sm: 14,
  md: 20,
  lg: 24,
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span className={className} role="status" aria-label="Loading">
      <PixelWaveLoader
        color="currentColor"
        duration={860}
        gridSize={5}
        name="wave-diag"
        size={SIZE_MAP[size]}
      />
    </span>
  )
}
