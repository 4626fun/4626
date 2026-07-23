#!/usr/bin/env tsx
/**
 * Configure only the Base Sepolia receive ULN policy for the isolated lottery
 * relay rehearsal. This never sets the receiver peer, authorizes the Store,
 * or sends a LayerZero packet.
 */
import { pathToFileURL } from 'node:url'

import { PublicKey } from '@solana/web3.js'
import {
  createPublicClient,
  createWalletClient,
  decodeAbiParameters,
  encodeAbiParameters,
  formatEther,
  getAddress,
  http,
  parseAbi,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

import { deriveLotteryOappStoreBytes32 } from '../../server/_lib/onchain/solanaLotteryOappClient.js'
import { readSolanaLayerZeroDvnPreflight } from './preflight-solana-lz-dvns.js'
import { resolveTestnetDvnPolicy } from './preflight-solana-lottery-oapp.js'

const BASE_SEPOLIA_CHAIN_ID = 84_532
const BASE_SEPOLIA_EID = 40_245
const SOLANA_DEVNET_EID = 40_168
const TEST_OAPP_PROGRAM = 'AfLeqn4UzPVeedCTijMcdx7Skb6fbyuYpBEzqGMQUveG'
const DEFAULT_TEST_RECEIVER = getAddress('0x46F77a5E204DbD9A31870E819e671914B40477a3')
const TEST_RECEIVER_OWNER = getAddress('0xB05Cf01231cF2fF99499682E64D3780d57c80FdD')
const BASE_SEPOLIA_ENDPOINT = getAddress('0x6EDCE65403992e310A62460808c4b910D972f10f')
const NIL_DVN_COUNT = 255
const RECEIVE_ULN_CONFIG_TYPE = 2
const TEST_DVN_NAMES = ['LayerZero Labs', 'P2P'] as const
const TEST_DVN_THRESHOLD = 2
const PUBLIC_BASE_SEPOLIA_RPC = 'https://sepolia.base.org'

type UlnConfig = {
  confirmations: bigint
  requiredDvnCount: number
  optionalDvnCount: number
  optionalDvnThreshold: number
  requiredDvns: readonly Address[]
  optionalDvns: readonly Address[]
}

const ULN_CONFIG_ABI = [{
  type: 'tuple',
  components: [
    { name: 'confirmations', type: 'uint64' },
    { name: 'requiredDvnCount', type: 'uint8' },
    { name: 'optionalDvnCount', type: 'uint8' },
    { name: 'optionalDvnThreshold', type: 'uint8' },
    { name: 'requiredDvns', type: 'address[]' },
    { name: 'optionalDvns', type: 'address[]' },
  ],
}] as const

const ENDPOINT_ABI = parseAbi([
  'function eid() view returns (uint32)',
  'function getReceiveLibrary(address receiver, uint32 srcEid) view returns (address lib, bool isDefault)',
  'function getConfig(address oapp, address lib, uint32 eid, uint32 configType) view returns (bytes config)',
  'function delegates(address oapp) view returns (address delegate)',
  'function setConfig(address oapp, address lib, (uint32 eid, uint32 configType, bytes config)[] params)',
])

const RECEIVE_ULN_ABI = parseAbi([
  'function getAppUlnConfig(address oapp, uint32 remoteEid) view returns ((uint64 confirmations,uint8 requiredDvnCount,uint8 optionalDvnCount,uint8 optionalDvnThreshold,address[] requiredDvns,address[] optionalDvns))',
])

const RECEIVER_ABI = parseAbi([
  'function owner() view returns (address)',
  'function endpoint() view returns (address)',
])

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

/** Prefer `--receiver=0x…`, then `LOTTERY_RELAY_TEST_RECEIVER`, else default. */
function resolveTestReceiver(): Address {
  const fromArg = process.argv.find((a) => a.startsWith('--receiver='))?.slice('--receiver='.length)?.trim()
  const raw = (fromArg || env('LOTTERY_RELAY_TEST_RECEIVER')).trim()
  return raw ? getAddress(raw) : DEFAULT_TEST_RECEIVER
}

function normalizePrivateKey(raw: string): Hex {
  const value = raw.startsWith('0x') ? raw : `0x${raw}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('base_sepolia_owner_private_key_invalid')
  return value as Hex
}

function readOwnerAccount() {
  const raw = env('BASE_SEPOLIA_TEST_RECEIVER_OWNER_PRIVATE_KEY') || env('PRIVATE_KEY')
  if (!raw) throw new Error('missing_base_sepolia_test_receiver_owner_private_key')
  const account = privateKeyToAccount(normalizePrivateKey(raw))
  if (getAddress(account.address) !== TEST_RECEIVER_OWNER) throw new Error('base_sepolia_test_receiver_owner_signer_mismatch')
  return account
}

function sameAddress(left: Address, right: Address): boolean {
  return left.toLowerCase() === right.toLowerCase()
}

function orderedAddresses(addresses: readonly Address[]): Address[] {
  return [...addresses].sort((left, right) => left.toLowerCase().localeCompare(right.toLowerCase()))
}

function isExactAddressList(actual: readonly Address[], expected: readonly Address[]): boolean {
  return actual.length === expected.length && actual.every((address, index) => sameAddress(address, expected[index]))
}

export function buildTestRouteBaseReceiveUlnConfig(dvns: readonly Address[]): UlnConfig {
  if (dvns.length !== TEST_DVN_NAMES.length) throw new Error('test_route_base_dvn_count_mismatch')
  const sorted = orderedAddresses(dvns)
  if (new Set(sorted.map((address) => address.toLowerCase())).size !== sorted.length) {
    throw new Error('test_route_base_dvn_duplicate')
  }
  return {
    confirmations: 0n,
    requiredDvnCount: NIL_DVN_COUNT,
    optionalDvnCount: TEST_DVN_NAMES.length,
    optionalDvnThreshold: TEST_DVN_THRESHOLD,
    requiredDvns: [],
    optionalDvns: sorted,
  }
}

export function isExactTestRouteBaseReceiveUlnConfig(actual: UlnConfig, expected: UlnConfig): boolean {
  return actual.confirmations === expected.confirmations &&
    actual.requiredDvnCount === expected.requiredDvnCount &&
    actual.optionalDvnCount === expected.optionalDvnCount &&
    actual.optionalDvnThreshold === expected.optionalDvnThreshold &&
    isExactAddressList(actual.requiredDvns, expected.requiredDvns) &&
    isExactAddressList(actual.optionalDvns, expected.optionalDvns)
}

export function isDefaultAppUlnConfig(config: UlnConfig): boolean {
  return config.confirmations === 0n &&
    config.requiredDvnCount === 0 &&
    config.optionalDvnCount === 0 &&
    config.optionalDvnThreshold === 0 &&
    config.requiredDvns.length === 0 &&
    config.optionalDvns.length === 0
}

function decodeUlnConfig(encoded: Hex): UlnConfig {
  const [decoded] = decodeAbiParameters(ULN_CONFIG_ABI, encoded)
  return decoded as UlnConfig
}

function encodeUlnConfig(config: UlnConfig): Hex {
  return encodeAbiParameters(ULN_CONFIG_ABI, [config])
}

function hasExactPolicy(policy: { expected: readonly string[]; threshold: number }): boolean {
  return policy.threshold === TEST_DVN_THRESHOLD &&
    policy.expected.length === TEST_DVN_NAMES.length &&
    [...policy.expected].sort().join('|') === [...TEST_DVN_NAMES].sort().join('|')
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function resolveBaseSepoliaDvns(): Promise<Address[]> {
  const policy = resolveTestnetDvnPolicy(process.env)
  if (!hasExactPolicy(policy)) throw new Error('test_route_dvn_policy_not_canonical_2of2')
  const metadata = await readSolanaLayerZeroDvnPreflight({
    stage: 'testnet',
    chains: ['base-sepolia', 'solana-testnet'],
    expectedDvns: TEST_DVN_NAMES,
    threshold: TEST_DVN_THRESHOLD,
  })
  if (!metadata.ok) throw new Error(`test_route_dvn_metadata_unverified:${metadata.error ?? 'unknown'}`)
  return TEST_DVN_NAMES.map((name) => {
    const matches = (metadata.candidates[name] ?? []).filter((candidate) => candidate.chain === 'base-sepolia')
    if (matches.length !== 1) throw new Error(`test_route_base_dvn_metadata_ambiguous:${name}`)
    try {
      return getAddress(matches[0].address)
    } catch {
      throw new Error(`test_route_base_dvn_metadata_invalid_address:${name}`)
    }
  })
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute')
  const resetToDefault = process.argv.includes('--reset-to-default')
  const TEST_RECEIVER = resolveTestReceiver()
  if (env('SOLANA_LOTTERY_OAPP_ROUTE') !== 'testnet') throw new Error('testnet_route_required')
  if (env('SOLANA_LOTTERY_OAPP_PROGRAM_ID') !== TEST_OAPP_PROGRAM) throw new Error('isolated_test_oapp_program_required')

  const rpc = env('BASE_SEPOLIA_RPC_URL') || PUBLIC_BASE_SEPOLIA_RPC
  const client = createPublicClient({ chain: baseSepolia, transport: http(rpc) })
  if (await client.getChainId() !== BASE_SEPOLIA_CHAIN_ID) throw new Error('base_sepolia_chain_id_mismatch')
  const testStore = deriveLotteryOappStoreBytes32(new PublicKey(TEST_OAPP_PROGRAM))
  const [receiverCode, endpointCode, receiverOwner, receiverEndpoint, endpointDelegate, receiveLibraryResult, dvns] = await Promise.all([
    client.getBytecode({ address: TEST_RECEIVER }),
    client.getBytecode({ address: BASE_SEPOLIA_ENDPOINT }),
    client.readContract({ address: TEST_RECEIVER, abi: RECEIVER_ABI, functionName: 'owner' }),
    client.readContract({ address: TEST_RECEIVER, abi: RECEIVER_ABI, functionName: 'endpoint' }),
    client.readContract({ address: BASE_SEPOLIA_ENDPOINT, abi: ENDPOINT_ABI, functionName: 'delegates', args: [TEST_RECEIVER] }),
    client.readContract({ address: BASE_SEPOLIA_ENDPOINT, abi: ENDPOINT_ABI, functionName: 'getReceiveLibrary', args: [TEST_RECEIVER, SOLANA_DEVNET_EID] }),
    resolveBaseSepoliaDvns(),
  ])
  if (!receiverCode || receiverCode === '0x' || !endpointCode || endpointCode === '0x') throw new Error('base_sepolia_test_route_code_missing')
  if (getAddress(receiverOwner) !== TEST_RECEIVER_OWNER || getAddress(receiverEndpoint) !== BASE_SEPOLIA_ENDPOINT) {
    throw new Error('base_sepolia_test_receiver_identity_mismatch')
  }
  if (getAddress(endpointDelegate) !== TEST_RECEIVER_OWNER) throw new Error('base_sepolia_test_receiver_delegate_mismatch')

  const [receiveLibrary, receiveLibraryIsDefault] = receiveLibraryResult
  if (receiveLibrary === '0x0000000000000000000000000000000000000000') throw new Error('base_sepolia_receive_library_zero')
  const [currentAppConfig, currentEffectiveConfigRaw] = await Promise.all([
    client.readContract({ address: receiveLibrary, abi: RECEIVE_ULN_ABI, functionName: 'getAppUlnConfig', args: [TEST_RECEIVER, SOLANA_DEVNET_EID] }),
    client.readContract({ address: BASE_SEPOLIA_ENDPOINT, abi: ENDPOINT_ABI, functionName: 'getConfig', args: [TEST_RECEIVER, receiveLibrary, SOLANA_DEVNET_EID, RECEIVE_ULN_CONFIG_TYPE] }),
  ])
  const current = currentAppConfig as UlnConfig
  const desired = resetToDefault
    ? { confirmations: 0n, requiredDvnCount: 0, optionalDvnCount: 0, optionalDvnThreshold: 0, requiredDvns: [], optionalDvns: [] }
    : buildTestRouteBaseReceiveUlnConfig(dvns)
  if (!resetToDefault && isExactTestRouteBaseReceiveUlnConfig(current, desired)) {
    process.stdout.write(`${JSON.stringify({
      ok: true,
      mode: execute ? 'execute' : 'dry_run',
      action: 'base_sepolia_receive_uln_2of2_already_configured',
      transactionSubmitted: false,
      receiver: TEST_RECEIVER,
      receiveLibrary,
      storeBytes32: testStore,
    }, null, 2)}\n`)
    return
  }
  if (resetToDefault ? !isExactTestRouteBaseReceiveUlnConfig(current, buildTestRouteBaseReceiveUlnConfig(dvns)) : !isDefaultAppUlnConfig(current)) {
    throw new Error('base_sepolia_receive_uln_unexpected_existing_config')
  }

  const config = encodeUlnConfig(desired)
  const request = {
    address: BASE_SEPOLIA_ENDPOINT,
    abi: ENDPOINT_ABI,
    functionName: 'setConfig' as const,
    args: [TEST_RECEIVER, receiveLibrary, [{ eid: SOLANA_DEVNET_EID, configType: RECEIVE_ULN_CONFIG_TYPE, config }]] as const,
    account: TEST_RECEIVER_OWNER,
  } as const
  const [simulation, gas, fees] = await Promise.all([
    client.simulateContract(request),
    client.estimateContractGas(request),
    client.estimateFeesPerGas(),
  ])
  const maxFeePerGas = fees.maxFeePerGas ?? fees.gasPrice
  if (maxFeePerGas == null) throw new Error('base_sepolia_fee_quote_unavailable')
  const maxCostWei = gas * maxFeePerGas
  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: execute ? 'execute' : 'dry_run',
    action: resetToDefault ? 'reset_base_sepolia_receive_uln_to_default' : 'set_base_sepolia_receive_uln_2of2',
    receiver: TEST_RECEIVER,
    owner: TEST_RECEIVER_OWNER,
    endpoint: BASE_SEPOLIA_ENDPOINT,
    receiveLibrary,
    receiveLibraryIsDefault,
    sourceEid: SOLANA_DEVNET_EID,
    storeBytes32: testStore,
    config,
    currentAppConfig: current,
    currentEffectiveConfig: decodeUlnConfig(currentEffectiveConfigRaw),
    desiredAppConfig: desired,
    estimated: {
      gas: gas.toString(),
      maxFeePerGasWei: maxFeePerGas.toString(),
      maxCostWei: maxCostWei.toString(),
      maxCostEth: formatEther(maxCostWei),
    },
    rollback: 'A separately approved --reset-to-default transaction clears only this receiver app-level receive ULN configuration so the endpoint default applies. It does not change the receiver peer, Store authorization, Solana configuration, or send any packet.',
  }, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2)}\n`)
  if (!execute) return

  const account = readOwnerAccount()
  const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(rpc) })
  const hash = await wallet.writeContract({ ...simulation.request, account })
  const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 180_000 })
  if (receipt.status !== 'success') throw new Error('base_sepolia_receive_uln_transaction_reverted')
  let post: UlnConfig | undefined
  for (let attempt = 0; attempt < 6; attempt += 1) {
    post = await client.readContract({
      address: receiveLibrary,
      abi: RECEIVE_ULN_ABI,
      functionName: 'getAppUlnConfig',
      args: [TEST_RECEIVER, SOLANA_DEVNET_EID],
    }) as UlnConfig
    if (resetToDefault ? isDefaultAppUlnConfig(post) : isExactTestRouteBaseReceiveUlnConfig(post, desired)) break
    if (attempt < 5) await delay(1_000)
  }
  if (!post || (resetToDefault ? !isDefaultAppUlnConfig(post) : !isExactTestRouteBaseReceiveUlnConfig(post, desired))) {
    throw new Error('base_sepolia_receive_uln_postcondition_mismatch')
  }
  process.stdout.write(`${JSON.stringify({ executed: true, transactionHash: hash, blockNumber: receipt.blockNumber.toString() }, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`Base Sepolia test receiver ULN configuration failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
