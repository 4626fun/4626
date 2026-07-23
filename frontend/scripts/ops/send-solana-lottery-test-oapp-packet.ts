#!/usr/bin/env tsx
/**
 * Send one explicitly named, value-free Devnet -> Base Sepolia rehearsal
 * packet. This is intentionally independent of the production worker and
 * refuses every production identifier/flag. Default mode signs only a local
 * simulation; `--execute` is required to submit the one Devnet transaction.
 */
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { createPublicClient, encodePacked, formatUnits, getAddress, http, keccak256, parseAbi, type Address, type Hex } from 'viem'
import { baseSepolia } from 'viem/chains'

import {
  buildLotteryEntryFromSolanaOapp,
  deriveLotteryOappStoreBytes32,
  SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID,
  SOLANA_LOTTERY_TEST_RECEIVER,
  sendLotteryEntryFromSolanaOapp,
} from '../../server/_lib/onchain/solanaLotteryOappClient.js'
import { buildSolanaLotteryLzV3Payload, hashSolanaLotterySourceEventId } from '../../server/_lib/onchain/solanaLotteryLzTransport.js'

const TEST_OPERATOR = '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY'
const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
const SOLANA_DEVNET_EID = 40_168
const TEST_BUYER = '0x0000000000000000000000000000000000000001' as const
const TEST_TOKEN = '0x0000000000000000000000000000000000000002' as const

const RECEIVER_ABI = parseAbi([
  'function peers(uint32 eid) view returns (bytes32)',
  'function authorizedRemoteOFTs(uint32 srcEid, bytes32 sender) view returns (bool)',
  'function receivedSourceEvents(bytes32 receiptKey) view returns (bool)',
  'function receivedCount() view returns (uint256)',
  'function duplicateCount() view returns (uint256)',
  'function rejectedCount() view returns (uint256)',
  'function receipts(bytes32 receiptKey) view returns (address buyer, address tokenIn, uint256 amount, uint32 sourceChainId, bytes32 guid)',
])

