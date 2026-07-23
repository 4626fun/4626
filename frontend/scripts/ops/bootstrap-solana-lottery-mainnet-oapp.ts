#!/usr/bin/env tsx
/**
 * Quote and, only with an explicit action plus approval reference, bootstrap
 * one production Solana lottery OApp account/configuration boundary.
 *
 * This helper is intentionally one-action-at-a-time. It never deploys the
 * program, changes Base, sends an entry, settles a winner, creates a hook
 * mint/pool, or turns on a feature flag. All operations are mainnet-genesis
 * locked and need a final simulation before an `--execute` submission.
 *
 * Actions:
 *   init-store       creates Store + Endpoint OApp registry
 *   set-peer         creates the fixed Base LotteryManager Peer PDA
 *   set-send-library creates/selects explicit ULN send library
 *   configure-uln   creates config PDAs and applies exact metadata-verified 3/5 SEND_ULN
 *   init-nonce       creates endpoint nonce PDAs for the fixed Base peer
 */
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction, type TransactionInstruction } from '@solana/web3.js'
import { EndpointProgram, SetConfigType, UlnProgram } from '@layerzerolabs/lz-solana-sdk-v2'

import {
  buildLotteryOappExecutorLzReceiveOptions,
  buildLotteryOappInitStoreInstruction,
  buildLotteryOappSetBasePeerInstruction,
  decodeLotteryOappPeerConfig,
  decodeLotteryOappStoreAdmin,
  decodeLotteryOappStoreEndpointProgram,
  decodeLotteryOappStoreOperator,
  decodeUpgradeableProgramDataAddress,
  deriveLotteryOappEndpointRegistrationPdas,
  deriveLotteryOappPdas,
  SOLANA_LOTTERY_BASE_EID,
  SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID,
} from '../../server/_lib/onchain/solanaLotteryOappClient.js'
import { CANONICAL_LOTTERY_MANAGER } from '../../server/_lib/onchain/solanaLotteryLzTransport.js'
import { sendAndConfirmSolanaTransactionOverHttp } from '../../server/_lib/onchain/solanaHttpTransaction.js'
import {
  MAINNET_BASE_SOLANA_DVNS,
  MAINNET_BASE_SOLANA_DVN_THRESHOLD,
  readSolanaLayerZeroDvnPreflight,
} from './preflight-solana-lz-dvns.js'

const MAINNET_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'
const MAINNET_SOLANA_EID = 30_168
const BPF_UPGRADEABLE_LOADER = 'BPFLoaderUpgradeab1e11111111111111111111111'
const STORE_ACCOUNT_BYTES = 105
const ENDPOINT_OAPP_REGISTRY_BYTES = 41
const PEER_ACCOUNT_BYTES = 8 + 32 + 4 + 512 + 1
const SEND_LIBRARY_CONFIG_BYTES = 41
const SEND_CONFIG_ACCOUNT_BYTES = 1_088
const RECEIVE_CONFIG_ACCOUNT_BYTES = 1_052
const NONCE_BYTES = 25
const PENDING_INBOUND_NONCE_BYTES = 13
const NIL_DVN_COUNT = 255
const ACTIONS = new Set(['init-store', 'set-peer', 'set-send-library', 'configure-uln', 'init-nonce'])

type Action = 'init-store' | 'set-peer' | 'set-send-library' | 'configure-uln' | 'init-nonce'
type UlnConfig = {
  confirmations: number | bigint | { toString(): string }
  requiredDvnCount: number
  optionalDvnCount: number
  optionalDvnThreshold: number
  requiredDvns: PublicKey[]
  optionalDvns: PublicKey[]
}

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function enabled(name: string): boolean {
  return ['1', 'true', 'yes'].includes(env(name).toLowerCase())
}

function requireEnv(name: string): string {
  const value = env(name)
  if (!value) throw new Error(`missing_${name.toLowerCase()}`)
  return value
}

function requirePubkey(name: string): PublicKey {
  try {
    return new PublicKey(requireEnv(name))
  } catch {
    throw new Error(`invalid_${name.toLowerCase()}`)
  }
}

