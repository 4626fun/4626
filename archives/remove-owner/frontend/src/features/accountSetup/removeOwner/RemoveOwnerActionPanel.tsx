import type { RemoveOwnerPreview } from '@/lib/removeOwner/removeOwnerHelpers'
import { OwnerMutationStepFlow } from '@/features/accountSetup/ownerMutation/OwnerMutationStepFlow'

type LastErrorDetail = {
  revertReason: string | null
  revertData: string | null
  relayTx: unknown
  rawBody: string | null
}

type RemoveOwnerActionPanelProps = {
  previewLoading: boolean
  preview: RemoveOwnerPreview | null
  busy: boolean
  isSelfAuthSession: boolean
  handleRemove: () => Promise<void>
  txHash: string | null
  pageNotice: string | null
  pageError: string | null
  lastErrorDetail: LastErrorDetail | null
  eventLog: string[]
}

function RemoveOwnerPreviewDetails(props: { preview: RemoveOwnerPreview }) {
  const { preview } = props
  return (
    <details className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-300">
      <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        Preview details
      </summary>
      <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Target index</dt>
          <dd className="mt-0.5 font-mono text-zinc-200">{preview.preflight.targetOwnerIndex}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Simulation</dt>
          <dd className="mt-0.5 font-mono">
            {preview.preflight.simulation.ok ? (
              <span className="text-emerald-300">ok</span>
            ) : (
              <span className="text-rose-300">{preview.preflight.simulation.error ?? 'reverted'}</span>
            )}
          </dd>
        </div>
      </dl>
      {preview.preflight.targetOwnerAddress ? (
        <div className="mt-2 break-all text-[11px] text-zinc-400">
          Removing{' '}
          <span className="font-mono text-zinc-300">{preview.preflight.targetOwnerAddress}</span>
        </div>
      ) : null}
    </details>
  )
}

export function RemoveOwnerActionPanel(props: RemoveOwnerActionPanelProps) {
  const {
    previewLoading,
    preview,
    busy,
    isSelfAuthSession,
    handleRemove,
    txHash,
    pageNotice,
    pageError,
    lastErrorDetail,
    eventLog,
  } = props

  return (
    <OwnerMutationStepFlow
      mutation="remove"
      isSelfAuthSession={isSelfAuthSession}
      previewLoading={previewLoading}
      preview={preview}
      busy={busy}
      txHash={txHash}
      pageNotice={pageNotice}
      pageError={pageError}
      lastErrorDetail={lastErrorDetail}
      eventLog={eventLog}
      waitingMessage={
        !preview && !previewLoading
          ? 'Select an owner slot above to build the Relay preview.'
          : null
      }
      showBuildPreviewButton={false}
      onBuildPreview={() => {}}
      onSubmit={() => void handleRemove()}
      previewDetails={preview ? <RemoveOwnerPreviewDetails preview={preview} /> : null}
    />
  )
}
