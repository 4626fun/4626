import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Gift, Loader2 } from 'lucide-react'
import type { Address, Hex } from 'viem'
import { base } from 'viem/chains'
import { usePublicClient, useWalletClient } from 'wagmi'

import { apiFetch } from '@/lib/apiBase'
import type { ApiEnvelope } from '@/lib/apiEnvelope'

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
  to?: Address
  callData?: Hex
  txHash?: Hex
  relayMode?: 'server' | 'client'
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
    if (!walletClient || !publicClient) {
      setErrorMessage('Connect a wallet capable of signing and sending transactions')
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
      if (Number(nonceData.entriesAvailable ?? 0) < 1) {
        throw new Error(`Need ${nonceData.creditsPerEntry} credits for one free entry`)
      }

      const signature = (await walletClient.signMessage({
        message: nonceData.message,
      })) as Hex

      const submitRequest = async (relay: boolean) => {
        const res = await apiFetch('/api/v1/lottery/amoe/submit', {
          method: 'POST',
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creatorCoin,
            message: nonceData.message,
            signature,
            relay,
          }),
        })
        const json = parseJsonSafe<SubmitResponse>(await res.json().catch(() => null))
        return { res, json }
      }

      let { res: submitRes, json: submitJson } = await submitRequest(true)
      if ((!submitRes.ok || !submitJson?.success || !submitJson.data) && submitJson?.error === 'amoe_relay_unavailable') {
        ;({ res: submitRes, json: submitJson } = await submitRequest(false))
      }
      if (!submitRes.ok || !submitJson?.success || !submitJson.data) {
        throw new Error(submitJson?.error || 'Failed to build AMOE transaction')
      }

      const tx = submitJson.data
      let hash = tx.txHash ?? null
      if (!hash) {
        if (!tx.to || !tx.callData) {
          throw new Error('amoe_submit_missing_calldata')
        }
        hash = await walletClient.sendTransaction({
          chain: base,
          to: tx.to,
          data: tx.callData,
          value: 0n,
        })
      }

      setTxHash(hash)
      setStatusMessage(
        tx.relayMode === 'server'
          ? 'AMOE entry relayed by protocol. Waiting for confirmation…'
          : 'AMOE entry submitted. Waiting for confirmation…',
      )

      await publicClient.waitForTransactionReceipt({ hash })
      setCredits(Number(tx.creditsRemaining ?? 0))
      setCreditsPerEntry(Number(tx.creditsPerEntry ?? 100))
      setEntriesAvailable(Number(tx.entriesAvailable ?? 0))
      setNextEntryAtCredits(Math.max(Number(tx.creditsPerEntry ?? 100), Number(tx.creditsRemaining ?? 0)))
      setStatusMessage('Free entry confirmed onchain')
      await refreshCredits()
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error, 'Failed to submit free entry'))
    } finally {
      setEntryBusy(false)
    }
  }, [creatorCoin, publicClient, refreshCredits, walletAddress, walletClient])

  const creditsPct = useMemo(() => clampPct((credits / Math.max(1, creditsPerEntry)) * 100), [credits, creditsPerEntry])
  const missingCredits = Math.max(0, creditsPerEntry - credits)
  const canEnter = Boolean(walletAddress && creatorCoin && entriesAvailable > 0 && !entryBusy && !checkinBusy)

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
            `Enter for free (${creditsPerEntry} credits)`
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
