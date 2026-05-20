/**
 * Sonner-backed toast API (drop-in for legacy `toast.success` / `toast.error` call sites).
 */

import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner'

export function AppToaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'border border-white/10 bg-vault-card text-vault-text shadow-lg rounded-xl font-sans',
          title: 'text-sm text-vault-text',
          description: 'text-vault-subtext',
          closeButton: 'border-white/10 bg-white/5 text-vault-subtext hover:text-vault-text',
        },
      }}
    />
  )
}

/** @deprecated Use AppToaster at app root; kept for one release of import stability. */
export const CdsToastBridge = AppToaster

export const toast = Object.assign(
  (text: string, options?: { duration?: number }) => sonnerToast(text, { duration: options?.duration }),
  {
    success: (text: string, options?: { duration?: number }) =>
      sonnerToast.success(text, { duration: options?.duration }),
    error: (text: string, options?: { duration?: number }) =>
      sonnerToast.error(text, { duration: options?.duration }),
    warning: (text: string, options?: { duration?: number }) =>
      sonnerToast.warning(text, { duration: options?.duration }),
    info: (text: string, options?: { duration?: number }) =>
      sonnerToast.info(text, { duration: options?.duration }),
    message: (text: string, options?: { duration?: number }) =>
      sonnerToast.message(text, { duration: options?.duration }),
    dismiss: (id?: string | number) => sonnerToast.dismiss(id),
    hide: (id?: string | number) => sonnerToast.dismiss(id),
    clearQueue: () => {
      sonnerToast.dismiss()
    },
  },
)
