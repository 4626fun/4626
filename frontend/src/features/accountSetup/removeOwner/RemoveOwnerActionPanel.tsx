import { RemoveOwnerStatusCards } from '@/features/accountSetup/removeOwner/RemoveOwnerStatusCards'
import type { RemoveOwnerPreview } from '@/lib/removeOwner/removeOwnerHelpers'
import { formatEther } from 'viem'

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

  const requiredDepositWei = (() => {
    if (!preview?.relay) return null
    const amount = preview.relay.paymentDetails?.amount
    if (typeof amount === 'string' && /^[1-9][0-9]*$/.test(amount)) {
      return BigInt(amount)
    }
    const quotedUserValue = preview.relay.userCall?.value
    if (typeof quotedUserValue === 'string' && /^0x[0-9a-fA-F]+$/.test(quotedUserValue)) {
      const wei = BigInt(quotedUserValue)
      return wei > 0n ? wei : null
    }
    if (typeof quotedUserValue === 'string' && /^[1-9][0-9]*$/.test(quotedUserValue)) {
      return BigInt(quotedUserValue)
    }
    return null
  })()
  const requiredDepositEth =
    requiredDepositWei !== null
      ? (() => {
          const raw = formatEther(requiredDepositWei)
          const [whole, fraction = ''] = raw.split('.')
          const trimmed = fraction.replace(/0+$/, '').slice(0, 8)
          return trimmed ? `${whole}.${trimmed}` : whole
        })()
      : null
  const quoteLooksEchoedExactOutput =
    Boolean(preview?.relay) &&
    preview?.relay?.userCallSource === 'quote_tx' &&
    requiredDepositWei !== null &&
    preview?.preflight?.relayQuoteDiagnostics?.paymentDetails?.amount ===
      preview?.preflight?.relayQuoteDiagnostics?.userTransaction?.value
  const submitBlockedByMissingRequiredDeposit = Boolean(preview) && requiredDepositWei === null
  const isQuoteTxMode = preview?.relay?.userCallSource === 'quote_tx'
  const submitBlocked =
    busy ||
    !preview ||
    previewLoading ||
    !preview.preflight.simulation.ok ||
    submitBlockedByMissingRequiredDeposit

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
          <div
            className={
              requiredDepositWei !== null
                ? 'rounded-md border border-emerald-400/25 bg-emerald-500/10 p-2 text-[11px] text-emerald-100'
                : 'rounded-md border border-amber-400/25 bg-amber-500/10 p-2 text-[11px] text-amber-100'
            }
          >
            <div className="text-[10px] uppercase tracking-[0.16em] opacity-80">
              Quote-requested exact deposit
            </div>
            {requiredDepositWei !== null ? (
              <div className="mt-1">
                <span className="font-mono">{requiredDepositEth} ETH</span>{' '}
                <span className="opacity-85">(wei: {requiredDepositWei.toString(10)})</span>
              </div>
            ) : (
              <div className="mt-1">
                {isQuoteTxMode
                  ? 'Missing explicit request-bound payment details and quote tx value. Submit is blocked to avoid underfunded deposits that stay in waiting.'
                  : 'Missing `paymentDetails.amount` from Relay quote. Submit is blocked to avoid underfunded deposits that stay in waiting.'}
              </div>
            )}
            {quoteLooksEchoedExactOutput ? (
              <div className="mt-1 text-[10px] opacity-85">
                Same-chain EXACT_OUTPUT quote: Relay echoes the requested amount as
                `paymentDetails.amount` / `userTx.value`.
              </div>
            ) : null}
          </div>
          {preview.preflight.relayQuoteDiagnostics ? (
            <details className="rounded-md border border-white/10 bg-black/20 p-2 text-[10px] text-zinc-300">
              <summary className="cursor-pointer uppercase tracking-[0.16em] text-zinc-500">
                Relay quote diagnostics
              </summary>
              <div className="mt-2 space-y-1 break-all font-mono">
                <div>requestId: {preview.preflight.relayQuoteDiagnostics.requestId ?? 'n/a'}</div>
                <div>orderId: {preview.preflight.relayQuoteDiagnostics.orderId ?? 'n/a'}</div>
                <div>
                  paymentDetails.amount:{' '}
                  {preview.preflight.relayQuoteDiagnostics.paymentDetails?.amount ?? 'n/a'}
                </div>
                <div>
                  paymentDetails.depository:{' '}
                  {preview.preflight.relayQuoteDiagnostics.paymentDetails?.depository ?? 'n/a'}
                </div>
                <div>
                  userTx.value: {preview.preflight.relayQuoteDiagnostics.userTransaction?.value ?? 'n/a'}
                </div>
                <div>
                  userTx.selector:{' '}
                  {preview.preflight.relayQuoteDiagnostics.userTransaction?.dataSelector ?? 'n/a'}
                </div>
                {preview.preflight.relayQuoteDiagnostics.rawSnippet ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-zinc-500">raw snippet</summary>
                    <pre className="mt-1 whitespace-pre-wrap break-all text-[10px]">
                      {preview.preflight.relayQuoteDiagnostics.rawSnippet}
                    </pre>
                  </details>
                ) : null}
              </div>
            </details>
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
                : 'Relay hook-native remove route'}
            </div>
          </div>
          <p className="text-[10px] text-emerald-100/80">
            {isSelfAuthSession
              ? 'Submit exact request-bound deposit using Relay requestId, then require Relay success + owner-slot change before completion.'
              : 'Fetch Relay quote via hook, execute via `executeQuote`, then require Relay success + owner-slot change before reporting completion.'}
          </p>
          <div className="space-y-2 rounded-xl border border-white/15 bg-black/30 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span>Step 1. Select owner slot</span>
              <span className={preview ? 'text-emerald-300' : 'text-zinc-500'}>{preview ? 'done' : 'pending'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>
                {isSelfAuthSession
                  ? 'Step 2. Submit request-bound deposit'
                  : 'Step 2. Execute Relay quote'}
              </span>
              <span
                className={
                  preview && !submitBlockedByMissingRequiredDeposit
                    ? 'text-emerald-300'
                    : 'text-zinc-500'
                }
              >
                {preview && !submitBlockedByMissingRequiredDeposit ? 'ready' : 'blocked'}
              </span>
            </div>
          </div>
        </div>

        <details className="rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-zinc-300">
          <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Submission
          </summary>
          <div className="mt-3 space-y-3">
            <button
              type="button"
              disabled={submitBlocked}
              onClick={() => void handleRemove()}
              className="inline-flex rounded-xl border border-white/25 bg-black/40 px-4 py-2 text-sm text-zinc-200 hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitBlockedByMissingRequiredDeposit
                ? 'Blocked: missing required Relay deposit amount'
                : busy
                ? isSelfAuthSession
                  ? 'Submitting request-bound deposit…'
                  : 'Executing Relay quote…'
                : isSelfAuthSession
                  ? `Execute relay remove for owner index ${preview?.preflight.targetOwnerIndex ?? '?'} (self-auth mode)`
                  : !preview
                    ? 'Select an owner above first'
                    : `Execute relay remove for owner index ${preview.preflight.targetOwnerIndex}`}
            </button>
            {submitBlockedByMissingRequiredDeposit ? (
              <div className="text-[11px] text-amber-200/90">
                {isQuoteTxMode
                  ? 'Rebuild preview until Relay returns a positive quote tx value; cannot safely submit without a required deposit amount.'
                  : 'Rebuild preview until Relay returns `paymentDetails.amount`; request-bound deposit cannot be safely submitted without it.'}
              </div>
            ) : null}
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
