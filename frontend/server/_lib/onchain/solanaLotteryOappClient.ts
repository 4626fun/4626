import { createHash } from 'node:crypto'

import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type AccountMeta,
} from '@solana/web3.js'
import {
  EndpointProgram,
  SimpleMessageLibProgram,
  UlnProgram,
  extractSentPacketEventByTxHash,
  type MessageLibInterface,
  type SolanaPacketPath,
} from '@layerzerolabs/lz-solana-sdk-v2'
import { PacketV1Codec } from '@layerzerolabs/lz-v2-utilities'
import { hexToBytes, keccak256, type Hex } from 'viem'
import { sendAndConfirmSolanaTransactionOverHttp } from './solanaHttpTransaction.js'
import { CANONICAL_LOTTERY_MANAGER } from './solanaLotteryLzTransport.js'

export const SOLANA_LOTTERY_BASE_EID = 30_184
/** Isolated Devnet → Base Sepolia rehearsal destination; never a production route. */
export const SOLANA_LOTTERY_TEST_BASE_EID = 40_245
export const SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID = 'AfLeqn4UzPVeedCTijMcdx7Skb6fbyuYpBEzqGMQUveG'
export const SOLANA_LOTTERY_TEST_RECEIVER = '0x46f77a5e204dbd9a31870e819e671914b40477a3' as const
export const SOLANA_LOTTERY_OAPP_STORE_SEED = Buffer.from('Store')
export const SOLANA_LOTTERY_OAPP_PEER_SEED = Buffer.from('Peer')
const LAYERZERO_OAPP_REGISTRY_SEED = Buffer.from('OApp')
const LAYERZERO_EVENT_AUTHORITY_SEED = Buffer.from('__event_authority')
const UPGRADEABLE_LOADER_PROGRAM_STATE_TAG = 2
const STORE_ACCOUNT_DISCRIMINATOR = createHash('sha256').update('account:Store').digest().subarray(0, 8)
const PEER_ACCOUNT_DISCRIMINATOR = createHash('sha256').update('account:PeerConfig').digest().subarray(0, 8)
const STORE_ACCOUNT_LEN = 105
const PEER_OPTIONS_MAX_LEN = 512

export type SolanaLotteryOappClientRequest = {
  payload: Hex
  expectedPayloadHash: Hex
  expectedPeerBytes32: Hex
  /** Optional fail-closed native-fee ceiling used by a reviewed canary send. */
  maxNativeFeeLamports?: bigint
  /**
   * Production requires the canonical Base LotteryManager. The only exception
   * is the separately deployed Devnet→Base Sepolia rehearsal receiver, which
   * must opt into `testRoute` and pass the exact immutable program/receiver
   * pair below.
   */
  expectedLotteryManager: `0x${string}`
  testRoute?: boolean
}

export type SolanaLotteryOappClientResult = {
  lzGuid: Hex
  solanaSignature: string
  payloadHash: Hex
}

export type BuiltSolanaLotteryOappSend = {
  transaction: Transaction
  nativeFee: bigint
  payloadHash: Hex
  destinationEid: number
}

export type SolanaLotteryOappInitStoreInstructionRequest = {
  programId: PublicKey
  programData: PublicKey
  payer: PublicKey
  upgradeAuthority: PublicKey
  admin: PublicKey
  operator: PublicKey
  endpointProgram?: PublicKey
}

export type SolanaLotteryOappSetBasePeerInstructionRequest = {
  programId: PublicKey
  admin: PublicKey
  destinationEid: number
  peerAddress: Hex
  enforcedOptions: Uint8Array
}

export type SolanaLotteryOappPeerConfig = {
  peerAddress: Hex
  enforcedOptions: Buffer
}

function discriminator(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8)
}

function encodeVec(bytes: Uint8Array): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32LE(bytes.length)
  return Buffer.concat([length, Buffer.from(bytes)])
}

function encodeU64LE(value: bigint): Buffer {
  if (value < 0n || value > 0xffff_ffff_ffff_ffffn) throw new Error('oapp_fee_out_of_range')
  const out = Buffer.alloc(8)
  out.writeBigUInt64LE(value)
  return out
}

function decodePeerAddress(value: Hex): Buffer {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('oapp_peer_address_invalid')
  const peer = Buffer.from(value.slice(2), 'hex')
  if (peer.every((byte) => byte === 0)) throw new Error('oapp_peer_address_zero')
  return peer
}

