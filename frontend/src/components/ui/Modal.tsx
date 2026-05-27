import { type ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { cn } from '@/lib/shared/utils'

const MAX_WIDTH_MAP: Record<string, string> = {
  'max-w-xs': 'max-w-xs',
  'max-w-sm': 'max-w-sm',
  'sm:max-w-md': 'sm:max-w-md',
  'max-w-md': 'max-w-md',
  'max-w-lg': 'max-w-lg',
  'max-w-xl': 'max-w-xl',
  'sm:max-w-xl': 'sm:max-w-xl',
  'max-w-2xl': 'max-w-2xl',
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  className?: string
  headerClassName?: string
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
  headerClassName,
  showClose = true,
  maxWidth = 'max-w-lg',
  placement = 'center',
}: ModalProps) {
  const maxWidthClass = maxWidth ? (MAX_WIDTH_MAP[maxWidth] ?? maxWidth) : 'max-w-lg'
  const isBottomSheet = placement === 'bottom-sheet'

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 grid w-full gap-4 border border-border bg-popover p-6 text-popover-foreground shadow-lg',
            isBottomSheet
              ? 'inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl'
              : 'left-1/2 top-1/2 max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl',
            maxWidthClass,
            className,
          )}
          data-placement={placement}
        >
          {title || showClose ? (
            <div className={cn('flex shrink-0 items-start justify-between gap-4', headerClassName)}>
              <div className="min-w-0 space-y-1">
                {title ? (
                  <DialogPrimitive.Title className="text-lg font-semibold leading-tight tracking-tight text-foreground">
                    {title}
                  </DialogPrimitive.Title>
                ) : null}
                {description ? (
                  <DialogPrimitive.Description className="text-sm text-muted-foreground">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>
              {showClose ? (
                <DialogPrimitive.Close
                  type="button"
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Close dialog"
                >
                  <X className="size-4" />
                </DialogPrimitive.Close>
              ) : null}
            </div>
          ) : description ? (
            <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>
          ) : null}
          <div>{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

Modal.Footer = function ModalFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}>
      {children}
    </div>
  )
}
