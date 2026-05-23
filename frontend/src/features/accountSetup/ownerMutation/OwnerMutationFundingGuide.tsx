import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublicClient } from 'wagmi'
import { base } from 'viem/chains'
import { getAddress, type Address } from 'viem'

import { Button } from '@/components/ui/Button'
import { buildWaitlistSetupPath } from '@/lib/auth/waitlistEntry'
import {
  formatRelayDepositEth,
  resolveRelayFundingShortfall,
  type RelayPreviewShape,
} from '@/lib/relay/ownerMutationPreviewHelpers'

type OwnerMutationFundingGuideProps = {
  preview: RelayPreviewShape
  fundingCswAddress?: `0x${string}` | string | null
  isSelfAuthSession?: boolean
  onRebuildPreview?: () => void
  previewLoading?: boolean
}

export function OwnerMutationFundingGuide(props: OwnerMutationFundingGuideProps) {
  const {
    preview,
    fundingCswAddress,
    isSelfAuthSession = false,
    onRebuildPreview,
    previewLoading = false,
  } = props
  const shortfall = resolveRelayFundingShortfall(preview)
  const [copied, setCopied] = useState(false)
  const [liveBalanceWei, setLiveBalanceWei] = useState<bigint | null>(null)
  const [liveBalanceError, setLiveBalanceError] = useState<string | null>(null)
  const publicClient = usePublicClient({ chainId: base.id })

  const cswAddress = useMemo(() => {
    const fromProp = typeof fundingCswAddress === 'string' ? fundingCswAddress.trim() : null
    if (fromProp && /^0x[a-fA-F0-9]{40}$/.test(fromProp)) return getAddress(fromProp) as Address
    return shortfall?.funderAddress ?? null
  }, [fundingCswAddress, shortfall?.funderAddress])

  const refreshLiveBalance = useCallback(async () => {
    if (!cswAddress || !publicClient) return
    setLiveBalanceError(null)
    try {
      const balance = await publicClient.getBalance({ address: cswAddress })
      setLiveBalanceWei(balance)
    } catch (err) {
      setLiveBalanceError(err instanceof Error ? err.message : 'Could not read live balance.')
    }
  }, [cswAddress, publicClient])

  useEffect(() => {
    void refreshLiveBalance()
    const timer = window.setInterval(() => void refreshLiveBalance(), 12_000)
    return () => window.clearInterval(timer)
  }, [refreshLiveBalance])

  const previewBalanceStale =
    shortfall !== null &&
    liveBalanceWei !== null &&
    liveBalanceWei > shortfall.balanceWei

  const liveBalanceCoversDeposit =
    shortfall !== null && liveBalanceWei !== null && liveBalanceWei >= shortfall.depositWei

  const autoRebuildAttemptedRef = useRef(false)

  useEffect(() => {
    autoRebuildAttemptedRef.current = false
  }, [shortfall?.balanceWei, shortfall?.depositWei])

  useEffect(() => {
    if (!liveBalanceCoversDeposit || previewLoading || !onRebuildPreview) return
    if (autoRebuildAttemptedRef.current) return
    autoRebuildAttemptedRef.current = true
    onRebuildPreview()
  }, [liveBalanceCoversDeposit, onRebuildPreview, previewLoading])

  const cswFundingUrl = useMemo(() => {
    if (!shortfall) return '/csw-funding'
    const params = new URLSearchParams()
    params.set('amount', formatRelayDepositEth(shortfall.shortfallWei))
    params.set('return', buildWaitlistSetupPath('owner-install'))
    params.set('mode', 'native')
    return `/csw-funding?${params.toString()}`
  }, [shortfall])

  const copyAddress = useCallback(async () => {
    if (!cswAddress || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return
    await navigator.clipboard.writeText(cswAddress)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }, [cswAddress])

  if (!shortfall) return null

  return (
    <div
      className="rounded-xl border border-brand-primary/25 bg-brand-primary/10 p-4 text-xs text-brand-50 space-y-3"
      data-testid="owner-mutation-funding-guide"
    >
      {liveBalanceCoversDeposit ? (
        <div
          className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 p-3 text-emerald-50 space-y-2"
          data-testid="owner-mutation-funding-detected"
        >
          <p className="leading-relaxed">
            Funding is on-chain (
            <span className="font-mono">{formatRelayDepositEth(liveBalanceWei ?? 0n)} ETH</span>
            ). The amber error is from an older preview snapshot (
            <span className="font-mono">{formatRelayDepositEth(shortfall.balanceWei)} ETH</span>
            ). {previewLoading ? 'Refreshing preview…' : 'Rebuilding preview now…'}
          </p>
          {onRebuildPreview && !previewLoading ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onRebuildPreview}
            >
              Rebuild Relay preview again
            </Button>
          ) : null}
        </div>
      ) : null}

      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-brand-100/80">Fund your smart wallet</div>
        <p className="mt-1 leading-relaxed text-brand-50/95">
          Relay Part 1 pulls the deposit from your CSW&apos;s <span className="font-medium">native ETH</span>{' '}
          balance on Base. Send the shortfall below, wait for the transfer to confirm, then rebuild the preview.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/25 p-2.5">
          <dt className="text-[10px] uppercase tracking-[0.16em] text-brand-100/70">
            {previewBalanceStale ? 'Preview snapshot balance' : 'Current native balance'}
          </dt>
          <dd className="mt-0.5 font-mono text-brand-50">{formatRelayDepositEth(shortfall.balanceWei)} ETH</dd>
          {previewBalanceStale && liveBalanceWei !== null ? (
            <dd className="mt-1 font-mono text-emerald-200">
              Live on Base: {formatRelayDepositEth(liveBalanceWei)} ETH
            </dd>
          ) : null}
        </div>
        <div className="rounded-lg border border-white/10 bg-black/25 p-2.5">
          <dt className="text-[10px] uppercase tracking-[0.16em] text-brand-100/70">Relay deposit required</dt>
          <dd className="mt-0.5 font-mono text-brand-50">{formatRelayDepositEth(shortfall.depositWei)} ETH</dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/25 p-2.5">
          <dt className="text-[10px] uppercase tracking-[0.16em] text-brand-100/70">Gas buffer (recommended)</dt>
          <dd className="mt-0.5 font-mono text-brand-50">{formatRelayDepositEth(shortfall.gasBufferWei)} ETH</dd>
        </div>
        <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-2.5">
          <dt className="text-[10px] uppercase tracking-[0.16em] text-emerald-100/80">Send at least</dt>
          <dd className="mt-0.5 font-mono text-emerald-50">
            {formatRelayDepositEth(shortfall.shortfallWei)} ETH
            <span className="ml-1 text-emerald-100/70">on Base</span>
          </dd>
        </div>
      </dl>

      {cswAddress ? (
        <div className="rounded-lg border border-white/10 bg-black/25 p-2.5 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-brand-100/70">Receive address (canonical CSW)</div>
          <div className="break-all font-mono text-[11px] text-brand-50">{cswAddress}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => void copyAddress()}>
              {copied ? 'Copied' : 'Copy address'}
            </Button>
            <Button type="button" variant="primary" size="sm" asChild>
              <Link to={cswFundingUrl}>Open funding page</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {isSelfAuthSession ? (
        <p className="text-[11px] leading-relaxed text-brand-100/80">
          In Base App or Coinbase Wallet: open your smart wallet, choose <span className="font-medium">Send / Receive</span>,
          and deposit ETH on <span className="font-medium">Base</span> to the address above. You can also send from Rabby,
          MetaMask, or an exchange withdrawal — network must be Base mainnet.
        </p>
      ) : (
        <p className="text-[11px] leading-relaxed text-brand-100/80">
          Send native ETH on Base from any wallet you control to the CSW address above, or use the funding page if a
          connected wallet can pay the transfer for you.
        </p>
      )}

      {liveBalanceError ? (
        <p className="text-[11px] text-amber-100/90">{liveBalanceError}</p>
      ) : null}
    </div>
  )
}
