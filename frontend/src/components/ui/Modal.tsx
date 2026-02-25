import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: string
}

const EASE = [0.4, 0, 0.2, 1] as const

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(container.querySelectorAll<HTMLElement>(selector))
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-[620px]' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement
      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prevOverflow
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus()
        triggerRef.current = null
      }
      return
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = getFocusableElements(dialogRef.current)
        if (focusable.length === 0) {
          e.preventDefault()
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (open && dialogRef.current) {
      const timer = setTimeout(() => {
        const focusable = getFocusableElements(dialogRef.current!)
        if (focusable.length > 0) focusable[0].focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  const motionProps = prefersReduced
    ? {}
    : {
        initial: { opacity: 0, scale: 0.96, y: 8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.97, y: 8 },
        transition: { duration: 0.2, ease: EASE },
      }

  const overlayMotion = prefersReduced
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }

  const handleBackdropClick = useCallback(() => onClose(), [onClose])

  const titleId = title ? 'modal-title' : undefined

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6">
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm border-0 cursor-default"
            onClick={handleBackdropClick}
            aria-label="Close dialog"
            tabIndex={-1}
            {...overlayMotion}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`relative z-10 w-full ${maxWidth} max-h-[92vh] overflow-y-auto rounded-3xl border border-white/[0.06] bg-[#0d0d0f]/95 backdrop-blur-2xl shadow-void`}
            {...motionProps}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between p-4 sm:p-5">
              {title ? (
                <h2 id="modal-title" className="font-doto text-lg font-bold text-white">
                  {title}
                </h2>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-black/40 p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 pb-6 sm:px-6 sm:pb-8">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
