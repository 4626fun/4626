#!/usr/bin/env node

import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'

import {
  SPLIT_PHASE1_DEPLOYMENT_BATCHER,
  SPLIT_PHASE1_PHASE1_MODULE,
  SPLIT_PHASE1_PHASE1_MODULE_V3_IMPAIRMENT,
  isDeprecatedCreatorVaultBatcherAddress,
} from '../../src/config/contracts.defaults.js'
import { deploymentBatcherNotConfiguredMessage } from '../../src/lib/deploy/deploymentBatcherConfigError.js'
import { assertCreatorOvaultModuleStorageCompatible } from '../../src/lib/deploy/ovaultModuleIdentity.js'
import {
  BASE_MAINNET_CREATOR_REGISTRY,
  readBatcherRegistryAuthorized,
} from '../../server/_lib/deploy/ensureBatcherRegistryAuthorization.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const BATCHER_VIEW_ABI = [
  {
    type: 'function',
    name: 'phase1Module',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'phase2Module',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'solanaBridgeAdapter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'solanaDestination',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'solanaShareOftPeer',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'getOVaultRuntimeConfig',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'hubComposer', type: 'address' },
          { name: 'solanaEid', type: 'uint32' },
          { name: 'enabled', type: 'bool' },
        ],
      },
    ],
  },
] as const

const BATCHER_PHASE1_WITH_SALT_ABI = [
  {
    type: 'function',
    name: 'deployPhase1CoreWithSalt',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vaultName', type: 'string' },
          { name: 'vaultSymbol', type: 'string' },
          { name: 'shareName', type: 'string' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'bytes32' },
          { name: 'wrapper', type: 'bytes32' },
          { name: 'shareOFT', type: 'bytes32' },
          { name: 'gauge', type: 'bytes32' },
          { name: 'cca', type: 'bytes32' },
          { name: 'oracle', type: 'bytes32' },
          { name: 'oftBootstrap', type: 'bytes32' },
        ],
      },
      { name: 'shareOftSaltOverride', type: 'bytes32' },
    ],
    outputs: [
      {
        name: 'out',
        type: 'tuple',
        components: [
          { name: 'oftBootstrapRegistry', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'oracle', type: 'address' },
        ],
      },
    ],
  },
] as const

const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex
const SALT_OVERRIDE_DISABLED_SELECTOR = '0xe7fdf838'

type CheckResult = {
  id: string
  ok: boolean
  detail: string
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function usage(): void {
  process.stdout.write(`Usage:
  pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts [options]

Options:
  --batcher <address>   DeploymentBatcher (default: SPLIT_PHASE1_DEPLOYMENT_BATCHER / env)
  --rpc <url>           Base RPC (default: BASE_RPC_URL)
  --json                Machine-readable output only
  --shell-only          Exit 0 when batcher shell is wired (peer may still be unset)
  --help                Show this help
`)
}

function normalizeAddress(value: unknown): Address | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!isAddress(raw)) return null
  return getAddress(raw) as Address
}

