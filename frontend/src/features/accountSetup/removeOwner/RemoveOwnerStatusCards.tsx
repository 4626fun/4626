import { formatEther } from 'viem'

import type { AADepositDiagnostics } from '@/lib/removeOwner/removeOwnerHelpers'

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

type RemoveOwnerStatusCardsProps = {
  txHash: string | null
  patternLockStatus: PatternLockStatus
  strictTraceEnabled: boolean
  aaDepositDiagnostics: AADepositDiagnostics | null
  pageNotice: string | null
  pageError: string | null
  lastErrorDetail: LastErrorDetail | null
  eventLog: string[]
}

export function RemoveOwnerStatusCards(props: RemoveOwnerStatusCardsProps) {
  const {
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
    <>
      {txHash ? (
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs text-emerald-100 break-all">
          Submitted:{' '}
          <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer" className="font-mono underline">
            {txHash}
          </a>
        </div>
      ) : null}

      <div
        className={`rounded-xl border p-3 text-xs ${
          patternLockStatus.state === 'locked'
            ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
            : patternLockStatus.state === 'unlocked'
              ? 'border-rose-400/30 bg-rose-500/10 text-rose-100'
              : 'border-white/10 bg-black/30 text-zinc-300'
        }`}
      >
        <div className="text-[10px] uppercase tracking-[0.18em] opacity-80">AA Pattern</div>
        <div className="mt-1 font-semibold">{patternLockStatus.label}</div>
        <div className="mt-1 text-[11px] opacity-90">{patternLockStatus.detail}</div>
        {strictTraceEnabled ? (
          <div className="mt-1 text-[10px] opacity-80">
            strict trace mode enabled (<code className="font-mono">strictTrace=1</code>)
          </div>
        ) : null}
      </div>

      {aaDepositDiagnostics ? (
        <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-3 text-[11px] text-cyan-100 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/80">AA Deposit Diagnostics</div>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] text-cyan-200/70">tx hash</dt>
              <dd className="font-mono break-all">{aaDepositDiagnostics.txHash}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-cyan-200/70">block</dt>
              <dd className="font-mono">{aaDepositDiagnostics.blockNumber.toString()}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-cyan-200/70">userOp hash</dt>
              <dd className="font-mono break-all">{aaDepositDiagnostics.userOpHash ?? 'n/a'}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-cyan-200/70">userOp nonce</dt>
              <dd className="font-mono">
                {aaDepositDiagnostics.userOpNonce != null ? aaDepositDiagnostics.userOpNonce.toString() : 'n/a'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-cyan-200/70">userOp success</dt>
              <dd className="font-mono">
                {aaDepositDiagnostics.userOpSuccess == null
                  ? 'n/a'
                  : aaDepositDiagnostics.userOpSuccess
                    ? 'true'
                    : 'false'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-cyan-200/70">actual gas used</dt>
              <dd className="font-mono">
                {aaDepositDiagnostics.actualGasUsed != null ? aaDepositDiagnostics.actualGasUsed.toString() : 'n/a'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-cyan-200/70">userOp paymaster</dt>
              <dd className="font-mono break-all">{aaDepositDiagnostics.userOpPaymaster ?? 'none'}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-cyan-200/70">actual gas cost (wei)</dt>
              <dd className="font-mono">
                {aaDepositDiagnostics.actualGasCostWei != null
                  ? aaDepositDiagnostics.actualGasCostWei.toString()
                  : 'n/a'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-cyan-200/70">actual gas cost (ETH)</dt>
              <dd className="font-mono">
                {aaDepositDiagnostics.actualGasCostWei != null ? formatEther(aaDepositDiagnostics.actualGasCostWei) : 'n/a'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-cyan-200/70">relay deposit from</dt>
              <dd className="font-mono break-all">{aaDepositDiagnostics.relayDepositFrom ?? 'n/a'}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-cyan-200/70">relay deposit amount (wei)</dt>
              <dd className="font-mono">
                {aaDepositDiagnostics.relayDepositAmountWei != null
                  ? aaDepositDiagnostics.relayDepositAmountWei.toString()
                  : 'n/a'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-cyan-200/70">relay deposit amount (ETH)</dt>
              <dd className="font-mono">
                {aaDepositDiagnostics.relayDepositAmountWei != null
                  ? formatEther(aaDepositDiagnostics.relayDepositAmountWei)
                  : 'n/a'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-cyan-200/70">requestId (deposit)</dt>
              <dd className="font-mono break-all">{aaDepositDiagnostics.relayDepositRequestId ?? 'n/a'}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-cyan-200/70">requestId (expected)</dt>
              <dd className="font-mono break-all">{aaDepositDiagnostics.expectedRequestId}</dd>
            </div>
          </dl>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-5">
            <div className="font-mono text-[10px]">
              entrypoint userOp:{' '}
              <span className={aaDepositDiagnostics.checks.hasEntryPointUserOpForCsw ? 'text-emerald-300' : 'text-rose-300'}>
                {aaDepositDiagnostics.checks.hasEntryPointUserOpForCsw ? 'ok' : 'missing'}
              </span>
            </div>
            <div className="font-mono text-[10px]">
              relay deposit:{' '}
              <span className={aaDepositDiagnostics.checks.hasRelayDepositForCsw ? 'text-emerald-300' : 'text-rose-300'}>
                {aaDepositDiagnostics.checks.hasRelayDepositForCsw ? 'ok' : 'missing'}
              </span>
            </div>
            <div className="font-mono text-[10px]">
              request match:{' '}
              <span className={aaDepositDiagnostics.checks.requestIdMatches ? 'text-emerald-300' : 'text-rose-300'}>
                {aaDepositDiagnostics.checks.requestIdMatches ? 'ok' : 'mismatch'}
              </span>
            </div>
            {aaDepositDiagnostics.checks.traceEntryPointToCsw != null ? (
              <div className="font-mono text-[10px]">
                trace entrypoint→csw:{' '}
                <span className={aaDepositDiagnostics.checks.traceEntryPointToCsw ? 'text-emerald-300' : 'text-rose-300'}>
                  {aaDepositDiagnostics.checks.traceEntryPointToCsw ? 'ok' : 'missing'}
                </span>
              </div>
            ) : null}
            {aaDepositDiagnostics.checks.traceCswToDepository != null ? (
              <div className="font-mono text-[10px]">
                trace csw→depository:{' '}
                <span className={aaDepositDiagnostics.checks.traceCswToDepository ? 'text-emerald-300' : 'text-rose-300'}>
                  {aaDepositDiagnostics.checks.traceCswToDepository ? 'ok' : 'missing'}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {pageNotice ? (
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
          {pageNotice}
        </div>
      ) : null}

      {pageError ? (
        <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-100 break-all">
          {pageError}
        </div>
      ) : null}

      {lastErrorDetail ? (
        <div className="rounded-xl border border-rose-400/25 bg-rose-500/5 p-3 text-[11px] text-rose-100 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-rose-200/70">Relay revert detail</div>
          {lastErrorDetail.revertReason ? (
            <div>
              <div className="text-[10px] text-rose-200/60">reason</div>
              <div className="font-mono break-all">{lastErrorDetail.revertReason}</div>
            </div>
          ) : null}
          {lastErrorDetail.revertData ? (
            <div>
              <div className="text-[10px] text-rose-200/60">revert data (first 4 bytes = AA selector)</div>
              <div className="font-mono break-all">{lastErrorDetail.revertData}</div>
            </div>
          ) : null}
          {lastErrorDetail.relayTx ? (
            <details>
              <summary className="cursor-pointer text-[10px] text-rose-200/60">relay tx blob</summary>
              <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[10px]">
                {JSON.stringify(lastErrorDetail.relayTx, null, 2)}
              </pre>
            </details>
          ) : null}
          {lastErrorDetail.rawBody ? (
            <details>
              <summary className="cursor-pointer text-[10px] text-rose-200/60">raw response (first 2k chars)</summary>
              <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[10px]">{lastErrorDetail.rawBody}</pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {eventLog.length > 0 ? (
        <details className="rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-zinc-300">
          <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Lane events ({eventLog.length})
          </summary>
          <div className="mt-2 whitespace-pre-wrap break-all font-mono text-[10px]">{eventLog.join('\n')}</div>
        </details>
      ) : null}
    </>
  )
}
