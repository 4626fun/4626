import { useCallback, useMemo, useState } from 'react'

import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { base } from 'wagmi/chains'
import { Loader2, Wrench } from 'lucide-react'

import { CONTRACTS } from '@/config/contracts'
import { isAddressLike, type ResolvedStatusFixContext } from '@/features/status/statusShared'

const SHAREOFT_ADMIN_ABI = [
  { type: 'function', name: 'setVault', stateMutability: 'nonpayable', inputs: [{ name: '_vault', type: 'address' }], outputs: [] },
  { type: 'function', name: 'setGaugeController', stateMutability: 'nonpayable', inputs: [{ name: '_controller', type: 'address' }], outputs: [] },
  {
    type: 'function',
    name: 'setMinter',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'minter', type: 'address' },
      { name: 'status', type: 'bool' },
    ],
    outputs: [],
  },
] as const

const VAULT_ADMIN_ABI = [
  {
    type: 'function',
    name: 'setWhitelist',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_account', type: 'address' },
      { name: '_status', type: 'bool' },
    ],
    outputs: [],
  },
] as const

const ORACLE_ADMIN_ABI = [
  {
    type: 'function',
    name: 'setV3Pool',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_pool', type: 'address' },
      { name: '_creatorToken', type: 'address' },
      { name: '_usdToken', type: 'address' },
      { name: '_twapDuration', type: 'uint32' },
    ],
    outputs: [],
  },
] as const

const AJNA_AUTH_ADMIN_ABI = [
  {
    type: 'function',
    name: 'setMinBucketIndex',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'nextMinBucketIndex', type: 'uint256' }],
    outputs: [],
  },
] as const

const UNISWAP_V3_POOL_ORACLE_ABI = [
  {
    type: 'function',
    name: 'increaseObservationCardinalityNext',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'observationCardinalityNext', type: 'uint16' }],
    outputs: [],
  },
] as const

type FixAction = {
  id: string
  title: string
  description: string
  requiredOwner?: string | null
  canRun: boolean
  onRun: () => Promise<void>
}

