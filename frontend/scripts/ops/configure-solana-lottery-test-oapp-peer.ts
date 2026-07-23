#!/usr/bin/env tsx
/**
 * Configure exactly one isolated Devnet OApp Peer PDA after a direct approval.
 * This creates/configures only the source-side Peer PDA. It never changes ULN
 * configuration, the Base Sepolia receiver, or sends a LayerZero packet.
 */
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { getAddress, type Address, type Hex } from 'viem'

import {
  buildLotteryOappExecutorLzReceiveOptions,
  buildLotteryOappSetBasePeerInstruction,
  decodeLotteryOappPeerConfig,
  decodeLotteryOappStoreAdmin,
  decodeLotteryOappStoreEndpointProgram,
  deriveLotteryOappPdas,
} from '../../server/_lib/onchain/solanaLotteryOappClient.js'
import { sendAndConfirmSolanaTransactionOverHttp } from '../../server/_lib/onchain/solanaHttpTransaction.js'

const CANONICAL_PRODUCTION_OAPP = '8XdQnMpcRBfNTM8KAQfoz4QVCrYz6BS1LTr7E54ofRtC'
const BASE_SEPOLIA_EID = 40_245
const PEER_ACCOUNT_BYTES = 8 + 32 + 4 + 512 + 1
const BPF_UPGRADEABLE_LOADER = 'BPFLoaderUpgradeab1e11111111111111111111111'
const DEFAULT_RECEIVE_GAS = 200_000n

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

function requiredAddress(name: string): Address {
  const raw = env(name)
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) throw new Error(`invalid_${name.toLowerCase()}`)
  return getAddress(raw)
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

function receiveGas(): bigint {
  const raw = env('SOLANA_LOTTERY_TEST_RECEIVE_GAS')
  if (!raw) return DEFAULT_RECEIVE_GAS
  if (!/^\d+$/.test(raw)) throw new Error('invalid_solana_lottery_test_receive_gas')
  const gas = BigInt(raw)
  if (gas < 100_000n || gas > 500_000n) throw new Error('solana_lottery_test_receive_gas_out_of_range')
  return gas
}

function sol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(9)
}

