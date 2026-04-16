import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { TextInput } from '@coinbase/cds-web/controls'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  rightSlot?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, rightSlot, className, id, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        id={id}
        label={label}
        helperText={error || helperText}
        variant={error ? 'negative' : 'default'}
        end={rightSlot}
        className={className}
        bordered
        {...(props as any)}
      />
    )
  },
)

Input.displayName = 'Input'
