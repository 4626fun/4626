import { type ReactNode, useMemo } from 'react'
import {
  Modal as CdsModal,
  ModalHeader as CdsModalHeader,
  ModalBody as CdsModalBody,
  ModalFooter as CdsModalFooter,
} from '@coinbase/cds-web/overlays'

/** Map legacy Tailwind maxWidth classes to pixel values for CDS position override */
const MAX_WIDTH_MAP: Record<string, string> = {
  'max-w-xs': '320px',
  'max-w-sm': '384px',
  'sm:max-w-md': '448px',
  'max-w-md': '448px',
  'max-w-lg': '512px',
  'max-w-xl': '576px',
  'sm:max-w-xl': '576px',
  'max-w-2xl': '672px',
}

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
  maxWidth,
  placement,
}: ModalProps) {
  const positionOverride = useMemo(() => {
    if (!maxWidth) return undefined
    const resolved = MAX_WIDTH_MAP[maxWidth] ?? maxWidth
    return { maxWidth: resolved } as any
  }, [maxWidth])

  return (
    <CdsModal
      visible={open}
      onRequestClose={onClose}
      shouldCloseOnEscPress
      dangerouslySetPosition={positionOverride}
      data-placement={placement}
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