function assertType3Options(options: Uint8Array): void {
  if (options.length < 2 || options.length > PEER_OPTIONS_MAX_LEN || options[0] !== 0 || options[1] !== 3) {
    throw new Error('oapp_peer_enforced_options_invalid')
  }
}

/**
 * Encodes the compact LayerZero Type-3 executor lzReceive option used by the
 * EVM OptionsBuilder. The gas value is a u128 in network-byte order; a native
 * drop is deliberately unsupported for this receive-only rehearsal route.
 */
export function buildLotteryOappExecutorLzReceiveOptions(gas: bigint): Buffer {
  if (gas <= 0n || gas > 0xffff_ffff_ffff_ffff_ffff_ffff_ffff_ffffn) {
    throw new Error('oapp_peer_receive_gas_invalid')
  }
  const gasBytes = Buffer.alloc(16)
  let remaining = gas
  for (let index = gasBytes.length - 1; index >= 0; index -= 1) {
    gasBytes[index] = Number(remaining & 0xffn)
    remaining >>= 8n
  }
  return Buffer.concat([
    Buffer.from([0, 3]), // Type 3
    Buffer.from([1]), // Executor worker
    Buffer.from([0, 17]), // option type + u128 gas
    Buffer.from([1]), // executor lzReceive
    gasBytes,
  ])
}

/**
 * The server sender always uses the default Base-mainnet EID. The optional
 * argument exists solely for read-only test-route preflight against a
 * separately compiled and separately deployed OApp test artifact.
 */
export function deriveLotteryOappPdas(programId: PublicKey, destinationEid = SOLANA_LOTTERY_BASE_EID): {
  store: PublicKey
  peer: PublicKey
} {
  const [store] = PublicKey.findProgramAddressSync([SOLANA_LOTTERY_OAPP_STORE_SEED], programId)
  const eid = Buffer.alloc(4)
  eid.writeUInt32BE(destinationEid)
  const [peer] = PublicKey.findProgramAddressSync(
    [SOLANA_LOTTERY_OAPP_PEER_SEED, store.toBuffer(), eid],
    programId,
  )
  return { store, peer }
}

export function deriveLotteryOappStoreBytes32(programId: PublicKey): Hex {
  return `0x${deriveLotteryOappPdas(programId).store.toBuffer().toString('hex')}`
}

/**
 * LayerZero's Solana SDK serializes the packet sender with its generic EVM
 * `arrayify` helper. That helper accepts the Store's raw 32-byte hex form,
 * not its user-facing base58 address. Keep this conversion explicit so quote
 * and send always derive the same nonce/account path.
 */
export function encodeLotteryOappPacketSender(store: PublicKey): Hex {
  return `0x${store.toBuffer().toString('hex')}` as Hex
}

/** Decodes the ProgramData address from an upgradeable-loader Program account. */
export function decodeUpgradeableProgramDataAddress(data: Buffer): PublicKey {
  // UpgradeableLoaderState::Program is a u32 tag followed by ProgramData pubkey.
  if (data.length < 36 || data.readUInt32LE(0) !== UPGRADEABLE_LOADER_PROGRAM_STATE_TAG) {
    throw new Error('oapp_program_account_malformed')
  }
  return new PublicKey(data.subarray(4, 36))
}

/**
 * Derives the two LayerZero Endpoint PDAs created when an OApp Store registers.
 * Keeping this explicit prevents callers from supplying an arbitrary registry.
 */
export function deriveLotteryOappEndpointRegistrationPdas(params: {
  store: PublicKey
  endpointProgram?: PublicKey
}): { oappRegistry: PublicKey; eventAuthority: PublicKey } {
  const endpointProgram = params.endpointProgram ?? EndpointProgram.PROGRAM_ID
  const [oappRegistry] = PublicKey.findProgramAddressSync(
    [LAYERZERO_OAPP_REGISTRY_SEED, params.store.toBuffer()],
    endpointProgram,
  )
  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [LAYERZERO_EVENT_AUTHORITY_SEED],
    endpointProgram,
  )
  return { oappRegistry, eventAuthority }
}

/**
 * Builds the sole initialization instruction for an OApp Store. The instruction
 * creates the Store PDA and delegates LayerZero Endpoint registration through
 * the program CPI; it deliberately does not create a peer or configure a DVN.
 */
