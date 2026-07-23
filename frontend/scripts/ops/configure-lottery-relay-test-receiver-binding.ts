#!/usr/bin/env tsx
/**
 * Bind and authorize the isolated Base Sepolia test receiver only after the
 * source and destination ULN gates pass. This script never sends a packet,
 * changes any Solana account, or enables a relay/settlement flag.
 */
import { pathToFileURL } from 'node:url'

import { PublicKey } from '@solana/web3.js'
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  getAddress,
  http,
  parseAbi,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

import { deriveLotteryOappStoreBytes32 } from '../../server/_lib/onchain/solanaLotteryOappClient.js'

const BASE_SEPOLIA_CHAIN_ID = 84_532
const SOLANA_DEVNET_EID = 40_168
const TEST_OAPP_PROGRAM = 'AfLeqn4UzPVeedCTijMcdx7Skb6fbyuYpBEzqGMQUveG'
const DEFAULT_TEST_RECEIVER = getAddress('0x46F77a5E204DbD9A31870E819e671914B40477a3')
const TEST_RECEIVER_OWNER = getAddress('0xB05Cf01231cF2fF99499682E64D3780d57c80FdD')
const BASE_SEPOLIA_ENDPOINT = getAddress('0x6EDCE65403992e310A62460808c4b910D972f10f')
const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex
const PUBLIC_BASE_SEPOLIA_RPC = 'https://sepolia.base.org'

const RECEIVER_ABI = parseAbi([
  'function owner() view returns (address)',
  'function endpoint() view returns (address)',
  'function peers(uint32 eid) view returns (bytes32)',
  'function authorizedRemoteOFTs(uint32 srcEid, bytes32 sender) view returns (bool)',
  'function setPeer(uint32 eid, bytes32 peer)',
  'function setAuthorizedRemoteOFT(uint32 srcEid, bytes32 sender, bool authorized)',
])

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

/** Prefer `--receiver=0x…`, then `LOTTERY_RELAY_TEST_RECEIVER`, else default. */
function resolveTestReceiver() {
  const fromArg = process.argv.find((a) => a.startsWith('--receiver='))?.slice('--receiver='.length)?.trim()
  const raw = (fromArg || env('LOTTERY_RELAY_TEST_RECEIVER')).trim()
  return raw ? getAddress(raw) : DEFAULT_TEST_RECEIVER
}

function isEnabled(name: string): boolean {
  return ['1', 'true', 'yes'].includes(env(name).toLowerCase())
}

