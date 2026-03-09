import { useMemo, useState } from 'react'
import { useAccount, usePublicClient, useReadContract, useWalletClient } from 'wagmi'
import { base } from 'wagmi/chains'
import { encodeFunctionData, erc20Abi, getContractAddress, isAddress, parseUnits, type Address, type Hex } from 'viem'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { CONTRACTS } from '@/config/contracts'
import { logger } from '@/lib/logger'
import { Alert } from '@/components/ui/Alert'

interface DeployStrategiesProps {
  vaultAddress: `0x${string}`
  tokenAddress: `0x${string}`
}

const STRATEGY_BATCHER_ABI = [
  {
    type: 'function',
    name: 'batchDeployStrategies',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'underlyingToken', type: 'address' },
      { name: 'quoteToken', type: 'address' },
      { name: 'creatorVault', type: 'address' },
      { name: '_ajnaFactory', type: 'address' },
      { name: 'v3FeeTier', type: 'uint24' },
      { name: 'initialSqrtPriceX96', type: 'uint160' },
      { name: 'owner', type: 'address' },
      { name: 'vaultName', type: 'string' },
      { name: 'vaultSymbol', type: 'string' },
    ],
    outputs: [
      {
        name: 'result',
        type: 'tuple',
        components: [
          { name: 'charmVault', type: 'address' },
          { name: 'charmStrategy', type: 'address' },
          { name: 'creatorCharmStrategy', type: 'address' },
          { name: 'ajnaStrategy', type: 'address' },
          { name: 'v3Pool', type: 'address' },
        ],
      },
    ],
  },
] as const

