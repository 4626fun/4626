#!/usr/bin/env tsx
/**
 * Configure only the Base mainnet receive ULN policy for the production
 * Solana lottery OApp. This never sets the LotteryManager peer, authorizes the
 * Store, sends a LayerZero packet, or changes a Solana/relay feature flag.
 */
import { pathToFileURL } from 'node:url'

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
import { base } from 'viem/chains'

import { CANONICAL_LOTTERY_MANAGER } from '../../server/_lib/onchain/solanaLotteryLzTransport.js'
import {
  MAINNET_BASE_SOLANA_DVNS,
  MAINNET_BASE_SOLANA_DVN_THRESHOLD,
  readSolanaLayerZeroDvnPreflight,
} from './preflight-solana-lz-dvns.js'

const BASE_MAINNET_CHAIN_ID = 8_453
const SOLANA_MAINNET_EID = 30_168
const BASE_MAINNET_ENDPOINT = getAddress('0x1a44076050125825900e736c501f859c50fE728c')
const LOTTERY_MANAGER = getAddress(CANONICAL_LOTTERY_MANAGER)
const PRODUCTION_OAPP_PROGRAM_ID = 'GgsdTRxKozPwYAiBhhsaVWGC76CMpSu5rtdwFhHMX2WB'
const NIL_DVN_COUNT = 255
const RECEIVE_ULN_CONFIG_TYPE = 2
const SOLANA_CONFIRMATIONS = 32n

export type MainnetReceiverUlnConfig = {
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
  'function delegates(address oapp) view returns (address delegate)',
  'function getReceiveLibrary(address receiver, uint32 srcEid) view returns (address lib, bool isDefault)',
  'function getConfig(address oapp, address lib, uint32 eid, uint32 configType) view returns (bytes config)',
  'function setConfig(address oapp, address lib, (uint32 eid, uint32 configType, bytes config)[] params)',
])

const RECEIVE_ULN_ABI = parseAbi([
  'function getAppUlnConfig(address oapp, uint32 remoteEid) view returns ((uint64 confirmations,uint8 requiredDvnCount,uint8 optionalDvnCount,uint8 optionalDvnThreshold,address[] requiredDvns,address[] optionalDvns))',
])

const LOTTERY_MANAGER_ABI = parseAbi([
  'function owner() view returns (address)',
  'function endpoint() view returns (address)',
])

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function enabled(name: string): boolean {
  return ['1', 'true', 'yes'].includes(env(name).toLowerCase())
}

function assertDisabled(): void {
  for (const flag of [
    'SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED',
    'SOLANA_LOTTERY_OAPP_SEND_ENABLED',
    'SOLANA_LOTTERY_WINNER_SETTLEMENT_ENABLED',
  ]) {
    if (enabled(flag)) throw new Error(`${flag.toLowerCase()}_must_remain_disabled`)
  }
}