type TestReceiverClient = Pick<ReturnType<typeof createPublicClient>, 'readContract'>
type TestReceiverReceipt = readonly [Address, Address, bigint, number, Hex]

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function enabled(name: string): boolean {
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

function sourceEventId(): string {
  const value = env('SOLANA_LOTTERY_TEST_SOURCE_EVENT_ID')
  if (!/^solana-devnet-test-route:[a-z0-9][a-z0-9:-]{2,96}$/.test(value)) {
    throw new Error('test_source_event_id_required_or_invalid')
  }
  return value
}

function maximumNativeFee(): bigint {
  const value = env('SOLANA_LOTTERY_TEST_MAX_NATIVE_FEE_LAMPORTS')
  if (!/^[1-9]\d*$/.test(value)) throw new Error('test_max_native_fee_lamports_required_or_invalid')
  return BigInt(value)
}

function receiptKey(storeBytes32: Hex, sourceEventDigest: Hex): Hex {
  return keccak256(encodePacked(['uint32', 'bytes32', 'bytes32'], [SOLANA_DEVNET_EID, storeBytes32, sourceEventDigest]))
}

async function readReceiverState(client: TestReceiverClient, receiver: Address, key: Hex): Promise<{
  received: boolean
  receivedCount: bigint
  duplicateCount: bigint
  rejectedCount: bigint
}> {
  const [received, receivedCount, duplicateCount, rejectedCount] = await Promise.all([
    client.readContract({ address: receiver, abi: RECEIVER_ABI, functionName: 'receivedSourceEvents', args: [key] }),
    client.readContract({ address: receiver, abi: RECEIVER_ABI, functionName: 'receivedCount' }),
    client.readContract({ address: receiver, abi: RECEIVER_ABI, functionName: 'duplicateCount' }),
    client.readContract({ address: receiver, abi: RECEIVER_ABI, functionName: 'rejectedCount' }),
  ])
  return {
    received: received as boolean,
    receivedCount: receivedCount as bigint,
    duplicateCount: duplicateCount as bigint,
    rejectedCount: rejectedCount as bigint,
  }
}

function printableReceiverState(state: Awaited<ReturnType<typeof readReceiverState>>): {
  received: boolean
  receivedCount: string
  duplicateCount: string
  rejectedCount: string
} {
  return {
    received: state.received,
    receivedCount: state.receivedCount.toString(),
    duplicateCount: state.duplicateCount.toString(),
    rejectedCount: state.rejectedCount.toString(),
  }
}

async function assertDelivery(params: {
  client: TestReceiverClient
  receiver: Address
  key: Hex
  before: Awaited<ReturnType<typeof readReceiverState>>
  expectedGuid: Hex
  replay: boolean
  originalGuid: Hex | null
}): Promise<{ receivedCount: bigint; duplicateCount: bigint; rejectedCount: bigint }> {
  const deadline = Date.now() + 240_000
  for (;;) {
    const state = await readReceiverState(params.client, params.receiver, params.key)
    if (!params.replay && state.received) {
      if (state.receivedCount !== params.before.receivedCount + 1n) throw new Error('test_packet_received_count_mismatch')
      if (state.duplicateCount !== params.before.duplicateCount) throw new Error('test_packet_unexpected_duplicate')
      if (state.rejectedCount !== params.before.rejectedCount) throw new Error('test_packet_unexpected_rejection')
      const receipt = await params.client.readContract({
        address: params.receiver,
        abi: RECEIVER_ABI,
        functionName: 'receipts',
        args: [params.key],
      }) as TestReceiverReceipt
      if (
        getAddress(receipt[0]) !== getAddress(TEST_BUYER) ||
        getAddress(receipt[1]) !== getAddress(TEST_TOKEN) ||
        receipt[2] !== 1n ||
        receipt[3] !== 0 ||
        receipt[4].toLowerCase() !== params.expectedGuid.toLowerCase()
      ) throw new Error('test_packet_receipt_readback_mismatch')
      return { receivedCount: state.receivedCount, duplicateCount: state.duplicateCount, rejectedCount: state.rejectedCount }
    }
    if (params.replay && state.duplicateCount === params.before.duplicateCount + 1n) {
      if (!state.received || state.receivedCount !== params.before.receivedCount) throw new Error('test_packet_replay_received_count_mismatch')
      if (state.rejectedCount !== params.before.rejectedCount) throw new Error('test_packet_replay_unexpected_rejection')
      const receipt = await params.client.readContract({
        address: params.receiver,
        abi: RECEIVER_ABI,
        functionName: 'receipts',
        args: [params.key],
      }) as TestReceiverReceipt
      if (!params.originalGuid || receipt[4].toLowerCase() !== params.originalGuid.toLowerCase()) {
        throw new Error('test_packet_replay_overwrote_receipt')
      }
      return { receivedCount: state.receivedCount, duplicateCount: state.duplicateCount, rejectedCount: state.rejectedCount }
    }
    if (Date.now() >= deadline) throw new Error('test_packet_base_sepolia_delivery_timeout')
    await new Promise((resolve) => setTimeout(resolve, 5_000))
  }
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute')
  const replay = process.argv.includes('--allow-duplicate-source-for-replay')
  if (env('SOLANA_LOTTERY_OAPP_ROUTE') !== 'testnet') throw new Error('testnet_route_required')
  if (env('SOLANA_LOTTERY_OAPP_PROGRAM_ID') !== SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID) throw new Error('isolated_test_oapp_program_required')
  if (env('SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY') !== TEST_OPERATOR) throw new Error('isolated_test_oapp_operator_required')
  if (env('SOLANA_LOTTERY_TEST_RECEIVER').toLowerCase() !== SOLANA_LOTTERY_TEST_RECEIVER) throw new Error('isolated_test_receiver_required')
  if (enabled('SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED')) throw new Error('relay_entries_must_remain_disabled')
  if (enabled('SOLANA_LOTTERY_OAPP_SEND_ENABLED')) throw new Error('oapp_sending_must_remain_disabled_for_test_packet')
  if (enabled('SOLANA_LOTTERY_WINNER_SETTLEMENT_ENABLED')) throw new Error('winner_settlement_must_remain_disabled')

  const solanaRpc = env('SOLANA_DEVNET_RPC_URL') || env('SOLANA_RPC_URL')
  const baseSepoliaRpc = env('SOLANA_LOTTERY_TEST_BASE_SEPOLIA_RPC_URL') || env('BASE_SEPOLIA_RPC_URL')
  if (!solanaRpc || !baseSepoliaRpc) throw new Error('test_packet_rpc_missing')
  const payer = readPayer()
  if (payer.publicKey.toBase58() !== TEST_OPERATOR) throw new Error('test_packet_payer_not_operator')
  const connection = new Connection(solanaRpc, 'finalized')
  if (await connection.getGenesisHash() !== DEVNET_GENESIS_HASH) throw new Error('solana_devnet_genesis_mismatch')
  const receiver = getAddress(SOLANA_LOTTERY_TEST_RECEIVER)
  const baseClient = createPublicClient({ chain: baseSepolia, transport: http(baseSepoliaRpc) })
  const programId = new PublicKey(SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID)
  const storeBytes32 = deriveLotteryOappStoreBytes32(programId)
  const [boundPeer, authorized] = await Promise.all([
    baseClient.readContract({ address: receiver, abi: RECEIVER_ABI, functionName: 'peers', args: [SOLANA_DEVNET_EID] }),
    baseClient.readContract({ address: receiver, abi: RECEIVER_ABI, functionName: 'authorizedRemoteOFTs', args: [SOLANA_DEVNET_EID, storeBytes32] }),
  ])
  if (boundPeer.toLowerCase() !== storeBytes32.toLowerCase() || !authorized) throw new Error('test_packet_base_receiver_not_bound_and_authorized')

  const eventId = sourceEventId()
  const sourceEventDigest = hashSolanaLotterySourceEventId(eventId)
  const key = receiptKey(storeBytes32, sourceEventDigest)
  const before = await readReceiverState(baseClient, receiver, key)
  if (before.received && !replay) throw new Error('test_packet_source_event_already_received')
  if (!before.received && replay) throw new Error('test_packet_replay_source_event_not_received')
  const originalGuid = before.received
    ? ((await baseClient.readContract({ address: receiver, abi: RECEIVER_ABI, functionName: 'receipts', args: [key] })) as TestReceiverReceipt)[4]
    : null
  const maxNativeFeeLamports = maximumNativeFee()
  const payload = buildSolanaLotteryLzV3Payload({
    buyer: TEST_BUYER,
    tokenIn: TEST_TOKEN,
    amount: 1n,
    sourceChainId: 0,
    buyerCurrentShareBalance: 0n,
    sourceEventId: sourceEventDigest,
  })
  const request = {
    payload,
    expectedPayloadHash: keccak256(payload),
    expectedPeerBytes32: `0x${SOLANA_LOTTERY_TEST_RECEIVER.slice(2).padStart(64, '0')}` as Hex,
    expectedLotteryManager: SOLANA_LOTTERY_TEST_RECEIVER,
    testRoute: true,
    maxNativeFeeLamports,
  } as const
  const built = await buildLotteryEntryFromSolanaOapp({ connection, programId, payer, request })
  built.transaction.feePayer = payer.publicKey
  built.transaction.recentBlockhash = (await connection.getLatestBlockhash('finalized')).blockhash
  built.transaction.sign(payer)
  const [simulation, transactionFee] = await Promise.all([
    connection.simulateTransaction(built.transaction),
    connection.getFeeForMessage(built.transaction.compileMessage(), 'finalized'),
  ])
  if (simulation.value.err) {
    throw new Error(`test_packet_send_simulation_failed:${JSON.stringify(simulation.value.err)}:${(simulation.value.logs ?? []).join(' | ')}`)
  }
  const transactionFeeLamports = transactionFee.value ?? 0
  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: execute ? 'execute' : 'dry_run',
    route: 'solana-devnet_to_base-sepolia_test_receiver',
    replay,
    sourceEventId: eventId,
    sourceEventDigest,
    receiptKey: key,
    payer: payer.publicKey.toBase58(),
    receiver,
    payloadHash: request.expectedPayloadHash,
    payloadBytes: (payload.length - 2) / 2,
    nativeFeeLamports: built.nativeFee.toString(),
    nativeFeeSol: formatUnits(built.nativeFee, 9),
    maxNativeFeeLamports: maxNativeFeeLamports.toString(),
    estimatedTransactionFeeLamports: transactionFeeLamports,
    estimatedTotalLamports: (built.nativeFee + BigInt(transactionFeeLamports)).toString(),
    estimatedTotalSol: formatUnits(built.nativeFee + BigInt(transactionFeeLamports), 9),
    simulatedUnitsConsumed: simulation.value.unitsConsumed ?? null,
    receiverBefore: printableReceiverState(before),
    rollback: 'No application rollback is needed for this value-free test receipt. The packet is immutable; keep production relay/send/settlement flags at 0 and, if required, the Base Sepolia owner can revoke the isolated Store authorization and clear its peer.',
  }, null, 2)}\n`)
  if (!execute) return

  const sent = await sendLotteryEntryFromSolanaOapp({ connection, programId, payer, request })
  const delivered = await assertDelivery({
    client: baseClient,
    receiver,
    key,
    before,
    expectedGuid: sent.lzGuid,
    replay,
    originalGuid,
  })
  process.stdout.write(`${JSON.stringify({
    executed: true,
    solanaSignature: sent.solanaSignature,
    lzGuid: sent.lzGuid,
    payloadHash: sent.payloadHash,
    receiptKey: key,
    baseReceipt: {
      receivedCount: delivered.receivedCount.toString(),
      duplicateCount: delivered.duplicateCount.toString(),
      rejectedCount: delivered.rejectedCount.toString(),
    },
  }, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`test OApp packet rehearsal failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