function paddedPeer(receiver: Address): Hex {
  return `0x${receiver.slice(2).toLowerCase().padStart(64, '0')}` as Hex
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute')
  if (env('SOLANA_LOTTERY_OAPP_ROUTE') !== 'testnet') throw new Error('testnet_route_required')
  const rpc = env('SOLANA_RPC_URL') || env('SOLANA_DEVNET_RPC_URL')
  if (!rpc) throw new Error('missing_solana_rpc_url')

  const programId = requiredPubkey('SOLANA_LOTTERY_OAPP_PROGRAM_ID')
  if (programId.toBase58() === CANONICAL_PRODUCTION_OAPP) throw new Error('canonical_production_oapp_refused')
  const admin = requiredPubkey('SOLANA_LOTTERY_TEST_STORE_ADMIN')
  const receiver = requiredAddress('SOLANA_LOTTERY_TEST_RECEIVER')
  const peerAddress = paddedPeer(receiver)
  const enforcedOptions = buildLotteryOappExecutorLzReceiveOptions(receiveGas())
  const payer = readPayer()
  if (!payer.publicKey.equals(admin)) throw new Error('test_oapp_payer_not_store_admin')
  const connection = new Connection(rpc, 'finalized')

  const programAccount = await connection.getAccountInfo(programId, 'finalized')
  if (!programAccount?.executable || !programAccount.owner.equals(new PublicKey(BPF_UPGRADEABLE_LOADER))) {
    throw new Error('test_oapp_program_not_upgradeable_executable')
  }

  const { store, peer } = deriveLotteryOappPdas(programId, BASE_SEPOLIA_EID)
  const [storeAccount, peerAccount] = await connection.getMultipleAccountsInfo([store, peer], 'finalized')
  if (!storeAccount?.owner.equals(programId)) throw new Error('test_oapp_store_missing_or_wrong_owner')
  const storeAdmin = decodeLotteryOappStoreAdmin(storeAccount.data)
  const endpointProgram = decodeLotteryOappStoreEndpointProgram(storeAccount.data)
  if (!storeAdmin.equals(admin)) throw new Error('test_oapp_store_admin_mismatch')
  if (!endpointProgram.equals(new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6'))) {
    throw new Error('test_oapp_store_endpoint_mismatch')
  }
  if (peerAccount) {
    if (!peerAccount.owner.equals(programId)) throw new Error('test_oapp_peer_wrong_owner')
    const existing = decodeLotteryOappPeerConfig(peerAccount.data)
    const samePeer = existing.peerAddress.toLowerCase() === peerAddress.toLowerCase()
    const sameOptions = existing.enforcedOptions.equals(enforcedOptions)
    throw new Error(samePeer && sameOptions ? 'test_oapp_peer_already_configured' : 'test_oapp_peer_already_exists_with_different_config')
  }

  const instruction = buildLotteryOappSetBasePeerInstruction({
    programId,
    admin,
    destinationEid: BASE_SEPOLIA_EID,
    peerAddress,
    enforcedOptions,
  })
  const transaction = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }), instruction)
  transaction.feePayer = payer.publicKey
  transaction.recentBlockhash = (await connection.getLatestBlockhash('finalized')).blockhash
  transaction.sign(payer)
  const [simulation, peerRent, fee] = await Promise.all([
    connection.simulateTransaction(transaction),
    connection.getMinimumBalanceForRentExemption(PEER_ACCOUNT_BYTES),
    connection.getFeeForMessage(transaction.compileMessage(), 'finalized'),
  ])
  if (simulation.value.err) {
    throw new Error(
      `test_oapp_peer_simulation_failed:${JSON.stringify(simulation.value.err)}:${(simulation.value.logs ?? []).join(' | ')}`,
    )
  }
  const feeLamports = fee.value ?? 0
  const totalLamports = peerRent + feeLamports
  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: execute ? 'execute' : 'dry_run',
    route: 'solana-devnet-to-base-sepolia-test-only',
    transaction: 'set_base_peer only',
    payer: payer.publicKey.toBase58(),
    admin: admin.toBase58(),
    program: programId.toBase58(),
    store: store.toBase58(),
    peer: peer.toBase58(),
    destinationEid: BASE_SEPOLIA_EID,
    receiver,
    peerAddress,
    enforcedOptions: `0x${enforcedOptions.toString('hex')}`,
    receiveGas: receiveGas().toString(),
    estimated: {
      peerRentLamports: peerRent,
      transactionFeeLamports: feeLamports,
      totalLamports,
      totalSol: sol(totalLamports),
    },
    simulatedUnitsConsumed: simulation.value.unitsConsumed ?? null,
    rollback: 'The test Peer PDA has no close/unset instruction. Keep all send flags at 0 and leave the Base Sepolia receiver peer/authorization unset; a later separate approved program upgrade would be required to remove the account itself.',
  }, null, 2)}\n`)
  if (!execute) return

  const signature = await sendAndConfirmSolanaTransactionOverHttp({
    connection,
    transaction: new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }), instruction),
    payer,
  })
  const peerAfter = await connection.getAccountInfo(peer, 'finalized')
  if (!peerAfter?.owner.equals(programId)) throw new Error('test_oapp_peer_postcondition_missing')
  const configured = decodeLotteryOappPeerConfig(peerAfter.data)
  if (configured.peerAddress.toLowerCase() !== peerAddress.toLowerCase() || !configured.enforcedOptions.equals(enforcedOptions)) {
    throw new Error('test_oapp_peer_postcondition_mismatch')
  }
  process.stdout.write(`${JSON.stringify({ executed: true, signature, peer: peer.toBase58() }, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`test OApp Peer configuration failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
