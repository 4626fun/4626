/**
 * CDS Toast wrapper.
 *
 * Provides a drop-in `toast` object that mirrors the old `sonner` API surface
 * used throughout the app (`toast.success(msg)`, `toast.error(msg)`, etc.)
 * while delegating to CDS `useToast` under the hood.
 *
 * Callers keep using `import { toast } from '@/components/ui/Toast'` exactly
 * like they used `import { toast } from 'sonner'` — no consumer changes needed.
 */

import { useEffect, useRef } from 'react'
import { useToast as useCdsToast } from '@coinbase/cds-web/overlays/useToast'

// ---------- Imperative singleton bridge ----------
// CDS useToast is a hook (requires React context).  We expose a module-level
// `toast` singleton so call-sites can keep doing `toast.success('…')` without
// having to be inside a component that calls the hook.
//
// We use a mutable ref object to avoid the react-hooks/globals lint rule which
// prohibits reassigning module-scope variables inside components/hooks.

type ShowFn = (text: string, options?: { duration?: number }) => void

const _bridge: {
  show: ShowFn
  hide: () => void
  clearQueue: () => void
} = {
  show: () => {},
  hide: () => {},
  clearQueue: () => {},
}

/**
 * Render this once near the app root (inside CDS PortalProvider) to connect
 * the imperative `toast` singleton to the CDS toast context.
 */
export function CdsToastBridge() {
  const cds = useCdsToast()
  const ref = useRef(cds)
  ref.current = cds

  useEffect(() => {
    _bridge.show = (text, options) => ref.current.show(text, options as any)
    _bridge.hide = () => ref.current.hide()
    _bridge.clearQueue = () => ref.current.clearQueue()

    return () => {
      _bridge.show = () => {}
      _bridge.hide = () => {}
      _bridge.clearQueue = () => {}
    }
  }, [])

  return null
}

// ---------- Variant helpers ----------
// CDS Toast doesn't have named variant methods — it uses a `variant` prop.
// We map the old sonner-style calls to CDS variant strings.

const CDS_TOAST_VARIANT_MAP = {
  success: 'bgPositive',
  error: 'bgNegative',
  warning: 'bgWarning',
  info: undefined, // default / primary
} as const

type ToastVariant = keyof typeof CDS_TOAST_VARIANT_MAP

function showVariant(variant: ToastVariant, text: string, options?: { duration?: number }) {
  const cdsVariant = CDS_TOAST_VARIANT_MAP[variant]
  _bridge.show(text, { ...options, ...(cdsVariant ? { variant: cdsVariant } : {}) } as any)
}

/**
 * Drop-in replacement for `import { toast } from 'sonner'`.
 *
 * Usage:
 * ```ts
 * toast.success('Deposit confirmed')
 * toast.error('Something went wrong')
 * toast('Plain message')
 * ```
 */
export const toast = Object.assign(
  (text: string, options?: { duration?: number }) => _bridge.show(text, options),
  {
    success: (text: string, options?: { duration?: number }) => showVariant('success', text, options),
    error: (text: string, options?: { duration?: number }) => showVariant('error', text, options),
    warning: (text: string, options?: { duration?: number }) => showVariant('warning', text, options),
    info: (text: string, options?: { duration?: number }) => showVariant('info', text, options),
    message: (text: string, options?: { duration?: number }) => _bridge.show(text, options),
    dismiss: () => _bridge.hide(),
    hide: () => _bridge.hide(),
    clearQueue: () => _bridge.clearQueue(),
  },
)
