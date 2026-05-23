import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { RemoveOwnerStatusCards } from '@/features/accountSetup/removeOwner/RemoveOwnerStatusCards'
import {
  formatRelayDepositEth,
  resolveOwnerMutationPhase,
  resolveRelayPreviewBlockReason,
  resolveRelayPreviewStepOneStatus,
  resolveRelayRequiredDepositWei,
  resolveRelaySubmitStepTwoStatus,
  type RelayPreviewShape,
} from '@/lib/relay/ownerMutationPreviewHelpers'

type LastErrorDetail = {
  revertReason: string | null
  revertData: string | null
  relayTx: unknown
  rawBody: string | null
}

type OwnerMutationStepFlowProps = {
  mutation: 'add' | 'remove'
  isSelfAuthSession: boolean
  previewLoading: boolean
  preview: RelayPreviewShape
  busy: boolean
  txHash: string | null
  pageNotice: string | null
  pageError: string | null
  lastErrorDetail: LastErrorDetail | null
  eventLog: string[]
  alreadyComplete?: boolean
  alreadyCompleteMessage?: string
  waitingMessage?: string | null
  showBuildPreviewButton?: boolean
  onBuildPreview: () => void
  onSubmit: () => void
  onRebuildPreview?: () => void
  previewDetails?: ReactNode
}

export function OwnerMutationStepFlow(props: OwnerMutationStepFlowProps) {
  const {
    mutation,
    isSelfAuthSession,
    previewLoading,
    preview,
    busy,
    txHash,
    pageNotice,
    pageError,
    lastErrorDetail,
    eventLog,
    alreadyComplete = false,
    alreadyCompleteMessage,
    waitingMessage,
    showBuildPreviewButton = true,
    onBuildPreview,
    onSubmit,
    onRebuildPreview,
    previewDetails,
  } = props

  const requiredDepositWei = resolveRelayRequiredDepositWei(preview)
  const requiredDepositEth =
    requiredDepositWei !== null ? formatRelayDepositEth(requiredDepositWei) : null
  const stepOneStatus = resolveRelayPreviewStepOneStatus({ previewLoading, preview })
  const previewBlockReason = resolveRelayPreviewBlockReason(preview)
  const stepTwoStatus = resolveRelaySubmitStepTwoStatus({ stepOne: stepOneStatus, txHash, busy })
  const phase = resolveOwnerMutationPhase({
    stepOne: stepOneStatus,
    stepTwo: stepTwoStatus,
    alreadyComplete,
  })
  const laneLabel =
    mutation === 'add'
      ? isSelfAuthSession
        ? 'Add Privy signer via CSW self-auth Relay'
        : 'Add Privy signer via connected owner Relay'
      : isSelfAuthSession
        ? 'Remove owner via CSW self-auth Relay'
        : 'Remove owner via connected owner Relay'

  const stepCounter =
    phase === 'preview' ? 'Step 1 of 2' : phase === 'submit' ? 'Step 2 of 2' : 'Complete'

  return (
    <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{stepCounter}</div>
        <div className="text-sm font-medium text-white">{laneLabel}</div>
        <p className="text-xs leading-relaxed text-zinc-400">
          {phase === 'preview'
            ? mutation === 'add'
              ? 'Build a Relay quote first. Nothing submits until you approve step 2.'
              : 'Select an owner slot above, then build the Relay quote. Nothing submits until step 2.'
            : phase === 'submit'
              ? 'Approve the Relay deposit in your wallet. 4626 only marks success after on-chain confirmation.'
              : alreadyCompleteMessage ?? 'Owner mutation completed.'}
        </p>
      </div>

      {waitingMessage ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">
          {waitingMessage}
        </div>
      ) : null}

      {phase === 'preview' ? (
        <div className="space-y-3">
          {preview && stepOneStatus === 'blocked' ? (
            <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100 space-y-2">
              <p>
                Preview loaded but is not actionable yet. Fix the blocker below, then rebuild.
              </p>
              {previewBlockReason ? (
                <p className="font-mono text-[11px] leading-relaxed text-amber-50/90">{previewBlockReason}</p>
              ) : null}
            </div>
          ) : null}
          {previewDetails}
          {showBuildPreviewButton ? (
            <Button
              type="button"
              variant="primary"
              disabled={previewLoading || busy || Boolean(waitingMessage)}
              loading={previewLoading}
              onClick={onBuildPreview}
            >
              {previewLoading
                ? 'Building Relay preview…'
                : preview
                  ? 'Rebuild Relay preview'
                  : 'Build Relay preview'}
            </Button>
          ) : previewLoading ? (
            <div className="text-xs text-zinc-400">Building Relay preview…</div>
          ) : null}
        </div>
      ) : null}

      {phase === 'submit' ? (
        <div className="space-y-3">
          {previewDetails}
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
            <div className="text-[10px] uppercase tracking-[0.16em] opacity-80">Relay deposit</div>
            <div className="mt-1 font-mono">
              {requiredDepositEth} ETH
              {requiredDepositWei !== null ? (
                <span className="ml-2 opacity-80">({requiredDepositWei.toString()} wei)</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={busy || stepOneStatus !== 'done'}
              loading={busy}
              onClick={onSubmit}
            >
              {busy
                ? 'Submitting Relay deposit…'
                : mutation === 'add'
                  ? 'Submit Relay add'
                  : 'Submit Relay remove'}
            </Button>
            {onRebuildPreview ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={previewLoading || busy}
                onClick={onRebuildPreview}
              >
                Back to preview
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase === 'complete' ? (
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
          {alreadyCompleteMessage ?? pageNotice ?? 'Relay flow completed.'}
          {txHash ? (
            <div className="mt-2 break-all">
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono underline"
              >
                {txHash}
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      <RemoveOwnerStatusCards
        txHash={phase === 'complete' ? txHash : null}
        pageNotice={pageNotice}
        pageError={pageError}
        lastErrorDetail={lastErrorDetail}
        eventLog={eventLog}
      />
    </div>
  )
}
