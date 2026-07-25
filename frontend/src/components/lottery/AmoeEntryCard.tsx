import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Gift, MessageCircle } from 'lucide-react'
import type { Address, Hex } from 'viem'
import { base } from 'viem/chains'
import { usePublicClient, useWalletClient } from 'wagmi'

import { apiFetch } from '@/lib/api/apiBase'
import { formatJackpotUsdDisplay } from '@/lib/lottery/formatJackpotUsd'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { Spinner } from '@/components/ui/Spinner'
import { requestOpenChat } from '@/lib/chat/openChat'
import { getMarketingBaseUrl } from '@/lib/env/host'
import { resolveClientAgentXmtpAddress } from '@/lib/xmtp/agentXmtpAddress'

// PR 2 — AMOE Linear Parity. Mirrors the server-side constants in
// `frontend/server/_lib/lottery/lotteryAmoe.ts` and the on-chain math in
// `LotteryManager4626.calculateWinChance` (PR 1, #395). Keep these in
// sync with the server. The on-chain value is authoritative; the preview
// here is for display only.
const AMOE_MIN_POINTS = 100
const AMOE_MAX_POINTS = 1_000_000
// Mirrors `AMOE_DAILY_*_CREDIT` in `frontend/server/_lib/lottery/lotteryAmoe.ts`.
const AMOE_DAILY_TWITTER_CREDIT = 1
const AMOE_DAILY_XMTP_CREDIT = 1

function formatDailyCreditLabel(credits: number): string {
  return credits === 1 ? '1 point' : `${credits} points`
}
const BASE_CEILING_PPM = 40_000 // 4%, hard ceiling at $10K-equivalent
const AMOE_CANONICAL_CSW_INBOX = resolveClientAgentXmtpAddress() as Address

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

/** API payload from `/api/v1/lottery/creator` (TokenLotteryStats / getTokenLotteryStats). */
type TokenLotteryStatsResponse = {
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
  burnedAt: string
  burnEpoch: string | number
  eligibleSubmitAfterUnixSec: number
  consumed: number
  creditsRemaining: number
  creditsPerEntry: number
  entriesAvailable: number
}

export type PendingAmoeEntry = {
  wallet: Address
  creatorCoin: Address
  pointsBurned: number
  twitterHandle: string
  spendRefId: string
  eligibleSubmitAfterUnixSec: number
}

const PENDING_AMOE_ENTRY_STORAGE_KEY = '4626:amoe:pending-entry:v1'

function isPendingAmoeEntry(value: unknown): value is PendingAmoeEntry {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<PendingAmoeEntry>
  return (
    typeof row.wallet === 'string' &&
    /^0x[a-fA-F0-9]{40}$/.test(row.wallet) &&
    typeof row.creatorCoin === 'string' &&
    /^0x[a-fA-F0-9]{40}$/.test(row.creatorCoin) &&
    typeof row.pointsBurned === 'number' &&
    Number.isSafeInteger(row.pointsBurned) &&
    row.pointsBurned >= AMOE_MIN_POINTS &&
    row.pointsBurned <= AMOE_MAX_POINTS &&
    typeof row.twitterHandle === 'string' &&
    row.twitterHandle.length > 0 &&
    typeof row.spendRefId === 'string' &&
    row.spendRefId.length > 0 &&
    row.spendRefId.length <= 190 &&
    typeof row.eligibleSubmitAfterUnixSec === 'number' &&
    Number.isSafeInteger(row.eligibleSubmitAfterUnixSec) &&
    row.eligibleSubmitAfterUnixSec > 0
  )
}

