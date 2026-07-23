import { createHash } from 'node:crypto'

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import { encodePacked, keccak256, type Hex } from 'viem'

import {
  CREATOR_SHARE_HOOK_PROGRAM_ID,
  deriveCreatorShareHookPdas,
} from './creatorShareHookPdas.js'
import { sendAndConfirmSolanaTransactionOverHttp } from './solanaHttpTransaction.js'

const WIN_ID_SEED = Buffer.from('win_id')
const PROGRAM_ID = new PublicKey(CREATOR_SHARE_HOOK_PROGRAM_ID)
const CREATOR_CONFIG_ACCOUNT_LEN = 501
const WINNER_RECORD_ACCOUNT_LEN = 89
const WIN_ID_RECORD_ACCOUNT_LEN = 121
const WINNER_RECORD_DISCRIMINATOR = createHash('sha256').update('account:WinnerRecord').digest().subarray(0, 8)
const CREATOR_CONFIG_MINT_OFFSET = 8
const CREATOR_CONFIG_KEEPER_OFFSET = 72
const CREATOR_CONFIG_LOTTERY_ENABLED_OFFSET = 178

export type SolanaWinnerIdentity = {
  baseChainId: bigint
  baseTxHash: Hex
  baseLogIndex: number
  creatorToken: `0x${string}`
  beneficiaryCsw: `0x${string}`
  requestId: bigint
}

export type RecordSolanaWinnerRequest = {
  creatorMint: string
  winnerSolana: string
  sharesPaid: bigint
  winId: Hex
}

export type RecordSolanaWinnerResult = {
  status: 'recorded' | 'already_recorded'
  signature: string | null
  winIdRecord: string
  winnerRecord: string
}

export function deriveSolanaWinnerWinId(identity: SolanaWinnerIdentity): Hex {
  if (identity.baseLogIndex < 0 || !Number.isSafeInteger(identity.baseLogIndex)) {
    throw new Error('invalid_base_log_index')
  }
  return keccak256(encodePacked(
    ['string', 'uint256', 'bytes32', 'uint256', 'address', 'address', 'uint256'],
    [
      '4626.solana.lottery.winner.v1',
      identity.baseChainId,
      identity.baseTxHash,
      BigInt(identity.baseLogIndex),
      identity.creatorToken,
      identity.beneficiaryCsw,
      identity.requestId,
    ],
  ))
}

function anchorDiscriminator(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8)
}

function u64le(value: bigint): Buffer {
  if (value < 0n || value > 0xffff_ffff_ffff_ffffn) throw new Error('winner_shares_paid_overflow')
  const out = Buffer.alloc(8)
  out.writeBigUInt64LE(value)
  return out
}

export function deriveWinIdRecord(creatorMint: PublicKey, winId: Hex): PublicKey {
  const bytes = Buffer.from(winId.slice(2), 'hex')
  if (bytes.length !== 32 || bytes.every((value) => value === 0)) throw new Error('invalid_win_id')
  return PublicKey.findProgramAddressSync([WIN_ID_SEED, creatorMint.toBuffer(), bytes], PROGRAM_ID)[0]
}

function existingRecordMatches(data: Buffer, request: RecordSolanaWinnerRequest): boolean {
  if (data.length !== WIN_ID_RECORD_ACCOUNT_LEN) throw new Error('winner_win_id_record_malformed')
  const expectedDiscriminator = createHash('sha256').update('account:WinIdRecord').digest().subarray(0, 8)
  if (!data.subarray(0, 8).equals(expectedDiscriminator)) throw new Error('winner_win_id_record_discriminator_mismatch')
  const creatorMint = new PublicKey(data.subarray(8, 40)).toBase58()
  const winId = `0x${data.subarray(40, 72).toString('hex')}`
  const winner = new PublicKey(data.subarray(72, 104)).toBase58()
  const sharesPaid = data.readBigUInt64LE(104)
  return creatorMint === new PublicKey(request.creatorMint).toBase58()
    && winId.toLowerCase() === request.winId.toLowerCase()
    && winner === new PublicKey(request.winnerSolana).toBase58()
    && sharesPaid === request.sharesPaid
}

/**
 * Verify the mutable latest-winner account after a newly submitted settlement.
 * The one-shot WinIdRecord is the replay authority; this account is checked as
 * an additional readback invariant so a successful transaction cannot be
 * reported while the creator's display surface is malformed or mismatched.
 */
