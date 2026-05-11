#!/usr/bin/env node

import Safe from '@safe-global/protocol-kit'
import SafeApiKit from '@safe-global/api-kit'
import { OperationType } from '@safe-global/types-kit'
import { encodeFunctionData, getAddress, isAddress, type Address } from 'viem'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

type ApiEnvelope<T> = {
  success: boolean
  data?: T
  error?: string
}

type ActiveVaultRow = {
  vaultAddress: string
  chainId: number
  automation?: {
    automationEnabled?: boolean
    canonicalCswAddress?: string | null
  }
}

type VaultReportContext = {
  vault?: string
  owner?: string
  ajnaAuthAddress?: string | null
  ajnaAuthAdmin?: string | null
}

type VaultReportResponse = ApiEnvelope<{ context?: VaultReportContext }>

type ActiveVaultsResponse = ApiEnvelope<{ vaults: ActiveVaultRow[]; count: number }>

type MigrationCandidate = {
  vaultAddress: Address
  deployOwner: Address | null
  canonicalCswAddress: Address
  ajnaAuthAddress: Address
  ajnaAuthAdmin: Address | null
}

const AJNA_AUTH_ADMIN_ABI = [
  {
    type: 'function',
    name: 'setAdmin',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'nextAdmin', type: 'address' }],
    outputs: [],
  },
] as const

function usage(): void {
  process.stdout.write(`Usage:
  pnpm -C frontend exec tsx scripts/ops/ajna-admin-backfill-safe.ts [options]

Options:
  --origin <url>             App origin (default: APP_ORIGIN or https://4626.fun)
  --chain-id <id>            Chain id for active vault query and Safe API (default: 8453)
  --vault <address>          Single-vault mode (only process this vault)
  --only-enabled             Only include automationEnabled=true vault rows
  --max <n>                  Limit number of active vault rows processed
  --propose                  Propose Safe transactions (default: dry-run only)
  --safe-address <address>   Safe address used for proposal mode (or SAFE_ADDRESS env)
  --safe-owner-pk <hex>      Safe owner private key for signing proposals
  --safe-service-url <url>   Safe Transaction Service URL (default: Base service)
  --safe-api-key <key>       Safe API key (default: SAFE_API_KEY env)
  --rpc <url>                RPC URL used by protocol-kit signer client
  --help                     Show this help

Required env:
  KEEPR_API_KEY              Bearer token for /api/vaults/active

Example (dry-run):
  pnpm -C frontend exec tsx scripts/ops/ajna-admin-backfill-safe.ts --origin https://4626.fun --only-enabled

Example (single vault propose):
  pnpm -C frontend exec tsx scripts/ops/ajna-admin-backfill-safe.ts \\
    --vault 0x... --propose --safe-address 0x... --safe-owner-pk 0x...
`)
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function asPositiveInt(raw: string, fallback: number): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

function normalizeAddress(value: unknown): Address | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!isAddress(raw)) return null
  return getAddress(raw) as Address
}

function requireEnv(key: string): string {
  const value = String(process.env[key] ?? '').trim()
  if (!value) throw new Error(`${key} is required`)
  return value
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const text = await response.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`Invalid JSON response from ${url}`)
  }
  if (!response.ok) {
    const errorMessage =
      typeof payload === 'object' && payload && 'error' in payload && typeof (payload as any).error === 'string'
        ? (payload as any).error
        : `${response.status} ${response.statusText}`
    throw new Error(`HTTP ${response.status} for ${url}: ${errorMessage}`)
  }
  return payload as T
}

async function fetchActiveVaultRows(params: {
  origin: string
  chainId: number
  keeprApiKey: string
}): Promise<ActiveVaultRow[]> {
  const url = new URL('/api/vaults/active', params.origin)
  url.searchParams.set('chainId', String(params.chainId))
  url.searchParams.set('settled', 'false')
  const payload = await fetchJson<ActiveVaultsResponse>(String(url), {
    method: 'GET',
    headers: {
      authorization: `Bearer ${params.keeprApiKey}`,
      accept: 'application/json',
    },
  })
  if (!payload.success || !Array.isArray(payload.data?.vaults)) {
    throw new Error(payload.error || 'Failed to load active vault rows')
  }
  return payload.data.vaults
}

async function fetchVaultReportContext(params: {
  origin: string
  vaultAddress: Address
}): Promise<VaultReportContext | null> {
  const url = new URL('/api/v1/vault/report', params.origin)
  url.searchParams.set('vault', params.vaultAddress)
  const payload = await fetchJson<VaultReportResponse>(String(url), {
    method: 'GET',
    headers: { accept: 'application/json' },
  })
  if (!payload.success) return null
  return payload.data?.context ?? null
}

