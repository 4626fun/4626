import { RefreshCcw, ShieldAlert } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import type { WorkspaceStrategiesResponse } from '@/lib/workspace/types'

function statusVariant(status: string): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'active') return 'success'
  if (status === 'paused') return 'warning'
  if (status === 'inactive') return 'error'
  return 'default'
}

export function WorkspaceStrategiesTab(props: {
  data: WorkspaceStrategiesResponse | undefined
  isLoading: boolean
  isMutating: boolean
  onSetTarget: (params: { strategyAddress: `0x${string}`; targetWeightBps: number }) => void
  onExecute: (params: { strategyAddress: `0x${string}`; actionType: string }) => void
}) {
  if (props.isLoading && !props.data) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <Skeleton className="h-4 w-40 mb-3" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    )
  }

  const rows = props.data?.strategies ?? []
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-6 text-sm text-zinc-400">
        No strategies discovered for this vault yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.strategyAddress} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm text-zinc-100 truncate">{row.strategyAddress}</div>
              <div className="text-xs text-zinc-500 mt-1">
                {row.kind.toUpperCase()} strategy
                {row.owner ? ` • owner ${row.owner.slice(0, 8)}...${row.owner.slice(-4)}` : ''}
              </div>
            </div>
            <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
            <div className="rounded-lg border border-white/10 p-2">
              <div className="text-zinc-500">Current Weight</div>
              <div className="text-zinc-100 mt-1">{row.currentWeightRaw}</div>
            </div>
            <div className="rounded-lg border border-white/10 p-2">
              <div className="text-zinc-500">Target (bps)</div>
              <div className="text-zinc-100 mt-1">{row.targetWeightBps ?? '—'}</div>
            </div>
            <div
              className="rounded-lg border border-white/10 p-2"
              title="Operator-intended value for on-chain strategyMaxAssets[strategy]. Compare with the live on-chain cap to detect drift."
            >
              <div className="text-zinc-500">Max Assets Cap</div>
              <div className="text-zinc-100 mt-1 truncate">
                {row.maxAssetsCap === null
                  ? '—'
                  : row.maxAssetsCap === '0'
                    ? 'uncapped'
                    : row.maxAssetsCap}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 p-2">
              <div className="text-zinc-500">Last Rebalance</div>
              <div className="text-zinc-100 mt-1">
                {row.lastRebalanceAt ? new Date(row.lastRebalanceAt).toLocaleString() : '—'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => props.onExecute({ strategyAddress: row.strategyAddress, actionType: 'strategy.charm.rebalance' })}
              disabled={props.isMutating}
              className="gap-1.5"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Rebalance
            </Button>
            <Button
              size="sm"
              onClick={() => props.onSetTarget({ strategyAddress: row.strategyAddress, targetWeightBps: row.targetWeightBps ?? 0 })}
              disabled={props.isMutating}
              className="gap-1.5"
            >
              Update allocation
            </Button>
            <Button
              size="sm"
              onClick={() => props.onExecute({ strategyAddress: row.strategyAddress, actionType: 'strategy.owner.emergencyUnwind' })}
              disabled={props.isMutating}
              className="gap-1.5"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Emergency unwind
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
