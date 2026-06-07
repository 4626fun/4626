#!/usr/bin/env node
/**
 * After Anvil forks Base, ensure the live batcher points at the store-aligned Phase1Module.
 * Safe txs on mainnet do not retroactively update already-running fork processes.
 */
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress } from 'viem'
import { base } from 'viem/chains'

import {
  SPLIT_PHASE1_DEPLOYMENT_BATCHER,
  SPLIT_PHASE1_PHASE1_MODULE,
} from '../../src/config/contracts.defaults.js'
import { assertCreatorOvaultModuleStorageCompatible } from '../../src/lib/deploy/ovaultModuleIdentity.js'
import { resolveAlignedPhase1DeployDeps } from '../../src/lib/deploy/phase1ModuleDeploy.js'
import { resolveProtocolTreasuryAddress } from '../../server/_lib/wallet/protocolTreasurySafe.js'

declare const process: {
  env: Record<string, string | undefined>
  exit: (code?: number) => void
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const SET_PHASE1_MODULE_ABI = [
  {
    type: 'function',
    name: 'setPhase1Module',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_phase1Module', type: 'address' }],
    outputs: [],
  },
] as const

const PHASE1_MODULE_ABI = [
  {
    type: 'function',
    name: 'phase1Module',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

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
  const targetPhase1 = getAddress(SPLIT_PHASE1_PHASE1_MODULE)
  const publicClient = createPublicClient({ chain: base, transport: http(rpc, { timeout: 30_000 }) })

  const chainIdHex = await anvilRpc<string>('eth_chainId', [])
  const chainId = Number.parseInt(chainIdHex, 16)
  if (chainId !== base.id) {
    process.stdout.write(`skip: rpc ${rpc} chainId=${chainId} (not Base fork)\n`)
    return
  }

  const currentPhase1 = (await publicClient.readContract({
    address: batcher,
    abi: PHASE1_MODULE_ABI,
    functionName: 'phase1Module',
  })) as string

  const alignedBefore = await resolveAlignedPhase1DeployDeps({ publicClient, batcherAddress: batcher })
  const moduleBefore = await assertCreatorOvaultModuleStorageCompatible({
    publicClient,
    batcherAddress: batcher,
  })
  const phase1AddressMatches =
    isAddress(currentPhase1) && getAddress(currentPhase1) === targetPhase1
  if (alignedBefore.ok && moduleBefore.ok && phase1AddressMatches) {
    process.stdout.write(
      `ok: batcher ${batcher} phase1 wiring already matches v1.13.0 v2 target on fork (${alignedBefore.create2Deployer})\n`,
    )
    return
  }

  const driftReasons: string[] = []
  if (!alignedBefore.ok) driftReasons.push(`create2/store: ${alignedBefore.message}`)
  if (!moduleBefore.ok) driftReasons.push(`module fingerprint: ${moduleBefore.message}`)
  if (!phase1AddressMatches) {
    driftReasons.push(`phase1Module=${currentPhase1} expected ${targetPhase1}`)
  }

  process.stdout.write(
    `fork drift (${driftReasons.join('; ')}) — applying setPhase1Module(${targetPhase1})\n`,
  )

  const protocolTreasury = resolveProtocolTreasuryAddress()
  await anvilRpc<boolean>('anvil_impersonateAccount', [protocolTreasury])
  const data = encodeFunctionData({
    abi: SET_PHASE1_MODULE_ABI,
    functionName: 'setPhase1Module',
    args: [targetPhase1],
  })
  const txHash = await anvilRpc<string>('eth_sendTransaction', [
    {
      from: protocolTreasury,
      to: batcher,
      data,
      value: '0x0',
    },
  ])
  await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}`, timeout: 60_000 })

  const alignedAfter = await resolveAlignedPhase1DeployDeps({ publicClient, batcherAddress: batcher })
  const moduleAfter = await assertCreatorOvaultModuleStorageCompatible({
    publicClient,
    batcherAddress: batcher,
  })
  if (!alignedAfter.ok) {
    throw new Error(`fork still misaligned after setPhase1Module: ${alignedAfter.message}`)
  }
  if (!moduleAfter.ok) {
    throw new Error(`fork module fingerprint still mismatched after setPhase1Module: ${moduleAfter.message}`)
  }

  if (!isAddress(currentPhase1)) {
    throw new Error(`unexpected phase1Module before sync: ${currentPhase1}`)
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        rpc,
        batcher,
        previousPhase1Module: getAddress(currentPhase1),
        phase1Module: targetPhase1,
        create2Deployer: alignedAfter.create2Deployer,
        bytecodeStore: alignedAfter.bytecodeStore,
        txHash,
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
