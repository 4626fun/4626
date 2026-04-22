#!/usr/bin/env node

import { Client } from 'pg'
import {
  createPublicClient,
  createWalletClient,
  decodeAbiParameters,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

declare const process: { argv: string[]; env: Record<string, string | undefined>; exit: (code?: number) => never }

type ApiEnvelope<T> = {
  success: boolean
  data?: T
  error?: string
}

type WalletSyncResponse = {
  canonicalSmartWallet: { address: string; provider: string } | null
}

type WaitlistConnectedAccount = {
  address?: string | null
  isCanonicalSmartWallet?: boolean
}

type WaitlistMeResponse = {
  profileId: number
  cswAddress: string | null
  primarySmartWallet: string | null
  baseSubAccount: string | null
  connectedAccounts: WaitlistConnectedAccount[]
}

type OwnerEntry = {
  index: number
  ownerBytes: Hex
  ownerAddress: Address | null
}

const DEFAULT_BASE_RPC = String(process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
const DEFAULT_APP_ORIGIN =
  String(process.env.APP_ORIGIN ?? '').trim() ||
  String(process.env.CANONICAL_ORIGIN ?? '').trim() ||
  'http://localhost:5173'

const OWNER_READ_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'nextOwnerIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'isOwnerAddress', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const

const OWNER_WRITE_ABI = [
  { type: 'function', name: 'addOwnerAddress', stateMutability: 'nonpayable', inputs: [{ name: 'owner', type: 'address' }], outputs: [] },
] as const

function usage(): void {
  process.stdout.write(`Usage:
  pnpm -C frontend tsx scripts/link-canonical-csw-owner.ts \\
    --canonical-csw 0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef \\
    --owner-to-add 0xd1780fc23f810b52d8cf277e54842dd8803c9361 \\
    --signer-private-key 0x... \\
    --app-origin https://4626.fun \\
    --auth-bearer <cv_auth_session_token>

Required:
  --canonical-csw <address>      Canonical Zora Coinbase Smart Wallet
  --owner-to-add <address>       Owner address to install

Execution:
  --check-only                   Run preflight only (no addOwner tx)
  --signer-private-key <hex>     Existing owner private key for addOwner tx

Reconcile:
  --app-origin <url>             App/API origin (default APP_ORIGIN/CANONICAL_ORIGIN/${DEFAULT_APP_ORIGIN})
  --auth-bearer <token>          cv_auth_session token for /api/wallet/sync + /api/waitlist/me
  --cookie <cookie-header>       Alternate auth (if bearer unavailable)
  --skip-sync-verify             Skip API sync verification step
  --reconcile-db                 If sync result is wrong, force canonical DB flags for profile
  --database-url <url>           DATABASE_URL / POSTGRES_URL override for --reconcile-db
  --profile-id <id>              Profile ID override for --reconcile-db when /waitlist/me is unavailable

Optional:
  --rpc <url>                    Base RPC URL (default BASE_RPC_URL/${DEFAULT_BASE_RPC})
  --max-scan <n>                 Owner slot scan cap (default 256)
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

function normalizeAddress(value: unknown): Address | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!isAddress(raw)) return null
  return getAddress(raw)
}

function requireAddress(label: string, value: string): Address {
  const addr = normalizeAddress(value)
  if (!addr) throw new Error(`Invalid ${label}: ${value}`)
  return addr
}

function parsePrivateKey(value: string): Hex {
  const raw = value.trim()
  const prefixed = raw.startsWith('0x') ? raw : `0x${raw}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(prefixed)) {
    throw new Error('Invalid signer private key (expected 32-byte hex)')
  }
  return prefixed as Hex
}

function asOwnerBytes(owner: Address): Hex {
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

function isZeroOwnerBytes(value: string): boolean {
  return /^0x0{64}$/i.test(value.trim())
}

function ownerBytesToAddress(ownerBytes: string): Address | null {
  const normalized = String(ownerBytes ?? '').trim()
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) return null
  if (isZeroOwnerBytes(normalized)) return null
  try {
    const decoded = decodeAbiParameters([{ type: 'address' }], normalized as Hex)[0] as string
    return normalizeAddress(decoded)
  } catch {
    return null
  }
}

function firstHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').trim()
}

function toPositiveInt(value: string, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  const text = await res.text().catch(() => '')
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

async function readOwnerEntries(params: {
  rpcUrl: string
  smartWallet: Address
  maxScan: number
}): Promise<{ ownerCount: number; nextOwnerIndex: number | null; owners: OwnerEntry[] }> {
  const client = createPublicClient({
    chain: base,
    transport: http(params.rpcUrl, { timeout: 20_000 }),
  })

  const ownerCountRaw = (await client.readContract({
    address: params.smartWallet,
    abi: OWNER_READ_ABI,
    functionName: 'ownerCount',
  })) as bigint
  const ownerCount = Number(ownerCountRaw)

  let nextOwnerIndex: number | null = null
  try {
    const nextRaw = (await client.readContract({
      address: params.smartWallet,
      abi: OWNER_READ_ABI,
      functionName: 'nextOwnerIndex',
    })) as bigint
    const parsed = Number(nextRaw)
    if (Number.isFinite(parsed) && parsed >= 0) nextOwnerIndex = parsed
  } catch {
    // Some CSW variants do not expose nextOwnerIndex.
  }

  const upperBound = Math.min(
    params.maxScan,
    Math.max(
      Number.isFinite(ownerCount) && ownerCount > 0 ? ownerCount : 0,
      Number.isFinite(nextOwnerIndex) && nextOwnerIndex !== null ? nextOwnerIndex : 0,
    ),
  )

  const owners: OwnerEntry[] = []
  for (let i = 0; i < upperBound; i += 1) {
    let ownerBytes: string
    try {
      ownerBytes = (await client.readContract({
        address: params.smartWallet,
        abi: OWNER_READ_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(i)],
      })) as string
    } catch {
      continue
    }
    const normalized = String(ownerBytes).trim()
    if (!/^0x[0-9a-fA-F]{64}$/.test(normalized) || isZeroOwnerBytes(normalized)) continue
    owners.push({
      index: i,
      ownerBytes: normalized as Hex,
      ownerAddress: ownerBytesToAddress(normalized),
    })
  }

  return { ownerCount: Number.isFinite(ownerCount) ? ownerCount : 0, nextOwnerIndex, owners }
}

async function checkOwnerInstalled(params: {
  rpcUrl: string
  smartWallet: Address
  ownerAddress: Address
  maxScan: number
}): Promise<boolean> {
  const client = createPublicClient({
    chain: base,
    transport: http(params.rpcUrl, { timeout: 20_000 }),
  })

  try {
    const direct = (await client.readContract({
      address: params.smartWallet,
      abi: OWNER_READ_ABI,
      functionName: 'isOwnerAddress',
      args: [params.ownerAddress],
    })) as boolean
    if (direct) return true
  } catch {
    // Fallback to slot scan below.
  }

  const expected = asOwnerBytes(params.ownerAddress).toLowerCase()
  const { owners } = await readOwnerEntries({
    rpcUrl: params.rpcUrl,
    smartWallet: params.smartWallet,
    maxScan: params.maxScan,
  })
  return owners.some((owner) => owner.ownerBytes.toLowerCase() === expected)
}

function buildAuthHeaders(args: { authBearer: string; cookie: string }): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (args.authBearer) headers.Authorization = `Bearer ${args.authBearer}`
  if (args.cookie) headers.Cookie = args.cookie
  return headers
}

