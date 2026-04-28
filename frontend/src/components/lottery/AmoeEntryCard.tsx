import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Gift, Loader2 } from 'lucide-react'
import type { Address, Hex } from 'viem'
import { base } from 'viem/chains'
import { usePublicClient, useWalletClient } from 'wagmi'

import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'

// PR 2 — AMOE Linear Parity. Mirrors the server-side constants in
// `frontend/server/_lib/lottery/lotteryAmoe.ts` and the on-chain math in
// `CreatorLotteryManager.calculateWinChance` (PR 1, #395). Keep these in
// sync with the server. The on-chain value is authoritative; the preview
// here is for display only.
const AMOE_MIN_POINTS = 100
const AMOE_MAX_POINTS = 1_000_000
const BASE_CEILING_PPM = 40_000 // 4%, hard ceiling at $10K-equivalent

function estimateWinChancePPM(pointsBurned: number): number {
  if (!Number.isFinite(pointsBurned) || pointsBurned < AMOE_MIN_POINTS) return 0
  // 1 point = 1 cent. On-chain: PPM = swapValueUSD(1e6) / 250_000.
  // Substituting USD = points * 10_000:  PPM = points * 10_000 / 250_000 = points / 25.
  const raw = Math.floor(pointsBurned / 25)
  return Math.min(raw, BASE_CEILING_PPM)
}

function formatWinChancePct(ppm: number): string {
  // PPM → percent with up to 4 decimals, trimming trailing zeros for
  // readability ($1 → 0.0004%, $10K → 4%).
  const pct = ppm / 10_000
  if (pct === 0) return '0%'
  return `${pct.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%`
}

function clampPoints(value: number, max: number): number {
  if (!Number.isFinite(value)) return AMOE_MIN_POINTS
  const ceiling = Math.min(max, AMOE_MAX_POINTS)
  return Math.max(AMOE_MIN_POINTS, Math.min(ceiling, Math.floor(value)))
}

type CreditSnapshot = {
  wallet: Address
  credits: number
  creditsPerEntry: number
  entriesAvailable: number
  nextEntryAtCredits: number
}

type NonceResponse = CreditSnapshot & {
  creatorCoin: Address
  nonce: Hex
  issuedAt: string
  expiresAt: string
  chainId: number
  lotteryManager: Address
  message: string
}

type SubmitResponse = {
  txHash: Hex
  relayMode: 'server'
  pointsBurned: number
  pointsBurnedAsUSD: string
  estimatedWinChancePPM: number
  creditsConsumed: number
  creditsRemaining: number
  creditsPerEntry: number
  entriesAvailable: number
}

type CheckinResponse = {
  awarded: boolean
  awardedCredits: number
  credits: number
  creditsPerEntry: number
  entriesAvailable: number
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function parseJsonSafe<T>(value: unknown): ApiEnvelope<T> | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return {
    success: Boolean(record.success),
    data: record.data as T | undefined,
    error: typeof record.error === 'string' ? record.error : undefined,
  }
}

