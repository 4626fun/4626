import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePublicClient, useReadContract } from 'wagmi'
import { base } from 'viem/chains'
import { formatUnits, type Address, type Abi } from 'viem'
import { ArrowLeft, ExternalLink, FileText, Network, ShieldCheck } from 'lucide-react'

import { PageMeta, META } from '@/components/seo/PageMeta'
import { Skeleton } from '@/components/ui/Skeleton'
import { getDocsOrigin } from '@/lib/explore/analyticsLinks'
import { resolveVaultByAnyAddress } from '@/lib/onchain/vaultResolve'
import { readVaultSharePriceSnapshot } from '@/lib/onchain/vaultSharePrice'
import {
  basescanAddressHref,
  summarize,
  type CheckSection,
  type VaultReportResponse,
} from '@/features/status/statusShared'

const ERC20_META_ABI = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const

const VAULT_TOTAL_ASSETS_ABI = [
  { type: 'function', name: 'totalAssets', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'performanceFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'managementFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
] as const

function shortAddr(addr: string | null | undefined): string {
  if (!addr) return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatAmount(value: bigint | undefined, decimals: number): string {
  if (value === undefined) return '—'
  const n = Number(formatUnits(value, decimals))
  if (!Number.isFinite(n)) return formatUnits(value, decimals)
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function bpsToPct(bps: number | null | undefined): string {
  if (bps === null || bps === undefined || !Number.isFinite(bps)) return '—'
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`
}

async function fetchVaultWiringReport(vault: string): Promise<VaultReportResponse | null> {
  const res = await fetch(`/api/status/vaultReport?vault=${encodeURIComponent(vault)}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return null
  const json = (await res.json()) as { success?: boolean; data?: VaultReportResponse }
  return json.data ?? null
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="text-lg font-medium text-zinc-100">{title}</h2>
      <div className="vault-surface p-5 sm:p-6 space-y-3 text-sm text-zinc-400">{children}</div>
    </section>
  )
}

function WiringSummary({ sections }: { sections: CheckSection[] }) {
  const s = summarize(sections)
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <span className="text-emerald-400/90">pass {s.pass}</span>
      <span className="text-amber-400/90">warn {s.warn}</span>
      <span className="text-rose-400/90">fail {s.fail}</span>
      <span className="text-zinc-500">info {s.info}</span>
    </div>
  )
}

export function VaultCurationReport() {
  const params = useParams<{ address: string }>()
  const addressLike = String(params.address ?? '').trim()
  const publicClient = usePublicClient({ chainId: base.id })
  const docsOrigin = getDocsOrigin()

  const resolveQuery = useQuery({
    queryKey: ['vaultResolve', base.id, addressLike],
    queryFn: async () => {
      if (!publicClient || !addressLike) return null
      return resolveVaultByAnyAddress(publicClient as any, addressLike)
    },
    enabled: Boolean(publicClient && addressLike),
  })

  const resolved = resolveQuery.data
  const vaultAddress = (resolved?.info.vault ?? null) as Address | null
  const creatorCoin = (resolved?.token ?? resolved?.info.token ?? null) as Address | null
  const wrapper = (resolved?.info.wrapper ?? null) as Address | null
  const shareOFT = (resolved?.info.shareOFT ?? null) as Address | null
  const oracle = (resolved?.info.oracle ?? null) as Address | null
  const gauge = (resolved?.info.gaugeController ?? null) as Address | null
  const ccaArm = (resolved?.ccaLaunchArm ?? null) as Address | null

  const symbolQuery = useReadContract({
    address: (creatorCoin ?? '0x0000000000000000000000000000000000000000') as Address,
    abi: ERC20_META_ABI as Abi,
    functionName: 'symbol',
    query: { enabled: Boolean(creatorCoin) },
  })
  const decimalsQuery = useReadContract({
    address: (creatorCoin ?? '0x0000000000000000000000000000000000000000') as Address,
    abi: ERC20_META_ABI as Abi,
    functionName: 'decimals',
    query: { enabled: Boolean(creatorCoin) },
  })

  const totalAssetsQuery = useReadContract({
    address: (vaultAddress ?? '0x0000000000000000000000000000000000000000') as Address,
    abi: VAULT_TOTAL_ASSETS_ABI as Abi,
    functionName: 'totalAssets',
    query: { enabled: Boolean(vaultAddress) },
  })
  const totalSupplyQuery = useReadContract({
    address: (vaultAddress ?? '0x0000000000000000000000000000000000000000') as Address,
    abi: VAULT_TOTAL_ASSETS_ABI as Abi,
    functionName: 'totalSupply',
    query: { enabled: Boolean(vaultAddress) },
  })
  const ownerQuery = useReadContract({
    address: (vaultAddress ?? '0x0000000000000000000000000000000000000000') as Address,
    abi: VAULT_TOTAL_ASSETS_ABI as Abi,
    functionName: 'owner',
    query: { enabled: Boolean(vaultAddress) },
  })
  const perfFeeQuery = useReadContract({
    address: (vaultAddress ?? '0x0000000000000000000000000000000000000000') as Address,
    abi: VAULT_TOTAL_ASSETS_ABI as Abi,
    functionName: 'performanceFee',
    query: { enabled: Boolean(vaultAddress) },
  })
  const mgmtFeeQuery = useReadContract({
    address: (vaultAddress ?? '0x0000000000000000000000000000000000000000') as Address,
    abi: VAULT_TOTAL_ASSETS_ABI as Abi,
    functionName: 'managementFee',
    query: { enabled: Boolean(vaultAddress) },
  })

  const ppsQuery = useQuery({
    queryKey: ['vault-share-price', base.id, vaultAddress ?? '', oracle ?? ''],
    queryFn: async () => {
      if (!publicClient || !vaultAddress) return null
      return readVaultSharePriceSnapshot(publicClient as any, {
        vault: vaultAddress,
        oracle: oracle ?? undefined,
      })
    },
    enabled: Boolean(publicClient && vaultAddress),
  })

  const wiringQuery = useQuery({
    queryKey: ['vault-wiring-report', vaultAddress ?? ''],
    queryFn: async () => {
      if (!vaultAddress) return null
      return fetchVaultWiringReport(vaultAddress)
    },
    enabled: Boolean(vaultAddress),
  })

  const symbol = String(symbolQuery.data ?? 'CREATOR')
  const decimals = Number(decimalsQuery.data ?? 18)
  const meta = META.vaultReport(symbol)
  const canonicalPath = vaultAddress ? `/vault/${vaultAddress}/report` : undefined

  const context = wiringQuery.data?.context ?? {}
  const strategySection = wiringQuery.data?.sections?.find((s) => s.id === 'strategies')
  const strategyDetails =
    (context.strategies as
      | Array<{ address?: string; weight?: string; kind?: string; label?: string }>
      | undefined) ?? []

  return (
    <div className="relative min-h-0 w-full bg-transparent text-white">
      <PageMeta
        title={meta.title}
        description={meta.description}
        canonicalPath={canonicalPath}
        robots="noindex,follow"
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <div className="space-y-3">
          <Link
            to={vaultAddress ? `/vault/${vaultAddress}` : '/explore/vaults'}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to vault
          </Link>
          <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">CreatorOVault report</div>
          <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">
            {resolveQuery.isLoading ? <Skeleton className="h-8 w-48" /> : `${symbol} vault report`}
          </h1>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Live instance snapshot for this vault, plus the protocol-level risk narrative and dependency graph.
            No numeric risk score — see the docs report for qualitative strengths and risks.
          </p>
          <div className="flex flex-wrap gap-3 text-xs">
            <a
              href={`${docsOrigin}/audits/creator-ovault-report`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white"
            >
              <FileText className="w-3.5 h-3.5" /> Protocol risk report <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={`${docsOrigin}/audits/creator-ovault-graph`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white"
            >
              <Network className="w-3.5 h-3.5" /> Dependency graph <ExternalLink className="w-3 h-3" />
            </a>
            {vaultAddress ? (
              <Link
                to={`/status?vault=${encodeURIComponent(vaultAddress)}`}
                className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Status wiring checks
              </Link>
            ) : null}
          </div>
        </div>

        {!addressLike ? (
          <Section id="missing" title="Missing vault">
            <p>Provide a vault, share, or creator-coin address in the URL.</p>
          </Section>
        ) : resolveQuery.isError || (resolveQuery.isSuccess && !resolved) ? (
          <Section id="unresolved" title="Vault not found">
            <p>Could not resolve <span className="font-mono text-zinc-300">{addressLike}</span> to a CreatorOVault.</p>
          </Section>
        ) : (
          <>
            <Section id="overview" title="Overview">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="label text-[10px] uppercase tracking-wider text-zinc-500">Assets</div>
                  <div className="text-zinc-100 mt-1">
                    {totalAssetsQuery.isLoading ? (
                      <Skeleton className="h-5 w-20" />
                    ) : (
                      formatAmount(totalAssetsQuery.data as bigint | undefined, decimals)
                    )}
                  </div>
                </div>
                <div>
                  <div className="label text-[10px] uppercase tracking-wider text-zinc-500">Share supply</div>
                  <div className="text-zinc-100 mt-1">
                    {totalSupplyQuery.isLoading ? (
                      <Skeleton className="h-5 w-20" />
                    ) : (
                      formatAmount(totalSupplyQuery.data as bigint | undefined, 18)
                    )}
                  </div>
                </div>
                <div>
                  <div className="label text-[10px] uppercase tracking-wider text-zinc-500">PPS (asset)</div>
                  <div className="text-zinc-100 mt-1">
                    {ppsQuery.isLoading ? (
                      <Skeleton className="h-5 w-20" />
                    ) : ppsQuery.data?.ppsAgent != null ? (
                      Number(formatUnits(ppsQuery.data.ppsAgent, 18)).toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
                <div>
                  <div className="label text-[10px] uppercase tracking-wider text-zinc-500">PPS (USD)</div>
                  <div className="text-zinc-100 mt-1">
                    {ppsQuery.isLoading ? (
                      <Skeleton className="h-5 w-20" />
                    ) : ppsQuery.data?.ppsUsd != null ? (
                      `$${Number(formatUnits(ppsQuery.data.ppsUsd, 18)).toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}`
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-zinc-500 pt-2">
                Launch allocation target for greenfield CreatorOVaults is ~45% Charm · 45% Ajna · 10% idle. Solana ShareOFT
                mesh is an arm, not a yield leg.
              </p>
            </Section>

            <Section id="funds" title="Funds management">
              <div className="space-y-2">
                <div>
                  Performance fee:{' '}
                  <span className="text-zinc-200">
                    {perfFeeQuery.isLoading ? '…' : bpsToPct(Number(perfFeeQuery.data ?? NaN))}
                  </span>
                  {' · '}
                  Management fee:{' '}
                  <span className="text-zinc-200">
                    {mgmtFeeQuery.isLoading ? '…' : bpsToPct(Number(mgmtFeeQuery.data ?? NaN))}
                  </span>
                </div>
                {strategyDetails.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-zinc-500">
                        <tr>
                          <th className="py-1 pr-3 font-medium">Strategy</th>
                          <th className="py-1 pr-3 font-medium">Kind</th>
                          <th className="py-1 font-medium">Weight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {strategyDetails.map((row, idx) => (
                          <tr key={row.address ?? `strategy-${idx}`} className="border-t border-white/5">
                            <td className="py-1.5 pr-3 font-mono">
                              {row.address ? (
                                <a
                                  href={basescanAddressHref(row.address)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-zinc-200"
                                >
                                  {shortAddr(row.address)}
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-1.5 pr-3">{row.label ?? row.kind ?? 'unknown'}</td>
                            <td className="py-1.5">{row.weight ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>
                    {wiringQuery.isLoading
                      ? 'Loading strategies…'
                      : strategySection?.checks?.[0]?.details ??
                        'No strategy rows in wiring report yet — verify onchain or open Status checks.'}
                  </p>
                )}
              </div>
            </Section>

            <Section id="control" title="Centralization & control">
              <ul className="space-y-1.5 list-disc pl-4">
                <li>
                  Vault owner:{' '}
                  {ownerQuery.data ? (
                    <a
                      className="font-mono text-zinc-300 hover:text-white"
                      href={basescanAddressHref(String(ownerQuery.data))}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {shortAddr(String(ownerQuery.data))}
                    </a>
                  ) : (
                    '—'
                  )}
                </li>
                <li>
                  Roles and emergency/impairment semantics: see{' '}
                  <a
                    className="text-zinc-300 hover:text-white underline-offset-2 hover:underline"
                    href={`${docsOrigin}/audits/creator-ovault-report#centralization-and-control`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    protocol report
                  </a>
                  .
                </li>
              </ul>
            </Section>

            <Section id="monitoring" title="Monitoring">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-zinc-500">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Contract</th>
                      <th className="py-1 font-medium">Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['CreatorOVault', vaultAddress],
                      ['Creator coin', creatorCoin],
                      ['Wrapper', wrapper],
                      ['ShareOFT', shareOFT],
                      ['Oracle', oracle],
                      ['Gauge', gauge],
                      ['CCA arm', ccaArm],
                    ].map(([label, addr]) => (
                      <tr key={String(label)} className="border-t border-white/5">
                        <td className="py-1.5 pr-3">{label}</td>
                        <td className="py-1.5 font-mono">
                          {addr ? (
                            <a
                              href={basescanAddressHref(String(addr))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-zinc-200"
                            >
                              {shortAddr(String(addr))}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {wiringQuery.data?.sections ? (
                <div className="pt-3 space-y-2">
                  <div className="text-zinc-300 text-xs">Wiring health</div>
                  <WiringSummary sections={wiringQuery.data.sections} />
                </div>
              ) : null}
            </Section>

            <Section id="docs" title="Protocol narrative">
              <p>
                Audits, liquidity risk, operational risk, reassessment triggers, and architecture live in the protocol
                docs (shared by every greenfield CreatorOVault).
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <a
                  href={`${docsOrigin}/audits/creator-ovault-report`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-zinc-200 hover:text-white"
                >
                  Open risk report <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={`${docsOrigin}/audits/creator-ovault-graph`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-zinc-200 hover:text-white"
                >
                  Open dependency graph <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={`${docsOrigin}/reference/impairment-v1-disclosures`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300"
                >
                  Impairment disclosures <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

export default VaultCurationReport
