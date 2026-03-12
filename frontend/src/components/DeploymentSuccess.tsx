import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { Address } from 'viem'
import { useMutation, useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { ExternalLink, CheckCircle2, ArrowRight, Wallet, BarChart3, Sparkles } from 'lucide-react'
import type { DeploymentRecord } from '@/hooks/useDeploymentTracker'
import { apiFetch } from '@/lib/apiBase'

const shortAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
const CCA_LAUNCH_STRATEGY_AUCTION_STATUS_ABI = [
  {
    name: 'getAuctionStatus',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'auction', type: 'address' },
      { name: 'isActive', type: 'bool' },
      { name: 'isGraduated', type: 'bool' },
      { name: 'clearingPrice', type: 'uint256' },
      { name: 'currencyRaised', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const

function AddressRow({ label, address, highlight }: { label: string; address: Address | string | null | undefined; highlight?: boolean }) {
  const a = address ? String(address) : ''
  const ok = a && a !== '0x0000000000000000000000000000000000000000'
  const href = ok ? `https://basescan.org/address/${a}` : null
  return (
    <div className="flex items-center justify-between gap-4 text-[11px]">
      <div className={highlight ? 'text-zinc-300' : 'text-zinc-500'}>{label}</div>
      {ok && href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={`font-mono hover:text-white transition-colors flex items-center gap-1 ${highlight ? 'text-emerald-400' : 'text-zinc-200/90'}`}
        >
          {shortAddress(a)}
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <div className="font-mono text-zinc-600">—</div>
      )}
    </div>
  )
}

function TxRow({ label, txHash }: { label: string; txHash: string | undefined }) {
  const ok = txHash && txHash.startsWith('0x')
  const href = ok ? `https://basescan.org/tx/${txHash}` : null
  return (
    <div className="flex items-center justify-between gap-4 text-[11px]">
      <div className="text-zinc-500">{label}</div>
      {ok && href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-zinc-200/90 hover:text-white transition-colors flex items-center gap-1"
        >
          {shortAddress(txHash!)}
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <div className="font-mono text-zinc-600">—</div>
      )}
    </div>
  )
}

interface NextStep {
  icon: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    to?: string
    href?: string
  }
}

export type AjnaAutomationPayload = {
  vaultAddress: string
  cswAddress: string
  embeddedEoaAddress: string
  privyWalletId: string
}

export type AjnaAutomationStatus = {
  vaultAddress: string
  automationEnabled: boolean
  automationScope?: string | null
  canonicalCswAddress?: string | null
  embeddedEoaAddress?: string | null
  privyWalletId?: string | null
  lastOwnerCheckAt?: string | null
  revokedAt?: string | null
  updatedAt?: string | null
}

export type AjnaAutomationOptInCardProps = {
  vaultAddress: string
  canonicalCswAddress: string | null | undefined
  embeddedEoaAddress: string | null | undefined
  privyWalletId: string | null | undefined
  status: AjnaAutomationStatus | null
  statusUnavailable?: boolean
  isSubmitting: boolean
  isRevoking: boolean
  isStatusLoading?: boolean
  showVaultInput?: boolean
  errorMessage?: string | null
  onEnable: (payload: AjnaAutomationPayload) => void
  onRevoke: (vaultAddress: string) => void
  onVaultAddressChange?: (value: string) => void
}

function isAddressLike(value: string | null | undefined): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

function DebugRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="mt-1 break-all font-mono text-[11px] text-zinc-200">{value && value.trim() ? value : '—'}</div>
    </div>
  )
}