export function AmoeEntryCard(props: { walletAddress: Address | null; creatorCoin: Address | null }) {
  const { walletAddress, creatorCoin } = props
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId: base.id })
  const officialRulesUrl = (
    import.meta.env.VITE_AMOE_OFFICIAL_RULES_URL ?? 'https://4626.fun/terms#lottery-amoe-official-rules'
  ).trim()

  const [credits, setCredits] = useState(0)
  const [creditsPerEntry, setCreditsPerEntry] = useState(100)
  const [entriesAvailable, setEntriesAvailable] = useState(0)
  const [nextEntryAtCredits, setNextEntryAtCredits] = useState(100)
  const [loadingCredits, setLoadingCredits] = useState(false)
  const [checkinBusy, setCheckinBusy] = useState(false)
  const [entryBusy, setEntryBusy] = useState(false)
  const [txHash, setTxHash] = useState<Hex | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // PR 2 — user-selected points to burn. Defaults to the floor (100 pts =
  // $1 = 0.0004% pre-boost) so a one-click entry stays cheap. The slider
  // and numeric input are kept in sync via this single source of truth.
  const [pointsBurned, setPointsBurned] = useState<number>(AMOE_MIN_POINTS)

  const refreshCredits = useCallback(async () => {
    if (!walletAddress) return
    setLoadingCredits(true)
    try {
      const res = await apiFetch(`/api/v1/lottery/amoe/credits?wallet=${walletAddress}`, {
        method: 'GET',
        withCredentials: true,
      })
      const json = parseJsonSafe<CreditSnapshot>(await res.json().catch(() => null))
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || 'Failed to load AMOE credits')
      }
      setCredits(Number(json.data.credits ?? 0))
      setCreditsPerEntry(Number(json.data.creditsPerEntry ?? 100))
      setEntriesAvailable(Number(json.data.entriesAvailable ?? 0))
      setNextEntryAtCredits(Number(json.data.nextEntryAtCredits ?? 100))
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error, 'Unable to load AMOE credits'))
    } finally {
      setLoadingCredits(false)
    }
  }, [walletAddress])

  useEffect(() => {
    if (!walletAddress) {
      setCredits(0)
      setEntriesAvailable(0)
      setNextEntryAtCredits(creditsPerEntry)
      return
    }
  }, [creditsPerEntry, walletAddress])

  useEffect(() => {
    void refreshCredits()
  }, [refreshCredits])

  const handleTwitterCheckin = useCallback(async () => {
    if (!walletAddress) {
      setErrorMessage('Connect your wallet first')
      return
    }
    setCheckinBusy(true)
    setErrorMessage(null)
    setStatusMessage(null)
    try {
      const res = await apiFetch('/api/v1/lottery/amoe/twitter-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        withCredentials: true,
      })
      const json = parseJsonSafe<CheckinResponse>(await res.json().catch(() => null))
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || 'Twitter check-in failed')
      }

      setCredits(Number(json.data.credits ?? 0))
      setCreditsPerEntry(Number(json.data.creditsPerEntry ?? 100))
      setEntriesAvailable(Number(json.data.entriesAvailable ?? 0))
      setNextEntryAtCredits(Math.max(Number(json.data.creditsPerEntry ?? 100), Number(json.data.credits ?? 0)))
      setStatusMessage(
        json.data.awarded
          ? `Daily check-in complete (+${json.data.awardedCredits} credit)`
          : 'Daily check-in already claimed today',
      )
      await refreshCredits()
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error, 'Twitter check-in failed'))
    } finally {
      setCheckinBusy(false)
    }
  }, [refreshCredits, walletAddress])

  const handleEnterForFree = useCallback(async () => {
    if (!walletAddress || !creatorCoin) {
      setErrorMessage('Missing wallet or creator coin')
      return
    }
    if (!walletClient) {
      setErrorMessage('Connect a wallet capable of signing messages')
      return
    }

    setEntryBusy(true)
    setErrorMessage(null)
    setStatusMessage(null)
    setTxHash(null)

    try {
      const nonceRes = await apiFetch(
        `/api/v1/lottery/amoe/nonce?wallet=${walletAddress}&creatorCoin=${creatorCoin}`,
        { method: 'GET', withCredentials: true },
      )
      const nonceJson = parseJsonSafe<NonceResponse>(await nonceRes.json().catch(() => null))
      const nonceData = nonceJson?.data
      if (!nonceRes.ok || !nonceJson?.success || !nonceData) {
        throw new Error(nonceJson?.error || 'Failed to fetch AMOE nonce')
      }

      setCredits(Number(nonceData.credits ?? 0))
      setCreditsPerEntry(Number(nonceData.creditsPerEntry ?? 100))
      setEntriesAvailable(Number(nonceData.entriesAvailable ?? 0))
      setNextEntryAtCredits(Number(nonceData.nextEntryAtCredits ?? 100))

      // PR 2 — variable points amount. Clamp the user's selection against
      // the freshly fetched balance and the protocol caps. If they don't
      // have enough points for even the floor (100), surface a clear error.
      const liveBalance = Number(nonceData.credits ?? 0)
      if (liveBalance < AMOE_MIN_POINTS) {
        throw new Error(`Need at least ${AMOE_MIN_POINTS} credits to enter (you have ${liveBalance})`)
      }
      const requestedPoints = clampPoints(pointsBurned, liveBalance)
      if (requestedPoints !== pointsBurned) {
        // Reflect the clamp in the UI before submitting so the user knows
        // exactly what was sent.
        setPointsBurned(requestedPoints)
      }

      const signature = (await walletClient.signMessage({
        message: nonceData.message,
      })) as Hex

      // PR 2 — server-relay only. The previous client-relay fallback was
      // dropped: PR 1's `processAmoeEntry` is gated to a single relayer
      // key on-chain, so client-signed transactions cannot succeed. The
      // signed message above remains the off-chain auth + anti-replay
      // artifact (verified server-side).
      const submitRes = await apiFetch('/api/v1/lottery/amoe/submit', {
        method: 'POST',
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorCoin,
          message: nonceData.message,
          signature,
          pointsBurned: requestedPoints,
        }),
      })
      const submitJson = parseJsonSafe<SubmitResponse>(await submitRes.json().catch(() => null))
      if (!submitRes.ok || !submitJson?.success || !submitJson.data) {
        throw new Error(submitJson?.error || 'Failed to submit AMOE entry')
      }

      const tx = submitJson.data
      const hash = tx.txHash
      setTxHash(hash)
      setStatusMessage('AMOE entry relayed by protocol. Waiting for confirmation…')

      // Receipt confirmation is best-effort — if no public client is
      // configured we still surface the txHash so the user can follow up.
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash })
      }
      setCredits(Number(tx.creditsRemaining ?? 0))
      setCreditsPerEntry(Number(tx.creditsPerEntry ?? 100))
      setEntriesAvailable(Number(tx.entriesAvailable ?? 0))
      setNextEntryAtCredits(Math.max(Number(tx.creditsPerEntry ?? 100), Number(tx.creditsRemaining ?? 0)))
      const finalPpm = Number(tx.estimatedWinChancePPM ?? 0)
      setStatusMessage(
        `Free entry confirmed onchain (${tx.pointsBurned} pts → ${formatWinChancePct(finalPpm)} pre-boost)`,
      )
      await refreshCredits()
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error, 'Failed to submit free entry'))
    } finally {
      setEntryBusy(false)
    }
  }, [creatorCoin, pointsBurned, publicClient, refreshCredits, walletAddress, walletClient])

  const creditsPct = useMemo(() => clampPct((credits / Math.max(1, creditsPerEntry)) * 100), [credits, creditsPerEntry])
  const missingCredits = Math.max(0, creditsPerEntry - credits)

  // PR 2 — the slider's upper bound is min(balance, 1M). When balance is
  // below the floor we still render the slider (disabled) so users see the
  // "need 100 credits" affordance instead of an empty container.
  const sliderMax = Math.max(AMOE_MIN_POINTS, Math.min(credits, AMOE_MAX_POINTS))
  const hasEnoughForFloor = credits >= AMOE_MIN_POINTS
  const livePreviewPPM = useMemo(
    () => estimateWinChancePPM(clampPoints(pointsBurned, sliderMax)),
    [pointsBurned, sliderMax],
  )
  const livePreviewPct = formatWinChancePct(livePreviewPPM)

  // Keep selection in range when the live balance shrinks (e.g. after a
  // successful entry refresh).
  useEffect(() => {
    setPointsBurned((prev) => clampPoints(prev, sliderMax))
  }, [sliderMax])

  const canEnter = Boolean(
    walletAddress && creatorCoin && hasEnoughForFloor && !entryBusy && !checkinBusy,
  )

  return (
    <div className="card p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="label">AMOE Free Entry</p>
          <h3 className="text-lg font-medium text-zinc-100 mt-1">Daily Twitter Check-in</h3>
        </div>
        <Gift className="w-5 h-5 text-brand-primary" />
      </div>

      <p className="text-sm text-zinc-500">
        Complete your daily Twitter check-in to earn 1 credit. You need {creditsPerEntry} credits to submit 1 free entry.
      </p>
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-200">
          No purchase or payment of any kind is necessary to enter or win this sweepstakes.
        </p>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
          A purchase will not improve your chances of winning.
        </p>
        <p className="text-[11px] text-zinc-400">
          Free-entry and paid-entry lanes are processed under the same winner-selection flow. See Official Rules for
          eligibility, winner determination timing, odds, and restrictions.
        </p>
        <a
          href={officialRulesUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] text-brand-accent hover:text-brand-primary"
        >
          Official Rules (California) <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>
            Credits: <span className="text-zinc-200">{credits}</span> / {creditsPerEntry}
          </span>
          <span>Entries available: <span className="text-zinc-200">{entriesAvailable}</span></span>
        </div>
        <div className="h-2 rounded-full bg-white/8 overflow-hidden">
          <div className="h-full bg-brand-primary/80 transition-all" style={{ width: `${creditsPct}%` }} />
        </div>
        <div className="text-[11px] text-zinc-500">
          {entriesAvailable > 0 ? 'You can submit a free entry now.' : `${missingCredits} more credits needed for your next free entry.`}
        </div>
        {entriesAvailable < 1 ? (
          <div className="text-[11px] text-zinc-600">Next entry unlocks at {nextEntryAtCredits} credits.</div>
        ) : null}
      </div>

      {/* PR 2 — variable points selector. Slider + numeric input are bound
          to the same `pointsBurned` state so editing either one updates both.
          Live win-chance preview mirrors the on-chain formula — it is for
          display only; the server returns the authoritative PPM after
          submission. */}
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between text-xs text-zinc-300">
          <label htmlFor="amoe-points-slider" className="font-medium">
            Points to burn
          </label>
          <span className="text-zinc-400">
            Win chance: <span className="text-brand-accent">{livePreviewPct}</span>
          </span>
        </div>
        <input
          id="amoe-points-slider"
          type="range"
          min={AMOE_MIN_POINTS}
          max={sliderMax}
          step={1}
          value={clampPoints(pointsBurned, sliderMax)}
          onChange={(event) => setPointsBurned(clampPoints(Number(event.target.value), sliderMax))}
          disabled={!hasEnoughForFloor || entryBusy}
          className="w-full accent-brand-primary disabled:opacity-50"
        />
        <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
          <span>min {AMOE_MIN_POINTS}</span>
          <input
            type="number"
            min={AMOE_MIN_POINTS}
            max={sliderMax}
            step={1}
            value={clampPoints(pointsBurned, sliderMax)}
            onChange={(event) => setPointsBurned(clampPoints(Number(event.target.value), sliderMax))}
            disabled={!hasEnoughForFloor || entryBusy}
            className="w-28 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-right text-xs text-zinc-100 disabled:opacity-50"
            aria-label="Points to burn (numeric input)"
          />
          <span>max {sliderMax.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleTwitterCheckin()}
          disabled={!walletAddress || checkinBusy || entryBusy}
          className="rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {checkinBusy ? (
            <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Claiming…</span>
          ) : (
            'Claim daily Twitter credit (+1)'
          )}
        </button>
        <button
          type="button"
          onClick={() => void handleEnterForFree()}
          disabled={!canEnter}
          className="rounded-xl border border-brand-primary/35 bg-brand-primary/10 px-3 py-2 text-xs font-medium text-brand-accent hover:bg-brand-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {entryBusy ? (
            <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting…</span>
          ) : (
            `Enter for free (${clampPoints(pointsBurned, sliderMax).toLocaleString()} credits)`
          )}
        </button>
        <button
          type="button"
          onClick={() => void refreshCredits()}
          disabled={!walletAddress || loadingCredits || checkinBusy || entryBusy}
          className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingCredits ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {statusMessage ? <div className="text-xs text-emerald-300">{statusMessage}</div> : null}
      {errorMessage ? <div className="text-xs text-rose-300">{errorMessage}</div> : null}

      {txHash ? (
        <a
          href={`https://basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-brand-accent hover:text-brand-primary"
        >
          View transaction <ExternalLink className="w-3.5 h-3.5" />
        </a>
      ) : null}
    </div>
  )
}
