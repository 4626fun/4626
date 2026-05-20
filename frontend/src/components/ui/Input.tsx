import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'

import { cn } from '@/lib/shared/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  rightSlot?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, rightSlot, className, id, ...props }, ref) => {
    const inputId = id ?? (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined)
    const message = error || helperText

    return (
      <div className="space-y-1.5">
        {label ? (
          <LabelPrimitive.Root
            htmlFor={inputId}
            className="text-xs font-medium uppercase tracking-wide text-vault-subtext"
          >
            {label}
          </LabelPrimitive.Root>
        ) : null}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'flex h-10 w-full rounded-xl border bg-vault-card/60 px-3 py-2 text-sm text-vault-text',
              'placeholder:text-vault-muted transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              error ? 'border-destructive/60' : 'border-input hover:border-white/15',
              rightSlot && 'pr-10',
              className,
            )}
            aria-invalid={error ? true : undefined}
            aria-describedby={message && inputId ? `${inputId}-hint` : undefined}
            {...props}
          />
          {rightSlot ? (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-vault-muted">
              {rightSlot}
            </div>
          ) : null}
        </div>
        {message ? (
          <p
            id={inputId ? `${inputId}-hint` : undefined}
            className={cn('text-xs', error ? 'text-destructive' : 'text-vault-subtext')}
          >
            {message}
          </p>
        ) : null}
      </div>
    )
  },
)

Input.displayName = 'Input'
