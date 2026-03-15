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
            className="text-[11px] font-medium uppercase tracking-[0.14em] text-vault-subtext"
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
              'w-full h-11 rounded-xl border border-white/12',
              'bg-linear-to-b from-white/6 to-white/3 backdrop-blur-sm',
              'px-3 text-sm text-vault-text placeholder:text-vault-subtext/80',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
              'transition-all duration-200',
              'hover:border-white/18',
              'focus:outline-none focus:border-brand-primary/55 focus:ring-2 focus:ring-brand-primary/35',
              error && 'border-rose-500/45 focus:border-rose-500/55 focus:ring-rose-500/30',
              rightSlot ? 'pr-16' : undefined,
              className,
            )}
            {...props}
          />
          {rightSlot && (
            <div className="absolute right-2 flex items-center rounded-md bg-black/20 px-1.5">{rightSlot}</div>
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
