import { lazy, Suspense } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'

const WaitlistFlowWithProviders = lazy(async () => import('./WaitlistFlowWithProviders'))

type WaitlistModalProps = {
  open: boolean
  onClose: () => void
}

export function WaitlistModal({ open, onClose }: WaitlistModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Waitlist" maxWidth="sm:max-w-[480px]" placement="center">
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        }
      >
        <WaitlistFlowWithProviders variant="modal" />
      </Suspense>
    </Modal>
  )
}
