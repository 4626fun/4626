import { type ReactNode } from 'react'
import {
  Modal as CdsModal,
  ModalHeader as CdsModalHeader,
  ModalBody as CdsModalBody,
  ModalFooter as CdsModalFooter,
} from '@coinbase/cds-web/overlays'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  className?: string
  showClose?: boolean
  maxWidth?: string
  placement?: 'bottom-sheet' | 'center'
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  showClose = true,
}: ModalProps) {
  return (
    <CdsModal
      visible={open}
      onRequestClose={onClose}
      shouldCloseOnEscPress
    >
      {title || showClose ? (
        <CdsModalHeader
          title={title}
          closeAccessibilityLabel="Close dialog"
        />
      ) : null}
      <CdsModalBody className={className}>
        {description ? <p className="sr-only">{description}</p> : null}
        {children}
      </CdsModalBody>
    </CdsModal>
  )
}

Modal.Footer = function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <CdsModalFooter primaryAction={<>{children}</>} />
  )
}
