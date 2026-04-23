import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { isAddress, type Address } from 'viem'
import { ArrowRight, Check, Clock, Info, X } from 'lucide-react'

import { usePayWithX402 } from '@/lib/creatorStrategy/usePayWithX402'

/**
 * Creator strategy features paywall page.
 *
 * Lets a creator (or anyone on their team) pay $100 USDC per premium
 * feature to unlock it on their vault. Reads the full catalog +
 * existing activations from `GET /api/creator/strategy/list` and shows
 * a card per feature with one of three states:
 *
 *   - active    — already paid and provisioned (green checkmark)
 *   - pending   — payment verified, operator not yet provisioned (yellow clock)
 *   - unpaid    — show three payment-path buttons (USDC tx hash / x402 / Stripe)
 *
 * The three payment paths are all fully wired server-side already:
 *   - POST /api/creator/strategy/activate       (legacy, USDC tx hash)
 *   - POST /api/creator/strategy/x402-activate  (EIP-3009, gasless, one round-trip)
 *   - POST /api/creator/strategy/stripe/checkout (card checkout via Stripe)
 *
 * See `docs/operations/creator-strategy-features.md` for the full spec.
 */

type DeployPlanDto = {
  creatorToken: Address
  deployable: boolean
  charmWeightBps: string
  ajnaWeightBps: string
  solanaWeightBps: string
  idleReserveBps: string
  reasons: {
    charm: 'paid' | 'unpaid'
    ajna: 'paid' | 'unpaid'
    solana: 'paid' | 'unpaid'
  }
  activeFeatureKeys: string[]
  blockedReason: 'no_paid_strategies' | null
}

type ActivationDto = {
  creatorToken: Address
  featureKey: string
  status: 'pending' | 'active' | 'failed' | 'refunded'
  priceUsdcPaid: string
  paymentTxHash: string | null
  paymentVerifiedAt: string | null
  provisionedAt: string | null
  failedAt: string | null
  failureReason: string | null
  provisionerRef: string | null
  createdAt: string
  updatedAt: string
}

type CatalogDto = {
  key: string
  displayName: string
  tagline: string
  description: string
  priceUsdc: string
  priceUsdcDisplay: string
  provisionerTag: string
  requires: readonly string[]
  estimatedActivationWindow: string
}

type FeatureListResponse = {
  creatorToken: Address
  treasury: Address
  catalog: CatalogDto[]
  activations: ActivationDto[]
  deployPlan: DeployPlanDto
}

type PaymentPath = 'usdc_txhash' | 'x402' | 'stripe'

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
      return { label: 'Pending provisioning', tone: 'pending' }
    case 'failed':
      return { label: 'Failed — contact support', tone: 'bad' }
    case 'refunded':
      return { label: 'Refunded', tone: 'neutral' }
    default:
      return { label: activation.status, tone: 'neutral' }
  }
}

