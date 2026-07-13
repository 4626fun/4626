import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { formatUnits } from 'viem'
import { base } from 'viem/chains'
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'

import { Button } from '@/components/ui/Button'
import {
  parseRemoteFeeFlushTargets,
  resolveHubGaugeController,
  type RemoteFeeFlushTarget,
} from '@/lib/shareOft/remoteFeeFlushConfig'
import { quoteSpokeFlushStatus, readGaugeUnaccountedShareOft } from '@/lib/shareOft/remoteFeeFlushQuotes'
import { gaugeReceiveBridgedFeesAbi } from '@/lib/shareOft/shareOftFeeFlushAbi'
import { buildTxHref, shortAddress, type TxState } from './adminOpsHelpers'

type SpokeStatus = {
  target: RemoteFeeFlushTarget
  pendingFees: bigint
  flushThreshold: bigint
  spokeLzFee: bigint
  ready: boolean
  error?: string
}

function TxMeta({ state }: { state?: TxState }) {
  if (!state || state.status === 'idle') return null
  return (
    <div className="text-xs text-zinc-500 space-y-1">
      {state.hash ? (
        <a
          className="inline-flex items-center gap-2 text-brand-accent hover:text-brand-primary"
          href={buildTxHref(state.hash) ?? undefined}
          target="_blank"
          rel="noreferrer"
        >
          View transaction
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : null}
      {state.status === 'pending' ? <div className="text-amber-300/80">Transaction pending…</div> : null}
      {state.status === 'success' ? <div className="text-emerald-300/90">Confirmed.</div> : null}
      {state.status === 'error' ? <div className="text-red-400">{state.error ?? 'Transaction failed'}</div> : null}
    </div>
  )
}

export function RemoteFeeFlushCard() {
  const hubGauge = resolveHubGaugeController()
  const targetsResult = useMemo(() => {
    try {
      return { targets: parseRemoteFeeFlushTargets(), configError: null as string | null }
    } catch (err) {
      return {
        targets: [] as RemoteFeeFlushTarget[],
        configError: err instanceof Error ? err.message : String(err),
      }
    }
  }, [])
  const targets = targetsResult.targets

  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const publicClient = usePublicClient({ chainId: base.id })

  const [loading, setLoading] = useState(false)
  const [spokeStatuses, setSpokeStatuses] = useState<SpokeStatus[]>([])
  const [gaugeBridgedBalance, setGaugeBridgedBalance] = useState<bigint | null>(null)
  const [sweepTx, setSweepTx] = useState<TxState>({ status: 'idle' })

  const isBase = chainId === base.id

  const refresh = useCallback(async () => {
    if (targets.length === 0) {
      setSpokeStatuses([])
      setGaugeBridgedBalance(null)
      return
    }
    setLoading(true)
    try {
      const statuses: SpokeStatus[] = []
      for (const target of targets) {
        try {
          const quote = await quoteSpokeFlushStatus(target)
          statuses.push({ target, ...quote })
        } catch (err) {
          statuses.push({
            target,
            pendingFees: 0n,
            flushThreshold: 0n,
            spokeLzFee: 0n,
            ready: false,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
      setSpokeStatuses(statuses)

      if (publicClient) {
        setGaugeBridgedBalance(await readGaugeUnaccountedShareOft(hubGauge))
      }
    } finally {
      setLoading(false)
    }
  }, [hubGauge, publicClient, targets])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const ensureBaseWallet = async (): Promise<boolean> => {
    if (!isConnected) return false
    if (isBase) return true
    await switchChainAsync({ chainId: base.id })
    return true
  }

  const sweepGauge = async () => {
    if (!walletClient || !publicClient) return
    if (!isConnected) {
      setSweepTx({ status: 'error', error: 'Connect a wallet on Base first.' })
      return
    }

    setSweepTx({ status: 'pending' })
    try {
      await ensureBaseWallet()
      const unaccounted = await readGaugeUnaccountedShareOft(hubGauge)
      if (unaccounted === 0n) {
        throw new Error('No unaccounted bridged ■ on the gauge yet. Wait for LayerZero delivery, then refresh.')
      }

      const hash = await walletClient.writeContract({
        chain: base,
        account: walletClient.account,
        address: hubGauge,
        abi: gaugeReceiveBridgedFeesAbi,
        functionName: 'receiveBridgedFees',
      })
      await publicClient.waitForTransactionReceipt({ hash })
      setSweepTx({ status: 'success', hash })
      await refresh()
    } catch (err) {
      setSweepTx({
        status: 'error',
        error: err instanceof Error ? err.message : 'receiveBridgedFees failed',
      })
    }
  }

  if (targetsResult.configError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-black/30 px-4 py-4">
        <div className="text-sm text-zinc-100">Remote ShareOFT fee flush</div>
        <div className="mt-2 text-xs text-red-400">{targetsResult.configError}</div>
      </div>
    )
  }

  if (targets.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-4">
        <div className="text-sm text-zinc-100">Remote ShareOFT fee flush</div>
        <div className="mt-1 text-xs text-zinc-500">
          Set <code className="text-zinc-400">VITE_REMOTE_SHARE_OFT_FLUSH_TARGETS</code> to configure spoke targets.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-4 space-y-4">
      <div>
        <div className="text-sm text-zinc-100">Remote buy-fee flush status</div>
        <div className="mt-1 text-xs text-zinc-500 max-w-prose">
          Keepr calls <code className="text-zinc-400">flushFees</code> directly on each spoke using its remote
          signer and native gas. After delivery, sweep bridged ■ into the gauge with{' '}
          <code className="text-zinc-400">receiveBridgedFees</code>.
        </div>
        <div className="mt-2 text-xs text-zinc-600 font-mono space-y-0.5">
          <div>Gauge: {shortAddress(hubGauge)}</div>
        </div>
      </div>

      <div className="space-y-3">
        {spokeStatuses.map((status) => {
          return (
            <div key={status.target.lzEid} className="rounded-lg border border-white/10 bg-black/20 px-3 py-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-zinc-200">{status.target.label}</div>
                <div className="text-xs text-zinc-500 font-mono">eid {status.target.lzEid}</div>
              </div>
              <div className="text-xs text-zinc-500 font-mono">{shortAddress(status.target.shareOft)}</div>
              {status.error ? <div className="text-xs text-red-400">{status.error}</div> : null}
              <div className="text-xs text-zinc-400 grid gap-1 sm:grid-cols-2">
                <div>
                  Pending:{' '}
                  <span className="text-zinc-200">{formatUnits(status.pendingFees, 18)} ■</span>
                </div>
                <div>
                  Threshold:{' '}
                  <span className="text-zinc-200">{formatUnits(status.flushThreshold, 18)} ■</span>
                </div>
                <div>
                  Spoke LZ fee:{' '}
                  <span className="text-zinc-200">{status.spokeLzFee.toString()} wei</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={status.ready ? 'text-xs text-emerald-300' : 'text-xs text-zinc-600'}>
                  {status.ready ? 'Ready for Keepr spoke flush' : 'Below threshold or no pending fees'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-white/10 pt-3 space-y-2">
        <div className="text-xs text-zinc-400">
          Unaccounted bridged ■ on gauge:{' '}
          <span className="text-zinc-200">
            {gaugeBridgedBalance != null ? `${formatUnits(gaugeBridgedBalance, 18)} ■` : '—'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" disabled={loading} onClick={() => void refresh()}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={sweepTx.status === 'pending' || (gaugeBridgedBalance ?? 0n) === 0n}
            onClick={() => void sweepGauge()}
          >
            {sweepTx.status === 'pending' ? 'Sweeping…' : 'Sweep gauge (receiveBridgedFees)'}
          </Button>
        </div>
        <TxMeta state={sweepTx} />
      </div>
    </div>
  )
}
