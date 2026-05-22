import type { AddOwnerPreview } from '@/lib/addOwner/addOwnerHelpers'
import { OwnerMutationStepFlow } from '@/features/accountSetup/ownerMutation/OwnerMutationStepFlow'

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
      alreadyComplete={alreadyOwner}
      alreadyCompleteMessage="4626 signing is already enabled on this wallet."
      onBuildPreview={onBuildPreview}
      onSubmit={() => void handleAdd()}
      onRebuildPreview={onRebuildPreview}
      previewDetails={preview ? <AddOwnerPreviewDetails preview={preview} /> : null}
    />
  )
}
