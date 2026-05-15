import { RemoveOwnerStatusCards } from '@/features/accountSetup/removeOwner/RemoveOwnerStatusCards'
import type { AADepositDiagnostics, RemoveOwnerPreview } from '@/lib/removeOwner/removeOwnerHelpers'

type InAppEnvironment = {
  isAnyWalletInApp: boolean
}

type PatternLockStatus = {
  state: 'locked' | 'unlocked' | 'pending'
  label: string
  detail: string
}

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
  inAppEnv: InAppEnvironment | null
  handleRemove: () => Promise<void>
  txHash: string | null
  patternLockStatus: PatternLockStatus
  strictTraceEnabled: boolean
  aaDepositDiagnostics: AADepositDiagnostics | null
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
    inAppEnv,
    handleRemove,
    txHash,
    patternLockStatus,
    strictTraceEnabled,
    aaDepositDiagnostics,
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
          </dl>
          {preview.preflight.targetOwnerAddress ? (
            <div className="text-[11px] text-zinc-400 break-all">
              Removing:{' '}
              <span className="font-mono text-zinc-300">{preview.preflight.targetOwnerAddress}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-[11px] text-emerald-100 space-y-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/80">Recommended lane</div>
            <div className="text-xs font-medium text-emerald-100">CSW self-auth wallet_sendCalls</div>
          </div>
          <p className="text-[10px] text-emerald-100/80">
            This page now uses one stable submission lane for owner removal.
          </p>
          <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-100">
            Keys passkey paste flow is temporarily disabled while self-auth lane stabilization is in progress.
          </div>
          {!isSelfAuthSession ? (
            <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-100">
              Submission requires CSW self-auth mode. Switch to the canonical CSW session, then retry.
            </div>
          ) : null}
          <div className="space-y-2 rounded-xl border border-white/15 bg-black/30 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span>Step 1. Select owner slot</span>
              <span className={preview ? 'text-emerald-300' : 'text-zinc-500'}>{preview ? 'done' : 'pending'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Step 2. Submit via wallet_sendCalls</span>
              <span className={isSelfAuthSession ? 'text-emerald-300' : 'text-zinc-500'}>
                {isSelfAuthSession ? 'ready' : 'blocked'}
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
                  EIP-5792 wallet_sendCalls lane
                </div>
                <p className="leading-relaxed">
                  Base App builds the UserOp from this call, signs it locally with the on-device passkey, and submits
                  via its built-in bundler. The CSW pays its own gas from its EntryPoint deposit.
                </p>
              </div>
            ) : null}

            <button
              type="button"
              disabled={
                busy ||
                !preview ||
                previewLoading ||
                !isSelfAuthSession ||
                !preview.preflight.simulation.ok ||
                !preview.relay
              }
              onClick={() => void handleRemove()}
              className="inline-flex rounded-xl border border-white/25 bg-black/40 px-4 py-2 text-sm text-zinc-200 hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? 'Submitting via wallet_sendCalls…'
                : isSelfAuthSession
                  ? !preview?.relay
                    ? 'Relay quote unavailable for current selection'
                    : `Remove owner at index ${preview?.preflight.targetOwnerIndex ?? '?'} via wallet_sendCalls`
                  : inAppEnv?.isAnyWalletInApp && !isSelfAuthSession
                    ? 'Open in browser to remove'
                    : !preview
                      ? 'Select an owner above first'
                      : 'Switch to CSW self-auth mode to submit'}
            </button>
          </div>
        </details>
      </div>

      <RemoveOwnerStatusCards
        txHash={txHash}
        patternLockStatus={patternLockStatus}
        strictTraceEnabled={strictTraceEnabled}
        aaDepositDiagnostics={aaDepositDiagnostics}
        pageNotice={pageNotice}
        pageError={pageError}
        lastErrorDetail={lastErrorDetail}
        eventLog={eventLog}
      />
    </div>
  )
}
