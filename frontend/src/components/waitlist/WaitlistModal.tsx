import { Modal } from '@/components/ui/Modal'

import WaitlistFlowWithProviders from './WaitlistFlowWithProviders'

type WaitlistModalProps = {
  open: boolean
  onClose: () => void
}

export function WaitlistModal({ open, onClose }: WaitlistModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Join the waitlist"
      description="Enter your email only in the sign-in window that opens next. Base and Zora linking appear on the next step after your email is verified."
      maxWidth="sm:max-w-[480px]"
      placement="center"
    >
      <div className="space-y-5">
        <p className="text-[13px] leading-snug text-zinc-400 rounded-xl border border-white/10 bg-white/3 px-3 py-2.5">
          No email field below—use the sign-in window that opens when you continue. Base and Zora options show on the next step after your email is verified.
        </p>
        <WaitlistFlowWithProviders variant="modal" />
      </div>
    </Modal>
  )
}
