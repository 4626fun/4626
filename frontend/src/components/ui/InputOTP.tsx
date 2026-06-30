import { forwardRef, useId, useRef, useState, type ClipboardEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { cn } from '@/lib/shared/utils'

export type InputOTPStatus = 'default' | 'success' | 'error'

export interface InputOTPProps {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  length?: number
  disabled?: boolean
  status?: InputOTPStatus
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
    status = 'default',
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
  const isSuccess = status === 'success'
  const isError = status === 'error'

  return (
    <motion.div
      className={cn('relative', className)}
      animate={
        isError && !reduceMotion
          ? { x: [0, -6, 6, -4, 4, 0] }
          : { x: 0 }
      }
      transition={{ duration: 0.42, ease: 'easeInOut' }}
    >
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
          const isActive = focused && index === activeIndex && !disabled && !isSuccess
          const isFilled = digit !== ''
          return (
            <motion.div
              key={index}
              initial={false}
              animate={
                isSuccess && !reduceMotion
                  ? { scale: [1, 1.06, 1], borderColor: 'rgba(52, 211, 153, 0.65)' }
                  : { scale: 1 }
              }
              transition={
                isSuccess && !reduceMotion
                  ? { duration: 0.32, ease: 'easeOut', delay: index * 0.05 }
                  : { duration: 0.15 }
              }
              className={cn(
                'relative flex h-14 flex-1 items-center justify-center rounded-[10px] border text-xl font-semibold tabular-nums shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] transition-[border-color,box-shadow,background-color,color] duration-200',
                isSuccess
                  ? 'border-emerald-400/70 bg-emerald-400/[0.16] text-emerald-50'
                  : isError
                    ? 'border-rose-400/50 bg-rose-400/[0.08] text-rose-100'
                    : isActive
                      ? 'border-[rgb(var(--brand-primary)/0.85)] bg-[rgb(var(--brand-primary)/0.08)] text-white shadow-[0_0_0_3px_rgb(var(--brand-primary)/0.18),inset_0_1px_0_rgb(255_255_255/0.06)]'
                      : isFilled
                        ? 'border-white/20 bg-white/[0.05] text-white'
                        : 'border-white/10 bg-white/[0.02] text-white',
                disabled && !isSuccess && 'opacity-60',
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
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
})
