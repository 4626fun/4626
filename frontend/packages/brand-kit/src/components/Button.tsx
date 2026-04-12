import { forwardRef, type ButtonHTMLAttributes } from 'react'

function cn(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(' ')
}

// Clockwise orbit delay sequence for a 3×3 grid (index order 0..8):
//   step:  0  1  2   (top row, left → right)
//          7  4  3   (mid row, left = last, right = 4th)
//          6  5  4   (bot row, right → left)
// Each cell's opacity cycles via pixel-wave-loader-cell; only the timing differs.
const ORBIT_CW_DELAYS = [0, 110, 220, 770, 440, 330, 660, 550, 440] as const

function Spinner(props: { size?: 'sm' | 'md'; className?: string }) {
  const { size = 'md', className } = props
  const cellClass = size === 'sm' ? 'h-1 w-1' : 'h-1.5 w-1.5'
  return (
    <span
      aria-label="Loading"
      role="status"
      className={cn('inline-grid grid-cols-3 gap-[2px] text-brand-primary', className)}
    >
      {Array.from({ length: 9 }).map((_, index) => (
        <span
          key={index}
          className={cn('rounded-[1px] bg-current', cellClass)}
          style={{
            animationName: 'pixel-wave-loader-cell-bright',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationFillMode: 'both',
            animationDuration: '1100ms',
            animationDelay: `${ORBIT_CW_DELAYS[index] ?? 0}ms`,
            opacity: 0.18,
          }}
        />
      ))}
    </span>
  )
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'border border-brand-primary/55 bg-linear-to-r from-brand-primary to-brand-hover text-white shadow-[0_14px_38px_-16px_rgba(0,82,255,0.92)] hover:-translate-y-[1px] hover:from-brand-hover hover:to-brand-primary hover:shadow-[0_22px_42px_-16px_rgba(0,82,255,0.95)] active:translate-y-0 active:scale-[0.99]',
  secondary:
    'border border-white/12 bg-linear-to-b from-white/7 to-white/3 text-vault-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:-translate-y-[1px] hover:border-white/18 hover:from-white/11 hover:to-white/6 hover:text-white',
  ghost:
    'border border-transparent bg-transparent text-vault-subtext hover:border-white/12 hover:bg-white/6 hover:text-vault-text',
  destructive:
    'border border-rose-400/30 bg-linear-to-b from-rose-500/18 to-rose-500/8 text-rose-200 shadow-[0_10px_24px_-18px_rgba(244,63,94,0.9)] hover:-translate-y-[1px] hover:border-rose-300/45 hover:from-rose-500/24 hover:to-rose-500/14',
}

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-11 px-5 text-[15px] rounded-xl gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className, children, ...props }, ref) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1 focus-visible:ring-offset-vault-bg',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none disabled:translate-y-0 disabled:scale-100',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading ? <Spinner size={size === 'sm' ? 'sm' : 'md'} className="shrink-0" /> : null}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