async function collectMigrationCandidates(params: {
  origin: string
  chainId: number
  keeprApiKey: string
  vaultFilter: Address | null
  onlyEnabled: boolean
  maxRows: number
}): Promise<{
  processed: number
  skipped: number
  skippedReasons: Record<string, number>
  candidates: MigrationCandidate[]
}> {
  const activeRows = await fetchActiveVaultRows({
    origin: params.origin,
    chainId: params.chainId,
    keeprApiKey: params.keeprApiKey,
  })

  const skippedReasons: Record<string, number> = {}
  const addSkipped = (reason: string) => {
    skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1
  }

  const scoped = activeRows.filter((row) => {
    const vaultAddress = normalizeAddress(row.vaultAddress)
    if (!vaultAddress) return false
    if (!params.vaultFilter) return true
    return vaultAddress.toLowerCase() === params.vaultFilter.toLowerCase()
  })

  const limited = params.maxRows > 0 ? scoped.slice(0, params.maxRows) : scoped
  const candidates: MigrationCandidate[] = []

  for (const row of limited) {
    const vaultAddress = normalizeAddress(row.vaultAddress)
    if (!vaultAddress) {
      addSkipped('invalid_vault_address')
      continue
    }

    const canonicalCswAddress = normalizeAddress(row.automation?.canonicalCswAddress)
    if (!canonicalCswAddress) {
      addSkipped('missing_canonical_csw')
      continue
    }
    if (params.onlyEnabled && row.automation?.automationEnabled !== true) {
      addSkipped('automation_not_enabled')
      continue
    }

    let context: VaultReportContext | null = null
    try {
      context = await fetchVaultReportContext({ origin: params.origin, vaultAddress })
    } catch {
      addSkipped('vault_report_fetch_failed')
      continue
    }
    if (!context) {
      addSkipped('vault_report_unavailable')
      continue
    }

    const ajnaAuthAddress = normalizeAddress(context.ajnaAuthAddress)
    if (!ajnaAuthAddress) {
      addSkipped('no_ajna_auth_address')
      continue
    }
    const ajnaAuthAdmin = normalizeAddress(context.ajnaAuthAdmin)
    if (ajnaAuthAdmin && ajnaAuthAdmin.toLowerCase() === canonicalCswAddress.toLowerCase()) {
      addSkipped('already_aligned')
      continue
    }

    candidates.push({
      vaultAddress,
      deployOwner: normalizeAddress(context.owner),
      canonicalCswAddress,
      ajnaAuthAddress,
      ajnaAuthAdmin,
    })
  }

  const skipped = Object.values(skippedReasons).reduce((sum, count) => sum + count, 0)
  return {
    processed: limited.length,
    skipped,
    skippedReasons,
    candidates,
  }
}

function buildSetAdminCalldata(nextAdmin: Address): `0x${string}` {
  return encodeFunctionData({
    abi: AJNA_AUTH_ADMIN_ABI,
    functionName: 'setAdmin',
    args: [nextAdmin],
  })
}

async function proposeSafeTransactions(params: {
  chainId: bigint
  rpcUrl: string
  safeAddress: Address
  safeOwnerPrivateKey: string
  safeServiceUrl: string
  safeApiKey: string
  candidates: MigrationCandidate[]
}): Promise<Array<{ vaultAddress: Address; safeTxHash: string; nonce: number }>> {
  const protocolKit = await Safe.init({
    provider: params.rpcUrl,
    signer: params.safeOwnerPrivateKey,
    safeAddress: params.safeAddress,
  })
  const signerAddressRaw = await protocolKit.getSafeProvider().getSignerAddress()
  const signerAddress = normalizeAddress(signerAddressRaw)
  if (!signerAddress) throw new Error('Unable to resolve signer address for Safe proposal')

  const apiKit = new SafeApiKit({
    chainId: params.chainId,
    txServiceUrl: params.safeServiceUrl,
    apiKey: params.safeApiKey || undefined,
  })

  const nextNonceRaw = await apiKit.getNextNonce(params.safeAddress)
  const baseNonce = Number(nextNonceRaw)
  if (!Number.isFinite(baseNonce) || baseNonce < 0) {
    throw new Error(`Invalid Safe nonce returned by service: ${String(nextNonceRaw)}`)
  }

  const proposed: Array<{ vaultAddress: Address; safeTxHash: string; nonce: number }> = []

  for (let index = 0; index < params.candidates.length; index++) {
    const candidate = params.candidates[index]
    if (!candidate) continue
    const nonce = baseNonce + index
    const txData = {
      to: candidate.ajnaAuthAddress,
      value: '0',
      data: buildSetAdminCalldata(candidate.canonicalCswAddress),
      operation: OperationType.Call,
    }

    const safeTx = await protocolKit.createTransaction({
      transactions: [txData],
      options: { nonce },
    })
    const signedSafeTx = await protocolKit.signTransaction(safeTx)
    const safeTxHash = await protocolKit.getTransactionHash(signedSafeTx)
    const senderSignature =
      (signedSafeTx as any)?.getSignature?.(signerAddress)?.data ??
      (signedSafeTx as any)?.signatures?.get?.(signerAddress.toLowerCase())?.data
    if (!senderSignature) {
      throw new Error(`Missing signer signature for Safe tx ${safeTxHash}`)
    }

    await apiKit.proposeTransaction({
      safeAddress: params.safeAddress,
      safeTransactionData: signedSafeTx.data,
      safeTxHash,
      senderAddress: signerAddress,
      senderSignature,
      origin: `ajna-admin-backfill:${candidate.vaultAddress}`,
    })

    proposed.push({
      vaultAddress: candidate.vaultAddress,
      safeTxHash,
      nonce,
    })
  }

  return proposed
}

