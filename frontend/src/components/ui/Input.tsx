import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  rightSlot?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, rightSlot, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-medium text-vault-subtext"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={
              error
                ? `${inputId}-error`
                : helperText
                  ? `${inputId}-helper`
                  : undefined
            }
            className={cn(
              'w-full h-11 bg-white/[0.04] border border-white/10 rounded-xl',
              'px-3 text-sm text-vault-text placeholder:text-vault-subtext',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent',
              error && 'border-rose-500/50 focus:ring-rose-500',
              rightSlot ? 'pr-16' : undefined,
              className,
            )}
            {...props}
          />
          {rightSlot && (
            <div className="absolute right-2 flex items-center">{rightSlot}</div>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-xs text-rose-400">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-xs text-vault-subtext">
            {helperText}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