export function buildLotteryOappInitStoreInstruction(
  params: SolanaLotteryOappInitStoreInstructionRequest,
): TransactionInstruction {
  const endpointProgram = params.endpointProgram ?? EndpointProgram.PROGRAM_ID
  if (!endpointProgram.equals(EndpointProgram.PROGRAM_ID)) throw new Error('oapp_init_endpoint_program_mismatch')
  if (params.admin.equals(PublicKey.default) || params.operator.equals(PublicKey.default)) {
    throw new Error('oapp_init_admin_or_operator_zero')
  }
  const { store } = deriveLotteryOappPdas(params.programId)
  const { oappRegistry, eventAuthority } = deriveLotteryOappEndpointRegistrationPdas({ store, endpointProgram })
  return new TransactionInstruction({
    programId: params.programId,
    keys: [
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: params.upgradeAuthority, isSigner: true, isWritable: false },
      { pubkey: params.programId, isSigner: false, isWritable: false },
      { pubkey: params.programData, isSigner: false, isWritable: false },
      { pubkey: store, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      // Remaining accounts for the LayerZero Endpoint register_oapp CPI.
      // CpiContext requires the invoked program at index zero, while the
      // Endpoint event-CPI account list includes it again at the tail.
      { pubkey: endpointProgram, isSigner: false, isWritable: false },
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: store, isSigner: false, isWritable: false },
      { pubkey: oappRegistry, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: endpointProgram, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      discriminator('init_store'),
      params.admin.toBuffer(),
      params.operator.toBuffer(),
      endpointProgram.toBuffer(),
    ]),
  })
}

/**
 * Builds the test-only Store-admin instruction that creates/configures one
 * destination Peer PDA. It neither calls the Endpoint nor changes a ULN
 * configuration; those are intentionally separate mutation boundaries.
 */
export function buildLotteryOappSetBasePeerInstruction(
  params: SolanaLotteryOappSetBasePeerInstructionRequest,
): TransactionInstruction {
  if (!Number.isInteger(params.destinationEid) || params.destinationEid <= 0 || params.destinationEid > 0xffff_ffff) {
    throw new Error('oapp_peer_destination_eid_invalid')
  }
  const peerAddress = decodePeerAddress(params.peerAddress)
  assertType3Options(params.enforcedOptions)
  const { store, peer } = deriveLotteryOappPdas(params.programId, params.destinationEid)
  return new TransactionInstruction({
    programId: params.programId,
    keys: [
      { pubkey: params.admin, isSigner: true, isWritable: true },
      { pubkey: store, isSigner: false, isWritable: false },
      { pubkey: peer, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      discriminator('set_base_peer'),
      peerAddress,
      encodeVec(params.enforcedOptions),
    ]),
  })
}

export function decodeLotteryOappPeerConfig(data: Buffer): SolanaLotteryOappPeerConfig {
  // Anchor discriminator, peer_address [u8; 32], Borsh Vec<u8>, and bump.
  if (data.length < 45 || !data.subarray(0, 8).equals(PEER_ACCOUNT_DISCRIMINATOR)) {
    throw new Error('oapp_peer_account_malformed')
  }
  const optionsLength = data.readUInt32LE(40)
  const serializedLength = 45 + optionsLength
  const maxAccountLength = 45 + PEER_OPTIONS_MAX_LEN
  if (optionsLength > PEER_OPTIONS_MAX_LEN || data.length < serializedLength || data.length > maxAccountLength) {
    throw new Error('oapp_peer_account_malformed')
  }
  // Anchor allocates the account at `PeerConfig::INIT_SPACE`; unused vector
  // capacity is zero-padded after the serialized fields. Any non-zero tail is
  // corruption, not an acceptable account-layout variant.
  if (data.subarray(serializedLength).some((value) => value !== 0)) {
    throw new Error('oapp_peer_account_malformed')
  }
  const enforcedOptions = Buffer.from(data.subarray(44, 44 + optionsLength))
  assertType3Options(enforcedOptions)
  return {
    peerAddress: `0x${data.subarray(8, 40).toString('hex')}`,
    enforcedOptions,
  }
}

export function decodeLotteryOappPeer(data: Buffer): Hex {
  return decodeLotteryOappPeerConfig(data).peerAddress
}

export function decodeLotteryOappStoreOperator(data: Buffer): PublicKey {
  // Anchor discriminator, admin, operator, endpoint, bump.
  if (data.length !== STORE_ACCOUNT_LEN || !data.subarray(0, 8).equals(STORE_ACCOUNT_DISCRIMINATOR)) {
    throw new Error('oapp_store_account_malformed')
  }
  return new PublicKey(data.subarray(40, 72))
}

