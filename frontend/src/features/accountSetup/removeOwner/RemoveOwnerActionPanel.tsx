import { RemoveOwnerStatusCards } from '@/features/accountSetup/removeOwner/RemoveOwnerStatusCards'
import type { AADepositDiagnostics, RemoveOwnerPreview, RelayTwoLegDiagnostics } from '@/lib/removeOwner/removeOwnerHelpers'

type InAppEnvironment = {
  isAnyWalletInApp: boolean
}

type SignerOwnerIndexValidation = {
  ok: boolean
  message: string
}

type PasteValidation = {
  ok: boolean
  message: string
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

type SignerMismatch = {
  recoveredRaw: string | null
  recoveredEip191: string | null
  claimedOwnerIndex: number | null
}

type PasteFlow = {
  snippet: string
  signerOwnerIndex: number
}

type RemoveOwnerActionPanelProps = {
  previewLoading: boolean
  preview: RemoveOwnerPreview | null
  busy: boolean
  signerOwnerIndexValidation: SignerOwnerIndexValidation
  handlePrepareKeysCoinbasePaste: () => Promise<void>
  pasteValidation: PasteValidation | null
  signingOwnerIndex: number
  setSigningOwnerIndex: (value: number) => void
  ownerIndexOptions: Array<{ index: number; type: string; ownerAddress: `0x${string}` | null }>
  pasteFlow: PasteFlow | null
  pasteResponse: string
  setPasteResponse: (value: string) => void
  handleFundRelayDepositForPasteLane: () => Promise<void>
  depositTxHash: string | null
  handleSubmitKeysCoinbasePaste: () => Promise<void>
  requirePasskey: boolean
  setRequirePasskey: (value: boolean) => void
  setSignerMismatch: (value: SignerMismatch | null) => void
  isSelfAuthSession: boolean
  inAppEnv: InAppEnvironment | null
  handleRemove: () => Promise<void>
  txHash: string | null
  relayTwoLegDiagnostics: RelayTwoLegDiagnostics | null
  patternLockStatus: PatternLockStatus
  strictTraceEnabled: boolean
  aaDepositDiagnostics: AADepositDiagnostics | null
  pageNotice: string | null
  pageError: string | null
  signerMismatch: SignerMismatch | null
  lastErrorDetail: LastErrorDetail | null
  eventLog: string[]
}

export function RemoveOwnerActionPanel(props: RemoveOwnerActionPanelProps) {
  const {
    previewLoading,
    preview,
    busy,
    signerOwnerIndexValidation,
    handlePrepareKeysCoinbasePaste,
    pasteValidation,
    signingOwnerIndex,
    setSigningOwnerIndex,
    ownerIndexOptions,
    pasteFlow,
    pasteResponse,
    setPasteResponse,
    handleFundRelayDepositForPasteLane,
    depositTxHash,
    handleSubmitKeysCoinbasePaste,
    requirePasskey,
    setRequirePasskey,
    setSignerMismatch,
    isSelfAuthSession,
    inAppEnv,
    handleRemove,
    txHash,
    relayTwoLegDiagnostics,
    patternLockStatus,
    strictTraceEnabled,
    aaDepositDiagnostics,
    pageNotice,
    pageError,
    signerMismatch,
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
            <div className="text-xs font-medium text-emerald-100">Keys passkey flow</div>
          </div>
          <p className="text-[10px] text-emerald-100/80">
            Complete steps in order. Submit unlocks after payload validation and relay deposit.
          </p>
          {isSelfAuthSession ? (
            <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-100">
              This strict lane needs a distinct external EOA for relay funding. Self-auth CSW sessions are
              paymaster-backed and intentionally blocked.
            </div>
          ) : null}
          <div className="space-y-2 rounded-xl border border-white/15 bg-black/30 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span>Step 1. Select owner slot</span>
              <span className={preview ? 'text-emerald-300' : 'text-zinc-500'}>{preview ? 'done' : 'pending'}</span>
            </div>
            <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span>Step 2. Generate keys snippet</span>
              <button
                type="button"
                disabled={
                  !preview ||
                  busy ||
                  previewLoading ||
                  !preview?.preflight.simulation.ok ||
                  !signerOwnerIndexValidation.ok
                }
                onClick={() => void handlePrepareKeysCoinbasePaste()}
                className="btn-accent btn-no-icon inline-flex w-full sm:w-auto"
              >
                {busy ? 'Preparing...' : 'Generate snippet'}
              </button>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Step 3. Paste signed JSON payload</span>
              <span
                className={
                  pasteValidation == null
                    ? 'text-zinc-500'
                    : pasteValidation.ok
                      ? 'text-emerald-300'
                      : 'text-rose-300'
                }
              >
                {pasteValidation == null ? 'pending' : pasteValidation.ok ? 'valid' : 'invalid'}
              </span>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/35 p-2 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Passkey signer slot</div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-[10px] text-zinc-400">Owner index used in signature wrapper</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={signingOwnerIndex}
                  onChange={(e) => {
                    const parsed = Number(e.target.value)
                    if (!Number.isFinite(parsed) || parsed < 0) return
                    setSigningOwnerIndex(Math.floor(parsed))
                  }}
                  className="w-24 rounded-lg border border-white/15 bg-black/40 px-2 py-1 font-mono text-[11px] text-zinc-200"
                />
                <select
                  value={signingOwnerIndex}
                  onChange={(e) => setSigningOwnerIndex(Number(e.target.value))}
                  className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-zinc-200"
                >
                  {ownerIndexOptions.length === 0 ? (
                    <option value={signingOwnerIndex}>[{signingOwnerIndex}] manual</option>
                  ) : null}
                  {ownerIndexOptions.map((owner) => (
                    <option key={owner.index} value={owner.index}>
                      [{owner.index}] {owner.type}
                      {owner.ownerAddress ? ` ${owner.ownerAddress.slice(0, 8)}…` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`text-[10px] ${signerOwnerIndexValidation.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                {signerOwnerIndexValidation.message}
              </div>
            </div>
            {pasteFlow ? (
              <>
                <label className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/80">Keys snippet</label>
                <div className="text-[10px] text-zinc-400">
                  Prepared for signer owner slot [{pasteFlow.signerOwnerIndex}].
                </div>
                <textarea
                  readOnly
                  rows={7}
                  value={pasteFlow.snippet}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-[10px] text-zinc-200"
                />
                <button
                  type="button"
                  className="rounded-lg border border-white/20 bg-black/30 px-3 py-1.5 text-[11px] text-zinc-200 hover:border-white/35"
                  onClick={() => {
                    void navigator.clipboard.writeText(pasteFlow.snippet).catch(() => {})
                  }}
                >
                  Copy keys.coinbase.com snippet
                </button>
                <textarea
                  rows={5}
                  value={pasteResponse}
                  onChange={(e) => setPasteResponse(e.target.value)}
                  placeholder="Paste the JSON output from keys.coinbase.com here"
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-500"
                />
                {pasteValidation ? (
                  <div
                    className={`rounded-lg border px-2 py-1 text-[10px] ${
                      pasteValidation.ok
                        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-rose-400/30 bg-rose-500/10 text-rose-200'
                    }`}
                  >
                    {pasteValidation.message}
                  </div>
                ) : null}
              </>
            ) : null}
            <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span>Step 4. Send relay depository tx</span>
              <button
                type="button"
                disabled={
                  busy ||
                  isSelfAuthSession ||
                  !preview?.relay?.userCall ||
                  !pasteFlow ||
                  !pasteValidation?.ok ||
                  !signerOwnerIndexValidation.ok ||
                  Boolean(depositTxHash)
                }
                onClick={() => void handleFundRelayDepositForPasteLane()}
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-1.5 text-[11px] text-zinc-200 hover:border-white/35 disabled:opacity-60 w-full sm:w-auto"
              >
                {depositTxHash ? 'Deposit sent' : busy ? 'Sending...' : 'Send deposit tx'}
              </button>
            </div>
            <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span>Step 5. Quote + execute request-bound deposit</span>
              <button
                type="button"
                disabled={busy || isSelfAuthSession || !pasteFlow || !pasteValidation?.ok || !signerOwnerIndexValidation.ok}
                onClick={() => void handleSubmitKeysCoinbasePaste()}
                className="btn-accent btn-no-icon inline-flex w-full sm:w-auto"
              >
                {busy ? 'Submitting...' : 'Submit owner removal'}
              </button>
            </div>
          </div>
        </div>

        <details className="rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-zinc-300">
          <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Advanced troubleshooting lanes
          </summary>
          <div className="mt-3 space-y-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={requirePasskey}
                onChange={(e) => {
                  setRequirePasskey(e.target.checked)
                  setSignerMismatch(null)
                }}
                disabled={busy}
              />
              <span>
                <span className="text-zinc-200 font-medium">Sign with passkey owner slot</span>
                <span className="block text-[10px] text-zinc-500 mt-0.5">
                  Keeps signature checks strict for this fallback path.
                </span>
              </span>
            </label>

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
                ((inAppEnv?.isAnyWalletInApp ?? false) && !isSelfAuthSession) ||
                (preview ? !preview.preflight.simulation.ok : false)
              }
              onClick={() => void handleRemove()}
              className="inline-flex rounded-xl border border-white/25 bg-black/40 px-4 py-2 text-sm text-zinc-200 hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? isSelfAuthSession
                  ? 'Submitting via wallet_sendCalls…'
                  : requirePasskey
                    ? 'Removing via passkey + Relay UserOp…'
                    : 'Removing via session-key + Relay UserOp…'
                : isSelfAuthSession
                  ? `Remove owner at index ${preview?.preflight.targetOwnerIndex ?? '?'} via wallet_sendCalls`
                  : inAppEnv?.isAnyWalletInApp && !isSelfAuthSession
                    ? 'Open in browser to remove'
                    : !preview
                      ? 'Select an owner above first'
                      : `Remove owner at index ${preview.preflight.targetOwnerIndex} via Relay UserOp`}
            </button>
          </div>
        </details>
      </div>

      <RemoveOwnerStatusCards
        txHash={txHash}
        depositTxHash={depositTxHash}
        relayTwoLegDiagnostics={relayTwoLegDiagnostics}
        patternLockStatus={patternLockStatus}
        strictTraceEnabled={strictTraceEnabled}
        aaDepositDiagnostics={aaDepositDiagnostics}
        pageNotice={pageNotice}
        pageError={pageError}
        signerMismatch={signerMismatch}
        lastErrorDetail={lastErrorDetail}
        eventLog={eventLog}
      />
    </div>
  )
}
