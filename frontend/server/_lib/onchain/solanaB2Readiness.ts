import { Connection, PublicKey } from '@solana/web3.js'

import { deriveCreatorShareHookPdas } from './creatorShareHookPdas.js'
import { validateRegistry4626ShareOftBinding } from './registry4626Verification.js'
import { readSolanaHookStatusByCreatorToken } from './solanaHookStatus.js'
import { readSolanaMeteoraPoolStatusByShareMeshMint } from './solanaMeteoraPoolStatus.js'
import {
  listSolanaShareMeshMappingsForCreator,
  type SolanaShareMeshMapping,
} from './solanaShareMeshMappings.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'

export function isExpectedHookMintProgramOwner(owner: string): boolean {
  return owner === TOKEN_2022_PROGRAM_ID
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

function envFlag(name: string, fallback = false): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
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
  shareMeshMint: string
  pendingEntriesPda: string | null
  poolAddress: string | null
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

  if (params.poolAddress) {
    try {
      const poolInfo = await connection.getAccountInfo(new PublicKey(params.poolAddress))
      checks.push({
        id: 'pool_account_onchain',
        passed: Boolean(poolInfo?.data?.length),
        detail: poolInfo?.data?.length ? 'pool_account_exists' : 'pool_account_missing',
      })
    } catch (error) {
      checks.push({
        id: 'pool_account_onchain',
        passed: false,
        detail: error instanceof Error ? error.message : 'pool_account_lookup_failed',
      })
    }
  }

  const pendingEntries =
    params.pendingEntriesPda ??
    deriveCreatorShareHookPdas(params.shareMeshMint)?.pendingEntries ??
    null
  if (pendingEntries) {
    try {
      const pendingInfo = await connection.getAccountInfo(new PublicKey(pendingEntries))
      checks.push({
        id: 'pending_entries_onchain',
        passed: Boolean(pendingInfo?.data?.length),
        detail: pendingInfo?.data?.length ? 'pending_entries_account_exists' : 'pending_entries_account_missing',
      })
    } catch (error) {
      checks.push({
        id: 'pending_entries_onchain',
        passed: false,
        detail: error instanceof Error ? error.message : 'pending_entries_lookup_failed',
      })
    }
  }

  if (envFlag('SOLANA_B2_REQUIRE_HOOK_PROGRAM_OWNER', false)) {
    try {
      const mintInfo = await connection.getAccountInfo(new PublicKey(params.shareMeshMint))
      const owner = mintInfo?.owner?.toBase58() ?? ''
      checks.push({
        id: 'hook_mint_program_owner',
        passed: isExpectedHookMintProgramOwner(owner),
        detail: owner
          ? `mint_owner=${owner},expected_token_program=${TOKEN_2022_PROGRAM_ID}`
          : 'mint_account_missing',
      })
    } catch (error) {
      checks.push({
        id: 'hook_mint_program_owner',
        passed: false,
        detail: error instanceof Error ? error.message : 'mint_owner_lookup_failed',
      })
    }
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
    ? await readSolanaMeteoraPoolStatusByShareMeshMint({ db: params.db, shareMeshMint })
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
      Boolean(hook.pendingEntries),
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

  if (hook?.shareOft && shareOft) {
    checks.push({
      id: 'hook_share_oft_matches_mapping',
      passed: hook.shareOft.toLowerCase() === shareOft.toLowerCase(),
      detail: hook.shareOft.toLowerCase() === shareOft.toLowerCase()
        ? 'hook_share_oft_matches_mapping'
        : `hook_share_oft=${hook.shareOft},mapping_share_oft=${shareOft}`,
    })
  }

  const onChainChecks = await checkOnChainAccounts({
    shareMeshMint,
    pendingEntriesPda: hook?.pendingEntries ?? null,
    poolAddress: pool?.poolAddress ?? null,
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
