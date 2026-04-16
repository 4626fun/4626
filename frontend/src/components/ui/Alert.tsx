import { type ReactNode } from 'react'
import { Banner } from '@coinbase/cds-web/banner'

type AlertVariant = 'info' | 'warning' | 'error' | 'success'

const CDS_VARIANT_MAP = {
  info: 'informational',
  warning: 'warning',
  error: 'error',
  success: 'promotional',
} as const

const CDS_ICON_MAP = {
  info: 'infoCircle',
  warning: 'warningTriangle',
  error: 'errorCircle',
  success: 'checkCircle',
} as const

interface AlertProps {
  variant?: AlertVariant
  title?: string
  children?: ReactNode
  action?: { label: string; onClick: () => void }
  onDismiss?: () => void
  className?: string
}

export function Alert({
  variant = 'info',
  title,
  children,
  onDismiss,
  className,
}: AlertProps) {
  return (
    <div className={className}>
      <Banner
        variant={CDS_VARIANT_MAP[variant]}
        startIcon={CDS_ICON_MAP[variant] as any}
        title={title}
        showDismiss={!!onDismiss}
        onClose={onDismiss}
        styleVariant="inline"
        bordered
      >
        {children}
      </Banner>
    </div>
  )
}
