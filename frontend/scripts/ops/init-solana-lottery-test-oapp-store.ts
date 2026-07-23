#!/usr/bin/env tsx
/**
 * Initialize the isolated Devnet lottery OApp Store only after a direct,
 * per-transaction approval. It never sets a peer, DVN configuration, Base
 * receiver authorization, or sends a LayerZero packet.
 */
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'

import {
  buildLotteryOappInitStoreInstruction,
  decodeUpgradeableProgramDataAddress,
  deriveLotteryOappEndpointRegistrationPdas,
  deriveLotteryOappPdas,
} from '../../server/_lib/onchain/solanaLotteryOappClient.js'
import { sendAndConfirmSolanaTransactionOverHttp } from '../../server/_lib/onchain/solanaHttpTransaction.js'

const CANONICAL_PRODUCTION_OAPP = '8XdQnMpcRBfNTM8KAQfoz4QVCrYz6BS1LTr7E54ofRtC'
const STORE_ACCOUNT_BYTES = 105
const ENDPOINT_OAPP_REGISTRY_BYTES = 41
const BPF_UPGRADEABLE_LOADER = 'BPFLoaderUpgradeab1e11111111111111111111111'

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
    const bytes = raw.startsWith('[')
      ? Uint8Array.from(JSON.parse(raw) as number[])
      : decodeBase58(raw)
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
  const rpc = env('SOLANA_RPC_URL') || env('SOLANA_DEVNET_RPC_URL')
  if (!rpc) throw new Error('missing_solana_rpc_url')

  const programId = requiredPubkey('SOLANA_LOTTERY_OAPP_PROGRAM_ID')
  if (programId.toBase58() === CANONICAL_PRODUCTION_OAPP) throw new Error('canonical_production_oapp_refused')
  const admin = requiredPubkey('SOLANA_LOTTERY_TEST_STORE_ADMIN')
  const operator = requiredPubkey('SOLANA_LOTTERY_TEST_STORE_OPERATOR')
  const payer = readPayer()
  const connection = new Connection(rpc, 'finalized')

  const programAccount = await connection.getAccountInfo(programId, 'finalized')
  if (!programAccount?.executable || !programAccount.owner.equals(new PublicKey(BPF_UPGRADEABLE_LOADER))) {
    throw new Error('test_oapp_program_not_upgradeable_executable')
  }
  const programData = decodeUpgradeableProgramDataAddress(programAccount.data)
  const programDataAccount = await connection.getAccountInfo(programData, 'finalized')
  if (!programDataAccount || programDataAccount.data.length < 45 || programDataAccount.data.readUInt32LE(0) !== 3) {
    throw new Error('test_oapp_programdata_malformed')
  }
  if (programDataAccount.data[12] !== 1) throw new Error('test_oapp_upgrade_authority_missing')
  const upgradeAuthority = new PublicKey(programDataAccount.data.subarray(13, 45))
  if (!upgradeAuthority.equals(payer.publicKey)) throw new Error('test_oapp_payer_not_upgrade_authority')

  const { store } = deriveLotteryOappPdas(programId)
  const { oappRegistry, eventAuthority } = deriveLotteryOappEndpointRegistrationPdas({ store })
  const [storeAccount, registryAccount] = await connection.getMultipleAccountsInfo([store, oappRegistry], 'finalized')
  if (storeAccount) throw new Error('test_oapp_store_already_exists')
  if (registryAccount) throw new Error('test_oapp_registry_already_exists')

  const instruction = buildLotteryOappInitStoreInstruction({
    programId,
    programData,
    payer: payer.publicKey,
    upgradeAuthority,
    admin,
    operator,
  })
  const transaction = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), instruction)
  transaction.feePayer = payer.publicKey
  transaction.recentBlockhash = (await connection.getLatestBlockhash('finalized')).blockhash
  transaction.sign(payer)
  const [simulation, storeRent, registryRent, fee] = await Promise.all([
    connection.simulateTransaction(transaction),
    connection.getMinimumBalanceForRentExemption(STORE_ACCOUNT_BYTES),
    connection.getMinimumBalanceForRentExemption(ENDPOINT_OAPP_REGISTRY_BYTES),
    connection.getFeeForMessage(transaction.compileMessage(), 'finalized'),
  ])
  if (simulation.value.err) {
    throw new Error(
      `test_oapp_store_simulation_failed:${JSON.stringify(simulation.value.err)}:${(simulation.value.logs ?? []).join(' | ')}`,
    )
  }
  const feeLamports = fee.value ?? 0
  const estimatedLamports = storeRent + registryRent + feeLamports
  const plan = {
    ok: true,
    mode: execute ? 'execute' : 'dry_run',
    route: 'solana-devnet-to-base-sepolia-test-only',
    transaction: 'init_store plus LayerZero register_oapp CPI',
    payer: payer.publicKey.toBase58(),
    upgradeAuthority: upgradeAuthority.toBase58(),
    admin: admin.toBase58(),
    operator: operator.toBase58(),
    program: programId.toBase58(),
    programData: programData.toBase58(),
    store: store.toBase58(),
    oappRegistry: oappRegistry.toBase58(),
    eventAuthority: eventAuthority.toBase58(),
    estimated: {
      storeRentLamports: storeRent,
      registryRentLamports: registryRent,
      transactionFeeLamports: feeLamports,
      totalLamports: estimatedLamports,
      totalSol: sol(estimatedLamports),
    },
    simulatedUnitsConsumed: simulation.value.unitsConsumed ?? null,
    rollback: 'Store and Endpoint registry remain inert without a Peer; do not configure a Peer, custom DVNs, receiver authorization, or a send without separate approval.',
  }
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)
  if (!execute) return

  const signature = await sendAndConfirmSolanaTransactionOverHttp({ connection, transaction: new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), instruction), payer })
  const [storeAfter, registryAfter] = await connection.getMultipleAccountsInfo([store, oappRegistry], 'finalized')
  if (!storeAfter?.owner.equals(programId) || !registryAfter) throw new Error('test_oapp_store_postcondition_failed')
  process.stdout.write(`${JSON.stringify({ executed: true, signature, store: store.toBase58(), oappRegistry: oappRegistry.toBase58() }, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`test OApp Store initialization failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
