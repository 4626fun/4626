/**
 * CDS Tooltip wrapper.
 *
 * Wraps the CDS Tooltip from `@coinbase/cds-web/overlays` with a simplified
 * API that matches how tooltips are used in this app.
 */

import { type ReactElement, type ReactNode } from 'react'
import { Tooltip as CdsTooltip } from '@coinbase/cds-web/overlays'

export interface TooltipProps {
  /** The content shown inside the tooltip popup. */
  content: ReactNode
  /** The trigger element (must accept ref). */
  children: ReactElement
  /** Position relative to the trigger. */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** Delay in ms before showing on hover. */
  openDelay?: number
  /** Delay in ms before hiding after pointer leaves. */
  closeDelay?: number
  /** Whether the tooltip contains interactive elements (links, buttons). */
  hasInteractiveContent?: boolean
}

export function Tooltip({
  content,
  children,
  placement,
  openDelay,
  closeDelay,
  hasInteractiveContent,
}: TooltipProps) {
  return (
    <CdsTooltip
      content={content}
      placement={placement}
      openDelay={openDelay}
      closeDelay={closeDelay}
      hasInteractiveContent={hasInteractiveContent}
    >
      {children}
    </CdsTooltip>
  )
}
