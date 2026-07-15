#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createPublicClient,
  getAddress,
  http,
  isAddressEqual,
  keccak256,
  toFunctionSelector,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'

import { BASE_DEFAULTS, SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'
import { DEPLOY_BYTECODE } from '../../src/deploy/bytecode.generated.js'

const RELEASE = 'v1.19.1'
const MANIFEST_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  `../../../deployments/base/${RELEASE}-bytecode-manifest.json`,
)
const EXPECTED_CHAIN_ID = 8453
const EXPECTED_SWAP_ROUTER = getAddress('0x2626664c2603336E57B271c5C0b26F421741e481')
const STALE_AUX_BATCHER = getAddress('0xa3986F2F812a80a4Ee4A33646bE5248D9e22eb88')
const AUX_KEYS = [
  'VaultShareBurnStream',
  'CreatorPayoutRouter',
  'AgentRevenueRouter',
  'CreatorCoinPolicyController',
  'AgentRevenuePolicyController',
] as const

type AuxiliaryKey = (typeof AUX_KEYS)[number]
type Manifest = {
  release: string
  chainId: number
  contracts: Record<string, { codeId: Hex; creationBytecodeBytes: number }>
}
type Check = {
  id: string
  ok: boolean
  blocking: boolean
  detail: string
}

const BATCHER_ABI = [
  {
    type: 'function',
    name: 'bytecodeStore',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'create2Deployer',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'protocolTreasury',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const STORE_ABI = [
  {
    type: 'function',
    name: 'pointers',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'sizes',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'get',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'bytes' }],
  },
] as const

const CREATE2_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'authorizedDeployers',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const

