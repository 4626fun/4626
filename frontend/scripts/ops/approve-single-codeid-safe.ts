#!/usr/bin/env node
/**
 * Approve a single DeploymentBatcher codeId via the protocol treasury Safe.
 *
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/approve-single-codeid-safe.ts \
 *     --code-id 0x... [--batcher 0x...]
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import Safe from '@safe-global/protocol-kit'
import { OperationType } from '@safe-global/types-kit'
import { createPublicClient, encodeFunctionData, getAddress, http, isHex, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { resolveProtocolTreasuryAddress } from '../../server/_lib/wallet/protocolTreasurySafe.js'
import { SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'

const BATCHER_CODE_ID_ABI = [
  {
    type: 'function',
    name: 'setApprovedCodeIds',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'codeIds', type: 'bytes32[]' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approvedCodeIds',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

function loadFrontendEnvFile(): void {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const equals = trimmed.indexOf('=')
    if (equals === -1) continue
    const key = trimmed.slice(0, equals).trim()
    let value = trimmed.slice(equals + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index === -1 ? undefined : process.argv[index + 1]
}

function ownerKey(): Hex {
  for (const raw of [
    process.env.PROTOCOL_TREASURY_SAFE_OWNER_PK,
    process.env.SAFE_OWNER_PRIVATE_KEY,
    process.env.PRIVATE_KEY,
  ]) {
    const value = String(raw ?? '').trim()
    if (/^0x[0-9a-fA-F]{64}$/.test(value)) return value as Hex
  }
  throw new Error('Missing protocol treasury Safe owner private key')
}

function rpcUrl(): string {
  const value = String(process.env.BASE_RPC_URL ?? '').trim()
  if (!value) throw new Error('BASE_RPC_URL required')
  return value.replace('wss://', 'https://').replace('/ws/', '/rpc/')
}

async function main(): Promise<void> {
  loadFrontendEnvFile()
  const codeIdRaw = arg('--code-id')
  if (!codeIdRaw || !isHex(codeIdRaw) || codeIdRaw.length !== 66) {
    throw new Error('--code-id 0x…32bytes required')
  }
  const codeId = codeIdRaw.toLowerCase() as Hex
  const batcher = getAddress(arg('--batcher') ?? SPLIT_PHASE1_DEPLOYMENT_BATCHER)
  const safeAddress = resolveProtocolTreasuryAddress()
  const key = ownerKey()
  const signer = privateKeyToAccount(key)
  const rpc = rpcUrl()
  const publicClient = createPublicClient({ chain: base, transport: http(rpc) })

  const already = await publicClient.readContract({
    address: batcher,
    abi: BATCHER_CODE_ID_ABI,
    functionName: 'approvedCodeIds',
    args: [codeId],
  })
  if (already) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, skipped: true, codeId, batcher, safeAddress }, null, 2)}\n`,
    )
    return
  }

  const data = encodeFunctionData({
    abi: BATCHER_CODE_ID_ABI,
    functionName: 'setApprovedCodeIds',
    args: [[codeId], true],
  })
  const protocolKit = await Safe.init({ provider: rpc, signer: key, safeAddress })
  const safeTransaction = await protocolKit.createTransaction({
    transactions: [{ to: batcher, value: '0', data, operation: OperationType.Call }],
  })
  const response = await protocolKit.executeTransaction(safeTransaction)
  const txHash =
    response.hash ??
    (response as { transactionResponse?: { hash?: Hex } }).transactionResponse?.hash
  if (!txHash) throw new Error('Safe execute returned no tx hash')

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })
  if (receipt.status !== 'success') throw new Error(`Safe codeId approval reverted: ${txHash}`)
  const approved = await publicClient.readContract({
    address: batcher,
    abi: BATCHER_CODE_ID_ABI,
    functionName: 'approvedCodeIds',
    args: [codeId],
  })
  if (!approved) throw new Error(`CodeId approval did not stick: ${codeId}`)

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        codeId,
        batcher,
        safeAddress,
        signer: signer.address,
        txHash,
      },
      null,
      2,
    )}\n`,
  )
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
