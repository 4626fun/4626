import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Button as CdsButton } from '@coinbase/cds-web/buttons'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const CDS_VARIANT_MAP = {
  primary: 'primary',
  secondary: 'secondary',
  ghost: 'foregroundMuted',
  destructive: 'negative',
} as const

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className, children, ...props }, ref) => {
    return (
      <CdsButton
        ref={ref}
        variant={CDS_VARIANT_MAP[variant]}
        compact={size === 'sm'}
        loading={loading}
        disabled={disabled || loading}
        className={className}
        {...props}
      >
        {children}
      </CdsButton>
    )
  },
)

Button.displayName = 'Button'
