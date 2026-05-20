import { type ReactElement, type ReactNode } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '@/lib/shared/utils'

export function TooltipProvider({
  children,
  delayDuration = 300,
}: {
  children: ReactNode
  delayDuration?: number
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={0}>
      {children}
    </TooltipPrimitive.Provider>
  )
}

export interface TooltipProps {
  content: ReactNode
  children: ReactElement
  placement?: 'top' | 'bottom' | 'left' | 'right'
  openDelay?: number
  closeDelay?: number
  hasInteractiveContent?: boolean
}

const SIDE_MAP = {
  top: 'top',
  bottom: 'bottom',
  left: 'left',
  right: 'right',
} as const

export function Tooltip({
  content,
  children,
  placement = 'top',
  openDelay,
  closeDelay,
  hasInteractiveContent,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={openDelay} disableHoverableContent={!hasInteractiveContent}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={SIDE_MAP[placement]}
          sideOffset={6}
          className={cn(
            'z-50 max-w-xs rounded-lg border border-white/10 bg-vault-card-raised px-3 py-2 text-xs text-vault-text shadow-lg',
          )}
          {...(closeDelay != null ? { hideWhenDetached: true } : {})}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-vault-card-raised" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
