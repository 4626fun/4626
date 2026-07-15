#!/usr/bin/env node
/**
 * Wire Solana destination + OVault runtime on the live DeploymentBatcher via treasury Safe.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/wire-v1191-solana-ovault-safe.ts
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
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { resolveProtocolTreasuryAddress } from '../../server/_lib/wallet/protocolTreasurySafe.js'

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

const ABI = [
  {
    type: 'function',
    name: 'setSolanaDestination',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_destination', type: 'bytes32' }],
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
    name: 'solanaDestination',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'getOVaultRuntimeConfig',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'hubComposer', type: 'address' },
          { name: 'solanaEid', type: 'uint32' },
          { name: 'enabled', type: 'bool' },
        ],
      },
    ],
  },
] as const

function resolveOwnerKey(): `0x${string}` {
  for (const key of ['PROTOCOL_TREASURY_SAFE_OWNER_PK', 'PRIVATE_KEY', 'SAFE_OWNER_PRIVATE_KEY']) {
    const raw = String(process.env[key] ?? '').trim()
    if (/^0x[0-9a-fA-F]{64}$/.test(raw)) return raw as `0x${string}`
  }
  throw new Error('Missing Safe owner private key')
}

async function main(): Promise<void> {
  loadEnvFiles()
  const batcher = getAddress(String(process.env.DEPLOYMENT_BATCHER) as Address)
  const destination = String(process.env.SOLANA_DESTINATION ?? '').trim().toLowerCase() as Hex
  if (!/^0x[0-9a-f]{64}$/.test(destination)) throw new Error('SOLANA_DESTINATION required')
  const hub = getAddress(String(process.env.OVAULT_HUB_COMPOSER) as Address)
  const eid = Number(String(process.env.OVAULT_SOLANA_EID ?? '').trim())
  if (!Number.isFinite(eid) || eid <= 0) throw new Error('OVAULT_SOLANA_EID required')

  const safeAddress = resolveProtocolTreasuryAddress()
  const privateKey = resolveOwnerKey()
  const rpc = String(process.env.BASE_RPC_URL ?? '')
    .trim()
    .replace('wss://', 'https://')
    .replace('/ws/', '/rpc/')
  if (!rpc) throw new Error('BASE_RPC_URL required')

  const ops = [
    {
      label: 'setSolanaDestination',
      data: encodeFunctionData({
        abi: ABI,
        functionName: 'setSolanaDestination',
        args: [destination],
      }),
    },
    {
      label: 'setOVaultRuntimeConfig',
      data: encodeFunctionData({
        abi: ABI,
        functionName: 'setOVaultRuntimeConfig',
        args: [hub, eid, true],
      }),
    },
  ]

  process.stdout.write(
    `${JSON.stringify(
      {
        safeAddress,
        signerAddress: getAddress(privateKeyToAccount(privateKey).address),
        batcher,
        destination,
        hub,
        eid,
        ops: ops.map((op) => op.label),
      },
      null,
      2,
    )}\n`,
  )

  const client = createPublicClient({ chain: base, transport: http(rpc) })
  const kit = await Safe.init({ provider: rpc, signer: privateKey, safeAddress })
  const results: Array<{ label: string; txHash: string }> = []
  for (const op of ops) {
    const tx = await kit.createTransaction({
      transactions: [{ to: batcher, value: '0', data: op.data, operation: OperationType.Call }],
    })
    const exec = await kit.executeTransaction(tx)
    const hash = (exec.hash ??
      (exec as { transactionResponse?: { hash?: `0x${string}` } }).transactionResponse?.hash) as
      | `0x${string}`
      | undefined
    if (!hash) throw new Error(`no hash for ${op.label}`)
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180_000 })
    if (receipt.status !== 'success') throw new Error(`${op.label} reverted ${hash}`)
    results.push({ label: op.label, txHash: hash })
  }

  const dest = await client.readContract({
    address: batcher,
    abi: ABI,
    functionName: 'solanaDestination',
  })
  const runtime = await client.readContract({
    address: batcher,
    abi: ABI,
    functionName: 'getOVaultRuntimeConfig',
  })
  process.stdout.write(`${JSON.stringify({ ok: true, results, dest, runtime }, null, 2)}\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
