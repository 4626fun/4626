import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Coins, Droplets, Minus, Plus, Repeat, ShoppingCart } from 'lucide-react'
import {
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
  type Address,
} from 'viem'
import { base } from 'viem/chains'
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'

import { toast } from '@/components/ui/Toast'
import { CONTRACTS } from '@/config/contracts'
import {
  ALFA_CREATOR_KEY_LP_FACTORY_ABI,
  ALFA_CREATOR_KEY_POOL_ABI,
  ALFACLUB,
  FRIEND_KEY_ABI,
} from '@/lib/alfaclub/contracts'
import { creatorCoinRawLogo } from '@/lib/uniswap/swapUtils'
import { buildAndSendCalls, type TxRouterContext, type UserExecutionTrack } from '@/lib/tx/txRouter'
import type { TransactionRequest } from '@/lib/uniswap/tradingApi'
import { useAccountContext } from '@/wallet/accountContext'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const
const MAX_UINT256 = (1n << 256n) - 1n
const BPS = 10_000n

type Mode = 'create' | 'add' | 'buy' | 'sell' | 'remove'

const modeTabs: Array<{ id: Mode; label: string; icon: typeof Plus }> = [
  { id: 'create', label: 'Create', icon: Plus },
  { id: 'add', label: 'Add', icon: Droplets },
  { id: 'buy', label: 'Buy', icon: ShoppingCart },
  { id: 'sell', label: 'Sell', icon: Repeat },
  { id: 'remove', label: 'Remove', icon: Minus },
]

function normalizeAddressInput(value: string): Address | null {
  const trimmed = value.trim()
  if (!isAddress(trimmed)) return null
  return getAddress(trimmed) as Address
}

function parsePositiveBigInt(value: string): bigint | null {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const parsed = BigInt(trimmed)
  return parsed > 0n ? parsed : null
}

function parseBps(value: string): bigint {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return 100n
  return BigInt(Math.min(5_000, Math.floor(parsed * 100)))
}

function addSlippage(value: bigint, bps: bigint): bigint {
  return (value * (BPS + bps) + BPS - 1n) / BPS
}

function subtractSlippage(value: bigint, bps: bigint): bigint {
  return (value * (BPS - bps)) / BPS
}

function formatTokenAmount(value: bigint | null | undefined, decimals: number, fallback = '--'): string {
  if (value === null || value === undefined) return fallback
  const formatted = formatUnits(value, decimals)
  const parts = formatted.split('.')
  const whole = parts[0] ?? '0'
  const fraction = parts[1] ?? ''
  const shortFraction = fraction.replace(/0+$/, '').slice(0, 6)
  return shortFraction ? `${whole}.${shortFraction}` : whole
}

