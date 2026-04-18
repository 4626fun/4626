/**
 * Architecture B Phase 2 — Revoke control for settings surfaces.
 *
 * Displays when the user's delegation is `provisioned`. Provides a
 * "Revoke" button with a confirmation dialog before calling disable().
 *
 * Usage: mount in any settings or accounts page where user can manage
 * their Arch B enrollment. No new global providers.
 */

import { useState } from 'react'
import { toast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'

import { useArchBDelegation } from './useArchBDelegation'

export function ArchBRevokeControl() {
  const { status, disable, error } = useArchBDelegation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [revoking, setRevoking] = useState(false)

  if (status !== 'provisioned') return null

  async function handleConfirmRevoke() {
    setRevoking(true)
    try {
      await disable()
      setConfirmOpen(false)
      toast.success('Bot-initiated transfers revoked. Your wallet will no longer be used for /keepr send commands.')
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 space-y-1">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-sm text-zinc-100">Bot-initiated transfers</div>
          <div className="text-xs text-zinc-500">
            Your smart wallet is authorized for{' '}
            <code className="font-mono text-zinc-400">/keepr send</code> commands.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="success" size="sm">Enabled</Badge>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setConfirmOpen(true)}
          >
            Revoke
          </Button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
        >
          {error.message}
        </div>
      ) : null}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Revoke bot-initiated transfers"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">
            Revoking removes this app&apos;s ability to sign{' '}
            <code className="font-mono text-xs text-zinc-200">/keepr send</code> transactions
            from your smart wallet. You can re-enable at any time from the account setup page.
          </p>
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              disabled={revoking}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              loading={revoking}
              onClick={() => void handleConfirmRevoke()}
            >
              Revoke
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
