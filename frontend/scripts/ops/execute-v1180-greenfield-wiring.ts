#!/usr/bin/env node
/**
 * Execute v1.18.0 greenfield post-broadcast Safe wiring on the live batcher shell.
 *
 * Runs (via protocol treasury Safe, 1-of-N):
 *   1. wireDeploymentHelpers
 *   2. setPhase1Module
 *   3. setSolanaConfig (when SOLANA_BRIDGE_ADAPTER + SOLANA_DESTINATION are set)
 *   4. setOVaultRuntimeConfig (when CONFIGURE_OVAULT_RUNTIME=1)
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/execute-v1180-greenfield-wiring.ts
 *   pnpm -C frontend exec tsx scripts/ops/execute-v1180-greenfield-wiring.ts --dry-run
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import Safe from '@safe-global/protocol-kit'
import { OperationType } from '@safe-global/types-kit'
import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  keccak256,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

import {
  SPLIT_PHASE1_DEPLOYMENT_BATCHER,
  SPLIT_PHASE1_PHASE1_MODULE,
  SPLIT_PHASE1_PHASE2_MODULE,
  SPLIT_PHASE1_PHASE3_HELPER,
  SPLIT_PHASE1_SHARE_MESH_HELPER,
  SPLIT_PHASE1_UTILS_HELPER,
} from '../../src/config/contracts.defaults.js'
import { resolveProtocolTreasuryAddress } from '../../server/_lib/wallet/protocolTreasurySafe.js'

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
    name: 'approvePhaseModuleCodehash',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'module', type: 'address' },
      { name: 'codehash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'wireDeploymentHelpers',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_phase2Module', type: 'address' },
      { name: '_phase3Helper', type: 'address' },
      { name: '_shareMeshHelper', type: 'address' },
      { name: '_utilsHelper', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setPhase1Module',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_phase1Module', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setSolanaConfig',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_adapter', type: 'address' },
      { name: '_destination', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setOVaultRuntimeConfig',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_hubComposer', type: 'address' },
      { name: '_solanaEid', type: 'uint32' },
      { name: '_enabled', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'phase1Module',
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
] as const

function loadEnvFiles(): void {
  for (const rel of ['../../.env', '../../../.env']) {
    const envPath = resolve(dirname(fileURLToPath(import.meta.url)), rel)
    if (!existsSync(envPath)) continue
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const eq = trimmed.indexOf('=')
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
  }
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  const v = String(raw ?? '').trim().toLowerCase()
  if (!v) return fallback
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return fallback
}

function assertBytes32(raw: string): Hex {
  const value = raw.trim().toLowerCase()
  if (!/^0x[0-9a-f]{64}$/.test(value)) {
    throw new Error(`Invalid bytes32: ${raw}`)
  }
  return value as Hex
}

function resolveOwnerKey(): `0x${string}` {
  for (const key of ['PROTOCOL_TREASURY_SAFE_OWNER_PK', 'PRIVATE_KEY', 'SAFE_OWNER_PRIVATE_KEY']) {
    const raw = String(process.env[key] ?? '').trim()
    if (/^0x[0-9a-fA-F]{64}$/.test(raw)) return raw as `0x${string}`
  }
  throw new Error('Missing Safe owner private key (PROTOCOL_TREASURY_SAFE_OWNER_PK / PRIVATE_KEY)')
}

function rpcUrl(): string {
  const raw = String(process.env.BASE_RPC_URL ?? '').trim()
  if (!raw) throw new Error('BASE_RPC_URL required')
  return raw.replace('wss://', 'https://').replace('/ws/', '/rpc/')
}

type OpSpec = { label: string; data: Hex }

async function main(): Promise<void> {
  loadEnvFiles()
  const dryRun = hasFlag('--dry-run')

  const batcher = getAddress(
    (process.env.DEPLOYMENT_BATCHER || SPLIT_PHASE1_DEPLOYMENT_BATCHER) as Address,
  )
  // Prefer handoff/env pins (greenfield cutover) over contracts.defaults.
  const phase1Module = getAddress(
    (process.env.DEPLOYMENT_BATCHER_PHASE1_MODULE || SPLIT_PHASE1_PHASE1_MODULE) as Address,
  )
  const phase2Module = getAddress(
    (process.env.DEPLOYMENT_BATCHER_PHASE2_MODULE || SPLIT_PHASE1_PHASE2_MODULE) as Address,
  )
  const phase3Helper = getAddress(
    (process.env.DEPLOYMENT_BATCHER_PHASE3_HELPER || SPLIT_PHASE1_PHASE3_HELPER) as Address,
  )
  const shareMeshHelper = getAddress(
    (process.env.DEPLOYMENT_BATCHER_SHARE_MESH_HELPER || SPLIT_PHASE1_SHARE_MESH_HELPER) as Address,
  )
  const utilsHelper = getAddress(
    (process.env.DEPLOYMENT_BATCHER_UTILS_HELPER || SPLIT_PHASE1_UTILS_HELPER) as Address,
  )

  const rpc = rpcUrl()
  const publicClientForHash = createPublicClient({ chain: base, transport: http(rpc) })
  const [phase1Bytecode, phase2Bytecode] = await Promise.all([
    publicClientForHash.getBytecode({ address: phase1Module }),
    publicClientForHash.getBytecode({ address: phase2Module }),
  ])
  if (!phase1Bytecode || phase1Bytecode === '0x') {
    throw new Error(`No runtime bytecode at phase1 module ${phase1Module}`)
  }
  if (!phase2Bytecode || phase2Bytecode === '0x') {
    throw new Error(`No runtime bytecode at phase2 module ${phase2Module}`)
  }
  const phase1Codehash = keccak256(phase1Bytecode as Hex)
  const phase2Codehash = keccak256(phase2Bytecode as Hex)

  const ops: OpSpec[] = [
    {
      label: 'approvePhaseModuleCodehash(phase2)',
      data: encodeFunctionData({
        abi: BATCHER_ABI,
        functionName: 'approvePhaseModuleCodehash',
        args: [phase2Module, phase2Codehash],
      }),
    },
    {
      label: 'approvePhaseModuleCodehash(phase1)',
      data: encodeFunctionData({
        abi: BATCHER_ABI,
        functionName: 'approvePhaseModuleCodehash',
        args: [phase1Module, phase1Codehash],
      }),
    },
    {
      label: 'wireDeploymentHelpers',
      data: encodeFunctionData({
        abi: BATCHER_ABI,
        functionName: 'wireDeploymentHelpers',
        args: [phase2Module, phase3Helper, shareMeshHelper, utilsHelper],
      }),
    },
    {
      label: 'setPhase1Module',
      data: encodeFunctionData({
        abi: BATCHER_ABI,
        functionName: 'setPhase1Module',
        args: [phase1Module],
      }),
    },
  ]

  const adapterRaw = String(process.env.SOLANA_BRIDGE_ADAPTER ?? '').trim()
  const destinationRaw = String(process.env.SOLANA_DESTINATION ?? '').trim()
  if (adapterRaw && destinationRaw) {
    if (!isAddress(adapterRaw)) throw new Error('Invalid SOLANA_BRIDGE_ADAPTER')
    ops.push({
      label: 'setSolanaConfig',
      data: encodeFunctionData({
        abi: BATCHER_ABI,
        functionName: 'setSolanaConfig',
        args: [getAddress(adapterRaw), assertBytes32(destinationRaw)],
      }),
    })
  }

  if (parseBool(process.env.CONFIGURE_OVAULT_RUNTIME, false)) {
    const hubRaw = String(process.env.OVAULT_HUB_COMPOSER ?? '').trim()
    const eidRaw = Number(String(process.env.OVAULT_SOLANA_EID ?? '').trim())
    if (!isAddress(hubRaw)) throw new Error('CONFIGURE_OVAULT_RUNTIME=1 requires OVAULT_HUB_COMPOSER')
    if (!Number.isFinite(eidRaw) || eidRaw <= 0) throw new Error('CONFIGURE_OVAULT_RUNTIME=1 requires OVAULT_SOLANA_EID')
    ops.push({
      label: 'setOVaultRuntimeConfig',
      data: encodeFunctionData({
        abi: BATCHER_ABI,
        functionName: 'setOVaultRuntimeConfig',
        args: [getAddress(hubRaw), eidRaw, true],
      }),
    })
  }

  const safeAddress = resolveProtocolTreasuryAddress()
  const privateKey = resolveOwnerKey()
  const signerAddress = getAddress(privateKeyToAccount(privateKey).address)

  process.stdout.write(
    `${JSON.stringify(
      {
        dryRun,
        safeAddress,
        signerAddress,
        batcher,
        phase1Module,
        phase2Module,
        phase1Codehash,
        phase2Codehash,
        phase3Helper,
        shareMeshHelper,
        utilsHelper,
        ops: ops.map((op) => op.label),
      },
      null,
      2,
    )}\n`,
  )

  if (dryRun) return

  const publicClient = createPublicClient({ chain: base, transport: http(rpc) })
  const protocolKit = await Safe.init({ provider: rpc, signer: privateKey, safeAddress })
  const results: Array<{ label: string; txHash: string; status: string }> = []

  for (const op of ops) {
    const safeTx = await protocolKit.createTransaction({
      transactions: [{ to: batcher, value: '0', data: op.data, operation: OperationType.Call }],
    })
    const exec = await protocolKit.executeTransaction(safeTx)
    const hash = (exec.hash ??
      (exec as { transactionResponse?: { hash?: `0x${string}` } }).transactionResponse?.hash) as
      | `0x${string}`
      | undefined
    if (!hash) throw new Error(`Safe execute returned no tx hash for ${op.label}`)
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 })
    if (receipt.status !== 'success') throw new Error(`Safe tx reverted (${op.label}): ${hash}`)
    results.push({ label: op.label, txHash: hash, status: receipt.status })
  }

  const [livePhase1, livePhase2] = await Promise.all([
    publicClient.readContract({ address: batcher, abi: BATCHER_ABI, functionName: 'phase1Module' }),
    publicClient.readContract({ address: batcher, abi: BATCHER_ABI, functionName: 'phase2Module' }),
  ])

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        results,
        livePhase1Module: livePhase1,
        livePhase2Module: livePhase2,
      },
      null,
      2,
    )}\n`,
  )
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
