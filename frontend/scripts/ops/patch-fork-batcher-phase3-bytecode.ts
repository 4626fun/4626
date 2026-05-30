#!/usr/bin/env node
/**
 * @deprecated Do not use — anvil_setCode on the batcher shell corrupts immutables.
 * Use scripts/ops/ensure-fork-phase3-helper-aligned.ts instead.
 *
 * Patch the forked live DeploymentBatcher shell bytecode with the locally compiled
 * artifact. Keeps the canonical batcher address + storage (vault management stays
 * wired) while picking up source fixes such as Phase 3 addStrategy routing.
 *
 * Fork-only — never call this against mainnet RPC.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getAddress, isAddress } from 'viem'

import { SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'

declare const process: {
  env: Record<string, string | undefined>
  exit: (code?: number) => void
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../../..')
const artifactPath = path.join(repoRoot, 'out/DeploymentBatcher.sol/DeploymentBatcher.json')

function localRpcUrl(): string {
  return (
    process.env.DEPLOY_DRY_RUN_LOCAL_RPC_URL ??
    process.env.BASE_RPC_URL ??
    'http://127.0.0.1:8545'
  )
}

function resolveBatcherAddress(): `0x${string}` {
  const fromEnv = (
    process.env.CREATOR_VAULT_BATCHER ??
    process.env.VITE_CREATOR_VAULT_BATCHER ??
    SPLIT_PHASE1_DEPLOYMENT_BATCHER
  ).trim()
  if (!isAddress(fromEnv)) {
    throw new Error(`Invalid batcher address: ${fromEnv || '(empty)'}`)
  }
  return getAddress(fromEnv)
}

async function anvilRpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(localRpcUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const json = (await res.json()) as { result?: T; error?: { message?: string } }
  if (json.error) throw new Error(json.error.message ?? `anvil ${method} failed`)
  return json.result as T
}

async function main(): Promise<void> {
  const rpc = localRpcUrl()
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(rpc)) {
    throw new Error(`Refusing to patch batcher bytecode on non-local RPC: ${rpc}`)
  }

  const chainIdHex = await anvilRpc<string>('eth_chainId', [])
  const chainId = Number.parseInt(chainIdHex, 16)
  if (chainId !== 8453) {
    process.stdout.write(`skip: rpc ${rpc} chainId=${chainId} (not Base fork)\n`)
    return
  }

  const batcher = resolveBatcherAddress()
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as {
    deployedBytecode?: { object?: string }
  }
  const bytecode = artifact.deployedBytecode?.object?.trim()
  if (!bytecode || bytecode === '0x') {
    throw new Error(
      `Missing deployedBytecode in ${artifactPath}. Run forge build at repo root first.`,
    )
  }

  const existing = await anvilRpc<string>('eth_getCode', [batcher, 'latest'])
  if (!existing || existing === '0x') {
    throw new Error(`No bytecode at batcher ${batcher} on fork — is Anvil forked from Base?`)
  }

  if (existing.toLowerCase() === bytecode.toLowerCase()) {
    process.stdout.write(`ok: batcher ${batcher} bytecode already matches local artifact\n`)
    return
  }

  await anvilRpc<boolean>('anvil_setCode', [batcher, bytecode])
  const patched = await anvilRpc<string>('eth_getCode', [batcher, 'latest'])
  if (patched.toLowerCase() !== bytecode.toLowerCase()) {
    throw new Error(`anvil_setCode did not apply for batcher ${batcher}`)
  }

  process.stdout.write(`patched: batcher ${batcher} runtime bytecode from local forge artifact\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
