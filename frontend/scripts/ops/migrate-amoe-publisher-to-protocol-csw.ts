#!/usr/bin/env node
/**
 * Point LotteryAmoeRouter publisher roles at PROTOCOL_CSW_ADDRESS (0x793c…).
 *
 * Usage:
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/migrate-amoe-publisher-to-protocol-csw.ts --dry-run
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/migrate-amoe-publisher-to-protocol-csw.ts --apply
 */

import { createPublicClient, createWalletClient, getAddress, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { resolveServerAgentCswAddress } from '../../server/_lib/wallet/canonicalCswEnv.js'

const ROUTER_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'allowlistPublisher',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'pointsLedgerPublisher',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'setAllowlistPublisher',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_publisher', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setPointsLedgerPublisher',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_publisher', type: 'address' }],
    outputs: [],
  },
] as const

const dryRun = process.argv.includes('--dry-run')
const apply = process.argv.includes('--apply')

function readRouterAddress(): `0x${string}` {
  const raw = String(process.env.LOTTERY_AMOE_ROUTER ?? '').trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) {
    throw new Error('LOTTERY_AMOE_ROUTER missing or invalid')
  }
  return getAddress(raw) as `0x${string}`
}

function readOwnerPrivateKey(): `0x${string}` {
  const raw = String(process.env.PRIVATE_KEY ?? '').trim()
  if (!/^0x[a-fA-F0-9]{64}$/.test(raw)) {
    throw new Error('PRIVATE_KEY missing or invalid (router owner must sign)')
  }
  return raw as `0x${string}`
}

async function main() {
  if (!dryRun && !apply) {
    throw new Error('Pass --dry-run or --apply')
  }

  const router = readRouterAddress()
  const protocolCsw = getAddress(resolveServerAgentCswAddress()) as `0x${string}`
  const rpcUrl =
    String(process.env.BASE_RPC_URL ?? '')
      .split(/[\s,]+/g)
      .map((v) => v.trim())
      .find(Boolean) ?? 'https://mainnet.base.org'

  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const [owner, allowlistPublisher, pointsLedgerPublisher] = await Promise.all([
    publicClient.readContract({ address: router, abi: ROUTER_ABI, functionName: 'owner' }),
    publicClient.readContract({ address: router, abi: ROUTER_ABI, functionName: 'allowlistPublisher' }),
    publicClient.readContract({ address: router, abi: ROUTER_ABI, functionName: 'pointsLedgerPublisher' }),
  ])

  console.log('[amoe-migrate] router', router)
  console.log('[amoe-migrate] owner', owner)
  console.log('[amoe-migrate] current allowlistPublisher', allowlistPublisher)
  console.log('[amoe-migrate] current pointsLedgerPublisher', pointsLedgerPublisher)
  console.log('[amoe-migrate] target protocol CSW', protocolCsw)

  const needsAllowlist = getAddress(allowlistPublisher).toLowerCase() !== protocolCsw.toLowerCase()
  const needsLedger = getAddress(pointsLedgerPublisher).toLowerCase() !== protocolCsw.toLowerCase()

  if (!needsAllowlist && !needsLedger) {
    console.log('[amoe-migrate] already migrated — nothing to do')
    return
  }

  if (dryRun) {
    console.log('[amoe-migrate] dry-run only')
    if (needsAllowlist) console.log('  would call setAllowlistPublisher')
    if (needsLedger) console.log('  would call setPointsLedgerPublisher')
    return
  }

  const account = privateKeyToAccount(readOwnerPrivateKey())
  if (getAddress(owner).toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`PRIVATE_KEY (${account.address}) is not router owner (${owner})`)
  }

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
  })

  if (needsAllowlist) {
    const hash = await walletClient.writeContract({
      address: router,
      abi: ROUTER_ABI,
      functionName: 'setAllowlistPublisher',
      args: [protocolCsw],
    })
    console.log('[amoe-migrate] setAllowlistPublisher tx', hash)
    await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 })
  }

  if (needsLedger) {
    const hash = await walletClient.writeContract({
      address: router,
      abi: ROUTER_ABI,
      functionName: 'setPointsLedgerPublisher',
      args: [protocolCsw],
    })
    console.log('[amoe-migrate] setPointsLedgerPublisher tx', hash)
    await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 })
  }

  const [nextAllowlist, nextLedger] = await Promise.all([
    publicClient.readContract({ address: router, abi: ROUTER_ABI, functionName: 'allowlistPublisher' }),
    publicClient.readContract({ address: router, abi: ROUTER_ABI, functionName: 'pointsLedgerPublisher' }),
  ])
  console.log('[amoe-migrate] verified allowlistPublisher', nextAllowlist)
  console.log('[amoe-migrate] verified pointsLedgerPublisher', nextLedger)
}

main().catch((error) => {
  console.error(`[amoe-migrate] failed: ${String(error instanceof Error ? error.message : error)}`)
  process.exit(1)
})
