#!/usr/bin/env node
/**
 * Live Base mainnet smoke: mirrors deploy-session phase-1 precheck + bytecode store reads.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/smoke-v1120-deploy-path.ts
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createPublicClient,
  encodeAbiParameters,
  getAddress,
  http,
  keccak256,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'

import { BASE_DEFAULTS, SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'
import { DEPLOY_BYTECODE } from '../../src/deploy/bytecode.generated.js'

declare const process: {
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const BATCHER = SPLIT_PHASE1_DEPLOYMENT_BATCHER
const EXPECTED_STORE = getAddress(BASE_DEFAULTS.universalBytecodeStore)
const EXPECTED_PHASE3 = '0x674a2D5EE33e184e2120B373a9AcB3fef640885c' as Address
const ZERO = '0x0000000000000000000000000000000000000000' as Address

const PHASE1_CODE_IDS = {
  vault: keccak256(DEPLOY_BYTECODE.CreatorOVault as Hex),
  wrapper: keccak256(DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex),
  shareOFT: keccak256(DEPLOY_BYTECODE.CreatorShareOFT as Hex),
  gauge: keccak256(DEPLOY_BYTECODE.CreatorGaugeController as Hex),
  cca: keccak256(DEPLOY_BYTECODE.CCALaunchStrategy as Hex),
  oracle: keccak256(DEPLOY_BYTECODE.CreatorOracle as Hex),
  oftBootstrap: keccak256(DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex),
} as const

const PHASE3_CODE_IDS = {
  charm: keccak256(DEPLOY_BYTECODE.CreatorCharmStrategy as Hex),
  ajnaAuth: keccak256(DEPLOY_BYTECODE.AjnaVaultAuth as Hex),
  ajnaVault: keccak256(DEPLOY_BYTECODE.AjnaERC4626Vault as Hex),
  adapter: keccak256(DEPLOY_BYTECODE.ERC4626StrategyAdapter as Hex),
} as const

const STORE_ABI = [
  { type: 'function', name: 'pointers', stateMutability: 'view', inputs: [{ name: 'codeId', type: 'bytes32' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'chunkCount', stateMutability: 'view', inputs: [{ name: 'codeId', type: 'bytes32' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'sizes', stateMutability: 'view', inputs: [{ name: 'codeId', type: 'bytes32' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'get', stateMutability: 'view', inputs: [{ name: 'codeId', type: 'bytes32' }], outputs: [{ type: 'bytes' }] },
] as const

const BATCHER_ABI = [
  { type: 'function', name: 'bytecodeStore', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'create2Deployer', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'phase3Helper', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'vaultCoreModule', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'vaultStrategiesModule', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'vaultAdminModule', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const CREATE2_AUTH_ABI = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'authorizedDeployers', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const

type Manifest = { contracts: Record<string, { creationBytecodeBytes: number }> }

function rpcUrl(): string {
  return process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org'
}

function loadManifest(): Manifest {
  const path = resolve(import.meta.dirname, '../../../deployments/base/v1.12.0-bytecode-manifest.json')
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest
}

async function main(): Promise<void> {
  const client = createPublicClient({ chain: base, transport: http(rpcUrl()) })
  const manifest = loadManifest()
  const failures: string[] = []

  const [storeOnBatcher, create2Deployer, phase3Helper] = await Promise.all([
    client.readContract({ address: BATCHER, abi: BATCHER_ABI, functionName: 'bytecodeStore' }),
    client.readContract({ address: BATCHER, abi: BATCHER_ABI, functionName: 'create2Deployer' }),
    client.readContract({ address: BATCHER, abi: BATCHER_ABI, functionName: 'phase3Helper' }),
  ])

  process.stdout.write(`batcher=${BATCHER}\n`)
  process.stdout.write(`bytecodeStore=${storeOnBatcher} (expected ${EXPECTED_STORE})\n`)
  process.stdout.write(`create2Deployer=${create2Deployer}\n`)
  process.stdout.write(`phase3Helper=${phase3Helper} (expected ${EXPECTED_PHASE3})\n`)

  if (getAddress(storeOnBatcher) !== EXPECTED_STORE) {
    failures.push(`batcher.bytecodeStore mismatch: ${storeOnBatcher}`)
  }
  if (getAddress(phase3Helper) !== getAddress(EXPECTED_PHASE3)) {
    failures.push(`batcher.phase3Helper mismatch: ${phase3Helper}`)
  }

  const authorized = await client.readContract({
    address: create2Deployer,
    abi: CREATE2_AUTH_ABI,
    functionName: 'authorizedDeployers',
    args: [BATCHER],
  })
  if (!authorized) failures.push(`create2Deployer not authorized for batcher`)

  const phase3HelperAuthorized = await client.readContract({
    address: create2Deployer,
    abi: CREATE2_AUTH_ABI,
    functionName: 'authorizedDeployers',
    args: [phase3Helper],
  })
  if (!phase3HelperAuthorized) failures.push(`create2Deployer not authorized for phase3Helper`)

  for (const [label, codeId] of Object.entries({ ...PHASE1_CODE_IDS, ...PHASE3_CODE_IDS })) {
    const [pointer, chunks, size, fromStore] = await Promise.all([
      client.readContract({ address: EXPECTED_STORE, abi: STORE_ABI, functionName: 'pointers', args: [codeId] }),
      client.readContract({ address: EXPECTED_STORE, abi: STORE_ABI, functionName: 'chunkCount', args: [codeId] }),
      client.readContract({ address: EXPECTED_STORE, abi: STORE_ABI, functionName: 'sizes', args: [codeId] }),
      client.readContract({ address: EXPECTED_STORE, abi: STORE_ABI, functionName: 'get', args: [codeId] }),
    ])
    const manifestKey =
      label === 'cca' ? 'CCALaunchStrategy' : label === 'charm' ? 'CreatorCharmStrategy' : label === 'adapter' ? 'ERC4626StrategyAdapter' : label === 'ajnaAuth' ? 'AjnaVaultAuth' : label === 'ajnaVault' ? 'AjnaERC4626Vault' : label === 'oftBootstrap' ? 'OFTBootstrapRegistry' : label === 'vault' ? 'CreatorOVault' : label === 'wrapper' ? 'CreatorOVaultWrapper' : label === 'shareOFT' ? 'CreatorShareOFT' : label === 'gauge' ? 'CreatorGaugeController' : label === 'oracle' ? 'CreatorOracle' : null
    const expectedBytes = manifestKey ? manifest.contracts[manifestKey]?.creationBytecodeBytes : undefined

    const ok = pointer !== ZERO && chunks > 0n && size > 0n && (fromStore as Hex).length > 2
    process.stdout.write(
      `${ok ? 'OK' : 'FAIL'} ${label}: pointer=${pointer} chunks=${chunks} size=${size} getLen=${(fromStore as Hex).length}\n`,
    )
    if (!ok) failures.push(`${label}: not seeded (${codeId})`)
    if (expectedBytes != null && Number(size) !== expectedBytes) {
      failures.push(`${label}: store size ${size} != manifest ${expectedBytes}`)
    }
  }

  const vaultFromStore = (await client.readContract({
    address: EXPECTED_STORE,
    abi: STORE_ABI,
    functionName: 'get',
    args: [PHASE1_CODE_IDS.vault],
  })) as Hex
  const localVaultLen = ((DEPLOY_BYTECODE.CreatorOVault as Hex).length - 2) / 2
  const storeVaultLen = (vaultFromStore.length - 2) / 2
  if (localVaultLen !== storeVaultLen) {
    failures.push(`CreatorOVault: DEPLOY_BYTECODE bytes ${localVaultLen} != store.get ${storeVaultLen}`)
  } else {
    process.stdout.write(`OK CreatorOVault store.get matches DEPLOY_BYTECODE (${localVaultLen} bytes)\n`)
  }

  const dummyCreator = '0x1111111111111111111111111111111111111111' as Address
  const dummyOwner = '0x2222222222222222222222222222222222222222' as Address
  const vaultArgs = encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }, { type: 'string' }, { type: 'string' }],
    [dummyCreator, dummyOwner, 'smoke-vault', 'SMOKE'],
  )
  const initCode = `${vaultFromStore}${vaultArgs.slice(2)}` as Hex
  const initCodeHash = keccak256(initCode)
  process.stdout.write(`OK vault initCodeHash computable (${initCode.length} hex chars)\n`)
  process.stdout.write(`   initCodeHash=${initCodeHash}\n`)

  if (failures.length > 0) {
    process.stderr.write('\nFailures:\n')
    for (const f of failures) process.stderr.write(`- ${f}\n`)
    process.exit(1)
  }

  process.stdout.write('\nDeploy-path smoke: PASS (live Base reads match v1.12.0 app + store)\n')
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
