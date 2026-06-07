#!/usr/bin/env node
/**
 * End-to-end v1.13.0 greenfield deploy versioning checks:
 * - repo defaults vs live batcher.phase1Module()
 * - Phase1Module immutables (create2/store/modules) vs defaults
 * - moduleStorageVersion fingerprint (v2) vs deploy bytecode
 * - UniversalBytecodeStore seed for CreatorOVault codeId
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createPublicClient,
  encodePacked,
  getAddress,
  http,
  isAddress,
  keccak256,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'

import {
  BASE_DEFAULTS,
  CREATOR_OVAULT_ADMIN_MODULE,
  CREATOR_OVAULT_CORE_MODULE,
  CREATOR_OVAULT_STRATEGIES_MODULE,
  SPLIT_PHASE1_DEPLOYMENT_BATCHER,
  SPLIT_PHASE1_PHASE1_MODULE,
  SPLIT_PHASE1_PHASE1_MODULE_V3_IMPAIRMENT,
} from '../../src/config/contracts.defaults.js'
import { DEPLOY_BYTECODE } from '../../src/deploy/bytecode.generated.js'
import {
  CREATOR_OVAULT_MODULE_STORAGE_V2,
  CREATOR_OVAULT_MODULE_STORAGE_V3,
  assertCreatorOvaultModuleStorageCompatible,
} from '../../src/lib/deploy/ovaultModuleIdentity.js'
import { resolveAlignedPhase1DeployDeps } from '../../src/lib/deploy/phase1ModuleDeploy.js'

declare const process: {
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const V2_FINGERPRINT_HEX = CREATOR_OVAULT_MODULE_STORAGE_V2.slice(2).toLowerCase()
const V3_FINGERPRINT_HEX = CREATOR_OVAULT_MODULE_STORAGE_V3.slice(2).toLowerCase()

const PHASE1_MODULE_ABI = [
  { type: 'function', name: 'phase1Module', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const STORE_ABI = [
  {
    type: 'function',
    name: 'pointers',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
] as const

type Check = { id: string; ok: boolean; detail: string }

function rpcUrl(): string {
  return process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org'
}

function manifestPath(): string {
  const fromEnv = process.env.BYTECODE_MANIFEST?.trim()
  if (fromEnv) return resolve(fromEnv)
  return resolve(import.meta.dirname, '../../../deployments/base/v1.13.0-bytecode-manifest.json')
}

async function main(): Promise<void> {
  const batcher = getAddress(SPLIT_PHASE1_DEPLOYMENT_BATCHER)
  const expectedPhase1 = getAddress(SPLIT_PHASE1_PHASE1_MODULE)
  const store = getAddress(BASE_DEFAULTS.universalBytecodeStore)
  const expectedCreate2 = getAddress(BASE_DEFAULTS.universalCreate2DeployerFromStore)
  const client = createPublicClient({ chain: base, transport: http(rpcUrl(), { timeout: 60_000 }) })

  const checks: Check[] = []

  const livePhase1 = getAddress(
    (await client.readContract({
      address: batcher,
      abi: PHASE1_MODULE_ABI,
      functionName: 'phase1Module',
    })) as Address,
  )
  checks.push({
    id: 'batcher.phase1Module',
    ok: livePhase1 === expectedPhase1,
    detail: `live=${livePhase1} expected=${expectedPhase1}`,
  })
  checks.push({
    id: 'batcher.not_v3_impairment_phase1',
    ok: livePhase1 !== getAddress(SPLIT_PHASE1_PHASE1_MODULE_V3_IMPAIRMENT),
    detail: `live=${livePhase1} parked_v3=${SPLIT_PHASE1_PHASE1_MODULE_V3_IMPAIRMENT}`,
  })

  const aligned = await resolveAlignedPhase1DeployDeps({ publicClient: client, batcherAddress: batcher })
  checks.push({
    id: 'phase1.create2_store_pairing',
    ok: aligned.ok,
    detail: aligned.ok
      ? `create2=${aligned.create2Deployer} store=${aligned.bytecodeStore}`
      : aligned.message,
  })
  if (aligned.ok) {
    checks.push({
      id: 'phase1.create2_deployer',
      ok: aligned.create2Deployer === expectedCreate2,
      detail: `live=${aligned.create2Deployer} expected=${expectedCreate2}`,
    })
    checks.push({
      id: 'phase1.bytecode_store',
      ok: aligned.bytecodeStore === store,
      detail: `live=${aligned.bytecodeStore} expected=${store}`,
    })
  }

  const modulePreflight = await assertCreatorOvaultModuleStorageCompatible({
    publicClient: client,
    batcherAddress: batcher,
  })
  checks.push({
    id: 'phase1.module_storage_v2',
    ok: modulePreflight.ok,
    detail: modulePreflight.ok ? 'CreatorOVaultModuleStorage.v2' : modulePreflight.message,
  })

  const localVaultBytecode = (DEPLOY_BYTECODE.CreatorOVault as Hex).toLowerCase()
  checks.push({
    id: 'deploy_bytecode.v2_fingerprint',
    ok: localVaultBytecode.includes(V2_FINGERPRINT_HEX),
    detail: localVaultBytecode.includes(V2_FINGERPRINT_HEX)
      ? 'DEPLOY_BYTECODE.CreatorOVault embeds v2 fingerprint'
      : 'DEPLOY_BYTECODE.CreatorOVault missing CreatorOVaultModuleStorage.v2 fingerprint',
  })
  checks.push({
    id: 'deploy_bytecode.not_v3_fingerprint',
    ok: !localVaultBytecode.includes(V3_FINGERPRINT_HEX),
    detail: localVaultBytecode.includes(V3_FINGERPRINT_HEX)
      ? 'DEPLOY_BYTECODE.CreatorOVault still embeds v3 fingerprint'
      : 'no v3 fingerprint in deploy bytecode',
  })

  const localCodeId = keccak256(DEPLOY_BYTECODE.CreatorOVault as Hex)
  let manifestCodeId: string | null = null
  try {
    const manifest = JSON.parse(readFileSync(manifestPath(), 'utf8')) as {
      release: string
      contracts: Record<string, { codeId: string }>
    }
    manifestCodeId = manifest.contracts.CreatorOVault?.codeId ?? null
    checks.push({
      id: 'manifest.codeId_matches_local',
      ok: manifestCodeId?.toLowerCase() === localCodeId.toLowerCase(),
      detail: `manifest=${manifestCodeId ?? 'missing'} local=${localCodeId}`,
    })
  } catch (error) {
    checks.push({
      id: 'manifest.codeId_matches_local',
      ok: false,
      detail: `manifest read failed: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  const pointer = (await client.readContract({
    address: store,
    abi: STORE_ABI,
    functionName: 'pointers',
    args: [localCodeId],
  })) as Address
  const pointerOk = isAddress(String(pointer)) && pointer !== '0x0000000000000000000000000000000000000000'
  checks.push({
    id: 'store.creator_ovault_seeded',
    ok: pointerOk,
    detail: pointerOk ? `pointer=${pointer}` : `no pointer for codeId ${localCodeId}`,
  })

  if (pointerOk) {
    const storeBytecode = ((await client.getBytecode({ address: pointer })) ?? '0x').toLowerCase()
    checks.push({
      id: 'store.creator_ovault_v2_fingerprint',
      ok: storeBytecode.includes(V2_FINGERPRINT_HEX),
      detail: storeBytecode.includes(V2_FINGERPRINT_HEX)
        ? `pointer=${pointer}`
        : `pointer=${pointer} missing v2 fingerprint`,
    })
  }

  const wiredModules = {
    core: CREATOR_OVAULT_CORE_MODULE,
    strategies: CREATOR_OVAULT_STRATEGIES_MODULE,
    admin: CREATOR_OVAULT_ADMIN_MODULE,
  }
  if (aligned.ok) {
    const [core, strategies, admin] = await Promise.all([
      client.readContract({
        address: livePhase1,
        abi: [
          {
            type: 'function',
            name: 'vaultCoreModule',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'address' }],
          },
        ] as const,
        functionName: 'vaultCoreModule',
      }),
      client.readContract({
        address: livePhase1,
        abi: [
          {
            type: 'function',
            name: 'vaultStrategiesModule',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'address' }],
          },
        ] as const,
        functionName: 'vaultStrategiesModule',
      }),
      client.readContract({
        address: livePhase1,
        abi: [
          {
            type: 'function',
            name: 'vaultAdminModule',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'address' }],
          },
        ] as const,
        functionName: 'vaultAdminModule',
      }),
    ])
    checks.push({
      id: 'phase1.wired_core_module',
      ok: getAddress(core as Address) === wiredModules.core,
      detail: `live=${core} expected=${wiredModules.core}`,
    })
    checks.push({
      id: 'phase1.wired_strategies_module',
      ok: getAddress(strategies as Address) === wiredModules.strategies,
      detail: `live=${strategies} expected=${wiredModules.strategies}`,
    })
    checks.push({
      id: 'phase1.wired_admin_module',
      ok: getAddress(admin as Address) === wiredModules.admin,
      detail: `live=${admin} expected=${wiredModules.admin}`,
    })
  }

  const expectedV2 = keccak256(encodePacked(['string'], ['CreatorOVaultModuleStorage.v2']))
  checks.push({
    id: 'constants.v2_fingerprint_hash',
    ok: expectedV2.toLowerCase() === CREATOR_OVAULT_MODULE_STORAGE_V2.toLowerCase(),
    detail: expectedV2,
  })

  const ready = checks.every((check) => check.ok)
  process.stdout.write(`${JSON.stringify({ release: 'v1.13.0', ready, checks }, null, 2)}\n`)
  if (!ready) process.exit(2)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})