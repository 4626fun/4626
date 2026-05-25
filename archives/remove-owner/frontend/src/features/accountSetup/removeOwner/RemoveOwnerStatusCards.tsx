type LastErrorDetail = {
  revertReason: string | null
  revertData: string | null
  relayTx: unknown
  rawBody: string | null
}

type RemoveOwnerStatusCardsProps = {
  txHash: string | null
  pageNotice: string | null
  pageError: string | null
  lastErrorDetail: LastErrorDetail | null
  eventLog: string[]
}

export function RemoveOwnerStatusCards(props: RemoveOwnerStatusCardsProps) {
  const {
    txHash,
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

      {import.meta.env.DEV && eventLog.length > 0 ? (
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
