#!/usr/bin/env tsx
/**
 * Add the canonical keeper automation EOA as an owner on the protocol treasury/automation Safe.
 *
 * Usage:
 *   pnpm -C frontend ops:add-keeper-safe-owner -- --dry-run
 *   pnpm -C frontend ops:add-keeper-safe-owner -- --execute
 *
 * Requires PRIVATE_KEY (or PROTOCOL_TREASURY_SAFE_OWNER_PK) for an existing Safe owner.
 */

import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'

import { CANONICAL_KEEPER_AUTOMATION_EOA } from '../../server/_lib/wallet/keeperAutomationPolicy.js'
import {
  executeViaProtocolTreasurySafe,
  resolveProtocolAutomationAddress,
  resolveProtocolTreasuryAddress,
} from '../../server/_lib/wallet/protocolTreasurySafe.js'

const SAFE_OWNER_MGMT_ABI = [
  {
    type: 'function',
    name: 'addOwnerWithThreshold',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: '_threshold', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isOwner',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getThreshold',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

function parseArgs(): { dryRun: boolean; execute: boolean; owner: Address } {
  const argv = process.argv.slice(2)
  const execute = argv.includes('--execute')
  const dryRun = argv.includes('--dry-run') || !execute
  const ownerIdx = argv.indexOf('--owner')
  const ownerRaw = ownerIdx >= 0 ? argv[ownerIdx + 1] : CANONICAL_KEEPER_AUTOMATION_EOA
  if (!ownerRaw || !isAddress(ownerRaw)) {
    throw new Error('invalid --owner address')
  }
  return { dryRun, execute, owner: getAddress(ownerRaw) }
}

async function main(): Promise<void> {
  const { dryRun, execute, owner } = parseArgs()
  const rpcUrl = (process.env.BASE_RPC_URL ?? process.env.VITE_BASE_RPC_URL ?? 'https://mainnet.base.org').trim()
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })

  const safeAddress = resolveProtocolAutomationAddress() ?? resolveProtocolTreasuryAddress()
  const alreadyOwner = await publicClient.readContract({
    address: safeAddress,
    abi: SAFE_OWNER_MGMT_ABI,
    functionName: 'isOwner',
    args: [owner],
  })
  if (alreadyOwner) {
    console.log(`Safe ${safeAddress} already lists ${owner} as owner — nothing to do.`)
    return
  }

  const threshold = await publicClient.readContract({
    address: safeAddress,
    abi: SAFE_OWNER_MGMT_ABI,
    functionName: 'getThreshold',
  })

  const data = encodeFunctionData({
    abi: SAFE_OWNER_MGMT_ABI,
    functionName: 'addOwnerWithThreshold',
    args: [owner, threshold],
  }) as Hex

  console.log(`Safe: ${safeAddress}`)
  console.log(`New owner: ${owner}`)
  console.log(`Threshold unchanged: ${threshold}`)
  console.log(`Calldata: ${data}`)

  if (dryRun) {
    console.log('\nDry run only. Re-run with --execute to broadcast via protocol treasury Safe.')
    return
  }

  const result = await executeViaProtocolTreasurySafe({
    publicClient,
    rpcUrl,
    to: safeAddress,
    data,
    value: 0n,
  })

  console.log(`\nSubmitted addOwnerWithThreshold via Safe.`)
  console.log(`Signer: ${result.signerAddress}`)
  console.log(`Tx: ${result.txHash}`)
  console.log(`https://basescan.org/tx/${result.txHash}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