export function winnerRecordMatches(data: Buffer, request: RecordSolanaWinnerRequest): boolean {
  if (data.length !== WINNER_RECORD_ACCOUNT_LEN) return false
  if (!data.subarray(0, 8).equals(WINNER_RECORD_DISCRIMINATOR)) return false
  try {
    const creatorMint = new PublicKey(data.subarray(8, 40)).toBase58()
    const winner = new PublicKey(data.subarray(40, 72)).toBase58()
    const sharesPaid = data.readBigUInt64LE(72)
    return creatorMint === new PublicKey(request.creatorMint).toBase58()
      && winner === new PublicKey(request.winnerSolana).toBase58()
      && sharesPaid === request.sharesPaid
  } catch {
    return false
  }
}

function winnerRecordBelongsToCreator(data: Buffer, creatorMint: PublicKey): boolean {
  return data.length === WINNER_RECORD_ACCOUNT_LEN
    && data.subarray(0, 8).equals(WINNER_RECORD_DISCRIMINATOR)
    && data.subarray(8, 40).equals(creatorMint.toBuffer())
}

export async function recordSolanaLotteryWinner(params: {
  connection: Connection
  payer: Keypair
  request: RecordSolanaWinnerRequest
}): Promise<RecordSolanaWinnerResult> {
  const { connection, payer, request } = params
  if (request.sharesPaid <= 0n) throw new Error('winner_shares_paid_must_be_positive')
  const creatorMint = new PublicKey(request.creatorMint)
  const winner = new PublicKey(request.winnerSolana)
  const pdas = deriveCreatorShareHookPdas(creatorMint.toBase58())
  if (!pdas) throw new Error('invalid_creator_mint')
  const creatorConfig = new PublicKey(pdas.creatorConfig)
  const winnerRecord = new PublicKey(pdas.winnerRecord)
  const winIdRecord = deriveWinIdRecord(creatorMint, request.winId)

  const [configAccount, winnerAccount, existingWin] = await connection.getMultipleAccountsInfo(
    [creatorConfig, winnerRecord, winIdRecord],
    'finalized',
  )
  if (!configAccount || !configAccount.owner.equals(PROGRAM_ID) || configAccount.data.length !== CREATOR_CONFIG_ACCOUNT_LEN) {
    throw new Error('winner_creator_config_missing_or_malformed')
  }
  if (!configAccount.data.subarray(CREATOR_CONFIG_MINT_OFFSET, CREATOR_CONFIG_MINT_OFFSET + 32).equals(creatorMint.toBuffer())) {
    throw new Error('winner_creator_config_mint_mismatch')
  }
  if (!configAccount.data.subarray(CREATOR_CONFIG_KEEPER_OFFSET, CREATOR_CONFIG_KEEPER_OFFSET + 32).equals(payer.publicKey.toBuffer())) {
    throw new Error('winner_keeper_not_authorized')
  }
  if (configAccount.data[CREATOR_CONFIG_LOTTERY_ENABLED_OFFSET] !== 1) {
    throw new Error('winner_lottery_disabled')
  }
  if (!winnerAccount
    || !winnerAccount.owner.equals(PROGRAM_ID)
    || !winnerRecordBelongsToCreator(winnerAccount.data, creatorMint)) {
    throw new Error('winner_record_missing_or_malformed')
  }
  if (existingWin) {
    if (!existingWin.owner.equals(PROGRAM_ID) || !existingRecordMatches(existingWin.data, request)) {
      throw new Error('winner_replay_record_mismatch')
    }
    return {
      status: 'already_recorded',
      signature: null,
      winIdRecord: winIdRecord.toBase58(),
      winnerRecord: winnerRecord.toBase58(),
    }
  }

  const data = Buffer.concat([
    anchorDiscriminator('record_winner'),
    winner.toBuffer(),
    u64le(request.sharesPaid),
    Buffer.from(request.winId.slice(2), 'hex'),
  ])
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: creatorConfig, isSigner: false, isWritable: false },
      { pubkey: creatorMint, isSigner: false, isWritable: false },
      { pubkey: winnerRecord, isSigner: false, isWritable: true },
      { pubkey: winIdRecord, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
  const signature = await sendAndConfirmSolanaTransactionOverHttp({
    connection,
    transaction: new Transaction().add(ix),
    payer,
  })
  const [winnerReadback, winIdReadback] = await connection.getMultipleAccountsInfo(
    [winnerRecord, winIdRecord],
    'finalized',
  )
  if (!winnerReadback
    || !winnerReadback.owner.equals(PROGRAM_ID)
    || !winnerRecordMatches(winnerReadback.data, request)
    || !winIdReadback
    || !winIdReadback.owner.equals(PROGRAM_ID)
    || !existingRecordMatches(winIdReadback.data, request)) {
    throw new Error('winner_record_readback_failed')
  }
  return {
    status: 'recorded',
    signature,
    winIdRecord: winIdRecord.toBase58(),
    winnerRecord: winnerRecord.toBase58(),
  }
}
