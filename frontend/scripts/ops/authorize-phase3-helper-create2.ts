#!/usr/bin/env node
/**
 * Authorize the wired DeploymentBatcher.phase3Helper on UniversalCreate2DeployerFromStore.
 *
 * Phase 3 CREATE2 deploys run from the helper contract (external call), not the batcher shell.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/authorize-phase3-helper-create2.ts [--dry-run]
 */

import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'
import { readPhase3HelperCreate2Authorization } from '../../server/_lib/deploy/ensurePhase3HelperCreate2Authorization.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => void
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const CREATE2_AUTH_ABI = [
  {
    type: 'function',
    name: 'setAuthorizedDeployer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'deployer', type: 'address' },
      { name: 'allowed', type: 'bool' },
    ],
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
  throw new Error('Missing owner key (PRIVATE_KEY / PROTOCOL_TREASURY_SAFE_OWNER_PK)')
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const batcherArg = getArg('--batcher')
  const batcher = getAddress(
    isAddress(String(batcherArg ?? '')) ? (batcherArg as Address) : SPLIT_PHASE1_DEPLOYMENT_BATCHER,
  )
  const rpcUrl = String(process.env.BASE_RPC_URL ?? process.env.VITE_BASE_RPC_URL ?? 'https://mainnet.base.org').trim()

  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const status = await readPhase3HelperCreate2Authorization({ publicClient, batcher })

  process.stdout.write(`${JSON.stringify({ batcher, ...status }, null, 2)}\n`)

  if (status.ok) {
    process.stdout.write('Phase3 helper already authorized on create2 deployer.\n')
    return
  }

  if (dryRun) {
    process.stdout.write('Dry run only — would call setAuthorizedDeployer(phase3Helper, true).\n')
    process.exit(2)
  }

  const ownerKey = resolveOwnerKey()
  const account = privateKeyToAccount(ownerKey)
  if (account.address.toLowerCase() !== status.create2Owner.toLowerCase()) {
    throw new Error(
      `Signer ${account.address} is not create2 deployer owner ${status.create2Owner}. ` +
        'Use the owner key or execute via the correct operator wallet.',
    )
  }

  const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl) })
  const data = encodeFunctionData({
    abi: CREATE2_AUTH_ABI,
    functionName: 'setAuthorizedDeployer',
    args: [status.phase3Helper, true],
  }) as Hex

  const hash = await walletClient.sendTransaction({
    account,
    to: status.create2Deployer,
    data,
    value: 0n,
  })
  process.stdout.write(`Submitted setAuthorizedDeployer tx: ${hash}\n`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error(`Transaction failed: ${hash}`)
  }

  const verified = await readPhase3HelperCreate2Authorization({ publicClient, batcher })
  process.stdout.write(`${JSON.stringify({ verified }, null, 2)}\n`)
  if (!verified.ok) {
    throw new Error('Authorization tx mined but helper is still unauthorized')
  }
  process.stdout.write('Phase3 helper authorized on create2 deployer.\n')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exit(1)
})