function normalizePrivateKey(raw: string): Hex {
  const value = raw.startsWith('0x') ? raw : `0x${raw}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('base_lottery_manager_owner_private_key_invalid')
  return value as Hex
}

function readOwnerAccount(expectedOwner: Address) {
  const raw = env('BASE_LOTTERY_MANAGER_OWNER_PRIVATE_KEY') || env('PRIVATE_KEY')
  if (!raw) throw new Error('missing_base_lottery_manager_owner_private_key')
  const account = privateKeyToAccount(normalizePrivateKey(raw))
  if (getAddress(account.address) !== expectedOwner) throw new Error('base_lottery_manager_owner_signer_mismatch')
  return account
}

function orderedAddresses(addresses: readonly Address[]): Address[] {
  return [...addresses].sort((left, right) => left.toLowerCase().localeCompare(right.toLowerCase()))
}

function exactAddressList(actual: readonly Address[], expected: readonly Address[]): boolean {
  return actual.length === expected.length && actual.every((address, index) => address.toLowerCase() === expected[index]?.toLowerCase())
}

export function buildMainnetReceiverUlnConfig(dvns: readonly Address[]): MainnetReceiverUlnConfig {
  if (dvns.length !== MAINNET_BASE_SOLANA_DVNS.length) throw new Error('mainnet_base_dvn_count_mismatch')
  const optionalDvns = orderedAddresses(dvns)
  if (new Set(optionalDvns.map((address) => address.toLowerCase())).size !== optionalDvns.length) {
    throw new Error('mainnet_base_dvn_duplicate')
  }
  return {
    // Zero means inherit the selected receive library's reviewed default.
    // The effective readback below must still resolve to exactly 32.
    confirmations: 0n,
    requiredDvnCount: NIL_DVN_COUNT,
    optionalDvnCount: optionalDvns.length,
    optionalDvnThreshold: MAINNET_BASE_SOLANA_DVN_THRESHOLD,
    requiredDvns: [],
    optionalDvns,
  }
}

export function isExactEffectiveMainnetReceiverUlnConfig(
  actual: MainnetReceiverUlnConfig,
  expectedRaw: MainnetReceiverUlnConfig,
): boolean {
  return actual.confirmations === SOLANA_CONFIRMATIONS &&
    actual.requiredDvnCount === 0 &&
    actual.optionalDvnCount === expectedRaw.optionalDvnCount &&
    actual.optionalDvnThreshold === expectedRaw.optionalDvnThreshold &&
    actual.requiredDvns.length === 0 &&
    exactAddressList(actual.optionalDvns, expectedRaw.optionalDvns)
}

export function isExactMainnetReceiverUlnConfig(
  actual: MainnetReceiverUlnConfig,
  expected: MainnetReceiverUlnConfig,
): boolean {
  return actual.confirmations === expected.confirmations &&
    actual.requiredDvnCount === expected.requiredDvnCount &&
    actual.optionalDvnCount === expected.optionalDvnCount &&
    actual.optionalDvnThreshold === expected.optionalDvnThreshold &&
    exactAddressList(actual.requiredDvns, expected.requiredDvns) &&
    exactAddressList(actual.optionalDvns, expected.optionalDvns)
}

export function isDefaultMainnetReceiverAppConfig(config: MainnetReceiverUlnConfig): boolean {
  return config.confirmations === 0n &&
    config.requiredDvnCount === 0 &&
    config.optionalDvnCount === 0 &&
    config.optionalDvnThreshold === 0 &&
    config.requiredDvns.length === 0 &&
    config.optionalDvns.length === 0
}

function decodeUlnConfig(encoded: Hex): MainnetReceiverUlnConfig {
  const [decoded] = decodeAbiParameters(ULN_CONFIG_ABI, encoded)
  return decoded as MainnetReceiverUlnConfig
}

function encodeUlnConfig(config: MainnetReceiverUlnConfig): Hex {
  return encodeAbiParameters(ULN_CONFIG_ABI, [config])
}

async function resolveBaseMainnetDvns(): Promise<Address[]> {
  const metadata = await readSolanaLayerZeroDvnPreflight({
    stage: 'mainnet',
    chains: ['base', 'solana'],
    expectedDvns: MAINNET_BASE_SOLANA_DVNS,
    threshold: MAINNET_BASE_SOLANA_DVN_THRESHOLD,
  })
  if (!metadata.ok) throw new Error(`mainnet_dvn_metadata_unverified:${metadata.error ?? 'unknown'}`)
  return MAINNET_BASE_SOLANA_DVNS.map((name) => {
    const matches = (metadata.candidates[name] ?? []).filter((candidate) => candidate.chain === 'base')
    if (matches.length !== 1) throw new Error(`mainnet_base_dvn_metadata_ambiguous:${name}`)
    try {
      return getAddress(matches[0].address)
    } catch {
      throw new Error(`mainnet_base_dvn_metadata_invalid_address:${name}`)
    }
  })
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute')
  const resetToDefault = process.argv.includes('--reset-to-default')
  if (env('SOLANA_LOTTERY_OAPP_ROUTE') && env('SOLANA_LOTTERY_OAPP_ROUTE').toLowerCase() !== 'mainnet') {
    throw new Error('mainnet_oapp_route_required')
  }
  if (env('SOLANA_LOTTERY_OAPP_PROGRAM_ID') !== PRODUCTION_OAPP_PROGRAM_ID) {
    throw new Error('production_oapp_program_required')
  }
  assertDisabled()

  const rpc = env('BASE_RPC_URL').split(',')[0]?.trim()
  if (!rpc) throw new Error('missing_base_rpc_url')
  const client = createPublicClient({ chain: base, transport: http(rpc) })
  if (await client.getChainId() !== BASE_MAINNET_CHAIN_ID) throw new Error('base_mainnet_chain_id_mismatch')

  const [managerCode, endpointCode, owner, managerEndpoint, endpointEid, delegate, receiveLibraryResult, dvns] = await Promise.all([
    client.getBytecode({ address: LOTTERY_MANAGER }),
    client.getBytecode({ address: BASE_MAINNET_ENDPOINT }),
    client.readContract({ address: LOTTERY_MANAGER, abi: LOTTERY_MANAGER_ABI, functionName: 'owner' }),
    client.readContract({ address: LOTTERY_MANAGER, abi: LOTTERY_MANAGER_ABI, functionName: 'endpoint' }),
    client.readContract({ address: BASE_MAINNET_ENDPOINT, abi: ENDPOINT_ABI, functionName: 'eid' }),
    client.readContract({ address: BASE_MAINNET_ENDPOINT, abi: ENDPOINT_ABI, functionName: 'delegates', args: [LOTTERY_MANAGER] }),
    client.readContract({ address: BASE_MAINNET_ENDPOINT, abi: ENDPOINT_ABI, functionName: 'getReceiveLibrary', args: [LOTTERY_MANAGER, SOLANA_MAINNET_EID] }),
    resolveBaseMainnetDvns(),
  ])
  if (!managerCode || managerCode === '0x' || !endpointCode || endpointCode === '0x') throw new Error('base_mainnet_lottery_route_code_missing')
  if (getAddress(managerEndpoint) !== BASE_MAINNET_ENDPOINT || endpointEid !== 30_184) throw new Error('base_mainnet_endpoint_identity_mismatch')
  const expectedOwner = getAddress(owner)
  if (getAddress(delegate) !== expectedOwner) throw new Error('base_lottery_manager_endpoint_delegate_mismatch')

  const [receiveLibrary, receiveLibraryIsDefault] = receiveLibraryResult
  if (receiveLibrary === '0x0000000000000000000000000000000000000000') throw new Error('base_mainnet_receive_library_zero')
  const [receiveLibraryCode, currentAppConfig, currentEffectiveConfigRaw] = await Promise.all([
    client.getBytecode({ address: receiveLibrary }),
    client.readContract({ address: receiveLibrary, abi: RECEIVE_ULN_ABI, functionName: 'getAppUlnConfig', args: [LOTTERY_MANAGER, SOLANA_MAINNET_EID] }),
    client.readContract({ address: BASE_MAINNET_ENDPOINT, abi: ENDPOINT_ABI, functionName: 'getConfig', args: [LOTTERY_MANAGER, receiveLibrary, SOLANA_MAINNET_EID, RECEIVE_ULN_CONFIG_TYPE] }),
  ])
  if (!receiveLibraryCode || receiveLibraryCode === '0x') throw new Error('base_mainnet_receive_library_code_missing')
  const current = currentAppConfig as MainnetReceiverUlnConfig
  const currentEffective = decodeUlnConfig(currentEffectiveConfigRaw)
  if (currentEffective.confirmations !== SOLANA_CONFIRMATIONS) {
    throw new Error(`base_mainnet_effective_confirmations_mismatch:${currentEffective.confirmations}`)
  }
  const canonical = buildMainnetReceiverUlnConfig(dvns)
  const desired: MainnetReceiverUlnConfig = resetToDefault
    ? { confirmations: 0n, requiredDvnCount: 0, optionalDvnCount: 0, optionalDvnThreshold: 0, requiredDvns: [], optionalDvns: [] }
    : canonical

  if (!resetToDefault && isExactMainnetReceiverUlnConfig(current, canonical)) {
    process.stdout.write(`${JSON.stringify({
      ok: true,
      mode: execute ? 'execute' : 'dry_run',
      action: 'base_mainnet_receive_uln_3of5_already_configured',
      transactionSubmitted: false,
      receiver: LOTTERY_MANAGER,
      receiveLibrary,
    }, null, 2)}\n`)
    return
  }
  if (resetToDefault ? !isExactMainnetReceiverUlnConfig(current, canonical) : !isDefaultMainnetReceiverAppConfig(current)) {
    throw new Error('base_mainnet_receive_uln_unexpected_existing_config')
  }

  const config = encodeUlnConfig(desired)
  const request = {
    address: BASE_MAINNET_ENDPOINT,
    abi: ENDPOINT_ABI,
    functionName: 'setConfig' as const,
    args: [LOTTERY_MANAGER, receiveLibrary, [{ eid: SOLANA_MAINNET_EID, configType: RECEIVE_ULN_CONFIG_TYPE, config }]] as const,
    account: expectedOwner,
  } as const
  const [simulation, gas, fees] = await Promise.all([
    client.simulateContract(request),
    client.estimateContractGas(request),
    client.estimateFeesPerGas(),
  ])
  const maxFeePerGas = fees.maxFeePerGas ?? fees.gasPrice
  if (maxFeePerGas == null) throw new Error('base_mainnet_fee_quote_unavailable')
  const maxCostWei = gas * maxFeePerGas
  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: execute ? 'execute' : 'dry_run',
    action: resetToDefault ? 'reset_base_mainnet_receive_uln_to_default' : 'set_base_mainnet_receive_uln_3of5',
    receiver: LOTTERY_MANAGER,
    owner: expectedOwner,
    endpoint: BASE_MAINNET_ENDPOINT,
    receiveLibrary,
    receiveLibraryIsDefault,
    sourceEid: SOLANA_MAINNET_EID,
    policy: { names: MAINNET_BASE_SOLANA_DVNS, threshold: MAINNET_BASE_SOLANA_DVN_THRESHOLD },
    config,
    currentAppConfig: current,
    currentEffectiveConfig: currentEffective,
    desiredAppConfig: desired,
    estimated: {
      gas: gas.toString(),
      maxFeePerGasWei: maxFeePerGas.toString(),
      maxCostWei: maxCostWei.toString(),
      maxCostEth: formatEther(maxCostWei),
    },
    relayEntriesEnabled: false,
    oappSendingEnabled: false,
    winnerSettlementEnabled: false,
    rollback: 'A separately approved --reset-to-default transaction clears only this LotteryManager app-level receive ULN configuration. Then revoke Store authorization and clear peer before considering the route disabled.',
  }, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2)}\n`)
  if (!execute) return

  if (!env('SOLANA_LOTTERY_OAPP_BASE_RECEIVE_ULN_APPROVAL_REF')) {
    throw new Error('missing_solana_lottery_oapp_base_receive_uln_approval_ref')
  }
  const account = readOwnerAccount(expectedOwner)
  const wallet = createWalletClient({ account, chain: base, transport: http(rpc) })
  const hash = await wallet.writeContract({ ...simulation.request, account })
  const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 180_000 })
  if (receipt.status !== 'success') throw new Error('base_mainnet_receive_uln_transaction_reverted')

  let post: MainnetReceiverUlnConfig | undefined
  let postEffective: MainnetReceiverUlnConfig | undefined
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const [rawPost, effectivePostRaw] = await Promise.all([
      client.readContract({
        address: receiveLibrary,
        abi: RECEIVE_ULN_ABI,
        functionName: 'getAppUlnConfig',
        args: [LOTTERY_MANAGER, SOLANA_MAINNET_EID],
      }),
      client.readContract({
        address: BASE_MAINNET_ENDPOINT,
        abi: ENDPOINT_ABI,
        functionName: 'getConfig',
        args: [LOTTERY_MANAGER, receiveLibrary, SOLANA_MAINNET_EID, RECEIVE_ULN_CONFIG_TYPE],
      }),
    ])
    post = rawPost as MainnetReceiverUlnConfig
    postEffective = decodeUlnConfig(effectivePostRaw)
    const rawMatches = resetToDefault
      ? isDefaultMainnetReceiverAppConfig(post)
      : isExactMainnetReceiverUlnConfig(post, canonical)
    const effectiveMatches = resetToDefault
      ? postEffective.confirmations === SOLANA_CONFIRMATIONS
      : isExactEffectiveMainnetReceiverUlnConfig(postEffective, canonical)
    if (rawMatches && effectiveMatches) break
    if (attempt < 5) await delay(1_000)
  }
  const rawMatches = post && (resetToDefault
    ? isDefaultMainnetReceiverAppConfig(post)
    : isExactMainnetReceiverUlnConfig(post, canonical))
  const effectiveMatches = postEffective && (resetToDefault
    ? postEffective.confirmations === SOLANA_CONFIRMATIONS
    : isExactEffectiveMainnetReceiverUlnConfig(postEffective, canonical))
  if (!rawMatches || !effectiveMatches) {
    throw new Error('base_mainnet_receive_uln_postcondition_mismatch')
  }
  process.stdout.write(`${JSON.stringify({ executed: true, transactionHash: hash, blockNumber: receipt.blockNumber.toString() }, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`Base mainnet LotteryManager receive ULN configuration failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