function shortAddress(value: string | null | undefined): string {
  if (!value) return '--'
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function roomTypeLabel(value: number | null | undefined): string {
  if (value === 0) return 'Trading'
  if (value === 1) return 'Social'
  return '--'
}

function roomTierLabel(value: number | null | undefined): string {
  if (value === 0) return 'Casual'
  if (value === 1) return 'Club'
  if (value === 2) return 'Exclusive'
  return '--'
}

type LpSnapshot = {
  creator: Address
  roomType: number | null
  roomTier: number | null
  totalSupply: bigint
  bondingToken: Address
  primaryBuyQuote: bigint | null
  primarySellQuote: bigint | null
  pool: Address | null
  pairAllowed: boolean
  creatorAllowed: boolean
  creatorCoinName: string
  creatorCoinSymbol: string
  creatorCoinDecimals: number
  creatorCoinBalance: bigint
  creatorCoinAllowanceToFactory: bigint
  creatorCoinAllowanceToPool: bigint
  keyBalance: bigint
  keyApprovedForFactory: boolean
  keyApprovedForPool: boolean
  poolCreatorReserve: bigint | null
  poolKeyReserve: bigint | null
  lpBalance: bigint | null
  lpTotalSupply: bigint | null
  addQuote: bigint | null
  addLpShares: bigint | null
  buyQuote: bigint | null
  sellQuote: bigint | null
}

export function AlfaClubLiquidity() {
  const queryClient = useQueryClient()
  const account = useAccount()
  const accountContext = useAccountContext()
  const { switchChainAsync, isPending: switchingChain } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: base.id })
  const { data: walletClient } = useWalletClient({ chainId: base.id })

  const [mode, setMode] = useState<Mode>('create')
  const [creatorCoinInput, setCreatorCoinInput] = useState('')
  const [tokenIdInput, setTokenIdInput] = useState('')
  const [keyAmountInput, setKeyAmountInput] = useState('1')
  const [creatorCoinAmountInput, setCreatorCoinAmountInput] = useState('')
  const [lpAmountInput, setLpAmountInput] = useState('')
  const [slippageInput, setSlippageInput] = useState('1')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastHash, setLastHash] = useState<string | null>(null)

  const factory = CONTRACTS.alfaCreatorKeyLpFactory
  const factoryReady = factory && factory.toLowerCase() !== ZERO_ADDRESS
  const creatorCoin = useMemo(() => normalizeAddressInput(creatorCoinInput), [creatorCoinInput])
  const tokenId = useMemo(() => parsePositiveBigInt(tokenIdInput), [tokenIdInput])
  const keyAmount = useMemo(() => parsePositiveBigInt(keyAmountInput), [keyAmountInput])
  const slippageBps = useMemo(() => parseBps(slippageInput), [slippageInput])
  const executionAddress = (accountContext.activeAccount ?? accountContext.signerAddress ?? null) as Address | null
  const executionMode = accountContext.activeAccountType === 'SMART_WALLET' ? 'canonical' : 'eoa'

  const snapshotQuery = useQuery({
    queryKey: [
      'alfaclub-liquidity',
      factory,
      creatorCoin?.toLowerCase() ?? '',
      tokenId?.toString() ?? '',
      keyAmount?.toString() ?? '',
      executionAddress?.toLowerCase() ?? '',
    ],
    enabled: Boolean(factoryReady && publicClient && creatorCoin && tokenId && executionAddress),
    staleTime: 12_000,
    queryFn: async (): Promise<LpSnapshot> => {
      if (!publicClient || !creatorCoin || !tokenId || !executionAddress) throw new Error('Missing inputs')

      const [creatorRaw, roomTypeRaw, roomTierRaw, totalSupplyRaw, bondingTokenRaw, poolRaw, pairAllowedRaw, creatorAllowedRaw] =
        await Promise.all([
          publicClient.readContract({
            address: ALFACLUB.friendKey,
            abi: FRIEND_KEY_ABI,
            functionName: 'creatorByTokenId',
            args: [tokenId],
          }),
          publicClient.readContract({
            address: ALFACLUB.friendKey,
            abi: FRIEND_KEY_ABI,
            functionName: 'roomTypes',
            args: [tokenId],
          }).catch(() => null),
          publicClient.readContract({
            address: ALFACLUB.friendKey,
            abi: FRIEND_KEY_ABI,
            functionName: 'roomTiers',
            args: [tokenId],
          }).catch(() => null),
          publicClient.readContract({
            address: ALFACLUB.friendKey,
            abi: FRIEND_KEY_ABI,
            functionName: 'totalSupply',
            args: [tokenId],
          }),
          publicClient.readContract({
            address: ALFACLUB.friendKey,
            abi: FRIEND_KEY_ABI,
            functionName: 'bondingToken',
          }),
          publicClient.readContract({
            address: factory,
            abi: ALFA_CREATOR_KEY_LP_FACTORY_ABI,
            functionName: 'getPool',
            args: [creatorCoin, tokenId],
          }),
          publicClient.readContract({
            address: factory,
            abi: ALFA_CREATOR_KEY_LP_FACTORY_ABI,
            functionName: 'pairAllowed',
            args: [creatorCoin, tokenId],
          }),
          publicClient.readContract({
            address: factory,
            abi: ALFA_CREATOR_KEY_LP_FACTORY_ABI,
            functionName: 'poolCreatorAllowed',
            args: [executionAddress],
          }),
        ])

      const pool = poolRaw && poolRaw.toLowerCase() !== ZERO_ADDRESS ? (poolRaw as Address) : null
      const [
        creatorCoinNameRaw,
        creatorCoinSymbolRaw,
        creatorCoinDecimalsRaw,
        creatorCoinBalanceRaw,
        creatorCoinAllowanceFactoryRaw,
        creatorCoinAllowancePoolRaw,
        keyBalanceRaw,
        keyApprovedFactoryRaw,
        keyApprovedPoolRaw,
        primaryBuyQuoteRaw,
        primarySellQuoteRaw,
      ] = await Promise.all([
        publicClient.readContract({ address: creatorCoin, abi: erc20Abi, functionName: 'name' }).catch(() => ''),
        publicClient.readContract({ address: creatorCoin, abi: erc20Abi, functionName: 'symbol' }).catch(() => 'CREATOR'),
        publicClient.readContract({ address: creatorCoin, abi: erc20Abi, functionName: 'decimals' }).catch(() => 18),
        publicClient.readContract({
          address: creatorCoin,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [executionAddress],
        }),
        publicClient.readContract({
          address: creatorCoin,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [executionAddress, factory],
        }),
        pool
          ? publicClient.readContract({
              address: creatorCoin,
              abi: erc20Abi,
              functionName: 'allowance',
              args: [executionAddress, pool],
            })
          : Promise.resolve(0n),
        publicClient.readContract({
          address: ALFACLUB.friendKey,
          abi: FRIEND_KEY_ABI,
          functionName: 'balanceOf',
          args: [executionAddress, tokenId],
        }),
        publicClient.readContract({
          address: ALFACLUB.friendKey,
          abi: FRIEND_KEY_ABI,
          functionName: 'isApprovedForAll',
          args: [executionAddress, factory],
        }),
        pool
          ? publicClient.readContract({
              address: ALFACLUB.friendKey,
              abi: FRIEND_KEY_ABI,
              functionName: 'isApprovedForAll',
              args: [executionAddress, pool],
            })
          : Promise.resolve(false),
        keyAmount
          ? publicClient.readContract({
              address: ALFACLUB.friendKey,
              abi: FRIEND_KEY_ABI,
              functionName: 'getBuyPriceAfterFee',
              args: [tokenId, keyAmount],
            }).catch(() => null)
          : Promise.resolve(null),
        keyAmount
          ? publicClient.readContract({
              address: ALFACLUB.friendKey,
              abi: FRIEND_KEY_ABI,
              functionName: 'getSellPriceAfterFee',
              args: [tokenId, keyAmount],
            }).catch(() => null)
          : Promise.resolve(null),
      ])

      let poolCreatorReserve: bigint | null = null
      let poolKeyReserve: bigint | null = null
      let lpBalance: bigint | null = null
      let lpTotalSupply: bigint | null = null
      let addQuote: bigint | null = null
      let addLpShares: bigint | null = null
      let buyQuote: bigint | null = null
      let sellQuote: bigint | null = null

      if (pool) {
        const [reservesRaw, lpBalanceRaw, lpTotalRaw, addQuoteRaw, buyQuoteRaw, sellQuoteRaw] = await Promise.all([
          publicClient.readContract({
            address: pool,
            abi: ALFA_CREATOR_KEY_POOL_ABI,
            functionName: 'getReserves',
          }),
          publicClient.readContract({
            address: pool,
            abi: ALFA_CREATOR_KEY_POOL_ABI,
            functionName: 'balanceOf',
            args: [executionAddress],
          }),
          publicClient.readContract({
            address: pool,
            abi: ALFA_CREATOR_KEY_POOL_ABI,
            functionName: 'totalSupply',
          }),
          keyAmount
            ? publicClient.readContract({
                address: pool,
                abi: ALFA_CREATOR_KEY_POOL_ABI,
                functionName: 'quoteAddLiquidity',
                args: [keyAmount],
              }).catch(() => null)
            : Promise.resolve(null),
          keyAmount
            ? publicClient.readContract({
                address: pool,
                abi: ALFA_CREATOR_KEY_POOL_ABI,
                functionName: 'quoteBuyKeys',
                args: [keyAmount],
              }).catch(() => null)
            : Promise.resolve(null),
          keyAmount
            ? publicClient.readContract({
                address: pool,
                abi: ALFA_CREATOR_KEY_POOL_ABI,
                functionName: 'quoteSellKeys',
                args: [keyAmount],
              }).catch(() => null)
            : Promise.resolve(null),
        ])
        poolCreatorReserve = reservesRaw[0]
        poolKeyReserve = reservesRaw[1]
        lpBalance = lpBalanceRaw
        lpTotalSupply = lpTotalRaw
        if (addQuoteRaw) {
          addQuote = addQuoteRaw[0]
          addLpShares = addQuoteRaw[1]
        }
        buyQuote = buyQuoteRaw
        sellQuote = sellQuoteRaw
      }

      return {
        creator: creatorRaw as Address,
        roomType: typeof roomTypeRaw === 'number' ? roomTypeRaw : roomTypeRaw === null ? null : Number(roomTypeRaw),
        roomTier: typeof roomTierRaw === 'number' ? roomTierRaw : roomTierRaw === null ? null : Number(roomTierRaw),
        totalSupply: totalSupplyRaw,
        bondingToken: bondingTokenRaw as Address,
        primaryBuyQuote: primaryBuyQuoteRaw,
        primarySellQuote: primarySellQuoteRaw,
        pool,
        pairAllowed: Boolean(pairAllowedRaw),
        creatorAllowed: Boolean(creatorAllowedRaw),
        creatorCoinName: typeof creatorCoinNameRaw === 'string' ? creatorCoinNameRaw : '',
        creatorCoinSymbol: typeof creatorCoinSymbolRaw === 'string' ? creatorCoinSymbolRaw : 'CREATOR',
        creatorCoinDecimals: typeof creatorCoinDecimalsRaw === 'number' ? creatorCoinDecimalsRaw : Number(creatorCoinDecimalsRaw),
        creatorCoinBalance: creatorCoinBalanceRaw,
        creatorCoinAllowanceToFactory: creatorCoinAllowanceFactoryRaw,
        creatorCoinAllowanceToPool: creatorCoinAllowancePoolRaw,
        keyBalance: keyBalanceRaw,
        keyApprovedForFactory: Boolean(keyApprovedFactoryRaw),
        keyApprovedForPool: Boolean(keyApprovedPoolRaw),
        poolCreatorReserve,
        poolKeyReserve,
        lpBalance,
        lpTotalSupply,
        addQuote,
        addLpShares,
        buyQuote,
        sellQuote,
      }
    },
  })

  const snapshot = snapshotQuery.data ?? null
  const decimals = snapshot?.creatorCoinDecimals ?? 18
  const creatorCoinAmount = useMemo(() => {
    if (!creatorCoinAmountInput.trim()) return null
    try {
      const parsed = parseUnits(creatorCoinAmountInput.trim(), decimals)
      return parsed > 0n ? parsed : null
    } catch {
      return null
    }
  }, [creatorCoinAmountInput, decimals])
  const lpAmount = useMemo(() => {
    if (!lpAmountInput.trim()) return null
    try {
      const parsed = parseUnits(lpAmountInput.trim(), 18)
      return parsed > 0n ? parsed : null
    } catch {
      return null
    }
  }, [lpAmountInput])

  const logoUrl = creatorCoin ? creatorCoinRawLogo(creatorCoin, base.id) : null

  const buildTxContext = useCallback((): TxRouterContext => {
    if (!walletClient || !publicClient || !executionAddress) throw new Error('Wallet execution is not ready')
    return {
      chainId: base.id,
      executionMode,
      executionTrack: null as UserExecutionTrack | null,
      walletClient,
      publicClient,
      canonicalAddress: accountContext.cswAddress ?? null,
      signerAddress: accountContext.signerAddress ?? null,
      executionAddress,
      signerType: accountContext.signerType,
      connectorId: account.connector?.id ?? null,
      connectorName: account.connector?.name ?? null,
      capabilities: accountContext.capabilities,
    }
  }, [
    account.connector?.id,
    account.connector?.name,
    accountContext.capabilities,
    accountContext.cswAddress,
    accountContext.signerAddress,
    accountContext.signerType,
    executionAddress,
    executionMode,
    publicClient,
    walletClient,
  ])

  const submit = useCallback(async () => {
    if (!factoryReady || !creatorCoin || !tokenId || !snapshot || !keyAmount) {
      toast.error('Enter a valid Creator Coin, room tokenId, and key amount.')
      return
    }
    if (!executionAddress) {
      toast.error('Connect an execution-ready wallet.')
      return
    }
    if (account.chainId !== base.id) {
      await switchChainAsync({ chainId: base.id })
      return
    }

    const calls: TransactionRequest[] = []
    const pushApproval = (spender: Address, required: bigint, allowance: bigint) => {
      if (required > 0n && allowance < required) {
        calls.push({
          to: creatorCoin,
          from: executionAddress,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [spender, MAX_UINT256],
          }),
          value: '0',
          chainId: base.id,
        })
      }
    }
    const pushKeyApproval = (operator: Address, approved: boolean) => {
      if (!approved) {
        calls.push({
          to: ALFACLUB.friendKey,
          from: executionAddress,
          data: encodeFunctionData({
            abi: FRIEND_KEY_ABI,
            functionName: 'setApprovalForAll',
            args: [operator, true],
          }),
          value: '0',
          chainId: base.id,
        })
      }
    }

    try {
      if (mode === 'create') {
        if (!creatorCoinAmount) throw new Error('Enter the initial Creator Coin amount.')
        if (snapshot.pool) throw new Error('A pool already exists for this pair.')
        pushApproval(factory, creatorCoinAmount, snapshot.creatorCoinAllowanceToFactory)
        pushKeyApproval(factory, snapshot.keyApprovedForFactory)
        calls.push({
          to: factory,
          from: executionAddress,
          data: encodeFunctionData({
            abi: ALFA_CREATOR_KEY_LP_FACTORY_ABI,
            functionName: 'createPoolWithInitialLiquidity',
            args: [creatorCoin, tokenId, keyAmount, creatorCoinAmount, executionAddress],
          }),
          value: '0',
          chainId: base.id,
        })
      } else {
        if (!snapshot.pool) throw new Error('Create the pool before using this action.')
        if (mode === 'add') {
          if (!snapshot.addQuote || !snapshot.addLpShares) throw new Error('Add-liquidity quote unavailable.')
          const maxCreatorCoin = addSlippage(snapshot.addQuote, slippageBps)
          pushApproval(snapshot.pool, maxCreatorCoin, snapshot.creatorCoinAllowanceToPool)
          pushKeyApproval(snapshot.pool, snapshot.keyApprovedForPool)
          calls.push({
            to: snapshot.pool,
            from: executionAddress,
            data: encodeFunctionData({
              abi: ALFA_CREATOR_KEY_POOL_ABI,
              functionName: 'addLiquidity',
              args: [keyAmount, maxCreatorCoin, snapshot.addLpShares, executionAddress],
            }),
            value: '0',
            chainId: base.id,
          })
        }
        if (mode === 'buy') {
          if (!snapshot.buyQuote) throw new Error('LP buy quote unavailable.')
          const maxCreatorCoin = addSlippage(snapshot.buyQuote, slippageBps)
          pushApproval(snapshot.pool, maxCreatorCoin, snapshot.creatorCoinAllowanceToPool)
          calls.push({
            to: snapshot.pool,
            from: executionAddress,
            data: encodeFunctionData({
              abi: ALFA_CREATOR_KEY_POOL_ABI,
              functionName: 'buyKeys',
              args: [keyAmount, maxCreatorCoin, executionAddress],
            }),
            value: '0',
            chainId: base.id,
          })
        }
        if (mode === 'sell') {
          if (!snapshot.sellQuote) throw new Error('LP sell quote unavailable.')
          pushKeyApproval(snapshot.pool, snapshot.keyApprovedForPool)
          calls.push({
            to: snapshot.pool,
            from: executionAddress,
            data: encodeFunctionData({
              abi: ALFA_CREATOR_KEY_POOL_ABI,
              functionName: 'sellKeys',
              args: [keyAmount, subtractSlippage(snapshot.sellQuote, slippageBps), executionAddress],
            }),
            value: '0',
            chainId: base.id,
          })
        }
        if (mode === 'remove') {
          if (!lpAmount) throw new Error('Enter the LP share amount.')
          const lpSupply = snapshot.lpTotalSupply ?? 0n
          const reserveCoin = snapshot.poolCreatorReserve ?? 0n
          const reserveKeys = snapshot.poolKeyReserve ?? 0n
          const expectedCoin = lpSupply > 0n ? (reserveCoin * lpAmount) / lpSupply : 0n
          const expectedKeys = lpSupply > 0n ? (reserveKeys * lpAmount) / lpSupply : 0n
          calls.push({
            to: snapshot.pool,
            from: executionAddress,
            data: encodeFunctionData({
              abi: ALFA_CREATOR_KEY_POOL_ABI,
              functionName: 'removeLiquidity',
              args: [
                lpAmount,
                subtractSlippage(expectedCoin, slippageBps),
                subtractSlippage(expectedKeys, slippageBps),
                executionAddress,
              ],
            }),
            value: '0',
            chainId: base.id,
          })
        }
      }

      setIsSubmitting(true)
      const result = await buildAndSendCalls({ context: buildTxContext(), calls })
      const hash =
        result.send.transactionHash ??
        result.send.txHashes[result.send.txHashes.length - 1] ??
        result.send.callsId ??
        null
      setLastHash(hash)
      toast.success('AlfaClub liquidity transaction submitted.')
      await queryClient.invalidateQueries({ queryKey: ['alfaclub-liquidity'] })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transaction failed'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }, [
    account.chainId,
    buildTxContext,
    creatorCoin,
    creatorCoinAmount,
    executionAddress,
    factory,
    factoryReady,
    keyAmount,
    lpAmount,
    mode,
    queryClient,
    slippageBps,
    snapshot,
    switchChainAsync,
    tokenId,
  ])

  const primaryQuote = mode === 'sell' ? snapshot?.primarySellQuote : snapshot?.primaryBuyQuote
  const lpQuote =
    mode === 'add'
      ? snapshot?.addQuote
      : mode === 'buy'
        ? snapshot?.buyQuote
        : mode === 'sell'
          ? snapshot?.sellQuote
          : null

  const disabledReason = !factoryReady
    ? 'Factory not deployed'
    : !creatorCoin || !tokenId
      ? 'Enter pair'
      : !executionAddress
        ? 'Connect wallet'
        : snapshotQuery.isLoading
          ? 'Loading'
          : mode !== 'create' && !snapshot?.pool
            ? 'No pool'
            : mode === 'create' && !creatorCoinAmount
              ? 'Enter amount'
              : null

  return (
    <div className="relative pb-24 md:pb-0">
      <section className="cinematic-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-8">
            <div>
              <span className="label">AlfaClub Liquidity</span>
              <h1 className="headline text-3xl sm:text-5xl mt-3">Creator Coin / Key LP</h1>
            </div>
            <div className="text-xs text-zinc-500 font-mono">
              {factoryReady ? shortAddress(factory) : 'factory unset'}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <div className="space-y-5">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                  <label className="space-y-2">
                    <span className="text-xs text-zinc-500">Creator Coin</span>
                    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
                      {logoUrl ? (
                        <img src={logoUrl} alt="" className="h-8 w-8 rounded-full bg-white/10" />
                      ) : (
                        <Coins className="h-8 w-8 rounded-full bg-white/10 p-1.5 text-zinc-400" />
                      )}
                      <input
                        value={creatorCoinInput}
                        onChange={(event) => setCreatorCoinInput(event.target.value)}
                        placeholder="0x..."
                        className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-700"
                      />
                    </div>
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs text-zinc-500">Room TokenId</span>
                    <input
                      value={tokenIdInput}
                      onChange={(event) => setTokenIdInput(event.target.value.replace(/[^\d]/g, ''))}
                      placeholder="1"
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-700"
                    />
                  </label>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <label className="space-y-2">
                    <span className="text-xs text-zinc-500">Keys</span>
                    <input
                      value={keyAmountInput}
                      onChange={(event) => setKeyAmountInput(event.target.value.replace(/[^\d]/g, ''))}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs text-zinc-500">Creator Coin Amount</span>
                    <input
                      value={creatorCoinAmountInput}
                      onChange={(event) => setCreatorCoinAmountInput(event.target.value)}
                      disabled={mode !== 'create'}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none disabled:text-zinc-700"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs text-zinc-500">LP Shares</span>
                    <input
                      value={lpAmountInput}
                      onChange={(event) => setLpAmountInput(event.target.value)}
                      disabled={mode !== 'remove'}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none disabled:text-zinc-700"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="grid grid-cols-5 gap-2">
                  {modeTabs.map((tab) => {
                    const Icon = tab.icon
                    const active = mode === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setMode(tab.id)}
                        className={`flex h-12 items-center justify-center gap-2 rounded-lg text-xs transition ${
                          active
                            ? 'bg-brand-primary text-white'
                            : 'bg-black/30 text-zinc-500 hover:bg-white/8 hover:text-zinc-200'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-zinc-500">Primary AlfaClub curve</div>
                    <div className="mt-2 text-xl text-white">
                      {formatTokenAmount(primaryQuote, 6, '--')}
                    </div>
                    <div className="text-xs text-zinc-600">bonding token units</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Creator Coin LP</div>
                    <div className="mt-2 text-xl text-white">
                      {formatTokenAmount(lpQuote, decimals, '--')} {snapshot?.creatorCoinSymbol ?? ''}
                    </div>
                    <div className="text-xs text-zinc-600">secondary quote</div>
                  </div>
                  <label className="space-y-2">
                    <span className="text-xs text-zinc-500">Slippage</span>
                    <div className="flex items-center rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
                      <input
                        value={slippageInput}
                        onChange={(event) => setSlippageInput(event.target.value)}
                        className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
                      />
                      <span className="text-xs text-zinc-600">%</span>
                    </div>
                  </label>
                </div>

                <button
                  type="button"
                  disabled={Boolean(disabledReason) || isSubmitting || switchingChain}
                  onClick={submit}
                  className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-600"
                >
                  <Droplets className="h-4 w-4" />
                  {switchingChain ? 'Switching Chain' : isSubmitting ? 'Submitting' : disabledReason ?? modeTabs.find((x) => x.id === mode)?.label}
                </button>
                {lastHash ? <div className="mt-3 truncate text-xs font-mono text-zinc-500">{lastHash}</div> : null}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-zinc-500">Room Creator</div>
                    <div className="mt-1 font-mono text-zinc-200">{shortAddress(snapshot?.creator)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Room</div>
                    <div className="mt-1 text-zinc-200">
                      {roomTypeLabel(snapshot?.roomType)} / {roomTierLabel(snapshot?.roomTier)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Key Balance</div>
                    <div className="mt-1 text-zinc-200">{snapshot?.keyBalance?.toString() ?? '--'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Creator Coin Balance</div>
                    <div className="mt-1 text-zinc-200">
                      {formatTokenAmount(snapshot?.creatorCoinBalance, decimals)} {snapshot?.creatorCoinSymbol ?? ''}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Pair Allowlist</div>
                    <div className="mt-1 text-zinc-200">{snapshot?.pairAllowed ? 'Allowed' : 'Closed'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Creator Allowlist</div>
                    <div className="mt-1 text-zinc-200">{snapshot?.creatorAllowed ? 'Allowed' : 'Closed'}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-zinc-500">Pool</div>
                    <div className="mt-1 font-mono text-sm text-zinc-200">{shortAddress(snapshot?.pool)}</div>
                  </div>
                  <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-500">
                    6.9% LP fee
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-zinc-500">Creator Coin Reserve</div>
                    <div className="mt-1 text-zinc-200">
                      {formatTokenAmount(snapshot?.poolCreatorReserve, decimals)} {snapshot?.creatorCoinSymbol ?? ''}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Key Reserve</div>
                    <div className="mt-1 text-zinc-200">{snapshot?.poolKeyReserve?.toString() ?? '--'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">LP Balance</div>
                    <div className="mt-1 text-zinc-200">{formatTokenAmount(snapshot?.lpBalance, 18)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">LP Supply</div>
                    <div className="mt-1 text-zinc-200">{formatTokenAmount(snapshot?.lpTotalSupply, 18)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="text-xs text-zinc-500">Creator Coin Identity</div>
                <div className="mt-3 flex items-center gap-3">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="h-10 w-10 rounded-full bg-white/10" />
                  ) : null}
                  <div className="min-w-0">
                    <div className="truncate text-sm text-zinc-200">{snapshot?.creatorCoinName || 'Creator Coin'}</div>
                    <div className="truncate font-mono text-xs text-zinc-600">
                      {snapshot?.creatorCoinSymbol ?? '--'} / {creatorCoin ? shortAddress(creatorCoin) : '--'}
                    </div>
                  </div>
                </div>
                {snapshotQuery.error ? (
                  <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
                    {snapshotQuery.error instanceof Error ? snapshotQuery.error.message : 'Snapshot read failed'}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
