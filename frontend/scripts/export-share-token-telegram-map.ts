#!/usr/bin/env node

import { writeFile } from 'node:fs/promises'
import { erc20Abi, http, isAddress, parseAbiItem, type Address, type PublicClient } from 'viem'
import { base } from 'viem/chains'
import { createPublicClient } from 'viem'

import { getKeeprBaseRpcUrls } from '../server/_lib/keeprGating.js'
import { getDb, isDbConfigured } from '../server/_lib/db/postgres.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

type HolderBalance = {
  address: Address
  balance: bigint
}

type TelegramLinkRow = {
  telegramUserId: string
  telegramUsername: string | null
  profileId: number
  privyUserId: string
  canonicalCswAddress: Address
  ownerVerified: boolean
  linkStatus: string
  revokedAt: string | null
}

const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function usage(): void {
  process.stdout.write(`Usage:
  pnpm -C frontend holders:telegram-map -- --share-token <0x...> --from-block <n> [options]
  pnpm -C frontend holders:telegram-map -- --vault-address <0x...> --from-block <n> [options]
  pnpm -C frontend exec tsx scripts/export-share-token-telegram-map.ts --share-token <0x...> --from-block <n> [options]

Required:
  --from-block <number>       Start block for Transfer scan
  One of:
    --share-token <address>   ERC20 share token address on Base
    --vault-address <address> Resolve share token from keepr_vaults

Options:
  --to-block <number|latest>  End block (default: latest)
  --chunk-size <number>       Blocks per getLogs call (default: 5000)
  --min-balance <raw>         Minimum raw token balance to include (default: 1)
  --rpc <url>                 Base RPC URL (default: BASE_RPC_URL fallback set)
  --csv <path>                Write CSV to file instead of stdout
  --linked-only               Emit only holders with linked Telegram identity
  --help                      Show this help
`)
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function getArg(name: string): string {
  const index = process.argv.indexOf(name)
  if (index === -1) return ''
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) return ''
  return String(value).trim()
}

function parsePositiveInt(value: string, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

function parseBigIntOrThrow(value: string, name: string): bigint {
  const raw = String(value ?? '').trim()
  if (!/^\d+$/.test(raw)) {
    throw new Error(`invalid_${name}`)
  }
  return BigInt(raw)
}

function normalizeAddress(value: string): Address {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!isAddress(raw)) throw new Error('invalid_address')
  return raw as Address
}

function normalizeAddressOrNull(value: string): Address | null {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!isAddress(raw)) return null
  return raw as Address
}

function parseBlockArg(raw: string, fallback: bigint): bigint {
  const v = String(raw ?? '').trim().toLowerCase()
  if (!v) return fallback
  if (v === 'latest') return -1n
  if (!/^\d+$/.test(v)) throw new Error('invalid_block')
  return BigInt(v)
}

function uniqueAddresses(values: Iterable<string>): Address[] {
  const out: Address[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const lower = value.toLowerCase()
    if (!isAddress(lower) || seen.has(lower)) continue
    seen.add(lower)
    out.push(lower as Address)
  }
  return out
}

function formatUnits(raw: bigint, decimals: number): string {
  if (!Number.isFinite(decimals) || decimals < 0) return raw.toString()
  const d = Math.floor(decimals)
  if (d === 0) return raw.toString()
  const isNegative = raw < 0n
  const abs = isNegative ? -raw : raw
  const text = abs.toString()
  if (text.length <= d) {
    const padded = text.padStart(d, '0')
    const fraction = padded.replace(/0+$/, '')
    return `${isNegative ? '-' : ''}0${fraction ? `.${fraction}` : ''}`
  }
  const whole = text.slice(0, text.length - d)
  const fractionRaw = text.slice(text.length - d)
  const fraction = fractionRaw.replace(/0+$/, '')
  return `${isNegative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`
}

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value)
  if (!text.includes('"') && !text.includes(',') && !text.includes('\n')) return text
  return `"${text.replace(/"/g, '""')}"`
}

function createCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const lines: string[] = [columns.map(csvEscape).join(',')]
  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(row[column])).join(','))
  }
  return `${lines.join('\n')}\n`
}

