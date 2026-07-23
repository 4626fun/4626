#!/usr/bin/env tsx
/**
 * Configure only the isolated Devnet OApp's source-side ULN send policy.
 *
 * The default action creates the ULN per-OApp config PDAs and sets a verified
 * 2-of-2 custom SEND_ULN policy. It never changes the Base receiver, binds a
 * Base peer, authorizes a remote Store, or sends a LayerZero packet.
 */
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { EndpointProgram, SetConfigType, UlnProgram } from '@layerzerolabs/lz-solana-sdk-v2'

import {
  decodeLotteryOappPeerConfig,
  decodeLotteryOappStoreAdmin,
  decodeLotteryOappStoreEndpointProgram,
  deriveLotteryOappEndpointRegistrationPdas,
  deriveLotteryOappPdas,
} from '../../server/_lib/onchain/solanaLotteryOappClient.js'
import { sendAndConfirmSolanaTransactionOverHttp } from '../../server/_lib/onchain/solanaHttpTransaction.js'
import { readSolanaLayerZeroDvnPreflight } from './preflight-solana-lz-dvns.js'
import { resolveTestnetDvnPolicy } from './preflight-solana-lottery-oapp.js'

const CANONICAL_PRODUCTION_OAPP = '8XdQnMpcRBfNTM8KAQfoz4QVCrYz6BS1LTr7E54ofRtC'
const BASE_SEPOLIA_EID = 40_245
const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
const NIL_DVN_COUNT = 255
const TEST_DVN_NAMES = ['LayerZero Labs', 'P2P'] as const
const TEST_DVN_THRESHOLD = 2
const SEND_CONFIG_ACCOUNT_BYTES = 1_088
const RECEIVE_CONFIG_ACCOUNT_BYTES = 1_052
const BPF_UPGRADEABLE_LOADER = 'BPFLoaderUpgradeab1e11111111111111111111111'

