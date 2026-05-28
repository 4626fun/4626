#!/usr/bin/env node
/**
 * One-shot: execute setPhase1Module on live split batcher via protocol treasury Safe (1-of-N owner key).
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/execute-set-phase1-module-safe.ts \
 *     --phase1-module 0xcE369BE1D89634E7Ab3d6Dc0f943B2780BF2D889
 */

import Safe from '@safe-global/protocol-kit'
import { OperationType } from '@safe-global/types-kit'
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

import { SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'
import { resolveProtocolTreasuryAddress } from '../../server/_lib/wallet/protocolTreasurySafe.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => void
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const SET_PHASE1_MODULE_ABI = [
  {
    type: 'function',
    name: 'setPhase1Module',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_phase1Module', type: 'address' }],
    outputs: [],
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
  const phase1Raw = getArg('--phase1-module')
  if (!phase1Raw || !isAddress(phase1Raw)) {
    throw new Error('--phase1-module <address> required')
  }
  const phase1Module = getAddress(phase1Raw)
  const batcher = getAddress(getArg('--batcher') ?? SPLIT_PHASE1_DEPLOYMENT_BATCHER)
  const safeAddress = resolveProtocolTreasuryAddress()
  const privateKey = resolveOwnerKey()
  const signerAddress = getAddress(privateKeyToAccount(privateKey).address)
  const rpc = rpcUrl()

  const data = encodeFunctionData({
    abi: SET_PHASE1_MODULE_ABI,
    functionName: 'setPhase1Module',
    args: [phase1Module],
  })

  process.stdout.write(
    `Executing setPhase1Module(${phase1Module}) on batcher ${batcher} via Safe ${safeAddress} signer ${signerAddress}\n`,
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

  const publicClient = createPublicClient({ chain: base, transport: http(rpc) })
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })
  if (receipt.status !== 'success') throw new Error(`Safe tx reverted: ${txHash}`)

  process.stdout.write(`${JSON.stringify({ ok: true, txHash, batcher, phase1Module, safeAddress }, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
