#!/usr/bin/env tsx
/**
 * Call CreatorOVault.rebalanceStrategies as vault owner (CSW).
 *
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/execute-akita-rebalance-strategies.ts \
 *     [--vault 0x...] [--min-deviation-bps 0] [--no-simulate]
 */
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, type Address, type Hex } from 'viem'
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

const REBALANCE_ABI = [
  {
    type: 'function',
    name: 'rebalanceStrategies',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'minDeviationBps', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'strategyDebt',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalAssets',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

const DEFAULT_VAULT = '0x4626539E5C01cc32C29755146D31755e3adA848A'
const AJNA = '0xa1A3A32C22b1A10Ea27D1688d48b90b1Ac6eD505'
const CHARM = '0xEA0dCE880FCdaBAe5942B836F90751b49621598c'

function getArg(name: string): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return ''
  const v = process.argv[idx + 1]
  if (!v || v.startsWith('--')) return ''
  return v
}

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
  const vaultRaw = getArg('--vault') || DEFAULT_VAULT
  if (!isAddress(vaultRaw)) throw new Error('Invalid --vault')
  const vault = getAddress(vaultRaw)
  const minDeviationBps = BigInt(getArg('--min-deviation-bps') || '0')
  const noSimulate = hasFlag('--no-simulate')

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

  const before = {
    totalAssets: await publicClient.readContract({ address: vault, abi: REBALANCE_ABI, functionName: 'totalAssets' }),
    ajnaDebt: await publicClient.readContract({
      address: vault,
      abi: REBALANCE_ABI,
      functionName: 'strategyDebt',
      args: [AJNA as Address],
    }),
    charmDebt: await publicClient.readContract({
      address: vault,
      abi: REBALANCE_ABI,
      functionName: 'strategyDebt',
      args: [CHARM as Address],
    }),
  }

  const data = encodeFunctionData({
    abi: REBALANCE_ABI,
    functionName: 'rebalanceStrategies',
    args: [minDeviationBps],
  })

  await publicClient.call({
    account: smartWallet,
    to: vault,
    data,
    gas: 8_000_000n,
  })

  const result = await sendPrivyCoinbaseSmartWalletUserOperation({
    publicClient,
    bundlerUrl: readBundlerUrl(),
    walletId,
    smartWallet,
    ownerAddress: ownerContext.ownerAddress,
    ownerIndex: ownerContext.ownerIndex,
    calls: [{ to: vault, data, value: 0n }],
    simulate: !noSimulate,
  })

  const after = {
    totalAssets: await publicClient.readContract({ address: vault, abi: REBALANCE_ABI, functionName: 'totalAssets' }),
    ajnaDebt: await publicClient.readContract({
      address: vault,
      abi: REBALANCE_ABI,
      functionName: 'strategyDebt',
      args: [AJNA as Address],
    }),
    charmDebt: await publicClient.readContract({
      address: vault,
      abi: REBALANCE_ABI,
      functionName: 'strategyDebt',
      args: [CHARM as Address],
    }),
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        vault,
        minDeviationBps: minDeviationBps.toString(),
        txHash: result.txHash,
        userOpHash: result.userOpHash,
        before: {
          totalAssets: before.totalAssets.toString(),
          ajnaDebt: before.ajnaDebt.toString(),
          charmDebt: before.charmDebt.toString(),
        },
        after: {
          totalAssets: after.totalAssets.toString(),
          ajnaDebt: after.ajnaDebt.toString(),
          charmDebt: after.charmDebt.toString(),
        },
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
