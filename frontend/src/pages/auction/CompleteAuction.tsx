import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { formatUnits } from 'viem'
import {
  CheckCircle2,
  AlertCircle,
  PartyPopper,
  Zap,
  Trophy,
  ArrowRight,
  ExternalLink,
  Clock,
  Target,
  Flame,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CONTRACTS, AKITA } from '@/config/contracts'
import { resolveCreatorTradeTokenAddress } from '@/lib/onchain/vaultResolve'
import { Spinner } from '@/components/ui/Spinner'

// CCA Strategy ABI
const CCA_STRATEGY_ABI = [
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
  {
    name: 'getLifecycleStatus',
    type: 'function',
    inputs: [],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'phase', type: 'uint8' },
          { name: 'auction', type: 'address' },
          { name: 'isGraduated', type: 'bool' },
          { name: 'auctionWindowOpen', type: 'bool' },
          { name: 'claimOpen', type: 'bool' },
          { name: 'currencySwept', type: 'bool' },
          { name: 'unsoldSwept', type: 'bool' },
          { name: 'migrated', type: 'bool' },
          { name: 'failedFinalized', type: 'bool' },
          { name: 'startBlock', type: 'uint64' },
          { name: 'endBlock', type: 'uint64' },
          { name: 'claimBlock', type: 'uint64' },
          { name: 'migrationBlock', type: 'uint64' },
          { name: 'sweepBlock', type: 'uint64' },
          { name: 'lpReserveAmount', type: 'uint256' },
          { name: 'clearingPrice', type: 'uint256' },
          { name: 'currencyRaised', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'sweepCurrency',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'migrate',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'sweepUnsoldTokens',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getTaxHookCalldata',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'target', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getCompleteAuctionCalldata',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'calldatas', type: 'bytes[]' },
    ],
    stateMutability: 'view',
  },
  { name: 'auctionToken', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { name: 'fundsRecipient', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { name: 'feeRecipient', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { name: 'taxRateBps', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const

// Tax Hook ABI (for direct calls)
const TAX_HOOK_ABI = [
  {
    name: 'setTaxConfig',
    type: 'function',
    inputs: [
      { name: 'token_', type: 'address' },
      { name: 'counterAsset_', type: 'address' },
      { name: 'recipient_', type: 'address' },
      { name: 'taxRate_', type: 'uint256' },
      { name: 'counterIsEth', type: 'bool' },
      { name: 'enabled_', type: 'bool' },
      { name: 'lock_', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

type Step = 'check' | 'sweep' | 'migrate' | 'configure' | 'complete'

const VAULT_ABI = [
  { name: 'deployToStrategies', type: 'function', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { name: 'emergencyWithdrawFromStrategies', type: 'function', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { name: 'owner', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
] as const

const ZERO_ADDRESS = `0x${'0000000000000000000000000000000000000000'}` as const

export function CompleteAuction() {
  const { strategy } = useParams()
  const navigate = useNavigate()
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const [currentStep, setCurrentStep] = useState<Step>('check')
  const [error, setError] = useState<string | null>(null)

  // Default to AKITA CCA strategy if not provided
  const strategyAddress = (strategy || AKITA.ccaStrategy) as `0x${string}`

  // Read auction status
  const { data: auctionStatus } = useReadContract({
    address: strategyAddress,
    abi: CCA_STRATEGY_ABI,
    functionName: 'getAuctionStatus',
  })
  const { data: lifecycleStatus } = useReadContract({
    address: strategyAddress,
    abi: CCA_STRATEGY_ABI,
    functionName: 'getLifecycleStatus',
  })

  // Read token address
  const { data: tokenAddress } = useReadContract({
    address: strategyAddress,
    abi: CCA_STRATEGY_ABI,
    functionName: 'auctionToken',
  })

  // Read funds recipient (vault)
  const { data: fundsRecipient } = useReadContract({
    address: strategyAddress,
    abi: CCA_STRATEGY_ABI,
    functionName: 'fundsRecipient',
  })
  const vaultAddress = (fundsRecipient && typeof fundsRecipient === 'string' ? fundsRecipient : null) as
    | `0x${string}`
    | null
  const tradeTokenSourceAddress =
    vaultAddress ??
    ((tokenAddress && typeof tokenAddress === 'string' ? tokenAddress : null) as `0x${string}` | null)
  const tradeTokenQuery = useQuery({
    queryKey: ['complete-auction', 'trade-token', tradeTokenSourceAddress ?? ''],
    enabled: Boolean(publicClient && tradeTokenSourceAddress),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    queryFn: async () => {
      if (!publicClient || !tradeTokenSourceAddress) return null
      return await resolveCreatorTradeTokenAddress(publicClient as any, tradeTokenSourceAddress)
    },
  })
  const tradeTokenAddress =
    tradeTokenQuery.data ??
    ((tradeTokenQuery.isFetched || tradeTokenQuery.isError || !publicClient) ? tradeTokenSourceAddress : null)

  const { data: vaultOwner } = useReadContract({
    address: (vaultAddress ?? ZERO_ADDRESS) as `0x${string}`,
    abi: VAULT_ABI,
    functionName: 'owner',
    query: { enabled: !!vaultAddress },
  })
  const canActivateYield =
    !!vaultAddress &&
    !!address &&
    !!vaultOwner &&
    address.toLowerCase() === String(vaultOwner).toLowerCase()

  // Read fee recipient (GaugeController)
  const { data: feeRecipient } = useReadContract({
    address: strategyAddress,
    abi: CCA_STRATEGY_ABI,
    functionName: 'feeRecipient',
  })

  // Read tax rate
  const { data: taxRate } = useReadContract({
    address: strategyAddress,
    abi: CCA_STRATEGY_ABI,
    functionName: 'taxRateBps',
  })

  // Step 1: Sweep Currency (moves raised funds into strategy)
  const {
    writeContract: sweepCurrency,
    data: sweepTxHash,
    isPending: isSweeping,
    error: sweepError,
  } = useWriteContract()
  const { isLoading: isSweepConfirming, isSuccess: isSweepSuccess } = useWaitForTransactionReceipt({
    hash: sweepTxHash,
  })

  // Step 2: Migrate to Uniswap v4 LP
  const {
    writeContract: migrateAuction,
    data: migrateTxHash,
    isPending: isMigrating,
    error: migrateError,
  } = useWriteContract()
  const { isLoading: isMigrateConfirming, isSuccess: isMigrateSuccess } = useWaitForTransactionReceipt({
    hash: migrateTxHash,
  })

  // Step 3: Configure Tax Hook (6.9% fee)
  const {
    writeContract: configureTaxHook,
    data: configTxHash,
    isPending: isConfiguring,
    error: configError,
  } = useWriteContract()
  const { isLoading: isConfigConfirming, isSuccess: isConfigSuccess } = useWaitForTransactionReceipt({
    hash: configTxHash,
  })

  // Failed-auction recovery: return unsold creator tokens to the configured recipient.
  const {
    writeContract: sweepUnsoldTokens,
    data: unsoldTxHash,
    isPending: isUnsoldSweeping,
    error: unsoldSweepError,
  } = useWriteContract()
  const { isLoading: isUnsoldConfirming, isSuccess: isUnsoldSuccess } = useWaitForTransactionReceipt({
    hash: unsoldTxHash,
  })
  const {
    writeContract: sweepStrategyFunds,
    data: strategySweepTxHash,
    isPending: isStrategySweeping,
    error: strategySweepError,
  } = useWriteContract()
  const { isLoading: isStrategySweepConfirming, isSuccess: isStrategySweepSuccess } = useWaitForTransactionReceipt({
    hash: strategySweepTxHash,
  })

  // Optional Step: Activate yield (deploy idle funds to strategies)
  const {
    writeContract: activateYield,
    data: activateTxHash,
    isPending: isActivating,
    error: activateError,
  } = useWriteContract()
  const { isLoading: isActivateConfirming, isSuccess: isActivateSuccess } = useWaitForTransactionReceipt({
    hash: activateTxHash,
  })

  const hasAuction = Boolean(auctionStatus?.[0] && auctionStatus?.[0] !== ZERO_ADDRESS)
  const isActive = Boolean(auctionStatus?.[1])
  const isGraduated = Boolean(auctionStatus?.[2])
  const lifecyclePhase = Number((lifecycleStatus as any)?.phase ?? (lifecycleStatus as any)?.[0] ?? -1)
  const lifecycleFailedFinalized = Boolean((lifecycleStatus as any)?.failedFinalized ?? (lifecycleStatus as any)?.[8] ?? false)
  const hasLifecycle = lifecyclePhase >= 0
  const isFailed = hasLifecycle ? lifecyclePhase === 6 || lifecycleFailedFinalized : hasAuction && !isActive && !isGraduated
  const currencyRaised = auctionStatus?.[4]
  const failedRecoveryComplete = isUnsoldSuccess && isStrategySweepSuccess

  // Update step based on transaction status
  useEffect(() => {
    if (isFailed) {
      if (failedRecoveryComplete) {
        setCurrentStep('complete')
      }
      return
    }
    if (isSweepSuccess && !isMigrateSuccess) {
      setCurrentStep('migrate')
    } else if (isMigrateSuccess && !isConfigSuccess) {
      setCurrentStep('configure')
    } else if (isConfigSuccess) {
      setCurrentStep('complete')
    }
  }, [isFailed, failedRecoveryComplete, isSweepSuccess, isMigrateSuccess, isConfigSuccess])

  const handleSweepCurrency = () => {
    setError(null)
    sweepCurrency({
      address: strategyAddress,
      abi: CCA_STRATEGY_ABI,
      functionName: 'sweepCurrency',
    })
  }

  const handleMigrate = () => {
    setError(null)
    migrateAuction({
      address: strategyAddress,
      abi: CCA_STRATEGY_ABI,
      functionName: 'migrate',
    })
  }

  const handleConfigureTaxHook = () => {
    if (!tokenAddress || !feeRecipient) {
      setError('Missing token or fee recipient address')
      return
    }
    setError(null)

    configureTaxHook({
      address: CONTRACTS.taxHook as `0x${string}`,
      abi: TAX_HOOK_ABI,
      functionName: 'setTaxConfig',
      args: [
        tokenAddress,           // ■TOKEN address
        ZERO_ADDRESS as `0x${string}`, // ETH
        feeRecipient,           // GaugeController
        taxRate || 690n,        // 6.9%
        true,                   // counterIsEth
        true,                   // enabled
        false,                  // not locked
      ],
    })
  }

  const handleSweepUnsoldTokens = () => {
    setError(null)
    sweepUnsoldTokens({
      address: strategyAddress,
      abi: CCA_STRATEGY_ABI,
      functionName: 'sweepUnsoldTokens',
    })
  }

  const handleSweepStrategyFunds = () => {
    if (!vaultAddress) {
      setError('Missing vault address')
      return
    }
    setError(null)
    sweepStrategyFunds({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'emergencyWithdrawFromStrategies',
    })
  }

  const handleActivateYield = () => {
    if (!vaultAddress) {
      setError('Missing vault address')
      return
    }
    setError(null)
    activateYield({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'deployToStrategies',
    })
  }

  const formatEth = (value: bigint | undefined) => {
    if (!value) return '0'
    return Number(formatUnits(value, 18)).toFixed(4)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-500 text-sm font-medium">
          <PartyPopper className="w-4 h-4" />
          {isFailed ? 'Auction Recovery' : 'Click 2: Complete Auction'}
        </div>
        <h1 className="font-display text-3xl font-bold">Finalize Your Vault</h1>
        <p className="text-surface-400">
          {isFailed
            ? 'This auction did not graduate. Recover unsold auction tokens and pull strategy-deployed creator tokens back to the vault.'
            : 'Your CCA has graduated! Complete the setup to enable trading.'}
        </p>
      </motion.div>

      {/* Auction Status Card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-brand-500" />
          Auction Status
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-surface-900/50">
            <p className="text-xs text-surface-500 uppercase tracking-wider mb-1">Status</p>
            {isGraduated ? (
              <p className="font-semibold text-green-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Graduated
              </p>
            ) : isFailed ? (
              <p className="font-semibold text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Failed
              </p>
            ) : isActive ? (
              <p className="font-semibold text-yellow-400 flex items-center gap-2">
                <Clock className="w-4 h-4" /> In Progress
              </p>
            ) : (
              <p className="font-semibold text-surface-400">Not Started</p>
            )}
          </div>
          <div className="p-4 rounded-xl bg-surface-900/50">
            <p className="text-xs text-surface-500 uppercase tracking-wider mb-1">ETH Raised</p>
            <p className="font-semibold text-lg">{formatEth(currencyRaised)} ETH</p>
          </div>
        </div>

        {!isGraduated && isActive && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
            <p className="font-medium">⏳ Auction Still Active</p>
            <p className="mt-1 text-amber-300/70">
              Wait for the auction to graduate (reach required raise) before completing.
            </p>
          </div>
        )}
        {isFailed && (
          <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-200 text-sm">
            <p className="font-medium">Auction did not graduate</p>
            <p className="mt-1 text-rose-200/80">
              Raised currency sweep is skipped for failed auctions. Use recovery to pull both unsold auction tokens and strategy-deployed funds.
            </p>
          </div>
        )}
      </motion.div>

      {/* Steps */}
      {(isGraduated || isFailed) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 space-y-6"
        >
          {isFailed ? (
            <>
              <div
                className={`p-4 rounded-xl border ${
                  isUnsoldSuccess
                    ? 'bg-green-500/5 border-green-500/30'
                    : 'bg-rose-500/5 border-rose-500/30'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      isUnsoldSuccess ? 'bg-green-500/20 text-green-400' : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {isUnsoldSweeping || isUnsoldConfirming ? (
                      <Spinner size="md" />
                    ) : isUnsoldSuccess ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="font-bold">1</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Recover Unsold Auction Tokens</h4>
                    <p className="text-surface-400 text-sm mt-1">
                      Sweep unsold creator tokens from the auction contract back to the configured vault recipient.
                    </p>
                    {!isUnsoldSuccess && (
                      <Button
                        onClick={handleSweepUnsoldTokens}
                        disabled={isUnsoldSweeping || isUnsoldConfirming}
                        variant="primary"
                        className="mt-4 flex items-center gap-2"
                      >
                        {isUnsoldSweeping || isUnsoldConfirming ? (
                          <>
                            <Spinner size="sm" />
                            {isUnsoldSweeping ? 'Confirming...' : 'Processing...'}
                          </>
                        ) : (
                          <>
                            Recover Unsold Tokens
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    )}
                    {unsoldTxHash && (
                      <a
                        href={`https://basescan.org/tx/${unsoldTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 mt-2"
                      >
                        View transaction <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  isStrategySweepSuccess
                    ? 'bg-green-500/5 border-green-500/30'
                    : 'bg-rose-500/5 border-rose-500/30'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      isStrategySweepSuccess ? 'bg-green-500/20 text-green-400' : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {isStrategySweeping || isStrategySweepConfirming ? (
                      <Spinner size="md" />
                    ) : isStrategySweepSuccess ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="font-bold">2</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Pull Strategy-Deployed Funds</h4>
                    <p className="text-surface-400 text-sm mt-1">
                      Emergency-withdraw creator tokens from all active vault strategies back into the vault balance.
                    </p>
                    {!isStrategySweepSuccess && (
                      <Button
                        onClick={handleSweepStrategyFunds}
                        disabled={!vaultAddress || isStrategySweeping || isStrategySweepConfirming}
                        variant="primary"
                        className="mt-4 flex items-center gap-2"
                      >
                        {isStrategySweeping || isStrategySweepConfirming ? (
                          <>
                            <Spinner size="sm" />
                            {isStrategySweeping ? 'Confirming...' : 'Processing...'}
                          </>
                        ) : (
                          <>
                            Pull Strategy Funds
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    )}
                    {!vaultAddress ? (
                      <p className="mt-2 text-xs text-amber-300/80">Waiting for vault address...</p>
                    ) : null}
                    {strategySweepTxHash && (
                      <a
                        href={`https://basescan.org/tx/${strategySweepTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 mt-2"
                      >
                        View transaction <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Step 1: Sweep Currency */}
              <div className={`p-4 rounded-xl border ${
                currentStep === 'check' || currentStep === 'sweep'
                  ? 'bg-brand-500/5 border-brand-500/30'
                  : isSweepSuccess
                  ? 'bg-green-500/5 border-green-500/30'
                  : 'bg-surface-900/30 border-surface-800'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    isSweepSuccess
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-brand-500/20 text-brand-400'
                  }`}>
                    {isSweeping || isSweepConfirming ? (
                      <Spinner size="md" />
                    ) : isSweepSuccess ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="font-bold">1</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Complete Auction</h4>
                    <p className="text-surface-400 text-sm mt-1">
                      Sweep raised currency to the strategy before LP migration.
                    </p>
                    {!isSweepSuccess && currentStep !== 'migrate' && currentStep !== 'configure' && currentStep !== 'complete' && (
                      <Button
                        onClick={handleSweepCurrency}
                        disabled={isSweeping || isSweepConfirming}
                        variant="primary"
                        className="mt-4 flex items-center gap-2"
                      >
                        {isSweeping || isSweepConfirming ? (
                          <>
                            <Spinner size="sm" />
                            {isSweeping ? 'Confirming...' : 'Processing...'}
                          </>
                        ) : (
                          <>
                            Sweep Currency
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    )}
                    {sweepTxHash && (
                      <a
                        href={`https://basescan.org/tx/${sweepTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 mt-2"
                      >
                        View transaction <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 2: Migrate Liquidity */}
              <div className={`p-4 rounded-xl border ${
                currentStep === 'migrate'
                  ? 'bg-brand-500/5 border-brand-500/30'
                  : isMigrateSuccess
                  ? 'bg-green-500/5 border-green-500/30'
                  : 'bg-surface-900/30 border-surface-800'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    isMigrateSuccess
                      ? 'bg-green-500/20 text-green-400'
                      : currentStep === 'migrate'
                      ? 'bg-brand-500/20 text-brand-400'
                      : 'bg-surface-800 text-surface-500'
                  }`}>
                    {isMigrating || isMigrateConfirming ? (
                      <Spinner size="md" />
                    ) : isMigrateSuccess ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="font-bold">2</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Migrate to Uniswap v4 LP</h4>
                    <p className="text-surface-400 text-sm mt-1">
                      Initialize the pool and mint the strategy LP position.
                    </p>
                    {currentStep === 'migrate' && !isMigrateSuccess && (
                      <Button
                        onClick={handleMigrate}
                        disabled={isMigrating || isMigrateConfirming}
                        variant="primary"
                        className="mt-4 flex items-center gap-2"
                      >
                        {isMigrating || isMigrateConfirming ? (
                          <>
                            <Spinner size="sm" />
                            {isMigrating ? 'Confirming...' : 'Migrating...'}
                          </>
                        ) : (
                          <>
                            Migrate
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    )}
                    {migrateTxHash && (
                      <a
                        href={`https://basescan.org/tx/${migrateTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 mt-2"
                      >
                        View transaction <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 3: Configure Tax Hook */}
              <div className={`p-4 rounded-xl border ${
                currentStep === 'configure'
                  ? 'bg-brand-500/5 border-brand-500/30'
                  : isConfigSuccess
                  ? 'bg-green-500/5 border-green-500/30'
                  : 'bg-surface-900/30 border-surface-800'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    isConfigSuccess
                      ? 'bg-green-500/20 text-green-400'
                      : currentStep === 'configure'
                      ? 'bg-brand-500/20 text-brand-400'
                      : 'bg-surface-800 text-surface-500'
                  }`}>
                    {isConfiguring || isConfigConfirming ? (
                      <Spinner size="md" />
                    ) : isConfigSuccess ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="font-bold">3</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Configure Hook Fee Plane</h4>
                    <p className="text-surface-400 text-sm mt-1">
                      Configure the V4 hook fee plane and align the recipient to the trade-fee collector.
                    </p>

                    {/* Gauge default split (configurable onchain) */}
                    <div className="flex gap-4 mt-3 text-xs">
                      <span className="flex items-center gap-1 text-yellow-400">
                        <Trophy className="w-3 h-3" /> 69% Jackpot
                      </span>
                      <span className="flex items-center gap-1 text-red-400">
                        <Flame className="w-3 h-3" /> 21.39% Burn
                      </span>
                      <span className="flex items-center gap-1 text-brand-400">
                        <Zap className="w-3 h-3" /> 9.61% Voter/Protocol
                      </span>
                    </div>

                    {currentStep === 'configure' && !isConfigSuccess && (
                      <Button
                        onClick={handleConfigureTaxHook}
                        disabled={isConfiguring || isConfigConfirming}
                        variant="primary"
                        className="mt-4 flex items-center gap-2"
                      >
                        {isConfiguring || isConfigConfirming ? (
                          <>
                            <Spinner size="sm" />
                            {isConfiguring ? 'Confirming...' : 'Configuring...'}
                          </>
                        ) : (
                          <>
                            Configure Tax Hook
                            <Zap className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    )}
                    {configTxHash && (
                      <a
                        href={`https://basescan.org/tx/${configTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 mt-2"
                      >
                        View transaction <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Errors */}
          {(sweepError || migrateError || configError || activateError || unsoldSweepError || strategySweepError || error) && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-sm mt-1">
                {error ||
                  sweepError?.message ||
                  migrateError?.message ||
                  configError?.message ||
                  unsoldSweepError?.message ||
                  strategySweepError?.message ||
                  activateError?.message}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Success State */}
      <AnimatePresence>
        {currentStep === 'complete' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-8 text-center space-y-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto"
            >
              <PartyPopper className="w-10 h-10 text-green-400" />
            </motion.div>
            <h2 className="font-display text-2xl font-bold">
              {isFailed ? 'Recovery Complete' : '🎉 Vault Activated!'}
            </h2>
            <p className="text-surface-400">
              {isFailed
                ? 'Unsold auction tokens were swept and strategy-deployed creator tokens were returned to the vault.'
                : 'Your vault is now live on Uniswap V4. Native and hook fee behavior is deployment-conditional; confirm active fee planes and recipient alignment before publishing buy+sell fee claims. Qualifying buys can trigger lottery entries, and a no-purchase AMOE entry path is also available.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => navigate(`/vault/${vaultAddress ?? AKITA.vault}`)}
                variant="primary"
                className="flex items-center justify-center gap-2"
              >
                View Vault
                <ArrowRight className="w-4 h-4" />
              </Button>
              {!isFailed ? (
                <>
                  <Button
                    onClick={handleActivateYield}
                    disabled={!canActivateYield || isActivating || isActivateConfirming || isActivateSuccess}
                    variant="secondary"
                    className="flex items-center justify-center gap-2"
                  >
                    {isActivating || isActivateConfirming ? (
                      <>
                        <Spinner size="sm" />
                        Activating…
                      </>
                    ) : isActivateSuccess ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Yield activated
                      </>
                    ) : (
                      <>
                        Activate yield
                        <Zap className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => tradeTokenAddress && navigate(`/swap?token=${tradeTokenAddress}`)}
                    disabled={!tradeTokenAddress}
                    variant="secondary"
                    className="flex items-center justify-center gap-2"
                  >
                    Trade on 4626 Swap
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </>
              ) : null}
            </div>
            {activateTxHash && !isFailed && (
              <a
                href={`https://basescan.org/tx/${activateTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 mt-2 justify-center"
              >
                View activation transaction <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {!isFailed && !canActivateYield && vaultAddress && (
              <p className="text-xs text-surface-500">
                Only the vault owner can activate yield strategies.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
