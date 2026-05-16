import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Gift, MessageCircle } from 'lucide-react'
import type { Address, Hex } from 'viem'
import { base } from 'viem/chains'
import { usePublicClient, useWalletClient } from 'wagmi'

import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { Spinner } from '@/components/ui/Spinner'
import { requestOpenChat } from '@/lib/chat/openChat'
import { getMarketingBaseUrl } from '@/lib/env/host'

// PR 2 — AMOE Linear Parity. Mirrors the server-side constants in
// `frontend/server/_lib/lottery/lotteryAmoe.ts` and the on-chain math in
// `CreatorLotteryManager.calculateWinChance` (PR 1, #395). Keep these in
// sync with the server. The on-chain value is authoritative; the preview
// here is for display only.
const AMOE_MIN_POINTS = 100
const AMOE_MAX_POINTS = 1_000_000
const BASE_CEILING_PPM = 40_000 // 4%, hard ceiling at $10K-equivalent
const AMOE_XMTP_AGENT_ADDRESS = (
  import.meta.env.VITE_AGENT_XMTP_ADDRESS ?? '0xab6d5c10b03300326cd7fab7267ae192842967b5'
).trim().toLowerCase() as Address

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

type CreatorLotteryStatsResponse = {
  jackpotUsd?: string | null
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

type BurnCreditsResponse = {
  spendRefId: string
  consumed: number
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

export type AmoeSigningWalletClient = {
  signMessage: (args: { message: string }) => Promise<Hex | string>
}

function deriveAmoeTwitterHandleFallback(wallet: Address): string {
  const compact = wallet.toLowerCase().replace(/^0x/, '')
  return `wallet_${compact.slice(0, 12)}`
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

function formatUsdDisplay(value: string | null): string | null {
  if (!value) return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return numeric.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: numeric >= 100 ? 0 : 2,
  })
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.9 2h3.3l-7.2 8.2L23.5 22h-6.7l-5.2-6.8L5.6 22H2.3l7.7-8.8L1.8 2h6.8l4.7 6.2L18.9 2Zm-1.2 17.9h1.8L7.6 4H5.7l12 15.9Z" />
    </svg>
  )
}

function buildAmoeShareText(): string {
  return [
    'Checking in for 4626 Alternative Method of Entry.',
    'No purchase necessary.',
    'Earn points through eligible actions and use them for free jackpot entries.',
    'Join me:',
  ].join(' ')
}

