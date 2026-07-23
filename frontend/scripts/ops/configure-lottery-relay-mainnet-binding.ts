#!/usr/bin/env tsx
/**
 * Read, quote, and only explicitly execute the two Base-mainnet receiver
 * bindings required for the production Solana lottery OApp Store:
 *   LotteryManager.setPeer(30168, Store)
 *   LotteryManager.setAuthorizedRemoteOFT(30168, Store, true)
 *
 * It is intentionally incapable of enabling relay ingestion, OApp sending,
 * winner settlement, mint/pool provisioning, or a Solana transaction.
 */
import { pathToFileURL } from 'node:url'

import { Connection, PublicKey } from '@solana/web3.js'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  getAddress,
  http,
  parseAbi,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import {
  buildLotteryOappExecutorLzReceiveOptions,
  decodeLotteryOappPeerConfig,
  decodeLotteryOappStoreAdmin,
  decodeLotteryOappStoreEndpointProgram,
  decodeLotteryOappStoreOperator,
  deriveLotteryOappPdas,
  deriveLotteryOappStoreBytes32,
  SOLANA_LOTTERY_BASE_EID,
  SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID,
} from '../../server/_lib/onchain/solanaLotteryOappClient.js'
import { CANONICAL_LOTTERY_MANAGER } from '../../server/_lib/onchain/solanaLotteryLzTransport.js'
import { EndpointProgram } from '@layerzerolabs/lz-solana-sdk-v2'