export function decodeLotteryOappStoreAdmin(data: Buffer): PublicKey {
  // Anchor discriminator, admin, operator, endpoint, bump.
  if (data.length !== STORE_ACCOUNT_LEN || !data.subarray(0, 8).equals(STORE_ACCOUNT_DISCRIMINATOR)) {
    throw new Error('oapp_store_account_malformed')
  }
  return new PublicKey(data.subarray(8, 40))
}

export function decodeLotteryOappStoreEndpointProgram(data: Buffer): PublicKey {
  // Anchor discriminator, admin, operator, endpoint, bump.
  if (data.length !== STORE_ACCOUNT_LEN || !data.subarray(0, 8).equals(STORE_ACCOUNT_DISCRIMINATOR)) {
    throw new Error('oapp_store_account_malformed')
  }
  return new PublicKey(data.subarray(72, 104))
}

type LotteryOappRoute = {
  destinationEid: number
  receiver: Hex
}

function paddedReceiver(address: `0x${string}`): Hex {
  return `0x${address.slice(2).padStart(64, '0')}`.toLowerCase() as Hex
}

function resolveLotteryOappRoute(programId: PublicKey, request: SolanaLotteryOappClientRequest): LotteryOappRoute {
  const expectedReceiver = paddedReceiver(request.expectedLotteryManager)
  if (request.testRoute === true) {
    if (programId.toBase58() !== SOLANA_LOTTERY_TEST_OAPP_PROGRAM_ID) {
      throw new Error('oapp_test_route_program_mismatch')
    }
    if (request.expectedLotteryManager.toLowerCase() !== SOLANA_LOTTERY_TEST_RECEIVER) {
      throw new Error('oapp_test_route_receiver_mismatch')
    }
    if (expectedReceiver !== request.expectedPeerBytes32.toLowerCase()) {
      throw new Error('oapp_request_peer_lottery_manager_mismatch')
    }
    return { destinationEid: SOLANA_LOTTERY_TEST_BASE_EID, receiver: expectedReceiver }
  }
  if (request.expectedLotteryManager.toLowerCase() !== CANONICAL_LOTTERY_MANAGER.toLowerCase()) {
    throw new Error('oapp_noncanonical_lottery_manager')
  }
  if (expectedReceiver !== request.expectedPeerBytes32.toLowerCase()) {
    throw new Error('oapp_request_peer_lottery_manager_mismatch')
  }
  return { destinationEid: SOLANA_LOTTERY_BASE_EID, receiver: expectedReceiver }
}

async function resolveMessageLibrary(
  connection: Connection,
  endpoint: EndpointProgram.Endpoint,
  payer: PublicKey,
  store: PublicKey,
  destinationEid: number,
): Promise<MessageLibInterface> {
  const info = await endpoint.getSendLibrary(connection, store, destinationEid, 'finalized')
  if (!info.programId) throw new Error('oapp_send_library_missing')
  const version = await endpoint.getMessageLibVersion(connection, payer, info.programId, 'finalized')
  const major = BigInt(version?.major?.toString?.() ?? '-1')
  if (major === 3n && version?.endpointVersion === 2) return new UlnProgram.Uln(info.programId)
  if (major === 0n && version?.endpointVersion === 2) {
    return new SimpleMessageLibProgram.SimpleMessageLib(info.programId)
  }
  throw new Error(`oapp_unsupported_send_library:${major.toString()}`)
}

async function buildRemainingAccounts(params: {
  connection: Connection
  endpoint: EndpointProgram.Endpoint
  payer: PublicKey
  store: PublicKey
  receiver: Hex
  destinationEid: number
  mode: 'quote' | 'send'
}): Promise<AccountMeta[]> {
  const msgLib = await resolveMessageLibrary(
    params.connection,
    params.endpoint,
    params.payer,
    params.store,
    params.destinationEid,
  )
  const path: SolanaPacketPath = {
    sender: encodeLotteryOappPacketSender(params.store),
    dstEid: params.destinationEid,
    receiver: params.receiver,
  }
  return params.mode === 'quote'
    ? params.endpoint.getQuoteIXAccountMetaForCPI(params.connection, params.payer, path, msgLib)
    : params.endpoint.getSendIXAccountMetaForCPI(params.connection, params.payer, path, msgLib, 'finalized')
}

