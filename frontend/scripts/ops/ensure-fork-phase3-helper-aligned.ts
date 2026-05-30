#!/usr/bin/env node
/**
 * After Anvil forks Base, ensure the live batcher points at a store-aligned Phase3 helper.
 * Replaces the unsafe batcher-shell bytecode patch (immutables corrupt runtime on anvil_setCode).
 */
import { getAddress } from 'viem'
import { base } from 'viem/chains'

import { SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'
import { ensurePhase3DryRunForkPrep } from '../../server/_lib/deploy/ensurePhase3DryRunForkPrep.js'

declare const process: {
  env: Record<string, string | undefined>
  exit: (code?: number) => void
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

function localRpcUrl(): string {
  return (
    process.env.DEPLOY_DRY_RUN_LOCAL_RPC_URL ??
    process.env.BASE_RPC_URL ??
    'http://127.0.0.1:8545'
  )
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
  const batcher = getAddress(SPLIT_PHASE1_DEPLOYMENT_BATCHER)

  const chainIdHex = await anvilRpc<string>('eth_chainId', [])
  const chainId = Number.parseInt(chainIdHex, 16)
  if (chainId !== base.id) {
    process.stdout.write(`skip: rpc ${rpc} chainId=${chainId} (not Base fork)\n`)
    return
  }

  const result = await ensurePhase3DryRunForkPrep({
    rpcUrl: rpc,
    batcher,
  })

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        rpc,
        batcher,
        helperAlreadyAligned: result.helperAlreadyAligned,
        helperEnsured: result.helperEnsured,
        create2AlreadyAuthorized: result.create2AlreadyAuthorized,
        create2Ensured: result.create2Ensured,
        phase3Helper: result.phase3Helper,
        create2Deployer: result.create2Deployer,
      },
      null,
      2,
    )}\n`,
  )
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
