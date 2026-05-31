import { CheckCircle2, ExternalLink } from 'lucide-react'

function shortAddr(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

type WaitlistAccountStatusCardProps = {
  zoraHandle: string | null
  zoraProfileUrl: string | null
  canonicalCswAddress: string | null
  signingStepComplete: boolean
  resetBusy: boolean
  onCopyAddress: (addr: string) => void
  onReset: () => void
}

export function WaitlistAccountStatusCard(props: WaitlistAccountStatusCardProps) {
  const {
    zoraHandle,
    zoraProfileUrl,
    canonicalCswAddress,
    signingStepComplete,
    resetBusy,
    onCopyAddress,
    onReset,
  } = props

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Setup complete
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                signingStepComplete
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/10 bg-white/[0.03] text-zinc-400'
              }`}
            >
              {signingStepComplete ? 'Signing enabled' : 'Signing optional'}
            </span>
          </div>
          <p className="text-sm text-zinc-300">
            {signingStepComplete ? 'Zora linked · ready for swaps and chat' : 'Zora linked · enable signing for swaps and chat'}
          </p>
          {(zoraHandle || canonicalCswAddress) ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
              {zoraHandle && zoraProfileUrl ? (
                <a
                  href={zoraProfileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 shrink-0 text-zinc-400 transition-colors hover:text-zinc-200"
                >
                  {zoraHandle}
                  <ExternalLink className="h-3 w-3 opacity-60" aria-hidden="true" />
                </a>
              ) : zoraHandle ? (
                <span className="shrink-0 text-zinc-400">{zoraHandle}</span>
              ) : null}
              {zoraHandle && canonicalCswAddress ? <span className="text-zinc-700">·</span> : null}
              {canonicalCswAddress ? (
                <button
                  type="button"
                  onClick={() => onCopyAddress(canonicalCswAddress)}
                  title={canonicalCswAddress}
                  className="shrink-0 font-mono text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  {shortAddr(canonicalCswAddress)}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          disabled={resetBusy}
          onClick={onReset}
          className="shrink-0 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-50"
        >
          {resetBusy ? 'Resetting…' : 'Reset'}
        </button>
      </div>
    </div>
  )
}
