#!/usr/bin/env node

import Safe from '@safe-global/protocol-kit'
import { OperationType } from '@safe-global/types-kit'
import { createPublicClient, getAddress, http, isAddress, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Missing private key')
  return (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as `0x${string}`
}

async function main() {
  const batcher = getAddress(
    getArg('--batcher', '0xa99058f424FB3ACC639F59355C65C40149030651') as Address,
  )
  const safeAddress = getAddress(
    getArg('--safe-address', process.env.PROTOCOL_TREASURY || '') as Address,
  )
  if (!isAddress(safeAddress)) throw new Error('Missing --safe-address or PROTOCOL_TREASURY')

  const rpcUrl = getArg('--rpc', process.env.BASE_RPC_URL || 'https://mainnet.base.org')
  const privateKey = normalizePrivateKey(
    getArg('--safe-owner-pk', process.env.PRIVATE_KEY || process.env.SAFE_OWNER_PRIVATE_KEY || ''),
  )

  const ops: Array<{ label: string; data: Hex }> = [
    {
      label: 'wireDeploymentHelpers',
      data: '0x90130a9600000000000000000000000067fd8a34e5b26f875a9513dff37521a1ca92d80f0000000000000000000000003c89e20abcce3d8f6344aff6c63c82f5619effcb000000000000000000000000f71a6236586077cd29c971443d2cce37b543dcbb000000000000000000000000d71c4910c7bb38fb1089cca42b0883f1bfffa28d',
    },
    {
      label: 'setPhase1Module',
      data: '0xb80172f7000000000000000000000000f3b20557ef8173510693a13ef71f884db835e8c0',
    },
    {
      label: 'setSolanaConfig',
      data: '0x3dc62f07000000000000000000000000700b4bbaf965c013123bad02a6562fba487ac0f15f38e34ec3b546c53e682f2cf84d35d2edcbd15b498367651835942416f8d4d1',
    },
    {
      label: 'setOVaultRuntimeConfig',
      data: '0x9814aa4f0000000000000000000000007df44cbb93a5191837a988f0cc441e3811c39cd100000000000000000000000000000000000000000000000000000000000075d80000000000000000000000000000000000000000000000000000000000000001',
    },
  ]

  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const protocolKit = await Safe.init({ provider: rpcUrl, signer: privateKey, safeAddress })

  const results: Array<{
    label: string
    txHash: string
    status: string
    blockNumber: string
  }> = []

  for (const op of ops) {
    const safeTx = await protocolKit.createTransaction({
      transactions: [
        {
          to: batcher,
          value: '0',
          data: op.data,
          operation: OperationType.Call,
        },
      ],
    })
    const exec = await protocolKit.executeTransaction(safeTx)
    const hash = (exec.hash ?? exec.transactionResponse?.hash) as `0x${string}` | undefined
    if (!hash) throw new Error(`missing tx hash for ${op.label}`)
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 })
    results.push({
      label: op.label,
      txHash: hash,
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
    })
  }

  process.stdout.write(`${JSON.stringify({ executed: true, safeAddress, batcher, results }, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
