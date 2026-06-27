import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import type { Address } from 'viem'
import { ArrowRight, Check, ChevronDown, Clock, Info, Sparkles, X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { usePayWithX402 } from '@/lib/creatorStrategy/usePayWithX402'
import {
  partitionCreatorStrategyCatalog,
  vanityTierLabel,
  type VanityFeatureGroup,
} from '@/lib/creatorStrategy/featuresPageLayout'
import type {
  ActivationDto,
  CatalogDto,
  FeatureListResponse,
  PaymentPath,
} from '@/pages/CreatorStrategyFeatures.types'

function getApiBase(): string {
  const envBase = (import.meta as any)?.env?.VITE_PUBLIC_API_BASE
  if (typeof envBase === 'string' && envBase.length > 0) return envBase.replace(/\/+$/, '')
  return ''
}

function shortHex(value: string | null | undefined, keep = 6): string {
  if (!value) return '—'
  if (value.length <= keep * 2 + 2) return value
  return `${value.slice(0, keep + 2)}…${value.slice(-keep)}`
}

function describeStatus(activation: ActivationDto | null): {
  label: string
  tone: 'good' | 'pending' | 'bad' | 'neutral'
} {
  if (!activation) return { label: 'Not activated', tone: 'neutral' }
  switch (activation.status) {
    case 'active':
      return { label: 'Active', tone: 'good' }
    case 'pending':
      return { label: 'Pending', tone: 'pending' }
    case 'failed':
      return { label: 'Failed', tone: 'bad' }
    case 'refunded':
      return { label: 'Refunded', tone: 'neutral' }
    default:
      return { label: activation.status, tone: 'neutral' }
  }
}

export type CreatorStrategyFeaturesPanelProps = {
  creatorToken: Address
  variant?: 'page' | 'deploy'
  data?: FeatureListResponse | null
  loading?: boolean
  loadError?: string | null
  onReload?: () => void | Promise<void>
  onActivationComplete?: () => void | Promise<void>
  showDeploySection?: boolean
  showVanity?: boolean
  panelId?: string
}

export function CreatorStrategyFeaturesPanel({
  creatorToken,
  variant = 'page',
  data: controlledData,
  loading: controlledLoading,
  loadError: controlledLoadError,
  onReload,
  onActivationComplete,
  showDeploySection = true,
  showVanity = variant !== 'deploy',
  panelId = 'creator-strategy-features',
}: CreatorStrategyFeaturesPanelProps) {
  const { address: connectedAddress } = useAccount()
  const isDeployEmbed = variant === 'deploy'

  const [internalData, setInternalData] = useState<FeatureListResponse | null>(null)
  const [internalLoading, setInternalLoading] = useState(false)
  const [internalLoadError, setInternalLoadError] = useState<string | null>(null)
  const [inflightFeature, setInflightFeature] = useState<string | null>(null)
  const [inflightMessage, setInflightMessage] = useState<string | null>(null)
  const [expandedVanityKey, setExpandedVanityKey] = useState<string | null>(null)
  const x402 = usePayWithX402()

  const isControlled = controlledData !== undefined || controlledLoading !== undefined

  const loadFeatures = useCallback(async () => {
    setInternalLoading(true)
    setInternalLoadError(null)
    try {
      const base = getApiBase()
      const res = await fetch(
        `${base}/api/creator/strategy/list?creator=${creatorToken}`,
        { credentials: 'include' },
      )
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${bodyText.slice(0, 200)}`)
      }
      const raw = (await res.json()) as { success: boolean; data?: FeatureListResponse; error?: string }
      if (!raw.success || !raw.data) throw new Error(raw.error ?? 'Malformed response')
      setInternalData(raw.data)
    } catch (err) {
      setInternalLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setInternalLoading(false)
    }
  }, [creatorToken])

  useEffect(() => {
    if (isControlled) return
    void loadFeatures()
  }, [isControlled, loadFeatures])

  const reloadFeatures = useCallback(async () => {
    if (onReload) {
      await onReload()
      return
    }
    await loadFeatures()
  }, [loadFeatures, onReload])

  const data = isControlled ? (controlledData ?? null) : internalData
  const loading = isControlled ? Boolean(controlledLoading) : internalLoading
  const loadError = isControlled ? (controlledLoadError ?? null) : internalLoadError

  const activationsByKey = useMemo(() => {
    const map = new Map<string, ActivationDto>()
    for (const a of data?.activations ?? []) {
      const existing = map.get(a.featureKey)
      if (!existing || new Date(a.createdAt) > new Date(existing.createdAt)) {
        map.set(a.featureKey, a)
      }
    }
    return map
  }, [data])

  const layout = useMemo(
    () => (data ? partitionCreatorStrategyCatalog(data.catalog) : null),
    [data],
  )

  const startPayment = useCallback(
    async (feature: CatalogDto, path: PaymentPath) => {
      if (!data || !creatorToken) return
      setInflightFeature(feature.key)
      setInflightMessage(null)
      try {
        const base = getApiBase()
        switch (path) {
          case 'stripe': {
            const res = await fetch(`${base}/api/creator/strategy/stripe/checkout`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                creatorToken,
                featureKey: feature.key,
              }),
            })
            const json = (await res.json()) as {
              success: boolean
              data?: { sessionUrl: string }
              error?: string
            }
            if (!json.success || !json.data?.sessionUrl) {
              throw new Error(json.error ?? `HTTP ${res.status}`)
            }
            window.location.href = json.data.sessionUrl
            return
          }
          case 'x402': {
            setInflightMessage('Building payment authorization; please sign in your wallet…')
            const result = await x402.pay({
              creatorToken,
              featureKey: feature.key,
              endpoint: `${base}/api/creator/strategy/x402-activate`,
            })
            if (result.phase === 'success') {
              setInflightMessage(
                `Activated via x402. Settlement tx: ${result.txHash}. Reloading…`,
              )
              await reloadFeatures()
              await onActivationComplete?.()
            } else if (result.phase === 'error') {
              setInflightMessage(`x402 payment failed (${result.reason}): ${result.message}`)
            }
            return
          }
          case 'usdc_txhash': {
            const txHash = window.prompt(
              `Paste the Base mainnet tx hash of your USDC transfer to the 4626 protocol treasury.\n\n` +
                `(Send ${feature.priceUsdcDisplay} USDC from your wallet to the treasury, then paste the tx hash here.)`,
            )
            if (!txHash) return
            const res = await fetch(`${base}/api/creator/strategy/activate`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                creatorToken,
                featureKey: feature.key,
                paymentTxHash: txHash.trim(),
              }),
            })
            const json = (await res.json()) as { success: boolean; error?: string }
            if (!json.success) throw new Error(json.error ?? `HTTP ${res.status}`)
            setInflightMessage('Payment verified. Reloading feature state…')
            await reloadFeatures()
            await onActivationComplete?.()
            return
          }
          default:
            throw new Error(`Unknown payment path: ${path satisfies never}`)
        }
      } catch (err) {
        setInflightMessage(
          `Activation failed: ${err instanceof Error ? err.message : String(err)}`,
        )
      } finally {
        setInflightFeature(null)
      }
    },
    [creatorToken, data, onActivationComplete, reloadFeatures, x402],
  )

  const visibleSections = useMemo(() => {
    if (!layout) return []
    return showDeploySection ? layout.sections : layout.sections.filter((section) => section.id !== 'deploy')
  }, [layout, showDeploySection])

  return (
    <div id={panelId} className={isDeployEmbed ? 'space-y-4' : undefined}>
      {!isDeployEmbed && connectedAddress && (
        <p className="mb-4 text-xs text-zinc-500">
          Signed in as <span className="mono">{shortHex(connectedAddress)}</span>
        </p>
      )}

      {loading && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-sm text-zinc-500">
          Loading features…
        </div>
      )}

      {loadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] p-4 text-sm text-red-300">
          <div className="flex items-center gap-2">
            <X className="h-4 w-4 shrink-0" />
            <div>Failed to load features: {loadError}</div>
          </div>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => void reloadFeatures()}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !loadError && data && layout && (
        <>
          {data.deployPlan.blockedReason === 'no_paid_strategies' && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm text-amber-200">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0" />
                <div>
                  {isDeployEmbed
                    ? 'Pay for full vault deploy below to continue. Vanity address options are optional extras.'
                    : 'Pay $499 for full vault deploy below before you can deploy your vault.'}
                </div>
              </div>
            </div>
          )}

          <div className={isDeployEmbed ? 'space-y-4' : 'space-y-8'}>
            {visibleSections.map((section) => (
              <section key={section.id}>
                {!isDeployEmbed ? (
                  <div className="mb-3">
                    <h2 className="text-sm font-medium text-zinc-200">{section.title}</h2>
                    {section.subtitle ? (
                      <p className="mt-1 text-xs text-zinc-500">{section.subtitle}</p>
                    ) : null}
                  </div>
                ) : section.id === 'deploy' ? (
                  <div className="mb-2">
                    <h2 className="text-sm font-medium text-zinc-200">Activate vault deploy</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      One payment unlocks deploy for{' '}
                      <code className="mono text-brand-accent">{shortHex(creatorToken, 8)}</code>.
                      {section.subtitle ? ` ${section.subtitle}` : null}
                    </p>
                  </div>
                ) : (
                  <div className="mb-2">
                    <h2 className="text-sm font-medium text-zinc-200">{section.title}</h2>
                    {section.subtitle ? (
                      <p className="mt-1 text-xs text-zinc-500">{section.subtitle}</p>
                    ) : null}
                  </div>
                )}
                <div className="space-y-3">
                  {section.features.map((feature) => (
                    <StrategyFeatureCard
                      key={feature.key}
                      feature={feature}
                      activation={activationsByKey.get(feature.key) ?? null}
                      isInflight={inflightFeature === feature.key}
                      onPay={(path) => startPayment(feature, path)}
                    />
                  ))}
                </div>
              </section>
            ))}

            {showVanity && layout.vanityGroups.length > 0 && (
              <section id="creator-strategy-vanity">
                <div className="mb-3">
                  <h2 className="text-sm font-medium text-zinc-200">Address vanity (optional)</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Custom vault prefix or share suffix — skip this section if defaults work for you.
                  </p>
                </div>
                <div className="space-y-3">
                  {layout.vanityGroups.map((group) => (
                    <VanityFeatureGroupCard
                      key={group.id}
                      group={group}
                      activationsByKey={activationsByKey}
                      expandedFeatureKey={expandedVanityKey}
                      inflightFeature={inflightFeature}
                      onToggleExpand={(key) =>
                        setExpandedVanityKey((current) => (current === key ? null : key))
                      }
                      onPay={startPayment}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>

          {inflightMessage && (
            <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-white/5 bg-black/40 p-4 text-xs text-zinc-400">
              {inflightMessage}
            </pre>
          )}

          {!isDeployEmbed && (
            <footer className="mt-10 border-t border-white/5 pt-6 text-xs text-zinc-500">
              <p>
                USDC treasury: <code className="mono">{data.treasury}</code>. Full deploy includes Charm and Ajna at 45% / 45% productive weight (10% idle).
              </p>
            </footer>
          )}
        </>
      )}
    </div>
  )
}

function StrategyFeatureCard({
  feature,
  activation,
  isInflight,
  onPay,
}: {
  feature: CatalogDto
  activation: ActivationDto | null
  isInflight: boolean
  onPay: (path: PaymentPath) => void
}) {
  const status = describeStatus(activation)
  const isActive = activation?.status === 'active' || activation?.status === 'pending'
  const isDeployBundle = feature.key === 'vault_full_deploy'

  return (
    <article
      className={
        isDeployBundle
          ? 'rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] to-white/[0.02] p-5 transition-colors hover:border-amber-500/45'
          : 'rounded-xl border border-white/5 bg-white/[0.02] p-5 transition-colors hover:border-white/10'
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-medium text-white">{feature.displayName}</h3>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
          </div>
          <p className="mt-1 text-sm text-zinc-400">{feature.tagline}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs text-zinc-500">Price</div>
          <div className="font-medium text-zinc-200">{feature.priceUsdcDisplay} USDC</div>
        </div>
      </div>

      <FeatureDetails feature={feature} activation={activation} />

      {!isActive && (
        <PaymentPathGrid disabled={isInflight} onPay={onPay} priceDisplay={feature.priceUsdcDisplay} />
      )}
    </article>
  )
}

function VanityFeatureGroupCard({
  group,
  activationsByKey,
  expandedFeatureKey,
  inflightFeature,
  onToggleExpand,
  onPay,
}: {
  group: VanityFeatureGroup
  activationsByKey: Map<string, ActivationDto>
  expandedFeatureKey: string | null
  inflightFeature: string | null
  onToggleExpand: (featureKey: string) => void
  onPay: (feature: CatalogDto, path: PaymentPath) => void
}) {
  const activeCount = group.features.filter((f) => {
    const a = activationsByKey.get(f.key)
    return a?.status === 'active' || a?.status === 'pending'
  }).length

  return (
    <details className="group rounded-xl border border-white/5 bg-white/[0.02] open:border-white/10">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-zinc-500" aria-hidden />
            <h3 className="text-base font-medium text-white">{group.title}</h3>
            {activeCount > 0 ? (
              <StatusPill tone="good">{activeCount} tier{activeCount === 1 ? '' : 's'} active</StatusPill>
            ) : (
              <StatusPill tone="neutral">Optional</StatusPill>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-400">{group.subtitle}</p>
          <p className="mt-2 text-xs text-zinc-500">{group.defaultNote}</p>
        </div>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
      </summary>

      <div className="border-t border-white/5 px-5 pb-5 pt-4">
        <div className="overflow-hidden rounded-lg border border-white/5">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] uppercase tracking-wide text-zinc-500">
            <span>Length</span>
            <span className="text-right">Price</span>
            <span className="text-right">Action</span>
          </div>
          {group.features.map((feature) => {
            const activation = activationsByKey.get(feature.key) ?? null
            const status = describeStatus(activation)
            const isActive = activation?.status === 'active' || activation?.status === 'pending'
            const isExpanded = expandedFeatureKey === feature.key
            const isInflight = inflightFeature === feature.key

            return (
              <div key={feature.key} className="border-b border-white/5 last:border-b-0">
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-3 py-3">
                  <div>
                    <div className="text-sm text-zinc-200">{vanityTierLabel(feature)}</div>
                    <div className="mt-0.5">
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    </div>
                  </div>
                  <div className="text-right text-sm font-medium text-zinc-300">
                    {feature.priceUsdcDisplay}
                  </div>
                  <div className="text-right">
                    {isActive ? (
                      <span className="text-xs text-zinc-500">Included</span>
                    ) : (
                      <Button
                        type="button"
                        variant={isExpanded ? 'secondary' : 'primary'}
                        size="sm"
                        disabled={isInflight}
                        onClick={() => onToggleExpand(feature.key)}
                      >
                        {isExpanded ? 'Close' : 'Activate'}
                      </Button>
                    )}
                  </div>
                </div>

                {isExpanded && !isActive && (
                  <div className="border-t border-white/5 bg-black/20 px-3 py-3">
                    <p className="mb-3 text-xs text-zinc-500">{feature.tagline}</p>
                    <PaymentPathGrid
                      disabled={isInflight}
                      onPay={(path) => onPay(feature, path)}
                      priceDisplay={feature.priceUsdcDisplay}
                      compact
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </details>
  )
}

function FeatureDetails({
  feature,
  activation,
}: {
  feature: CatalogDto
  activation: ActivationDto | null
}) {
  return (
    <>
      <details className="mt-3 text-xs text-zinc-500">
        <summary className="cursor-pointer text-zinc-400 hover:text-zinc-300">What it does</summary>
        <p className="mt-2 whitespace-pre-line leading-relaxed">{feature.description}</p>
        {feature.requires.length > 0 && (
          <ul className="mt-2 space-y-1">
            {feature.requires.map((req, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-zinc-600">•</span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        )}
      </details>

      {activation?.paymentTxHash && (
        <p className="mt-3 text-xs text-zinc-500">
          Payment:{' '}
          <a
            href={`https://basescan.org/tx/${activation.paymentTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="mono underline decoration-dotted hover:text-zinc-300"
          >
            {shortHex(activation.paymentTxHash, 8)}
          </a>
        </p>
      )}
    </>
  )
}

function PaymentPathGrid({
  disabled,
  onPay,
  priceDisplay,
  compact = false,
}: {
  disabled?: boolean
  onPay: (path: PaymentPath) => void
  priceDisplay: string
  compact?: boolean
}) {
  return (
    <div className={`grid grid-cols-1 gap-2 ${compact ? 'sm:grid-cols-3' : 'sm:grid-cols-3'}`}>
      <PaymentPathButton
        label="USDC on Base"
        sub={compact ? 'Paste tx hash' : `Send ${priceDisplay} → paste tx hash`}
        disabled={disabled}
        onClick={() => onPay('usdc_txhash')}
      />
      <PaymentPathButton
        label="x402"
        sub={compact ? 'Gasless wallet sign' : 'Gasless EIP-3009 (Coinbase Wallet, Rainbow)'}
        disabled={disabled}
        onClick={() => onPay('x402')}
      />
      <PaymentPathButton
        label="Card"
        sub={compact ? 'Stripe' : 'Stripe Checkout; 2.9 % + $0.30 fee'}
        disabled={disabled}
        onClick={() => onPay('stripe')}
      />
    </div>
  )
}

function StatusPill({
  tone,
  children,
}: {
  tone: 'good' | 'pending' | 'bad' | 'neutral'
  children: React.ReactNode
}) {
  const toneClass =
    tone === 'good'
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
      : tone === 'pending'
        ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
        : tone === 'bad'
          ? 'border-red-400/30 bg-red-400/10 text-red-200'
          : 'border-white/10 bg-white/[0.02] text-zinc-400'
  const icon =
    tone === 'good' ? (
      <Check className="h-3 w-3" />
    ) : tone === 'pending' ? (
      <Clock className="h-3 w-3" />
    ) : tone === 'bad' ? (
      <X className="h-3 w-3" />
    ) : null
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${toneClass}`}
    >
      {icon}
      {children}
    </span>
  )
}

function PaymentPathButton({
  label,
  sub,
  disabled,
  onClick,
}: {
  label: string
  sub: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'group flex flex-col items-start rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-left text-xs transition-colors ' +
        (disabled
          ? 'cursor-not-allowed opacity-50'
          : 'hover:border-brand-accent/40 hover:bg-white/[0.04]')
      }
    >
      <div className="flex w-full items-center justify-between">
        <span className="font-medium text-zinc-100">{label}</span>
        <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-300" />
      </div>
      <span className="mt-0.5 text-zinc-500">{sub}</span>
    </button>
  )
}
