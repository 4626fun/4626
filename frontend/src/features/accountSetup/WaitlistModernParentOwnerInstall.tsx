import { Button } from '@/components/ui/Button'
import { useAddUserOpOwnerInstall } from '@/features/accountSetup/addUserOp/useAddUserOpOwnerInstall'
import type { useAccountSetupController } from './useAccountSetupController'

type AccountSetupController = ReturnType<typeof useAccountSetupController>

type WaitlistModernParentOwnerInstallProps = {
  controller: AccountSetupController
  embeddedEoaAddress?: string | null
  onOwnerInstallSuccess?: () => void | Promise<void>
  className?: string
}

/**
 * Compact host for the modern validated parent-CSW owner install path
 * (EntryPoint self-call via Base App) when rendered inside the waitlist accordion.
 *
 * The heavy "long wait" UX is intentionally delegated to the existing pending banner
 * infrastructure in the parent (driven by the two reporters below). This component
 * focuses on a clean trigger + minimal status.
 */
export function WaitlistModernParentOwnerInstall({
  controller,
  embeddedEoaAddress,
  onOwnerInstallSuccess,
  className = '',
}: WaitlistModernParentOwnerInstallProps) {
  const {
    canonicalCswAddress,
    authHeaders,
    setPendingOwnerInstallHash,
    setOwnerInstallPhase,
  } = controller

  const modernInstall = useAddUserOpOwnerInstall({
    canonicalCswAddress,
    privyEmbeddedEoaAddress: embeddedEoaAddress ?? null,
    authHeaders,
    publicClient: undefined,
    enabled: Boolean(canonicalCswAddress),
    onSuccess: () => onOwnerInstallSuccess?.(),
    onPendingHashChange: setPendingOwnerInstallHash,
    onPhaseChange: setOwnerInstallPhase,
  })

  const busy = modernInstall.busy || modernInstall.prepareLoading
  const funding = modernInstall.fundingAssessment
  const fundingOk = funding?.ok === true
  const isPrepared = Boolean(modernInstall.preparedTx) && fundingOk

  return (
    <div className={`space-y-2 text-xs ${className}`}>
      <div className="text-zinc-400">
        Finish owner install on your parent smart wallet using the validated Base App path
        (EntryPoint self-call).
      </div>

      {/* Compact preflight / funding status (mirrors the dedicated flow, kept small for accordion) */}
      {modernInstall.fundingLoading ? (
        <p className="text-zinc-500">Checking CSW funding for owner install…</p>
      ) : funding ? (
        <div>
          {fundingOk ? (
            <p className="text-emerald-300">Preflight OK — ready to prepare &amp; submit in Base App.</p>
          ) : (
            <div className="space-y-1">
              <p className="text-amber-300">Funding check: {funding.reason ?? 'insufficient for gas / preflight'}.</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={modernInstall.fundingLoading}
                onClick={() => void modernInstall.refreshFunding?.()}
              >
                Re-check funding
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {/* Two-phase action: Prepare then Submit (explicit, like the dedicated flow, still compact) */}
      {!fundingOk ? (
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled
        >
          Check funding first
        </Button>
      ) : !isPrepared ? (
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={busy}
          loading={busy}
          onClick={() => void modernInstall.loadPrepare?.()}
        >
          Prepare owner install
        </Button>
      ) : (
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={busy}
          loading={busy}
          onClick={() => void modernInstall.handleSubmitUserOp?.()}
        >
          Submit in Base App
        </Button>
      )}

      {modernInstall.pageError ? (
        <p className="text-rose-300">{modernInstall.pageError}</p>
      ) : null}

      {modernInstall.submitPhase && modernInstall.submitPhase !== 'idle' ? (
        <p className="text-sky-300">
          {modernInstall.submitPhase === 'awaiting_signature'
            ? 'Waiting for Base App signature…'
            : 'Preparing owner install…'}
        </p>
      ) : null}
    </div>
  )
}
