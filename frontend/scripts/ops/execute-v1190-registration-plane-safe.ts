#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import Safe from '@safe-global/protocol-kit'
import { OperationType } from '@safe-global/types-kit'
import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  keccak256,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

import { DEPLOY_CONSUMED_MANIFEST_KEYS } from './releaseBytecodeKeys.js'

const BATCHER_ADMIN_ABI = [
  {
    type: 'function',
    name: 'approvePhaseModuleCodehash',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'module', type: 'address' },
      { name: 'codehash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'wireDeploymentHelpers',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'phase2Module', type: 'address' },
      { name: 'phase3Helper', type: 'address' },
      { name: 'shareMeshHelper', type: 'address' },
      { name: 'utilsHelper', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setPhase1Module',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'phase1Module', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setApprovedCodeIds',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'codeIds', type: 'bytes32[]' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setAuthorizedPhaseCaller',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'caller', type: 'address' },
      { name: 'authorized', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setSolanaConfig',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'adapter', type: 'address' },
      { name: 'destination', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setOVaultRuntimeConfig',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'hubComposer', type: 'address' },
      { name: 'solanaEid', type: 'uint32' },
      { name: 'enabled', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setSolanaShareOftPeer',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'peer', type: 'bytes32' }],
    outputs: [],
  },
] as const

type Handoff = Record<string, string>
type Manifest = { release: string; contracts: Record<string, { codeId: Hex }> }
type Operation = { label: string; to: Address; data: Hex; value: string; operation: OperationType }

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
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

function handoffAddress(handoff: Handoff, key: string): Address {
  const value = handoff[key]?.trim()
  if (!value || !isAddress(value)) throw new Error(`Missing or invalid handoff address: ${key}`)
  return getAddress(value)
}

function ownerKey(): Hex {
  for (const candidate of [
    process.env.PROTOCOL_TREASURY_SAFE_OWNER_PK,
    process.env.SAFE_OWNER_PRIVATE_KEY,
    process.env.PRIVATE_KEY,
  ]) {
    const value = String(candidate ?? '').trim()
    if (/^0x[0-9a-fA-F]{64}$/.test(value)) return value as Hex
  }
  throw new Error('Missing protocol treasury Safe owner key')
}

async function main(): Promise<void> {
  const handoffPath = resolve(arg('--handoff') ?? '../tmp/base-v1.19.0-registration-plane-handoff.env')
  const manifestPath = resolve(arg('--manifest') ?? '../deployments/base/v1.19.0-bytecode-manifest.json')
  const rpc = arg('--rpc') ?? process.env.BASE_RPC_URL
  if (!rpc) throw new Error('BASE_RPC_URL or --rpc is required')

  const handoff = loadHandoff(handoffPath)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
  const batcher = handoffAddress(handoff, 'DEPLOYMENT_BATCHER')
  const safeAddress = handoffAddress(handoff, 'PROTOCOL_TREASURY')
  const factory = handoffAddress(handoff, 'OVAULT_FACTORY')
  const adapter = handoffAddress(handoff, 'SOLANA_BRIDGE_ADAPTER')
  const moduleKeys = [
    'DEPLOYMENT_BATCHER_PHASE1_MODULE',
    'DEPLOYMENT_BATCHER_PHASE2_MODULE',
    'DEPLOYMENT_BATCHER_PHASE3_HELPER',
    'DEPLOYMENT_BATCHER_SHARE_MESH_HELPER',
    'DEPLOYMENT_BATCHER_UTILS_HELPER',
  ] as const
  const modules = moduleKeys.map((key) => handoffAddress(handoff, key))
  const [phase1, phase2, phase3, shareMesh, utils] = modules
  const destination = handoff.SOLANA_DESTINATION as Hex
  if (!/^0x[0-9a-fA-F]{64}$/.test(destination)) {
    throw new Error('Missing or invalid SOLANA_DESTINATION in handoff')
  }
  const hubComposer = handoffAddress(handoff, 'OVAULT_HUB_COMPOSER')
  const solanaEid = Number(handoff.OVAULT_SOLANA_EID)
  if (!Number.isInteger(solanaEid) || solanaEid <= 0) {
    throw new Error('Missing or invalid OVAULT_SOLANA_EID in handoff')
  }
  const shareOftPeer = handoff.SOLANA_SHARE_OFT_PEER as Hex
  if (!/^0x[0-9a-fA-F]{64}$/.test(shareOftPeer)) {
    throw new Error('Missing or invalid SOLANA_SHARE_OFT_PEER in handoff')
  }

  const client = createPublicClient({ chain: base, transport: http(rpc) })
  const moduleCodes = await Promise.all(modules.map((module) => client.getCode({ address: module })))
  const moduleCodehashOps = modules.map((module, index) => {
    const code = moduleCodes[index]
    if (!code || code === '0x') throw new Error(`Module has no code: ${module}`)
    return {
      label: `approve_module_codehash_${moduleKeys[index]}`,
      to: batcher,
      value: '0',
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: BATCHER_ADMIN_ABI,
        functionName: 'approvePhaseModuleCodehash',
        args: [module, keccak256(code)],
      }),
    } satisfies Operation
  })

  const codeIds = [
    ...new Set(
      DEPLOY_CONSUMED_MANIFEST_KEYS.map((key) => {
        const codeId = manifest.contracts[key]?.codeId
        if (!codeId) throw new Error(`Manifest missing deploy-consumed codeId: ${key}`)
        return codeId
      }),
    ),
  ]
  const operations: Operation[] = [
    ...moduleCodehashOps,
    {
      label: 'wire_deployment_helpers',
      to: batcher,
      value: '0',
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: BATCHER_ADMIN_ABI,
        functionName: 'wireDeploymentHelpers',
        args: [phase2, phase3, shareMesh, utils],
      }),
    },
    {
      label: 'set_phase1_module',
      to: batcher,
      value: '0',
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: BATCHER_ADMIN_ABI,
        functionName: 'setPhase1Module',
        args: [phase1],
      }),
    },
    {
      label: 'approve_v1190_code_ids',
      to: batcher,
      value: '0',
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: BATCHER_ADMIN_ABI,
        functionName: 'setApprovedCodeIds',
        args: [codeIds, true],
      }),
    },
    {
      label: 'authorize_factory_phase_caller',
      to: batcher,
      value: '0',
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: BATCHER_ADMIN_ABI,
        functionName: 'setAuthorizedPhaseCaller',
        args: [factory, true],
      }),
    },
    {
      label: 'set_solana_config',
      to: batcher,
      value: '0',
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: BATCHER_ADMIN_ABI,
        functionName: 'setSolanaConfig',
        args: [adapter, destination],
      }),
    },
    {
      label: 'set_ovault_runtime_config',
      to: batcher,
      value: '0',
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: BATCHER_ADMIN_ABI,
        functionName: 'setOVaultRuntimeConfig',
        args: [hubComposer, solanaEid, true],
      }),
    },
    {
      label: 'set_solana_share_oft_peer',
      to: batcher,
      value: '0',
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: BATCHER_ADMIN_ABI,
        functionName: 'setSolanaShareOftPeer',
        args: [shareOftPeer],
      }),
    },
  ]

  const payload = {
    handoffPath,
    manifestRelease: manifest.release,
    safeAddress,
    batcher,
    operationCount: operations.length,
    operations: operations.map(({ label, to, data }) => ({ label, to, data })),
  }
  if (hasFlag('--dry-run')) {
    process.stdout.write(`${JSON.stringify({ ...payload, dryRun: true }, null, 2)}\n`)
    return
  }

  const key = ownerKey()
  const signer = privateKeyToAccount(key)
  const protocolKit = await Safe.init({ provider: rpc, signer: key, safeAddress })
  const safeTransaction = await protocolKit.createTransaction({ transactions: operations })
  const response = await protocolKit.executeTransaction(safeTransaction)
  const txHash =
    response.hash ??
    (response as { transactionResponse?: { hash?: Hex } }).transactionResponse?.hash
  if (!txHash) throw new Error('Safe execution returned no transaction hash')
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 })
  if (receipt.status !== 'success') throw new Error(`Registration-plane Safe wiring reverted: ${txHash}`)

  process.stdout.write(
    `${JSON.stringify({ ...payload, ok: true, signer: signer.address, txHash }, null, 2)}\n`,
  )
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exit(1)
})
