import { type CSSProperties, type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { cn } from '@/lib/shared/utils'

type AccountTrayPin = 'bottom' | 'right'

type AccountTrayStyles = {
  container?: CSSProperties
  header?: CSSProperties
  content?: CSSProperties
}

export type AccountTrayProps = {
  pin: AccountTrayPin
  showHandleBar?: boolean
  title?: string
  accessibilityLabel?: string
  closeAccessibilityLabel?: string
  onCloseComplete?: () => void
  onRequestClose?: () => void
  styles?: AccountTrayStyles
  children: ReactNode
}

export function AccountTray({
  pin,
  showHandleBar = false,
  accessibilityLabel = 'Account menu',
  closeAccessibilityLabel = 'Close account menu',
  onCloseComplete,
  onRequestClose,
  styles,
  children,
}: AccountTrayProps) {
  useEffect(() => {
    return () => {
      onCloseComplete?.()
    }
  }, [onCloseComplete])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRequestClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onRequestClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[2px]"
        aria-label={closeAccessibilityLabel}
        onClick={() => onRequestClose?.()}
      />
      <aside
        role="dialog"
        aria-label={accessibilityLabel}
        className={cn(
          'fixed z-[61] flex flex-col border border-white/10 bg-vault-card text-vault-text shadow-2xl',
          pin === 'bottom'
            ? 'inset-x-0 bottom-0 max-h-[min(92vh,720px)] rounded-t-2xl'
            : 'top-4 right-2 bottom-2 w-[26rem] max-w-[calc(100vw-1.5rem)] rounded-2xl',
        )}
        style={pin === 'right' ? styles?.container : undefined}
      >
        {showHandleBar ? (
          <div className="flex justify-center pt-2" style={styles?.header}>
            <span className="h-1 w-10 rounded-full bg-white/20" aria-hidden />
          </div>
        ) : null}
        {onRequestClose ? (
          <button
            type="button"
            className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
            aria-label={closeAccessibilityLabel}
            onClick={() => onRequestClose()}
          >
            <X className="size-4" />
          </button>
        ) : null}
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-y-auto',
            pin === 'bottom' ? 'px-4 pb-4 pt-2' : 'px-3 pb-3 pt-2',
          )}
          style={styles?.content}
        >
          {children}
        </div>
      </aside>
    </>,
    document.body,
  )
}