async function scanTransferParticipants(params: {
  client: PublicClient
  shareToken: Address
  fromBlock: bigint
  toBlock: bigint
  chunkSize: bigint
}): Promise<Address[]> {
  const addresses = new Set<string>()
  let start = params.fromBlock

  while (start <= params.toBlock) {
    const end = start + params.chunkSize - 1n > params.toBlock ? params.toBlock : start + params.chunkSize - 1n
    process.stderr.write(`[holders-map] scanning logs ${start.toString()}..${end.toString()}\n`)

    const logs = await params.client.getLogs({
      address: params.shareToken,
      event: TRANSFER_EVENT,
      fromBlock: start,
      toBlock: end,
    })

    for (const log of logs) {
      const from = String(log.args.from ?? '').toLowerCase()
      const to = String(log.args.to ?? '').toLowerCase()
      if (isAddress(from) && from !== ZERO_ADDRESS) addresses.add(from)
      if (isAddress(to) && to !== ZERO_ADDRESS) addresses.add(to)
    }

    start = end + 1n
  }

  return uniqueAddresses(addresses)
}

async function fetchHolderBalances(params: {
  client: PublicClient
  shareToken: Address
  holders: Address[]
  minBalanceRaw: bigint
}): Promise<HolderBalance[]> {
  const out: HolderBalance[] = []
  const batchSize = 200
  for (let i = 0; i < params.holders.length; i += batchSize) {
    const batch = params.holders.slice(i, i + batchSize)
    const calls = batch.map((holder) => ({
      address: params.shareToken,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [holder] as const,
    }))
    const multicallResult = await params.client.multicall({
      contracts: calls,
      allowFailure: true,
    })

    for (let j = 0; j < batch.length; j += 1) {
      const holder = batch[j]
      const entry = multicallResult[j]
      if (!entry || entry.status !== 'success') continue
      const balance = entry.result as bigint
      if (balance >= params.minBalanceRaw) {
        out.push({ address: holder, balance })
      }
    }
  }
  return out.sort((a, b) => {
    if (a.balance === b.balance) return a.address.localeCompare(b.address)
    return a.balance > b.balance ? -1 : 1
  })
}

async function fetchTelegramLinksByWallet(params: {
  db: Db
  walletAddresses: Address[]
}): Promise<Map<string, TelegramLinkRow[]>> {
  const map = new Map<string, TelegramLinkRow[]>()
  if (params.walletAddresses.length === 0) return map

  const result = await params.db.sql`
    SELECT
      telegram_user_id,
      telegram_username,
      profile_id,
      privy_user_id,
      LOWER(canonical_csw_address) AS canonical_csw_address,
      owner_verified,
      link_status,
      revoked_at
    FROM telegram_user_links
    WHERE canonical_csw_address IS NOT NULL
      AND LOWER(canonical_csw_address) = ANY(${params.walletAddresses}::text[])
    ORDER BY telegram_user_id ASC;
  `

  for (const row of result.rows ?? []) {
    const wallet = String(row.canonical_csw_address ?? '').toLowerCase()
    if (!isAddress(wallet)) continue
    const normalized = wallet as Address
    const next: TelegramLinkRow = {
      telegramUserId: String(row.telegram_user_id ?? ''),
      telegramUsername: row.telegram_username ? String(row.telegram_username) : null,
      profileId: Number(row.profile_id),
      privyUserId: String(row.privy_user_id ?? ''),
      canonicalCswAddress: normalized,
      ownerVerified: Boolean(row.owner_verified),
      linkStatus: String(row.link_status ?? ''),
      revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
    }
    const existing = map.get(normalized) ?? []
    existing.push(next)
    map.set(normalized, existing)
  }

  return map
}

async function resolveShareTokenFromVault(params: {
  db: Db
  vaultAddress: Address
}): Promise<Address | null> {
  const result = await params.db.sql`
    SELECT LOWER(share_token_address) AS share_token_address
    FROM keepr_vaults
    WHERE LOWER(vault_address) = ${params.vaultAddress}
      AND share_token_address IS NOT NULL
    LIMIT 1;
  `
  const raw = String(result.rows?.[0]?.share_token_address ?? '').toLowerCase()
  return isAddress(raw) ? (raw as Address) : null
}