export default function StatusFixPanel(props: {
  context: ResolvedStatusFixContext
  onApplied: () => void
}) {
  const { context, onApplied } = props
  const { address, isConnected, chain } = useAccount()
  const publicClient = usePublicClient({ chainId: base.id })
  const { writeContractAsync } = useWriteContract()
  const [fixingId, setFixingId] = useState<string | null>(null)
  const [fixError, setFixError] = useState<string | null>(null)
  const [fixHash, setFixHash] = useState<`0x${string}` | null>(null)
  const confirmFixTransaction = useCallback(
    async (hash: `0x${string}`) => {
      if (!publicClient) throw new Error('Base public client unavailable')
      setFixHash(hash)
      try {
        await publicClient.waitForTransactionReceipt({ hash })
        setFixHash(null)
        setFixingId(null)
        setFixError(null)
        onApplied()
      } catch (error) {
        setFixHash(null)
        setFixingId(null)
        throw error
      }
    },
    [onApplied, publicClient],
  )

  const canFixShare = !!address && !!context.shareOwner && address.toLowerCase() === context.shareOwner.toLowerCase()
  const canFixVault = !!address && !!context.vaultOwner && address.toLowerCase() === context.vaultOwner.toLowerCase()
  const canFixOracle = !!address && !!context.oracleOwner && address.toLowerCase() === context.oracleOwner.toLowerCase()
  const canFixAjna =
    !!address && !!context.ajnaAuth && !!context.ajnaAuthAdmin && address.toLowerCase() === context.ajnaAuthAdmin.toLowerCase()
  const isBase = (chain?.id ?? base.id) === base.id

  const fixActions = useMemo<FixAction[]>(() => {
    const actions: FixAction[] = []

    if (
      context.shareOFT &&
      context.vaultAddress &&
      (!context.shareVault || context.shareVault.toLowerCase() !== context.vaultAddress.toLowerCase())
    ) {
      actions.push({
        id: 'fix-share-vault',
        title: 'Wire share token → vault',
        description: 'Sets shareOFT.vault so conversions and integrations can reference the vault.',
        requiredOwner: context.shareOwner,
        canRun: !!isConnected && isBase && canFixShare,
        onRun: async () => {
          setFixError(null)
          setFixingId('fix-share-vault')
          const hash = await writeContractAsync({
            address: context.shareOFT as `0x${string}`,
            abi: SHAREOFT_ADMIN_ABI,
            functionName: 'setVault',
            args: [context.vaultAddress as `0x${string}`],
            chainId: base.id,
          })
          await confirmFixTransaction(hash)
        },
      })
    }

    if (
      context.shareOFT &&
      context.gauge &&
      (!context.shareGauge || context.shareGauge.toLowerCase() !== context.gauge.toLowerCase())
    ) {
      actions.push({
        id: 'fix-share-gauge',
        title: 'Wire share token → gauge',
        description: 'Sets shareOFT.gaugeController so buy fees can route to the gauge controller.',
        requiredOwner: context.shareOwner,
        canRun: !!isConnected && isBase && canFixShare,
        onRun: async () => {
          setFixError(null)
          setFixingId('fix-share-gauge')
          const hash = await writeContractAsync({
            address: context.shareOFT as `0x${string}`,
            abi: SHAREOFT_ADMIN_ABI,
            functionName: 'setGaugeController',
            args: [context.gauge as `0x${string}`],
            chainId: base.id,
          })
          await confirmFixTransaction(hash)
        },
      })
    }

    if (context.shareOFT && context.wrapper && context.shareMinterOk === false) {
      actions.push({
        id: 'fix-share-minter',
        title: 'Approve wrapper as share-token minter',
        description: 'Sets shareOFT.setMinter(wrapper, true) so deposits can mint receipt tokens.',
        requiredOwner: context.shareOwner,
        canRun: !!isConnected && isBase && canFixShare,
        onRun: async () => {
          setFixError(null)
          setFixingId('fix-share-minter')
          const hash = await writeContractAsync({
            address: context.shareOFT as `0x${string}`,
            abi: SHAREOFT_ADMIN_ABI,
            functionName: 'setMinter',
            args: [context.wrapper as `0x${string}`, true],
            chainId: base.id,
          })
          await confirmFixTransaction(hash)
        },
      })
    }

    if (context.vaultAddress && context.wrapper && context.wrapperWhitelisted !== true) {
      const isTry = context.wrapperWhitelisted == null
      actions.push({
        id: 'fix-vault-whitelist',
        title: isTry ? 'Try whitelisting wrapper on vault' : 'Whitelist wrapper on vault',
        description: isTry
          ? 'Some vault versions don’t expose a readable whitelist. This will attempt to whitelist the wrapper (if supported).'
          : 'Enables deposits/withdrawals through the wrapper when the vault whitelist is enforced.',
        requiredOwner: context.vaultOwner,
        canRun: !!isConnected && isBase && canFixVault,
        onRun: async () => {
          setFixError(null)
          setFixingId('fix-vault-whitelist')
          const hash = await writeContractAsync({
            address: context.vaultAddress as `0x${string}`,
            abi: VAULT_ADMIN_ABI,
            functionName: 'setWhitelist',
            args: [context.wrapper as `0x${string}`, true],
            chainId: base.id,
          })
          await confirmFixTransaction(hash)
        },
      })
    }

    if (
      context.oracle &&
      context.v3Pool &&
      context.creatorToken &&
      (context.oracleV3PoolConfigured !== true ||
        !context.oracleV3Pool ||
        context.oracleV3Pool.toLowerCase() !== context.v3Pool.toLowerCase())
    ) {
      actions.push({
        id: 'fix-oracle-v3',
        title: 'Configure oracle → Uniswap V3 (CREATOR/USDC)',
        description: 'Sets oracle.setV3Pool so the oracle can read CREATOR/USDC TWAP and suggest Ajna buckets onchain.',
        requiredOwner: context.oracleOwner,
        canRun: !!isConnected && isBase && canFixOracle,
        onRun: async () => {
          setFixError(null)
          setFixingId('fix-oracle-v3')
          const hash = await writeContractAsync({
            address: context.oracle as `0x${string}`,
            abi: ORACLE_ADMIN_ABI,
            functionName: 'setV3Pool',
            args: [context.v3Pool as `0x${string}`, context.creatorToken as `0x${string}`, CONTRACTS.usdc, 1800],
            chainId: base.id,
          })
          await confirmFixTransaction(hash)
        },
      })
    }

    if (
      context.ajnaAuth &&
      context.ajnaSuggestedBucket !== null &&
      context.ajnaSuggestedBucket !== undefined &&
      (context.ajnaMinBucket === null ||
        context.ajnaMinBucket === undefined ||
        context.ajnaMinBucket !== context.ajnaSuggestedBucket)
    ) {
      const suggestedBucket = context.ajnaSuggestedBucket
      actions.push({
        id: 'fix-ajna-bucket',
        title: 'Set Ajna min bucket (suggested)',
        description: `Sets AjnaVaultAuth.minBucketIndex so the nested Ajna ERC-4626 vault only routes liquidity into buckets at or above the suggested floor.${context.ajnaInnerVault ? ` Inner vault: ${context.ajnaInnerVault}.` : ''}${context.ajnaBufferRatioBps !== null ? ` Buffer ratio: ${context.ajnaBufferRatioBps.toString()} bps.` : ''}${context.ajnaPaused === true ? ' Vault is currently paused.' : ''}`,
        requiredOwner: context.ajnaAuthAdmin,
        canRun: !!isConnected && isBase && canFixAjna,
        onRun: async () => {
          setFixError(null)
          setFixingId('fix-ajna-bucket')
          const hash = await writeContractAsync({
            address: context.ajnaAuth as `0x${string}`,
            abi: AJNA_AUTH_ADMIN_ABI,
            functionName: 'setMinBucketIndex',
            args: [suggestedBucket],
            chainId: base.id,
          })
          await confirmFixTransaction(hash)
        },
      })
    }

    if (context.v3Pool && (context.v3ObsNext == null || context.v3ObsNext < 64)) {
      actions.push({
        id: 'fix-v3-oracle-capacity',
        title: 'Increase Uniswap V3 TWAP capacity',
        description:
          'Calls increaseObservationCardinalityNext(64) on the V3 pool so TWAP pricing has enough historical observations. This does not change price; it only increases oracle storage.',
        canRun: !!isConnected && isBase,
        onRun: async () => {
          setFixError(null)
          setFixingId('fix-v3-oracle-capacity')
          const hash = await writeContractAsync({
            address: context.v3Pool as `0x${string}`,
            abi: UNISWAP_V3_POOL_ORACLE_ABI,
            functionName: 'increaseObservationCardinalityNext',
            args: [64],
            chainId: base.id,
          })
          await confirmFixTransaction(hash)
        },
      })
    }

    return actions
  }, [canFixAjna, canFixOracle, canFixShare, canFixVault, confirmFixTransaction, context, isBase, isConnected, writeContractAsync])

  return (
    <div className="space-y-3">
      {!isBase ? <div className="text-xs text-zinc-600">Switch to Base to apply fixes.</div> : null}

      {fixError ? (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-xs">
          {fixError}
        </div>
      ) : null}

      <div className="space-y-2">
        {fixActions.map((action) => {
          const isBusy = fixingId === action.id || (!!fixHash && fixingId === action.id)
          const disabled = !action.canRun || isBusy || !!fixHash
          const ownerHint =
            action.requiredOwner && isAddressLike(action.requiredOwner)
              ? `Owner: ${action.requiredOwner.slice(0, 6)}…${action.requiredOwner.slice(-4)}`
              : null

          return (
            <div key={action.id} className="border border-zinc-900/50 rounded-lg bg-black/20 px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm text-zinc-200 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-zinc-500" />
                    <span className="truncate">{action.title}</span>
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">{action.description}</div>
                  {!action.canRun && ownerHint ? (
                    <div className="text-[10px] text-zinc-700 mt-1">{ownerHint}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={async () => {
                    try {
                      setFixError(null)
                      await action.onRun()
                    } catch (error: any) {
                      setFixError(String(error?.shortMessage || error?.message || 'Fix failed'))
                      setFixingId(null)
                    }
                  }}
                  className="btn-accent btn-compact btn-no-icon px-4 py-2 text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isBusy || !!fixHash ? 'Fixing…' : 'Fix'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {!isConnected ? (
        <div className="rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3 text-xs text-zinc-500">
          Connect the owner wallet on Base to apply any available fixes.
        </div>
      ) : null}

      {fixHash ? (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Waiting for transaction confirmation…
        </div>
      ) : null}
    </div>
  )
}
