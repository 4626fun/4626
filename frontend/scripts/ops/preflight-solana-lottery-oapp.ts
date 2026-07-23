#!/usr/bin/env tsx
/** Read-only Solana OApp + Base authorizedRemoteOFTs preflight. */
import { pathToFileURL } from 'node:url'

import { Connection, PublicKey } from '@solana/web3.js'
import { createPublicClient, decodeAbiParameters, getAddress, http, parseAbi, type Address, type Chain, type Hex } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { EndpointProgram } from '@layerzerolabs/lz-solana-sdk-v2'
import { UlnProgram } from '@layerzerolabs/lz-solana-sdk-v2'
import { decodeLotteryOappPeer, decodeLotteryOappStoreEndpointProgram, decodeLotteryOappStoreOperator, deriveLotteryOappPdas, deriveLotteryOappStoreBytes32 } from '../../server/_lib/onchain/solanaLotteryOappClient.js'
import { CANONICAL_LOTTERY_MANAGER } from '../../server/_lib/onchain/solanaLotteryLzTransport.js'
import {
  MAINNET_BASE_SOLANA_DVNS,
  readSolanaLayerZeroDvnPreflight,
  type DvnPreflightResult,
} from './preflight-solana-lz-dvns.js'

const MAINNET_BASE_EID = 30_184
const MAINNET_SOLANA_EID = 30_168
const TESTNET_BASE_SEPOLIA_EID = 40_245
const TESTNET_SOLANA_DEVNET_EID = 40_168

type OappPreflightRoute = {
  name: 'mainnet' | 'testnet'
  destinationEid: number
  sourceEid: number
  receiver: Address
  expectedPeer: Hex
  evmRpc: string
  evmChain: Chain
  dvn: {
    stage: string
    chains: string[]
    expected: readonly string[]
    threshold: number
  }
}

function asPaddedEvmPeer(address: Address): Hex {
  return `0x${address.slice(2).toLowerCase().padStart(64, '0')}` as Hex
}

