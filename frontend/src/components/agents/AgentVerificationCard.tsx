import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ExternalLink, Loader2, ShieldCheck } from 'lucide-react'

import { apiFetch } from '@/lib/apiBase'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type VerificationData = {
  chainId: number
  registryAddress: string
  agentId: number
  canonicalCsw: string | null
  ownerAddress: string | null
  agentWallet: string | null
  tokenUri: string | null
  agentRegistered: boolean
  walletBoundToCanonical: boolean
  links: {
    registry: string
    token: string
    canonicalCsw: string | null
    ownerAddress: string | null
    agentWallet: string | null
  }
  diagnostics: string[]
}

function shortAddress(value: string | null | undefined): string {
  const v = String(value ?? '').trim()
  if (!v) return '—'
  if (v.length <= 12) return v
  return `${v.slice(0, 6)}…${v.slice(-4)}`
}

function shortUri(value: string | null | undefined): string {
  const v = String(value ?? '').trim()
  if (!v) return '—'
  if (v.length <= 56) return v
  return `${v.slice(0, 40)}…${v.slice(-12)}`
}

function chainLabel(chainId: number): string {
  if (chainId === 8453) return 'Base'
  if (chainId === 1) return 'Ethereum'
  return `Chain ${chainId}`
}

export function AgentVerificationCard() {
  const query = useQuery({
    queryKey: ['agents', 'verification', 'canonical'],
    queryFn: async (): Promise<VerificationData> => {
      const res = await apiFetch('/api/v1/agents/identity/verification', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<VerificationData> | null
      if (!res.ok || !json) throw new Error(`Verification request failed (${res.status})`)
      if (!json.success || !json.data) throw new Error(json.error || 'Verification request failed')
      return json.data
    },
    staleTime: 30_000,
    retry: 1,
  })

  const registrationBadge = useMemo(() => {
    if (!query.data) return null
    return query.data.agentRegistered ? { label: 'Registered', tone: 'ok' as const } : { label: 'Not registered', tone: 'warn' as const }
  }, [query.data])

  const walletBadge = useMemo(() => {
    if (!query.data) return null
    return query.data.walletBoundToCanonical ? { label: 'agentWallet verified', tone: 'ok' as const } : { label: 'agentWallet not bound', tone: 'warn' as const }
  }, [query.data])

  return (
    <section className="rounded-2xl border border-white/5 bg-white/2 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-emerald-300" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-100">Verified Agent</div>
          <div className="text-xs text-zinc-500 mt-0.5">
            Public, read-only snapshot of the ERC-8004 Identity Registry record for the canonical CreatorVault agent.
          </div>
        </div>
      </div>

      {query.isLoading ? (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading verification…
        </div>
      ) : null}

      {query.isError ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            Verification is temporarily unavailable.
            <div className="text-[11px] text-amber-200/80 mt-1">
              {query.error instanceof Error ? query.error.message : 'Request failed.'}
            </div>
          </div>
        </div>
      ) : null}

      {query.data ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {registrationBadge ? (
              <span
                className={[
                  'rounded-full px-2 py-0.5 text-[10px]',
                  registrationBadge.tone === 'ok' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200',
                ].join(' ')}
              >
                {registrationBadge.label}
              </span>
            ) : null}
            {walletBadge ? (
              <span
                className={[
                  'rounded-full px-2 py-0.5 text-[10px]',
                  walletBadge.tone === 'ok' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200',
                ].join(' ')}
              >
                {walletBadge.label}
              </span>
            ) : null}
          </div>

          <div className="grid gap-2 text-xs text-zinc-300 sm:grid-cols-2">
            <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <div className="text-zinc-400">Agent ID</div>
              <div className="font-mono text-zinc-200">#{query.data.agentId}</div>
            </div>
            <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <div className="text-zinc-400">Chain</div>
              <div className="text-zinc-200">
                {chainLabel(query.data.chainId)} <span className="text-zinc-500">({query.data.chainId})</span>
              </div>
            </div>

            <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <div className="text-zinc-400">Registry</div>
              <a
                href={query.data.links.registry}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-zinc-200 hover:text-white hover:underline"
                title={query.data.registryAddress}
              >
                {shortAddress(query.data.registryAddress)}
                <ExternalLink className="w-3 h-3 text-zinc-500" />
              </a>
            </div>
            <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <div className="text-zinc-400">Canonical CSW</div>
              {query.data.links.canonicalCsw ? (
                <a
                  href={query.data.links.canonicalCsw}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-zinc-200 hover:text-white hover:underline"
                  title={query.data.canonicalCsw ?? undefined}
                >
                  {shortAddress(query.data.canonicalCsw)}
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </a>
              ) : (
                <div className="font-mono text-zinc-200">{shortAddress(query.data.canonicalCsw)}</div>
              )}
            </div>

            <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <div className="text-zinc-400">On-chain owner</div>
              {query.data.links.ownerAddress ? (
                <a
                  href={query.data.links.ownerAddress}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-zinc-200 hover:text-white hover:underline"
                  title={query.data.ownerAddress ?? undefined}
                >
                  {shortAddress(query.data.ownerAddress)}
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </a>
              ) : (
                <div className="font-mono text-zinc-200">{shortAddress(query.data.ownerAddress)}</div>
              )}
            </div>
            <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <div className="text-zinc-400">On-chain agentWallet</div>
              {query.data.links.agentWallet ? (
                <a
                  href={query.data.links.agentWallet}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-zinc-200 hover:text-white hover:underline"
                  title={query.data.agentWallet ?? undefined}
                >
                  {shortAddress(query.data.agentWallet)}
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </a>
              ) : (
                <div className="font-mono text-zinc-200">{shortAddress(query.data.agentWallet)}</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-xs text-zinc-300">
            <div className="text-zinc-400">Metadata URI</div>
            {query.data.tokenUri ? (
              <a
                href={query.data.tokenUri}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-zinc-200 hover:text-white hover:underline"
                title={query.data.tokenUri}
              >
                <span className="font-mono">{shortUri(query.data.tokenUri)}</span>
                <ExternalLink className="w-3 h-3 text-zinc-500" />
              </a>
            ) : (
              <div className="text-zinc-500">Not available</div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <a
              href={query.data.links.token}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-zinc-300 hover:text-zinc-100"
            >
              View token
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={query.data.links.registry}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-zinc-300 hover:text-zinc-100"
            >
              View registry
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </>
      ) : null}
    </section>
  )
}

