#!/usr/bin/env node

import Safe from '@safe-global/protocol-kit'
import SafeApiKit from '@safe-global/api-kit'
import { OperationType } from '@safe-global/types-kit'
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

function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Missing private key')
  return (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as `0x${string}`
}

function toNumberInt(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'bigint') {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    return Number.isFinite(n) ? Math.trunc(n) : fallback
  }
  return fallback
}

function isGs026(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return message.includes('GS026')
}

async function executeSafeTransaction(params: {
  protocolKit: Safe
  publicClient: ReturnType<typeof createPublicClient>
  safeTxHash: string
  apiKit: SafeApiKit
}): Promise<{ safeTxHash: string; txHash: string; status: string; blockNumber: string; lane: string }> {
  const { protocolKit, publicClient, safeTxHash, apiKit } = params
  const tx = await apiKit.getTransaction(safeTxHash)
  const to = normalizeAddress(tx.to)
  const data = typeof tx.data === 'string' ? tx.data : ''
  if (!to || !data.startsWith('0x')) {
    throw new Error(`Safe tx ${safeTxHash} missing to/data`)
  }

  const execute = async (lane: 'service' | 'recreate') => {
    const safeTransaction =
      lane === 'service'
        ? tx
        : await protocolKit.createTransaction({
            transactions: [
              {
                to,
                value: String(tx.value ?? '0'),
                data,
                operation: toNumberInt(tx.operation, Number(OperationType.Call)),
              },
            ],
            options: { nonce: toNumberInt(tx.nonce, undefined) },
          })
    const exec = await protocolKit.executeTransaction(safeTransaction)
    const hash = (exec.hash ?? exec.transactionResponse?.hash) as `0x${string}` | undefined
    if (!hash) throw new Error(`missing tx hash for ${safeTxHash}`)
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 })
    return { safeTxHash, txHash: hash, status: receipt.status, blockNumber: receipt.blockNumber.toString(), lane }
  }

  try {
    return await execute('service')
  } catch (error) {
    if (!isGs026(error)) throw error
    return await execute('recreate')
  }
}

function normalizeAddress(value: unknown): Address | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!isAddress(raw)) return null
  return getAddress(raw) as Address
}

async function main() {
  const safeAddress = getArg('--safe-address', process.env.PROTOCOL_TREASURY || '')
  if (!safeAddress) throw new Error('Missing --safe-address or PROTOCOL_TREASURY')

  const hashArgs = process.argv.filter((arg) => arg.startsWith('0x') && arg.length === 66)
  if (hashArgs.length === 0) {
    throw new Error('Pass one or more safeTxHash values as arguments')
  }

  const rpcUrl = getArg('--rpc', process.env.BASE_RPC_URL || 'https://mainnet.base.org')
  const privateKey = normalizePrivateKey(
    getArg('--safe-owner-pk', process.env.PRIVATE_KEY || process.env.SAFE_OWNER_PRIVATE_KEY || ''),
  )

  const apiKey = getArg('--safe-api-key', process.env.SAFE_API_KEY || '')
  const apiKit = new SafeApiKit({ chainId: 8453n, apiKey })
  const protocolKit = await Safe.init({ provider: rpcUrl, signer: privateKey, safeAddress })
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })

  const results = []
  for (const safeTxHash of hashArgs) {
    results.push(await executeSafeTransaction({ protocolKit, publicClient, safeTxHash, apiKit }))
  }

  process.stdout.write(`${JSON.stringify({ executed: true, results }, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
