import { RemoveOwnerStatusCards } from '@/features/accountSetup/removeOwner/RemoveOwnerStatusCards'
import type { RemoveOwnerPreview } from '@/lib/removeOwner/removeOwnerHelpers'

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
    <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
      {previewLoading ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">
          Building remove preview…
        </div>
      ) : null}

      {preview ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs space-y-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Preview</div>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Selected function</dt>
              <dd className="mt-0.5 font-mono text-zinc-200">{preview.preflight.selectedFunction}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Chosen by</dt>
              <dd className="mt-0.5 font-mono text-zinc-200">{preview.preflight.selectedBy ?? 'heuristic'}</dd>
            </div>
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
                  <span className="text-rose-300">reverted: {preview.preflight.simulation.error ?? 'unknown'}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Relay order id</dt>
              <dd className="mt-0.5 font-mono text-zinc-200 break-all">
                {preview.relay?.orderId ?? 'n/a'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Deposit source</dt>
              <dd className="mt-0.5 font-mono text-zinc-200">
                {preview.relay?.userCallSource ?? 'n/a'}
              </dd>
            </div>
          </dl>
          {preview.preflight.targetOwnerAddress ? (
            <div className="text-[11px] text-zinc-400 break-all">
              Removing:{' '}
              <span className="font-mono text-zinc-300">{preview.preflight.targetOwnerAddress}</span>
            </div>
          ) : null}
          {preview.relay?.paymentDetails ? (
            <div className="text-[11px] text-zinc-400 break-all">
              Deposit via{' '}
              <span className="font-mono text-zinc-300">{preview.relay.paymentDetails.depository}</span>{' '}
              amount{' '}
              <span className="font-mono text-zinc-300">{preview.relay.paymentDetails.amount}</span>{' '}
              (currency{' '}
              <span className="font-mono text-zinc-300">{preview.relay.paymentDetails.currency}</span>)
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-[11px] text-emerald-100 space-y-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/80">Recommended lane</div>
            <div className="text-xs font-medium text-emerald-100">
              {isSelfAuthSession
                ? 'Self-auth compatibility remove route'
                : 'Relay routed remove route'}
            </div>
          </div>
          <p className="text-[10px] text-emerald-100/80">
            {isSelfAuthSession
              ? "Submit a request-bound depository call, then wait for Relay execution + owner-slot change."
              : "Submit Relay's quoted user transaction, then wait for Relay execution + owner-slot change."}
          </p>
          {!isSelfAuthSession ? (
            <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-100">
              You are not in CSW self-auth mode. This flow sends Relay&apos;s quoted user transaction from your external EOA.
            </div>
          ) : null}
          <div className="space-y-2 rounded-xl border border-white/15 bg-black/30 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span>Step 1. Select owner slot</span>
              <span className={preview ? 'text-emerald-300' : 'text-zinc-500'}>{preview ? 'done' : 'pending'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>
                {isSelfAuthSession
                  ? 'Step 2. Submit request-bound depository call'
                  : 'Step 2. Submit Relay quoted user transaction'}
              </span>
              <span className={preview ? 'text-emerald-300' : 'text-zinc-500'}>
                {preview ? 'ready' : 'blocked'}
              </span>
            </div>
          </div>
        </div>

        <details className="rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-zinc-300">
          <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Submission
          </summary>
          <div className="mt-3 space-y-3">
            {isSelfAuthSession ? (
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-3 text-[11px] text-emerald-100/85 space-y-1">
                <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/70">
                  Relay routed mode
                </div>
                <p className="leading-relaxed">
                  This session is CSW self-auth. Submission uses a request-bound depository call
                  for compatibility. Switch to an external owner signer if you need router-routed
                  Relay explorer visibility for Part 1.
                </p>
              </div>
            ) : null}

            <button
              type="button"
              disabled={
                busy ||
                !preview ||
                previewLoading ||
                !preview.preflight.simulation.ok
              }
              onClick={() => void handleRemove()}
              className="inline-flex rounded-xl border border-white/25 bg-black/40 px-4 py-2 text-sm text-zinc-200 hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? isSelfAuthSession
                  ? 'Submitting request-bound depository call…'
                  : 'Submitting Relay quoted user transaction…'
                : isSelfAuthSession
                  ? `Submit relay remove for owner index ${preview?.preflight.targetOwnerIndex ?? '?'} (self-auth mode)`
                  : !preview
                    ? 'Select an owner above first'
                    : `Submit relay remove for owner index ${preview.preflight.targetOwnerIndex}`}
            </button>
          </div>
        </details>
      </div>

      <RemoveOwnerStatusCards
        txHash={txHash}
        pageNotice={pageNotice}
        pageError={pageError}
        lastErrorDetail={lastErrorDetail}
        eventLog={eventLog}
      />
    </div>
  )
}
