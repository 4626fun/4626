import { lazy, Suspense, useEffect } from 'react'
import { X } from 'lucide-react'

const WaitlistFlowWithProviders = lazy(async () => import('./WaitlistFlowWithProviders'))

type WaitlistModalProps = {
  open: boolean
  onClose: () => void
}

export function WaitlistModal({ open, onClose }: WaitlistModalProps) {
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close waitlist modal"
      />

      <div className="relative z-10 w-full max-w-[620px] max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 rounded-xl border border-white/10 bg-black/40 p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label="Close waitlist modal"
        >
          <X className="h-4 w-4" />
        </button>

        <Suspense
          fallback={
            <div className="rounded-3xl border border-white/[0.06] bg-[#0d0d0f]/95 p-6 sm:p-8 text-zinc-400">
              Loading waitlist…
            </div>
          }
        >
          <WaitlistFlowWithProviders variant="modal" />
        </Suspense>
      </div>
    </div>
  )
}