function normalizePrivateKey(raw: string): Hex {
  const value = raw.startsWith('0x') ? raw : `0x${raw}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('base_sepolia_owner_private_key_invalid')
  return value as Hex
}

function readOwnerAccount() {
  const raw = env('BASE_SEPOLIA_TEST_RECEIVER_OWNER_PRIVATE_KEY') || env('PRIVATE_KEY')
  if (!raw) throw new Error('missing_base_sepolia_test_receiver_owner_private_key')
  const account = privateKeyToAccount(normalizePrivateKey(raw))
  if (getAddress(account.address) !== TEST_RECEIVER_OWNER) throw new Error('base_sepolia_test_receiver_owner_signer_mismatch')
  return account
}

function sameBytes32(left: Hex, right: Hex): boolean {
  return left.toLowerCase() === right.toLowerCase()
}

type Quote = {
  gas: bigint
  maxFeePerGas: bigint
  maxCostWei: bigint
  maxCostEth: string
}

function quote(gas: bigint, maxFeePerGas: bigint): Quote {
  const maxCostWei = gas * maxFeePerGas
  return { gas, maxFeePerGas, maxCostWei, maxCostEth: formatEther(maxCostWei) }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute')
  const TEST_RECEIVER = resolveTestReceiver()
  if (env('SOLANA_LOTTERY_OAPP_ROUTE') !== 'testnet') throw new Error('testnet_route_required')
  if (env('SOLANA_LOTTERY_OAPP_PROGRAM_ID') !== TEST_OAPP_PROGRAM) throw new Error('isolated_test_oapp_program_required')
  if (isEnabled('SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED')) throw new Error('relay_entries_must_remain_disabled')
  if (isEnabled('SOLANA_LOTTERY_OAPP_SEND_ENABLED')) throw new Error('oapp_sending_must_remain_disabled')
  if (isEnabled('SOLANA_LOTTERY_WINNER_SETTLEMENT_ENABLED')) throw new Error('winner_settlement_must_remain_disabled')

  const rpc = env('BASE_SEPOLIA_RPC_URL') || PUBLIC_BASE_SEPOLIA_RPC
  const client = createPublicClient({ chain: baseSepolia, transport: http(rpc) })
  if (await client.getChainId() !== BASE_SEPOLIA_CHAIN_ID) throw new Error('base_sepolia_chain_id_mismatch')
  const storeBytes32 = deriveLotteryOappStoreBytes32(new PublicKey(TEST_OAPP_PROGRAM))
  const [code, owner, endpoint, currentPeer, authorized] = await Promise.all([
    client.getBytecode({ address: TEST_RECEIVER }),
    client.readContract({ address: TEST_RECEIVER, abi: RECEIVER_ABI, functionName: 'owner' }),
    client.readContract({ address: TEST_RECEIVER, abi: RECEIVER_ABI, functionName: 'endpoint' }),
    client.readContract({ address: TEST_RECEIVER, abi: RECEIVER_ABI, functionName: 'peers', args: [SOLANA_DEVNET_EID] }),
    client.readContract({ address: TEST_RECEIVER, abi: RECEIVER_ABI, functionName: 'authorizedRemoteOFTs', args: [SOLANA_DEVNET_EID, storeBytes32] }),
  ])
  if (!code || code === '0x') throw new Error('base_sepolia_test_receiver_code_missing')
  if (getAddress(owner) !== TEST_RECEIVER_OWNER || getAddress(endpoint) !== BASE_SEPOLIA_ENDPOINT) {
    throw new Error('base_sepolia_test_receiver_identity_mismatch')
  }
  if (!sameBytes32(currentPeer, ZERO_BYTES32) && !sameBytes32(currentPeer, storeBytes32)) {
    throw new Error('base_sepolia_test_receiver_peer_unexpected')
  }
  const needsPeer = !sameBytes32(currentPeer, storeBytes32)
  const needsAuthorization = !authorized
  if (!needsPeer && !needsAuthorization) {
    process.stdout.write(`${JSON.stringify({
      ok: true,
      mode: execute ? 'execute' : 'dry_run',
      action: 'base_sepolia_test_receiver_already_bound_and_authorized',
      transactionSubmitted: false,
      receiver: TEST_RECEIVER,
      sourceEid: SOLANA_DEVNET_EID,
      storeBytes32,
    }, null, 2)}\n`)
    return
  }

  const fees = await client.estimateFeesPerGas()
  const maxFeePerGas = fees.maxFeePerGas ?? fees.gasPrice
  if (maxFeePerGas == null) throw new Error('base_sepolia_fee_quote_unavailable')
  const peerRequest = {
    address: TEST_RECEIVER,
    abi: RECEIVER_ABI,
    functionName: 'setPeer' as const,
    args: [SOLANA_DEVNET_EID, storeBytes32],
    account: TEST_RECEIVER_OWNER,
  }
  const authorizationRequest = {
    address: TEST_RECEIVER,
    abi: RECEIVER_ABI,
    functionName: 'setAuthorizedRemoteOFT' as const,
    args: [SOLANA_DEVNET_EID, storeBytes32, true],
    account: TEST_RECEIVER_OWNER,
  }
  const [peerSimulation, authorizationSimulation, peerGas, authorizationGas] = await Promise.all([
    needsPeer ? client.simulateContract(peerRequest) : Promise.resolve(undefined),
    needsAuthorization ? client.simulateContract(authorizationRequest) : Promise.resolve(undefined),
    needsPeer ? client.estimateContractGas(peerRequest) : Promise.resolve(0n),
    needsAuthorization ? client.estimateContractGas(authorizationRequest) : Promise.resolve(0n),
  ])
  const peerQuote = quote(peerGas, maxFeePerGas)
  const authorizationQuote = quote(authorizationGas, maxFeePerGas)
  const totalMaxCostWei = peerQuote.maxCostWei + authorizationQuote.maxCostWei
  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: execute ? 'execute' : 'dry_run',
    action: 'bind_and_authorize_base_sepolia_test_receiver',
    receiver: TEST_RECEIVER,
    owner: TEST_RECEIVER_OWNER,
    endpoint: BASE_SEPOLIA_ENDPOINT,
    sourceEid: SOLANA_DEVNET_EID,
    storeBytes32,
    current: { peer: currentPeer, authorized },
    transactions: {
      setPeer: needsPeer ? peerQuote : null,
      setAuthorizedRemoteOFT: needsAuthorization ? authorizationQuote : null,
      totalMaxCostWei: totalMaxCostWei.toString(),
      totalMaxCostEth: formatEther(totalMaxCostWei),
    },
    sendAndSettlementFlags: {
      relayEntriesEnabled: false,
      oappSendingEnabled: false,
      winnerSettlementEnabled: false,
    },
    rollback: 'A separately approved sequence first calls setAuthorizedRemoteOFT(40168, store, false), then setPeer(40168, zero). It leaves both ULN policies and all Solana accounts unchanged.',
  }, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2)}\n`)
  if (!execute) return

  const account = readOwnerAccount()
  const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(rpc) })
  const hashes: { setPeer?: Hex; setAuthorizedRemoteOFT?: Hex } = {}
  if (peerSimulation) {
    hashes.setPeer = await wallet.writeContract({ ...peerSimulation.request, account })
    const receipt = await client.waitForTransactionReceipt({ hash: hashes.setPeer, confirmations: 1, timeout: 180_000 })
    if (receipt.status !== 'success') throw new Error('base_sepolia_test_receiver_peer_reverted')
  }
  if (authorizationSimulation) {
    hashes.setAuthorizedRemoteOFT = await wallet.writeContract({ ...authorizationSimulation.request, account })
    const receipt = await client.waitForTransactionReceipt({ hash: hashes.setAuthorizedRemoteOFT, confirmations: 1, timeout: 180_000 })
    if (receipt.status !== 'success') throw new Error('base_sepolia_test_receiver_authorization_reverted')
  }
  // Public Base Sepolia RPCs can return a pre-transaction state immediately
  // after a successful receipt. Poll only the already-finalized state; never
  // resubmit a configuration call when this readback lags.
  let postPeer = ZERO_BYTES32
  let postAuthorized = false
  for (let attempt = 0; attempt < 6; attempt += 1) {
    [postPeer, postAuthorized] = await Promise.all([
      client.readContract({ address: TEST_RECEIVER, abi: RECEIVER_ABI, functionName: 'peers', args: [SOLANA_DEVNET_EID] }),
      client.readContract({ address: TEST_RECEIVER, abi: RECEIVER_ABI, functionName: 'authorizedRemoteOFTs', args: [SOLANA_DEVNET_EID, storeBytes32] }),
    ])
    if (sameBytes32(postPeer, storeBytes32) && postAuthorized) break
    await delay(1_000)
  }
  if (!sameBytes32(postPeer, storeBytes32) || !postAuthorized) {
    throw new Error(`base_sepolia_test_receiver_binding_postcondition_mismatch:${JSON.stringify(hashes)}`)
  }
  process.stdout.write(`${JSON.stringify({ executed: true, hashes, peer: postPeer, authorized: postAuthorized }, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`Base Sepolia test receiver binding failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