function decodeBase58(value: string): Uint8Array | null {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let decoded = 0n
  for (const char of value) {
    const digit = alphabet.indexOf(char)
    if (digit < 0) return null
    decoded = decoded * 58n + BigInt(digit)
  }
  const bytes: number[] = []
  while (decoded > 0n) {
    bytes.push(Number(decoded & 0xffn))
    decoded >>= 8n
  }
  bytes.reverse()
  const leadingZeroes = value.length - value.replace(/^1+/, '').length
  return Uint8Array.from([...new Array<number>(leadingZeroes).fill(0), ...bytes])
}

function readPayer(): Keypair {
  const reference = env('SOLANA_KEYPAIR_PATH') || env('SOLANA_PRIVATE_KEY')
  if (!reference) throw new Error('missing_solana_private_key_or_keypair_path')
  let raw = reference
  if (!reference.startsWith('[') && existsSync(reference)) raw = readFileSync(reference, 'utf8').trim()
  try {
    const bytes = raw.startsWith('[') ? Uint8Array.from(JSON.parse(raw) as number[]) : decodeBase58(raw)
    if (!bytes || bytes.length !== 64) throw new Error('invalid_solana_signer')
    return Keypair.fromSecretKey(bytes)
  } catch {
    throw new Error('invalid_solana_signer')
  }
}

function sol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(9)
}

function actionFromArgs(): Action {
  const action = process.argv.find((value) => value.startsWith('--action='))?.slice('--action='.length)
  if (!action || !ACTIONS.has(action)) throw new Error('mainnet_oapp_action_required')
  return action as Action
}

function receiveGas(): bigint {
  const raw = requireEnv('SOLANA_LOTTERY_OAPP_BASE_RECEIVE_GAS')
  if (!/^\d+$/.test(raw)) throw new Error('invalid_solana_lottery_oapp_base_receive_gas')
  const gas = BigInt(raw)
  if (gas < 200_000n || gas > 2_000_000n) throw new Error('solana_lottery_oapp_base_receive_gas_out_of_range')
  return gas
}

function expectedBasePeer(): `0x${string}` {
  return `0x${CANONICAL_LOTTERY_MANAGER.slice(2).toLowerCase().padStart(64, '0')}` as `0x${string}`
}

function assertFlagsDisabled(): void {
  const flags = [
    'SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED',
    'SOLANA_LOTTERY_OAPP_SEND_ENABLED',
    'SOLANA_LOTTERY_WINNER_SETTLEMENT_ENABLED',
  ]
  for (const flag of flags) {
    if (enabled(flag)) throw new Error(`${flag.toLowerCase()}_must_remain_disabled`)
  }
}

function buildProductionUlnConfig(dvns: readonly PublicKey[]): UlnConfig {
  if (dvns.length !== MAINNET_BASE_SOLANA_DVNS.length) throw new Error('mainnet_dvn_count_mismatch')
  const optionalDvns = [...dvns].sort((left, right) => Buffer.compare(left.toBuffer(), right.toBuffer()))
  if (new Set(optionalDvns.map((dvn) => dvn.toBase58())).size !== optionalDvns.length) throw new Error('mainnet_dvn_duplicate')
  return {
    confirmations: 0,
    requiredDvnCount: NIL_DVN_COUNT,
    optionalDvnCount: optionalDvns.length,
    optionalDvnThreshold: MAINNET_BASE_SOLANA_DVN_THRESHOLD,
    requiredDvns: [],
    optionalDvns,
  }
}

function isExactProductionUlnConfig(config: UlnConfig | undefined, expected: UlnConfig): boolean {
  return config != null &&
    config.confirmations.toString() === expected.confirmations.toString() &&
    config.requiredDvnCount === expected.requiredDvnCount &&
    config.optionalDvnCount === expected.optionalDvnCount &&
    config.optionalDvnThreshold === expected.optionalDvnThreshold &&
    config.requiredDvns.length === 0 &&
    config.optionalDvns.length === expected.optionalDvns.length &&
    config.optionalDvns.every((dvn, index) => dvn.equals(expected.optionalDvns[index]))
}

