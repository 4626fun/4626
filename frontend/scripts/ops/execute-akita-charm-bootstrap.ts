#!/usr/bin/env tsx
/**
 * Bootstrap Charm LP after strategy debt is already allocated:
 * 1) Charm vault rebalance (CSW is rebalanceDelegate) to set tick ranges
 * 2) Seed a dust USDC leg onto the Charm strategy
 * 3) Temporarily clear minimumTotalIdle and forceDeploy so strategy.deposit()
 *    invests idle AKITA (+ USDC) into Charm
 * 4) Restore minimumTotalIdle
 *
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/execute-akita-charm-bootstrap.ts [--no-simulate]
 */
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  http,
  isAddress,
  parseUnits,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'

import {
  readCanonicalCswAddressEnv,
  readCanonicalCswOwnerIndexEnv,
  readCanonicalCswPrivyWalletIdEnv,
} from '../../server/_lib/wallet/canonicalCswEnv.js'
import {
  resolvePrivyCoinbaseSmartWalletOwnerContext,
  sendPrivyCoinbaseSmartWalletUserOperation,
} from '../../server/_lib/wallet/privyCoinbaseSmartWallet.js'

const VAULT = getAddress('0x4626539E5C01cc32C29755146D31755e3adA848A')
const CHARM_VAULT = getAddress('0x3DDcB21E0F21b79EA39Dd94E822a44B20131EaB2')
const CHARM_STRATEGY = getAddress('0xEA0dCE880FCdaBAe5942B836F90751b49621598c')
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
const AKITA = getAddress('0x5b674196812451B7cEC024FE9d22D2c0b172fa75')
const RESTORE_MIN_IDLE = parseUnits('5000000', 18) // 5M AKITA
const USDC_SEED = 300_000n // 0.30 USDC

const ABI = [
  {
    type: 'function',
    name: 'rebalance',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setMinimumTotalIdle',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_minimumTotalIdle', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'forceDeployToStrategies',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'baseLower',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'int24' }],
  },
  {
    type: 'function',
    name: 'baseUpper',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'int24' }],
  },
  {
    type: 'function',
    name: 'isCharmInRange',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'inRange', type: 'bool' },
      { name: 'currentTick', type: 'int24' },
      { name: 'lower', type: 'int24' },
      { name: 'upper', type: 'int24' },
    ],
  },
  {
    type: 'function',
    name: 'strategyDebt',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function readBundlerUrl(): string {
  for (const candidate of [
    process.env.CDP_PAYMASTER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT,
  ]) {
    const value = String(candidate ?? '').trim()
    if (value) return value
  }
  throw new Error('Bundler URL missing (CDP_PAYMASTER_URL).')
}

async function main(): Promise<void> {
  const smartWalletRaw = readCanonicalCswAddressEnv()
  const walletId = readCanonicalCswPrivyWalletIdEnv()
  if (!smartWalletRaw || !isAddress(smartWalletRaw)) throw new Error('CANONICAL_CSW_ADDRESS missing')
  if (!walletId) throw new Error('CANONICAL_CSW_PRIVY_WALLET_ID missing')
  const smartWallet = getAddress(smartWalletRaw)

  const rpc =
    process.env.BASE_RPC_URL?.replace(/^wss:/, 'https:')
      .replace(/^ws:/, 'http:')
      .replace('/ws/', '/rpc/') || 'https://mainnet.base.org'
  const publicClient = createPublicClient({ chain: base, transport: http(rpc) })
  const ownerIndexRaw = readCanonicalCswOwnerIndexEnv()
  const configuredOwnerIndex = ownerIndexRaw ? Number(ownerIndexRaw) : Number.NaN
  const ownerContext = await resolvePrivyCoinbaseSmartWalletOwnerContext({
    publicClient,
    walletId,
    smartWallet,
    expectedOwnerAddress: null,
    configuredOwnerIndex: Number.isFinite(configuredOwnerIndex) ? configuredOwnerIndex : null,
    allowConfiguredOwnerIndexFallback: true,
    maxScan: 512,
  })

  const usdcBal = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [smartWallet],
  })
  if (usdcBal < USDC_SEED) {
    throw new Error(`CSW USDC ${usdcBal} < seed ${USDC_SEED}`)
  }

  const calls: Array<{ to: Address; data: Hex; value: bigint }> = [
    {
      to: CHARM_VAULT,
      data: encodeFunctionData({ abi: ABI, functionName: 'rebalance' }),
      value: 0n,
    },
    {
      to: USDC,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [CHARM_STRATEGY, USDC_SEED],
      }),
      value: 0n,
    },
    {
      to: VAULT,
      data: encodeFunctionData({
        abi: ABI,
        functionName: 'setMinimumTotalIdle',
        args: [0n],
      }),
      value: 0n,
    },
    {
      to: VAULT,
      data: encodeFunctionData({ abi: ABI, functionName: 'forceDeployToStrategies' }),
      value: 0n,
    },
    {
      to: VAULT,
      data: encodeFunctionData({
        abi: ABI,
        functionName: 'setMinimumTotalIdle',
        args: [RESTORE_MIN_IDLE],
      }),
      value: 0n,
    },
  ]

  // Preflight each call (batch eth_call is awkward; check critical ones).
  for (const call of calls) {
    await publicClient.call({
      account: smartWallet,
      to: call.to,
      data: call.data,
      gas: 8_000_000n,
    })
  }

  const result = await sendPrivyCoinbaseSmartWalletUserOperation({
    publicClient,
    bundlerUrl: readBundlerUrl(),
    walletId,
    smartWallet,
    ownerAddress: ownerContext.ownerAddress,
    ownerIndex: ownerContext.ownerIndex,
    calls,
    simulate: !hasFlag('--no-simulate'),
  })

  const [baseLower, baseUpper, inRangeTuple, stratAkita, stratUsdc, charmShares, charmAkita, charmUsdc] =
    await Promise.all([
      publicClient.readContract({ address: CHARM_VAULT, abi: ABI, functionName: 'baseLower' }),
      publicClient.readContract({ address: CHARM_VAULT, abi: ABI, functionName: 'baseUpper' }),
      publicClient.readContract({ address: CHARM_STRATEGY, abi: ABI, functionName: 'isCharmInRange' }),
      publicClient.readContract({
        address: AKITA,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [CHARM_STRATEGY],
      }),
      publicClient.readContract({
        address: USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [CHARM_STRATEGY],
      }),
      publicClient.readContract({
        address: CHARM_VAULT,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [CHARM_STRATEGY],
      }),
      publicClient.readContract({
        address: AKITA,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [CHARM_VAULT],
      }),
      publicClient.readContract({
        address: USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [CHARM_VAULT],
      }),
    ])

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        txHash: result.txHash,
        userOpHash: result.userOpHash,
        charmRange: { baseLower: Number(baseLower), baseUpper: Number(baseUpper), inRange: inRangeTuple[0] },
        strategy: { akita: stratAkita.toString(), usdc: stratUsdc.toString(), charmShares: charmShares.toString() },
        charmVault: { akita: charmAkita.toString(), usdc: charmUsdc.toString() },
      },
      null,
      2,
    )}\n`,
  )
}

main().catch((error) => {
  const err = error as Error & { causeMessage?: string; cause?: unknown }
  console.error(err?.message ?? error)
  if (err?.causeMessage) console.error('causeMessage=', err.causeMessage)
  if (err?.cause) console.error('cause=', err.cause)
  process.exit(1)
})
