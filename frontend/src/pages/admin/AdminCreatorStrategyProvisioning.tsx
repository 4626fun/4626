import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Clock, RefreshCw, X } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Operator triage dashboard for `creator_strategy_features`.
 *
 * Lists pending + failed + active rows (by age, pending first) so the
 * on-call operator can triage what needs provisioning. Each row shows:
 *   - creator + feature + payment source + age
 *   - provisioner note (from `metadata.provisionerNote` — the server's
 *     dispatcher records the expected next step per payment path)
 *   - payment tx hash (BaseScan link for USDC/x402, Stripe session id
 *     for card payments)
 *   - inline actions: "Mark active" (requires a provisionerRef) or
 *     "Mark failed" (requires a failureReason)
 *
 * Does NOT execute onchain work itself — that's a Safe tx the operator
 * submits via app.safe.global or a runbook script like
 * `scripts/activate-strategy-post-deploy.ts`. This page is just the
 * bookkeeping layer that moves a row's DB status from `pending` to
 * `active`/`failed` after the operator has done the real work.
 */

type QueueRow = {
  id: number
  creatorToken: `0x${string}`
  featureKey: string
  status: 'pending' | 'active' | 'failed' | 'refunded'
  paymentSource: string
  priceUsdcPaid: string
  paymentTxHash: `0x${string}` | null
  paymentFrom: `0x${string}` | null
  paymentVerifiedAt: string | null
  provisionedAt: string | null
  failedAt: string | null
  refundedAt: string | null
  provisionerRef: string | null
  failureReason: string | null
  provisionerNote: string | null
  createdAt: string
  updatedAt: string
  ageSeconds: number
}

type QueueResponse = {
  counts: { pending: number; failed: number; active: number; total: number }
  rows: QueueRow[]
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`
  return `${Math.floor(seconds / 86_400)}d`
}

function formatUsdcBaseUnits(raw: string): string {
  try {
    const n = BigInt(raw)
    const whole = n / 1_000_000n
    const fraction = n % 1_000_000n
    if (fraction === 0n) return `$${whole.toString()}`
    const fracStr = fraction.toString().padStart(6, '0').replace(/0+$/, '')
    return `$${whole.toString()}.${fracStr}`
  } catch {
    return raw
  }
}

function shortHex(value: string | null | undefined, keep = 6): string {
  if (!value) return '—'
  if (value.length <= keep * 2 + 2) return value
  return `${value.slice(0, keep + 2)}…${value.slice(-keep)}`
}

export function AdminCreatorStrategyProvisioning() {
  const [data, setData] = useState<QueueResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyRowId, setBusyRowId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/creator-strategy/provisioning-queue', {
        credentials: 'include',
      })
      const json = (await res.json()) as { success: boolean; data?: QueueResponse; error?: string }
      if (!json.success || !json.data) throw new Error(json.error ?? `HTTP ${res.status}`)
      setData(json.data)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const mutate = useCallback(
    async (row: QueueRow, action: 'mark_active' | 'mark_failed') => {
      setBusyRowId(row.id)
      setToast(null)
      try {
        let provisionerRef: string | null = null
        let failureReason: string | null = null
        if (action === 'mark_active') {
          provisionerRef = window.prompt(
            `Provisioner ref for activation #${row.id} (${row.featureKey})?\n\n` +
              `Examples:\n` +
              `  - Base tx hash 0x… for an EVM Safe tx\n` +
              `  - Solana pool pubkey + alpha vault (comma-separated) for Meteora\n` +
              `  - "manual_sql" for DB-only state transitions`,
          )
          if (!provisionerRef || !provisionerRef.trim()) {
            setBusyRowId(null)
            return
          }
        } else if (action === 'mark_failed') {
          failureReason = window.prompt(
            `Failure reason for activation #${row.id}?\n\n` +
              `Should briefly explain what blocked provisioning so support can follow up with the creator.`,
          )
          if (!failureReason || !failureReason.trim()) {
            setBusyRowId(null)
            return
          }
        }

        const res = await fetch('/api/admin/creator-strategy/provisioning-queue', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            activationId: row.id,
            action,
            provisionerRef: provisionerRef?.trim() ?? undefined,
            failureReason: failureReason?.trim() ?? undefined,
          }),
        })
        const json = (await res.json()) as { success: boolean; error?: string }
        if (!json.success) throw new Error(json.error ?? `HTTP ${res.status}`)
        setToast({ tone: 'success', message: `Activation #${row.id} updated.` })
        await load()
      } catch (err) {
        setToast({
          tone: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      } finally {
        setBusyRowId(null)
      }
    },
    [load],
  )

  const pendingRows = useMemo(() => data?.rows.filter((r) => r.status === 'pending') ?? [], [data])
  const failedRows = useMemo(() => data?.rows.filter((r) => r.status === 'failed') ?? [], [data])
  const activeRows = useMemo(() => data?.rows.filter((r) => r.status === 'active') ?? [], [data])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-white">Strategy feature provisioning queue</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Triage `creator_strategy_features` rows — mark each row `active` after you've executed its runbook, or
            `failed` if provisioning can't complete.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.04] disabled:opacity-50"
        >
          {loading ? <Spinner size="sm" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </header>

      {toast && (
        <div
          className={
            'mt-4 rounded-lg border px-3 py-2 text-xs ' +
            (toast.tone === 'success'
              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
              : 'border-red-400/30 bg-red-400/10 text-red-200')
          }
        >
          {toast.message}
        </div>
      )}

      {loadError && (
        <div className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
          Load failed: {loadError}
        </div>
      )}

      {data && (
        <div className="mt-6 grid grid-cols-4 gap-3">
          <Counter label="Pending" value={data.counts.pending} tone="amber" />
          <Counter label="Failed" value={data.counts.failed} tone="red" />
          <Counter label="Active" value={data.counts.active} tone="emerald" />
          <Counter label="Total shown" value={data.counts.total} tone="neutral" />
        </div>
      )}

      <Section title="Pending — waiting for provisioning" rows={pendingRows} mutate={mutate} busyRowId={busyRowId} />
      <Section title="Failed — needs operator attention" rows={failedRows} mutate={mutate} busyRowId={busyRowId} />
      <Section title="Active — recent completions" rows={activeRows} mutate={mutate} busyRowId={busyRowId} readOnly />
    </div>
  )
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'amber' | 'red' | 'emerald' | 'neutral'
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-400/30 bg-amber-400/5 text-amber-100'
      : tone === 'red'
      ? 'border-red-400/30 bg-red-400/5 text-red-100'
      : tone === 'emerald'
      ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-100'
      : 'border-white/10 bg-white/[0.02] text-zinc-300'
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${toneClass}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-light">{value}</div>
    </div>
  )
}

