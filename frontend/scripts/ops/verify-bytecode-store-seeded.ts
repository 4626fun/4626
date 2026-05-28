#!/usr/bin/env node
/**
 * Verify live UniversalBytecodeStoreV2 has creation bytecode for v1.12.0 deploy codeIds.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
 *   BYTECODE_MANIFEST=../../deployments/base/v1.12.0-bytecode-manifest.json pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPublicClient, getAddress, http, isAddress, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'
import { keccak256 } from 'viem'

import { BASE_DEFAULTS } from '../../src/config/contracts.defaults.js'
import { DEPLOY_BYTECODE } from '../../src/deploy/bytecode.generated.js'

declare const process: {
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const STORE_ABI = [
  {
    type: 'function',
    name: 'pointers',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'chunkCount',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'sizes',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const REQUIRED_MANIFEST_KEYS = [
  'CreatorOVault',
  'CreatorOVaultWrapper',
  'CreatorShareOFT',
  'OFTBootstrapRegistry',
  'CreatorGaugeController',
  'CCALaunchStrategy',
  'CreatorOracle',
  'CreatorCharmStrategy',
  'AjnaVaultAuth',
  'AjnaERC4626Vault',
  'ERC4626StrategyAdapter',
  'SolanaStrategy',
  'DeploymentBatcherPhase3Helper',
] as const

const FRONTEND_DEPLOY_KEYS = [
  'CreatorOVault',
  'CreatorOVaultWrapper',
  'CreatorShareOFT',
  'OFTBootstrapRegistry',
  'CreatorGaugeController',
  'CCALaunchStrategy',
  'CreatorOracle',
  'CreatorCharmStrategy',
  'AjnaVaultAuth',
  'AjnaERC4626Vault',
  'ERC4626StrategyAdapter',
  'SolanaStrategy',
] as const

type Manifest = {
  release: string
  contracts: Record<string, { codeId: string; creationBytecodeBytes: number }>
}

function loadManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest
}

function rpcUrl(): string {
  return process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org'
}

function storeAddress(): Address {
  const fromEnv = process.env.UNIVERSAL_BYTECODE_STORE?.trim()
  if (fromEnv && isAddress(fromEnv)) return getAddress(fromEnv)
  return getAddress(BASE_DEFAULTS.universalBytecodeStore)
}

function manifestPath(): string {
  const fromEnv = process.env.BYTECODE_MANIFEST?.trim()
  if (fromEnv) return resolve(fromEnv)
  return resolve(process.cwd(), '../../deployments/base/v1.12.0-bytecode-manifest.json')
}

async function main(): Promise<void> {
  const manifest = loadManifest(manifestPath())
  const store = storeAddress()
  const client = createPublicClient({ chain: base, transport: http(rpcUrl()) })

  const failures: string[] = []

  for (const key of FRONTEND_DEPLOY_KEYS) {
    const bytecode = DEPLOY_BYTECODE[key as keyof typeof DEPLOY_BYTECODE] as Hex
    const derived = keccak256(bytecode)
    const manifestEntry = manifest.contracts[key]
    if (!manifestEntry) {
      failures.push(`${key}: missing from manifest ${manifest.release}`)
      continue
    }
    if (manifestEntry.codeId.toLowerCase() !== derived.toLowerCase()) {
      failures.push(
        `${key}: manifest codeId ${manifestEntry.codeId} != keccak(DEPLOY_BYTECODE) ${derived}`,
      )
    }
  }

  for (const key of REQUIRED_MANIFEST_KEYS) {
    const entry = manifest.contracts[key]
    if (!entry) {
      failures.push(`${key}: missing manifest entry`)
      continue
    }
    const codeId = entry.codeId as Hex
    const [pointer, chunks, size] = await Promise.all([
      client.readContract({ address: store, abi: STORE_ABI, functionName: 'pointers', args: [codeId] }),
      client.readContract({ address: store, abi: STORE_ABI, functionName: 'chunkCount', args: [codeId] }),
      client.readContract({ address: store, abi: STORE_ABI, functionName: 'sizes', args: [codeId] }),
    ])

    const ok = pointer !== '0x0000000000000000000000000000000000000000' && chunks > 0n && size > 0n
    const line = `${key}: pointer=${pointer} chunks=${chunks} size=${size} expectedBytes=${entry.creationBytecodeBytes}`
    process.stdout.write(`${ok ? 'OK' : 'MISSING'} ${line}\n`)
    if (!ok) failures.push(`${key}: not seeded on store ${store}`)
    else if (Number(size) !== entry.creationBytecodeBytes) {
      failures.push(`${key}: on-chain size ${size} != manifest ${entry.creationBytecodeBytes}`)
    }
  }

  process.stdout.write(`\nStore: ${store}\nManifest: ${manifest.release} (${manifestPath()})\n`)

  if (failures.length > 0) {
    process.stderr.write('\nFailures:\n')
    for (const f of failures) process.stderr.write(`- ${f}\n`)
    process.exit(1)
  }

  process.stdout.write('All required v1.12.0 codeIds are seeded and DEPLOY_BYTECODE matches manifest.\n')
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`${message}\n`)
  process.exit(1)
})
