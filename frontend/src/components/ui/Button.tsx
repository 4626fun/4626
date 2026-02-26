import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-brand-primary hover:bg-brand-hover text-white shadow-[0_0_20px_rgba(0,82,255,0.2)] hover:shadow-[0_0_28px_rgba(0,82,255,0.35)]',
  secondary:
    'bg-white/5 hover:bg-white/8 text-vault-text border border-white/8 hover:border-white/12',
  ghost:
    'bg-transparent hover:bg-white/5 text-vault-subtext hover:text-vault-text border border-transparent hover:border-white/8',
  destructive:
    'bg-rose-500/8 hover:bg-rose-500/15 text-rose-400 border border-rose-500/15 hover:border-rose-500/25',
}

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-11 px-5 text-[15px] rounded-xl gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1 focus-visible:ring-offset-vault-bg',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <Spinner
            size={size === 'sm' ? 'sm' : 'md'}
            className="shrink-0"
          />
        )}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