const MAINNET_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'
const MAINNET_SOLANA_EID = 30_168
const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex
const LOTTERY_MANAGER = getAddress(CANONICAL_LOTTERY_MANAGER)
const BASE_MAINNET_ENDPOINT = getAddress('0x1a44076050125825900e736c501f859c50fE728c')
const PRODUCTION_OAPP_PROGRAM_ID = 'GgsdTRxKozPwYAiBhhsaVWGC76CMpSu5rtdwFhHMX2WB'
const LOTTERY_MANAGER_ABI = parseAbi([
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

function enabledValue(value: string | undefined): boolean {
  return ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase())
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

function sameBytes32(left: Hex, right: Hex): boolean {
  return left.toLowerCase() === right.toLowerCase()
}

export function assertMainnetBindingFlagsDisabled(
  values: Record<string, string | undefined> = process.env,
): void {
  for (const flag of [
    'SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED',
    'SOLANA_LOTTERY_OAPP_SEND_ENABLED',
    'SOLANA_LOTTERY_WINNER_SETTLEMENT_ENABLED',
  ]) {
    if (enabledValue(values[flag])) throw new Error(`${flag.toLowerCase()}_must_remain_disabled`)
  }
}

export function assertReviewedProductionBindingIdentity(programId: string, endpoint: string): void {
  if (programId !== PRODUCTION_OAPP_PROGRAM_ID) throw new Error('production_oapp_program_required')
  let normalizedEndpoint: Address
  try {
    normalizedEndpoint = getAddress(endpoint)
  } catch {
    throw new Error('base_mainnet_endpoint_identity_mismatch')
  }
  if (normalizedEndpoint !== BASE_MAINNET_ENDPOINT) throw new Error('base_mainnet_endpoint_identity_mismatch')
}

function signerFromEnv() {
  const raw = env('BASE_LOTTERY_MANAGER_OWNER_PRIVATE_KEY') || env('PRIVATE_KEY')
  if (!raw) throw new Error('missing_base_lottery_manager_owner_private_key')
  const normalized = raw.startsWith('0x') ? raw : `0x${raw}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) throw new Error('base_lottery_manager_owner_private_key_invalid')
  return privateKeyToAccount(normalized as Hex)
}

function receiveGas(): bigint {
  const raw = requireEnv('SOLANA_LOTTERY_OAPP_BASE_RECEIVE_GAS')
  if (!/^\d+$/.test(raw)) throw new Error('invalid_solana_lottery_oapp_base_receive_gas')
  const gas = BigInt(raw)
  if (gas < 200_000n || gas > 2_000_000n) throw new Error('solana_lottery_oapp_base_receive_gas_out_of_range')
  return gas
}

function json(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item, 2)}\n`)
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write('Usage: pnpm -C frontend ops:configure-lottery-relay-mainnet-binding [--execute]\n')
    return
  }
  const execute = process.argv.includes('--execute')
  if (env('SOLANA_LOTTERY_OAPP_ROUTE') && env('SOLANA_LOTTERY_OAPP_ROUTE').toLowerCase() !== 'mainnet') {
    throw new Error('mainnet_oapp_route_required')
  }
  assertMainnetBindingFlagsDisabled()
  // Prefer the dedicated mainnet URL when a local `.env` also has a devnet
  // default. The genesis check below remains the final chain lock.
  const solanaRpc = env('SOLANA_MAINNET_RPC_URL') || requireEnv('SOLANA_RPC_URL')
  const baseRpc = requireEnv('BASE_RPC_URL').split(',')[0]?.trim()
  if (!baseRpc) throw new Error('missing_base_rpc_url')
  const program = requirePubkey('SOLANA_LOTTERY_OAPP_PROGRAM_ID')
  if (program.toBase58() === SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID) throw new Error('test_oapp_program_forbidden_on_mainnet')
  if (program.toBase58() !== PRODUCTION_OAPP_PROGRAM_ID) throw new Error('production_oapp_program_required')
  const expectedAdmin = requirePubkey('SOLANA_LOTTERY_OAPP_ADMIN_PUBKEY')
  const expectedOperator = requirePubkey('SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY')
  const solana = new Connection(solanaRpc, 'finalized')
  if (await solana.getGenesisHash() !== MAINNET_GENESIS_HASH) throw new Error('solana_mainnet_genesis_mismatch')
  const { store, peer } = deriveLotteryOappPdas(program, SOLANA_LOTTERY_BASE_EID)
  const [programInfo, storeInfo, peerInfo] = await solana.getMultipleAccountsInfo([program, store, peer], 'finalized')
  if (!programInfo?.executable) throw new Error('mainnet_oapp_program_not_executable')
  if (!storeInfo?.owner.equals(program)) throw new Error('mainnet_oapp_store_missing_or_wrong_owner')
  if (!decodeLotteryOappStoreAdmin(storeInfo.data).equals(expectedAdmin)) throw new Error('mainnet_oapp_store_admin_mismatch')
  if (!decodeLotteryOappStoreOperator(storeInfo.data).equals(expectedOperator)) throw new Error('mainnet_oapp_store_operator_mismatch')
  if (!decodeLotteryOappStoreEndpointProgram(storeInfo.data).equals(EndpointProgram.PROGRAM_ID)) {
    throw new Error('mainnet_oapp_store_endpoint_mismatch')
  }
  const expectedPeer = `0x${LOTTERY_MANAGER.slice(2).toLowerCase().padStart(64, '0')}` as Hex
  const expectedOptions = buildLotteryOappExecutorLzReceiveOptions(receiveGas())
  const decodedPeer = peerInfo?.owner.equals(program) ? decodeLotteryOappPeerConfig(peerInfo.data) : null
  if (!decodedPeer || !sameBytes32(decodedPeer.peerAddress, expectedPeer) || !decodedPeer.enforcedOptions.equals(expectedOptions)) {
    throw new Error('mainnet_oapp_fixed_base_peer_required')
  }

  const client = createPublicClient({ chain: base, transport: http(baseRpc) })
  if (await client.getChainId() !== base.id) throw new Error('base_mainnet_chain_id_mismatch')
  const storeBytes32 = deriveLotteryOappStoreBytes32(program)
  const [code, owner, endpoint, currentPeer, authorized] = await Promise.all([
    client.getBytecode({ address: LOTTERY_MANAGER }),
    client.readContract({ address: LOTTERY_MANAGER, abi: LOTTERY_MANAGER_ABI, functionName: 'owner' }),
    client.readContract({ address: LOTTERY_MANAGER, abi: LOTTERY_MANAGER_ABI, functionName: 'endpoint' }),
    client.readContract({ address: LOTTERY_MANAGER, abi: LOTTERY_MANAGER_ABI, functionName: 'peers', args: [MAINNET_SOLANA_EID] }),
    client.readContract({ address: LOTTERY_MANAGER, abi: LOTTERY_MANAGER_ABI, functionName: 'authorizedRemoteOFTs', args: [MAINNET_SOLANA_EID, storeBytes32] }),
  ])
  if (!code || code === '0x') throw new Error('base_lottery_manager_code_missing')
  assertReviewedProductionBindingIdentity(program.toBase58(), endpoint)
  if (!sameBytes32(currentPeer, ZERO_BYTES32) && !sameBytes32(currentPeer, storeBytes32)) {
    throw new Error('base_lottery_manager_existing_peer_unexpected')
  }
  const needsPeer = !sameBytes32(currentPeer, storeBytes32)
  const needsAuthorization = !authorized
  const ownerAddress = getAddress(owner)
  const peerCalldata = encodeFunctionData({ abi: LOTTERY_MANAGER_ABI, functionName: 'setPeer', args: [MAINNET_SOLANA_EID, storeBytes32] })
  const authorizationCalldata = encodeFunctionData({ abi: LOTTERY_MANAGER_ABI, functionName: 'setAuthorizedRemoteOFT', args: [MAINNET_SOLANA_EID, storeBytes32, true] })
  if (!needsPeer && !needsAuthorization) {
    json({ ok: true, mode: execute ? 'execute' : 'dry_run', action: 'base_lottery_manager_already_bound_and_authorized', transactionSubmitted: false, lotteryManager: LOTTERY_MANAGER, sourceEid: MAINNET_SOLANA_EID, storeBytes32 })
    return
  }
  const fees = await client.estimateFeesPerGas()
  const maxFeePerGas = fees.maxFeePerGas ?? fees.gasPrice
  if (maxFeePerGas == null) throw new Error('base_mainnet_fee_quote_unavailable')
  const peerRequest = { address: LOTTERY_MANAGER, abi: LOTTERY_MANAGER_ABI, functionName: 'setPeer' as const, args: [MAINNET_SOLANA_EID, storeBytes32] as const, account: ownerAddress }
  const authorizationRequest = { address: LOTTERY_MANAGER, abi: LOTTERY_MANAGER_ABI, functionName: 'setAuthorizedRemoteOFT' as const, args: [MAINNET_SOLANA_EID, storeBytes32, true] as const, account: ownerAddress }
  const [peerSimulation, authorizationSimulation, peerGas, authorizationGas] = await Promise.all([
    needsPeer ? client.simulateContract(peerRequest) : Promise.resolve(undefined),
    needsAuthorization ? client.simulateContract(authorizationRequest) : Promise.resolve(undefined),
    needsPeer ? client.estimateContractGas(peerRequest) : Promise.resolve(0n),
    needsAuthorization ? client.estimateContractGas(authorizationRequest) : Promise.resolve(0n),
  ])
  const peerMaxWei = peerGas * maxFeePerGas
  const authorizationMaxWei = authorizationGas * maxFeePerGas
  json({
    ok: true,
    mode: execute ? 'execute' : 'dry_run',
    route: 'solana-mainnet-to-base-mainnet',
    action: 'bind_and_authorize_base_lottery_manager',
    lotteryManager: LOTTERY_MANAGER,
    owner: ownerAddress,
    endpoint: getAddress(endpoint),
    sourceEid: MAINNET_SOLANA_EID,
    solanaProgram: program.toBase58(),
    solanaStore: store.toBase58(),
    solanaPeer: peer.toBase58(),
    storeBytes32,
    receiveGas: receiveGas().toString(),
    enforcedOptions: `0x${expectedOptions.toString('hex')}`,
    current: { peer: currentPeer, authorized },
    transactions: {
      setPeer: needsPeer ? { calldata: peerCalldata, gas: peerGas.toString(), maxCostWei: peerMaxWei.toString(), maxCostEth: formatEther(peerMaxWei) } : null,
      setAuthorizedRemoteOFT: needsAuthorization ? { calldata: authorizationCalldata, gas: authorizationGas.toString(), maxCostWei: authorizationMaxWei.toString(), maxCostEth: formatEther(authorizationMaxWei) } : null,
      totalMaxCostWei: (peerMaxWei + authorizationMaxWei).toString(),
      totalMaxCostEth: formatEther(peerMaxWei + authorizationMaxWei),
    },
    relayEntriesEnabled: false,
    oappSendingEnabled: false,
    winnerSettlementEnabled: false,
    rollback: 'A separately approved owner sequence first calls setAuthorizedRemoteOFT(30168, Store, false), then setPeer(30168, bytes32(0)). It does not change Solana OApp, ULN, Mint, Pool, or any feature flag.',
  })
  if (!execute) return
  requireEnv('SOLANA_LOTTERY_OAPP_BASE_BINDING_APPROVAL_REF')
  const account = signerFromEnv()
  if (getAddress(account.address) !== ownerAddress) {
    throw new Error(`base_lottery_manager_owner_signer_mismatch:${account.address}`)
  }
  const wallet = createWalletClient({ account, chain: base, transport: http(baseRpc) })
  const hashes: { setPeer?: Hex; setAuthorizedRemoteOFT?: Hex } = {}
  if (peerSimulation) {
    hashes.setPeer = await wallet.writeContract({ ...peerSimulation.request, account })
    const receipt = await client.waitForTransactionReceipt({ hash: hashes.setPeer, confirmations: 1, timeout: 180_000 })
    if (receipt.status !== 'success') throw new Error('base_lottery_manager_peer_reverted')
  }
  if (authorizationSimulation) {
    hashes.setAuthorizedRemoteOFT = await wallet.writeContract({ ...authorizationSimulation.request, account })
    const receipt = await client.waitForTransactionReceipt({ hash: hashes.setAuthorizedRemoteOFT, confirmations: 1, timeout: 180_000 })
    if (receipt.status !== 'success') throw new Error('base_lottery_manager_authorization_reverted')
  }
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const [postPeer, postAuthorized] = await Promise.all([
      client.readContract({ address: LOTTERY_MANAGER, abi: LOTTERY_MANAGER_ABI, functionName: 'peers', args: [MAINNET_SOLANA_EID] }),
      client.readContract({ address: LOTTERY_MANAGER, abi: LOTTERY_MANAGER_ABI, functionName: 'authorizedRemoteOFTs', args: [MAINNET_SOLANA_EID, storeBytes32] }),
    ])
    if (sameBytes32(postPeer, storeBytes32) && postAuthorized) {
      json({ executed: true, hashes, peer: postPeer, authorized: postAuthorized })
      return
    }
    await delay(1_000)
  }
  throw new Error(`base_lottery_manager_binding_postcondition_mismatch:${JSON.stringify(hashes)}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`Base mainnet lottery relay binding failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