async function quoteNativeFee(params: {
  connection: Connection
  programId: PublicKey
  payer: PublicKey
  store: PublicKey
  peer: PublicKey
  endpoint: EndpointProgram.Endpoint
  payload: Uint8Array
  receiver: Hex
  destinationEid: number
}): Promise<bigint> {
  const remaining = await buildRemainingAccounts({ ...params, mode: 'quote' })
  const ix = new TransactionInstruction({
    programId: params.programId,
    keys: [
      { pubkey: params.store, isSigner: false, isWritable: false },
      { pubkey: params.peer, isSigner: false, isWritable: false },
      { pubkey: params.endpoint.deriver.setting()[0], isSigner: false, isWritable: false },
      ...remaining,
    ],
    data: Buffer.concat([discriminator('quote_send'), encodeVec(params.payload), encodeVec(new Uint8Array())]),
  })
  const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ix)
  tx.feePayer = params.payer
  tx.recentBlockhash = (await params.connection.getLatestBlockhash('finalized')).blockhash
  const simulated = await params.connection.simulateTransaction(tx)
  if (simulated.value.err) {
    throw new Error(
      `oapp_quote_failed:${JSON.stringify(simulated.value.err)}:${(simulated.value.logs ?? []).join(' | ')}`,
    )
  }
  const prefix = `Program return: ${params.programId.toBase58()} `
  const returnLog = simulated.value.logs?.find((line) => line.startsWith(prefix))
  if (!returnLog) throw new Error('oapp_quote_missing_return_data')
  const decoded = Buffer.from(returnLog.slice(prefix.length), 'base64')
  if (decoded.length < 16) throw new Error('oapp_quote_malformed_return_data')
  const nativeFee = decoded.readBigUInt64LE(0)
  const lzTokenFee = decoded.readBigUInt64LE(8)
  if (lzTokenFee !== 0n) throw new Error('oapp_unexpected_lz_token_fee')
  return nativeFee
}

function assertNativeFeeCap(nativeFee: bigint, maxNativeFeeLamports: bigint | undefined): void {
  if (maxNativeFeeLamports == null) return
  if (maxNativeFeeLamports < 0n) throw new Error('oapp_native_fee_cap_invalid')
  if (nativeFee > maxNativeFeeLamports) {
    throw new Error(`oapp_native_fee_exceeds_cap:${nativeFee.toString()}:${maxNativeFeeLamports.toString()}`)
  }
}

type PreparedLotteryOappSend = {
  route: LotteryOappRoute
  payloadHash: Hex
  payload: Uint8Array
  store: PublicKey
  peer: PublicKey
  endpoint: EndpointProgram.Endpoint
  onchainPeer: Hex
}

async function prepareLotteryOappSend(params: {
  connection: Connection
  programId: PublicKey
  payer: PublicKey
  request: SolanaLotteryOappClientRequest
}): Promise<PreparedLotteryOappSend> {
  const { connection, programId, payer, request } = params
  const payloadHash = keccak256(request.payload)
  if (payloadHash.toLowerCase() !== request.expectedPayloadHash.toLowerCase()) {
    throw new Error('oapp_payload_hash_mismatch')
  }
  const route = resolveLotteryOappRoute(programId, request)

  const programAccount = await connection.getAccountInfo(programId, 'finalized')
  if (!programAccount?.executable) throw new Error('oapp_program_not_executable')
  const { store, peer } = deriveLotteryOappPdas(programId, route.destinationEid)
  const [storeAccount, peerAccount] = await connection.getMultipleAccountsInfo([store, peer], 'finalized')
  if (!storeAccount || !storeAccount.owner.equals(programId)) throw new Error('oapp_store_missing_or_wrong_owner')
  if (!peerAccount || !peerAccount.owner.equals(programId)) throw new Error('oapp_peer_missing_or_wrong_owner')
  const storeEndpointProgram = decodeLotteryOappStoreEndpointProgram(storeAccount.data)
  if (!storeEndpointProgram.equals(EndpointProgram.PROGRAM_ID)) {
    throw new Error('oapp_store_endpoint_program_mismatch')
  }
  if (!decodeLotteryOappStoreOperator(storeAccount.data).equals(payer)) {
    throw new Error('oapp_payer_not_authorized_operator')
  }
  const onchainPeer = decodeLotteryOappPeer(peerAccount.data)
  if (onchainPeer.toLowerCase() !== route.receiver.toLowerCase()) {
    throw new Error('oapp_onchain_peer_mismatch')
  }

  return {
    route,
    payloadHash,
    payload: hexToBytes(request.payload),
    store,
    peer,
    endpoint: new EndpointProgram.Endpoint(EndpointProgram.PROGRAM_ID),
    onchainPeer,
  }
}