function buildXIntentUrl(): string {
  const params = new URLSearchParams({
    text: buildAmoeShareText(),
    url: getMarketingBaseUrl(),
  })
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

function openXPost() {
  if (typeof window === 'undefined') return
  window.open(buildXIntentUrl(), '_blank', 'noopener,noreferrer')
}

export const __testHooks = {
  buildAmoeShareText,
  buildXIntentUrl,
}

export function AmoeEntryCard(props: {
  walletAddress: Address | null
  creatorCoin: Address | null
  walletClientOverride?: AmoeSigningWalletClient | null
}) {
  const { walletAddress, creatorCoin, walletClientOverride } = props
  const { data: connectedWalletClient } = useWalletClient()
  const walletClient = walletClientOverride ?? connectedWalletClient
  const publicClient = usePublicClient({ chainId: base.id })
  const protocolEntryMode = creatorCoin === null
  const officialRulesUrl = (
    import.meta.env.VITE_AMOE_OFFICIAL_RULES_URL ?? 'https://4626.fun/terms#lottery-amoe-official-rules'
  ).trim()

  const [credits, setCredits] = useState(0)
  const [creditsPerEntry, setCreditsPerEntry] = useState(100)
  const [, setEntriesAvailable] = useState(0)
  const [, setNextEntryAtCredits] = useState(100)
  const [jackpotUsd, setJackpotUsd] = useState<string | null>(null)
  const [loadingCredits, setLoadingCredits] = useState(false)
  const [checkinBusy, setCheckinBusy] = useState(false)
  const [tweetProofUrl, setTweetProofUrl] = useState('')
  const [entryBusy, setEntryBusy] = useState(false)
  const [txHash, setTxHash] = useState<Hex | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // PR 2 — user-selected points to burn. Defaults to the floor (100 pts =
  // $1 = 0.0004% pre-boost) so a one-click entry stays cheap. The slider
  // and numeric input are kept in sync via this single source of truth.
  const [pointsBurned, setPointsBurned] = useState<number>(AMOE_MIN_POINTS)

  const refreshCredits = useCallback(async () => {
    if (!walletAddress && !protocolEntryMode) return
    setLoadingCredits(true)
    try {
      const creditParams = new URLSearchParams()
      if (walletAddress) creditParams.set('wallet', walletAddress)
      const creditsUrl = `/api/v1/lottery/amoe/credits${creditParams.size > 0 ? `?${creditParams.toString()}` : ''}`
      const res = await apiFetch(creditsUrl, {
        method: 'GET',
        withCredentials: true,
      })
      const json = parseJsonSafe<CreditSnapshot>(await res.json().catch(() => null))
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || 'Failed to load AMOE points')
      }
      setCredits(Number(json.data.credits ?? 0))
      setCreditsPerEntry(Number(json.data.creditsPerEntry ?? 100))
      setEntriesAvailable(Number(json.data.entriesAvailable ?? 0))
      setNextEntryAtCredits(Number(json.data.nextEntryAtCredits ?? 100))

      const statsParams = new URLSearchParams()
      if (creatorCoin) statsParams.set('creatorCoin', creatorCoin)
      const statsUrl = `/api/v1/lottery/creator${statsParams.size > 0 ? `?${statsParams.toString()}` : ''}`
      const statsRes = await apiFetch(statsUrl, { method: 'GET', withCredentials: true })
      const statsJson = parseJsonSafe<CreatorLotteryStatsResponse>(await statsRes.json().catch(() => null))
      setJackpotUsd(statsRes.ok && statsJson?.success ? (statsJson.data?.jackpotUsd ?? null) : null)
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error, 'Unable to load AMOE points'))
      setJackpotUsd(null)
    } finally {
      setLoadingCredits(false)
    }
  }, [creatorCoin, protocolEntryMode, walletAddress])

  useEffect(() => {
    if (!walletAddress && !protocolEntryMode) {
      setCredits(0)
      setEntriesAvailable(0)
      setNextEntryAtCredits(creditsPerEntry)
      return
    }
  }, [creditsPerEntry, protocolEntryMode, walletAddress])

  useEffect(() => {
    void refreshCredits()
  }, [refreshCredits])

  const handleTwitterCheckin = useCallback(async () => {
    if (!walletAddress && !protocolEntryMode) {
      setErrorMessage('Connect your wallet first')
      return
    }
    const trimmedTweetUrl = tweetProofUrl.trim()
    if (!trimmedTweetUrl) {
      setErrorMessage('Paste your posted X link first')
      return
    }
    setCheckinBusy(true)
    setErrorMessage(null)
    setStatusMessage(null)
    try {
      const res = await apiFetch('/api/v1/lottery/amoe/twitter-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetUrl: trimmedTweetUrl }),
        withCredentials: true,
      })
      const json = parseJsonSafe<CheckinResponse>(await res.json().catch(() => null))
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || 'X check-in failed')
      }

      setCredits(Number(json.data.credits ?? 0))
      setCreditsPerEntry(Number(json.data.creditsPerEntry ?? 100))
      setEntriesAvailable(Number(json.data.entriesAvailable ?? 0))
      setNextEntryAtCredits(Math.max(Number(json.data.creditsPerEntry ?? 100), Number(json.data.credits ?? 0)))
      setStatusMessage(
        json.data.awarded
          ? `Daily X check-in complete (+${json.data.awardedCredits} points)`
          : 'Daily check-in already claimed today',
      )
      setTweetProofUrl('')
      await refreshCredits()
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error, 'X check-in failed'))
    } finally {
      setCheckinBusy(false)
    }
  }, [protocolEntryMode, refreshCredits, tweetProofUrl, walletAddress])

  const handleXmtpCheckin = useCallback(async () => {
    if (!walletAddress && !protocolEntryMode) {
      setErrorMessage('Connect your wallet first')
      return
    }
    setErrorMessage(null)
    setStatusMessage('Send a DM to agent 4626 in chat. Points are awarded after the message is sent.')
    requestOpenChat({
      kind: 'dm',
      peerAddress: AMOE_XMTP_AGENT_ADDRESS,
      nameHint: 'agent 4626',
    })
  }, [protocolEntryMode, walletAddress])

  const handleEnterForFree = useCallback(async () => {
    if (!walletAddress && !protocolEntryMode) {
      setErrorMessage('Missing wallet')
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
      const nonceParams = new URLSearchParams()
      if (walletAddress) nonceParams.set('wallet', walletAddress)
      if (creatorCoin) nonceParams.set('creatorCoin', creatorCoin)
      const nonceRes = await apiFetch(`/api/v1/lottery/amoe/nonce?${nonceParams.toString()}`, {
        method: 'GET',
        withCredentials: true,
      })
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
        throw new Error(`Need at least ${AMOE_MIN_POINTS} points to enter (you have ${liveBalance})`)
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

      const twitterHandle = deriveAmoeTwitterHandleFallback(nonceData.wallet)
      const spendRefId = `amoe-ui:${nonceData.creatorCoin}:${nonceData.nonce}`

      // ZK flow phase A: burn points and register burn intent.
      // If the endpoint is disabled in an environment, we still attempt
      // submit-zk below so legacy single-call mode can continue to work.
      const burnRes = await apiFetch('/api/v1/lottery/amoe/burn-credits', {
        method: 'POST',
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorCoin: nonceData.creatorCoin,
          message: nonceData.message,
          signature,
          pointsBurned: requestedPoints,
          nonce: nonceData.nonce,
          twitterHandle,
          spendRefId,
        }),
      })
      const burnJson = parseJsonSafe<BurnCreditsResponse>(await burnRes.json().catch(() => null))
      if (!burnRes.ok) {
        const burnError = burnJson?.error || 'Burn credits failed'
        if (burnError !== 'burn_credits_disabled') {
          throw new Error(burnError)
        }
      }

      // ZK flow phase B: submit proof-backed entry.
      const submitRes = await apiFetch('/api/v1/lottery/amoe/submit-zk', {
        method: 'POST',
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorCoin: nonceData.creatorCoin,
          message: nonceData.message,
          signature,
          pointsBurned: requestedPoints,
          nonce: nonceData.nonce,
          twitterHandle,
          spendRefId,
        }),
      })
      const submitJson = parseJsonSafe<SubmitResponse>(await submitRes.json().catch(() => null))
      if (!submitRes.ok || !submitJson?.success || !submitJson.data) {
        throw new Error(submitJson?.error || 'Failed to submit AMOE ZK entry')
      }

      const tx = submitJson.data
      const hash = tx.txHash
      setTxHash(hash)
      setStatusMessage('AMOE ZK entry relayed by protocol. Waiting for confirmation…')

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
  }, [creatorCoin, pointsBurned, protocolEntryMode, publicClient, refreshCredits, walletAddress, walletClient])

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
  const jackpotUsdDisplay = useMemo(() => formatUsdDisplay(jackpotUsd), [jackpotUsd])

  // Keep selection in range when the live balance shrinks (e.g. after a
  // successful entry refresh).
  useEffect(() => {
    setPointsBurned((prev) => clampPoints(prev, sliderMax))
  }, [sliderMax])

  const canEnter = Boolean(
    (walletAddress || protocolEntryMode) &&
      hasEnoughForFloor &&
      !entryBusy &&
      !checkinBusy &&
      !xmtpCheckinBusy,
  )
  const selectedPoints = clampPoints(pointsBurned, sliderMax)

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(145deg,rgb(var(--vault-card-raised)/0.88),rgb(var(--vault-card)/0.66))] p-5 shadow-[0_28px_80px_-42px_rgb(var(--brand-primary)/0.8),0_18px_42px_-34px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.07] sm:p-6">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-blue-300/35 to-transparent" />
      <div className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-blue-500/12 blur-3xl" />
      <div className="relative space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label">Alternative Method of Entry</p>
            <h3 className="text-lg font-medium text-zinc-100 mt-1">
              Free entry
            </h3>
          </div>
          <Gift className="w-5 h-5 text-brand-primary" />
        </div>

        <p className="text-sm leading-5 text-zinc-500">
          AMOE (Alternative Method of Entry) lets users earn points through eligible 4626 actions for a free entry to win the jackpot.
        </p>
        <div className="rounded-2xl bg-black/18 p-3 shadow-inner shadow-black/25">
          <p className="text-[11px] font-semibold uppercase leading-5 tracking-wide text-zinc-200">
            No purchase necessary. A purchase will not improve your chances of winning.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
            <span>Free and paid entries share the same winner-selection flow.</span>
            <a
              href={officialRulesUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-brand-accent hover:text-brand-primary"
            >
              Official Rules <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="space-y-3 rounded-[22px] bg-[linear-gradient(150deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_40px_-30px_rgba(0,0,0,0.9)]">
          <div className="flex items-start justify-between gap-3 text-xs">
            <div>
              <div className="text-zinc-500">Your AMOE-eligible points</div>
              <div className="mt-0.5 text-lg font-semibold text-zinc-100">
                {credits.toLocaleString()}
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Waitlist total can be higher than AMOE-eligible points.
              </div>
            </div>
            {jackpotUsdDisplay ? (
              <div className="text-right">
                <div className="text-zinc-500">Current jackpot</div>
                <div className="mt-0.5 text-sm font-medium text-zinc-100">{jackpotUsdDisplay}</div>
              </div>
            ) : null}
          </div>
          {!hasEnoughForFloor ? (
            <div className="space-y-2 text-xs">
              <div>
                <div className="font-medium text-zinc-100">Not enough points to enter</div>
                <div className="mt-1 text-zinc-500">
                  You need {missingCredits.toLocaleString()} more points to unlock a free entry.
                </div>
              </div>
              <div className="text-zinc-500">Minimum entry: {AMOE_MIN_POINTS.toLocaleString()} points</div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Ready to enter.</span>
                <span>
                  Win chance: <span className="text-brand-accent">{livePreviewPct}</span>
                </span>
              </div>
              <label htmlFor="amoe-points-slider" className="text-xs font-medium text-zinc-300">
                Entry amount
              </label>
              <input
                id="amoe-points-slider"
                type="range"
                min={AMOE_MIN_POINTS}
                max={sliderMax}
                step={1}
                value={selectedPoints}
                onChange={(event) => setPointsBurned(clampPoints(Number(event.target.value), sliderMax))}
                disabled={entryBusy}
                className="w-full accent-brand-primary disabled:opacity-50"
              />
              <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                <span>{AMOE_MIN_POINTS} min</span>
                <input
                  type="number"
                  min={AMOE_MIN_POINTS}
                  max={sliderMax}
                  step={1}
                  value={selectedPoints}
                  onChange={(event) => setPointsBurned(clampPoints(Number(event.target.value), sliderMax))}
                  disabled={entryBusy}
                  className="h-8 w-28 rounded-lg border border-white/10 bg-black/18 px-2 text-right text-xs text-zinc-100 disabled:opacity-50"
                  aria-label="Entry amount in points"
                />
                <span>{AMOE_MAX_POINTS.toLocaleString()} max</span>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {hasEnoughForFloor ? (
            <button
              type="button"
              onClick={() => void handleEnterForFree()}
              disabled={!canEnter}
              className="col-span-2 h-10 rounded-xl bg-brand-primary px-3 text-xs font-semibold text-white shadow-[0_12px_26px_-16px_rgb(var(--brand-primary)/0.95)] hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {entryBusy ? (
                <span className="inline-flex items-center justify-center gap-1.5"><Spinner size="sm" /> Submitting…</span>
              ) : (
                `Submit free jackpot entry (${selectedPoints.toLocaleString()} pts)`
              )}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => openXPost()}
            disabled={(!walletAddress && !protocolEntryMode) || checkinBusy || entryBusy || xmtpCheckinBusy}
            className={`${hasEnoughForFloor ? '' : 'col-span-2'} h-9 rounded-xl ${hasEnoughForFloor ? 'border border-white/12 bg-white/[0.03] text-zinc-100' : 'bg-brand-primary text-white shadow-[0_12px_26px_-16px_rgb(var(--brand-primary)/0.95)]'} px-3 text-xs font-medium transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {checkinBusy ? (
              <span className="inline-flex items-center justify-center gap-1.5"><Spinner size="sm" /> Claiming…</span>
            ) : (
              <span className="inline-flex items-center justify-center gap-1.5">
                <XIcon className="h-3.5 w-3.5" />{' '}
                {hasEnoughForFloor ? 'Open X composer' : 'Open X'}
              </span>
            )}
          </button>
          <input
            type="url"
            value={tweetProofUrl}
            onChange={(event) => setTweetProofUrl(event.target.value)}
            placeholder="Paste posted tweet URL"
            disabled={checkinBusy || entryBusy}
            className={`${hasEnoughForFloor ? '' : 'col-span-2'} h-9 rounded-xl border border-white/12 bg-white/[0.03] px-3 text-xs text-zinc-100 placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50`}
            aria-label="Tweet URL proof"
          />
          <button
            type="button"
            onClick={() => void handleTwitterCheckin()}
            disabled={
              (!walletAddress && !protocolEntryMode) ||
              checkinBusy ||
              entryBusy ||
              tweetProofUrl.trim().length === 0
            }
            className={`${hasEnoughForFloor ? '' : 'col-span-2'} h-9 rounded-xl border border-white/12 bg-white/[0.03] px-3 text-xs font-medium text-zinc-100 transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {checkinBusy ? 'Verifying tweet…' : 'Verify posted tweet for 100 points'}
          </button>
          <button
            type="button"
            onClick={() => void handleXmtpCheckin()}
            disabled={(!walletAddress && !protocolEntryMode) || entryBusy || checkinBusy}
            className={`${hasEnoughForFloor ? '' : 'col-span-2'} h-9 rounded-xl ${hasEnoughForFloor ? 'border border-white/12 bg-white/[0.03] text-zinc-100' : 'bg-brand-primary text-white shadow-[0_12px_26px_-16px_rgb(var(--brand-primary)/0.95)]'} px-3 text-xs font-medium transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              {hasEnoughForFloor ? 'Message Akita on XMTP for 100 points' : 'Earn via XMTP task'}
            </span>
          </button>
          {hasEnoughForFloor ? (
            <button
              type="button"
              onClick={() => void refreshCredits()}
              disabled={
                (!walletAddress && !protocolEntryMode) ||
                loadingCredits ||
                checkinBusy ||
                entryBusy
              }
              className="h-9 rounded-xl bg-white/[0.03] px-3 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingCredits ? 'Refreshing…' : 'Refresh'}
            </button>
          ) : null}
        </div>
        <div className="text-[11px] text-zinc-500">
          X reward requires tweet verification, and XMTP reward is granted only after a real DM send.
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
    </div>
  )
}
