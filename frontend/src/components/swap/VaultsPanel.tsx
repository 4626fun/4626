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
  const endpoint = `/api/vaults/active?chainId=${chainId}&settled=false`
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
      <div className="bv-panel p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-vault-subtext">
          <AlertTriangle className="h-3.5 w-3.5" />
          Vaults unavailable
        </div>
        <div className="text-sm text-vault-muted">Unable to load featured vaults right now.</div>
      </div>
    )
  }

  const list = effectiveTab === 'mine' ? userVaults : featuredVaults

  return (
    <section className="bv-panel p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-vault-text">Creator Vaults</h2>
          <p className="text-xs text-vault-subtext">Earn / manage vault positions</p>
        </div>
        <Link
          to="/vault/create"
          className="bv-chip gap-1 normal-case tracking-[0.02em] hover:text-vault-text"
        >
          <Plus className="h-3.5 w-3.5" /> Create Vault
        </Link>
      </div>

      <div className="mb-3 inline-flex rounded-full border border-[rgb(var(--vault-border-strong)/0.55)] bg-[rgb(var(--vault-card-raised)/0.45)] p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setTab('featured')}
          className={`rounded-full px-3 py-1.5 transition ${effectiveTab === 'featured' ? 'bg-brand-primary/18 text-vault-text' : 'text-vault-subtext hover:text-vault-text'}`}
        >
          Featured Vaults
        </button>
        <button
          type="button"
          onClick={() => currentAddress && setTab('mine')}
          disabled={!currentAddress}
          className={`rounded-full px-3 py-1.5 transition ${effectiveTab === 'mine' ? 'bg-brand-primary/18 text-vault-text' : 'text-vault-subtext hover:text-vault-text'} disabled:opacity-50`}
        >
          My Vaults
        </button>
      </div>

      {vaultsQuery.isLoading ? (
        <div className="grid gap-2">
          <Activity className="mx-auto h-4 w-4 animate-pulse text-vault-muted" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-[rgb(var(--vault-border-strong)/0.5)] bg-[rgb(var(--vault-card-raised)/0.55)] p-4 text-sm text-vault-subtext">
          {effectiveTab === 'mine'
            ? currentAddress
              ? 'No vault positions found for this wallet yet.'
              : 'Sign in to see vaults tied to your creator profile.'
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