/**
 * Read-only fee quote. It accepts the same exact-address test-route guard as
 * the sender but never takes a Keypair or submits a transaction.
 */
export async function quoteLotteryEntryFromSolanaOapp(params: {
  connection: Connection
  programId: PublicKey
  payer: PublicKey
  request: SolanaLotteryOappClientRequest
}): Promise<{
  nativeFee: bigint
  payloadHash: Hex
  store: PublicKey
  peer: PublicKey
  destinationEid: number
}> {
  const prepared = await prepareLotteryOappSend(params)
  const nativeFee = await quoteNativeFee({
    connection: params.connection,
    programId: params.programId,
    payer: params.payer,
    store: prepared.store,
    peer: prepared.peer,
    endpoint: prepared.endpoint,
    payload: prepared.payload,
    receiver: prepared.onchainPeer,
    destinationEid: prepared.route.destinationEid,
  })
  assertNativeFeeCap(nativeFee, params.request.maxNativeFeeLamports)
  return {
    nativeFee,
    payloadHash: prepared.payloadHash,
    store: prepared.store,
    peer: prepared.peer,
    destinationEid: prepared.route.destinationEid,
  }
}

/**
 * Build the exact packet send transaction without signing or submitting it.
 * This lets a canary simulate the actual send after its fee ceiling and route
 * guards have been evaluated, rather than treating a quote as a send proof.
 */
export async function buildLotteryEntryFromSolanaOapp(params: {
  connection: Connection
  programId: PublicKey
  payer: Keypair
  request: SolanaLotteryOappClientRequest
}): Promise<BuiltSolanaLotteryOappSend> {
  const { connection, programId, payer } = params
  const prepared = await prepareLotteryOappSend({ ...params, payer: payer.publicKey })
  const nativeFee = await quoteNativeFee({
    connection,
    programId,
    payer: payer.publicKey,
    store: prepared.store,
    peer: prepared.peer,
    endpoint: prepared.endpoint,
    payload: prepared.payload,
    receiver: prepared.onchainPeer,
    destinationEid: prepared.route.destinationEid,
  })
  assertNativeFeeCap(nativeFee, params.request.maxNativeFeeLamports)
  const remaining = await buildRemainingAccounts({
    connection,
    endpoint: prepared.endpoint,
    payer: payer.publicKey,
    store: prepared.store,
    receiver: prepared.onchainPeer,
    destinationEid: prepared.route.destinationEid,
    mode: 'send',
  })
  const sendIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: prepared.store, isSigner: false, isWritable: false },
      { pubkey: prepared.peer, isSigner: false, isWritable: false },
      { pubkey: prepared.endpoint.deriver.setting()[0], isSigner: false, isWritable: false },
      ...remaining,
    ],
    data: Buffer.concat([
      discriminator('send_lottery_entry'),
      encodeVec(prepared.payload),
      encodeVec(new Uint8Array()),
      encodeU64LE(nativeFee),
    ]),
  })
  return {
    transaction: new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), sendIx),
    nativeFee,
    payloadHash: prepared.payloadHash,
    destinationEid: prepared.route.destinationEid,
  }
}

export async function sendLotteryEntryFromSolanaOapp(params: {
  connection: Connection
  programId: PublicKey
  payer: Keypair
  request: SolanaLotteryOappClientRequest
}): Promise<SolanaLotteryOappClientResult> {
  const { connection } = params
  const built = await buildLotteryEntryFromSolanaOapp(params)
  const signature = await sendAndConfirmSolanaTransactionOverHttp({
    connection,
    transaction: built.transaction,
    payer: params.payer,
  })
  const events = await extractSentPacketEventByTxHash(
    connection,
    EndpointProgram.PROGRAM_ID,
    signature,
    'finalized',
  )
  if (!events || events.length !== 1) throw new Error('oapp_packet_sent_event_missing_or_ambiguous')
  const lzGuid = PacketV1Codec.fromBytes(events[0].encodedPacket).guid() as Hex
  if (!/^0x[a-fA-F0-9]{64}$/.test(lzGuid)) throw new Error('oapp_invalid_packet_guid')
  return { lzGuid, solanaSignature: signature, payloadHash: built.payloadHash }
}