export function resolveTestnetDvnPolicy(env: Record<string, string | undefined>): {
  expected: readonly string[]
  threshold: number
} {
  const expected = String(env.SOLANA_LOTTERY_TEST_DVN_NAMES ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  const threshold = Number(env.SOLANA_LOTTERY_TEST_DVN_THRESHOLD ?? '')
  if (
    expected.length === 0 ||
    new Set(expected.map((name) => name.toLowerCase())).size !== expected.length ||
    !Number.isInteger(threshold) ||
    threshold <= 0 ||
    threshold > expected.length
  ) {
    throw new Error('test_route_dvn_policy_missing_or_invalid')
  }
  return { expected, threshold }
}

/**
 * Mainnet defaults remain immutable. The test route is opt-in, requires a
 * separate receiver plus RPC, and is only meaningful for a separately built
 * `lottery-relay-oapp --features test-route` program at a different address.
 */
export function resolveOappPreflightRoute(env: Record<string, string | undefined> = process.env): OappPreflightRoute {
  const route = String(env.SOLANA_LOTTERY_OAPP_ROUTE ?? 'mainnet').trim().toLowerCase()
  if (route === 'mainnet') {
    const receiver = getAddress(CANONICAL_LOTTERY_MANAGER)
    return {
      name: 'mainnet',
      destinationEid: MAINNET_BASE_EID,
      sourceEid: MAINNET_SOLANA_EID,
      receiver,
      expectedPeer: asPaddedEvmPeer(receiver),
      evmRpc: String(env.BASE_RPC_URL ?? '').split(',')[0]?.trim() ?? '',
      evmChain: base,
      dvn: {
        stage: 'mainnet',
        chains: ['base', 'solana'],
        expected: MAINNET_BASE_SOLANA_DVNS,
        threshold: 3,
      },
    }
  }
  if (route === 'testnet') {
    const receiverRaw = String(env.SOLANA_LOTTERY_TEST_RECEIVER ?? '').trim()
    const evmRpc = String(env.BASE_SEPOLIA_RPC_URL ?? '').split(',')[0]?.trim() ?? ''
    if (!/^0x[0-9a-fA-F]{40}$/.test(receiverRaw)) throw new Error('test_route_receiver_missing_or_invalid')
    const receiver = getAddress(receiverRaw)
    if (!evmRpc) throw new Error('test_route_base_sepolia_rpc_missing')
    const dvn = resolveTestnetDvnPolicy(env)
    return {
      name: 'testnet',
      destinationEid: TESTNET_BASE_SEPOLIA_EID,
      sourceEid: TESTNET_SOLANA_DEVNET_EID,
      receiver,
      expectedPeer: asPaddedEvmPeer(receiver),
      evmRpc,
      evmChain: baseSepolia,
      dvn: {
        stage: 'testnet',
        chains: ['base-sepolia', 'solana-testnet'],
        ...dvn,
      },
    }
  }
  throw new Error('invalid_solana_lottery_oapp_route')
}

type UlnSendState = {
  uln: {
    requiredDvnCount: number
    optionalDvnCount: number
    optionalDvnThreshold: number
    requiredDvns: PublicKey[]
    optionalDvns: PublicKey[]
  }
}

type EvmUlnConfig = {
  confirmations: bigint
  requiredDvnCount: number
  optionalDvnCount: number
  optionalDvnThreshold: number
  requiredDvns: readonly Address[]
  optionalDvns: readonly Address[]
}

const EVM_ULN_CONFIG_ABI = [{
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

const EVM_ENDPOINT_ABI = parseAbi([
  'function getReceiveLibrary(address receiver, uint32 srcEid) view returns (address lib, bool isDefault)',
  'function getConfig(address oapp, address lib, uint32 eid, uint32 configType) view returns (bytes config)',
])

export function resolveFinalUlnConfig(
  defaultState: UlnSendState,
  customState: UlnSendState | null,
): UlnSendState['uln'] {
  const nilDvnCount = 255
  const required = customState?.uln.requiredDvnCount
  const optional = customState?.uln.optionalDvnCount
  const requiredDvnCount = required == null || required === 0
    ? defaultState.uln.requiredDvnCount
    : required === nilDvnCount ? 0 : required
  const optionalDvnCount = optional == null || optional === 0
    ? defaultState.uln.optionalDvnCount
    : optional === nilDvnCount ? 0 : optional
  return {
    requiredDvnCount,
    optionalDvnCount,
    optionalDvnThreshold: optional == null || optional === 0
      ? defaultState.uln.optionalDvnThreshold
      : optional === nilDvnCount ? 0 : customState?.uln.optionalDvnThreshold ?? 0,
    requiredDvns: required == null || required === 0
      ? defaultState.uln.requiredDvns
      : required === nilDvnCount ? [] : customState?.uln.requiredDvns ?? [],
    optionalDvns: optional == null || optional === 0
      ? defaultState.uln.optionalDvns
      : optional === nilDvnCount ? [] : customState?.uln.optionalDvns ?? [],
  }
}

/**
 * Match the on-chain optional DVNs to the active Solana addresses in the
 * LayerZero metadata set. A complete route-specific ULN config is not
 * sufficient by itself: an unknown or stale DVN must fail closed before relay
 * activation.
 */
export function matchOptionalDvnsToActiveMetadata(
  optionalDvns: readonly PublicKey[],
  metadata: DvnPreflightResult,
  expectedDvns: readonly string[] = MAINNET_BASE_SOLANA_DVNS,
  sourceChain = 'solana',
): { ok: boolean; matchedNames: string[]; reason?: string } {
  if (!metadata.ok || metadata.threshold <= 0) {
    return { ok: false, matchedNames: [], reason: 'metadata_policy_not_ready' }
  }
  if (optionalDvns.length !== expectedDvns.length) {
    return { ok: false, matchedNames: [], reason: 'optional_dvn_count_mismatch' }
  }
  const onchainAddresses = optionalDvns.map((dvn) => dvn.toBase58())
  if (new Set(onchainAddresses).size !== onchainAddresses.length) {
    return { ok: false, matchedNames: [], reason: 'optional_dvn_duplicate' }
  }

  const matchedNames: string[] = []
  for (const address of onchainAddresses) {
    const matches = expectedDvns.filter((name) => {
      return (metadata.candidates[name] ?? []).some((candidate) => {
        if (candidate.chain !== sourceChain) return false
        try {
          return new PublicKey(candidate.address).toBase58() === address
        } catch {
          return false
        }
      })
    })
    if (matches.length !== 1) {
      return { ok: false, matchedNames, reason: `optional_dvn_metadata_mismatch:${address}` }
    }
    matchedNames.push(matches[0])
  }

  const expectedNames = [...expectedDvns].sort()
  if (matchedNames.length !== expectedNames.length || [...matchedNames].sort().join('|') !== expectedNames.join('|')) {
    return { ok: false, matchedNames, reason: 'optional_dvn_metadata_set_mismatch' }
  }
  return { ok: true, matchedNames }
}

function decodeEvmUlnConfig(encoded: Hex): EvmUlnConfig {
  const [decoded] = decodeAbiParameters(EVM_ULN_CONFIG_ABI, encoded)
  return decoded as EvmUlnConfig
}

/**
 * Destination ULN configuration uses EVM DVN addresses, while the source
 * check above uses Solana pubkeys. Require exactly one active non-read EVM
 * deployment per expected DVN name so that metadata ambiguity is fail-closed.
 */
export function matchEvmOptionalDvnsToActiveMetadata(
  optionalDvns: readonly Address[],
  metadata: DvnPreflightResult,
  expectedDvns: readonly string[],
  destinationChain: string,
): { ok: boolean; matchedNames: string[]; reason?: string } {
  if (!metadata.ok || optionalDvns.length !== expectedDvns.length) {
    return { ok: false, matchedNames: [], reason: 'destination_metadata_policy_not_ready' }
  }
  const expectedAddresses: Array<{ name: string; address: Address }> = []
  for (const name of expectedDvns) {
    const matches = (metadata.candidates[name] ?? []).filter((candidate) => candidate.chain === destinationChain)
    if (matches.length !== 1) return { ok: false, matchedNames: [], reason: `destination_dvn_metadata_ambiguous:${name}` }
    try {
      expectedAddresses.push({ name, address: getAddress(matches[0].address) })
    } catch {
      return { ok: false, matchedNames: [], reason: `destination_dvn_metadata_invalid_address:${name}` }
    }
  }
  const expected = [...expectedAddresses].sort((left, right) => left.address.toLowerCase().localeCompare(right.address.toLowerCase()))
  if (new Set(optionalDvns.map((address) => address.toLowerCase())).size !== optionalDvns.length) {
    return { ok: false, matchedNames: [], reason: 'destination_optional_dvn_duplicate' }
  }
  if (optionalDvns.some((address, index) => address.toLowerCase() !== expected[index]?.address.toLowerCase())) {
    return { ok: false, matchedNames: [], reason: 'destination_optional_dvn_metadata_mismatch' }
  }
  return { ok: true, matchedNames: expected.map(({ name }) => name) }
}

export function isExactDestinationUlnPolicy(
  config: EvmUlnConfig,
  expectedCount: number,
  expectedThreshold: number,
): boolean {
  // EndpointV2.getConfig resolves the app-level NIL (255) override to the
  // effective literal count zero; it must not be mistaken for a fallback.
  return config.requiredDvnCount === 0 &&
    config.requiredDvns.length === 0 &&
    config.optionalDvnCount === expectedCount &&
    config.optionalDvnThreshold === expectedThreshold &&
    config.optionalDvns.length === expectedCount
}

/**
 * A mapping getter alone does not prove that the Base receiver can receive a
 * LayerZero message. Require the OAppCore endpoint and its source peer to be
 * bound to the derived Solana Store before treating Base authorization as a
 * usable route.
 */
export function assessOappReceiverBinding(params: {
  expectedStoreBytes32: Hex
  receiverPeer: Hex
  receiverEndpoint: Address
  authorized: boolean
}): { ok: boolean; reason?: string } {
  if (params.receiverEndpoint.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    return { ok: false, reason: 'oapp_receiver_endpoint_zero' }
  }
  if (params.receiverPeer.toLowerCase() !== params.expectedStoreBytes32.toLowerCase()) {
    return { ok: false, reason: 'oapp_receiver_peer_mismatch' }
  }
  if (!params.authorized) return { ok: false, reason: 'base_lottery_manager_oapp_store_unauthorized' }
  return { ok: true }
}

async function main(): Promise<void> {
  const rpc = String(process.env.SOLANA_RPC_URL ?? '').trim()
  const programRaw = String(process.env.SOLANA_LOTTERY_OAPP_PROGRAM_ID ?? '').trim()
  const expectedOperator = String(process.env.SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY ?? '').trim()
  const route = resolveOappPreflightRoute()
  if (!rpc || !programRaw || !expectedOperator) throw new Error('missing_required_oapp_preflight_env')
  const program = new PublicKey(programRaw)
  const connection = new Connection(rpc, 'finalized')
  const { store, peer } = deriveLotteryOappPdas(program, route.destinationEid)
  const [programInfo, storeInfo, peerInfo] = await connection.getMultipleAccountsInfo([program, store, peer], 'finalized')
  if (!programInfo?.executable) throw new Error('oapp_program_not_executable')
  if (!storeInfo?.owner.equals(program)) throw new Error('oapp_store_missing_or_wrong_owner')
  if (!peerInfo?.owner.equals(program)) throw new Error('oapp_peer_missing_or_wrong_owner')
  const operator = decodeLotteryOappStoreOperator(storeInfo.data).toBase58()
  const endpointProgram = decodeLotteryOappStoreEndpointProgram(storeInfo.data).toBase58()
  if (endpointProgram !== EndpointProgram.PROGRAM_ID.toBase58()) throw new Error(`oapp_endpoint_program_mismatch:${endpointProgram}`)
  const basePeer = decodeLotteryOappPeer(peerInfo.data).toLowerCase()
  if (operator !== expectedOperator) throw new Error(`oapp_operator_mismatch:${operator}`)
  if (basePeer !== route.expectedPeer) throw new Error(`oapp_base_peer_mismatch:${basePeer}`)
  const ulnProgramRaw = String(process.env.SOLANA_LOTTERY_OAPP_ULN_PROGRAM_ID ?? '').trim()
  const ulnProgram = ulnProgramRaw ? new PublicKey(ulnProgramRaw) : UlnProgram.PROGRAM_ID
  const endpoint = new EndpointProgram.Endpoint(EndpointProgram.PROGRAM_ID)
  let sendLibrary: { msgLib: PublicKey; programId: PublicKey; isDefault: boolean }
  try {
    sendLibrary = await endpoint.getSendLibrary(connection, store, route.destinationEid, 'finalized')
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`oapp_send_library_unconfigured:${reason}`)
  }
  if (!sendLibrary.programId.equals(ulnProgram) || sendLibrary.isDefault) {
    throw new Error(`oapp_send_library_mismatch:${sendLibrary.programId.toBase58()}:${sendLibrary.isDefault ? 'default' : 'explicit'}`)
  }
  // Endpoint quote/send requires an initialized nonce for the exact Store /
  // destination / remote-peer path. A library and ULN policy alone are not
  // enough; reject the route before a worker can discover this during a send.
  const remotePeer = Buffer.from(basePeer.slice(2), 'hex')
  const [outboundNonce] = endpoint.deriver.nonce(store, route.destinationEid, remotePeer)
  const [pendingInboundNonce] = endpoint.deriver.pendingNonce(store, route.destinationEid, remotePeer)
  const [outboundNonceInfo, pendingInboundNonceInfo] = await connection.getMultipleAccountsInfo(
    [outboundNonce, pendingInboundNonce],
    'finalized',
  )
  if (!outboundNonceInfo?.owner.equals(EndpointProgram.PROGRAM_ID)) throw new Error('oapp_outbound_nonce_missing_or_wrong_owner')
  if (!pendingInboundNonceInfo?.owner.equals(EndpointProgram.PROGRAM_ID)) throw new Error('oapp_pending_inbound_nonce_missing_or_wrong_owner')
  const uln = new UlnProgram.Uln(ulnProgram)
  const defaultSendConfig = await uln.getDefaultSendConfigState(connection, route.destinationEid, 'finalized') as UlnSendState | null
  if (!defaultSendConfig) throw new Error('oapp_uln_default_send_config_missing')
  const customSendConfig = await uln.getSendConfigState(connection, store, route.destinationEid, 'finalized') as UlnSendState | null
  const finalUln = resolveFinalUlnConfig(defaultSendConfig, customSendConfig)
  if (
    finalUln.requiredDvnCount !== 0 ||
    finalUln.optionalDvnCount !== route.dvn.expected.length ||
    finalUln.optionalDvnThreshold !== route.dvn.threshold
  ) {
    throw new Error(
      `oapp_uln_dvn_policy_mismatch:required=${finalUln.requiredDvnCount},optional=${finalUln.optionalDvnCount},threshold=${finalUln.optionalDvnThreshold}`,
    )
  }
  if (
    finalUln.optionalDvns.length !== route.dvn.expected.length ||
    new Set(finalUln.optionalDvns.map((dvn) => dvn.toBase58())).size !== route.dvn.expected.length
  ) {
    throw new Error('oapp_uln_optional_dvns_malformed')
  }
  const dvnMetadata = await readSolanaLayerZeroDvnPreflight({
    stage: route.dvn.stage,
    chains: route.dvn.chains,
    expectedDvns: route.dvn.expected,
    threshold: route.dvn.threshold,
  })
  const dvnMetadataMatch = matchOptionalDvnsToActiveMetadata(
    finalUln.optionalDvns,
    dvnMetadata,
    route.dvn.expected,
    route.dvn.chains[1],
  )
  if (!dvnMetadataMatch.ok) {
    throw new Error(`oapp_uln_dvn_metadata_mismatch:${dvnMetadataMatch.reason ?? 'unknown'}`)
  }
  const storeBytes32 = deriveLotteryOappStoreBytes32(program)
  const client = createPublicClient({ chain: route.evmChain, transport: http(route.evmRpc) })
  const [authorized, receiverPeer, receiverEndpoint] = await Promise.all([
    client.readContract({
      address: route.receiver,
      abi: [{ type: 'function', name: 'authorizedRemoteOFTs', stateMutability: 'view', inputs: [{ type: 'uint32' }, { type: 'bytes32' }], outputs: [{ type: 'bool' }] }] as const,
      functionName: 'authorizedRemoteOFTs', args: [route.sourceEid, storeBytes32],
    }),
    client.readContract({
      address: route.receiver,
      abi: [{ type: 'function', name: 'peers', stateMutability: 'view', inputs: [{ type: 'uint32' }], outputs: [{ type: 'bytes32' }] }] as const,
      functionName: 'peers', args: [route.sourceEid],
    }),
    client.readContract({
      address: route.receiver,
      abi: [{ type: 'function', name: 'endpoint', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }] as const,
      functionName: 'endpoint',
    }),
  ])
  if (receiverEndpoint.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    throw new Error('oapp_receiver_endpoint_zero')
  }
  const receiveLibraryResult = await client.readContract({
    address: receiverEndpoint,
    abi: EVM_ENDPOINT_ABI,
    functionName: 'getReceiveLibrary',
    args: [route.receiver, route.sourceEid],
  })
  const [receiveLibrary] = receiveLibraryResult
  if (receiveLibrary === '0x0000000000000000000000000000000000000000') throw new Error('oapp_destination_receive_library_zero')
  const destinationConfigRaw = await client.readContract({
    address: receiverEndpoint,
    abi: EVM_ENDPOINT_ABI,
    functionName: 'getConfig',
    args: [route.receiver, receiveLibrary, route.sourceEid, 2],
  })
  const destinationUln = decodeEvmUlnConfig(destinationConfigRaw)
  if (!isExactDestinationUlnPolicy(destinationUln, route.dvn.expected.length, route.dvn.threshold)) {
    throw new Error(
      `oapp_destination_uln_policy_mismatch:required=${destinationUln.requiredDvnCount},optional=${destinationUln.optionalDvnCount},threshold=${destinationUln.optionalDvnThreshold}`,
    )
  }
  const destinationDvnMatch = matchEvmOptionalDvnsToActiveMetadata(
    destinationUln.optionalDvns,
    dvnMetadata,
    route.dvn.expected,
    route.dvn.chains[0],
  )
  if (!destinationDvnMatch.ok) {
    throw new Error(`oapp_destination_uln_dvn_metadata_mismatch:${destinationDvnMatch.reason ?? 'unknown'}`)
  }
  const receiverBinding = assessOappReceiverBinding({
    expectedStoreBytes32: storeBytes32,
    receiverPeer,
    receiverEndpoint,
    authorized,
  })
  if (!receiverBinding.ok) throw new Error(receiverBinding.reason)
  process.stdout.write(`${JSON.stringify({
    ok: true,
    route: route.name,
    destinationEid: route.destinationEid,
    sourceEid: route.sourceEid,
    program: program.toBase58(),
    store: store.toBase58(),
    storeBytes32,
    peer: peer.toBase58(),
    basePeer,
    receiver: route.receiver,
    operator,
    endpointProgram,
    baseAuthorized: true,
    receiverEndpoint,
    receiverPeer,
    ulnProgram: ulnProgram.toBase58(),
    sendLibrary: {
      program: sendLibrary.programId.toBase58(),
      messageLibrary: sendLibrary.msgLib.toBase58(),
      explicit: !sendLibrary.isDefault,
    },
    nonce: {
      outbound: outboundNonce.toBase58(),
      pendingInbound: pendingInboundNonce.toBase58(),
    },
    ulnDvnPolicy: {
      requiredDvnCount: finalUln.requiredDvnCount,
      optionalDvnCount: finalUln.optionalDvnCount,
      optionalDvnThreshold: finalUln.optionalDvnThreshold,
      optionalDvns: finalUln.optionalDvns.map((dvn) => dvn.toBase58()),
      metadata: {
        url: dvnMetadata.url,
        stage: dvnMetadata.stage,
        matchedNames: dvnMetadataMatch.matchedNames,
      },
    },
    destinationUlnDvnPolicy: {
      receiveLibrary,
      requiredDvnCount: destinationUln.requiredDvnCount,
      optionalDvnCount: destinationUln.optionalDvnCount,
      optionalDvnThreshold: destinationUln.optionalDvnThreshold,
      optionalDvns: destinationUln.optionalDvns,
      metadata: {
        url: dvnMetadata.url,
        stage: dvnMetadata.stage,
        matchedNames: destinationDvnMatch.matchedNames,
      },
    },
  }, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`solana lottery OApp preflight failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
  })
}
