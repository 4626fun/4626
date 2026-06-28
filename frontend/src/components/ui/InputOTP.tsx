import { forwardRef, useId, useRef, useState, type ClipboardEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { cn } from '@/lib/shared/utils'

export interface InputOTPProps {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  length?: number
  disabled?: boolean
  id?: string
  className?: string
  'aria-label'?: string
  'aria-describedby'?: string
}

const NON_DIGITS = /\D+/g

/**
 * Segmented one-time-code input. A single transparent input owns focus, value,
 * paste, and mobile OTP autofill (`autoComplete="one-time-code"`); the visible
 * cells are purely presentational and mirror the current value. Each filled
 * cell animates in and the active cell gets a brand focus ring.
 */
export const InputOTP = forwardRef<HTMLInputElement, InputOTPProps>(function InputOTP(
  {
    value,
    onChange,
    onComplete,
    length = 6,
    disabled = false,
    id,
    className,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
  },
  forwardedRef,
) {
  const reduceMotion = useReducedMotion()
  const localRef = useRef<HTMLInputElement | null>(null)
  const [focused, setFocused] = useState(false)
  const generatedId = useId()
  const inputId = id ?? generatedId

  const setRefs = (node: HTMLInputElement | null) => {
    localRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }

  const commit = (next: string) => {
    const sanitized = next.replace(NON_DIGITS, '').slice(0, length)
    onChange(sanitized)
    if (sanitized.length === length) onComplete?.(sanitized)
  }

  const cells = Array.from({ length }, (_, index) => value[index] ?? '')
  const activeIndex = Math.min(value.length, length - 1)

  return (
    <div className={cn('relative', className)}>
      <input
        ref={setRefs}
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        enterKeyHint="go"
        pattern="[0-9]*"
        maxLength={length}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        onChange={(event) => commit(event.target.value)}
        onPaste={(event: ClipboardEvent<HTMLInputElement>) => {
          event.preventDefault()
          commit(event.clipboardData.getData('text'))
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 z-10 h-full w-full cursor-text rounded-xl bg-transparent text-transparent caret-transparent opacity-0 outline-none disabled:cursor-not-allowed"
      />
      <div className="flex items-center gap-2 sm:gap-2.5" aria-hidden="true">
        {cells.map((digit, index) => {
          const isActive = focused && index === activeIndex && !disabled
          const isFilled = digit !== ''
          return (
            <div
              key={index}
              className={cn(
                'relative flex h-14 flex-1 items-center justify-center rounded-[10px] border text-xl font-semibold tabular-nums text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] transition-[border-color,box-shadow,background-color] duration-150',
                isActive
                  ? 'border-[rgb(var(--brand-primary)/0.85)] bg-[rgb(var(--brand-primary)/0.08)] shadow-[0_0_0_3px_rgb(var(--brand-primary)/0.18),inset_0_1px_0_rgb(255_255_255/0.06)]'
                  : isFilled
                    ? 'border-white/20 bg-white/[0.05]'
                    : 'border-white/10 bg-white/[0.02]',
                disabled && 'opacity-60',
              )}
            >
              {isFilled ? (
                <motion.span
                  initial={reduceMotion ? false : { scale: 0.55, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                >
                  {digit}
                </motion.span>
              ) : isActive ? (
                <span className="h-6 w-[2px] animate-pulse rounded-full bg-[rgb(var(--brand-primary))]" />
              ) : (
                <span className="size-1.5 rounded-full bg-white/15" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
})
