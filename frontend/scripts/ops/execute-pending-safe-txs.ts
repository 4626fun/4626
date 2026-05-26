#!/usr/bin/env node

import Safe from '@safe-global/protocol-kit'
import SafeApiKit from '@safe-global/api-kit'
import { createPublicClient, http } from 'viem'
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

function normalizePrivateKey(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
}

async function main() {
  const safeAddress = getArg('--safe-address', process.env.PROTOCOL_TREASURY || '')
  if (!safeAddress) throw new Error('Missing --safe-address or PROTOCOL_TREASURY')

  const hashArgs = process.argv.filter((arg) => arg.startsWith('0x') && arg.length === 66)
  if (hashArgs.length === 0) {
    throw new Error('Pass one or more safeTxHash values as arguments')
  }

  const rpcUrl = getArg('--rpc', process.env.BASE_RPC_URL || '')
  if (!rpcUrl.trim()) throw new Error('Missing --rpc or BASE_RPC_URL')

  const privateKey = normalizePrivateKey(
    getArg('--safe-owner-pk', process.env.PRIVATE_KEY || process.env.SAFE_OWNER_PRIVATE_KEY || ''),
  )
  if (!privateKey) throw new Error('Missing signer private key')

  const apiKey = getArg('--safe-api-key', process.env.SAFE_API_KEY || '')
  const apiKit = new SafeApiKit({ chainId: 8453n, apiKey })
  const protocolKit = await Safe.init({ provider: rpcUrl, signer: privateKey, safeAddress })
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })

  const results: Array<{
    safeTxHash: string
    txHash: string
    status: string
    blockNumber: string
  }> = []

  for (const safeTxHash of hashArgs) {
    const tx = await apiKit.getTransaction(safeTxHash)
    const exec = await protocolKit.executeTransaction(tx)
    const hash = exec.hash ?? exec.transactionResponse?.hash
    if (!hash) throw new Error(`missing tx hash for ${safeTxHash}`)
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 })
    results.push({
      safeTxHash,
      txHash: hash,
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
    })
  }

  process.stdout.write(`${JSON.stringify({ executed: true, results }, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
