import { createRequire } from 'node:module'
import { Connection, PublicKey } from '@solana/web3.js'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { EndpointProgram } from '@layerzerolabs/lz-solana-sdk-v2'
import {
  getMint,
  getTransferFeeConfig,
  getTransferHook,
  TOKEN_2022_PROGRAM_ID as TOKEN_2022_PROGRAM_KEY,
} from '@solana/spl-token'

import { CREATOR_SHARE_HOOK_PROGRAM_ID, deriveCreatorShareHookPdas } from './creatorShareHookPdas.js'
import { resolveServerBaseRpcUrl } from './baseRpcUrl.js'
import { decodeLotteryOappPeer, decodeLotteryOappStoreEndpointProgram, decodeLotteryOappStoreOperator, deriveLotteryOappPdas } from './solanaLotteryOappClient.js'
import { CANONICAL_LOTTERY_MANAGER, SOLANA_LZ_EID } from './solanaLotteryLzTransport.js'
import { auditPendingEntriesBuffer } from './solanaPendingEntriesBuffer.js'
import { hasExactCreatorConfigAmmProgram } from './solanaCreatorConfig.js'
import { decodeMeteoraTokenBadge } from './solanaMeteoraTokenBadge.js'
import { validateRegistry4626ShareOftBinding } from './registry4626Verification.js'
import { readSolanaHookStatusByCreatorToken } from './solanaHookStatus.js'
import { readSolanaMeteoraPoolStatusByShareMeshMint } from './solanaMeteoraPoolStatus.js'
import {
  listSolanaShareMeshMappingsForCreator,
  type SolanaShareMeshMapping,
} from './solanaShareMeshMappings.js'

const require = createRequire(import.meta.url)
const { getTokensMintFromPoolAddress } = require('@meteora-ag/dlmm') as {
  getTokensMintFromPoolAddress: (
    connection: Connection,
    poolAddress: string,
  ) => Promise<{ tokenXMint: PublicKey; tokenYMint: PublicKey }>
}

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
const DEFAULT_METEORA_DLMM_PROGRAM_ID = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'
const SOLANA_NATIVE_MINT = 'So11111111111111111111111111111111111111112'
const CREATOR_CONFIG_ACCOUNT_LEN = 501
const PENDING_ENTRIES_ACCOUNT_LEN = 12_352
const WINNER_RECORD_ACCOUNT_LEN = 89
const EXTRA_ACCOUNT_META_LIST_ACCOUNT_LEN = 86
const CREATOR_CONFIG_DATA_OFFSETS = {
  creatorMint: 8,
  keeperAuthority: 72,
  hubCreatorCoin: 104,
  hubShareOft: 136,
  feeBps: 168,
  lotteryEnabled: 178,
} as const

function evmAddressToBytes32(value: string): Buffer | null {
  const normalized = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return null
  const bytes = Buffer.alloc(32)
  Buffer.from(normalized.slice(2), 'hex').copy(bytes, 12)
  return bytes
}

export function isExpectedHookMintProgramOwner(owner: string): boolean {
  return owner === TOKEN_2022_PROGRAM_ID
}

export function isMeteoraPoolMintAligned(params: {
  tokenXMint: string
  tokenYMint: string
  shareMeshMint: string
  quoteMint: string
}): boolean {
  const actual = new Set([params.tokenXMint, params.tokenYMint])
  return actual.size === 2 && actual.has(params.shareMeshMint) && actual.has(params.quoteMint)
}

export type B2ReadinessCheck = {
  id: string
  passed: boolean
  detail: string
}

export type B2ReadinessResult = {
  ready: boolean
  creatorToken: string
  shareOft: string
  shareMeshMint: string
  checks: B2ReadinessCheck[]
}

function pickMapping(rows: SolanaShareMeshMapping[]): SolanaShareMeshMapping | null {
  return (
    rows.find((row) => row.status === 'applied') ??
    rows.find((row) => row.status === 'pending') ??
    rows[0] ??
    null
  )
}