async function main() {
  if (hasFlag('--help')) {
    usage()
    return
  }

  const origin = getArg('--origin', process.env.APP_ORIGIN || 'https://4626.fun')
  const chainId = asPositiveInt(getArg('--chain-id', process.env.CHAIN_ID || '8453'), 8453)
  const onlyEnabled = hasFlag('--only-enabled')
  const propose = hasFlag('--propose')
  const vaultFilter = normalizeAddress(getArg('--vault', process.env.VAULT_ADDRESS || ''))
  const maxRows = asPositiveInt(getArg('--max', process.env.MAX_ROWS || '0'), 0)
  const keeprApiKey = requireEnv('KEEPR_API_KEY')

  const collected = await collectMigrationCandidates({
    origin,
    chainId,
    keeprApiKey,
    vaultFilter,
    onlyEnabled,
    maxRows,
  })

  process.stdout.write(
    `Scanned ${collected.processed} vault rows, skipped ${collected.skipped}, mismatches ${collected.candidates.length}\n`,
  )
  if (Object.keys(collected.skippedReasons).length > 0) {
    process.stdout.write(`Skip reasons: ${JSON.stringify(collected.skippedReasons, null, 2)}\n`)
  }

  if (collected.candidates.length > 0) {
    process.stdout.write('Mismatch candidates:\n')
    for (const candidate of collected.candidates) {
      process.stdout.write(
        [
          `- vault=${candidate.vaultAddress}`,
          `auth=${candidate.ajnaAuthAddress}`,
          `admin=${candidate.ajnaAuthAdmin ?? 'null'}`,
          `canonicalCsw=${candidate.canonicalCswAddress}`,
          `deployOwner=${candidate.deployOwner ?? 'null'}`,
        ].join(' '),
      )
      process.stdout.write('\n')
    }
  }

  if (!propose) {
    process.stdout.write('Dry-run complete. Re-run with --propose to submit Safe proposals.\n')
    return
  }

  if (collected.candidates.length === 0) {
    process.stdout.write('No mismatches found. Nothing to propose.\n')
    return
  }

  const safeAddress = normalizeAddress(getArg('--safe-address', process.env.SAFE_ADDRESS || ''))
  if (!safeAddress) throw new Error('Missing --safe-address (or SAFE_ADDRESS env)')
  const safeOwnerPrivateKey = getArg(
    '--safe-owner-pk',
    process.env.SAFE_OWNER_PRIVATE_KEY || process.env.SAFE_OWNER_PK || '',
  )
  if (!safeOwnerPrivateKey) throw new Error('Missing --safe-owner-pk (or SAFE_OWNER_PRIVATE_KEY env)')
  const rpcUrl = getArg('--rpc', process.env.BASE_RPC_URL || 'https://mainnet.base.org')
  const safeServiceUrl = getArg(
    '--safe-service-url',
    process.env.SAFE_TX_SERVICE_URL || 'https://api.safe.global/tx-service/base',
  )
  const safeApiKey = getArg('--safe-api-key', process.env.SAFE_API_KEY || '')

  const proposed = await proposeSafeTransactions({
    chainId: BigInt(chainId),
    rpcUrl,
    safeAddress,
    safeOwnerPrivateKey,
    safeServiceUrl,
    safeApiKey,
    candidates: collected.candidates,
  })

  process.stdout.write(`Proposed ${proposed.length} Safe transaction(s):\n`)
  for (const item of proposed) {
    process.stdout.write(`- vault=${item.vaultAddress} nonce=${item.nonce} safeTxHash=${item.safeTxHash}\n`)
  }
}

main().catch((error) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
