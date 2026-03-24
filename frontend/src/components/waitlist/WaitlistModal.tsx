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
      title="Account setup"
      description="Sign in with email, then continue directly into canonical smart-wallet setup."
      maxWidth="sm:max-w-[480px]"
      placement="center"
    >
      <WaitlistFlowWithProviders variant="modal" />
    </Modal>
  )
}