function loadFrontendEnv(): void {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const equals = trimmed.indexOf('=')
    if (equals === -1) continue
    const key = trimmed.slice(0, equals).trim()
    let value = trimmed.slice(equals + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function rpcUrl(): string {
  const value = String(process.env.BASE_RPC_URL ?? '').trim()
  if (!value) throw new Error('BASE_RPC_URL is required')
  return value.replace('wss://', 'https://').replace('/ws/', '/rpc/')
}

function addCheck(
  checks: Check[],
  id: string,
  ok: boolean,
  detail: string,
  blocking = true,
): void {
  checks.push({ id, ok, blocking, detail })
}

function hasRuntimeSelector(runtime: Hex, signature: string): boolean {
  const selector = toFunctionSelector(signature).slice(2).toLowerCase()
  return runtime.toLowerCase().includes(selector)
}

async function main(): Promise<void> {
  loadFrontendEnv()
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest
  const client = createPublicClient({ chain: base, transport: http(rpcUrl()) })
  const checks: Check[] = []

  const chainId = await client.getChainId()
  addCheck(checks, 'chain_id', chainId === EXPECTED_CHAIN_ID, `actual=${chainId} expected=${EXPECTED_CHAIN_ID}`)
  addCheck(checks, 'manifest_release', manifest.release === RELEASE, `actual=${manifest.release} expected=${RELEASE}`)
  addCheck(
    checks,
    'manifest_chain_id',
    manifest.chainId === EXPECTED_CHAIN_ID,
    `actual=${manifest.chainId} expected=${EXPECTED_CHAIN_ID}`,
  )

  const deploymentBatcher = getAddress(SPLIT_PHASE1_DEPLOYMENT_BATCHER)
  const expectedStore = getAddress(BASE_DEFAULTS.universalBytecodeStore)
  const expectedCreate2 = getAddress(BASE_DEFAULTS.universalCreate2DeployerFromStore)
  const expectedTreasury = getAddress(BASE_DEFAULTS.protocolTreasury)

  const [liveStore, liveCreate2, liveTreasury, batcherRuntime] = await Promise.all([
    client.readContract({
      address: deploymentBatcher,
      abi: BATCHER_ABI,
      functionName: 'bytecodeStore',
    }),
    client.readContract({
      address: deploymentBatcher,
      abi: BATCHER_ABI,
      functionName: 'create2Deployer',
    }),
    client.readContract({
      address: deploymentBatcher,
      abi: BATCHER_ABI,
      functionName: 'protocolTreasury',
    }),
    client.getBytecode({ address: deploymentBatcher }),
  ])

  addCheck(
    checks,
    'batcher_store',
    isAddressEqual(liveStore, expectedStore),
    `actual=${liveStore} expected=${expectedStore}`,
  )
  addCheck(
    checks,
    'batcher_create2',
    isAddressEqual(liveCreate2, expectedCreate2),
    `actual=${liveCreate2} expected=${expectedCreate2}`,
  )
  addCheck(
    checks,
    'batcher_treasury',
    isAddressEqual(liveTreasury, expectedTreasury),
    `actual=${liveTreasury} expected=${expectedTreasury}`,
  )
  addCheck(
    checks,
    'batcher_runtime_present',
    Boolean(batcherRuntime && batcherRuntime !== '0x'),
    `address=${deploymentBatcher}`,
  )

  const allowlistSupported = Boolean(
    batcherRuntime &&
      hasRuntimeSelector(batcherRuntime, 'codeIdAllowlistEnabled()') &&
      hasRuntimeSelector(batcherRuntime, 'requireApprovedCodeId(bytes32)') &&
      hasRuntimeSelector(batcherRuntime, 'approvedCodeIds(bytes32)'),
  )
  addCheck(
    checks,
    'batcher_code_id_allowlist',
    true,
    allowlistSupported
      ? 'supported: Safe approvals are required before deploy'
      : 'absent on live batcher: Safe approval step must be skipped',
    false,
  )

  const codeIds = {} as Record<AuxiliaryKey, Hex>
  const pointers = {} as Record<AuxiliaryKey, Address>
  for (const key of AUX_KEYS) {
    const entry = manifest.contracts[key]
    if (!entry) {
      addCheck(checks, `manifest_${key}`, false, 'missing manifest entry')
      continue
    }
    const localBytecode = DEPLOY_BYTECODE[key as keyof typeof DEPLOY_BYTECODE] as Hex | undefined
    if (!localBytecode) {
      addCheck(checks, `local_bytecode_${key}`, false, 'missing DEPLOY_BYTECODE entry')
      continue
    }
    const localCodeId = keccak256(localBytecode)
    codeIds[key] = entry.codeId
    addCheck(
      checks,
      `code_id_${key}`,
      localCodeId.toLowerCase() === entry.codeId.toLowerCase(),
      `local=${localCodeId} manifest=${entry.codeId}`,
    )

    const [pointer, size] = await Promise.all([
      client.readContract({
        address: expectedStore,
        abi: STORE_ABI,
        functionName: 'pointers',
        args: [entry.codeId],
      }),
      client.readContract({
        address: expectedStore,
        abi: STORE_ABI,
        functionName: 'sizes',
        args: [entry.codeId],
      }),
    ])
    pointers[key] = pointer
    const seeded = pointer !== '0x0000000000000000000000000000000000000000' && size > 0n
    addCheck(
      checks,
      `store_seeded_${key}`,
      seeded,
      `pointer=${pointer} size=${size} expectedBytes=${entry.creationBytecodeBytes}`,
    )
    if (seeded) {
      const storedBytecode = await client.readContract({
        address: expectedStore,
        abi: STORE_ABI,
        functionName: 'get',
        args: [entry.codeId],
      })
      addCheck(
        checks,
        `store_hash_${key}`,
        keccak256(storedBytecode).toLowerCase() === entry.codeId.toLowerCase(),
        `storedHash=${keccak256(storedBytecode)} expected=${entry.codeId}`,
      )
      addCheck(
        checks,
        `store_size_${key}`,
        Number(size) === entry.creationBytecodeBytes,
        `actual=${size} expected=${entry.creationBytecodeBytes}`,
      )
    }
  }

  const [create2Owner, staleAuthorized] = await Promise.all([
    client.readContract({ address: expectedCreate2, abi: CREATE2_ABI, functionName: 'owner' }),
    client.readContract({
      address: expectedCreate2,
      abi: CREATE2_ABI,
      functionName: 'authorizedDeployers',
      args: [STALE_AUX_BATCHER],
    }),
  ])
  addCheck(checks, 'create2_owner', true, `owner=${create2Owner}`, false)
  addCheck(
    checks,
    'stale_aux_authorization',
    !staleAuthorized,
    `address=${STALE_AUX_BATCHER} authorized=${staleAuthorized}`,
  )

  const constructorArgs = [
    expectedCreate2,
    expectedStore,
    deploymentBatcher,
    expectedTreasury,
    EXPECTED_SWAP_ROUTER,
    codeIds.VaultShareBurnStream,
    codeIds.CreatorPayoutRouter,
    codeIds.AgentRevenueRouter,
    codeIds.CreatorCoinPolicyController,
    codeIds.AgentRevenuePolicyController,
  ]
  const blockingFailures = checks.filter((check) => check.blocking && !check.ok)
  const forgeCreateTemplate =
    'forge create contracts/shared/deploy/batchers/VaultAuxiliaryDeployBatcher.sol:VaultAuxiliaryDeployBatcher ' +
    '--rpc-url "$BASE_RPC_URL" --private-key "$PRIVATE_KEY" --legacy --broadcast --constructor-args ' +
    constructorArgs.join(' ')

  const payload = {
    ok: blockingFailures.length === 0,
    liveMutationPerformed: false,
    release: RELEASE,
    manifestPath: MANIFEST_PATH,
    chainId,
    infrastructure: {
      deploymentBatcher,
      bytecodeStore: expectedStore,
      create2Deployer: expectedCreate2,
      create2Owner,
      protocolTreasury: expectedTreasury,
      swapRouter: EXPECTED_SWAP_ROUTER,
      staleAuxBatcher: STALE_AUX_BATCHER,
    },
    allowlistSupported,
    codeIds,
    pointers,
    constructorArgs,
    forgeCreateTemplate,
    nextActions: [
      pointers.AgentRevenuePolicyController === '0x0000000000000000000000000000000000000000'
        ? 'seed AgentRevenuePolicyController and rerun this preflight'
        : 'AgentRevenuePolicyController is seeded',
      allowlistSupported
        ? 'submit v1.19.1 codeId approvals through treasury Safe'
        : 'skip Safe codeId approvals; do not rotate active DeploymentBatcher',
      'deploy VaultAuxiliaryDeployBatcher using constructorArgs',
      'verify immutable getters and runtime bytecode before CREATE2 authorization',
      'authorize the new helper, then cut over env/default only after verification',
    ],
    checks,
    blockingFailures,
  }

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
  if (!payload.ok && !hasFlag('--report-only')) process.exit(1)
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
