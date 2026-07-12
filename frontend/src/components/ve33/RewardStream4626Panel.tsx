/**
 * RewardStream4626 partner campaign MVP — fund current-epoch bags and claim finalized epochs.
 * Parallel to BribeDepot4626Panel; requires owner-allowlisted reward tokens on the stream.
 */
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { formatUnits, isAddress, parseUnits, type Address } from 'viem'
import { useRewardStream4626 } from '@/hooks/useRewardStream4626'
import { shortAddress } from '@/lib/governance/bribePreview'
import { logger } from '@/lib/observability/logger'
import { CONTRACTS } from '@/config/contracts'

/** Auto-dismiss success toast after this many ms. */
const TX_SUCCESS_TOAST_MS = 4_000

export interface StreamVaultOption {
  address: string
  name: string
}

interface RewardStream4626PanelProps {
  vaults?: StreamVaultOption[]
  className?: string
  defaultToken?: string
}

export function RewardStream4626Panel({
  vaults = [],
  className = '',
  defaultToken = '',
}: RewardStream4626PanelProps) {
  const factoryAddress = CONTRACTS.rewardStreamFactory4626
  const votingAddress = CONTRACTS.ve4626GaugeVoting

  const [selectedVault, setSelectedVault] = useState(vaults[0]?.address ?? '')
  const [tokenInput, setTokenInput] = useState(defaultToken)
  const [amountInput, setAmountInput] = useState('')
  const [claimEpochInput, setClaimEpochInput] = useState('')
  const [tab, setTab] = useState<'fund' | 'claim'>('claim')
  const [showSuccessToast, setShowSuccessToast] = useState(false)

  const token = useMemo(() => {
    const t = tokenInput.trim()
    return isAddress(t) ? (t as Address) : undefined
  }, [tokenInput])

  const vault = useMemo(() => {
    const v = selectedVault.trim()
    return isAddress(v) ? (v as Address) : undefined
  }, [selectedVault])

  const claimEpochOverride = useMemo(() => {
    if (claimEpochInput.trim() === '') return undefined
    const n = Number(claimEpochInput)
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
  }, [claimEpochInput])

  const {
    stream,
    currentEpoch,
    claimEpoch,
    canReceiveStreams,
    isRewardToken,
    currentEpochBag,
    epochBag,
    hasClaimed,
    claimPreview,
    tokenDecimals,
    tokenSymbol,
    tokenAllowance,
    tokenBalance,
    ensureStream,
    approveToken,
    fundStream,
    claimStream,
    isPending,
    txSuccess,
    pendingTxHash,
  } = useRewardStream4626({
    factoryAddress,
    vault,
    token,
    claimEpoch: claimEpochOverride,
    votingAddress,
  })

  // Show success toast briefly on confirmed write; hide when a new write starts.
  useEffect(() => {
    if (isPending) {
      setShowSuccessToast(false)
      return
    }
    if (!txSuccess || !pendingTxHash) return
    setShowSuccessToast(true)
    const t = window.setTimeout(() => setShowSuccessToast(false), TX_SUCCESS_TOAST_MS)
    return () => window.clearTimeout(t)
  }, [txSuccess, pendingTxHash, isPending])

  const amountWei = useMemo(() => {
    try {
      if (!amountInput.trim()) return 0n
      return parseUnits(amountInput.trim(), tokenDecimals)
    } catch {
      return 0n
    }
  }, [amountInput, tokenDecimals])

  const needsApproval = stream && amountWei > 0n && tokenAllowance < amountWei

  if (!factoryAddress || !votingAddress) {
    return (
      <div className={`bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 ${className}`}>
        <h3 className="text-xl font-bold text-brand-primary mb-4">Partner reward streams</h3>
        <div className="text-center py-8">
          <div className="text-zinc-500 mb-2">Coming Soon</div>
          <p className="text-sm text-zinc-400">
            Multi-token partner campaigns for vault voters. Claim pro-rata after each epoch ends.
          </p>
        </div>
      </div>
    )
  }

  const handleEnsure = () => {
    try {
      ensureStream()
    } catch (err) {
      logger.error('ensureStream failed', err)
    }
  }

  const handleApprove = () => {
    try {
      approveToken()
    } catch (err) {
      logger.error('approve failed', err)
    }
  }

  const handleFund = () => {
    try {
      fundStream(amountWei)
    } catch (err) {
      logger.error('stream fund failed', err)
    }
  }

  const handleClaim = () => {
    if (claimEpoch === undefined || !token) return
    try {
      claimStream(claimEpoch, token)
    } catch (err) {
      logger.error('stream claim failed', err)
    }
  }

  return (
    <div className={`bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden ${className}`}>
      <div className="bg-linear-to-r from-brand-primary/10 to-zinc-800/40 border-b border-zinc-800 p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-xl font-bold text-brand-primary">Partner reward streams</h3>
            <p className="text-sm text-zinc-400 mt-1">
              Allowlisted ERC-20 campaigns · claim after epoch finalizes
            </p>
          </div>
          {currentEpoch !== undefined && (
            <div className="text-right">
              <div className="text-sm text-zinc-500">Current epoch</div>
              <div className="text-lg font-mono text-brand-primary">{currentEpoch}</div>
            </div>
          )}
        </div>
      </div>

      <div className="flex border-b border-zinc-800">
        {(['claim', 'fund'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === t
                ? 'text-brand-primary border-b-2 border-brand-primary bg-zinc-900/40'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'claim' ? 'Claim' : 'Fund campaign'}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-4">
        <label className="block">
          <span className="text-sm text-zinc-400 mb-1 block">Vault (gauge)</span>
          {vaults.length > 0 ? (
            <select
              value={selectedVault}
              onChange={(e) => setSelectedVault(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:border-brand-primary focus:outline-none"
            >
              {vaults.map((v) => (
                <option key={v.address} value={v.address}>
                  {v.name} ({shortAddress(v.address)})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={selectedVault}
              onChange={(e) => setSelectedVault(e.target.value)}
              placeholder="0x… vault address"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 font-mono text-sm text-white focus:border-brand-primary focus:outline-none"
            />
          )}
        </label>

        <label className="block">
          <span className="text-sm text-zinc-400 mb-1 block">
            Reward token{tokenSymbol ? ` (${tokenSymbol})` : ''}
          </span>
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="0x… ERC-20"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 font-mono text-sm text-white focus:border-brand-primary focus:outline-none"
          />
        </label>

        {vault && (
          <div className="text-xs text-zinc-500 flex flex-wrap gap-3">
            <span>
              Stream:{' '}
              <span className="font-mono text-zinc-400">
                {stream ? shortAddress(stream) : 'not created'}
              </span>
            </span>
            <span>
              Stream-eligible:{' '}
              <span className={canReceiveStreams ? 'text-green-400' : 'text-amber-400'}>
                {canReceiveStreams ? 'yes' : 'no'}
              </span>
            </span>
            {stream && token && (
              <span>
                Allowlisted:{' '}
                <span className={isRewardToken ? 'text-green-400' : 'text-amber-400'}>
                  {isRewardToken ? 'yes' : 'no (owner must addRewardToken)'}
                </span>
              </span>
            )}
          </div>
        )}

        {tab === 'fund' && (
          <>
            <label className="block">
              <span className="text-sm text-zinc-400 mb-1 block">Amount</span>
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.0"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 font-mono text-white focus:border-brand-primary focus:outline-none"
              />
              {token && (
                <div className="mt-1 text-xs text-zinc-500">
                  Balance: {formatUnits(tokenBalance ?? 0n, tokenDecimals ?? 18)}
                  {tokenSymbol ? ` ${tokenSymbol}` : ''}
                  {stream && currentEpoch !== undefined && (
                    <>
                      {' · '}
                      Epoch bag: {formatUnits(currentEpochBag ?? 0n, tokenDecimals ?? 18)}
                    </>
                  )}
                </div>
              )}
            </label>

            <div className="flex flex-col sm:flex-row gap-3">
              {!stream && (
                <button
                  type="button"
                  onClick={handleEnsure}
                  disabled={isPending || !vault || !canReceiveStreams}
                  className="flex-1 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-all disabled:cursor-not-allowed"
                >
                  {isPending ? 'Confirm in wallet…' : 'Create reward stream'}
                </button>
              )}
              {stream && needsApproval && (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isPending || amountWei <= 0n || !isRewardToken}
                  className="flex-1 bg-amber-600/80 hover:bg-amber-600 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-all disabled:cursor-not-allowed"
                >
                  {isPending ? 'Confirm in wallet…' : 'Approve token'}
                </button>
              )}
              {stream && !needsApproval && (
                <button
                  type="button"
                  onClick={handleFund}
                  disabled={
                    isPending ||
                    amountWei <= 0n ||
                    !token ||
                    !canReceiveStreams ||
                    !isRewardToken ||
                    amountWei > tokenBalance
                  }
                  className="flex-1 bg-linear-to-r from-brand-primary to-brand-accent hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:cursor-not-allowed"
                >
                  {isPending ? 'Funding…' : 'Fund stream'}
                </button>
              )}
            </div>
          </>
        )}

        {tab === 'claim' && (
          <>
            <label className="block">
              <span className="text-sm text-zinc-400 mb-1 block">
                Epoch to claim
                {claimEpoch !== undefined ? ` (using ${claimEpoch})` : ''}
              </span>
              <input
                type="number"
                min={0}
                value={claimEpochInput}
                onChange={(e) => setClaimEpochInput(e.target.value)}
                placeholder={
                  currentEpoch !== undefined && currentEpoch > 0
                    ? String(currentEpoch - 1)
                    : 'past epoch #'
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 font-mono text-white focus:border-brand-primary focus:outline-none"
              />
            </label>

            <div className="bg-zinc-800/50 rounded-xl p-4 text-sm space-y-2">
              <div className="flex justify-between text-zinc-400">
                <span>Epoch bag</span>
                <span className="font-mono text-zinc-200">
                  {formatUnits(epochBag ?? 0n, tokenDecimals ?? 18)}
                  {tokenSymbol ? ` ${tokenSymbol}` : ''}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Your claim</span>
                <span className="font-mono text-brand-primary">
                  {hasClaimed
                    ? 'already claimed'
                    : `${formatUnits(claimPreview ?? 0n, tokenDecimals ?? 18)}${tokenSymbol ? ` ${tokenSymbol}` : ''}`}
                </span>
              </div>
            </div>

            {!stream && (
              <button
                type="button"
                onClick={handleEnsure}
                disabled={isPending || !vault || !canReceiveStreams}
                className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl"
              >
                Create stream (if missing)
              </button>
            )}

            <button
              type="button"
              onClick={handleClaim}
              disabled={
                isPending ||
                !stream ||
                !token ||
                claimEpoch === undefined ||
                hasClaimed ||
                claimPreview === 0n
              }
              className="w-full bg-linear-to-r from-brand-primary to-brand-accent hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:cursor-not-allowed"
            >
              {isPending ? 'Claiming…' : 'Claim rewards'}
            </button>
          </>
        )}
      </div>

      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            key={pendingTxHash ?? 'tx-success'}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg z-50"
            role="status"
          >
            ✓ Transaction confirmed
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default RewardStream4626Panel