const VAULT_MGMT_ABI = [
  { type: 'function', name: 'management', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'getStrategyCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'addStrategy', stateMutability: 'nonpayable', inputs: [{ name: 'strategy', type: 'address' }, { name: 'weight', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'setMinimumTotalIdle', stateMutability: 'nonpayable', inputs: [{ name: '_minimumTotalIdle', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'deployToStrategies', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const

export function DeployStrategies({ vaultAddress, tokenAddress }: DeployStrategiesProps) {
  const { address, connector } = useAccount()
  const publicClient = usePublicClient({ chainId: base.id })
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const { client: smartWalletClient } = useSmartWallets()

  const { data: tokenDecimalsRaw } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'decimals',
  })
  const tokenDecimals = typeof tokenDecimalsRaw === 'number' ? tokenDecimalsRaw : 18

  // Privy smart wallet is the preferred path - single UserOperation with one signature
  const hasPrivySmartWallet = Boolean(smartWalletClient?.account?.address)
  const isSmartWallet = hasPrivySmartWallet || connector?.id === 'coinbaseWalletSDK'

  const [batcherAddress, setBatcherAddress] = useState<string>(CONTRACTS.strategyDeploymentBatcher ?? '')
  const [quoteToken, setQuoteToken] = useState<string>(CONTRACTS.usdc)
  const [ajnaFactory, setAjnaFactory] = useState<string>(CONTRACTS.ajnaErc20Factory)
  const [v3FeeTier, setV3FeeTier] = useState<number>(3000)

  // Default: Q96 (price = 1 in raw token1/token0 terms). Only used if pool doesn't exist yet.
  const [initialSqrtPriceX96, setInitialSqrtPriceX96] = useState<string>('79228162514264337593543950336')
  const [charmVaultName, setCharmVaultName] = useState<string>('4626.fun Strategy: Charm')
  const [charmVaultSymbol, setCharmVaultSymbol] = useState<string>('AKITA-USDC')

  // Legacy admin helper: deploys only Charm + Ajna.
  // Since the remaining 40% stays idle on Base, use 50/50 strategy weights
  // and reserve the rest as minimum idle.
  const [charmWeightBps, setCharmWeightBps] = useState<number>(5000)
  const [ajnaWeightBps, setAjnaWeightBps] = useState<number>(5000)
  // 40% of 5,000,000 = 2,000,000 reserved in-vault as idle.
  const [minimumIdle, setMinimumIdle] = useState<string>('2000000')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bundleId, setBundleId] = useState<string | null>(null)
  const [predicted, setPredicted] = useState<{
    nonce: bigint
    charmVault: Address
    creatorCharmStrategy: Address
    ajnaStrategy: Address
  } | null>(null)

  const baseBatcher = useMemo(() => {
    const v = batcherAddress.trim()
    return (isAddress(v) ? (v as Address) : null)
  }, [batcherAddress])

  const canSubmit = !!address && !!publicClient && !!walletClient && !!baseBatcher

  async function computePredicted() {
    if (!publicClient) throw new Error('Network client not ready')
    if (!baseBatcher) throw new Error('Invalid StrategyDeploymentBatcher address')

    // viem returns nonce as a JS number; convert so we can do safe +1n/+2n math and satisfy viem typings.
    const nonce = BigInt(await publicClient.getTransactionCount({ address: baseBatcher }))
    const charmVault = getContractAddress({ from: baseBatcher, nonce })
    const creatorCharmStrategy = getContractAddress({ from: baseBatcher, nonce: nonce + 1n })
    const ajnaStrategy = getContractAddress({ from: baseBatcher, nonce: nonce + 2n })
    return { nonce, charmVault, creatorCharmStrategy, ajnaStrategy }
  }

  async function deployAndConfigure() {
    if (!address || !publicClient || !walletClient) return
    setError(null)
    setBundleId(null)
    setIsSubmitting(true)

    try {
      if (!baseBatcher) throw new Error('StrategyDeploymentBatcher not configured')

      const quote = quoteToken.trim()
      const ajna = ajnaFactory.trim()
      if (!isAddress(quote)) throw new Error('Invalid quote token address')
      if (!isAddress(ajna)) throw new Error('Invalid Ajna factory address')

      const charmW = Number(charmWeightBps)
      const ajnaW = Number(ajnaWeightBps)
      if (!Number.isFinite(charmW) || charmW < 0 || charmW > 10_000) throw new Error('Invalid Charm weight (bps)')
      if (!Number.isFinite(ajnaW) || ajnaW < 0 || ajnaW > 10_000) throw new Error('Invalid Ajna weight (bps)')
      if (charmW + ajnaW > 10_000) throw new Error('Weights must sum to <= 10,000 bps')

      const sqrt = BigInt(initialSqrtPriceX96.trim())
      if (sqrt <= 0n) throw new Error('initialSqrtPriceX96 must be > 0')

      const minIdle = parseUnits(minimumIdle.trim(), tokenDecimals)

      const next = await computePredicted()
      setPredicted(next)

      const calls: { to: Address; data: Hex; value: bigint }[] = []

      // 1) Deploy strategies (creates V3 pool if needed, deploys Charm vault + strategies, deploys Ajna strategy)
      calls.push({
        to: baseBatcher,
        data: encodeFunctionData({
          abi: STRATEGY_BATCHER_ABI,
          functionName: 'batchDeployStrategies',
          args: [
            tokenAddress,
            quote as Address,
            vaultAddress,
            ajna as Address,
            v3FeeTier,
            sqrt,
            address as Address,
            charmVaultName,
            charmVaultSymbol,
          ],
        }),
        value: 0n,
      })

      // 2) Configure vault allocations
      if (charmW > 0) {
        calls.push({
          to: vaultAddress,
          data: encodeFunctionData({
            abi: VAULT_MGMT_ABI,
            functionName: 'addStrategy',
            args: [next.creatorCharmStrategy, BigInt(charmW)],
          }),
          value: 0n,
        })
      }
      if (ajnaW > 0) {
        calls.push({
          to: vaultAddress,
          data: encodeFunctionData({
            abi: VAULT_MGMT_ABI,
            functionName: 'addStrategy',
            args: [next.ajnaStrategy, BigInt(ajnaW)],
          }),
          value: 0n,
        })
      }

      // 3) Set vault min idle buffer (keep liquidity available for redemptions)
      calls.push({
        to: vaultAddress,
        data: encodeFunctionData({
          abi: VAULT_MGMT_ABI,
          functionName: 'setMinimumTotalIdle',
          args: [minIdle],
        }),
        value: 0n,
      })

      // 4) Execute allocation now so actual underlying amounts move into strategies.
      calls.push({
        to: vaultAddress,
        data: encodeFunctionData({
          abi: VAULT_MGMT_ABI,
          functionName: 'deployToStrategies',
          args: [],
        }),
        value: 0n,
      })

      // Preferred: Privy smart wallet - batches all calls into single ERC-4337 UserOperation (one signature)
      if (smartWalletClient) {
        try {
          const privyCalls = calls.map((c) => ({ to: c.to, data: c.data, value: c.value }))
          const hash = await smartWalletClient.sendTransaction({ calls: privyCalls })
          setBundleId(String(hash))
          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash: hash as Hex })
          }
          return
        } catch (e) {
          logger.warn('[DeployStrategies] Privy smart wallet sendTransaction failed', e)
          throw e
        }
      }

      // Fallback: sequential transactions (EOA wallets without smart wallet)
      if (!walletClient) throw new Error('No wallet client available')
      for (const c of calls) {
        const txHash = await walletClient.sendTransaction({
          account: address as any,
          chain: base as any,
          to: c.to,
          data: c.data,
          value: c.value,
        })
        setBundleId(String(txHash))
        await publicClient.waitForTransactionReceipt({ hash: txHash as any })
      }
    } catch (e: any) {
      logger.error('[DeployStrategies] failed', e)
      setError(String(e?.shortMessage || e?.message || e))
    } finally {
      setIsSubmitting(false)
    }
  }

  const fieldClass = 'mt-1 w-full bg-black/40 border border-white/8 rounded-lg px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-brand-primary/50 transition-colors'
  const labelClass = 'text-[11px] font-medium text-zinc-500'

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-1">Deploy Yield Strategies (Legacy)</h3>
        <p className="text-sm text-zinc-500">
          Manual two-strategy helper for Charm + Ajna only. The canonical `/deploy` flow is the only path that deploys
          Charm, Ajna, and `SolanaStrategy` together with Solana preflight.
        </p>
      </div>

      <Alert variant="warning" title="Legacy Admin Helper">
        This page does not deploy `SolanaStrategy` and does not run the Solana route/OVault preflight. Use `/deploy`
        for the production three-strategy launch flow.
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
          <div className="text-[11px] font-medium text-zinc-500">Contracts</div>
          <div className="space-y-3 text-sm">
            <div>
              <div className={labelClass}>StrategyDeploymentBatcher</div>
              <input
                value={batcherAddress}
                onChange={(e) => setBatcherAddress(e.target.value)}
                placeholder="0x..."
                className={fieldClass}
              />
              {!CONTRACTS.strategyDeploymentBatcher && (
                <div className="mt-1 text-[11px] text-amber-400">
                  Missing VITE_STRATEGY_DEPLOYMENT_BATCHER — set in Vercel envs for production.
                </div>
              )}
            </div>
            <div>
              <div className={labelClass}>Quote token (default USDC)</div>
              <input value={quoteToken} onChange={(e) => setQuoteToken(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <div className={labelClass}>Ajna ERC20 factory</div>
              <input value={ajnaFactory} onChange={(e) => setAjnaFactory(e.target.value)} className={fieldClass} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
          <div className="text-[11px] font-medium text-zinc-500">Parameters</div>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className={labelClass}>Charm weight (bps)</div>
                <input value={charmWeightBps} onChange={(e) => setCharmWeightBps(Number(e.target.value))} className={fieldClass} />
              </div>
              <div>
                <div className={labelClass}>Ajna weight (bps)</div>
                <input value={ajnaWeightBps} onChange={(e) => setAjnaWeightBps(Number(e.target.value))} className={fieldClass} />
              </div>
            </div>

            <div>
              <div className={labelClass}>Minimum idle (underlying tokens)</div>
              <input value={minimumIdle} onChange={(e) => setMinimumIdle(e.target.value)} className={fieldClass} />
              <div className="mt-1 text-[11px] text-zinc-600">Parsed with {tokenDecimals} decimals.</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className={labelClass}>V3 fee tier</div>
                <input value={v3FeeTier} onChange={(e) => setV3FeeTier(Number(e.target.value))} className={fieldClass} />
              </div>
              <div>
                <div className={labelClass}>initialSqrtPriceX96</div>
                <input value={initialSqrtPriceX96} onChange={(e) => setInitialSqrtPriceX96(e.target.value)} className={fieldClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className={labelClass}>Charm vault name</div>
                <input value={charmVaultName} onChange={(e) => setCharmVaultName(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <div className={labelClass}>Charm vault symbol</div>
                <input value={charmVaultSymbol} onChange={(e) => setCharmVaultSymbol(e.target.value)} className={fieldClass} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {predicted && (
        <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
          <div className="text-[11px] font-medium text-zinc-500">Predicted addresses (next deployment)</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
            <div>
              <div className="text-zinc-500 mb-1">Charm vault</div>
              <div className="text-zinc-300 break-all">{predicted.charmVault}</div>
            </div>
            <div>
              <div className="text-zinc-500 mb-1">Charm strategy</div>
              <div className="text-zinc-300 break-all">{predicted.creatorCharmStrategy}</div>
            </div>
            <div>
              <div className="text-zinc-500 mb-1">Ajna strategy</div>
              <div className="text-zinc-300 break-all">{predicted.ajnaStrategy}</div>
            </div>
          </div>
          <div className="text-[11px] text-zinc-600">Batcher nonce used: {predicted.nonce.toString()}</div>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      <button
        onClick={deployAndConfigure}
        disabled={!canSubmit || isSubmitting}
        className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Submitting…' : 'Deploy + Configure Legacy Strategies'}
      </button>

      {bundleId && (
        <div className="text-[11px] text-zinc-500">
          Bundle/tx: <span className="font-mono text-zinc-400 break-all">{bundleId}</span>
        </div>
      )}

      <div className="text-[11px] text-zinc-600 space-y-1">
        {hasPrivySmartWallet ? (
          <>
            <p>• Using Smart Wallet — all calls are batched into one transaction (one approval).</p>
            <p>• ERC-4337 Account Abstraction with gas sponsorship.</p>
          </>
        ) : isSmartWallet ? (
          <p>• Smart Wallet detected.</p>
        ) : (
          <p>• User wallet — operations will run sequentially (multiple approvals).</p>
        )}
      </div>
    </div>
  )
}
