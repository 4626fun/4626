import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, RefreshCw, ShieldAlert, Flame, Radio, Send } from 'lucide-react'

import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { LoadingText } from '@/components/ui/LoadingState'

type LeaderboardRow = {
  rank: number
  creatorAddress: string
  tokenId: string
  totalSupply: string
  stakedSupply: string
  pnl30dUsd: number | null
  hlAccountValueUsd: number | null
  score: number
  latestPublications: Array<{
    kind: string
    scorecardUri: string | null
    scorecardCid: string | null
    lensPostId: string | null
    erc8004TxHash: string | null
    createdAt: string
  }>
}

type LeaderboardResponse = {
  snapshotTs: string | null
  topN: number
  totalRanked?: number
  rows: LeaderboardRow[]
  reason?: string
}

type CompareResponse = {
  onchain: {
    snapshotTs: string | null
    rows: Array<{
      rank: number
      creatorAddress: string
      tokenId: string
      score: number
    }>
  }
  remote:
    | { status: number; bodyExcerpt: string }
    | { error: string }
  jwtFingerprint: string
  note: string
}

async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  const res = await apiFetch('/api/v1/alfaclub/leaderboard', {})
  const json = (await res.json()) as ApiEnvelope<LeaderboardResponse> & {
    reason?: string
  }
  if (!res.ok) {
    const msg = typeof json.error === 'string' && json.error ? json.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  if (!json.success) {
    // read_disabled is the expected not-yet-enabled state — surface the empty shell.
    return (json.data ?? { snapshotTs: null, topN: 0, rows: [], reason: json.reason ?? 'unknown' }) as LeaderboardResponse
  }
  return json.data as LeaderboardResponse
}

async function postCompare(alfaclubJwt: string, alfaclubUrl: string): Promise<CompareResponse> {
  const res = await apiFetch('/api/v1/alfaclub/compare', {
    method: 'POST',
    withCredentials: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ alfaclubJwt, alfaclubUrl }),
  })
  const json = (await res.json()) as ApiEnvelope<CompareResponse>
  if (!res.ok || !json.success || !json.data) {
    const msg = typeof json.error === 'string' && json.error ? json.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return json.data
}

type RelayerResponse = {
  picked: number
  submitted: number
  failed: number
  abandoned: number
  skipped: string | null
  txHashes: string[]
  errors: Array<{ publicationKey: string; error: string }>
  dryRun: boolean
  ownerAddress: string | null
  ownerIndex: number | null
  durationMs: number
}

async function postRelayNow(dryRun: boolean, maxPerTick: number): Promise<RelayerResponse> {
  const res = await apiFetch('/api/v1/alfaclub/relay-now', {
    method: 'POST',
    withCredentials: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dryRun, maxPerTick }),
  })
  const json = (await res.json()) as ApiEnvelope<RelayerResponse>
  if (!res.ok || !json.success || !json.data) {
    const msg = typeof json.error === 'string' && json.error ? json.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return json.data
}