export function AjnaAutomationOptInCard({
  vaultAddress,
  canonicalCswAddress,
  embeddedEoaAddress,
  privyWalletId,
  status,
  statusUnavailable = false,
  isSubmitting,
  isRevoking,
  isStatusLoading = false,
  showVaultInput = true,
  errorMessage,
  onEnable,
  onRevoke,
  onVaultAddressChange,
}: AjnaAutomationOptInCardProps) {
  const normalizedVaultAddress = vaultAddress.trim()
  const hasVaultAddress = isAddressLike(normalizedVaultAddress)
  const hasWalletContext =
    isAddressLike(canonicalCswAddress ?? null) &&
    isAddressLike(embeddedEoaAddress ?? null) &&
    typeof privyWalletId === 'string' &&
    privyWalletId.trim().length > 0
  const canEnable = hasVaultAddress && hasWalletContext
  const isEnabled = status?.automationEnabled === true && !status?.revokedAt
  const statusLabel = statusUnavailable ? 'Status unavailable' : isEnabled ? 'Enabled' : 'Off by default'
  const effectiveCanonicalCsw = status?.canonicalCswAddress ?? canonicalCswAddress ?? null
  const effectiveEmbeddedEoa = status?.embeddedEoaAddress ?? embeddedEoaAddress ?? null
  const effectivePrivyWalletLinked =
    typeof (status?.privyWalletId ?? privyWalletId) === 'string' &&
    String(status?.privyWalletId ?? privyWalletId).trim().length > 0

  return (
    <div
      data-testid="ajna-automation-panel"
      className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-emerald-300">Ajna Automation</div>
          <div className="mt-1 text-sm text-white">
            {statusUnavailable
              ? 'Ajna automation status unavailable'
              : isEnabled
                ? 'Ajna automation is enabled'
                : 'Opt in to Ajna automation'}
          </div>
          <p className="mt-1 max-w-2xl text-[12px] text-zinc-300">
            Authorize canonical Ajna automation with your creator-owned Coinbase Smart Wallet, connected embedded Privy EOA,
            and its linked Privy wallet.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-200">
          {statusLabel}
        </span>
      </div>

      {showVaultInput ? (
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1.5">
            Vault Address For Ajna Automation
          </label>
          <input
            aria-label="Ajna vault address"
            type="text"
            value={vaultAddress}
            onChange={(event) => onVaultAddressChange?.(event.target.value)}
            placeholder="0x..."
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/30"
          />
        </div>
      ) : (
        <DebugRow label="Vault" value={normalizedVaultAddress} />
      )}

      {isStatusLoading ? (
        <div className="text-[11px] text-zinc-400">Checking current Ajna automation status…</div>
      ) : null}

      {!hasWalletContext ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
          Connect your canonical CSW plus the embedded Privy EOA that can sign for it before opting in.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">{errorMessage}</div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <DebugRow label="Canonical CSW" value={effectiveCanonicalCsw} />
        <DebugRow label="Embedded EOA" value={effectiveEmbeddedEoa} />
        <DebugRow label="Privy Wallet" value={effectivePrivyWalletLinked ? 'On file' : null} />
        <DebugRow label="Automation Scope" value={status?.automationScope ?? 'ajna_min_bucket_only'} />
      </div>

      {status?.lastOwnerCheckAt ? <DebugRow label="Last Owner Check" value={status.lastOwnerCheckAt} /> : null}
      {status?.updatedAt ? <DebugRow label="Last Updated" value={status.updatedAt} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        {isEnabled ? (
          <button
            type="button"
            aria-label="Revoke Ajna automation"
            onClick={() => onRevoke(normalizedVaultAddress)}
            disabled={isRevoking || !hasVaultAddress}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-200 hover:bg-red-500/20 disabled:opacity-60"
          >
            {isRevoking ? 'Revoking…' : 'Revoke automation'}
          </button>
        ) : (
          <button
            type="button"
            aria-label="Enable Ajna automation"
            onClick={() => {
              if (!canEnable) return
              onEnable({
                vaultAddress: normalizedVaultAddress,
                cswAddress: canonicalCswAddress!,
                embeddedEoaAddress: embeddedEoaAddress!,
                privyWalletId: privyWalletId!.trim(),
              })
            }}
            disabled={!canEnable || isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
          >
            {isSubmitting ? 'Enabling…' : 'Enable Ajna automation'}
          </button>
        )}
        <div className="text-[11px] text-zinc-400">This authorization stays tied to your own wallet context and can be revoked at any time.</div>
      </div>
    </div>
  )
}

export interface DeploymentSuccessProps {
  /** The deployment record */
  deployment: DeploymentRecord | null
  /** Token symbol for display */
  tokenSymbol?: string
  /** Share symbol for display */
  shareSymbol?: string
  /** Callback when user wants to view another deployment */
  onNewDeploy?: () => void
  /** Canonical CSW used for Ajna automation consent */
  canonicalCswAddress?: Address | string | null
  /** Connected embedded EOA wallet address */
  embeddedEoaAddress?: Address | string | null
  /** Connected embedded EOA Privy wallet ID */
  privyWalletId?: string | null
}

export function DeploymentSuccess({
  deployment,
  shareSymbol,
  canonicalCswAddress,
  embeddedEoaAddress,
  privyWalletId,
}: DeploymentSuccessProps) {
  const publicClient = usePublicClient({ chainId: 8453 })
  const [ajnaAutomationStatus, setAjnaAutomationStatus] = useState<AjnaAutomationStatus | null>(null)
  const auctionStatusQuery = useQuery({
    queryKey: ['deploymentSuccess', 'auctionStatus', deployment?.contracts.ccaStrategy],
    enabled: !!deployment?.contracts.ccaStrategy && !!publicClient,
    staleTime: 20_000,
    queryFn: async () => {
      if (!deployment?.contracts.ccaStrategy || !publicClient) return null
      const status = (await publicClient.readContract({
        address: deployment.contracts.ccaStrategy,
        abi: CCA_LAUNCH_STRATEGY_AUCTION_STATUS_ABI,
        functionName: 'getAuctionStatus',
      })) as readonly [Address, boolean, boolean, bigint, bigint]
      const auction = String(status?.[0] ?? '').toLowerCase()
      return {
        hasAuction: /^0x[a-f0-9]{40}$/.test(auction) && auction !== ZERO_ADDRESS,
        isActive: Boolean(status?.[1] ?? false),
        isGraduated: Boolean(status?.[2] ?? false),
      }
    },
  })

  const ajnaAutomationEnableMutation = useMutation({
    mutationFn: async (payload: AjnaAutomationPayload): Promise<AjnaAutomationStatus> => {
      const res = await apiFetch('/api/keepr/vault/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<AjnaAutomationStatus> | null
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error ?? 'Failed to enable Ajna automation')
      }
      return json.data
    },
    onSuccess: (data) => {
      setAjnaAutomationStatus(data)
    },
  })

  const ajnaAutomationRevokeMutation = useMutation({
    mutationFn: async (vaultAddress: string): Promise<AjnaAutomationStatus> => {
      const res = await apiFetch('/api/keepr/vault/automation', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultAddress }),
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<AjnaAutomationStatus> | null
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error ?? 'Failed to revoke Ajna automation')
      }
      return json.data
    },
    onSuccess: (data) => {
      setAjnaAutomationStatus(data)
    },
  })

  const nextSteps = useMemo<NextStep[]>(() => {
    const steps: NextStep[] = []
    
    if (deployment?.contracts.vault) {
      steps.push({
        icon: <BarChart3 className="w-5 h-5" />,
        title: 'View Your Vault',
        description: 'See your vault details, manage deposits, and track performance.',
        action: {
          label: 'Open Vault',
          to: `/vault/${deployment.contracts.vault}`,
        },
      })
    }
    
    steps.push({
      icon: <Wallet className="w-5 h-5" />,
      title: 'Check Your Portfolio',
      description: 'View all your holdings, wallet addresses, and deployed contracts.',
      action: {
        label: 'View Portfolio',
        to: '/portfolio',
      },
    })
    
    if (deployment?.contracts.ccaStrategy) {
      if (auctionStatusQuery.data?.hasAuction) {
        steps.push({
          icon: <Sparkles className="w-5 h-5" />,
          title: 'CCA Auction Started',
          description: 'Your Creator-Controlled Auction is now live. Share it with your community!',
          action: {
            label: 'View Auction',
            to: `/auction/bid/${deployment.contracts.ccaStrategy}`,
          },
        })
      } else {
        steps.push({
          icon: <Sparkles className="w-5 h-5" />,
          title: 'CCA Auction Pending',
          description: 'Auction launch is not confirmed on-chain yet. Finish deployment before sharing auction links.',
          action: {
            label: 'View CCA Strategy',
            href: `https://basescan.org/address/${deployment.contracts.ccaStrategy}`,
          },
        })
      }
    }
    
    return steps
  }, [auctionStatusQuery.data?.hasAuction, deployment])

  const deployedAt = deployment?.deployedAt
    ? new Date(deployment.deployedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null

  if (!deployment) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8 text-center">
        <div className="text-zinc-500">No deployment record found.</div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Success Header */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4"
        >
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </motion.div>
        <h2 className="text-xl font-medium text-white mb-2">Deployment Complete!</h2>
        <p className="text-sm text-zinc-400 max-w-md mx-auto">
          Your 4626 contracts have been successfully deployed on Base.
          {shareSymbol && ` Your share token is ${shareSymbol}.`}
        </p>
        {deployedAt && (
          <div className="mt-3 text-[11px] text-zinc-500">
            Deployed: {deployedAt}
          </div>
        )}
      </div>

      {deployment.contracts.vault ? (
        <AjnaAutomationOptInCard
          vaultAddress={deployment.contracts.vault}
          canonicalCswAddress={canonicalCswAddress ?? null}
          embeddedEoaAddress={embeddedEoaAddress ?? null}
          privyWalletId={privyWalletId ?? null}
          status={ajnaAutomationStatus}
          isSubmitting={ajnaAutomationEnableMutation.isPending}
          isRevoking={ajnaAutomationRevokeMutation.isPending}
          showVaultInput={false}
          errorMessage={
            ((ajnaAutomationEnableMutation.error as Error | null)?.message ??
              (ajnaAutomationRevokeMutation.error as Error | null)?.message ??
              null)
          }
          onEnable={(payload) => {
            void ajnaAutomationEnableMutation.mutateAsync(payload)
          }}
          onRevoke={(vaultAddress) => {
            void ajnaAutomationRevokeMutation.mutateAsync(vaultAddress)
          }}
        />
      ) : null}

      {/* Deployed Contracts */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Deployed Contracts</div>
          <div className="text-sm text-white mt-1">Version {deployment.version}</div>
        </div>
        <div className="p-4 space-y-4">
          {/* Core Contracts */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600 mb-2">Core (Phase 1)</div>
            <div className="space-y-2 rounded-lg border border-white/5 bg-black/20 p-3">
              <AddressRow label="Vault" address={deployment.contracts.vault} highlight />
              <AddressRow label="Wrapper" address={deployment.contracts.wrapper} />
              <AddressRow label="Share Token" address={deployment.contracts.shareOFT} highlight />
            </div>
          </div>

          {/* Infrastructure */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600 mb-2">Infrastructure (Phase 2)</div>
            <div className="space-y-2 rounded-lg border border-white/5 bg-black/20 p-3">
              <AddressRow label="Gauge Controller" address={deployment.contracts.gaugeController} />
              <AddressRow label="CCA Strategy" address={deployment.contracts.ccaStrategy} />
              <AddressRow label="Burn Stream" address={deployment.contracts.burnStream} />
              <AddressRow label="Payout Router" address={deployment.contracts.payoutRouter} />
              {deployment.contracts.oracle && (
                <AddressRow label="Oracle" address={deployment.contracts.oracle} />
              )}
            </div>
          </div>

          {/* Transaction Hashes */}
          {deployment.txHashes && Object.values(deployment.txHashes).some(Boolean) && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600 mb-2">Transactions</div>
              <div className="space-y-2 rounded-lg border border-white/5 bg-black/20 p-3">
                {deployment.txHashes.phase1 && <TxRow label="Phase 1" txHash={deployment.txHashes.phase1} />}
                {deployment.txHashes.phase2 && <TxRow label="Phase 2" txHash={deployment.txHashes.phase2} />}
                {deployment.txHashes.phase3 && <TxRow label="Phase 3" txHash={deployment.txHashes.phase3} />}
                {deployment.txHashes.phase4 && <TxRow label="Phase 4" txHash={deployment.txHashes.phase4} />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Next Steps */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Next Steps</div>
        </div>
        <div className="p-4 space-y-3">
          {nextSteps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="rounded-xl border border-white/5 bg-black/20 p-4"
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400">
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{step.title}</div>
                  <div className="text-[12px] text-zinc-500 mt-0.5">{step.description}</div>
                  {step.action && (
                    <div className="mt-3">
                      {step.action.to ? (
                        <Link
                          to={step.action.to}
                          className="inline-flex items-center gap-1.5 text-[12px] text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          {step.action.label}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : step.action.href ? (
                        <a
                          href={step.action.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[12px] text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          {step.action.label}
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Already Deployed Notice */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 text-amber-400 mt-0.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-[12px] text-amber-200">You've already deployed for this version</div>
            <div className="text-[11px] text-amber-200/60 mt-1">
              Each wallet can only deploy once per deployment version ({deployment.version}). 
              This ensures fair access for all creators.
            </div>
          </div>
        </div>
      </div>

      {/* Primary CTAs */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to={`/vault/${deployment.contracts.vault}`}
          className="btn-accent rounded-xl py-3 text-center text-sm font-medium"
        >
          View Your Vault
        </Link>
        <Link
          to="/portfolio"
          className="btn-secondary rounded-xl py-3 text-center text-sm font-medium"
        >
          Go to Portfolio
        </Link>
      </div>
    </motion.div>
  )
}

/**
 * Simpler "already deployed" banner for use at the top of the deploy page
 */
export function AlreadyDeployedBanner({ deployment, tokenSymbol }: { deployment: DeploymentRecord; tokenSymbol?: string }) {
  const deployedAt = deployment.deployedAt
    ? new Date(deployment.deployedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium text-white">You've Already Deployed</h3>
          <p className="text-sm text-zinc-400 mt-1">
            Your 4626 deployment{tokenSymbol ? ` for ${tokenSymbol}` : ''} was deployed on {deployedAt || 'an earlier date'}.
            Each wallet can only deploy once per version ({deployment.version}).
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to={`/vault/${deployment.contracts.vault}`}
              className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              View Your Vault
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/portfolio"
              className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
            >
              Go to Portfolio
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
