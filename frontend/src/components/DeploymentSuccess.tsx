import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { Address } from 'viem'
import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { ExternalLink, CheckCircle2, ArrowRight, Wallet, BarChart3, Sparkles } from 'lucide-react'
import type { DeploymentRecord } from '@/hooks/useDeploymentTracker'

const shortAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
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

export interface DeploymentSuccessProps {
  /** The deployment record */
  deployment: DeploymentRecord | null
  /** Token symbol for display */
  tokenSymbol?: string
  /** Share symbol for display */
  shareSymbol?: string
  /** Callback when user wants to view another deployment */
  onNewDeploy?: () => void
}

export function DeploymentSuccess({ deployment, shareSymbol }: DeploymentSuccessProps) {
  const publicClient = usePublicClient({ chainId: 8453 })
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
          Your CreatorVault contracts have been successfully deployed on Base.
          {shareSymbol && ` Your share token is ${shareSymbol}.`}
        </p>
        {deployedAt && (
          <div className="mt-3 text-[11px] text-zinc-500">
            Deployed: {deployedAt}
          </div>
        )}
      </div>

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
            Your CreatorVault{tokenSymbol ? ` for ${tokenSymbol}` : ''} was deployed on {deployedAt || 'an earlier date'}.
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
