#!/usr/bin/env tsx
/**
 * Initialize the Endpoint nonce path for the isolated Devnet -> Base Sepolia
 * rehearsal Store. It creates Endpoint-owned nonce PDAs only; it cannot send
 * a packet, change a peer/DVN policy, touch Base, or enable a feature flag.
 */
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { EndpointProgram, UlnProgram } from '@layerzerolabs/lz-solana-sdk-v2'

import {
  decodeLotteryOappPeerConfig,
  decodeLotteryOappStoreAdmin,
  decodeLotteryOappStoreEndpointProgram,
  deriveLotteryOappEndpointRegistrationPdas,
  deriveLotteryOappPdas,
  SOLANA_LOTTERY_TEST_BASE_EID,
  SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID,
  SOLANA_LOTTERY_TEST_RECEIVER,
} from '../../server/_lib/onchain/solanaLotteryOappClient.js'
import { sendAndConfirmSolanaTransactionOverHttp } from '../../server/_lib/onchain/solanaHttpTransaction.js'

const TEST_STORE_ADMIN = '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY'
const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
const NONCE_BYTES = 25
const PENDING_INBOUND_NONCE_BYTES = 13

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
  if (env('SOLANA_LOTTERY_TEST_RECEIVER').toLowerCase() !== SOLANA_LOTTERY_TEST_RECEIVER) {
    throw new Error('isolated_test_receiver_required')
  }
  if (isEnabled('SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED')) throw new Error('relay_entries_must_remain_disabled')
  if (isEnabled('SOLANA_LOTTERY_OAPP_SEND_ENABLED')) throw new Error('oapp_sending_must_remain_disabled')
  if (isEnabled('SOLANA_LOTTERY_WINNER_SETTLEMENT_ENABLED')) throw new Error('winner_settlement_must_remain_disabled')

  const rpc = env('SOLANA_DEVNET_RPC_URL') || env('SOLANA_RPC_URL')
  if (!rpc) throw new Error('missing_solana_rpc_url')
  const payer = readPayer()
  if (payer.publicKey.toBase58() !== TEST_STORE_ADMIN) throw new Error('test_oapp_payer_not_store_admin')
  const programId = new PublicKey(SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID)
  const connection = new Connection(rpc, 'finalized')
  if (await connection.getGenesisHash() !== DEVNET_GENESIS_HASH) throw new Error('solana_devnet_genesis_mismatch')

  const { store, peer } = deriveLotteryOappPdas(programId, SOLANA_LOTTERY_TEST_BASE_EID)
  const { oappRegistry } = deriveLotteryOappEndpointRegistrationPdas({ store })
  const endpoint = new EndpointProgram.Endpoint(EndpointProgram.PROGRAM_ID)
  const expectedPeer = Buffer.from(`000000000000000000000000${SOLANA_LOTTERY_TEST_RECEIVER.slice(2)}`, 'hex')
  const [nonce, pendingInboundNonce] = [
    endpoint.deriver.nonce(store, SOLANA_LOTTERY_TEST_BASE_EID, expectedPeer)[0],
    endpoint.deriver.pendingNonce(store, SOLANA_LOTTERY_TEST_BASE_EID, expectedPeer)[0],
  ]
  const [programInfo, storeInfo, peerInfo, registryInfo, nonceInfo, pendingInboundNonceInfo] = await connection.getMultipleAccountsInfo(
    [programId, store, peer, oappRegistry, nonce, pendingInboundNonce],
    'finalized',
  )
  if (!programInfo?.executable) throw new Error('test_oapp_program_not_executable')
  if (!storeInfo?.owner.equals(programId) || !decodeLotteryOappStoreAdmin(storeInfo.data).equals(payer.publicKey)) {
    throw new Error('test_oapp_store_admin_mismatch')
  }
  if (!decodeLotteryOappStoreEndpointProgram(storeInfo.data).equals(EndpointProgram.PROGRAM_ID)) {
    throw new Error('test_oapp_store_endpoint_mismatch')
  }
  const expectedPeerHex = `0x${expectedPeer.toString('hex')}`
  if (!peerInfo?.owner.equals(programId)) throw new Error('test_oapp_peer_mismatch')
  if (decodeLotteryOappPeerConfig(peerInfo.data).peerAddress.toLowerCase() !== expectedPeerHex) {
    throw new Error('test_oapp_peer_mismatch')
  }
  if (!registryInfo?.owner.equals(EndpointProgram.PROGRAM_ID) || registryInfo.data.length !== 41) {
    throw new Error('test_oapp_registry_missing_or_wrong_owner')
  }
  if (!new PublicKey(registryInfo.data.subarray(8, 40)).equals(payer.publicKey)) {
    throw new Error('test_oapp_payer_not_endpoint_delegate')
  }
  const sendLibrary = await endpoint.getSendLibrary(connection, store, SOLANA_LOTTERY_TEST_BASE_EID, 'finalized')
  if (!sendLibrary.programId.equals(UlnProgram.PROGRAM_ID) || sendLibrary.isDefault) {
    throw new Error('test_route_explicit_uln_send_library_required')
  }
  if (nonceInfo || pendingInboundNonceInfo) {
    if (!nonceInfo?.owner.equals(EndpointProgram.PROGRAM_ID) || !pendingInboundNonceInfo?.owner.equals(EndpointProgram.PROGRAM_ID)) {
      throw new Error('test_route_nonce_partially_initialized_or_wrong_owner')
    }
    process.stdout.write(`${JSON.stringify({
      ok: true,
      mode: execute ? 'execute' : 'dry_run',
      action: 'test_route_nonce_already_initialized',
      transactionSubmitted: false,
      store: store.toBase58(),
      nonce: nonce.toBase58(),
      pendingInboundNonce: pendingInboundNonce.toBase58(),
    }, null, 2)}\n`)
    return
  }

  const instruction = endpoint.initOAppNonce(
    payer.publicKey,
    SOLANA_LOTTERY_TEST_BASE_EID,
    store,
    expectedPeer,
  )
  const transaction = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }), instruction)
  transaction.feePayer = payer.publicKey
  transaction.recentBlockhash = (await connection.getLatestBlockhash('finalized')).blockhash
  transaction.sign(payer)
  const [simulation, nonceRent, pendingInboundNonceRent, fee] = await Promise.all([
    connection.simulateTransaction(transaction),
    connection.getMinimumBalanceForRentExemption(NONCE_BYTES),
    connection.getMinimumBalanceForRentExemption(PENDING_INBOUND_NONCE_BYTES),
    connection.getFeeForMessage(transaction.compileMessage(), 'finalized'),
  ])
  if (simulation.value.err) {
    throw new Error(`test_route_nonce_simulation_failed:${JSON.stringify(simulation.value.err)}:${(simulation.value.logs ?? []).join(' | ')}`)
  }
  const transactionFeeLamports = fee.value ?? 0
  const totalLamports = nonceRent + pendingInboundNonceRent + transactionFeeLamports
  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: execute ? 'execute' : 'dry_run',
    action: 'init_test_route_oapp_nonce',
    transaction: 'EndpointV2.initOAppNonce',
    payer: payer.publicKey.toBase58(),
    store: store.toBase58(),
    destinationEid: SOLANA_LOTTERY_TEST_BASE_EID,
    remotePeer: `0x${expectedPeer.toString('hex')}`,
    nonce: nonce.toBase58(),
    pendingInboundNonce: pendingInboundNonce.toBase58(),
    estimated: {
      nonceRentLamports: nonceRent,
      pendingInboundNonceRentLamports: pendingInboundNonceRent,
      transactionFeeLamports,
      totalLamports,
      totalSol: sol(totalLamports),
    },
    simulatedUnitsConsumed: simulation.value.unitsConsumed ?? null,
    rollback: 'Endpoint nonce accounts are durable path state and have no this-script close/unset action. Keep all relay, OApp-send, and winner-settlement flags at 0; the isolated test route remains non-production.',
  }, null, 2)}\n`)
  if (!execute) return

  const signature = await sendAndConfirmSolanaTransactionOverHttp({
    connection,
    transaction: new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }), instruction),
    payer,
  })
  const [nonceAfter, pendingAfter] = await connection.getMultipleAccountsInfo([nonce, pendingInboundNonce], 'finalized')
  if (!nonceAfter?.owner.equals(EndpointProgram.PROGRAM_ID) || !pendingAfter?.owner.equals(EndpointProgram.PROGRAM_ID)) {
    throw new Error(`test_route_nonce_postcondition_mismatch:${signature}`)
  }
  process.stdout.write(`${JSON.stringify({ executed: true, signature, nonce: nonce.toBase58(), pendingInboundNonce: pendingInboundNonce.toBase58() }, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`test OApp nonce initialization failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
