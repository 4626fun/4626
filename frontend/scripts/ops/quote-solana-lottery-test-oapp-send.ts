#!/usr/bin/env tsx
/**
 * Read-only LayerZero quote for the isolated Solana Devnet → Base Sepolia
 * lottery-receiver rehearsal. It cannot load a keypair, sign, enable a flag,
 * or submit a packet.
 */
import { pathToFileURL } from 'node:url'

import { Connection, PublicKey } from '@solana/web3.js'
import { formatUnits, keccak256, type Hex } from 'viem'

import {
  SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID,
  SOLANA_LOTTERY_TEST_RECEIVER,
  quoteLotteryEntryFromSolanaOapp,
} from '../../server/_lib/onchain/solanaLotteryOappClient.js'
import {
  buildSolanaLotteryLzV3Payload,
  hashSolanaLotterySourceEventId,
} from '../../server/_lib/onchain/solanaLotteryLzTransport.js'

const TEST_OPERATOR = '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY'
const ZERO_PADDED_TEST_RECEIVER = `0x${SOLANA_LOTTERY_TEST_RECEIVER.slice(2).padStart(64, '0')}` as Hex
const QUOTE_SOURCE_EVENT_ID = 'solana-devnet-test-route:quote-v1'
const QUOTE_BUYER = '0x0000000000000000000000000000000000000001' as const
const QUOTE_TOKEN = '0x0000000000000000000000000000000000000002' as const

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function enabled(name: string): boolean {
  return ['1', 'true', 'yes'].includes(env(name).toLowerCase())
}

async function main(): Promise<void> {
  if (env('SOLANA_LOTTERY_OAPP_ROUTE') !== 'testnet') throw new Error('testnet_route_required')
  if (env('SOLANA_LOTTERY_OAPP_PROGRAM_ID') !== SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID) {
    throw new Error('isolated_test_oapp_program_required')
  }
  if (env('SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY') !== TEST_OPERATOR) throw new Error('isolated_test_oapp_operator_required')
  if (enabled('SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED')) throw new Error('relay_entries_must_remain_disabled')
  if (enabled('SOLANA_LOTTERY_OAPP_SEND_ENABLED')) throw new Error('oapp_sending_must_remain_disabled_for_quote')
  if (enabled('SOLANA_LOTTERY_WINNER_SETTLEMENT_ENABLED')) throw new Error('winner_settlement_must_remain_disabled')

  // `tsx --env-file=.env` loads the operator's production defaults too. The
  // dedicated Devnet variable must win so this test-only command cannot
  // accidentally read from a mainnet RPC.
  const rpc = env('SOLANA_DEVNET_RPC_URL') || env('SOLANA_RPC_URL')
  if (!rpc) throw new Error('solana_devnet_rpc_required')
  const programId = new PublicKey(SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID)
  const payer = new PublicKey(TEST_OPERATOR)
  const sourceEventDigest = hashSolanaLotterySourceEventId(QUOTE_SOURCE_EVENT_ID)
  const payload = buildSolanaLotteryLzV3Payload({
    buyer: QUOTE_BUYER,
    tokenIn: QUOTE_TOKEN,
    amount: 1n,
    sourceChainId: 0,
    buyerCurrentShareBalance: 0n,
    sourceEventId: sourceEventDigest,
  })
  const quote = await quoteLotteryEntryFromSolanaOapp({
    connection: new Connection(rpc, 'finalized'),
    programId,
    payer,
    request: {
      payload,
      expectedPayloadHash: keccak256(payload),
      expectedPeerBytes32: ZERO_PADDED_TEST_RECEIVER,
      expectedLotteryManager: SOLANA_LOTTERY_TEST_RECEIVER,
      testRoute: true,
    },
  })

  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: 'read_only_quote',
    route: 'solana-devnet_to_base-sepolia_test_receiver',
    program: programId.toBase58(),
    operator: payer.toBase58(),
    receiver: SOLANA_LOTTERY_TEST_RECEIVER,
    destinationEid: quote.destinationEid,
    store: quote.store.toBase58(),
    peer: quote.peer.toBase58(),
    sourceEventId: QUOTE_SOURCE_EVENT_ID,
    sourceEventDigest,
    payloadHash: quote.payloadHash,
    payloadBytes: (payload.length - 2) / 2,
    nativeFeeLamports: quote.nativeFee.toString(),
    nativeFeeSol: formatUnits(quote.nativeFee, 9),
    sendAndSettlementFlags: {
      relayEntriesEnabled: false,
      oappSendingEnabled: false,
      winnerSettlementEnabled: false,
    },
    nextMutation: 'A separate approval must name the exact source-event payload, payer, quoted native fee, and rollback. This quote neither signs nor sends.',
  }, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`Solana Devnet test-route OApp quote failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
