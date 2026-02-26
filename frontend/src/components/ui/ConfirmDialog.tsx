import { Modal } from './Modal'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmClass =
    variant === 'danger'
      ? 'inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/15 text-red-200 hover:bg-red-500/25 px-4 py-2.5 text-sm font-medium transition-all duration-200 disabled:opacity-50'
      : 'btn-primary btn-compact'

  return (
    <Modal open={open} onClose={onCancel} title={title} maxWidth="max-w-md">
      <div className="space-y-4">
        {variant === 'danger' ? (
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-red-500/10 p-2 shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">{description}</p>
          </div>
        ) : (
          <p className="text-sm text-zinc-300 leading-relaxed">{description}</p>
        )}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-white/8 bg-white/4 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/8 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
          >
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={confirmClass}>
            {busy ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
