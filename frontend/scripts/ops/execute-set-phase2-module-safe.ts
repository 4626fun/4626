#!/usr/bin/env node
/**
 * One-shot: execute setPhase2Module on the live split batcher via the protocol treasury Safe
 * (1-of-N owner key).
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/execute-set-phase2-module-safe.ts \
 *     --phase2-module 0x<newModuleAddress>
 *
 * Loads `frontend/.env` when present (owner PK required to execute).
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import Safe from '@safe-global/protocol-kit'
import { OperationType } from '@safe-global/types-kit'
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

import { SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'
import { resolveProtocolTreasuryAddress } from '../../server/_lib/wallet/protocolTreasurySafe.js'

function loadFrontendEnvFile(): void {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
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

loadFrontendEnvFile()

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => void
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const SET_PHASE2_MODULE_ABI = [
  {
    type: 'function',
    name: 'setPhase2Module',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_phase2Module', type: 'address' }],
    outputs: [],
  },
] as const

const MODULE_BATCHER_ABI = [
  {
    type: 'function',
    name: 'batcher',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

const BATCHER_PHASE2_MODULE_ABI = [
  {
    type: 'function',
    name: 'phase2Module',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

function resolveOwnerKey(): `0x${string}` {
  const candidates = [
    process.env.PROTOCOL_TREASURY_SAFE_OWNER_PK,
    process.env.SAFE_OWNER_PRIVATE_KEY,
    process.env.PRIVATE_KEY,
  ]
  for (const raw of candidates) {
    const key = String(raw ?? '').trim()
    if (/^0x[0-9a-fA-F]{64}$/.test(key)) return key as `0x${string}`
  }
  throw new Error('Missing Safe owner private key (PROTOCOL_TREASURY_SAFE_OWNER_PK / PRIVATE_KEY)')
}

function rpcUrl(): string {
  const raw = String(process.env.BASE_RPC_URL ?? '').trim()
  if (!raw) throw new Error('BASE_RPC_URL required')
  return raw.replace('wss://', 'https://').replace('/ws/', '/rpc/')
}

async function main(): Promise<void> {
  const phase2Raw = getArg('--phase2-module')
  if (!phase2Raw || !isAddress(phase2Raw)) {
    throw new Error('--phase2-module <address> required')
  }
  const phase2Module = getAddress(phase2Raw)
  const batcher = getAddress(getArg('--batcher') ?? SPLIT_PHASE1_DEPLOYMENT_BATCHER)
  const safeAddress = resolveProtocolTreasuryAddress()
  const privateKey = resolveOwnerKey()
  const signerAddress = getAddress(privateKeyToAccount(privateKey).address)
  const rpc = rpcUrl()

  const publicClient = createPublicClient({ chain: base, transport: http(rpc) })

  // Preflight: the new module must point back at the target batcher, mirroring the
  // on-chain InvalidPhase2Module guard so a wrong address fails before the Safe tx.
  const moduleBatcher = await publicClient.readContract({
    address: phase2Module,
    abi: MODULE_BATCHER_ABI,
    functionName: 'batcher',
  })
  if (getAddress(moduleBatcher) !== batcher) {
    throw new Error(
      `module.batcher() = ${moduleBatcher} does not match target batcher ${batcher}`,
    )
  }

  const data = encodeFunctionData({
    abi: SET_PHASE2_MODULE_ABI,
    functionName: 'setPhase2Module',
    args: [phase2Module],
  })

  process.stdout.write(
    `Executing setPhase2Module(${phase2Module}) on batcher ${batcher} via Safe ${safeAddress} signer ${signerAddress}\n`,
  )

  const protocolKit = await Safe.init({
    provider: rpc,
    signer: privateKey,
    safeAddress,
  })

  const safeTransaction = await protocolKit.createTransaction({
    transactions: [{ to: batcher, value: '0', data, operation: OperationType.Call }],
  })

  const executeResponse = await protocolKit.executeTransaction(safeTransaction)
  const txHash =
    executeResponse.hash ??
    (executeResponse as { transactionResponse?: { hash?: `0x${string}` } }).transactionResponse?.hash

  if (!txHash) throw new Error('Safe execute returned no tx hash')

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })
  if (receipt.status !== 'success') throw new Error(`Safe tx reverted: ${txHash}`)

  const wired = await publicClient.readContract({
    address: batcher,
    abi: BATCHER_PHASE2_MODULE_ABI,
    functionName: 'phase2Module',
  })
  if (getAddress(wired) !== phase2Module) {
    throw new Error(`post-swap verify failed: batcher.phase2Module() = ${wired}`)
  }

  process.stdout.write(`${JSON.stringify({ ok: true, txHash, batcher, phase2Module, safeAddress }, null, 2)}\n`)

  // Hygiene note: after any production module rotation, record this txHash in
  // docs/reference/addresses.md and the active release notes.
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
