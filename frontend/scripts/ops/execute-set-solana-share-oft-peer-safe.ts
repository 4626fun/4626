#!/usr/bin/env node
/**
 * One-shot: setSolanaShareOftPeer on Pipe A DeploymentBatcher via protocol treasury Safe.
 *
 * Default peer = AKITA share-mesh OFT store peer (prelaunch reuse):
 *   0xdf9a9ef76562adbfe0231e2c5cee77f24a1f9eac519d3fbb029fe5b454d9cd3f
 *
 *   pnpm -C frontend exec tsx scripts/ops/execute-set-solana-share-oft-peer-safe.ts
 *   pnpm -C frontend exec tsx scripts/ops/execute-set-solana-share-oft-peer-safe.ts --peer 0x...
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import Safe from '@safe-global/protocol-kit'
import { OperationType } from '@safe-global/types-kit'
import { createPublicClient, encodeFunctionData, getAddress, http, isHex, type Hex } from 'viem'
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

/** Platform Solana share-mesh peer (AKITA #1 bootstrap / redeploy finalize reuse). */
const DEFAULT_SHARE_MESH_PEER =
  '0xdf9a9ef76562adbfe0231e2c5cee77f24a1f9eac519d3fbb029fe5b454d9cd3f' as const

const SET_PEER_ABI = [
  {
    type: 'function',
    name: 'setSolanaShareOftPeer',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_peer', type: 'bytes32' }],
    outputs: [],
  },
] as const

const READ_PEER_ABI = [
  {
    type: 'function',
    name: 'solanaShareOftPeer',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
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
  const peerRaw = (getArg('--peer') ?? DEFAULT_SHARE_MESH_PEER).trim()
  if (!isHex(peerRaw) || peerRaw.length !== 66) {
    throw new Error('--peer must be bytes32 hex (0x + 64 hex chars)')
  }
  const peer = peerRaw.toLowerCase() as Hex
  const batcher = getAddress(getArg('--batcher') ?? SPLIT_PHASE1_DEPLOYMENT_BATCHER)
  const safeAddress = resolveProtocolTreasuryAddress()
  const privateKey = resolveOwnerKey()
  const signerAddress = getAddress(privateKeyToAccount(privateKey).address)
  const rpc = rpcUrl()

  const publicClient = createPublicClient({ chain: base, transport: http(rpc) })
  const current = (await publicClient.readContract({
    address: batcher,
    abi: READ_PEER_ABI,
    functionName: 'solanaShareOftPeer',
  })) as Hex

  process.stdout.write(`Batcher ${batcher}\n`)
  process.stdout.write(`Current solanaShareOftPeer: ${current}\n`)
  process.stdout.write(`Target  solanaShareOftPeer: ${peer}\n`)
  process.stdout.write(`Safe ${safeAddress} signer ${signerAddress}\n`)

  if (current.toLowerCase() === peer) {
    process.stdout.write('Already set — nothing to do.\n')
    return
  }

  const data = encodeFunctionData({
    abi: SET_PEER_ABI,
    functionName: 'setSolanaShareOftPeer',
    args: [peer],
  })

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

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as Hex, timeout: 120_000 })
  if (receipt.status !== 'success') throw new Error(`Safe tx reverted: ${txHash}`)

  const live = (await publicClient.readContract({
    address: batcher,
    abi: READ_PEER_ABI,
    functionName: 'solanaShareOftPeer',
  })) as Hex

  if (live.toLowerCase() !== peer) {
    throw new Error(`Peer mismatch after exec: live=${live} expected=${peer}`)
  }

  process.stdout.write(
    `${JSON.stringify({ ok: true, txHash, batcher, peer: live, safeAddress }, null, 2)}\n`,
  )
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