async function checkOnChainAccounts(params: {
  creatorToken: string
  shareOft: string
  shareMeshMint: string
  pendingEntriesPda: string | null
  poolAddress: string | null
  quoteMint: string | null
}): Promise<B2ReadinessCheck[]> {
  const rpcUrl = String(process.env.SOLANA_RPC_URL ?? '').trim()
  if (!rpcUrl) {
    return [
      {
        id: 'onchain_accounts',
        passed: false,
        detail: 'failed_no_solana_rpc_url',
      },
    ]
  }

  const connection = new Connection(rpcUrl, 'finalized')
  const checks: B2ReadinessCheck[] = []

  // The token_badge is an admin approval for the exact Token-2022 mint. It
  // must remain a finalized, independently readable gate after pool creation;
  // pool existence or mint alignment alone is not sufficient evidence.
  let meteoraProgram: PublicKey | null = null
  try {
    meteoraProgram = new PublicKey(
      String(process.env.SOLANA_METEORA_DLMM_PROGRAM_ID ?? '').trim() || DEFAULT_METEORA_DLMM_PROGRAM_ID,
    )
    const tokenBadge = PublicKey.findProgramAddressSync(
      [Buffer.from('token_badge'), new PublicKey(params.shareMeshMint).toBuffer()],
      meteoraProgram,
    )[0]
    const tokenBadgeInfo = await connection.getAccountInfo(tokenBadge, 'finalized')
    const decoded = tokenBadgeInfo
      ? decodeMeteoraTokenBadge(tokenBadgeInfo.data, new PublicKey(params.shareMeshMint))
      : { valid: false, reason: 'missing' }
    checks.push({
      id: 'meteora_token_badge',
      passed: Boolean(tokenBadgeInfo?.owner.equals(meteoraProgram!)) && decoded.valid,
      detail: tokenBadgeInfo
        ? `pda=${tokenBadge.toBase58()},owner=${tokenBadgeInfo.owner.toBase58()},${decoded.reason}`
        : `pda=${tokenBadge.toBase58()},missing`,
    })
  } catch (error) {
    checks.push({
      id: 'meteora_token_badge',
      passed: false,
      detail: error instanceof Error ? error.message : 'meteora_token_badge_lookup_failed',
    })
  }

  const oappProgramRaw = String(process.env.SOLANA_LOTTERY_OAPP_PROGRAM_ID ?? '').trim()
  if (!oappProgramRaw) {
    checks.push({ id: 'oapp_solana_peer_authorized', passed: false, detail: 'missing_solana_lottery_oapp_program_id' })
    checks.push({ id: 'oapp_base_peer_authorized', passed: false, detail: 'missing_solana_lottery_oapp_program_id' })
  } else {
    try {
      const oappProgram = new PublicKey(oappProgramRaw)
      const { store, peer } = deriveLotteryOappPdas(oappProgram)
      const [programInfo, storeInfo, peerInfo] = await connection.getMultipleAccountsInfo(
        [oappProgram, store, peer],
        'finalized',
      )
      if (!programInfo?.executable) throw new Error('oapp_program_not_executable')
      if (!storeInfo?.owner.equals(oappProgram)) throw new Error('oapp_store_missing_or_wrong_owner')
      if (!peerInfo?.owner.equals(oappProgram)) throw new Error('oapp_peer_missing_or_wrong_owner')
      const configuredOperator = String(process.env.SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY ?? '').trim()
      const onchainOperator = decodeLotteryOappStoreOperator(storeInfo.data).toBase58()
      const onchainEndpointProgram = decodeLotteryOappStoreEndpointProgram(storeInfo.data)
      checks.push({
        id: 'oapp_endpoint_program_authorized',
        passed: onchainEndpointProgram.equals(EndpointProgram.PROGRAM_ID),
        detail: `onchain_endpoint=${onchainEndpointProgram.toBase58()},expected_endpoint=${EndpointProgram.PROGRAM_ID.toBase58()}`,
      })
      checks.push({
        id: 'oapp_operator_authorized',
        passed: Boolean(configuredOperator) && onchainOperator === configuredOperator,
        detail: `onchain_operator=${onchainOperator},configured_operator=${configuredOperator || 'missing'}`,
      })
      const expectedBasePeer = `0x${CANONICAL_LOTTERY_MANAGER.slice(2).padStart(64, '0')}`.toLowerCase()
      const actualBasePeer = decodeLotteryOappPeer(peerInfo.data).toLowerCase()
      checks.push({
        id: 'oapp_solana_peer_authorized',
        passed: actualBasePeer === expectedBasePeer,
        detail: `store=${store.toBase58()},peer=${actualBasePeer},expected=${expectedBasePeer}`,
      })

      const storeBytes32 = `0x${store.toBuffer().toString('hex')}` as `0x${string}`
      const baseClient = createPublicClient({ chain: base, transport: http(resolveServerBaseRpcUrl()) })
      const authorized = await baseClient.readContract({
        address: CANONICAL_LOTTERY_MANAGER,
        abi: [{
          type: 'function', name: 'authorizedRemoteOFTs', stateMutability: 'view',
          inputs: [{ name: '', type: 'uint32' }, { name: '', type: 'bytes32' }],
          outputs: [{ name: '', type: 'bool' }],
        }] as const,
        functionName: 'authorizedRemoteOFTs',
        args: [SOLANA_LZ_EID, storeBytes32],
      })
      checks.push({
        id: 'oapp_base_peer_authorized',
        passed: authorized === true,
        detail: `src_eid=${SOLANA_LZ_EID},origin=${storeBytes32},authorized=${authorized}`,
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'oapp_peer_check_failed'
      checks.push({ id: 'oapp_operator_authorized', passed: false, detail })
      checks.push({ id: 'oapp_endpoint_program_authorized', passed: false, detail })
      checks.push({ id: 'oapp_solana_peer_authorized', passed: false, detail })
      checks.push({ id: 'oapp_base_peer_authorized', passed: false, detail })
    }
  }

  if (params.poolAddress) {
    try {
      const poolInfo = await connection.getAccountInfo(new PublicKey(params.poolAddress))
      const poolMeteoraProgram = meteoraProgram ?? new PublicKey(
        String(process.env.SOLANA_METEORA_DLMM_PROGRAM_ID ?? '').trim() || DEFAULT_METEORA_DLMM_PROGRAM_ID,
      )
      checks.push({
        id: 'pool_account_onchain',
        passed: Boolean(poolInfo?.data?.length),
        detail: poolInfo?.data?.length ? 'pool_account_exists' : 'pool_account_missing',
      })
      checks.push({
        id: 'meteora_pool_program_owner',
        passed: poolInfo?.owner.equals(poolMeteoraProgram) === true,
        detail: poolInfo
          ? `owner=${poolInfo.owner.toBase58()},expected=${poolMeteoraProgram.toBase58()}`
          : 'pool_account_missing',
      })
      if (!params.quoteMint) {
        checks.push({ id: 'meteora_pool_mint_alignment', passed: false, detail: 'pool_quote_mint_missing' })
      } else {
        const poolMints = await getTokensMintFromPoolAddress(connection as any, params.poolAddress)
        const tokenXMint = poolMints.tokenXMint.toBase58()
        const tokenYMint = poolMints.tokenYMint.toBase58()
        checks.push({
          id: 'meteora_pool_mint_alignment',
          passed: isMeteoraPoolMintAligned({
            tokenXMint,
            tokenYMint,
            shareMeshMint: params.shareMeshMint,
            quoteMint: params.quoteMint,
          }),
          detail: `token_x=${tokenXMint},token_y=${tokenYMint},expected_share=${params.shareMeshMint},expected_quote=${params.quoteMint}`,
        })
      }
    } catch (error) {
      checks.push({
        id: 'pool_account_onchain',
        passed: false,
        detail: error instanceof Error ? error.message : 'pool_account_lookup_failed',
      })
      checks.push({
        id: 'meteora_pool_program_owner',
        passed: false,
        detail: error instanceof Error ? error.message : 'pool_account_lookup_failed',
      })
      checks.push({
        id: 'meteora_pool_mint_alignment',
        passed: false,
        detail: error instanceof Error ? error.message : 'pool_mint_decode_failed',
      })
    }
  }

  const hookPdas = deriveCreatorShareHookPdas(params.shareMeshMint)
  if (!hookPdas) {
    checks.push({ id: 'hook_pdas_onchain', passed: false, detail: 'hook_mint_pda_derivation_failed' })
  } else {
    try {
      const hookProgram = new PublicKey(CREATOR_SHARE_HOOK_PROGRAM_ID)
      const [extraAccountMetaList] = PublicKey.findProgramAddressSync(
        [Buffer.from('extra-account-metas'), new PublicKey(hookPdas.hookMint).toBuffer()],
        hookProgram,
      )
      const addresses = [
        new PublicKey(hookPdas.creatorConfig),
        new PublicKey(hookPdas.pendingEntries),
        new PublicKey(hookPdas.winnerRecord),
        extraAccountMetaList,
      ]
      const accounts = await connection.getMultipleAccountsInfo(addresses, 'finalized')
      const ownerAndSizes = accounts.map((account) =>
        account?.owner.equals(hookProgram) ? account.data.length : 0,
      )
      const [creatorConfigInfo, pendingInfo, winnerRecordInfo, extraMetaInfo] = accounts
      checks.push({
        id: 'hook_pdas_onchain',
        passed: ownerAndSizes.every((size) => size > 0),
        detail: `creator_config=${ownerAndSizes[0]},pending_entries=${ownerAndSizes[1]},winner_record=${ownerAndSizes[2]},extra_meta=${ownerAndSizes[3]}`,
      })
      checks.push({
        id: 'creator_config_onchain',
        passed: ownerAndSizes[0] === CREATOR_CONFIG_ACCOUNT_LEN,
        detail: `owner=${creatorConfigInfo?.owner.toBase58() ?? 'missing'},space=${ownerAndSizes[0]},expected=${CREATOR_CONFIG_ACCOUNT_LEN}`,
      })
      checks.push({
        id: 'pending_entries_onchain',
        passed: ownerAndSizes[1] === PENDING_ENTRIES_ACCOUNT_LEN,
        detail: `owner=${pendingInfo?.owner.toBase58() ?? 'missing'},space=${ownerAndSizes[1]},expected=${PENDING_ENTRIES_ACCOUNT_LEN}`,
      })
      checks.push({
        id: 'winner_record_onchain',
        passed: ownerAndSizes[2] === WINNER_RECORD_ACCOUNT_LEN,
        detail: `owner=${winnerRecordInfo?.owner.toBase58() ?? 'missing'},space=${ownerAndSizes[2]},expected=${WINNER_RECORD_ACCOUNT_LEN}`,
      })
      checks.push({
        id: 'extra_account_meta_onchain',
        passed: ownerAndSizes[3] === EXTRA_ACCOUNT_META_LIST_ACCOUNT_LEN,
        detail: `owner=${extraMetaInfo?.owner.toBase58() ?? 'missing'},space=${ownerAndSizes[3]},expected=${EXTRA_ACCOUNT_META_LIST_ACCOUNT_LEN}`,
      })
      checks.push({
        id: 'pending_entries_pda_matches_derived',
        passed: !params.pendingEntriesPda || params.pendingEntriesPda === hookPdas.pendingEntries,
        detail: `persisted=${params.pendingEntriesPda ?? 'missing'},derived=${hookPdas.pendingEntries}`,
      })
      if (creatorConfigInfo && ownerAndSizes[0] === CREATOR_CONFIG_ACCOUNT_LEN) {
        const configData = creatorConfigInfo.data
        const expectedCreatorCoin = evmAddressToBytes32(params.creatorToken)
        const expectedShareOft = evmAddressToBytes32(params.shareOft)
        checks.push({
          id: 'creator_config_mint_matches',
          passed: configData.subarray(CREATOR_CONFIG_DATA_OFFSETS.creatorMint, 40).equals(new PublicKey(hookPdas.hookMint).toBuffer()),
          detail: `configured_mint=${new PublicKey(configData.subarray(CREATOR_CONFIG_DATA_OFFSETS.creatorMint, 40)).toBase58()},expected_mint=${hookPdas.hookMint}`,
        })
        checks.push({
          id: 'creator_config_hub_mapping_matches',
          passed: Boolean(expectedCreatorCoin && expectedShareOft) &&
            configData.subarray(CREATOR_CONFIG_DATA_OFFSETS.hubCreatorCoin, 136).equals(expectedCreatorCoin!) &&
            configData.subarray(CREATOR_CONFIG_DATA_OFFSETS.hubShareOft, 168).equals(expectedShareOft!),
          detail: `creator_coin=${expectedCreatorCoin ? 'matched-input' : 'invalid-input'},share_oft=${expectedShareOft ? 'matched-input' : 'invalid-input'}`,
        })
        checks.push({
          id: 'creator_config_fee_zero',
          passed: configData.readUInt16LE(CREATOR_CONFIG_DATA_OFFSETS.feeBps) === 0,
          detail: `fee_bps=${configData.readUInt16LE(CREATOR_CONFIG_DATA_OFFSETS.feeBps)}`,
        })
        checks.push({
          id: 'creator_config_lottery_enabled',
          passed: configData[CREATOR_CONFIG_DATA_OFFSETS.lotteryEnabled] === 1,
          detail: `lottery_enabled=${configData[CREATOR_CONFIG_DATA_OFFSETS.lotteryEnabled] === 1}`,
        })
        let expectedMeteoraProgram = DEFAULT_METEORA_DLMM_PROGRAM_ID
        try {
          expectedMeteoraProgram = new PublicKey(
            String(process.env.SOLANA_METEORA_DLMM_PROGRAM_ID ?? '').trim() || DEFAULT_METEORA_DLMM_PROGRAM_ID,
          ).toBase58()
          checks.push({
            id: 'creator_config_amm_allowlist',
            passed: hasExactCreatorConfigAmmProgram(configData, expectedMeteoraProgram),
            detail: `expected_meteora=${expectedMeteoraProgram}`,
          })
        } catch {
          checks.push({
            id: 'creator_config_amm_allowlist',
            passed: false,
            detail: 'invalid_solana_meteora_dlmm_program_id',
          })
        }
        const configuredKeeper = String(process.env.SOLANA_KEEPER_PUBKEY ?? '').trim()
        if (configuredKeeper) {
          checks.push({
            id: 'creator_config_keeper_authorized',
            passed: configData.subarray(CREATOR_CONFIG_DATA_OFFSETS.keeperAuthority, 104).equals(new PublicKey(configuredKeeper).toBuffer()),
            detail: `configured_keeper=${configuredKeeper}`,
          })
        }
      } else {
        checks.push({ id: 'creator_config_mint_matches', passed: false, detail: 'creator_config_account_missing' })
        checks.push({ id: 'creator_config_hub_mapping_matches', passed: false, detail: 'creator_config_account_missing' })
        checks.push({ id: 'creator_config_fee_zero', passed: false, detail: 'creator_config_account_missing' })
        checks.push({ id: 'creator_config_lottery_enabled', passed: false, detail: 'creator_config_account_missing' })
        checks.push({ id: 'creator_config_amm_allowlist', passed: false, detail: 'creator_config_account_missing' })
      }
      if (ownerAndSizes[1] === PENDING_ENTRIES_ACCOUNT_LEN && pendingInfo) {
        const finalizedSlot = BigInt(await connection.getSlot('finalized'))
        const audit = auditPendingEntriesBuffer({
          data: pendingInfo.data,
          expectedCreatorMint: params.shareMeshMint,
          finalizedSlot,
        })
        checks.push({
          id: 'pending_entries_buffer_reconciled',
          passed: audit.status === 'healthy',
          detail: `status=${audit.status},count=${audit.count ?? 'unknown'},overflow=${audit.overflowCount?.toString() ?? 'unknown'}${audit.reason ? `,reason=${audit.reason}` : ''}`,
        })
      } else {
        checks.push({ id: 'pending_entries_buffer_reconciled', passed: false, detail: 'pending_entries_account_missing' })
      }
    } catch (error) {
      checks.push({
        id: 'hook_pdas_onchain',
        passed: false,
        detail: error instanceof Error ? error.message : 'hook_pda_lookup_failed',
      })
      checks.push({
        id: 'pending_entries_onchain',
        passed: false,
        detail: error instanceof Error ? error.message : 'pending_entries_lookup_failed',
      })
      checks.push({ id: 'creator_config_onchain', passed: false, detail: 'hook_pda_lookup_failed' })
      checks.push({ id: 'winner_record_onchain', passed: false, detail: 'hook_pda_lookup_failed' })
      checks.push({ id: 'extra_account_meta_onchain', passed: false, detail: 'hook_pda_lookup_failed' })
      checks.push({ id: 'pending_entries_pda_matches_derived', passed: false, detail: 'hook_pda_lookup_failed' })
      checks.push({ id: 'creator_config_mint_matches', passed: false, detail: 'hook_pda_lookup_failed' })
      checks.push({ id: 'creator_config_hub_mapping_matches', passed: false, detail: 'hook_pda_lookup_failed' })
      checks.push({ id: 'creator_config_fee_zero', passed: false, detail: 'hook_pda_lookup_failed' })
      checks.push({ id: 'creator_config_lottery_enabled', passed: false, detail: 'hook_pda_lookup_failed' })
      checks.push({ id: 'creator_config_amm_allowlist', passed: false, detail: 'hook_pda_lookup_failed' })
      checks.push({ id: 'pending_entries_buffer_reconciled', passed: false, detail: 'hook_pda_lookup_failed' })
    }
  }

  try {
    const mintKey = new PublicKey(params.shareMeshMint)
    const mintInfo = await connection.getAccountInfo(mintKey)
    const owner = mintInfo?.owner?.toBase58() ?? ''
    checks.push({
      id: 'hook_mint_program_owner',
      passed: isExpectedHookMintProgramOwner(owner),
      detail: owner ? `mint_owner=${owner},expected_token_program=${TOKEN_2022_PROGRAM_ID}` : 'mint_account_missing',
    })

    const mint = await getMint(connection, mintKey, 'finalized', TOKEN_2022_PROGRAM_KEY)
    const hook = getTransferHook(mint)
    checks.push({
      id: 'transfer_hook_program',
      passed: hook?.programId.toBase58() === CREATOR_SHARE_HOOK_PROGRAM_ID,
      detail: hook ? `transfer_hook_program=${hook.programId.toBase58()}` : 'transfer_hook_missing',
    })
    const fees = getTransferFeeConfig(mint)
    const zeroFees = Boolean(fees) &&
      fees!.olderTransferFee.transferFeeBasisPoints === 0 &&
      fees!.newerTransferFee.transferFeeBasisPoints === 0
    checks.push({
      id: 'transfer_fee_zero',
      passed: zeroFees,
      detail: fees
        ? `older_bps=${fees.olderTransferFee.transferFeeBasisPoints},newer_bps=${fees.newerTransferFee.transferFeeBasisPoints}`
        : 'transfer_fee_config_missing',
    })

    const oftProgramRaw = String(process.env.SOLANA_OFT_PROGRAM_ID ?? '').trim()
    const mintAuthority = mint.mintAuthority
    if (!oftProgramRaw || !mintAuthority) {
      checks.push({
        id: 'oft_store_mint_authority',
        passed: false,
        detail: !oftProgramRaw ? 'missing_solana_oft_program_id' : 'mint_authority_missing',
      })
    } else {
      const oftProgram = new PublicKey(oftProgramRaw)
      const authorityInfo = await connection.getAccountInfo(mintAuthority)
      checks.push({
        id: 'oft_store_mint_authority',
        passed: authorityInfo?.owner.equals(oftProgram) === true,
        detail: authorityInfo
          ? `mint_authority=${mintAuthority.toBase58()},authority_owner=${authorityInfo.owner.toBase58()}`
          : 'mint_authority_account_missing',
      })
    }
  } catch (error) {
    checks.push({
      id: 'hook_mint_extensions',
      passed: false,
      detail: error instanceof Error ? error.message : 'hook_mint_verification_failed',
    })
  }

  return checks
}

export async function verifySolanaB2Readiness(params: {
  db: Db
  creatorToken: string
  shareMeshMint?: string | null
}): Promise<B2ReadinessResult> {
  const creatorToken = params.creatorToken.trim().toLowerCase()
  const mappings = await listSolanaShareMeshMappingsForCreator({
    db: params.db,
    creatorToken,
  })
  const mapping = pickMapping(mappings)
  const shareMeshMint =
    (typeof params.shareMeshMint === 'string' ? params.shareMeshMint.trim() : '') ||
    mapping?.shareMeshMint ||
    ''
  const shareOft = mapping?.shareOft ?? ''

  const checks: B2ReadinessCheck[] = []

  if (mapping) {
    const requestedMint = typeof params.shareMeshMint === 'string' && params.shareMeshMint.trim()
      ? params.shareMeshMint.trim()
      : mapping.shareMeshMint
    checks.push({
      id: 'share_mesh_mint_matches_mapping',
      passed: requestedMint === mapping.shareMeshMint,
      detail: requestedMint === mapping.shareMeshMint
        ? 'requested_share_mesh_mint_matches_mapping'
        : `requested=${requestedMint},mapping=${mapping.shareMeshMint}`,
    })
  }

  if (!mapping) {
    checks.push({
      id: 'share_mesh_mapping',
      passed: false,
      detail: 'no_share_mesh_mapping',
    })
  } else {
    checks.push({
      id: 'share_mesh_mapping',
      passed: mapping.status === 'applied',
      detail: `mapping_status=${mapping.status}`,
    })
  }

  if (mapping?.status === 'applied') {
    try {
      const registryBinding = await validateRegistry4626ShareOftBinding({
        creatorToken,
        shareOft: mapping.shareOft,
      })
      checks.push({
        id: 'registry_share_oft_matches',
        passed: registryBinding.ok,
        detail: registryBinding.ok ? 'registry_share_oft_matches' : registryBinding.reason,
      })
    } catch (error) {
      checks.push({
        id: 'registry_share_oft_matches',
        passed: false,
        detail: error instanceof Error ? error.message : 'registry_4626_unreachable',
      })
    }
  } else {
    checks.push({
      id: 'registry_share_oft_matches',
      passed: false,
      detail: 'applied_mapping_required',
    })
  }

  if (!shareMeshMint) {
    checks.push({
      id: 'share_mesh_mint',
      passed: false,
      detail: 'share_mesh_mint_missing',
    })
  }

  const pool = shareMeshMint
    ? await readSolanaMeteoraPoolStatusByShareMeshMint({
      db: params.db,
      shareMeshMint,
      quoteMint: String(process.env.SOLANA_METEORA_POOL_QUOTE_MINT ?? '').trim() || SOLANA_NATIVE_MINT,
    })
    : null
  checks.push({
    id: 'meteora_pool_created',
    passed: pool?.status === 'created' && Boolean(pool.poolAddress),
    detail: pool
      ? `pool_status=${pool.status}${pool.poolAddress ? '' : ',pool_address_missing'}`
      : 'pool_status_not_started',
  })

  const hook = await readSolanaHookStatusByCreatorToken({ db: params.db, creatorToken })
  checks.push({
    id: 'hook_lane_created',
    passed:
      hook?.status === 'created' &&
      Boolean(hook.hookMint) &&
      Boolean(hook.creatorConfig) &&
      Boolean(hook.pendingEntries) &&
      Boolean(hook.winnerRecord),
    detail: hook ? `hook_status=${hook.status}` : 'hook_status_not_started',
  })

  if (hook?.hookMint && shareMeshMint && hook.hookMint !== shareMeshMint) {
    checks.push({
      id: 'hook_mint_matches_share_mesh',
      passed: false,
      detail: `hook_mint=${hook.hookMint},share_mesh_mint=${shareMeshMint}`,
    })
  } else if (hook?.hookMint && shareMeshMint) {
    checks.push({
      id: 'hook_mint_matches_share_mesh',
      passed: true,
      detail: 'hook_mint_matches_share_mesh_mint',
    })
  }

  if (shareOft) {
    if (!hook?.shareOft) {
      checks.push({
        id: 'hook_share_oft_matches_mapping',
        passed: false,
        detail: 'hook_share_oft_missing',
      })
    } else {
      const matches = hook.shareOft.toLowerCase() === shareOft.toLowerCase()
      checks.push({
        id: 'hook_share_oft_matches_mapping',
        passed: matches,
        detail: matches
          ? 'hook_share_oft_matches_mapping'
          : `hook_share_oft=${hook.shareOft},mapping_share_oft=${shareOft}`,
      })
    }
  }

  const onChainChecks = await checkOnChainAccounts({
    creatorToken,
    shareOft,
    shareMeshMint,
    pendingEntriesPda: hook?.pendingEntries ?? null,
    poolAddress: pool?.poolAddress ?? null,
    quoteMint: pool?.quoteMint ?? null,
  })
  checks.push(...onChainChecks)

  const ready = checks.every((check) => check.passed)

  return {
    ready,
    creatorToken,
    shareOft,
    shareMeshMint,
    checks,
  }
}
