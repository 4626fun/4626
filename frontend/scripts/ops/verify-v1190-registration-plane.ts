#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'

import { DEPLOY_CONSUMED_MANIFEST_KEYS } from './releaseBytecodeKeys.js'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address
const AKITA_GAUGE = getAddress('0xB471B53cD0A30289Bc3a2dc3c6dd913288F8baA1')
const AKITA_GAUGE_LOTTERY_MANAGER = getAddress('0xe2C39D39FF92c0cF7A0e9eD16FcE1d6F14bB38fD')
const AKITA_SHARE_OFT = getAddress('0x4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57')
const AKITA_SHARE_REGISTRY = getAddress('0x777e28d7617ADb6E2fE7b7C49864A173e36881EF')

const VIEW_ABI = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'registry', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'deploymentBatcher', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'lotteryManager', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'localVRFConsumer', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'boostManager', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 've4626GaugeVoting', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'singleVaultJackpotOnly', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'liveRebindEnabled', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'phase1Module', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'phase2Module', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'phase3Helper', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'shareMeshHelper', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'utilsHelper', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'solanaDestination', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
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
  { type: 'function', name: 'bytecodeStore', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'create2Deployer', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'protocolTreasury', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'protocolAutomation', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function',
    name: 'getLotteryManager',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'authorizedFactories',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'authorizedLocalCallers',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'authorizedDeployers',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'authorizedPhaseCallers',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'approvedCodeIds',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'laneOf',
    stateMutability: 'view',
    inputs: [{ type: 'uint8' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'ecosystemLaneOf',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'codeIdsConfigured',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
] as const

type Handoff = Record<string, string>
type Manifest = { release: string; contracts: Record<string, { codeId: Hex }> }
type Check = { id: string; ok: boolean; expected: unknown; actual: unknown }
type ImmutableReferences = Record<string, Array<{ start: number; length: number }>>

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function loadHandoff(path: string): Handoff {
  const result: Handoff = {}
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const normalized = line.startsWith('HANDOFF:') ? line.slice('HANDOFF:'.length) : line
    const separator = normalized.indexOf('=')
    if (separator <= 0) continue
    result[normalized.slice(0, separator)] = normalized.slice(separator + 1)
  }
  return result
}

function address(handoff: Handoff, key: string): Address {
  const value = handoff[key]?.trim()
  if (!value || !isAddress(value)) throw new Error(`Missing or invalid handoff address: ${key}`)
  return getAddress(value)
}

function normalizeImmutableReferences(bytecode: Hex, references: ImmutableReferences): Hex {
  const bytes = bytecode.slice(2).split('')
  for (const entries of Object.values(references)) {
    for (const { start, length } of entries) {
      bytes.fill('0', start * 2, (start + length) * 2)
    }
  }
  return `0x${bytes.join('')}` as Hex
}

async function main(): Promise<void> {
  const handoffPath = resolve(arg('--handoff') ?? '../tmp/base-v1.19.0-registration-plane-handoff.env')
  const manifestPath = resolve(arg('--manifest') ?? '../deployments/base/v1.19.0-bytecode-manifest.json')
  const rpc = arg('--rpc') ?? process.env.BASE_RPC_URL
  if (!rpc) throw new Error('BASE_RPC_URL or --rpc is required')

  const handoff = loadHandoff(handoffPath)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
  const client = createPublicClient({ chain: base, transport: http(rpc) })

  const registry = address(handoff, 'REGISTRY_4626')
  const factory = address(handoff, 'OVAULT_FACTORY')
  const creatorLane = address(handoff, 'CREATOR_OVAULT_LANE')
  const agentLane = address(handoff, 'AGENT_OVAULT_LANE')
  const activationBatcher = address(handoff, 'VAULT_ACTIVATION_BATCHER')
  const lotteryManager = address(handoff, 'LOTTERY_MANAGER')
  const vrfConsumer = address(handoff, 'VRF_CONSUMER')
  const batcher = address(handoff, 'DEPLOYMENT_BATCHER')
  const store = address(handoff, 'UNIVERSAL_BYTECODE_STORE')
  const create2Deployer = address(handoff, 'UNIVERSAL_CREATE2_DEPLOYER')
  const treasury = address(handoff, 'PROTOCOL_TREASURY')
  const automation = address(handoff, 'PROTOCOL_AUTOMATION')
  const owner = address(handoff, 'REGISTRATION_PLANE_OWNER')

  const checks: Check[] = []
  const check = (id: string, actual: unknown, expected: unknown): void => {
    const normalize = (value: unknown) =>
      typeof value === 'string' && isAddress(value) ? getAddress(value) : value
    const normalizedActual = normalize(actual)
    const normalizedExpected = normalize(expected)
    checks.push({
      id,
      ok: normalizedActual === normalizedExpected,
      expected: normalizedExpected,
      actual: normalizedActual,
    })
  }
  const read = (target: Address, functionName: string, args?: readonly unknown[]) =>
    client.readContract({ address: target, abi: VIEW_ABI, functionName: functionName as never, args: args as never })

  const registryArtifact = JSON.parse(
    readFileSync(resolve('../out/Registry4626.sol/Registry4626.json'), 'utf8'),
  ) as { deployedBytecode: { object: Hex; immutableReferences: ImmutableReferences } }
  const [registryCode, registryOwner, rebind, registryLm] = await Promise.all([
    client.getCode({ address: registry }),
    read(registry, 'owner'),
    read(registry, 'liveRebindEnabled'),
    read(registry, 'getLotteryManager', [8453n]),
  ])
  const immutableReferences = registryArtifact.deployedBytecode.immutableReferences
  check(
    'registry_runtime_hash',
    keccak256(normalizeImmutableReferences(registryCode ?? '0x', immutableReferences)),
    keccak256(normalizeImmutableReferences(registryArtifact.deployedBytecode.object, immutableReferences)),
  )
  check('registry_owner', registryOwner, owner)
  check('registry_live_rebind_disabled', rebind, false)
  check('registry_lottery_manager', registryLm, lotteryManager)
  check('registry_authorizes_factory', await read(registry, 'authorizedFactories', [factory]), true)
  check('registry_authorizes_batcher', await read(registry, 'authorizedFactories', [batcher]), true)

  check('factory_owner', await read(factory, 'owner'), owner)
  check('factory_registry', await read(factory, 'registry'), registry)
  check('factory_batcher', await read(factory, 'deploymentBatcher'), batcher)
  check('factory_creator_lane', await read(factory, 'laneOf', [0]), creatorLane)
  check('factory_agent_lane', await read(factory, 'laneOf', [1]), agentLane)
  check('factory_creator_ecosystem_lane', await read(factory, 'ecosystemLaneOf', [keccak256(toHex('creator'))]), creatorLane)
  check('factory_agent_ecosystem_lane', await read(factory, 'ecosystemLaneOf', [keccak256(toHex('agent'))]), agentLane)
  check('creator_lane_configured', await read(creatorLane, 'codeIdsConfigured'), true)
  check('agent_lane_configured', await read(agentLane, 'codeIdsConfigured'), true)
  check('activation_registry', await read(activationBatcher, 'registry'), registry)

  check('lottery_registry', await read(lotteryManager, 'registry'), registry)
  check('lottery_vrf', await read(lotteryManager, 'localVRFConsumer'), vrfConsumer)
  check('lottery_boost_manager_zero', await read(lotteryManager, 'boostManager'), ZERO_ADDRESS)
  check('lottery_gauge_voting_zero', await read(lotteryManager, 've4626GaugeVoting'), ZERO_ADDRESS)
  check('lottery_single_vault_guard', await read(lotteryManager, 'singleVaultJackpotOnly'), true)
  check('vrf_authorizes_lottery', await read(vrfConsumer, 'authorizedLocalCallers', [lotteryManager]), true)

  check('batcher_registry', await read(batcher, 'registry'), registry)
  check('batcher_store', await read(batcher, 'bytecodeStore'), store)
  check('batcher_create2_deployer', await read(batcher, 'create2Deployer'), create2Deployer)
  check('batcher_treasury', await read(batcher, 'protocolTreasury'), treasury)
  check('batcher_authorizes_factory', await read(batcher, 'authorizedPhaseCallers', [factory]), true)
  check('create2_authorizes_batcher', await read(create2Deployer, 'authorizedDeployers', [batcher]), true)
  const runtime = (await read(batcher, 'getOVaultRuntimeConfig')) as {
    hubComposer: Address
    solanaEid: number
    enabled: boolean
  }
  check('batcher_ovault_hub_composer', runtime.hubComposer, address(handoff, 'OVAULT_HUB_COMPOSER'))
  check('batcher_ovault_solana_eid', runtime.solanaEid, Number(handoff.OVAULT_SOLANA_EID))
  check('batcher_ovault_runtime_enabled', runtime.enabled, true)
  check('batcher_solana_destination', await read(batcher, 'solanaDestination'), handoff.SOLANA_DESTINATION)

  const phase2 = getAddress((await read(batcher, 'phase2Module')) as Address)
  const phase3 = getAddress((await read(batcher, 'phase3Helper')) as Address)
  const shareMesh = getAddress((await read(batcher, 'shareMeshHelper')) as Address)
  check('phase2_registry', await read(phase2, 'registry'), registry)
  check('phase2_lottery_manager', await read(phase2, 'lotteryManager'), lotteryManager)
  check('phase3_automation', await read(phase3, 'protocolAutomation'), automation)
  check('create2_authorizes_phase3', await read(create2Deployer, 'authorizedDeployers', [phase3]), true)
  check('create2_authorizes_share_mesh', await read(create2Deployer, 'authorizedDeployers', [shareMesh]), true)

  for (const key of DEPLOY_CONSUMED_MANIFEST_KEYS) {
    const codeId = manifest.contracts[key]?.codeId
    if (!codeId) throw new Error(`Manifest missing ${key}`)
    check(`batcher_approved_code_id_${key}`, await read(batcher, 'approvedCodeIds', [codeId]), true)
  }

  check('akita_share_registry_unchanged', await read(AKITA_SHARE_OFT, 'registry'), AKITA_SHARE_REGISTRY)
  check('akita_gauge_lm_unchanged', await read(AKITA_GAUGE, 'lotteryManager'), AKITA_GAUGE_LOTTERY_MANAGER)

  const failures = checks.filter((item) => !item.ok)
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: failures.length === 0,
        handoffPath,
        manifestRelease: manifest.release,
        checksRun: checks.length,
        failures,
        addresses: { registry, factory, lotteryManager, batcher },
      },
      null,
      2,
    )}\n`,
  )
  if (failures.length > 0) process.exit(1)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exit(1)
})
