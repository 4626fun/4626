#!/usr/bin/env node
/**
 * Wire a freshly deployed DeploymentBatcherPhase3Helper via protocol-treasury Safe.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/wire-phase3-helper-safe.ts \
 *     --phase3-helper 0x... \
 *     --batcher 0xa99058f424FB3ACC639F59355C65C40149030651
 */

import Safe from '@safe-global/protocol-kit'
import { OperationType } from '@safe-global/types-kit'
import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'

import { SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const BATCHER_ABI = [
  {
    type: 'function',
    name: 'wireDeploymentHelpers',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'phase2Module', type: 'address' },
      { name: 'phase3Helper', type: 'address' },
      { name: 'uniV4Helper', type: 'address' },
      { name: 'utilsHelper', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'phase3Helper',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'phase2Module',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'uniV4Helper',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'utilsHelper',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Missing Safe owner private key (PRIVATE_KEY)')
  return (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as `0x${string}`
}

async function main(): Promise<void> {
  const batcher = getAddress(
    getArg('--batcher', SPLIT_PHASE1_DEPLOYMENT_BATCHER) as Address,
  )
  const phase3HelperArg = getArg('--phase3-helper', '')
  if (!isAddress(phase3HelperArg)) {
    throw new Error('Missing --phase3-helper <address>')
  }
  const phase3Helper = getAddress(phase3HelperArg)

  const safeAddress = getAddress(
    getArg('--safe-address', process.env.PROTOCOL_TREASURY || process.env.VITE_PROTOCOL_TREASURY || '') as Address,
  )
  const rpcUrl = getArg('--rpc', process.env.BASE_RPC_URL || 'https://mainnet.base.org')
  const privateKey = normalizePrivateKey(
    getArg('--safe-owner-pk', process.env.PRIVATE_KEY || process.env.SAFE_OWNER_PRIVATE_KEY || ''),
  )

  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const [phase2Module, uniV4Helper, utilsHelper, currentHelper] = await Promise.all([
    client.readContract({ address: batcher, abi: BATCHER_ABI, functionName: 'phase2Module' }),
    client.readContract({ address: batcher, abi: BATCHER_ABI, functionName: 'uniV4Helper' }),
    client.readContract({ address: batcher, abi: BATCHER_ABI, functionName: 'utilsHelper' }),
    client.readContract({ address: batcher, abi: BATCHER_ABI, functionName: 'phase3Helper' }),
  ])

  const data = encodeFunctionData({
    abi: BATCHER_ABI,
    functionName: 'wireDeploymentHelpers',
    args: [phase2Module, phase3Helper, uniV4Helper, utilsHelper],
  }) as Hex

  const protocolKit = await Safe.init({ provider: rpcUrl, signer: privateKey, safeAddress })
  const safeTx = await protocolKit.createTransaction({
    transactions: [{ to: batcher, value: '0', data, operation: OperationType.Call }],
  })
  const exec = await protocolKit.executeTransaction(safeTx)
  const hash = (exec.hash ?? exec.transactionResponse?.hash) as `0x${string}` | undefined
  if (!hash) throw new Error('Safe execute returned no tx hash')

  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180_000 })
  const wiredHelper = await client.readContract({
    address: batcher,
    abi: BATCHER_ABI,
    functionName: 'phase3Helper',
  })

  const ok = wiredHelper.toLowerCase() === phase3Helper.toLowerCase()
  process.stdout.write(
    `${JSON.stringify(
      {
        ok,
        safeAddress,
        batcher,
        previousPhase3Helper: currentHelper,
        newPhase3Helper: phase3Helper,
        wiredPhase3Helper: wiredHelper,
        txHash: hash,

  // Hygiene note (from 2026-05 general audit): After any production module rotation,
  // record the tx hash and ensure the new module's code ID is added to the active
  // bytecode manifest and seeded into the UniversalBytecodeStore.
  // See docs/audits/general-audit-2026-05.md (source-vs-deployed section).
        status: receipt.status,
        blockNumber: receipt.blockNumber.toString(),
      },
      null,
      2,
    )}\n`,
  )
  if (!ok) process.exit(1)
}

main().catch((error: unknown) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
