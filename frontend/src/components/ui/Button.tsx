import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'default' | 'compact' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  hideBaseIcon?: boolean
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all duration-200',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 hover:bg-red-500/20 transition-all duration-200',
}

const sizeClasses: Record<ButtonSize, string> = {
  default: '',
  compact: 'btn-compact',
  lg: 'min-h-[56px] px-6 py-4 text-[15px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'default',
    loading = false,
    icon,
    hideBaseIcon = false,
    disabled,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading

  const classes = [
    variantClasses[variant],
    sizeClasses[size],
    hideBaseIcon || variant !== 'primary' ? 'btn-no-icon' : '',
    loading ? 'btn-no-icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button ref={ref} className={classes} disabled={isDisabled} aria-busy={loading || undefined} {...rest}>
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {children}
        </>
      ) : (
        <>
          {icon ? <span aria-hidden="true">{icon}</span> : null}
          {children}
        </>
      )}
    </button>
  )
})