function json(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item, 2)}\n`)
}

async function quoteTransaction(params: {
  action: Action
  execute: boolean
  connection: Connection
  payer: Keypair
  instructions: TransactionInstruction[]
  rents: Record<string, Promise<number> | number>
  details: Record<string, unknown>
  rollback: string
  postcondition: () => Promise<void>
}): Promise<void> {
  const transaction = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 450_000 }), ...params.instructions)
  transaction.feePayer = params.payer.publicKey
  transaction.recentBlockhash = (await params.connection.getLatestBlockhash('finalized')).blockhash
  transaction.sign(params.payer)
  const [simulation, fee, ...rentValues] = await Promise.all([
    params.connection.simulateTransaction(transaction),
    params.connection.getFeeForMessage(transaction.compileMessage(), 'finalized'),
    ...Object.values(params.rents),
  ])
  if (simulation.value.err) {
    throw new Error(`mainnet_oapp_${params.action}_simulation_failed:${JSON.stringify(simulation.value.err)}:${(simulation.value.logs ?? []).join(' | ')}`)
  }
  const rentEntries = Object.keys(params.rents).map((name, index) => [name, rentValues[index]] as const)
  const transactionFeeLamports = fee.value ?? 0
  const rentLamports = rentEntries.reduce((total, [, value]) => total + value, 0)
  const totalLamports = rentLamports + transactionFeeLamports
  json({
    ok: true,
    mode: params.execute ? 'execute' : 'dry_run',
    route: 'solana-mainnet-to-base-mainnet',
    action: params.action,
    payer: params.payer.publicKey.toBase58(),
    transaction: params.action,
    ...params.details,
    estimated: {
      rentsLamports: Object.fromEntries(rentEntries),
      transactionFeeLamports,
      totalLamports,
      totalSol: sol(totalLamports),
    },
    simulatedUnitsConsumed: simulation.value.unitsConsumed ?? null,
    relayEntriesEnabled: false,
    oappSendingEnabled: false,
    winnerSettlementEnabled: false,
    rollback: params.rollback,
  })
  if (!params.execute) return
  requireEnv('SOLANA_LOTTERY_OAPP_BOOTSTRAP_APPROVAL_REF')
  const signature = await sendAndConfirmSolanaTransactionOverHttp({
    connection: params.connection,
    transaction: new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 450_000 }), ...params.instructions),
    payer: params.payer,
  })
  await params.postcondition()
  json({ executed: true, action: params.action, signature })
}

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write('Usage: pnpm -C frontend ops:bootstrap-solana-lottery-mainnet-oapp -- --action=<init-store|set-peer|set-send-library|configure-uln|init-nonce> [--execute]\n')
    return
  }
  const action = actionFromArgs()
  const execute = process.argv.includes('--execute')
  if (env('SOLANA_LOTTERY_OAPP_ROUTE') && env('SOLANA_LOTTERY_OAPP_ROUTE').toLowerCase() !== 'mainnet') {
    throw new Error('mainnet_oapp_route_required')
  }
  assertFlagsDisabled()
  // `tsx --env-file=.env` can load an operator's development RPC default.
  // Never let that silently win over an explicitly selected mainnet endpoint.
  const rpc = env('SOLANA_MAINNET_RPC_URL') || requireEnv('SOLANA_RPC_URL')
  const connection = new Connection(rpc, 'finalized')
  if (await connection.getGenesisHash() !== MAINNET_GENESIS_HASH) throw new Error('solana_mainnet_genesis_mismatch')
  const programId = requirePubkey('SOLANA_LOTTERY_OAPP_PROGRAM_ID')
  if (programId.toBase58() === SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID) throw new Error('test_oapp_program_forbidden_on_mainnet')
  const admin = requirePubkey('SOLANA_LOTTERY_OAPP_ADMIN_PUBKEY')
  const operator = requirePubkey('SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY')
  const payer = readPayer()
  const { store, peer } = deriveLotteryOappPdas(programId, SOLANA_LOTTERY_BASE_EID)
  const { oappRegistry } = deriveLotteryOappEndpointRegistrationPdas({ store })
  const endpoint = new EndpointProgram.Endpoint(EndpointProgram.PROGRAM_ID)

  const [programInfo, storeInfo, peerInfo, registryInfo] = await connection.getMultipleAccountsInfo(
    [programId, store, peer, oappRegistry],
    'finalized',
  )
  if (!programInfo?.executable || !programInfo.owner.equals(new PublicKey(BPF_UPGRADEABLE_LOADER))) {
    throw new Error('mainnet_oapp_program_not_upgradeable_executable')
  }
  const endpointStoreIsValid = (): void => {
    if (!storeInfo?.owner.equals(programId)) throw new Error('mainnet_oapp_store_missing_or_wrong_owner')
    if (!decodeLotteryOappStoreAdmin(storeInfo.data).equals(admin)) throw new Error('mainnet_oapp_store_admin_mismatch')
    if (!decodeLotteryOappStoreOperator(storeInfo.data).equals(operator)) throw new Error('mainnet_oapp_store_operator_mismatch')
    if (!decodeLotteryOappStoreEndpointProgram(storeInfo.data).equals(EndpointProgram.PROGRAM_ID)) {
      throw new Error('mainnet_oapp_store_endpoint_mismatch')
    }
    if (!registryInfo?.owner.equals(EndpointProgram.PROGRAM_ID) || registryInfo.data.length !== ENDPOINT_OAPP_REGISTRY_BYTES) {
      throw new Error('mainnet_oapp_registry_missing_or_wrong_owner')
    }
    if (!new PublicKey(registryInfo.data.subarray(8, 40)).equals(admin)) throw new Error('mainnet_oapp_registry_delegate_mismatch')
  }

  if (action === 'init-store') {
    const programData = decodeUpgradeableProgramDataAddress(programInfo.data)
    const programDataInfo = await connection.getAccountInfo(programData, 'finalized')
    if (!programDataInfo || programDataInfo.data.length < 45 || programDataInfo.data.readUInt32LE(0) !== 3 || programDataInfo.data[12] !== 1) {
      throw new Error('mainnet_oapp_programdata_malformed_or_immutable')
    }
    const upgradeAuthority = new PublicKey(programDataInfo.data.subarray(13, 45))
    if (!upgradeAuthority.equals(payer.publicKey)) throw new Error('mainnet_oapp_payer_not_upgrade_authority')
    if (storeInfo || registryInfo) {
      endpointStoreIsValid()
      json({ ok: true, mode: execute ? 'execute' : 'dry_run', action: 'init-store-already-configured', transactionSubmitted: false, program: programId.toBase58(), store: store.toBase58(), oappRegistry: oappRegistry.toBase58() })
      return
    }
    const instruction = buildLotteryOappInitStoreInstruction({
      programId,
      programData,
      payer: payer.publicKey,
      upgradeAuthority,
      admin,
      operator,
    })
    await quoteTransaction({
      action,
      execute,
      connection,
      payer,
      instructions: [instruction],
      rents: {
        storeRentLamports: connection.getMinimumBalanceForRentExemption(STORE_ACCOUNT_BYTES),
        endpointRegistryRentLamports: connection.getMinimumBalanceForRentExemption(ENDPOINT_OAPP_REGISTRY_BYTES),
      },
      details: { program: programId.toBase58(), programData: programData.toBase58(), store: store.toBase58(), oappRegistry: oappRegistry.toBase58(), admin: admin.toBase58(), operator: operator.toBase58(), transactionDescription: 'init_store plus LayerZero Endpoint register_oapp CPI' },
      rollback: 'Store and registry remain inert without the fixed Base Peer, source ULN, Base authorization, and a send flag. They have no close path; keep all B2 flags off.',
      postcondition: async () => {
        const [postStore, postRegistry] = await connection.getMultipleAccountsInfo([store, oappRegistry], 'finalized')
        if (!postStore?.owner.equals(programId) || !postRegistry?.owner.equals(EndpointProgram.PROGRAM_ID)) throw new Error('mainnet_oapp_store_postcondition_failed')
      },
    })
    return
  }

  endpointStoreIsValid()
  if (!payer.publicKey.equals(admin)) throw new Error('mainnet_oapp_payer_not_store_admin')

  if (action === 'set-peer') {
    const enforcedOptions = buildLotteryOappExecutorLzReceiveOptions(receiveGas())
    const peerAddress = expectedBasePeer()
    if (peerInfo) {
      if (!peerInfo.owner.equals(programId)) throw new Error('mainnet_oapp_peer_wrong_owner')
      const current = decodeLotteryOappPeerConfig(peerInfo.data)
      if (current.peerAddress.toLowerCase() !== peerAddress.toLowerCase() || !current.enforcedOptions.equals(enforcedOptions)) {
        throw new Error('mainnet_oapp_peer_already_exists_with_different_config')
      }
      json({ ok: true, mode: execute ? 'execute' : 'dry_run', action: 'set-peer-already-configured', transactionSubmitted: false, program: programId.toBase58(), store: store.toBase58(), peer: peer.toBase58(), peerAddress, receiveGas: receiveGas().toString() })
      return
    }
    const instruction = buildLotteryOappSetBasePeerInstruction({ programId, admin, destinationEid: SOLANA_LOTTERY_BASE_EID, peerAddress, enforcedOptions })
    await quoteTransaction({
      action,
      execute,
      connection,
      payer,
      instructions: [instruction],
      rents: { peerRentLamports: connection.getMinimumBalanceForRentExemption(PEER_ACCOUNT_BYTES) },
      details: { program: programId.toBase58(), store: store.toBase58(), peer: peer.toBase58(), destinationEid: SOLANA_LOTTERY_BASE_EID, receiver: CANONICAL_LOTTERY_MANAGER, peerAddress, receiveGas: receiveGas().toString(), enforcedOptions: `0x${enforcedOptions.toString('hex')}`, transactionDescription: 'set_base_peer only' },
      rollback: 'The Peer PDA has no close path. It remains fail-closed until Base peer/authorization, explicit ULN, Endpoint nonce, and disabled relay/send flags are separately satisfied.',
      postcondition: async () => {
        const post = await connection.getAccountInfo(peer, 'finalized')
        if (!post?.owner.equals(programId)) throw new Error('mainnet_oapp_peer_postcondition_missing')
        const configured = decodeLotteryOappPeerConfig(post.data)
        if (configured.peerAddress.toLowerCase() !== peerAddress.toLowerCase() || !configured.enforcedOptions.equals(enforcedOptions)) throw new Error('mainnet_oapp_peer_postcondition_mismatch')
      },
    })
    return
  }

  if (!peerInfo?.owner.equals(programId) || decodeLotteryOappPeerConfig(peerInfo.data).peerAddress.toLowerCase() !== expectedBasePeer().toLowerCase()) {
    throw new Error('mainnet_oapp_fixed_base_peer_required')
  }

  if (action === 'set-send-library') {
    const [defaultSendLibrary] = endpoint.deriver.defaultSendLibraryConfig(SOLANA_LOTTERY_BASE_EID)
    const [sendLibrary] = endpoint.deriver.sendLibraryConfig(store, SOLANA_LOTTERY_BASE_EID)
    const [defaultInfo, customInfo] = await connection.getMultipleAccountsInfo([defaultSendLibrary, sendLibrary], 'finalized')
    if (!defaultInfo?.owner.equals(EndpointProgram.PROGRAM_ID) || defaultInfo.data.length !== SEND_LIBRARY_CONFIG_BYTES) throw new Error('mainnet_oapp_default_send_library_missing')
    if (customInfo) {
      const selected = await endpoint.getSendLibrary(connection, store, SOLANA_LOTTERY_BASE_EID, 'finalized')
      if (!selected.programId.equals(UlnProgram.PROGRAM_ID) || selected.isDefault) throw new Error('mainnet_oapp_send_library_unexpected_existing_config')
      json({ ok: true, mode: execute ? 'execute' : 'dry_run', action: 'set-send-library-already-configured', transactionSubmitted: false, store: store.toBase58(), sendLibraryConfig: sendLibrary.toBase58(), messageLibraryProgram: selected.programId.toBase58(), messageLibrary: selected.msgLib.toBase58() })
      return
    }
    const instructions = [
      endpoint.initSendLibrary(payer.publicKey, store, SOLANA_LOTTERY_BASE_EID),
      endpoint.setSendLibrary(payer.publicKey, store, UlnProgram.PROGRAM_ID, SOLANA_LOTTERY_BASE_EID),
    ]
    await quoteTransaction({
      action,
      execute,
      connection,
      payer,
      instructions,
      rents: { sendLibraryConfigRentLamports: connection.getMinimumBalanceForRentExemption(SEND_LIBRARY_CONFIG_BYTES) },
      details: { store: store.toBase58(), destinationEid: SOLANA_LOTTERY_BASE_EID, defaultSendLibraryConfig: defaultSendLibrary.toBase58(), sendLibraryConfig: sendLibrary.toBase58(), messageLibraryProgram: UlnProgram.PROGRAM_ID.toBase58(), transactionDescription: 'EndpointV2.initSendLibrary plus setSendLibrary(ULN)' },
      rollback: 'A separate approved EndpointV2 library change must select a reviewed blocked library. This action never sends a packet and all entry/send/winner flags remain disabled.',
      postcondition: async () => {
        const selected = await endpoint.getSendLibrary(connection, store, SOLANA_LOTTERY_BASE_EID, 'finalized')
        if (!selected.programId.equals(UlnProgram.PROGRAM_ID) || selected.isDefault) throw new Error('mainnet_oapp_send_library_postcondition_mismatch')
      },
    })
    return
  }

  const selectedLibrary = await endpoint.getSendLibrary(connection, store, SOLANA_LOTTERY_BASE_EID, 'finalized')
  if (!selectedLibrary.programId.equals(UlnProgram.PROGRAM_ID) || selectedLibrary.isDefault) throw new Error('mainnet_oapp_explicit_uln_send_library_required')

  if (action === 'configure-uln') {
    const metadata = await readSolanaLayerZeroDvnPreflight({
      stage: 'mainnet',
      chains: ['base', 'solana'],
      expectedDvns: MAINNET_BASE_SOLANA_DVNS,
      threshold: MAINNET_BASE_SOLANA_DVN_THRESHOLD,
    })
    if (!metadata.ok) throw new Error(`mainnet_oapp_dvn_metadata_unverified:${metadata.error ?? 'unknown'}`)
    const dvns = MAINNET_BASE_SOLANA_DVNS.map((name) => {
      const matches = (metadata.candidates[name] ?? []).filter((candidate) => candidate.chain === 'solana')
      if (matches.length !== 1) throw new Error(`mainnet_oapp_dvn_metadata_ambiguous:${name}`)
      return new PublicKey(matches[0].address)
    })
    const expected = buildProductionUlnConfig(dvns)
    const uln = new UlnProgram.Uln(UlnProgram.PROGRAM_ID)
    const existing = await uln.getSendConfigState(connection, store, SOLANA_LOTTERY_BASE_EID, 'finalized') as { uln?: UlnConfig } | null
    if (existing) {
      if (!isExactProductionUlnConfig(existing.uln, expected)) throw new Error('mainnet_oapp_uln_existing_config_mismatch')
      json({ ok: true, mode: execute ? 'execute' : 'dry_run', action: 'configure-uln-already-configured', transactionSubmitted: false, store: store.toBase58(), destinationEid: SOLANA_LOTTERY_BASE_EID, policy: { names: MAINNET_BASE_SOLANA_DVNS, threshold: MAINNET_BASE_SOLANA_DVN_THRESHOLD, config: expected, metadataUrl: metadata.url } })
      return
    }
    const instructions = [
      endpoint.initOAppConfig(payer.publicKey, uln, payer.publicKey, store, SOLANA_LOTTERY_BASE_EID),
      await endpoint.setOappConfig(connection, payer.publicKey, store, UlnProgram.PROGRAM_ID, SOLANA_LOTTERY_BASE_EID, { configType: SetConfigType.SEND_ULN, value: expected }, 'finalized'),
    ]
    const [sendConfig, receiveConfig] = [uln.deriver.sendConfig(SOLANA_LOTTERY_BASE_EID, store)[0], uln.deriver.receiveConfig(SOLANA_LOTTERY_BASE_EID, store)[0]]
    await quoteTransaction({
      action,
      execute,
      connection,
      payer,
      instructions,
      rents: {
        sendConfigRentLamports: connection.getMinimumBalanceForRentExemption(SEND_CONFIG_ACCOUNT_BYTES),
        receiveConfigRentLamports: connection.getMinimumBalanceForRentExemption(RECEIVE_CONFIG_ACCOUNT_BYTES),
      },
      details: { store: store.toBase58(), destinationEid: SOLANA_LOTTERY_BASE_EID, sendConfig: sendConfig.toBase58(), receiveConfig: receiveConfig.toBase58(), ulnProgram: UlnProgram.PROGRAM_ID.toBase58(), policy: { names: MAINNET_BASE_SOLANA_DVNS, threshold: MAINNET_BASE_SOLANA_DVN_THRESHOLD, config: expected, metadataUrl: metadata.url }, transactionDescription: 'EndpointV2.initOAppConfig plus setConfig(SEND_ULN 3-of-5)' },
      rollback: 'A separate approved reset-to-default must clear only the custom SEND_ULN fields. It does not close the config accounts and it must not enable any relay/send/winner flag.',
      postcondition: async () => {
        const post = await uln.getSendConfigState(connection, store, SOLANA_LOTTERY_BASE_EID, 'finalized') as { uln?: UlnConfig } | null
        if (!post || !isExactProductionUlnConfig(post.uln, expected)) throw new Error('mainnet_oapp_uln_postcondition_mismatch')
      },
    })
    return
  }

  const expectedPeerBytes = Buffer.from(expectedBasePeer().slice(2), 'hex')
  const [nonce, pendingInboundNonce] = [
    endpoint.deriver.nonce(store, SOLANA_LOTTERY_BASE_EID, expectedPeerBytes)[0],
    endpoint.deriver.pendingNonce(store, SOLANA_LOTTERY_BASE_EID, expectedPeerBytes)[0],
  ]
  const [nonceInfo, pendingInfo] = await connection.getMultipleAccountsInfo([nonce, pendingInboundNonce], 'finalized')
  if (nonceInfo || pendingInfo) {
    if (!nonceInfo?.owner.equals(EndpointProgram.PROGRAM_ID) || !pendingInfo?.owner.equals(EndpointProgram.PROGRAM_ID)) {
      throw new Error('mainnet_oapp_nonce_partially_initialized_or_wrong_owner')
    }
    json({ ok: true, mode: execute ? 'execute' : 'dry_run', action: 'init-nonce-already-configured', transactionSubmitted: false, store: store.toBase58(), nonce: nonce.toBase58(), pendingInboundNonce: pendingInboundNonce.toBase58() })
    return
  }
  const instruction = endpoint.initOAppNonce(payer.publicKey, SOLANA_LOTTERY_BASE_EID, store, expectedPeerBytes)
  await quoteTransaction({
    action,
    execute,
    connection,
    payer,
    instructions: [instruction],
    rents: {
      nonceRentLamports: connection.getMinimumBalanceForRentExemption(NONCE_BYTES),
      pendingInboundNonceRentLamports: connection.getMinimumBalanceForRentExemption(PENDING_INBOUND_NONCE_BYTES),
    },
    details: { store: store.toBase58(), destinationEid: SOLANA_LOTTERY_BASE_EID, remotePeer: expectedBasePeer(), nonce: nonce.toBase58(), pendingInboundNonce: pendingInboundNonce.toBase58(), transactionDescription: 'EndpointV2.initOAppNonce for canonical Base LotteryManager peer' },
    rollback: 'Endpoint nonce accounts are durable path state with no close/unset action. Leave all B2 flags disabled unless every separate production gate has passed.',
    postcondition: async () => {
      const [postNonce, postPending] = await connection.getMultipleAccountsInfo([nonce, pendingInboundNonce], 'finalized')
      if (!postNonce?.owner.equals(EndpointProgram.PROGRAM_ID) || !postPending?.owner.equals(EndpointProgram.PROGRAM_ID)) throw new Error('mainnet_oapp_nonce_postcondition_mismatch')
    },
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`mainnet lottery OApp bootstrap failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
