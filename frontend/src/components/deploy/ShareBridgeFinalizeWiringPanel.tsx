import { useQuery } from '@tanstack/react-query'
import { formatEther, type Address, type Hex } from 'viem'

import {
  buildFinalizePhase2CallData,
  quoteFinalizeShareBridgeNativeFee,
  type FinalizePhase2Params,
} from '@/lib/deploy/finalizeShareBridgeFee'
import { readShareBridgeOftWiringStatus } from '@/lib/deploy/shareBridgeOftWiring'

type ShareBridgeFinalizeWiringPanelProps = {
  enabled: boolean
  publicClient: { readContract: (...args: any[]) => Promise<unknown> } | null | undefined
  batcherAddress: Address | null
  finalizeParams: FinalizePhase2Params | null
}

function shortBytes32(value: Hex | null): string {
  if (!value) return 'unset'
  return `${value.slice(0, 10)}…${value.slice(-6)}`
}

function toneClass(ok: boolean | null): string {
  if (ok === true) return 'text-emerald-300/80'
  if (ok === false) return 'text-amber-300/90'
  return 'text-zinc-500'
}

export function ShareBridgeFinalizeWiringPanel({
  enabled,
  publicClient,
  batcherAddress,
  finalizeParams,
}: ShareBridgeFinalizeWiringPanelProps) {
  const finalizeCallData =
    finalizeParams && batcherAddress ? buildFinalizePhase2CallData(finalizeParams) : null

  const wiringQuery = useQuery({
    queryKey: [
      'shareBridgeFinalizeWiring',
      batcherAddress,
      finalizeCallData,
    ],
    enabled: Boolean(enabled && publicClient && batcherAddress && finalizeCallData),
    staleTime: 20_000,
    retry: 0,
    queryFn: async () => {
      const status = await readShareBridgeOftWiringStatus({
        publicClient: publicClient as any,
        batcherAddress: batcherAddress as Address,
        finalizeCallData: finalizeCallData as Hex,
      })
      if ('code' in status) {
        return { kind: 'error' as const, status }
      }
      const quote = await quoteFinalizeShareBridgeNativeFee({
        publicClient: publicClient as any,
        batcherAddress: batcherAddress as Address,
        finalizeCallData: finalizeCallData as Hex,
      })
      return { kind: 'ok' as const, status, quote: 'code' in quote ? null : quote }
    },
  })

  if (!enabled) {
    return (
      <div className="rounded-md border border-white/8 bg-black/5 px-3 py-2 text-[10px] text-zinc-600">
        Pipe A ShareOFT auto-bridge is disabled for this deployment profile.
      </div>
    )
  }

  if (!batcherAddress || !finalizeParams) {
    return (
      <div className="rounded-md border border-white/10 bg-black/10 px-3 py-3 text-[10px] text-zinc-500">
        Pipe A wiring status loads after expected deployment addresses resolve.
      </div>
    )
  }

  if (wiringQuery.isLoading || wiringQuery.isFetching) {
    return (
      <div className="rounded-md border border-white/10 bg-black/10 px-3 py-3 text-[10px] text-zinc-500">
        Checking Pipe A finalize wiring…
      </div>
    )
  }

  if (wiringQuery.isError || !wiringQuery.data) {
    return (
      <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-[10px] text-amber-300/90">
        Pipe A wiring check failed. Retry or verify batcher cutover (
        <span className="font-mono">verify-batcher-pipe-a-readiness.ts</span>
        ).
      </div>
    )
  }

  if (wiringQuery.data.kind === 'error') {
    const message =
      'message' in wiringQuery.data.status
        ? String(wiringQuery.data.status.message)
        : 'Pipe A wiring unavailable'
    return (
      <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-[10px] text-amber-300/90">
        {message}
      </div>
    )
  }

  const { status, quote } = wiringQuery.data
  const batcherPeerSupported = status.batcherDefaultPeer !== null || status.registryPeer !== null
  const ready =
    !status.bridgeRequired ||
    (status.registryPeerConfigured && status.shareOftPeerConfigured && quote !== null)

  return (
    <div className="rounded-md border border-white/10 bg-black/10 px-3 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3 text-[10px]">
        <div className="font-medium text-zinc-500">Pipe A finalize bridge (30% ShareOFT → Solana)</div>
        <div className={ready ? 'text-emerald-300/80' : 'text-amber-300/90'}>
          {ready ? 'ready' : 'blocked'}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
        <div className={toneClass(status.bridgeRequired)}>
          Bridge required: {status.bridgeRequired ? 'yes' : 'no'}
        </div>
        <div className={toneClass(status.registryPeerConfigured)}>
          Effective peer: {shortBytes32(status.effectivePeer)}
        </div>
        <div className={toneClass(status.registryPeer !== null)}>
          Registry peer: {shortBytes32(status.registryPeer)}
        </div>
        <div className={toneClass(batcherPeerSupported)}>
          Batcher default peer: {shortBytes32(status.batcherDefaultPeer)}
        </div>
        <div className={toneClass(status.shareOftPeerConfigured)}>
          ShareOFT on-chain peer: {shortBytes32(status.shareOftPeer)}
        </div>
        <div className={toneClass(quote !== null && quote.nativeFee > 0n)}>
          LZ native fee:{' '}
          {quote ? `${formatEther(quote.nativeFee)} ETH` : 'unavailable'}
        </div>
      </div>
      {!ready ? (
        <div className="text-[10px] text-amber-300/90 space-y-1">
          <p>
            Finalize stays blocked until Pipe A wiring can quote a LayerZero send fee on this ShareOFT.
          </p>
          <p>
            After Phase 1, run LZ Base <span className="font-mono">init-config</span> +{' '}
            <span className="font-mono">wire</span> on the <strong>new</strong> ShareOFT (not legacy wsAKITA),
            then re-check here. Ops script:{' '}
            <span className="font-mono">pnpm -C frontend ops:verify-post-phase1-mesh --share-oft …</span>
          </p>
        </div>
      ) : null}
    </div>
  )
}