async function run(): Promise<void> {
  if (hasFlag('--help') || hasFlag('-h')) {
    usage()
    return
  }

  const shareTokenArg = normalizeAddressOrNull(getArg('--share-token'))
  const vaultAddressArg = normalizeAddressOrNull(getArg('--vault-address'))
  const fromBlockArg = getArg('--from-block')
  if (!fromBlockArg) {
    throw new Error('missing_from_block')
  }
  const fromBlock = parseBlockArg(fromBlockArg, 0n)
  if (fromBlock < 0n) {
    throw new Error('invalid_from_block')
  }

  const toBlockArg = getArg('--to-block')
  const chunkSize = BigInt(parsePositiveInt(getArg('--chunk-size'), 5_000))
  const minBalanceRaw = parseBigIntOrThrow(getArg('--min-balance') || '1', 'min_balance')
  const csvPath = getArg('--csv')
  const linkedOnly = hasFlag('--linked-only')

  if (!isDbConfigured()) {
    throw new Error('db_not_configured')
  }
  const db = (await getDb()) as Db | null
  if (!db) {
    throw new Error('db_unavailable')
  }

  const shareToken =
    shareTokenArg ??
    (vaultAddressArg
      ? await resolveShareTokenFromVault({
          db,
          vaultAddress: vaultAddressArg,
        })
      : null)
  if (!shareToken) {
    throw new Error('missing_share_token_or_unmapped_vault')
  }

  const configuredRpc = getArg('--rpc')
  const rpcUrl = configuredRpc || getKeeprBaseRpcUrls()[0] || 'https://mainnet.base.org'
  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 20_000 }),
  })

  const latestBlock = await client.getBlockNumber()
  const parsedToBlock = parseBlockArg(toBlockArg, latestBlock)
  const toBlock = parsedToBlock === -1n ? latestBlock : parsedToBlock
  if (toBlock < fromBlock) {
    throw new Error('invalid_block_range')
  }

  let decimals = 18
  let symbol = 'TOKEN'
  try {
    const [decimalsRaw, symbolRaw] = await Promise.all([
      client.readContract({
        address: shareToken,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
      client.readContract({
        address: shareToken,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
    ])
    decimals = Number(decimalsRaw)
    symbol = String(symbolRaw ?? 'TOKEN')
  } catch {
    // Optional metadata only.
  }

  process.stderr.write(
    `[holders-map] token=${shareToken} symbol=${symbol} decimals=${String(decimals)} range=${fromBlock.toString()}..${toBlock.toString()} rpc=${rpcUrl}\n`,
  )

  const transferParticipants = await scanTransferParticipants({
    client,
    shareToken,
    fromBlock,
    toBlock,
    chunkSize,
  })
  process.stderr.write(`[holders-map] candidate wallets=${String(transferParticipants.length)}\n`)

  const holders = await fetchHolderBalances({
    client,
    shareToken,
    holders: transferParticipants,
    minBalanceRaw,
  })
  process.stderr.write(`[holders-map] holders with balance>=${minBalanceRaw.toString()} => ${String(holders.length)}\n`)

  const linksByWallet = await fetchTelegramLinksByWallet({
    db,
    walletAddresses: holders.map((holder) => holder.address),
  })

  const rows: Array<Record<string, unknown>> = []
  for (const holder of holders) {
    const linkedRows = linksByWallet.get(holder.address) ?? []
    const balanceDecimal = formatUnits(holder.balance, decimals)

    if (linkedRows.length === 0) {
      if (!linkedOnly) {
        rows.push({
          shareTokenAddress: shareToken,
          tokenSymbol: symbol,
          holderAddress: holder.address,
          balanceRaw: holder.balance.toString(),
          balanceDecimal,
          telegramUserId: '',
          telegramUsername: '',
          profileId: '',
          privyUserId: '',
          ownerVerified: '',
          linkStatus: '',
          revokedAt: '',
        })
      }
      continue
    }

    for (const linked of linkedRows) {
      rows.push({
        shareTokenAddress: shareToken,
        tokenSymbol: symbol,
        holderAddress: holder.address,
        balanceRaw: holder.balance.toString(),
        balanceDecimal,
        telegramUserId: linked.telegramUserId,
        telegramUsername: linked.telegramUsername ?? '',
        profileId: linked.profileId,
        privyUserId: linked.privyUserId,
        ownerVerified: linked.ownerVerified,
        linkStatus: linked.linkStatus,
        revokedAt: linked.revokedAt ?? '',
      })
    }
  }

  const csv = createCsv(rows, [
    'shareTokenAddress',
    'tokenSymbol',
    'holderAddress',
    'balanceRaw',
    'balanceDecimal',
    'telegramUserId',
    'telegramUsername',
    'profileId',
    'privyUserId',
    'ownerVerified',
    'linkStatus',
    'revokedAt',
  ])

  if (csvPath) {
    await writeFile(csvPath, csv, 'utf8')
    process.stderr.write(`[holders-map] wrote ${String(rows.length)} rows to ${csvPath}\n`)
    return
  }

  process.stdout.write(csv)
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown_error')
  process.stderr.write(`[holders-map] failed: ${message}\n`)
  process.exit(1)
})
