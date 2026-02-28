import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { VaultCard } from '@/components/swap/VaultCard'
import { apiFetch } from '@/lib/apiBase'
import { useAccountContext } from '@/wallet/accountContext'

type VaultConfig = {
  vaultAddress: `0x${string}`
  chainId: number
  creatorCoinAddress: `0x${string}`
  groupId: string
  graduatedAt?: string | null
  settledAt?: string | null
}

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string; message?: string }

async function fetchActiveVaults(chainId: number): Promise<VaultConfig[]> {
  const endpoint = `/api/cre/vaults/active?chainId=${chainId}&settled=false`
  const res = await apiFetch(endpoint)
  if (!res.ok) {
    const payload = await res.json().catch(() => null)
    const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load vaults'
    throw new Error(message)
  }
  const payload = (await res.json()) as ApiEnvelope<{ vaults: VaultConfig[]; count: number }>
  if (!payload.success || !payload.data) throw new Error(payload.message ?? payload.error ?? 'Failed to load vaults')
  return payload.data.vaults
}

export function VaultsPanel({ chainId, activeTabDefault = 'featured' }: { chainId: number; activeTabDefault?: 'featured' | 'mine' }) {
  const [tab, setTab] = useState<'featured' | 'mine'>(activeTabDefault)
  const accountContext = useAccountContext()
  const currentAddress = accountContext.signerAddress ?? null

  const vaultsQuery = useQuery({
    queryKey: ['swap', 'creator-vaults', chainId],
    queryFn: () => fetchActiveVaults(chainId),
    staleTime: 25_000,
    refetchInterval: 60_000,
  })

  const featuredVaults = useMemo(() => vaultsQuery.data ?? [], [vaultsQuery.data])
  const userVaults = useMemo(() => {
    if (!currentAddress) return []
    return featuredVaults.slice(0, 6)
  }, [currentAddress, featuredVaults])

  const effectiveTab = (tab === 'mine' && !currentAddress) ? 'featured' : tab

  if (vaultsQuery.isError) {
    return (
      <div className="rounded-2xl border border-white/10 bg-vault-card/70 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          Vaults unavailable
        </div>
        <div className="text-sm text-zinc-500">Unable to load featured vaults right now.</div>
      </div>
    )
  }

  const list = effectiveTab === 'mine' ? userVaults : featuredVaults

  return (
    <section className="rounded-2xl border border-white/10 bg-vault-card/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Creator Vaults</h2>
          <p className="text-xs text-zinc-500">Earn / manage vault positions</p>
        </div>
        <Link
          to="/vault/create"
          className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/5 px-2 py-1 text-[11px] text-zinc-300 hover:text-zinc-100"
        >
          <Plus className="h-3.5 w-3.5" /> Create Vault
        </Link>
      </div>

      <div className="mb-3 inline-flex rounded-full border border-white/12 bg-black/40 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setTab('featured')}
          className={`rounded-full px-3 py-1.5 transition ${effectiveTab === 'featured' ? 'bg-white/15 text-white' : 'text-zinc-400'}`}
        >
          Featured Vaults
        </button>
        <button
          type="button"
          onClick={() => currentAddress && setTab('mine')}
          disabled={!currentAddress}
          className={`rounded-full px-3 py-1.5 transition ${effectiveTab === 'mine' ? 'bg-white/15 text-white' : 'text-zinc-400'} disabled:opacity-50`}
        >
          My Vaults
        </button>
      </div>

      {vaultsQuery.isLoading ? (
        <div className="grid gap-2">
          <Activity className="mx-auto h-4 w-4 animate-pulse text-zinc-600" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/4 p-4 text-sm text-zinc-500">
          {effectiveTab === 'mine'
            ? currentAddress
              ? 'No vault positions found for this wallet yet.'
              : 'Connect your wallet to see vaults tied to your creator profile.'
            : 'No featured vaults yet.'}
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((vault) => (
            <VaultCard key={vault.vaultAddress} vault={vault} withMyVault={effectiveTab === 'mine'} />
          ))}
        </div>
      )}
    </section>
  )
}