type UlnConfig = {
  // The Solita decoder returns its u64 as a BN-like value, while the builder
  // accepts a number. Compare the canonical decimal representation below.
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

function requiredPubkey(name: string): PublicKey {
  const raw = env(name)
  if (!raw) throw new Error(`missing_${name.toLowerCase()}`)
  try {
    return new PublicKey(raw)
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

function hasExactNames(policy: { expected: readonly string[]; threshold: number }): boolean {
  return policy.threshold === TEST_DVN_THRESHOLD &&
    policy.expected.length === TEST_DVN_NAMES.length &&
    [...policy.expected].sort().join('|') === [...TEST_DVN_NAMES].sort().join('|')
}

/** Builds the one permitted custom source policy for this isolated route. */
export function buildTestRouteSendUlnConfig(dvns: readonly PublicKey[]): UlnConfig {
  if (dvns.length !== TEST_DVN_NAMES.length) throw new Error('test_route_dvn_count_mismatch')
  const sorted = [...dvns].sort((left, right) => Buffer.compare(left.toBuffer(), right.toBuffer()))
  if (new Set(sorted.map((dvn) => dvn.toBase58())).size !== sorted.length) throw new Error('test_route_dvn_duplicate')
  return {
    // Zero means inherit the default confirmation count; nil removes a field.
    confirmations: 0,
    requiredDvnCount: NIL_DVN_COUNT,
    optionalDvnCount: TEST_DVN_NAMES.length,
    optionalDvnThreshold: TEST_DVN_THRESHOLD,
    requiredDvns: [],
    optionalDvns: sorted,
  }
}

export function isExactTestRouteSendUlnConfig(config: UlnConfig | undefined, expected: UlnConfig): boolean {
  return config != null &&
    config.confirmations.toString() === expected.confirmations.toString() &&
    config.requiredDvnCount === expected.requiredDvnCount &&
    config.optionalDvnCount === expected.optionalDvnCount &&
    config.optionalDvnThreshold === expected.optionalDvnThreshold &&
    config.requiredDvns.length === 0 &&
    config.optionalDvns.length === expected.optionalDvns.length &&
    config.optionalDvns.every((dvn, index) => dvn.equals(expected.optionalDvns[index]))
}

function resetToDefaultConfig(): UlnConfig {
  return {
    confirmations: 0,
    requiredDvnCount: 0,
    optionalDvnCount: 0,
    optionalDvnThreshold: 0,
    requiredDvns: [],
    optionalDvns: [],
  }
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute')
  const resetToDefault = process.argv.includes('--reset-to-default')
  if (env('SOLANA_LOTTERY_OAPP_ROUTE') !== 'testnet') throw new Error('testnet_route_required')
  const rpc = env('SOLANA_RPC_URL') || env('SOLANA_DEVNET_RPC_URL')
  if (!rpc) throw new Error('missing_solana_rpc_url')
  const programId = requiredPubkey('SOLANA_LOTTERY_OAPP_PROGRAM_ID')
  if (programId.toBase58() === CANONICAL_PRODUCTION_OAPP) throw new Error('canonical_production_oapp_refused')
  const admin = requiredPubkey('SOLANA_LOTTERY_TEST_STORE_ADMIN')
  const payer = readPayer()
  if (!payer.publicKey.equals(admin)) throw new Error('test_oapp_payer_not_store_admin')
  const connection = new Connection(rpc, 'finalized')
  if (await connection.getGenesisHash() !== DEVNET_GENESIS_HASH) throw new Error('solana_devnet_genesis_mismatch')

  const programAccount = await connection.getAccountInfo(programId, 'finalized')
  if (!programAccount?.executable || !programAccount.owner.equals(new PublicKey(BPF_UPGRADEABLE_LOADER))) {
    throw new Error('test_oapp_program_not_upgradeable_executable')
  }
  const { store, peer } = deriveLotteryOappPdas(programId, BASE_SEPOLIA_EID)
  const { oappRegistry } = deriveLotteryOappEndpointRegistrationPdas({ store })
  const [storeAccount, peerAccount, registryAccount] = await connection.getMultipleAccountsInfo([store, peer, oappRegistry], 'finalized')
  if (!storeAccount?.owner.equals(programId)) throw new Error('test_oapp_store_missing_or_wrong_owner')
  if (!decodeLotteryOappStoreAdmin(storeAccount.data).equals(admin)) throw new Error('test_oapp_store_admin_mismatch')
  if (!decodeLotteryOappStoreEndpointProgram(storeAccount.data).equals(EndpointProgram.PROGRAM_ID)) {
    throw new Error('test_oapp_store_endpoint_mismatch')
  }
  if (!peerAccount?.owner.equals(programId)) throw new Error('test_oapp_peer_missing_or_wrong_owner')
  if (decodeLotteryOappPeerConfig(peerAccount.data).peerAddress === `0x${'00'.repeat(32)}`) {
    throw new Error('test_oapp_peer_zero')
  }
  if (!registryAccount?.owner.equals(EndpointProgram.PROGRAM_ID) || registryAccount.data.length !== 41) {
    throw new Error('test_oapp_registry_missing_or_wrong_owner')
  }
  const registryDelegate = new PublicKey(registryAccount.data.subarray(8, 40))
  if (!registryDelegate.equals(payer.publicKey)) throw new Error('test_oapp_payer_not_endpoint_delegate')

  const policy = resolveTestnetDvnPolicy(process.env)
  if (!hasExactNames(policy)) throw new Error('test_route_dvn_policy_not_canonical_2of2')
  const metadata = await readSolanaLayerZeroDvnPreflight({
    stage: 'testnet',
    chains: ['base-sepolia', 'solana-testnet'],
    expectedDvns: TEST_DVN_NAMES,
    threshold: TEST_DVN_THRESHOLD,
  })
  if (!metadata.ok) throw new Error(`test_route_dvn_metadata_unverified:${metadata.error ?? 'unknown'}`)
  const dvns = TEST_DVN_NAMES.map((name) => {
    const matches = (metadata.candidates[name] ?? []).filter((candidate) => candidate.chain === 'solana-testnet')
    if (matches.length !== 1) throw new Error(`test_route_dvn_metadata_ambiguous:${name}`)
    try {
      return new PublicKey(matches[0].address)
    } catch {
      throw new Error(`test_route_dvn_metadata_invalid_pubkey:${name}`)
    }
  })
  const expectedConfig = buildTestRouteSendUlnConfig(dvns)
  const uln = new UlnProgram.Uln(UlnProgram.PROGRAM_ID)
  const customSendConfig = await uln.getSendConfigState(connection, store, BASE_SEPOLIA_EID, 'finalized') as { uln?: UlnConfig } | null
  if (!resetToDefault && customSendConfig) {
    if (!isExactTestRouteSendUlnConfig(customSendConfig.uln, expectedConfig)) {
      throw new Error('test_route_uln_custom_config_already_exists')
    }
    process.stdout.write(`${JSON.stringify({
      ok: true,
      mode: execute ? 'execute' : 'dry_run',
      action: 'source_send_uln_2of2_already_configured',
      transactionSubmitted: false,
      store: store.toBase58(),
      sendConfig: uln.deriver.sendConfig(BASE_SEPOLIA_EID, store)[0].toBase58(),
      rollback: 'A separate approved --reset-to-default transaction restores the Devnet default policy. It does not close the custom config accounts; Base receiver peer/authorization and all send flags remain unchanged.',
    }, null, 2)}\n`)
    return
  }
  if (resetToDefault && !customSendConfig) throw new Error('test_route_uln_custom_config_missing')

  const endpoint = new EndpointProgram.Endpoint(EndpointProgram.PROGRAM_ID)
  const instructions = []
  if (!resetToDefault) {
    instructions.push(endpoint.initOAppConfig(payer.publicKey, uln, payer.publicKey, store, BASE_SEPOLIA_EID))
  }
  instructions.push(await endpoint.setOappConfig(
    connection,
    payer.publicKey,
    store,
    UlnProgram.PROGRAM_ID,
    BASE_SEPOLIA_EID,
    { configType: SetConfigType.SEND_ULN, value: resetToDefault ? resetToDefaultConfig() : expectedConfig },
    'finalized',
  ))
  const transaction = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ...instructions)
  transaction.feePayer = payer.publicKey
  transaction.recentBlockhash = (await connection.getLatestBlockhash('finalized')).blockhash
  transaction.sign(payer)
  const [simulation, sendRent, receiveRent, fee] = await Promise.all([
    connection.simulateTransaction(transaction),
    resetToDefault ? Promise.resolve(0) : connection.getMinimumBalanceForRentExemption(SEND_CONFIG_ACCOUNT_BYTES),
    resetToDefault ? Promise.resolve(0) : connection.getMinimumBalanceForRentExemption(RECEIVE_CONFIG_ACCOUNT_BYTES),
    connection.getFeeForMessage(transaction.compileMessage(), 'finalized'),
  ])
  if (simulation.value.err) {
    throw new Error(`test_route_uln_simulation_failed:${JSON.stringify(simulation.value.err)}:${(simulation.value.logs ?? []).join(' | ')}`)
  }
  const feeLamports = fee.value ?? 0
  const totalLamports = sendRent + receiveRent + feeLamports
  const [sendConfig, receiveConfig] = [uln.deriver.sendConfig(BASE_SEPOLIA_EID, store)[0], uln.deriver.receiveConfig(BASE_SEPOLIA_EID, store)[0]]
  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: execute ? 'execute' : 'dry_run',
    action: resetToDefault ? 'reset_source_uln_to_default' : 'init_config_and_set_source_send_uln_2of2',
    route: 'solana-devnet-to-base-sepolia-test-only',
    payer: payer.publicKey.toBase58(),
    store: store.toBase58(),
    oappRegistry: oappRegistry.toBase58(),
    sendConfig: sendConfig.toBase58(),
    receiveConfig: receiveConfig.toBase58(),
    ulnProgram: UlnProgram.PROGRAM_ID.toBase58(),
    policy: resetToDefault ? resetToDefaultConfig() : {
      names: TEST_DVN_NAMES,
      threshold: TEST_DVN_THRESHOLD,
      config: expectedConfig,
      metadataUrl: metadata.url,
    },
    estimated: {
      sendConfigRentLamports: sendRent,
      receiveConfigRentLamports: receiveRent,
      transactionFeeLamports: feeLamports,
      totalLamports,
      totalSol: sol(totalLamports),
    },
    simulatedUnitsConsumed: simulation.value.unitsConsumed ?? null,
    rollback: 'A separate approved --reset-to-default transaction sets only the custom SEND_ULN fields to zero, restoring the Devnet default policy. It does not close the two ULN config accounts; Base receiver peer/authorization and all send flags remain unchanged.',
  }, null, 2)}\n`)
  if (!execute) return

  const signature = await sendAndConfirmSolanaTransactionOverHttp({ connection, transaction: new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ...instructions), payer })
  const post = await uln.getSendConfigState(connection, store, BASE_SEPOLIA_EID, 'finalized') as { uln?: UlnConfig } | null
  const expectedPost = resetToDefault ? resetToDefaultConfig() : expectedConfig
  if (!post || !isExactTestRouteSendUlnConfig(post.uln, expectedPost)) throw new Error('test_route_uln_postcondition_mismatch')
  process.stdout.write(`${JSON.stringify({ executed: true, signature, sendConfig: sendConfig.toBase58(), receiveConfig: receiveConfig.toBase58() }, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`test OApp ULN configuration failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