export function CreatorStrategyFeatures() {
  const params = useParams<{ identifier?: string }>()
  const [search] = useSearchParams()
  const { address: connectedAddress } = useAccount()

  const creatorTokenRaw =
    params.identifier ?? search.get('creator') ?? search.get('creatorToken') ?? ''
  const creatorToken: Address | null = isAddress(creatorTokenRaw)
    ? (creatorTokenRaw as Address)
    : null

  const [data, setData] = useState<FeatureListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [inflightFeature, setInflightFeature] = useState<string | null>(null)
  const [inflightMessage, setInflightMessage] = useState<string | null>(null)
  const x402 = usePayWithX402()

  const loadFeatures = useCallback(async () => {
    if (!creatorToken) return
    setLoading(true)
    setLoadError(null)
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
      setData(raw.data)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [creatorToken])

  useEffect(() => {
    loadFeatures()
  }, [loadFeatures])

  const activationsByKey = useMemo(() => {
    const map = new Map<string, ActivationDto>()
    for (const a of data?.activations ?? []) {
      // Keep the most recent live row per feature
      const existing = map.get(a.featureKey)
      if (!existing || new Date(a.createdAt) > new Date(existing.createdAt)) {
        map.set(a.featureKey, a)
      }
    }
    return map
  }, [data])

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
            // In-dapp wallet-signing flow: usePayWithX402 handles the full
            // round-trip (fetch 402, build EIP-3009 typed data, sign via
            // connected wallet, base64-encode into X-PAYMENT, re-POST).
            // Works natively with Coinbase Wallet + Rainbow; older
            // MetaMask will still sign but warns about unverified typed
            // data.
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
              await loadFeatures()
            } else if (result.phase === 'error') {
              setInflightMessage(`x402 payment failed (${result.reason}): ${result.message}`)
            }
            return
          }
          case 'usdc_txhash': {
            // Open a modal asking for the creator to paste a tx hash.
            const txHash = window.prompt(
              `Paste the Base mainnet tx hash of your USDC transfer to the 4626 protocol treasury.\n\n` +
                `(Send ${feature.priceUsdcDisplay} USDC from your wallet to the treasury address shown on the dashboard, then paste the tx hash here.)`,
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
            await loadFeatures()
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
    [creatorToken, data, loadFeatures, x402],
  )

  if (!creatorToken) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-2xl font-light tracking-tight text-white">Creator strategy features</h1>
        <p className="mt-4 text-sm text-zinc-400">
          Missing or invalid <code className="mono text-brand-accent">creator</code> query parameter. Example:{' '}
          <code className="mono text-zinc-300">/creator/strategy/features?creator=0x…</code>
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-light tracking-tight text-white">Creator strategy features</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Pay-to-enable strategies for vault <code className="mono text-brand-accent">{shortHex(creatorToken, 8)}</code>.
          Each feature is a one-time USDC payment; post-payment activation is automatic for deploy-gating features and
          operator-run for post-deploy extras. See the{' '}
          <a
            href="https://github.com/wenakita/4626/blob/main/docs/operations/creator-strategy-features.md"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted hover:text-zinc-300"
          >
            operator spec
          </a>{' '}
          for the full contract.
        </p>
        {connectedAddress && (
          <p className="mt-1 text-xs text-zinc-500">
            Signed in as <span className="mono">{shortHex(connectedAddress)}</span>. Payments are billed to this wallet
            (or your card, for Stripe).
          </p>
        )}
      </header>

      {loading && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-sm text-zinc-500">Loading features…</div>
      )}

      {loadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] p-4 text-sm text-red-300">
          <div className="flex items-center gap-2">
            <X className="h-4 w-4 shrink-0" />
            <div>Failed to load features: {loadError}</div>
          </div>
          <button
            type="button"
            onClick={loadFeatures}
            className="mt-3 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/10"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && data && (
        <>
          {data.deployPlan.blockedReason === 'no_paid_strategies' && (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm text-amber-200">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0" />
                <div>
                  This creator hasn't activated any strategy yet. A vault can't be deployed until at least one paid
                  strategy below is activated.
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {data.catalog.map((feature) => {
              const activation = activationsByKey.get(feature.key) ?? null
              const status = describeStatus(activation)
              const isActive = activation?.status === 'active' || activation?.status === 'pending'
              const isInflight = inflightFeature === feature.key

              return (
                <article
                  key={feature.key}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-medium text-white">{feature.displayName}</h2>
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      </div>
                      <p className="mt-1 text-sm text-zinc-400">{feature.tagline}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm text-zinc-500">Price</div>
                      <div className="font-medium text-zinc-200">{feature.priceUsdcDisplay} USDC</div>
                    </div>
                  </div>

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
                    <p className="mt-2 text-zinc-600">Activation window: {feature.estimatedActivationWindow}</p>
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

                  {!isActive && (
                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <PaymentPathButton
                        label="Pay with USDC on Base"
                        sub="Send USDC → paste tx hash"
                        disabled={isInflight}
                        onClick={() => startPayment(feature, 'usdc_txhash')}
                      />
                      <PaymentPathButton
                        label="Pay with x402"
                        sub="Gasless EIP-3009 (Coinbase Wallet, Rainbow)"
                        disabled={isInflight}
                        onClick={() => startPayment(feature, 'x402')}
                      />
                      <PaymentPathButton
                        label="Pay with card"
                        sub="Stripe Checkout; 2.9 % + $0.30 fee"
                        disabled={isInflight}
                        onClick={() => startPayment(feature, 'stripe')}
                      />
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          {inflightMessage && (
            <pre className="mt-6 whitespace-pre-wrap rounded-xl border border-white/5 bg-black/40 p-4 text-xs text-zinc-400">
              {inflightMessage}
            </pre>
          )}

          <footer className="mt-10 border-t border-white/5 pt-6 text-xs text-zinc-500">
            <p>
              USDC treasury: <code className="mono">{data.treasury}</code>. Strategy weight plan is computed server-side
              from your paid activations; see the{' '}
              <a
                href="https://github.com/wenakita/4626/blob/main/docs/operations/creator-strategy-features.md#strategy-gating-phase-3"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted"
              >
                weight-scaling docs
              </a>{' '}
              for the rules (1/2/3 paid → 90/45/30 % productive weight each).
            </p>
          </footer>
        </>
      )}
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
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${toneClass}`}>
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
