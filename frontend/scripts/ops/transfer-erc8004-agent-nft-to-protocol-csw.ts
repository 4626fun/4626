#!/usr/bin/env node
/**
 * Transfer ERC-8004 Identity Registry agent NFT #2205 from operator CSW → protocol CSW.
 *
 * Before: ownerOf(2205) = CANONICAL_CSW_ADDRESS (0xAb6d5…)
 * After:  ownerOf(2205) = PROTOCOL_CSW_ADDRESS (0x793c…)
 *
 * Executes via operator CSW UserOp (Privy owner on slot CANONICAL_CSW_OWNER_INDEX).
 *
 * Usage:
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/transfer-erc8004-agent-nft-to-protocol-csw.ts --dry-run
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/transfer-erc8004-agent-nft-to-protocol-csw.ts --apply
 */

import { createPublicClient, encodeFunctionData, getAddress, http, type Address } from 'viem'
import { base } from 'viem/chains'

import { IDENTITY_REGISTRY_ABI } from '../../server/_lib/agent/erc8004.js'
import {
  readCanonicalCswAddressEnv,
  readCanonicalCswOwnerIndexEnv,
  readCanonicalCswPrivyWalletIdEnv,
  resolveServerAgentCswAddress,
} from '../../server/_lib/wallet/canonicalCswEnv.js'
import {
  resolvePrivyCoinbaseSmartWalletOwnerContext,
  sendPrivyCoinbaseSmartWalletUserOperation,
} from '../../server/_lib/wallet/privyCoinbaseSmartWallet.js'

const ERC721_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'safeTransferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

const dryRun = process.argv.includes('--dry-run')
const apply = process.argv.includes('--apply')

function readBundlerUrl(): string {
  const candidates = [
    process.env.CDP_PAYMASTER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_URL,
    process.env.AMOE_LEDGER_PUBLISHER_BUNDLER_URL,
    process.env.KPR_ERC4337_BUNDLER_URL,
  ]
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim()
    if (value) return value
  }
  throw new Error('Bundler URL missing (CDP_PAYMASTER_URL or AMOE_LEDGER_PUBLISHER_BUNDLER_URL).')
}

function readRpcUrl(): string {
  const raw = String(process.env.BASE_RPC_URL ?? '').trim()
  if (raw) return raw
  return 'https://mainnet.base.org'
}

async function main() {
  if (!dryRun && !apply) {
    throw new Error('Pass --dry-run or --apply.')
  }

  const agentId = BigInt(String(process.env.ERC8004_AGENT_ID ?? '2205').trim())
  const registryRaw = String(process.env.ERC8004_AGENT_REGISTRY ?? '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432').trim()
  const fromRaw = readCanonicalCswAddressEnv()
  const toRaw = resolveServerAgentCswAddress()
  const walletId = readCanonicalCswPrivyWalletIdEnv()
  const ownerIndexRaw = readCanonicalCswOwnerIndexEnv()

  if (!fromRaw || !toRaw) throw new Error('CANONICAL_CSW_ADDRESS and PROTOCOL_CSW_ADDRESS required.')
  if (!walletId) throw new Error('CANONICAL_CSW_PRIVY_WALLET_ID missing.')

  const registry = getAddress(registryRaw) as Address
  const from = getAddress(fromRaw) as Address
  const to = getAddress(toRaw) as Address
  const configuredOwnerIndex = ownerIndexRaw ? Number(ownerIndexRaw) : Number.NaN

  const publicClient = createPublicClient({ chain: base, transport: http(readRpcUrl()) })
  const owner = (await publicClient.readContract({
    address: registry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'ownerOf',
    args: [agentId],
  })) as Address

  console.log(`[erc8004-transfer] registry=${registry}`)
  console.log(`[erc8004-transfer] agentId=${agentId}`)
  console.log(`[erc8004-transfer] currentOwner=${owner}`)
  console.log(`[erc8004-transfer] from=${from}`)
  console.log(`[erc8004-transfer] to=${to}`)

  if (owner.toLowerCase() === to.toLowerCase()) {
    console.log('[erc8004-transfer] already owned by protocol CSW — nothing to do.')
    return
  }

  if (owner.toLowerCase() !== from.toLowerCase()) {
    throw new Error(`Unexpected owner ${owner}; expected operator CSW ${from}.`)
  }

  const callData = encodeFunctionData({
    abi: ERC721_TRANSFER_ABI,
    functionName: 'safeTransferFrom',
    args: [from, to, agentId],
  })

  if (dryRun) {
    console.log('[erc8004-transfer] dry-run only — would safeTransferFrom(operator, protocol, 2205)')
    return
  }

  const bundlerUrl = readBundlerUrl()
  const ownerContext = await resolvePrivyCoinbaseSmartWalletOwnerContext({
    publicClient,
    walletId,
    smartWallet: from,
    expectedOwnerAddress: null,
    configuredOwnerIndex: Number.isFinite(configuredOwnerIndex) ? configuredOwnerIndex : null,
    allowConfiguredOwnerIndexFallback: true,
    maxScan: 512,
  })

  console.log(`[erc8004-transfer] submitting UserOp from operator CSW ownerIndex=${ownerContext.ownerIndex}`)

  const result = await sendPrivyCoinbaseSmartWalletUserOperation({
    publicClient,
    bundlerUrl,
    walletId,
    smartWallet: from,
    ownerAddress: ownerContext.ownerAddress,
    ownerIndex: ownerContext.ownerIndex,
    calls: [{ to: registry, data: callData }],
    simulate: false,
  })

  console.log(`userOpHash=${result.userOpHash}`)
  console.log(`txHash=${result.txHash}`)

  const newOwner = (await publicClient.readContract({
    address: registry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'ownerOf',
    args: [agentId],
  })) as Address
  console.log(`[erc8004-transfer] verified ownerOf=${newOwner}`)
}

main().catch((error) => {
  console.error(`[erc8004-transfer] failed: ${String(error instanceof Error ? error.message : error)}`)
  process.exit(1)
})
