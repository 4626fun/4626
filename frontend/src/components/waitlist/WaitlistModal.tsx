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
      title="Waitlist status"
      description="Verify email, track points, and watch your place on the leaderboard while admin approval is pending."
      maxWidth="sm:max-w-[980px]"
      placement="center"
    >
      <WaitlistFlowWithProviders variant="modal" />
    </Modal>
  )
}
