import { Button } from '@/components/ui/Button'
import { useEnable4626Activation } from '@/features/accountSetup/activation/useEnable4626Activation'
import { activationStageLabel } from '@/features/accountSetup/activation/activationStateMachine'
import type { useAccountSetupController } from './useAccountSetupController'

type AccountSetupController = ReturnType<typeof useAccountSetupController>

type WaitlistModernParentOwnerInstallProps = {
  controller: AccountSetupController
  embeddedEoaAddress?: string | null
  baseWalletMatchesParent?: boolean | null
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
  baseWalletMatchesParent = null,
  onOwnerInstallSuccess,
  className = '',
}: WaitlistModernParentOwnerInstallProps) {
  const {
    canonicalCswAddress,
    authHeaders,
    setPendingOwnerInstallHash,
    setOwnerInstallPhase,
  } = controller

  const activation = useEnable4626Activation({
    canonicalCswAddress,
    embeddedEoaAddress: embeddedEoaAddress ?? null,
    authHeaders,
    baseWalletMatchesParent: baseWalletMatchesParent !== false,
    onReady: () => onOwnerInstallSuccess?.(),
    onPendingHashChange: setPendingOwnerInstallHash,
    onPhaseChange: setOwnerInstallPhase,
  })
  const modernInstall = activation.visibleInstall

  const busy =
    activation.busy ||
    !['idle', 'needs_base_wallet', 'ready', 'partial_ready', 'error'].includes(
      activation.state.stage,
    )
  const funding = modernInstall.fundingAssessment
  const fundingOk = funding?.ok === true
  const embeddedOwnerConfirmed = activation.status?.embeddedOwnerConfirmed === true
  const canStart = embeddedOwnerConfirmed || fundingOk
  const activationError = activation.state.error ?? modernInstall.pageError
  const statusRows = [
    {
      label: '4626/Privy session',
      ok: Boolean(embeddedEoaAddress),
      value: embeddedEoaAddress ? 'Ready' : 'Sign in required',
    },
    {
      label: 'Base Account signing connection',
      ok: baseWalletMatchesParent === true || embeddedOwnerConfirmed,
      value:
        baseWalletMatchesParent === true
          ? 'Parent wallet connected'
          : embeddedOwnerConfirmed
            ? 'No longer required'
            : baseWalletMatchesParent === false
              ? 'Link parent wallet'
              : 'Verified during approval',
    },
    {
      label: 'Embedded signer owner status',
      ok: embeddedOwnerConfirmed,
      value: embeddedOwnerConfirmed ? 'Confirmed on-chain' : 'Approval required',
    },
    {
      label: 'Automation signer owner status',
      ok: activation.status?.serverOwnerConfirmed === true,
      value: activation.status?.serverOwnerConfirmed ? 'Confirmed on-chain' : 'Not installed',
    },
    {
      label: 'XMTP identity (parent CSW)',
      ok: activation.status?.xmtpProvisioned === true,
      value: activation.status?.xmtpProvisioned
        ? 'Provisioned as parent CSW'
        : 'Not provisioned',
    },
  ]

  return (
    <div className={`space-y-2 text-xs ${className}`}>
      <div className="space-y-2 text-zinc-400">
        <p>
          One disclosed Base App approval adds your Privy embedded signer to your parent
          Coinbase Smart Wallet. After that, the embedded signer completes automation setup
          silently.
        </p>
        <p>That one approval enables:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>silent sponsored swaps from the parent Coinbase Smart Wallet;</li>
          <li>delegated server signing for XMTP and approved automation.</li>
        </ul>
      </div>

      <div className="space-y-1 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        {statusRows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-zinc-400">{row.label}</span>
            <span className={row.ok ? 'text-emerald-300' : 'text-zinc-500'}>
              {row.value}
            </span>
          </div>
        ))}
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

      {activation.state.stage === 'ready' ? (
        <p className="text-emerald-300">
          4626 signing, sponsored swaps, automation, and XMTP are ready on the parent wallet.
        </p>
      ) : !canStart ? (
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled
        >
          Check funding first
        </Button>
      ) : (
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={busy}
          loading={busy}
          onClick={() => void activation.enable()}
        >
          Enable 4626 signing
        </Button>
      )}

      {activationError ? (
        <div className="space-y-2">
          <p className="text-rose-300">
            {activation.state.failureStage
              ? `${activation.state.failureStage.replaceAll('_', ' ')}: `
              : ''}
            {activationError}
          </p>
          {modernInstall.inBaseApp &&
          activationError.includes('nothing was submitted on-chain') ? (
            <p className="text-zinc-400">
              Reopen this screen in Base App, confirm Base Mainnet, rebuild the request, and
              retry once. No alternate passkey or Relay lane will start automatically.
            </p>
          ) : null}
          {activation.state.stage === 'partial_ready' ||
          activation.state.stage === 'error' ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void activation.enable()}
            >
              {embeddedOwnerConfirmed ? 'Retry silent automation setup' : 'Retry activation'}
            </Button>
          ) : null}
        </div>
      ) : null}

      {activation.state.stage !== 'idle' ? (
        <p className="text-sky-300">
          {activationStageLabel(activation.state.stage)}
        </p>
      ) : null}
    </div>
  )
}
