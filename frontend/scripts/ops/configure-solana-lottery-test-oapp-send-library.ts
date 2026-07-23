#!/usr/bin/env tsx
/**
 * Create and select the explicit ULN send-library config for the isolated
 * Devnet → Base Sepolia OApp. It does not quote/send a packet, change a Base
 * receiver, or enable any relay/send/settlement flag.
 */
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { EndpointProgram, UlnProgram } from '@layerzerolabs/lz-solana-sdk-v2'

import {
  decodeLotteryOappStoreAdmin,
  decodeLotteryOappStoreEndpointProgram,
  deriveLotteryOappEndpointRegistrationPdas,
  deriveLotteryOappPdas,
  SOLANA_LOTTERY_TEST_BASE_EID,
  SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID,
} from '../../server/_lib/onchain/solanaLotteryOappClient.js'
import { sendAndConfirmSolanaTransactionOverHttp } from '../../server/_lib/onchain/solanaHttpTransaction.js'

const TEST_STORE_ADMIN = '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY'
const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
const SEND_LIBRARY_CONFIG_BYTES = 41
const BPF_UPGRADEABLE_LOADER = 'BPFLoaderUpgradeab1e11111111111111111111111'

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function isEnabled(name: string): boolean {
  return ['1', 'true', 'yes'].includes(env(name).toLowerCase())
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

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute')
  if (env('SOLANA_LOTTERY_OAPP_ROUTE') !== 'testnet') throw new Error('testnet_route_required')
  if (env('SOLANA_LOTTERY_OAPP_PROGRAM_ID') !== SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID) {
    throw new Error('isolated_test_oapp_program_required')
  }
  if (env('SOLANA_LOTTERY_TEST_STORE_ADMIN') !== TEST_STORE_ADMIN) throw new Error('isolated_test_store_admin_required')
  if (isEnabled('SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED')) throw new Error('relay_entries_must_remain_disabled')
  if (isEnabled('SOLANA_LOTTERY_OAPP_SEND_ENABLED')) throw new Error('oapp_sending_must_remain_disabled')
  if (isEnabled('SOLANA_LOTTERY_WINNER_SETTLEMENT_ENABLED')) throw new Error('winner_settlement_must_remain_disabled')

  // `tsx --env-file=.env` loads production defaults; keep this isolated
  // Devnet-only script pinned to the dedicated Devnet override when present.
  const rpc = env('SOLANA_DEVNET_RPC_URL') || env('SOLANA_RPC_URL')
  if (!rpc) throw new Error('missing_solana_rpc_url')
  const programId = new PublicKey(SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID)
  const payer = readPayer()
  if (payer.publicKey.toBase58() !== TEST_STORE_ADMIN) throw new Error('test_oapp_payer_not_store_admin')
  const connection = new Connection(rpc, 'finalized')
  if (await connection.getGenesisHash() !== DEVNET_GENESIS_HASH) throw new Error('solana_devnet_genesis_mismatch')

  const { store } = deriveLotteryOappPdas(programId, SOLANA_LOTTERY_TEST_BASE_EID)
  const { oappRegistry } = deriveLotteryOappEndpointRegistrationPdas({ store })
  const endpoint = new EndpointProgram.Endpoint(EndpointProgram.PROGRAM_ID)
  const [defaultConfig] = endpoint.deriver.defaultSendLibraryConfig(SOLANA_LOTTERY_TEST_BASE_EID)
  const [sendConfig] = endpoint.deriver.sendLibraryConfig(store, SOLANA_LOTTERY_TEST_BASE_EID)
  const [programAccount, storeAccount, registryAccount, defaultConfigAccount, sendConfigAccount] = await connection.getMultipleAccountsInfo(
    [programId, store, oappRegistry, defaultConfig, sendConfig],
    'finalized',
  )
  if (!programAccount?.executable || !programAccount.owner.equals(new PublicKey(BPF_UPGRADEABLE_LOADER))) {
    throw new Error('test_oapp_program_not_upgradeable_executable')
  }
  if (!storeAccount?.owner.equals(programId) || !decodeLotteryOappStoreAdmin(storeAccount.data).equals(payer.publicKey)) {
    throw new Error('test_oapp_store_admin_mismatch')
  }
  if (!decodeLotteryOappStoreEndpointProgram(storeAccount.data).equals(EndpointProgram.PROGRAM_ID)) {
    throw new Error('test_oapp_store_endpoint_mismatch')
  }
  if (!registryAccount?.owner.equals(EndpointProgram.PROGRAM_ID) || registryAccount.data.length !== 41) {
    throw new Error('test_oapp_registry_missing_or_wrong_owner')
  }
  if (!new PublicKey(registryAccount.data.subarray(8, 40)).equals(payer.publicKey)) {
    throw new Error('test_oapp_payer_not_endpoint_delegate')
  }
  if (!defaultConfigAccount?.owner.equals(EndpointProgram.PROGRAM_ID) || defaultConfigAccount.data.length !== SEND_LIBRARY_CONFIG_BYTES) {
    throw new Error('test_route_default_send_library_missing')
  }

  if (sendConfigAccount) {
    const selected = await endpoint.getSendLibrary(connection, store, SOLANA_LOTTERY_TEST_BASE_EID, 'finalized')
    if (!selected.programId.equals(UlnProgram.PROGRAM_ID) || selected.isDefault) {
      throw new Error('test_route_send_library_unexpected_existing_config')
    }
    process.stdout.write(`${JSON.stringify({
      ok: true,
      mode: execute ? 'execute' : 'dry_run',
      action: 'test_route_explicit_uln_send_library_already_configured',
      transactionSubmitted: false,
      store: store.toBase58(),
      sendLibraryConfig: sendConfig.toBase58(),
      messageLibraryProgram: selected.programId.toBase58(),
      messageLibrary: selected.msgLib.toBase58(),
    }, null, 2)}\n`)
    return
  }

  const instructions = [
    endpoint.initSendLibrary(payer.publicKey, store, SOLANA_LOTTERY_TEST_BASE_EID),
    endpoint.setSendLibrary(payer.publicKey, store, UlnProgram.PROGRAM_ID, SOLANA_LOTTERY_TEST_BASE_EID),
  ]
  const transaction = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }), ...instructions)
  transaction.feePayer = payer.publicKey
  transaction.recentBlockhash = (await connection.getLatestBlockhash('finalized')).blockhash
  transaction.sign(payer)
  const [simulation, rent, fee] = await Promise.all([
    connection.simulateTransaction(transaction),
    connection.getMinimumBalanceForRentExemption(SEND_LIBRARY_CONFIG_BYTES),
    connection.getFeeForMessage(transaction.compileMessage(), 'finalized'),
  ])
  if (simulation.value.err) {
    throw new Error(`test_route_send_library_simulation_failed:${JSON.stringify(simulation.value.err)}:${(simulation.value.logs ?? []).join(' | ')}`)
  }
  const transactionFeeLamports = fee.value ?? 0
  const totalLamports = rent + transactionFeeLamports
  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: execute ? 'execute' : 'dry_run',
    action: 'init_and_set_test_route_explicit_uln_send_library',
    transaction: 'EndpointV2.initSendLibrary + EndpointV2.setSendLibrary(ULN)',
    payer: payer.publicKey.toBase58(),
    store: store.toBase58(),
    destinationEid: SOLANA_LOTTERY_TEST_BASE_EID,
    defaultSendLibraryConfig: defaultConfig.toBase58(),
    sendLibraryConfig: sendConfig.toBase58(),
    messageLibraryProgram: UlnProgram.PROGRAM_ID.toBase58(),
    estimated: {
      sendLibraryConfigRentLamports: rent,
      transactionFeeLamports,
      totalLamports,
      totalSol: sol(totalLamports),
    },
    simulatedUnitsConsumed: simulation.value.unitsConsumed ?? null,
    rollback: 'A separately approved EndpointV2 setSendLibrary change must select a reviewed blocked library before any teardown. This script never sends a packet; all relay, OApp-send, and winner-settlement flags remain 0.',
  }, null, 2)}\n`)
  if (!execute) return

  const signature = await sendAndConfirmSolanaTransactionOverHttp({
    connection,
    transaction: new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }), ...instructions),
    payer,
  })
  // A finalized transaction can still race the endpoint account read on some
  // RPC providers. Poll the read-only postcondition; never re-submit.
  let selected: Awaited<ReturnType<typeof endpoint.getSendLibrary>> | null = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = await endpoint.getSendLibrary(connection, store, SOLANA_LOTTERY_TEST_BASE_EID, 'finalized')
    if (candidate.programId.equals(UlnProgram.PROGRAM_ID) && !candidate.isDefault) {
      selected = candidate
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  if (!selected) throw new Error(`test_route_send_library_postcondition_mismatch:${signature}`)
  process.stdout.write(`${JSON.stringify({
    executed: true,
    signature,
    sendLibraryConfig: sendConfig.toBase58(),
    messageLibraryProgram: selected.programId.toBase58(),
    messageLibrary: selected.msgLib.toBase58(),
  }, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`test OApp send-library configuration failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