function Section({
  title,
  rows,
  mutate,
  busyRowId,
  readOnly,
}: {
  title: string
  rows: QueueRow[]
  mutate: (row: QueueRow, action: 'mark_active' | 'mark_failed') => void | Promise<void>
  busyRowId: number | null
  readOnly?: boolean
}) {
  if (rows.length === 0) {
    return (
      <section className="mt-8">
        <h2 className="text-sm font-medium text-zinc-300">{title}</h2>
        <p className="mt-2 text-xs text-zinc-500">(no rows)</p>
      </section>
    )
  }
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-zinc-300">{title}</h2>
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <RowCard key={row.id} row={row} mutate={mutate} busy={busyRowId === row.id} readOnly={readOnly} />
        ))}
      </div>
    </section>
  )
}

function RowCard({
  row,
  mutate,
  busy,
  readOnly,
}: {
  row: QueueRow
  mutate: (row: QueueRow, action: 'mark_active' | 'mark_failed') => void | Promise<void>
  busy: boolean
  readOnly?: boolean
}) {
  const statusIcon =
    row.status === 'active' ? (
      <Check className="h-3.5 w-3.5 text-emerald-300" />
    ) : row.status === 'failed' ? (
      <X className="h-3.5 w-3.5 text-red-300" />
    ) : (
      <Clock className="h-3.5 w-3.5 text-amber-300" />
    )
  return (
    <article className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-white">
            {statusIcon}
            <span className="font-medium">#{row.id}</span>
            <span className="font-mono text-xs text-zinc-400">{row.featureKey}</span>
            <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
              {row.paymentSource}
            </span>
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            creator <span className="font-mono">{shortHex(row.creatorToken, 6)}</span>
            {row.paymentFrom && (
              <>
                {' '}
                · paid by <span className="font-mono">{shortHex(row.paymentFrom, 6)}</span>
              </>
            )}
            {' '}· amount {formatUsdcBaseUnits(row.priceUsdcPaid)}
            {' '}· age {formatAge(row.ageSeconds)}
            {' '}· created {new Date(row.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
          </div>
          {row.paymentTxHash && (
            <div className="mt-1 text-xs text-zinc-500">
              tx{' '}
              <a
                href={`https://basescan.org/tx/${row.paymentTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono underline decoration-dotted hover:text-zinc-300"
              >
                {shortHex(row.paymentTxHash, 8)}
              </a>
            </div>
          )}
          {row.provisionerRef && (
            <div className="mt-1 text-xs text-emerald-300">
              provisioner ref: <span className="font-mono">{row.provisionerRef}</span>
            </div>
          )}
          {row.failureReason && (
            <div className="mt-1 text-xs text-red-300">failure: {row.failureReason}</div>
          )}
          {row.provisionerNote && row.status === 'pending' && (
            <details className="mt-2 text-xs text-zinc-500">
              <summary className="cursor-pointer text-zinc-400 hover:text-zinc-300">Operator note</summary>
              <pre className="mt-1 whitespace-pre-wrap rounded bg-black/40 p-2 text-[11px] leading-relaxed text-zinc-400">
                {row.provisionerNote}
              </pre>
            </details>
          )}
        </div>
        {!readOnly && row.status !== 'active' && row.status !== 'refunded' && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => mutate(row, 'mark_active')}
              disabled={busy}
              className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-50"
            >
              Mark active
            </button>
            <button
              type="button"
              onClick={() => mutate(row, 'mark_failed')}
              disabled={busy}
              className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs text-red-100 hover:bg-red-400/20 disabled:opacity-50"
            >
              Mark failed
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