async function readSolanaShareOftPeer(
  client: ReturnType<typeof createPublicClient>,
  batcher: Address,
): Promise<{ supported: boolean; peer: Hex | null; error: string | null }> {
  try {
    const peer = (await client.readContract({
      address: batcher,
      abi: BATCHER_VIEW_ABI,
      functionName: 'solanaShareOftPeer',
    })) as Hex
    return {
      supported: true,
      peer: peer.toLowerCase() === ZERO_BYTES32.toLowerCase() ? null : peer,
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown')
    return { supported: false, peer: null, error: message }
  }
}

async function detectPhase1SaltOverrideSupport(
  client: ReturnType<typeof createPublicClient>,
  batcher: Address,
): Promise<{ supported: boolean; detail: string }> {
  const probeSalt = `0x${'11'.repeat(32)}` as Hex
  const phase1Params = {
    creatorToken: '0x0000000000000000000000000000000000000001' as Address,
    owner: '0x0000000000000000000000000000000000000002' as Address,
    vaultName: 'probe',
    vaultSymbol: 'pOV',
    shareName: 'probe share',
    shareSymbol: 'psh',
    version: 'v-probe',
  } as const
  const codeIds = {
    vault: ZERO_BYTES32,
    wrapper: ZERO_BYTES32,
    shareOFT: ZERO_BYTES32,
    gauge: ZERO_BYTES32,
    cca: ZERO_BYTES32,
    oracle: ZERO_BYTES32,
    oftBootstrap: ZERO_BYTES32,
  } as const

  try {
    await client.call({
      to: batcher,
      data: encodeFunctionData({
        abi: BATCHER_PHASE1_WITH_SALT_ABI,
        functionName: 'deployPhase1CoreWithSalt',
        args: [phase1Params, codeIds, probeSalt],
      }),
    })
    // If this unexpectedly succeeds, salt override is definitely enabled.
    return { supported: true, detail: 'probe call unexpectedly succeeded with non-zero override' }
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()
    if (message.includes(SALT_OVERRIDE_DISABLED_SELECTOR) || message.includes('saltoverridedisabled')) {
      return { supported: false, detail: 'reverted SaltOverrideDisabled on non-zero override probe' }
    }
    // Any other revert means the function accepted the non-zero override and failed later (owner/codeid/etc).
    return {
      supported: true,
      detail: `non-salt revert on probe (${message.slice(0, 180) || 'unknown'})`,
    }
  }
}

async function main() {
  if (hasFlag('--help')) {
    usage()
    return
  }

  const batcher = normalizeAddress(
    getArg(
      '--batcher',
      process.env.CREATOR_VAULT_BATCHER ||
        process.env.DEPLOYMENT_BATCHER ||
        SPLIT_PHASE1_DEPLOYMENT_BATCHER,
    ),
  )
  if (!batcher) throw new Error('Missing --batcher (or CREATOR_VAULT_BATCHER / DEPLOYMENT_BATCHER env)')
  if (isDeprecatedCreatorVaultBatcherAddress(batcher)) {
    throw new Error(deploymentBatcherNotConfiguredMessage(batcher))
  }

  const rpcUrl = getArg('--rpc', process.env.BASE_RPC_URL || 'https://mainnet.base.org')
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })

  const [phase1Module, phase2Module, adapter, destination, runtime, peerRead, registryAuthorized, saltSupport] =
    await Promise.all([
    client.readContract({ address: batcher, abi: BATCHER_VIEW_ABI, functionName: 'phase1Module' }),
    client.readContract({ address: batcher, abi: BATCHER_VIEW_ABI, functionName: 'phase2Module' }),
    client.readContract({ address: batcher, abi: BATCHER_VIEW_ABI, functionName: 'solanaBridgeAdapter' }),
    client.readContract({ address: batcher, abi: BATCHER_VIEW_ABI, functionName: 'solanaDestination' }),
    client.readContract({ address: batcher, abi: BATCHER_VIEW_ABI, functionName: 'getOVaultRuntimeConfig' }),
    readSolanaShareOftPeer(client, batcher),
    readBatcherRegistryAuthorized({ publicClient: client, batcher, registry: BASE_MAINNET_CREATOR_REGISTRY }),
    detectPhase1SaltOverrideSupport(client, batcher),
  ])

  const runtimeTuple = runtime as { hubComposer: Address; solanaEid: number; enabled: boolean }
  const phase1ModuleAddress = isAddress(String(phase1Module)) ? getAddress(String(phase1Module)) : null
  const moduleStorage = phase1ModuleAddress
    ? await assertCreatorOvaultModuleStorageCompatible({
        publicClient: client,
        batcherAddress: batcher,
      })
    : {
        ok: false as const,
        message: 'phase1Module address unreadable',
        vaultExpects: '0x' as Hex,
        moduleAddress: '0x0000000000000000000000000000000000000000' as Address,
        moduleReports: '0x' as Hex,
      }

  const checks: CheckResult[] = [
    {
      id: 'phase1_module',
      ok: phase1ModuleAddress !== null,
      detail: String(phase1Module),
    },
    {
      id: 'phase1_module_v1130_target',
      ok: phase1ModuleAddress === getAddress(SPLIT_PHASE1_PHASE1_MODULE),
      detail: `live=${phase1ModuleAddress ?? 'n/a'} expected=${SPLIT_PHASE1_PHASE1_MODULE}`,
    },
    {
      id: 'phase1_module_not_v3_impairment',
      ok: phase1ModuleAddress !== getAddress(SPLIT_PHASE1_PHASE1_MODULE_V3_IMPAIRMENT),
      detail: `live=${phase1ModuleAddress ?? 'n/a'} parked_v3=${SPLIT_PHASE1_PHASE1_MODULE_V3_IMPAIRMENT}`,
    },
    {
      id: 'phase1_module_storage_v2',
      ok: moduleStorage.ok,
      detail: moduleStorage.ok ? 'CreatorOVaultModuleStorage.v2' : moduleStorage.message,
    },
    {
      id: 'phase2_module',
      ok: isAddress(String(phase2Module)),
      detail: String(phase2Module),
    },
    {
      id: 'ovault_runtime_enabled',
      ok: runtimeTuple.enabled === true,
      detail: `enabled=${runtimeTuple.enabled} hub=${runtimeTuple.hubComposer} eid=${runtimeTuple.solanaEid}`,
    },
    {
      id: 'solana_bridge_adapter',
      ok:
        isAddress(String(adapter)) &&
        String(adapter).toLowerCase() !== '0x0000000000000000000000000000000000000000',
      detail: String(adapter),
    },
    {
      id: 'solana_destination',
      ok: typeof destination === 'string' && destination.toLowerCase() !== ZERO_BYTES32.toLowerCase(),
      detail: String(destination),
    },
    {
      id: 'creator_registry_batcher_authorized',
      ok: registryAuthorized === true,
      detail:
        registryAuthorized === true
          ? `authorizedFactories(${batcher})=true on ${BASE_MAINNET_CREATOR_REGISTRY}`
          : `authorizedFactories(${batcher})=false — run CreatorRegistry.setAuthorizedFactory before greenfield Phase 2 finalize`,
    },
    {
      id: 'solana_share_oft_peer_selector',
      ok: peerRead.supported,
      detail: peerRead.supported
        ? 'solanaShareOftPeer() readable on batcher bytecode'
        : `missing on live batcher (${peerRead.error ?? 'revert'})`,
    },
    {
      id: 'solana_share_oft_peer_configured',
      ok: peerRead.supported && peerRead.peer !== null,
      detail: peerRead.peer ?? (peerRead.supported ? 'unset (zero)' : 'n/a until batcher cutover'),
    },
    {
      id: 'phase1_salt_override_enabled',
      ok: saltSupport.supported,
      detail: saltSupport.detail,
    },
  ]

  const ready = checks.every((check) => check.ok)
  const shellReady = checks
    .filter((check) => check.id !== 'solana_share_oft_peer_configured')
    .every((check) => check.ok)
  const shellOnly = hasFlag('--shell-only')
  const payload = {
    batcher,
    readyForPipeAFinalizeBridge: ready,
    readyForBatcherShell: shellReady,
    checks,
  }

  if (hasFlag('--json')) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
  } else {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
    process.stdout.write(
      shellOnly
        ? shellReady
          ? 'Pipe A batcher shell readiness: PASS (share OFT peer may still be pending mesh)\n'
          : 'Pipe A batcher shell readiness: FAIL — see checks above\n'
        : ready
          ? 'Pipe A batcher readiness: PASS\n'
          : shellReady
            ? 'Pipe A batcher readiness: PARTIAL — shell wired; set solanaShareOftPeer before greenfield finalize bridge\n'
            : 'Pipe A batcher readiness: FAIL — see checks above and docs/operations/deployment/batcher-pipe-a-cutover.md\n',
    )
  }

  process.exit(shellOnly ? (shellReady ? 0 : 2) : ready ? 0 : shellReady ? 3 : 2)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
