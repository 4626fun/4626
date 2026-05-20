import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api/apiBase'
import { parseApiEnvelope, resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import { useSiweAuth } from '@/hooks/useSiweAuth'

type RefreshConfig = {
  priceDisplay: string
  treasury: string
  cooldown: {
    inCooldown: boolean
    retryAfterSeconds: number | null
  }
}

type RefreshResult = {
  ethosScore: number | null
  ethosLevel: string | null
  ethosScoreSource: string | null
}

export function ExploreEthosRefreshButton({
  creatorAddress,
  onRefreshed,
}: {
  creatorAddress: string
  onRefreshed?: () => void
}) {
  const { isSignedIn } = useSiweAuth()
  const queryClient = useQueryClient()
  const [txHash, setTxHash] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const configQuery = useQuery({
    queryKey: ['explore', 'ethos-refresh-config', creatorAddress.toLowerCase()],
    queryFn: async () => {
      const res = await apiFetch(
        `/api/creator/ethos/refresh-config?creatorAddress=${encodeURIComponent(creatorAddress)}`,
      )
      const body = await parseApiEnvelope<RefreshConfig>(res)
      if (!body?.success || !body.data) {
        throw new Error(resolveApiErrorMessage(body, 'Failed to load refresh config'))
      }
      return body.data
    },
    staleTime: 60_000,
  })

  if (!isSignedIn) return null

  const config = configQuery.data
  const inCooldown = config?.cooldown.inCooldown ?? false

  async function handleRefresh() {
    if (!txHash.trim()) {
      setStatus('Paste the Base USDC transfer tx hash.')
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      const res = await apiFetch('/api/creator/ethos/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorAddress,
          paymentTxHash: txHash.trim(),
        }),
      })
      const body = await parseApiEnvelope<RefreshResult>(res)
      if (!body?.success || !body.data) {
        setStatus(resolveApiErrorMessage(body, 'Refresh failed'))
        return
      }
      setStatus(
        body.data.ethosScore != null
          ? `Updated — Ethos ${body.data.ethosScore}`
          : 'Refresh completed (no score returned)',
      )
      setTxHash('')
      await queryClient.invalidateQueries({ queryKey: ['explore'] })
      onRefreshed?.()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Refresh failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-1 flex flex-col gap-1 text-[10px] text-zinc-500">
      <button
        type="button"
        className="w-fit rounded border border-white/10 px-2 py-0.5 text-zinc-300 hover:border-blue-500/40 hover:text-zinc-100 disabled:opacity-50"
        disabled={busy || inCooldown || configQuery.isLoading}
        onClick={() => {
          const treasury = config?.treasury
          const price = config?.priceDisplay ?? '$0.10'
          const proceed = window.confirm(
            `Refresh Ethos for this creator (${price} USDC)?\n\n` +
              `1. Send ${price} USDC on Base to:\n${treasury ?? 'protocol treasury'}\n\n` +
              `2. Paste the tx hash below and confirm.`,
          )
          if (!proceed) return
          void handleRefresh()
        }}
      >
        {busy ? 'Refreshing…' : inCooldown ? 'Refresh on cooldown' : `Refresh Ethos ${config?.priceDisplay ?? '$0.10'}`}
      </button>
      <input
        type="text"
        value={txHash}
        onChange={(event) => setTxHash(event.target.value)}
        placeholder="0x… payment tx hash"
        className="w-full max-w-[220px] rounded border border-white/10 bg-black/20 px-2 py-1 text-zinc-200 placeholder:text-zinc-600"
        aria-label="USDC payment transaction hash"
      />
      {status ? <span className="text-zinc-400">{status}</span> : null}
    </div>
  )
}
