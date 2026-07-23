#!/usr/bin/env tsx
/**
 * Strictly read-only finalized Solana B2 on-chain preflight.
 *
 * This command does not import any persistence/status helper (those may
 * bootstrap database schemas). It only reads the exact mint, hook PDAs, and
 * optional Meteora pool named by the operator's environment.
 */

import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

import { Connection, PublicKey } from '@solana/web3.js'
import {
  getMint,
  getTransferFeeConfig,
  getTransferHook,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token'

import {
  CREATOR_SHARE_HOOK_PROGRAM_ID,
  deriveCreatorShareHookPdas,
} from '../../server/_lib/onchain/creatorShareHookPdas.js'
import { decodeMeteoraTokenBadge } from '../../server/_lib/onchain/solanaMeteoraTokenBadge.js'
import { hasExactCreatorConfigAmmProgram } from '../../server/_lib/onchain/solanaCreatorConfig.js'

export { decodeMeteoraTokenBadge } from '../../server/_lib/onchain/solanaMeteoraTokenBadge.js'

const require = createRequire(import.meta.url)
const { getTokensMintFromPoolAddress } = require('@meteora-ag/dlmm') as {
  getTokensMintFromPoolAddress: (
    connection: Connection,
    poolAddress: string,
  ) => Promise<{ tokenXMint: PublicKey; tokenYMint: PublicKey }>
}

const ACCOUNT_SIZES = {
  creatorConfig: 501,
  pendingEntries: 12_352,
  winnerRecord: 89,
  extraAccountMetaList: 86,
} as const

const DEFAULT_METEORA_DLMM_PROGRAM_ID = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'

const CONFIG_OFFSETS = {
  creatorMint: 8,
  hubCreatorCoin: 104,
  hubShareOft: 136,
  feeBps: 168,
  lotteryEnabled: 178,
} as const

type Check = { id: string; passed: boolean; detail: string }

export type SolanaB2OnchainPreflight = {
  ok: boolean
  rpc: string
  commitment: 'finalized'
  mint: string
  pdas: {
    creatorConfig: string
    pendingEntries: string
    winnerRecord: string
    extraAccountMetaList: string
  } | null
  pool: { address: string; tokenXMint: string; tokenYMint: string } | null
  meteoraTokenBadge: { address: string; programId: string } | null
  checks: Check[]
  error?: string
}

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function bytes32Address(value: Uint8Array): string {
  return `0x${Buffer.from(value).toString('hex')}`
}

function evmAddressBytes32(value: string): Buffer | null {
  const normalized = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return null
  return Buffer.concat([Buffer.alloc(12), Buffer.from(normalized.slice(2), 'hex')])
}

function add(checks: Check[], id: string, passed: boolean, detail: string): void {
  checks.push({ id, passed, detail })
}

export async function readSolanaB2OnchainPreflight(): Promise<SolanaB2OnchainPreflight> {
  const rpc = env('SOLANA_RPC_URL')
  const mintRaw = env('SOLANA_B2_MINT') || env('SOLANA_SHARE_MESH_MINT')
  const poolRaw = env('SOLANA_B2_POOL') || env('SOLANA_METEORA_POOL')
  const quoteMintRaw = env('SOLANA_METEORA_POOL_QUOTE_MINT')
  const checks: Check[] = []

  if (!rpc) {
    return { ok: false, rpc: '', commitment: 'finalized', mint: mintRaw, pdas: null, pool: null, meteoraTokenBadge: null, checks: [], error: 'missing_solana_rpc_url' }
  }
  if (!mintRaw) {
    return { ok: false, rpc, commitment: 'finalized', mint: '', pdas: null, pool: null, meteoraTokenBadge: null, checks: [], error: 'missing_solana_b2_mint' }
  }

  let mint: PublicKey
  try {
    mint = new PublicKey(mintRaw)
  } catch {
    return { ok: false, rpc, commitment: 'finalized', mint: mintRaw, pdas: null, pool: null, meteoraTokenBadge: null, checks: [], error: 'invalid_solana_b2_mint' }
  }
  const pdas = deriveCreatorShareHookPdas(mint.toBase58())
  if (!pdas) {
    return { ok: false, rpc, commitment: 'finalized', mint: mint.toBase58(), pdas: null, pool: null, meteoraTokenBadge: null, checks: [], error: 'hook_pda_derivation_failed' }
  }
  const hookProgram = new PublicKey(CREATOR_SHARE_HOOK_PROGRAM_ID)
  const [extraAccountMetaList] = PublicKey.findProgramAddressSync(
    [Buffer.from('extra-account-metas'), mint.toBuffer()],
    hookProgram,
  )
  let meteoraProgram: PublicKey
  try {
    meteoraProgram = new PublicKey(env('SOLANA_METEORA_DLMM_PROGRAM_ID') || DEFAULT_METEORA_DLMM_PROGRAM_ID)
  } catch {
    return {
      ok: false,
      rpc,
      commitment: 'finalized',
      mint: mint.toBase58(),
      pdas: { ...pdas, extraAccountMetaList: extraAccountMetaList.toBase58() },
      pool: null,
      meteoraTokenBadge: null,
      checks,
      error: 'invalid_solana_meteora_dlmm_program_id',
    }
  }
  const [meteoraTokenBadge] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_badge'), mint.toBuffer()],
    meteoraProgram,
  )
  const connection = new Connection(rpc, 'finalized')

  let accounts: Array<Awaited<ReturnType<Connection['getAccountInfo']>>>
  try {
    accounts = await connection.getMultipleAccountsInfo([
      hookProgram,
      mint,
      new PublicKey(pdas.creatorConfig),
      new PublicKey(pdas.pendingEntries),
      new PublicKey(pdas.winnerRecord),
      extraAccountMetaList,
      meteoraTokenBadge,
    ], 'finalized')
  } catch (error) {
    return {
      ok: false,
      rpc,
      commitment: 'finalized',
      mint: mint.toBase58(),
      pdas: { ...pdas, extraAccountMetaList: extraAccountMetaList.toBase58() },
      pool: null,
      meteoraTokenBadge: { address: meteoraTokenBadge.toBase58(), programId: meteoraProgram.toBase58() },
      checks,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  const [programInfo, mintInfo, creatorConfigInfo, pendingInfo, winnerInfo, extraInfo, tokenBadgeInfo] = accounts
  add(checks, 'hook_program_executable', programInfo?.executable === true, programInfo?.executable ? 'executable' : 'missing_or_not_executable')
  add(checks, 'hook_mint_token_2022_owner', mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID) === true, mintInfo ? `owner=${mintInfo.owner.toBase58()}` : 'missing')
  add(checks, 'creator_config_account_shape', creatorConfigInfo?.owner.equals(hookProgram) === true && creatorConfigInfo.data.length === ACCOUNT_SIZES.creatorConfig, creatorConfigInfo ? `owner=${creatorConfigInfo.owner.toBase58()},length=${creatorConfigInfo.data.length}` : 'missing')
  add(checks, 'pending_entries_account_shape', pendingInfo?.owner.equals(hookProgram) === true && pendingInfo.data.length === ACCOUNT_SIZES.pendingEntries, pendingInfo ? `owner=${pendingInfo.owner.toBase58()},length=${pendingInfo.data.length}` : 'missing')
  add(checks, 'winner_record_account_shape', winnerInfo?.owner.equals(hookProgram) === true && winnerInfo.data.length === ACCOUNT_SIZES.winnerRecord, winnerInfo ? `owner=${winnerInfo.owner.toBase58()},length=${winnerInfo.data.length}` : 'missing')
  add(checks, 'extra_account_meta_account_shape', extraInfo?.owner.equals(hookProgram) === true && extraInfo.data.length === ACCOUNT_SIZES.extraAccountMetaList, extraInfo ? `owner=${extraInfo.owner.toBase58()},length=${extraInfo.data.length}` : 'missing')
  const tokenBadgeDecoded = tokenBadgeInfo ? decodeMeteoraTokenBadge(tokenBadgeInfo.data, mint) : { valid: false, reason: 'missing' }
  add(
    checks,
    'meteora_token_badge',
    tokenBadgeInfo?.owner.equals(meteoraProgram) === true && tokenBadgeDecoded.valid,
    tokenBadgeInfo ? `owner=${tokenBadgeInfo.owner.toBase58()},${tokenBadgeDecoded.reason}` : 'missing',
  )

  let pool: SolanaB2OnchainPreflight['pool'] = null
  if (mintInfo) {
    try {
      const mintState = await getMint(connection, mint, 'finalized', TOKEN_2022_PROGRAM_ID)
      const transferHook = getTransferHook(mintState)
      add(checks, 'transfer_hook_program', transferHook?.programId.equals(hookProgram) === true, transferHook ? `program=${transferHook.programId.toBase58()}` : 'missing')
      const transferFee = getTransferFeeConfig(mintState)
      add(checks, 'transfer_fee_zero', Boolean(transferFee) && transferFee!.olderTransferFee.transferFeeBasisPoints === 0 && transferFee!.newerTransferFee.transferFeeBasisPoints === 0, transferFee ? `older=${transferFee.olderTransferFee.transferFeeBasisPoints},newer=${transferFee.newerTransferFee.transferFeeBasisPoints}` : 'missing')
      const oftProgramRaw = env('SOLANA_OFT_PROGRAM_ID')
      if (!oftProgramRaw) {
        add(checks, 'oft_store_mint_authority', false, 'missing_solana_oft_program_id')
      } else {
        try {
          const oftProgram = new PublicKey(oftProgramRaw)
          const authorityInfo = mintState.mintAuthority
            ? await connection.getAccountInfo(mintState.mintAuthority, 'finalized')
            : null
          add(checks, 'oft_store_mint_authority', Boolean(authorityInfo?.owner.equals(oftProgram)), authorityInfo ? `authority=${mintState.mintAuthority!.toBase58()},owner=${authorityInfo.owner.toBase58()}` : 'missing_authority_account')
        } catch {
          add(checks, 'oft_store_mint_authority', false, 'invalid_solana_oft_program_id')
        }
      }
    } catch (error) {
      add(checks, 'hook_mint_extensions', false, error instanceof Error ? error.message : String(error))
    }
  } else {
    add(checks, 'hook_mint_extensions', false, 'mint_account_missing')
  }

  if (creatorConfigInfo?.data.length === ACCOUNT_SIZES.creatorConfig) {
    const data = creatorConfigInfo.data
    add(checks, 'creator_config_mint_matches', data.subarray(CONFIG_OFFSETS.creatorMint, CONFIG_OFFSETS.creatorMint + 32).equals(mint.toBuffer()), `creator_mint=${new PublicKey(data.subarray(CONFIG_OFFSETS.creatorMint, CONFIG_OFFSETS.creatorMint + 32)).toBase58()}`)
    add(checks, 'creator_config_fee_zero', data.readUInt16LE(CONFIG_OFFSETS.feeBps) === 0, `fee_bps=${data.readUInt16LE(CONFIG_OFFSETS.feeBps)}`)
    add(checks, 'creator_config_lottery_enabled', data[CONFIG_OFFSETS.lotteryEnabled] === 1, `lottery_enabled=${data[CONFIG_OFFSETS.lotteryEnabled] === 1}`)
    add(
      checks,
      'creator_config_amm_allowlist',
      hasExactCreatorConfigAmmProgram(data, meteoraProgram.toBase58()),
      `expected_meteora=${meteoraProgram.toBase58()}`,
    )
    const expectedCreator = env('SOLANA_B2_CREATOR_TOKEN').toLowerCase()
    if (expectedCreator) {
      const expected = evmAddressBytes32(expectedCreator)
      const actual = data.subarray(CONFIG_OFFSETS.hubCreatorCoin, CONFIG_OFFSETS.hubCreatorCoin + 32)
      add(checks, 'creator_config_hub_creator_matches', expected !== null && actual.equals(expected), `hub_creator_coin=${bytes32Address(actual)}`)
    }
    const expectedShare = env('SOLANA_B2_SHARE_OFT').toLowerCase()
    if (expectedShare) {
      const expected = evmAddressBytes32(expectedShare)
      const actual = data.subarray(CONFIG_OFFSETS.hubShareOft, CONFIG_OFFSETS.hubShareOft + 32)
      add(checks, 'creator_config_hub_share_matches', expected !== null && actual.equals(expected), `hub_share_oft=${bytes32Address(actual)}`)
    }
  } else {
    add(checks, 'creator_config_amm_allowlist', false, 'creator_config_account_missing_or_malformed')
  }
  for (const [id, info] of [['pending_entries_mint_matches', pendingInfo], ['winner_record_mint_matches', winnerInfo] ] as const) {
    if (info?.data.length && info.data.length >= 40) {
      add(checks, id, info.data.subarray(8, 40).equals(mint.toBuffer()), `creator_mint=${new PublicKey(info.data.subarray(8, 40)).toBase58()}`)
    }
  }

  if (!poolRaw || !quoteMintRaw) {
    add(checks, 'meteora_pool_mint_alignment', false, !poolRaw ? 'missing_solana_meteora_pool' : 'missing_solana_meteora_pool_quote_mint')
  } else {
    try {
      const quoteMint = new PublicKey(quoteMintRaw)
      const poolKey = new PublicKey(poolRaw)
      const meteoraProgram = new PublicKey(env('SOLANA_METEORA_DLMM_PROGRAM_ID') || DEFAULT_METEORA_DLMM_PROGRAM_ID)
      const poolInfo = await connection.getAccountInfo(poolKey, 'finalized')
      add(
        checks,
        'meteora_pool_program_owner',
        poolInfo?.owner.equals(meteoraProgram) === true,
        poolInfo ? `owner=${poolInfo.owner.toBase58()},expected=${meteoraProgram.toBase58()}` : 'pool_account_missing',
      )
      const poolMints = await getTokensMintFromPoolAddress(connection, poolKey.toBase58())
      pool = { address: poolKey.toBase58(), tokenXMint: poolMints.tokenXMint.toBase58(), tokenYMint: poolMints.tokenYMint.toBase58() }
      const aligned = new Set([pool.tokenXMint, pool.tokenYMint]).size === 2 && new Set([pool.tokenXMint, pool.tokenYMint]).has(mint.toBase58()) && new Set([pool.tokenXMint, pool.tokenYMint]).has(quoteMint.toBase58())
      add(checks, 'meteora_pool_mint_alignment', aligned, `token_x=${pool.tokenXMint},token_y=${pool.tokenYMint},expected_share=${mint.toBase58()},expected_quote=${quoteMint.toBase58()}`)
    } catch (error) {
      add(checks, 'meteora_pool_mint_alignment', false, error instanceof Error ? error.message : String(error))
    }
  }

  return {
    ok: checks.length > 0 && checks.every((check) => check.passed),
    rpc,
    commitment: 'finalized',
    mint: mint.toBase58(),
    pdas: { ...pdas, extraAccountMetaList: extraAccountMetaList.toBase58() },
    pool,
    meteoraTokenBadge: { address: meteoraTokenBadge.toBase58(), programId: meteoraProgram.toBase58() },
    checks,
  }
}

async function main(): Promise<void> {
  const result = await readSolanaB2OnchainPreflight()
  process.stdout.write(`${JSON.stringify({ ...result, rpc: result.rpc ? new URL(result.rpc).origin : '' }, null, 2)}\n`)
  if (!result.ok) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