function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`
  return `${sign}$${abs.toFixed(2)}`
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

function BadgePill({
  tone,
  label,
}: {
  tone: 'ok' | 'warn' | 'neutral'
  label: string
}) {
  const cls =
    tone === 'ok'
      ? 'bg-emerald-500/15 text-emerald-300'
      : tone === 'warn'
        ? 'bg-amber-500/15 text-amber-200'
        : 'bg-zinc-500/15 text-zinc-300'
  return <span className={`rounded-full px-2 py-0.5 text-[10px] ${cls}`}>{label}</span>
}

export function AlfaClubVigilante() {
  const leaderboard = useQuery({
    queryKey: ['alfaclub-vigilante-leaderboard'],
    queryFn: fetchLeaderboard,
    refetchInterval: 5 * 60_000,
  })

  const [jwt, setJwt] = useState('')
  const [remoteUrl, setRemoteUrl] = useState('https://api.alfaclub.app/')
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [comparing, setComparing] = useState(false)

  const [relayerDryRun, setRelayerDryRun] = useState(true)
  const [relayerResult, setRelayerResult] = useState<RelayerResponse | null>(null)
  const [relayerError, setRelayerError] = useState<string | null>(null)
  const [relaying, setRelaying] = useState(false)

  const data = leaderboard.data
  const reason = data?.reason ?? null

  const readyBadge: { tone: 'ok' | 'warn'; label: string } = useMemo(() => {
    if (!data || reason === 'read_disabled') {
      return { tone: 'warn', label: 'Pipeline dormant' }
    }
    if (data.rows.length === 0) return { tone: 'warn', label: 'No snapshot yet' }
    return { tone: 'ok', label: 'Pipeline live' }
  }, [data, reason])

  async function handleCompareSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCompareError(null)
    setCompareResult(null)
    setComparing(true)
    try {
      const result = await postCompare(jwt.trim(), remoteUrl.trim())
      setCompareResult(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown_error'
      setCompareError(msg)
    } finally {
      setComparing(false)
    }
  }

  async function handleRelayClick() {
    setRelayerError(null)
    setRelayerResult(null)
    setRelaying(true)
    try {
      const result = await postRelayNow(relayerDryRun, 1)
      setRelayerResult(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown_error'
      setRelayerError(msg)
    } finally {
      setRelaying(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">AlfaClub Vigilante</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-400">
            Keepr Integrity Leaderboard — derived from FriendKey supply, FriendStake stake, and Hyperliquid
            30d PnL. All scoring and publishing are gated behind environment flags; the pipeline ships dormant.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BadgePill tone={readyBadge.tone} label={readyBadge.label} />
          {reason ? <BadgePill tone="neutral" label={reason} /> : null}
          <button
            type="button"
            onClick={() => leaderboard.refetch()}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-800/80 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </header>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
          <Activity className="h-4 w-4 text-emerald-300" />
          <div className="text-sm font-medium text-zinc-200">Leaderboard snapshot</div>
          {data?.snapshotTs ? (
            <div className="app-meta-value ml-auto text-[11px] text-zinc-500">
              snapshotTs: {data.snapshotTs}
            </div>
          ) : null}
        </div>
        <div className="p-4">
          {leaderboard.isLoading ? (
            <LoadingText labelOverride="Loading leaderboard…" />
          ) : leaderboard.isError ? (
            <div className="flex items-center gap-2 text-sm text-rose-400">
              <ShieldAlert className="h-4 w-4" />
              {(leaderboard.error as Error).message}
            </div>
          ) : !data || data.rows.length === 0 ? (
            <div className="text-sm text-zinc-400">
              {reason === 'read_disabled'
                ? 'ALFACLUB_VIGILANTE_READ_ENABLED is off. Enable it on Vercel and wait for the next cron run (daily 12:00 UTC) to populate this dashboard.'
                : 'No snapshot written yet. Trigger /api/v1/alfaclub/run manually (with x-cron-secret) to populate.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase text-zinc-500">
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Creator</th>
                    <th className="px-2 py-2">Token</th>
                    <th className="px-2 py-2">Supply / Staked</th>
                    <th className="px-2 py-2">HL acct</th>
                    <th className="px-2 py-2">30d PnL</th>
                    <th className="px-2 py-2">Score</th>
                    <th className="px-2 py-2">Last published</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={`${row.creatorAddress}:${row.tokenId}`} className="border-t border-zinc-800/80">
                      <td className="px-2 py-2 text-zinc-400">{row.rank}</td>
                      <td className="px-2 py-2 font-mono text-xs text-zinc-200">
                        {shortAddress(row.creatorAddress)}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs text-zinc-400">#{row.tokenId}</td>
                      <td className="px-2 py-2 text-xs text-zinc-300">
                        {row.totalSupply} / {row.stakedSupply}
                      </td>
                      <td className="px-2 py-2 text-xs text-zinc-300">{formatUsd(row.hlAccountValueUsd)}</td>
                      <td
                        className={`px-2 py-2 text-xs ${
                          (row.pnl30dUsd ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {formatUsd(row.pnl30dUsd)}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs text-zinc-200">
                        {row.score.toFixed(4)}
                      </td>
                      <td className="px-2 py-2 text-xs text-zinc-400">
                        {row.latestPublications.length === 0
                          ? '—'
                          : row.latestPublications
                              .map((p) =>
                                p.erc8004TxHash
                                  ? `erc8004:${p.erc8004TxHash.slice(0, 8)}…`
                                  : p.lensPostId
                                    ? `lens:${p.lensPostId.slice(0, 8)}…`
                                    : p.kind,
                              )
                              .join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
          <Radio className="h-4 w-4 text-amber-300" />
          <div className="text-sm font-medium text-zinc-200">BYO-JWT comparator (admin only)</div>
        </div>
        <form className="space-y-3 p-4" onSubmit={handleCompareSubmit}>
          <p className="text-xs text-zinc-400">
            Paste your own AlfaClub Privy bearer token to run a one-off cross-check against our onchain
            ranking. The token is used for a single outbound request and is never persisted.
          </p>
          <label className="block text-xs text-zinc-400">
            AlfaClub URL (must be on *.alfaclub.app)
            <input
              className="mt-1 w-full rounded-md bg-zinc-950/60 px-2 py-1 font-mono text-xs text-zinc-200 outline-none focus:ring-1 focus:ring-amber-300/40"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="block text-xs text-zinc-400">
            Privy JWT
            <textarea
              className="mt-1 h-24 w-full rounded-md bg-zinc-950/60 px-2 py-1 font-mono text-xs text-zinc-200 outline-none focus:ring-1 focus:ring-amber-300/40"
              value={jwt}
              onChange={(e) => setJwt(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={comparing || !jwt.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-3 py-1 text-xs text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
            >
              <Flame className="h-3 w-3" />
              {comparing ? 'Comparing…' : 'Run one-off compare'}
            </button>
            {compareError ? (
              <span className="text-xs text-rose-300">Error: {compareError}</span>
            ) : null}
          </div>
          {compareResult ? (
            <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-zinc-950/80 p-3 text-[11px] text-zinc-300">
{JSON.stringify(compareResult, null, 2)}
            </pre>
          ) : null}
        </form>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
          <Send className="h-4 w-4 text-sky-300" />
          <div className="text-sm font-medium text-zinc-200">Feedback relayer</div>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-zinc-400">
            One-shot invocation of the ERC-8004 feedback relayer. Dry-run resolves the Privy owner
            context and validates the top queued row's calldata but does not submit a UserOp. Routine
            relaying runs on the Railway Eliza process (setInterval); this button is an escape valve.
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={relayerDryRun}
              onChange={(e) => setRelayerDryRun(e.target.checked)}
              className="h-3 w-3"
            />
            Dry run (no onchain tx)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRelayClick}
              disabled={relaying}
              className="inline-flex items-center gap-1 rounded-md bg-sky-500/20 px-3 py-1 text-xs text-sky-100 hover:bg-sky-500/30 disabled:opacity-50"
            >
              <Send className="h-3 w-3" />
              {relaying ? 'Relaying…' : relayerDryRun ? 'Relay once (dry run)' : 'Relay once (submit)'}
            </button>
            {relayerError ? (
              <span className="text-xs text-rose-300">Error: {relayerError}</span>
            ) : null}
          </div>
          {relayerResult ? (
            <pre className="mt-1 max-h-80 overflow-auto rounded-md bg-zinc-950/80 p-3 text-[11px] text-zinc-300">
{JSON.stringify(relayerResult, null, 2)}
            </pre>
          ) : null}
        </div>
      </section>
    </div>
  )
}

export default AlfaClubVigilante