async function runWalletSync(baseOrigin: string, authHeaders: Record<string, string>): Promise<WalletSyncResponse> {
  const url = `${baseOrigin.replace(/\/+$/, '')}/api/wallet/sync`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  const json = await readJsonSafe<ApiEnvelope<WalletSyncResponse>>(res)
  if (!res.ok || !json?.success || !json.data) {
    const msg = firstHeaderValue(json?.error as string | undefined) || `wallet sync failed (status=${res.status})`
    throw new Error(msg)
  }
  return json.data
}

async function readWaitlistMe(baseOrigin: string, authHeaders: Record<string, string>): Promise<WaitlistMeResponse> {
  const url = `${baseOrigin.replace(/\/+$/, '')}/api/waitlist/me`
  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders,
  })
  const json = await readJsonSafe<ApiEnvelope<WaitlistMeResponse | null>>(res)
  if (!res.ok || !json?.success || !json.data) {
    const msg = firstHeaderValue(json?.error as string | undefined) || `waitlist/me failed (status=${res.status})`
    throw new Error(msg)
  }
  return json.data
}

function resolveCanonicalFromWaitlistMe(data: WaitlistMeResponse): Address | null {
  const candidates: Array<string | null | undefined> = [
    data.cswAddress,
    data.primarySmartWallet,
    data.baseSubAccount,
    ...(Array.isArray(data.connectedAccounts)
      ? data.connectedAccounts
          .filter((row) => row?.isCanonicalSmartWallet)
          .map((row) => row?.address)
      : []),
  ]
  for (const candidate of candidates) {
    const parsed = normalizeAddress(candidate)
    if (parsed) return parsed
  }
  return null
}

