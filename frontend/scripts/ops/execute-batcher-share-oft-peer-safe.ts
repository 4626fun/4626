#!/usr/bin/env node

import Safe from '@safe-global/protocol-kit'
import { OperationType } from '@safe-global/types-kit'
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'

import { SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const SET_SOLANA_SHARE_OFT_PEER_ABI = [
  {
    type: 'function',
    name: 'setSolanaShareOftPeer',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_peer', type: 'bytes32' }],
    outputs: [],
  },
] as const

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Missing private key')
  return (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as `0x${string}`
}

function assertBytes32(raw: string, label: string): Hex {
  const value = raw.trim().toLowerCase()
  if (!/^0x[0-9a-f]{64}$/.test(value)) throw new Error(`Invalid ${label}: ${raw}`)
  if (value === `0x${'00'.repeat(32)}`) throw new Error(`${label} must be non-zero`)
  return value as Hex
}

function usage() {
  process.stdout.write(`Usage:
  pnpm -C frontend exec tsx scripts/ops/execute-batcher-share-oft-peer-safe.ts \\
    --share-oft-peer 0x<32-byte-solana-share-mesh-peer> [options]

Options:
  --batcher <address>        DeploymentBatcher (default: SPLIT_PHASE1_DEPLOYMENT_BATCHER)
  --safe-address <address>   Protocol treasury Safe (default: PROTOCOL_TREASURY)
  --rpc <url>                Base RPC (default: BASE_RPC_URL)
  --safe-owner-pk <hex>      Safe owner key (default: PRIVATE_KEY)
  --dry-run                  Print calldata only
  --help                     Show this help

Requires the real LayerZero Solana share-mesh peer bytes32 for EID 30168 — not
SOLANA_DESTINATION and not bridge-wrapped creator SPL mints. See
docs/operations/solana-share-mesh-lottery-policy.md
`)
}

async function main() {
  if (hasFlag('--help')) {
    usage()
    return
  }

  const peer = assertBytes32(
    getArg('--share-oft-peer', process.env.SOLANA_SHARE_OFT_PEER || ''),
    'share-oft-peer',
  )
  const batcher = getAddress(
    getArg('--batcher', SPLIT_PHASE1_DEPLOYMENT_BATCHER) as Address,
  )
  const safeAddress = getAddress(
    getArg('--safe-address', process.env.PROTOCOL_TREASURY || '') as Address,
  )
  if (!isAddress(safeAddress)) throw new Error('Missing --safe-address or PROTOCOL_TREASURY')

  const data = encodeFunctionData({
    abi: SET_SOLANA_SHARE_OFT_PEER_ABI,
    functionName: 'setSolanaShareOftPeer',
    args: [peer],
  })

  if (hasFlag('--dry-run')) {
    process.stdout.write(
      `${JSON.stringify({ batcher, safeAddress, peer, data }, null, 2)}\n`,
    )
    return
  }

  const rpcUrl = getArg('--rpc', process.env.BASE_RPC_URL || 'https://mainnet.base.org')
  const privateKey = normalizePrivateKey(
    getArg('--safe-owner-pk', process.env.PRIVATE_KEY || process.env.SAFE_OWNER_PRIVATE_KEY || ''),
  )

  const protocolKit = await Safe.init({ provider: rpcUrl, signer: privateKey, safeAddress })
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })

  const safeTx = await protocolKit.createTransaction({
    transactions: [{ to: batcher, value: '0', data, operation: OperationType.Call }],
  })
  const exec = await protocolKit.executeTransaction(safeTx)
  const hash = (exec.hash ?? exec.transactionResponse?.hash) as `0x${string}` | undefined
  if (!hash) throw new Error('missing tx hash')
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 })

  const configured = await publicClient.readContract({
    address: batcher,
    abi: [{ type: 'function', name: 'solanaShareOftPeer', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] }] as const,
    functionName: 'solanaShareOftPeer',
  })

  process.stdout.write(
    `${JSON.stringify(
      {
        executed: true,
        txHash: hash,
        status: receipt.status,
        blockNumber: receipt.blockNumber.toString(),
        solanaShareOftPeer: configured,
      },
      null,
      2,
    )}\n`,
  )
}

main().catch((error) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
