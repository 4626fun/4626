#!/usr/bin/env node

import Safe from '@safe-global/protocol-kit'
import SafeApiKit from '@safe-global/api-kit'
import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'
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

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Missing private key')
  return (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as `0x${string}`
}

function parseNonceList(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0)
}

function usage() {
  process.stdout.write(`Usage:
  pnpm -C frontend exec tsx scripts/ops/reject-stale-safe-transactions.ts [options]

Options:
  --safe-address <address>   Safe address (default: PROTOCOL_TREASURY)
  --rpc <url>                Base RPC (default: BASE_RPC_URL)
  --safe-owner-pk <hex>      Owner key (default: PRIVATE_KEY)
  --safe-api-key <key>       Safe API key (default: SAFE_API_KEY)
  --list                     List pending txs and exit
  --nonces <n,n,...>         Reject specific pending nonces (default: 77,78,79,80,81)
  --dry-run                  Print planned rejections without executing
  --help                     Show this help

Rejects queued Safe transactions by executing on-chain rejection txs via
protocol-kit createRejectionTransaction(nonce). Use after direct on-chain exec
superseded stale tx-service queue rows.
`)
}

async function main() {
  if (hasFlag('--help')) {
    usage()
    return
  }

  const safeAddress = getAddress(
    getArg('--safe-address', process.env.PROTOCOL_TREASURY || '0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3') as Address,
  )
  if (!isAddress(safeAddress)) throw new Error('Invalid safe address')

  const rpcUrl = getArg('--rpc', process.env.BASE_RPC_URL || 'https://mainnet.base.org')
  const privateKey = normalizePrivateKey(
    getArg('--safe-owner-pk', process.env.PRIVATE_KEY || process.env.SAFE_OWNER_PRIVATE_KEY || ''),
  )
  const apiKey = getArg('--safe-api-key', process.env.SAFE_API_KEY || '')
  const dryRun = hasFlag('--dry-run')
  const listOnly = hasFlag('--list')

  const apiKit = new SafeApiKit({ chainId: 8453n, apiKey })
  const pending = await apiKit.getPendingTransactions(safeAddress)
  const safeInfo = await apiKit.getSafeInfo(safeAddress)

  process.stdout.write(`Safe ${safeAddress} on-chain nonce=${safeInfo.nonce}\n`)
  process.stdout.write(`Pending tx-service rows: ${pending.results?.length ?? 0}\n`)
  for (const tx of pending.results ?? []) {
    process.stdout.write(
      `  nonce=${tx.nonce} hash=${tx.safeTxHash} to=${tx.to} confirmations=${tx.confirmations?.length ?? 0}\n`,
    )
  }

  if (listOnly) return

  const targetNonces = parseNonceList(getArg('--nonces', '77,78,79,80,81'))
  if (targetNonces.length === 0) throw new Error('No target nonces')

  const pendingByNonce = new Map<number, (typeof pending.results)[number]>()
  for (const tx of pending.results ?? []) {
    const nonce = Number(tx.nonce)
    if (Number.isInteger(nonce)) pendingByNonce.set(nonce, tx)
  }

  const toReject = targetNonces.filter((nonce) => pendingByNonce.has(nonce))
  const missing = targetNonces.filter((nonce) => !pendingByNonce.has(nonce))

  if (missing.length > 0) {
    process.stdout.write(`Nonces not in pending queue (skip): ${missing.join(', ')}\n`)
  }
  if (toReject.length === 0) {
    process.stdout.write('Nothing to reject.\n')
    return
  }

  if (dryRun) {
    process.stdout.write(`Dry-run would reject nonces: ${toReject.join(', ')}\n`)
    return
  }

  const protocolKit = await Safe.init({ provider: rpcUrl, signer: privateKey, safeAddress })
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })

  const results: Array<{ nonce: number; txHash: string; status: string; blockNumber: string }> = []
  for (const nonce of toReject.sort((a, b) => a - b)) {
    const rejection = await protocolKit.createRejectionTransaction(nonce)
    const exec = await protocolKit.executeTransaction(rejection)
    const hash = (exec.hash ?? exec.transactionResponse?.hash) as `0x${string}` | undefined
    if (!hash) throw new Error(`missing tx hash for rejection nonce ${nonce}`)
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 })
    results.push({
      nonce,
      txHash: hash,
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
    })
    process.stdout.write(`Rejected nonce ${nonce}: ${hash} (${receipt.status})\n`)
  }

  process.stdout.write(`${JSON.stringify({ rejected: results }, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