async function reconcileCanonicalInDb(params: {
  databaseUrl: string
  profileId: number
  canonicalSmartWallet: Address
}): Promise<void> {
  const client = new Client({ connectionString: params.databaseUrl })
  await client.connect()
  const canonicalLower = params.canonicalSmartWallet.toLowerCase()
  try {
    await client.query('BEGIN')
    await client.query(
      `
      INSERT INTO wallets (address, chain, wallet_type, provider)
      VALUES ($1, 'evm', 'smart_wallet', 'unknown')
      ON CONFLICT (address) DO UPDATE
      SET
        chain = COALESCE(EXCLUDED.chain, wallets.chain),
        wallet_type = COALESCE(EXCLUDED.wallet_type, wallets.wallet_type),
        provider = CASE
          WHEN wallets.provider = 'unknown' THEN EXCLUDED.provider
          ELSE wallets.provider
        END
      `,
      [canonicalLower],
    )

    // Clear any prior canonical flag first to satisfy one-canonical-per-profile constraints.
    await client.query(
      `
      UPDATE profile_wallets
      SET
        is_canonical_smart_wallet = false,
        updated_at = NOW()
      WHERE profile_id = $1
        AND LOWER(address) <> $2
        AND is_canonical_smart_wallet = true
      `,
      [params.profileId, canonicalLower],
    )

    await client.query(
      `
      INSERT INTO profile_wallets (
        profile_id,
        address,
        is_primary,
        is_canonical_smart_wallet,
        is_embedded_eoa,
        is_canonical_solana_wallet,
        is_operational_solana_wallet,
        verified_at,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        false,
        true,
        false,
        false,
        false,
        NOW(),
        $3::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (profile_id, address) DO UPDATE
      SET
        is_canonical_smart_wallet = true,
        verified_at = NOW(),
        metadata = COALESCE(profile_wallets.metadata, '{}'::jsonb) || $3::jsonb,
        updated_at = NOW()
      `,
      [
        params.profileId,
        canonicalLower,
        JSON.stringify({
          reconciledBy: 'link-canonical-csw-owner-script',
          reconciledAt: new Date().toISOString(),
        }),
      ],
    )

    await client.query(
      `
      UPDATE profile_wallets
      SET
        is_canonical_smart_wallet = CASE WHEN LOWER(address) = $1 THEN true ELSE false END,
        updated_at = NOW()
      WHERE profile_id = $2
      `,
      [canonicalLower, params.profileId],
    )

    await client.query(
      `
      UPDATE profiles
      SET
        primary_smart_wallet = $1,
        csw_address = $1,
        base_sub_account = $1,
        updated_at = NOW()
      WHERE id = $2
      `,
      [canonicalLower, params.profileId],
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

async function main(): Promise<void> {
  if (hasFlag('--help') || hasFlag('-h')) {
    usage()
    return
  }

  const canonicalCsw = requireAddress('canonical-csw', getArg('--canonical-csw'))
  const ownerToAdd = requireAddress('owner-to-add', getArg('--owner-to-add'))
  const rpcUrl = getArg('--rpc', DEFAULT_BASE_RPC)
  const maxScan = toPositiveInt(getArg('--max-scan', '256'), 256)
  const checkOnly = hasFlag('--check-only')
  const skipSyncVerify = hasFlag('--skip-sync-verify')
  const reconcileDb = hasFlag('--reconcile-db')
  const appOrigin = getArg('--app-origin', DEFAULT_APP_ORIGIN)

  const authBearer = getArg('--auth-bearer', String(process.env.CV_AUTH_SESSION_TOKEN ?? '').trim())
  const cookie = getArg('--cookie', String(process.env.CV_AUTH_COOKIE ?? '').trim())
  const databaseUrl = getArg(
    '--database-url',
    String(process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '').trim(),
  )

  const signerPrivateKeyRaw = getArg(
    '--signer-private-key',
    String(process.env.OWNER_SIGNER_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? '').trim(),
  )
  const profileIdRaw = getArg('--profile-id', '')
  const profileIdOverride = profileIdRaw ? Number(profileIdRaw) : null
  if (profileIdRaw && (!Number.isFinite(profileIdOverride) || Number(profileIdOverride) <= 0)) {
    throw new Error(`Invalid --profile-id: ${profileIdRaw}`)
  }

  process.stdout.write(`[link-csw-owner] canonical=${canonicalCsw} ownerToAdd=${ownerToAdd}\n`)
  process.stdout.write(`[link-csw-owner] rpc=${rpcUrl} checkOnly=${String(checkOnly)} maxScan=${String(maxScan)}\n`)

  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 20_000 }),
  })

  const bytecode = await publicClient.getBytecode({ address: canonicalCsw })
  if (!bytecode || bytecode === '0x') {
    throw new Error(`Canonical smart wallet has no contract code: ${canonicalCsw}`)
  }

  const ownerSnapshot = await readOwnerEntries({ rpcUrl, smartWallet: canonicalCsw, maxScan })
  process.stdout.write(
    `[link-csw-owner] ownerCount=${String(ownerSnapshot.ownerCount)} nextOwnerIndex=${String(ownerSnapshot.nextOwnerIndex ?? 'n/a')} scannedOwners=${String(ownerSnapshot.owners.length)}\n`,
  )
  if (ownerSnapshot.owners.length > 0) {
    for (const owner of ownerSnapshot.owners) {
      process.stdout.write(
        `  - slot=${String(owner.index)} owner=${owner.ownerAddress ?? '<non-address-bytes>'} bytes=${owner.ownerBytes}\n`,
      )
    }
  }

  const targetAlreadyInstalled = await checkOwnerInstalled({
    rpcUrl,
    smartWallet: canonicalCsw,
    ownerAddress: ownerToAdd,
    maxScan,
  })
  process.stdout.write(`[link-csw-owner] targetOwnerInstalled=${String(targetAlreadyInstalled)}\n`)

  if (!targetAlreadyInstalled && !checkOnly) {
    if (!signerPrivateKeyRaw) {
      throw new Error(
        'Owner is not installed and no signer private key was provided. Set --signer-private-key or OWNER_SIGNER_PRIVATE_KEY.',
      )
    }
    const signerPrivateKey = parsePrivateKey(signerPrivateKeyRaw)
    const signerAccount = privateKeyToAccount(signerPrivateKey)
    const signerAddress = getAddress(signerAccount.address)
    process.stdout.write(`[link-csw-owner] signer=${signerAddress}\n`)

    const signerIsOwner = await checkOwnerInstalled({
      rpcUrl,
      smartWallet: canonicalCsw,
      ownerAddress: signerAddress,
      maxScan,
    })
    if (!signerIsOwner) {
      throw new Error(
        `Signer ${signerAddress} is not an owner of ${canonicalCsw}; cannot execute addOwnerAddress.`,
      )
    }

    const walletClient = createWalletClient({
      account: signerAccount,
      chain: base,
      transport: http(rpcUrl, { timeout: 20_000 }),
    })

    const callData = encodeFunctionData({
      abi: OWNER_WRITE_ABI,
      functionName: 'addOwnerAddress',
      args: [ownerToAdd],
    })
    const txHash = await walletClient.sendTransaction({
      account: signerAccount,
      to: canonicalCsw,
      data: callData,
      chain: base,
      value: 0n,
    })
    process.stdout.write(`[link-csw-owner] addOwnerAddress txHash=${txHash}\n`)

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 })
    if (receipt.status !== 'success') {
      throw new Error(`addOwnerAddress transaction reverted: ${txHash}`)
    }
    process.stdout.write(`[link-csw-owner] tx confirmed in block ${String(receipt.blockNumber)}\n`)
  } else if (!targetAlreadyInstalled && checkOnly) {
    process.stdout.write('[link-csw-owner] check-only mode: owner is missing and no transaction was sent.\n')
  }

  const ownerInstalledAfter = await checkOwnerInstalled({
    rpcUrl,
    smartWallet: canonicalCsw,
    ownerAddress: ownerToAdd,
    maxScan,
  })
  if (!ownerInstalledAfter) {
    throw new Error(
      `Owner ${ownerToAdd} is still not installed on ${canonicalCsw}.`,
    )
  }
  process.stdout.write('[link-csw-owner] owner verification passed.\n')

  if (skipSyncVerify) {
    process.stdout.write('[link-csw-owner] sync verification skipped (--skip-sync-verify).\n')
    return
  }

  const hasAuth = Boolean(authBearer || cookie)
  if (!hasAuth) {
    if (reconcileDb) {
      process.stdout.write('[link-csw-owner] no auth provided; skipping API sync verification and using DB reconcile path.\n')
    } else {
      throw new Error(
        'Sync verification requires --auth-bearer (recommended) or --cookie. Use --skip-sync-verify to skip.',
      )
    }
  }

  const authHeaders = hasAuth ? buildAuthHeaders({ authBearer, cookie }) : null
  let waitlistMe: WaitlistMeResponse | null = null
  let canonicalFromWaitlist: Address | null = null
  let syncCanonical: Address | null = null

  if (authHeaders) {
    const sync = await runWalletSync(appOrigin, authHeaders)
    syncCanonical = normalizeAddress(sync.canonicalSmartWallet?.address)
    process.stdout.write(
      `[link-csw-owner] wallet/sync canonical=${syncCanonical ?? 'null'}\n`,
    )
    waitlistMe = await readWaitlistMe(appOrigin, authHeaders)
    canonicalFromWaitlist = resolveCanonicalFromWaitlistMe(waitlistMe)
    process.stdout.write(
      `[link-csw-owner] waitlist/me profileId=${String(waitlistMe.profileId)} canonical=${canonicalFromWaitlist ?? 'null'}\n`,
    )
  }

  const canonicalMatches =
    Boolean(syncCanonical && syncCanonical.toLowerCase() === canonicalCsw.toLowerCase()) &&
    Boolean(canonicalFromWaitlist && canonicalFromWaitlist.toLowerCase() === canonicalCsw.toLowerCase())

  if (canonicalMatches) {
    process.stdout.write('[link-csw-owner] canonical mapping verification passed.\n')
    return
  }

  if (!reconcileDb) {
    throw new Error(
      `Canonical mapping mismatch after sync. Expected ${canonicalCsw} but got sync=${syncCanonical ?? 'null'} waitlist=${canonicalFromWaitlist ?? 'null'}. Re-run with --reconcile-db.`,
    )
  }

  if (!databaseUrl) {
    throw new Error('Missing database URL for --reconcile-db. Provide --database-url or set DATABASE_URL/POSTGRES_URL.')
  }

  const profileId =
    waitlistMe?.profileId ??
    (profileIdOverride && Number.isFinite(profileIdOverride) ? Number(profileIdOverride) : null)
  if (!profileId || profileId <= 0) {
    throw new Error(
      'Could not determine profileId for DB reconcile. Provide --profile-id or include auth for /api/waitlist/me.',
    )
  }

  process.stdout.write(`[link-csw-owner] running DB canonical reconcile for profileId=${String(profileId)}...\n`)
  await reconcileCanonicalInDb({
    databaseUrl,
    profileId,
    canonicalSmartWallet: canonicalCsw,
  })
  process.stdout.write('[link-csw-owner] DB reconcile applied.\n')

  if (!authHeaders) {
    process.stdout.write('[link-csw-owner] no auth provided; DB reconcile complete (API re-verify skipped).\n')
    return
  }

  const syncAfter = await runWalletSync(appOrigin, authHeaders)
  const syncCanonicalAfter = normalizeAddress(syncAfter.canonicalSmartWallet?.address)
  const waitlistAfter = await readWaitlistMe(appOrigin, authHeaders)
  const canonicalAfter = resolveCanonicalFromWaitlistMe(waitlistAfter)

  const reconcileOk =
    Boolean(syncCanonicalAfter && syncCanonicalAfter.toLowerCase() === canonicalCsw.toLowerCase()) &&
    Boolean(canonicalAfter && canonicalAfter.toLowerCase() === canonicalCsw.toLowerCase())

  if (!reconcileOk) {
    throw new Error(
      `Canonical mapping still mismatched after DB reconcile. Expected ${canonicalCsw}; got sync=${syncCanonicalAfter ?? 'null'} waitlist=${canonicalAfter ?? 'null'}.`,
    )
  }

  process.stdout.write('[link-csw-owner] canonical mapping verified after DB reconcile.\n')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown_error')
  process.stderr.write(`[link-csw-owner] failed: ${message}\n`)
  process.exit(1)
})
