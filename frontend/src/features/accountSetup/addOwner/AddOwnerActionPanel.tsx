import type { AddOwnerPreview } from '@/lib/addOwner/addOwnerHelpers'
import { OwnerMutationStepFlow } from '@/features/accountSetup/ownerMutation/OwnerMutationStepFlow'
import {
  formatRelayDepositEth,
  resolveRelayRequiredDepositWei,
} from '@/lib/relay/ownerMutationPreviewHelpers'

type LastErrorDetail = {
  revertReason: string | null
  revertData: string | null
  relayTx: unknown
  rawBody: string | null
}

type AddOwnerActionPanelProps = {
  previewLoading: boolean
  preview: AddOwnerPreview | null
  busy: boolean
  isSelfAuthSession: boolean
  handleAdd: () => Promise<boolean | void>
  onBuildPreview: () => void
  onRebuildPreview: () => void
  txHash: string | null
  pageNotice: string | null
  pageError: string | null
  lastErrorDetail: LastErrorDetail | null
  eventLog: string[]
}

function AddOwnerPreviewDetails(props: { preview: AddOwnerPreview }) {
  const { preview } = props
  const requiredDepositWei = resolveRelayRequiredDepositWei(preview)
  const depositSim = preview.preflight.relayDepositSimulation
  return (
    <details className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-300">
      <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        Preview details
      </summary>
      <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Owner to add</dt>
          <dd className="mt-0.5 break-all font-mono text-zinc-200">{preview.preflight.ownerToAdd}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Relay deposit</dt>
          <dd className="mt-0.5 font-mono">
            {requiredDepositWei !== null ? (
              <span className="text-zinc-200">
                {formatRelayDepositEth(requiredDepositWei)} ETH
                <span className="ml-1 text-zinc-500">({requiredDepositWei.toString()} wei)</span>
              </span>
            ) : (
              <span className="text-rose-300">missing</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Relay deposit sim</dt>
          <dd className="mt-0.5 font-mono">
            {depositSim == null ? (
              <span className="text-zinc-500">n/a</span>
            ) : depositSim.ok ? (
              <span className="text-emerald-300">ok</span>
            ) : (
              <span className="text-rose-300">{depositSim.error ?? 'reverted'}</span>
            )}
          </dd>
        </div>
        {depositSim && !depositSim.ok ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Funder balance check</dt>
            <dd className="mt-0.5 font-mono text-zinc-400">
              balance {depositSim.funderBalanceWei} wei · deposit {depositSim.depositWei} wei · gas buffer{' '}
              {depositSim.gasBufferWei} wei
            </dd>
          </div>
        ) : null}
        {preview.preflight.relayQuoteError ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Relay quote error</dt>
            <dd className="mt-0.5 font-mono text-rose-300">{preview.preflight.relayQuoteError}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Mutation simulation</dt>
          <dd className="mt-0.5 font-mono">
            {preview.preflight.simulation.ok ? (
              <span className="text-emerald-300">ok</span>
            ) : (
              <span className="text-rose-300">{preview.preflight.simulation.error ?? 'reverted'}</span>
            )}
          </dd>
        </div>
      </dl>
    </details>
  )
}

export function AddOwnerActionPanel(props: AddOwnerActionPanelProps) {
  const {
    previewLoading,
    preview,
    busy,
    isSelfAuthSession,
    handleAdd,
    onBuildPreview,
    onRebuildPreview,
    txHash,
    pageNotice,
    pageError,
    lastErrorDetail,
    eventLog,
  } = props

  const alreadyOwner = preview?.preflight.alreadyOwner === true

  if (alreadyOwner) {
    return null
  }

  return (
    <OwnerMutationStepFlow
      mutation="add"
      isSelfAuthSession={isSelfAuthSession}
      previewLoading={previewLoading}
      preview={preview}
      busy={busy}
      txHash={txHash}
      pageNotice={pageNotice}
      pageError={pageError}
      lastErrorDetail={lastErrorDetail}
      eventLog={eventLog}
      onBuildPreview={onBuildPreview}
      onSubmit={() => void handleAdd()}
      onRebuildPreview={onRebuildPreview}
      previewDetails={preview ? <AddOwnerPreviewDetails preview={preview} /> : null}
    />
  )
}