function readPendingAmoeEntry(): PendingAmoeEntry | null {
  if (typeof window === 'undefined') return null
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PENDING_AMOE_ENTRY_STORAGE_KEY) ?? 'null')
    return isPendingAmoeEntry(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writePendingAmoeEntry(entry: PendingAmoeEntry | null): void {
  if (typeof window === 'undefined') return
  if (entry) {
    window.localStorage.setItem(PENDING_AMOE_ENTRY_STORAGE_KEY, JSON.stringify(entry))
  } else {
    window.localStorage.removeItem(PENDING_AMOE_ENTRY_STORAGE_KEY)
  }
}

export function isPendingAmoeEntryReady(
  entry: PendingAmoeEntry,
  nowUnixSec = Math.floor(Date.now() / 1000),
): boolean {
  return nowUnixSec >= entry.eligibleSubmitAfterUnixSec + 15 * 60
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
  isPendingAmoeEntry,
  isPendingAmoeEntryReady,
}

export function AmoeEntryCard(props: {
  walletAddress: Address | null
  creatorCoin: Address | null
  walletClientOverride?: AmoeSigningWalletClient | null
  /** Denser chrome for account tray (Points). */
  variant?: 'page' | 'tray'
  /** When set (e.g. Points tray header query), prefer this jackpot USD string. */
  jackpotUsdOverride?: string | null
}) {
  const { walletAddress, creatorCoin, walletClientOverride, variant = 'page', jackpotUsdOverride } = props
  const isTray = variant === 'tray'
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
  const [pendingEntry, setPendingEntry] = useState<PendingAmoeEntry | null>(() => readPendingAmoeEntry())
  // PR 2 — user-selected points to burn. Defaults to the floor (100 pts =
  // $1 = 0.0004% pre-boost) so a one-click entry stays cheap. The slider
  // and numeric input are kept in sync via this single source of truth.
  const [pointsBurned, setPointsBurned] = useState<number>(AMOE_MIN_POINTS)
  const [showAmountAdjust, setShowAmountAdjust] = useState(false)

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
        throw new Error(json?.error || 'Failed to load points')
      }
      setCredits(Number(json.data.credits ?? 0))
      setCreditsPerEntry(Number(json.data.creditsPerEntry ?? 100))
      setEntriesAvailable(Number(json.data.entriesAvailable ?? 0))
      setNextEntryAtCredits(Number(json.data.nextEntryAtCredits ?? 100))

      const statsParams = new URLSearchParams()
      if (creatorCoin) statsParams.set('creatorCoin', creatorCoin)
      const statsUrl = `/api/v1/lottery/creator${statsParams.size > 0 ? `?${statsParams.toString()}` : ''}`
      const statsRes = await apiFetch(statsUrl, { method: 'GET', withCredentials: true })
      const statsJson = parseJsonSafe<TokenLotteryStatsResponse>(await statsRes.json().catch(() => null))
      if (jackpotUsdOverride === undefined) {
        setJackpotUsd(statsRes.ok && statsJson?.success ? (statsJson.data?.jackpotUsd ?? null) : null)
      }
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error, 'Unable to load points'))
      setJackpotUsd(null)
    } finally {
      setLoadingCredits(false)
    }
  }, [creatorCoin, jackpotUsdOverride, protocolEntryMode, walletAddress])

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

  useEffect(() => {
    if (jackpotUsdOverride !== undefined) {
      setJackpotUsd(jackpotUsdOverride)
    }
  }, [jackpotUsdOverride])

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
          ? `Daily X check-in complete (+${formatDailyCreditLabel(json.data.awardedCredits)})`
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
      peerAddress: AMOE_CANONICAL_CSW_INBOX,
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
      const pending = readPendingAmoeEntry()
      if (pending && walletAddress && pending.wallet.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error('Switch to the wallet that started this free entry to finish it')
      }
      if (pending && creatorCoin && pending.creatorCoin.toLowerCase() !== creatorCoin.toLowerCase()) {
        throw new Error('Finish your pending free entry before starting one for another creator')
      }
      if (pending && !isPendingAmoeEntryReady(pending)) {
        const readyAt = new Date((pending.eligibleSubmitAfterUnixSec + 15 * 60) * 1000)
        setPendingEntry(pending)
        setStatusMessage(
          `Entry started. Come back after ${readyAt.toLocaleString()} to finish.`,
        )
        return
      }

      const nonceParams = new URLSearchParams()
      if (pending?.wallet ?? walletAddress) nonceParams.set('wallet', pending?.wallet ?? walletAddress!)
      if (pending?.creatorCoin ?? creatorCoin) nonceParams.set('creatorCoin', pending?.creatorCoin ?? creatorCoin!)
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
      if (!pending && liveBalance < AMOE_MIN_POINTS) {
        throw new Error(`Need at least ${AMOE_MIN_POINTS} points to enter (you have ${liveBalance})`)
      }
      const requestedPoints = pending?.pointsBurned ?? clampPoints(pointsBurned, liveBalance)
      if (!pending && requestedPoints !== pointsBurned) {
        // Reflect the clamp in the UI before submitting so the user knows
        // exactly what was sent.
        setPointsBurned(requestedPoints)
      }

      const signature = (await walletClient.signMessage({
        message: nonceData.message,
      })) as Hex

      const twitterHandle = pending?.twitterHandle ?? deriveAmoeTwitterHandleFallback(nonceData.wallet)
      const spendRefId = pending?.spendRefId ?? `amoe-ui:${nonceData.creatorCoin}:${nonceData.nonce}`

      if (!pending) {
        // Phase A is intentionally asynchronous: the burn must appear in a
        // confirmed ledger snapshot before a proof can be built. Persist only
        // the bounded intent metadata (never the signature) and ask the user
        // for a fresh nonce/signature when the snapshot is ready.
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
        if (!burnRes.ok || !burnJson?.success || !burnJson.data) {
          throw new Error(burnJson?.error || 'Failed to start free entry')
        }
        const burned = burnJson.data
        const nextPending: PendingAmoeEntry = {
          wallet: nonceData.wallet,
          creatorCoin: nonceData.creatorCoin,
          pointsBurned: requestedPoints,
          twitterHandle,
          spendRefId: burned.spendRefId,
          eligibleSubmitAfterUnixSec: Number(burned.eligibleSubmitAfterUnixSec),
        }
        if (!isPendingAmoeEntry(nextPending)) {
          throw new Error('Burn response did not include a valid submission schedule')
        }
        writePendingAmoeEntry(nextPending)
        setPendingEntry(nextPending)
        setCredits(Number(burned.creditsRemaining ?? 0))
        setCreditsPerEntry(Number(burned.creditsPerEntry ?? 100))
        setEntriesAvailable(Number(burned.entriesAvailable ?? 0))
        const readyAt = new Date((nextPending.eligibleSubmitAfterUnixSec + 15 * 60) * 1000)
        setStatusMessage(
          `Entry started. Come back after ${readyAt.toLocaleString()} to finish.`,
        )
        return
      }

      // Phase B always uses a fresh, short-lived nonce/signature. This keeps
      // the 10-minute replay window intact even though the ledger snapshot
      // normally becomes ready in the next daily epoch.
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
        // Preserve pending burn intent on `amoe_burn_not_found` — projection
        // can lag briefly; clearing localStorage would drop retry state.
        throw new Error(submitJson?.error || 'Failed to finish free entry')
      }

      const tx = submitJson.data
      writePendingAmoeEntry(null)
      setPendingEntry(null)
      const hash = tx.txHash
      setTxHash(hash)
      setStatusMessage('Free entry submitted. Waiting for confirmation…')

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
  const jackpotUsdDisplay = useMemo(() => formatJackpotUsdDisplay(jackpotUsd), [jackpotUsd])

  // Keep selection in range when the live balance shrinks (e.g. after a
  // successful entry refresh).
  useEffect(() => {
    setPointsBurned((prev) => clampPoints(prev, sliderMax))
  }, [sliderMax])

  const hasPendingEntry = Boolean(pendingEntry)
  const canEnter = Boolean(
    (walletAddress || protocolEntryMode) &&
      (hasEnoughForFloor || hasPendingEntry) &&
      !entryBusy &&
      !checkinBusy,
  )
  const selectedPoints = clampPoints(pointsBurned, sliderMax)

  return (
    <div
      className={
        isTray
          ? 'relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-3'
          : 'relative overflow-hidden rounded-[28px] bg-[linear-gradient(145deg,rgb(var(--vault-card-raised)/0.88),rgb(var(--vault-card)/0.66))] p-5 shadow-[0_28px_80px_-42px_rgb(var(--brand-primary)/0.8),0_18px_42px_-34px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.07] sm:p-6'
      }
    >
      {!isTray ? (
        <>
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-blue-300/35 to-transparent" />
          <div className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-blue-500/12 blur-3xl" />
        </>
      ) : null}
      <div className={`relative ${isTray ? 'space-y-2.5' : 'space-y-3.5'}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label">{isTray ? 'Lottery' : 'Free jackpot entry'}</p>
            <h3 className={`font-medium text-zinc-100 mt-1 ${isTray ? 'text-sm' : 'text-lg'}`}>Enter free</h3>
            {isTray && jackpotUsdDisplay ? (
              <p className="mt-1 text-xs text-zinc-400">
                For <span className="font-semibold text-brand-accent tabular-nums">{jackpotUsdDisplay}</span>
              </p>
            ) : null}
          </div>
          {!isTray ? <Gift className="w-5 h-5 text-brand-primary" /> : null}
        </div>

        {!isTray ? (
          <p className="text-sm leading-5 text-zinc-500">
            Use your points for a free jackpot entry — no purchase required.
          </p>
        ) : null}
        <div className={`rounded-2xl bg-black/18 shadow-inner shadow-black/25 ${isTray ? 'p-2.5' : 'p-3'}`}>
          <p
            className={`font-semibold uppercase leading-5 tracking-wide text-zinc-200 ${
              isTray ? 'text-[10px]' : 'text-[11px]'
            }`}
          >
            No purchase necessary. A purchase will not improve your chances of winning.
          </p>
          <div
            className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-zinc-500 ${
              isTray ? 'text-[10px]' : 'text-[11px]'
            }`}
          >
            {!isTray ? <span>Free and paid entries use the same winner selection.</span> : null}
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

        <div
          className={`space-y-3 rounded-[22px] bg-[linear-gradient(150deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_40px_-30px_rgba(0,0,0,0.9)] ${
            isTray ? 'p-2.5' : 'p-3'
          }`}
        >
          <div className="flex items-start justify-between gap-3 text-xs">
            <div>
              <div className="text-zinc-500">Your points</div>
              <div className="mt-0.5 text-lg font-semibold text-zinc-100">
                {credits.toLocaleString()}
              </div>
            </div>
            {!isTray && jackpotUsdDisplay ? (
              <div className="text-right">
                <div className="text-zinc-500">Current jackpot</div>
                <div className="mt-0.5 text-sm font-medium text-zinc-100">{jackpotUsdDisplay}</div>
              </div>
            ) : null}
          </div>
          {!hasEnoughForFloor && !hasPendingEntry ? (
            <div className="space-y-2 text-xs">
              <div>
                <div className="font-medium text-zinc-100">Not enough points yet</div>
                <div className="mt-1 text-zinc-500">
                  You need {missingCredits.toLocaleString()} more points (minimum{' '}
                  {AMOE_MIN_POINTS.toLocaleString()}).
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{hasPendingEntry ? 'Finish your free entry.' : 'Ready to enter.'}</span>
              <span>
                Win chance: <span className="text-brand-accent">{livePreviewPct}</span>
              </span>
            </div>
          )}
          {(hasEnoughForFloor || hasPendingEntry) && showAmountAdjust && !hasPendingEntry ? (
            <>
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
                <span>{sliderMax.toLocaleString()} max</span>
              </div>
            </>
          ) : null}
        </div>

        {hasEnoughForFloor || hasPendingEntry ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void handleEnterForFree()}
              disabled={!canEnter || (hasPendingEntry && !isPendingAmoeEntryReady(pendingEntry!))}
              className="h-11 w-full rounded-xl bg-brand-primary px-3 text-sm font-semibold text-white shadow-[0_12px_26px_-16px_rgb(var(--brand-primary)/0.95)] hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {entryBusy ? (
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Spinner size="sm" /> Submitting…
                </span>
              ) : hasPendingEntry ? (
                isPendingAmoeEntryReady(pendingEntry!) ? (
                  'Finish free entry'
                ) : (
                  `Come back after ${new Date(pendingEntry!.eligibleSubmitAfterUnixSec * 1000).toLocaleString()}`
                )
              ) : (
                'Enter free'
              )}
            </button>
            {!hasPendingEntry ? (
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowAmountAdjust((v) => !v)}
                  className="text-[11px] font-medium text-zinc-400 hover:text-zinc-200"
                >
                  {showAmountAdjust ? 'Hide amount' : `Adjust amount (${selectedPoints.toLocaleString()} pts)`}
                </button>
                <button
                  type="button"
                  onClick={() => void refreshCredits()}
                  disabled={
                    (!walletAddress && !protocolEntryMode) ||
                    loadingCredits ||
                    checkinBusy ||
                    entryBusy
                  }
                  className="text-[11px] font-medium text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
                >
                  {loadingCredits ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => openXPost()}
              disabled={(!walletAddress && !protocolEntryMode) || checkinBusy || entryBusy}
              className="col-span-2 h-9 rounded-xl bg-brand-primary px-3 text-xs font-medium text-white shadow-[0_12px_26px_-16px_rgb(var(--brand-primary)/0.95)] transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checkinBusy ? (
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Spinner size="sm" /> Claiming…
                </span>
              ) : (
                <span className="inline-flex items-center justify-center gap-1.5">
                  <XIcon className="h-3.5 w-3.5" /> Open X to earn points
                </span>
              )}
            </button>
            <input
              type="url"
              value={tweetProofUrl}
              onChange={(event) => setTweetProofUrl(event.target.value)}
              placeholder="Paste posted tweet URL"
              disabled={checkinBusy || entryBusy}
              className="col-span-2 h-9 rounded-xl border border-white/12 bg-white/[0.03] px-3 text-xs text-zinc-100 placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="col-span-2 h-9 rounded-xl border border-white/12 bg-white/[0.03] px-3 text-xs font-medium text-zinc-100 transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checkinBusy
                ? 'Verifying tweet…'
                : `Verify tweet for ${formatDailyCreditLabel(AMOE_DAILY_TWITTER_CREDIT)}`}
            </button>
            <button
              type="button"
              onClick={() => void handleXmtpCheckin()}
              disabled={(!walletAddress && !protocolEntryMode) || entryBusy || checkinBusy}
              className="col-span-2 h-9 rounded-xl bg-brand-primary px-3 text-xs font-medium text-white shadow-[0_12px_26px_-16px_rgb(var(--brand-primary)/0.95)] transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" /> Earn via chat
              </span>
            </button>
            <div className="col-span-2 text-[11px] text-zinc-500">
              X reward needs tweet verification. Chat reward unlocks after a real DM send.
            </div>
          </div>
        )}

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
