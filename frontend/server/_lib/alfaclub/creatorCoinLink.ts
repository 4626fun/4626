import { createHash, randomBytes, randomUUID } from 'node:crypto'

import {
  decodeFunctionData,
  encodeFunctionData,
  getAddress,
  isAddress,
  parseAbi,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'

import { getDb } from '../db/postgres.js'
import { ALFACLUB, FRIEND_KEY_ABI, getAlfaClubPublicClient } from '../wallet/alfaclub.js'

const CREATOR_COIN_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function creator() view returns (address)',
  'function payoutRecipient() view returns (address)',
  'function owner() view returns (address)',
  'function owners() view returns (address[])',
  'function setPayoutRecipient(address recipient)',
  'function addOwner(address newOwner)',
  'function transferOwnership(address newOwner)',
])

const POLICY_CONTROLLER_ABI = parseAbi([
  'function creatorCoin() view returns (address)',
  'function payoutRouter() view returns (address)',
])

const CHALLENGE_TTL_SECONDS = 10 * 60
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<{ rows?: any[] }>
}

type PublicClientLike = Pick<PublicClient, 'getBytecode' | 'getBlockNumber' | 'readContract' | 'call'>

export type CreatorCoinLinkStatus =
  | 'verified_owner'
  | 'managed_by_policy_controller'
  | 'control_not_verified'
  | 'claimed_by_another_account'

export type CreatorCoinVerificationMethod = 'direct_owner' | 'policy_controller'

export type CreatorCoinLinkRecord = {
  roomId: string
  tokenId: string
  creatorCoinAddress: Address
  profileId: number
  executionAddress: Address
  verifiedSignerAddress: Address | null
  verificationMethod: CreatorCoinVerificationMethod
  verificationBlock: string
  coinName: string
  coinSymbol: string
  coinDecimals: number
  creator: Address
  owners: Address[]
  creatorCoinPayoutRecipient: Address
  policyControllerAddress: Address | null
  createdAt: string
}

export type CreatorCoinInspection = {
  status: CreatorCoinLinkStatus
  roomId: string
  tokenId: string
  creatorCoinAddress: Address
  executionAddress: Address
  verificationMethod: CreatorCoinVerificationMethod | null
  verificationBlock: string
  coinName: string
  coinSymbol: string
  coinDecimals: number
  creator: Address
  owners: Address[]
  creatorCoinPayoutRecipient: Address
  policyControllerAddress: Address | null
  existingLink: CreatorCoinLinkRecord | null
}

type ProfileContext = {
  profileId: number
  canonicalCsw: Address | null
  primaryWallet: Address | null
  embeddedEoa: Address | null
  accountAddresses: Address[]
}

type ChallengeRow = {
  profileId: number
  roomId: string
  tokenId: string
  creatorCoinAddress: Address
  executionAddress: Address
  expiresAt: string
}

export class CreatorCoinLinkError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'CreatorCoinLinkError'
  }
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  return getAddress(value).toLowerCase() as Address
}

function normalizeRoomId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const roomId = value.trim()
  return /^\d+$/.test(roomId) && BigInt(roomId) > 0n ? roomId : null
}

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text ? text.slice(0, maxLength) : null
}

function toIso(value: unknown): string {
  const date = new Date(String(value ?? ''))
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString()
}

function uniqueAddresses(values: unknown[]): Address[] {
  const seen = new Set<string>()
  const addresses: Address[] = []
  for (const value of values) {
    const address = normalizeAddress(value)
    if (!address || address === ZERO_ADDRESS || seen.has(address)) continue
    seen.add(address)
    addresses.push(address)
  }
  return addresses
}

function mapLink(row: any): CreatorCoinLinkRecord | null {
  const creatorCoinAddress = normalizeAddress(row?.creator_coin_address)
  const executionAddress = normalizeAddress(row?.execution_address)
  const creatorCoinPayoutRecipient = normalizeAddress(row?.creator_coin_payout_recipient)
  const creator = normalizeAddress(row?.verification_metadata?.creator)
  const method = String(row?.verification_method ?? '')
  const ownersRaw = Array.isArray(row?.owner_snapshot) ? row.owner_snapshot : []
  const owners = uniqueAddresses(ownersRaw)
  if (
    !creatorCoinAddress ||
    !executionAddress ||
    !creatorCoinPayoutRecipient ||
    !creator ||
    (method !== 'direct_owner' && method !== 'policy_controller')
  ) {
    return null
  }
  return {
    roomId: String(row.room_id),
    tokenId: String(row.token_id),
    creatorCoinAddress,
    profileId: Number(row.profile_id),
    executionAddress,
    verifiedSignerAddress: normalizeAddress(row.verified_signer_address),
    verificationMethod: method,
    verificationBlock: String(row.verification_block),
    coinName: String(row.coin_name),
    coinSymbol: String(row.coin_symbol),
    coinDecimals: Number(row.coin_decimals),
    creator,
    owners,
    creatorCoinPayoutRecipient,
    policyControllerAddress: normalizeAddress(row.policy_controller_address),
    createdAt: toIso(row.created_at),
  }
}

export async function resolveCreatorCoinLinkProfile(
  db: Db,
  sessionAddressRaw: string,
): Promise<ProfileContext> {
  const sessionAddress = normalizeAddress(sessionAddressRaw)
  if (!sessionAddress) {
    throw new CreatorCoinLinkError('authentication_required', 401, 'Authentication required')
  }

  const result = await db.sql`
    SELECT
      p.id,
      p.csw_address,
      p.primary_wallet,
      p.primary_embedded_eoa,
      canonical.address AS canonical_wallet,
      ARRAY_REMOVE(
        ARRAY_AGG(DISTINCT LOWER(pw.address)) FILTER (
          WHERE pw.is_primary = true
             OR pw.is_embedded_eoa = true
             OR pw.is_canonical_smart_wallet = true
        ),
        NULL
      ) AS linked_wallets
    FROM profiles p
    LEFT JOIN profile_wallets pw ON pw.profile_id = p.id
    LEFT JOIN LATERAL (
      SELECT canonical_wallet.address
      FROM profile_wallets canonical_wallet
      WHERE canonical_wallet.profile_id = p.id
        AND canonical_wallet.is_canonical_smart_wallet = true
      LIMIT 1
    ) canonical ON true
    WHERE p.merged_into_profile_id IS NULL
      AND (
        LOWER(COALESCE(p.csw_address, '')) = ${sessionAddress}
        OR LOWER(COALESCE(p.primary_wallet, '')) = ${sessionAddress}
        OR LOWER(COALESCE(p.primary_embedded_eoa, '')) = ${sessionAddress}
        OR LOWER(COALESCE(p.embedded_wallet, '')) = ${sessionAddress}
        OR EXISTS (
          SELECT 1 FROM profile_wallets match_wallet
          WHERE match_wallet.profile_id = p.id
            AND LOWER(match_wallet.address) = ${sessionAddress}
            AND (
              match_wallet.is_primary = true
              OR match_wallet.is_embedded_eoa = true
              OR match_wallet.is_canonical_smart_wallet = true
            )
        )
      )
    GROUP BY p.id, p.csw_address, p.primary_wallet, p.primary_embedded_eoa, canonical.address
    LIMIT 2;
  `
  const rows = result.rows ?? []
  if (rows.length !== 1) {
    throw new CreatorCoinLinkError(
      'account_resolution_failed',
      409,
      rows.length > 1
        ? 'This wallet resolves to multiple 4626 accounts'
        : 'The signed-in wallet is not attached to an active 4626 account',
    )
  }

  const row = rows[0]
  const profileId = Number(row.id)
  if (!Number.isSafeInteger(profileId) || profileId <= 0) {
    throw new CreatorCoinLinkError('account_resolution_failed', 409, 'Invalid 4626 account')
  }
  const canonicalCsw = normalizeAddress(row.canonical_wallet) ?? normalizeAddress(row.csw_address)
  const primaryWallet = normalizeAddress(row.primary_wallet)
  const embeddedEoa = normalizeAddress(row.primary_embedded_eoa)
  const linkedWallets = Array.isArray(row.linked_wallets) ? row.linked_wallets : []
  const accountAddresses = uniqueAddresses([
    canonicalCsw,
    primaryWallet,
    embeddedEoa,
    sessionAddress,
    ...linkedWallets,
  ])
  return { profileId, canonicalCsw, primaryWallet, embeddedEoa, accountAddresses }
}

function validateExecutionAddress(profile: ProfileContext, executionAddressRaw: string): Address {
  const executionAddress = normalizeAddress(executionAddressRaw)
  if (!executionAddress) {
    throw new CreatorCoinLinkError('invalid_execution_address', 400, 'A valid execution address is required')
  }
  const canonical = profile.canonicalCsw
  const eoaCandidates = uniqueAddresses([
    profile.primaryWallet,
    profile.canonicalCsw ? null : profile.embeddedEoa,
  ])
  const valid =
    executionAddress === canonical ||
    eoaCandidates.some((address) => address === executionAddress)
  if (!valid) {
    throw new CreatorCoinLinkError(
      'execution_address_mismatch',
      403,
      'The execution address is not attached to the signed-in 4626 account',
    )
  }
  return executionAddress
}

async function assertRoomOwnedByProfile(params: {
  profile: ProfileContext
  tokenId: string
  client: PublicClientLike
}): Promise<void> {
  const creator = normalizeAddress(
    await params.client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'creatorByTokenId',
      args: [BigInt(params.tokenId)],
    }),
  )
  if (!creator || !params.profile.accountAddresses.includes(creator)) {
    throw new CreatorCoinLinkError(
      'room_control_not_verified',
      403,
      'This AlfaClub room is not controlled by the signed-in 4626 account',
    )
  }
}

async function readCreatorCoin(params: {
  creatorCoinAddress: Address
  client: PublicClientLike
}): Promise<{
  blockNumber: bigint
  name: string
  symbol: string
  decimals: number
  creator: Address
  payoutRecipient: Address
  owners: Address[]
}> {
  const code = await params.client.getBytecode({ address: params.creatorCoinAddress })
  if (!code || code === '0x') {
    throw new CreatorCoinLinkError('not_a_contract', 400, 'Creator Coin address has no contract code on Base')
  }

  try {
    const [blockNumber, nameRaw, symbolRaw, decimalsRaw, creatorRaw, payoutRaw, multiOwnersRaw, legacyOwnerRaw] =
      await Promise.all([
        params.client.getBlockNumber(),
        params.client.readContract({
          address: params.creatorCoinAddress,
          abi: CREATOR_COIN_ABI,
          functionName: 'name',
        }),
        params.client.readContract({
          address: params.creatorCoinAddress,
          abi: CREATOR_COIN_ABI,
          functionName: 'symbol',
        }),
        params.client.readContract({
          address: params.creatorCoinAddress,
          abi: CREATOR_COIN_ABI,
          functionName: 'decimals',
        }),
        params.client.readContract({
          address: params.creatorCoinAddress,
          abi: CREATOR_COIN_ABI,
          functionName: 'creator',
        }),
        params.client.readContract({
          address: params.creatorCoinAddress,
          abi: CREATOR_COIN_ABI,
          functionName: 'payoutRecipient',
        }),
        params.client
          .readContract({
            address: params.creatorCoinAddress,
            abi: CREATOR_COIN_ABI,
            functionName: 'owners',
          })
          .catch(() => null),
        params.client
          .readContract({
            address: params.creatorCoinAddress,
            abi: CREATOR_COIN_ABI,
            functionName: 'owner',
          })
          .catch(() => null),
      ])

    const name = normalizeText(nameRaw, 128)
    const symbol = normalizeText(symbolRaw, 32)
    const decimals = Number(decimalsRaw)
    const creator = normalizeAddress(creatorRaw)
    const payoutRecipient = normalizeAddress(payoutRaw)
    const owners = uniqueAddresses([
      ...(Array.isArray(multiOwnersRaw) ? multiOwnersRaw : []),
      legacyOwnerRaw,
    ])
    if (
      !name ||
      !symbol ||
      !Number.isInteger(decimals) ||
      decimals < 0 ||
      decimals > 255 ||
      !creator ||
      !payoutRecipient ||
      owners.length === 0
    ) {
      throw new Error('creator_coin_interface_mismatch')
    }
    return { blockNumber, name, symbol, decimals, creator, payoutRecipient, owners }
  } catch (error) {
    if (error instanceof CreatorCoinLinkError) throw error
    throw new CreatorCoinLinkError(
      'creator_coin_interface_mismatch',
      400,
      'Contract does not implement the required Creator Coin interface',
    )
  }
}

function payloadCalls(payload: unknown): Array<{ to: Address; data: Hex }> {
  if (!payload || typeof payload !== 'object') return []
  const record = payload as Record<string, unknown>
  const callGroups = [
    record.phase1Calls,
    record.phase2CoreCalls,
    record.phase2PreFinalizeCalls,
    record.phase2FinalizeCalls,
    record.phase3Calls,
    record.phase4Calls,
  ]
  const calls: Array<{ to: Address; data: Hex }> = []
  for (const group of callGroups) {
    if (!Array.isArray(group)) continue
    for (const item of group) {
      const to = normalizeAddress((item as { to?: unknown })?.to)
      const data = (item as { data?: unknown })?.data
      if (to && typeof data === 'string' && /^0x[0-9a-fA-F]+$/.test(data)) {
        calls.push({ to, data: data as Hex })
      }
    }
  }
  return calls
}

function payloadGrantsController(payload: unknown, creatorCoin: Address, controller: Address): boolean {
  return payloadCalls(payload).some((call) => {
    if (call.to !== creatorCoin) return false
    try {
      const decoded = decodeFunctionData({ abi: CREATOR_COIN_ABI, data: call.data })
      if (decoded.functionName !== 'addOwner' && decoded.functionName !== 'transferOwnership') return false
      return normalizeAddress(decoded.args?.[0]) === controller
    } catch {
      return false
    }
  })
}

async function resolveProfilePolicyController(params: {
  db: Db
  profile: ProfileContext
  creatorCoin: Address
  owners: Address[]
  client: PublicClientLike
}): Promise<Address | null> {
  const candidates = params.owners.filter(
    (owner) => !params.profile.accountAddresses.includes(owner),
  )
  if (candidates.length === 0 || !params.profile.canonicalCsw) return null

  const keeperRows = await params.db.sql`
    SELECT vault_address, share_token_address, config_json
    FROM keepr_vaults
    WHERE LOWER(COALESCE(creator_coin_address, '')) = ${params.creatorCoin}
      AND LOWER(COALESCE(canonical_owner_address, '')) = ${params.profile.canonicalCsw}
      AND settled_at IS NOT NULL
    ORDER BY settled_at DESC
    LIMIT 5;
  `
  if ((keeperRows.rows ?? []).length === 0) return null

  const deployRows = await params.db.sql`
    SELECT payload
    FROM deploys
    WHERE state = 'completed'
      AND LOWER(COALESCE(payload->>'creatorToken', '')) = ${params.creatorCoin}
      AND (
        LOWER(COALESCE(smart_wallet, '')) = ANY(${params.profile.accountAddresses})
        OR LOWER(COALESCE(session_address, '')) = ANY(${params.profile.accountAddresses})
        OR LOWER(COALESCE(payload->>'ownerAddress', '')) = ANY(${params.profile.accountAddresses})
      )
    ORDER BY updated_at DESC
    LIMIT 20;
  `

  for (const candidate of candidates) {
    const plannedByProfile = (deployRows.rows ?? []).some((row) =>
      payloadGrantsController(row.payload, params.creatorCoin, candidate),
    )
    if (!plannedByProfile) continue
    try {
      const code = await params.client.getBytecode({ address: candidate })
      if (!code || code === '0x') continue
      const [boundCoin, payoutRouter] = await Promise.all([
        params.client.readContract({
          address: candidate,
          abi: POLICY_CONTROLLER_ABI,
          functionName: 'creatorCoin',
        }),
        params.client.readContract({
          address: candidate,
          abi: POLICY_CONTROLLER_ABI,
          functionName: 'payoutRouter',
        }),
      ])
      const normalizedPayoutRouter = normalizeAddress(payoutRouter)
      const configuredPayoutRouters = uniqueAddresses(
        (keeperRows.rows ?? []).map((row) => row?.config_json?.contracts?.payoutRouter),
      )
      if (
        normalizeAddress(boundCoin) === params.creatorCoin &&
        normalizedPayoutRouter !== null &&
        normalizedPayoutRouter !== ZERO_ADDRESS &&
        (
          configuredPayoutRouters.length === 0 ||
          configuredPayoutRouters.includes(normalizedPayoutRouter)
        )
      ) {
        return candidate
      }
    } catch {
      continue
    }
  }
  return null
}

async function readLinkClaims(
  db: Db,
  roomId: string,
  creatorCoinAddress?: Address,
): Promise<CreatorCoinLinkRecord[]> {
  const result = creatorCoinAddress
    ? await db.sql`
        SELECT * FROM alfaclub.creator_coin_links
        WHERE room_id = ${roomId}
           OR creator_coin_address = ${creatorCoinAddress}
        ORDER BY created_at ASC;
      `
    : await db.sql`
        SELECT * FROM alfaclub.creator_coin_links
        WHERE room_id = ${roomId}
        LIMIT 1;
      `
  return (result.rows ?? []).map(mapLink).filter((row): row is CreatorCoinLinkRecord => row !== null)
}

export async function readCreatorCoinLinkStatus(params: {
  sessionAddress: string
  roomId: string
  db?: Db
}): Promise<{ status: CreatorCoinLinkStatus | null; link: CreatorCoinLinkRecord | null }> {
  const db = params.db ?? (await getDb())
  if (!db) throw new CreatorCoinLinkError('db_unavailable', 503, 'Database unavailable')
  const roomId = normalizeRoomId(params.roomId)
  if (!roomId) throw new CreatorCoinLinkError('invalid_room_id', 400, 'A positive roomId is required')
  const profile = await resolveCreatorCoinLinkProfile(db, params.sessionAddress)
  const link = (await readLinkClaims(db, roomId))[0] ?? null
  if (!link) return { status: null, link: null }
  if (link.profileId !== profile.profileId) {
    return { status: 'claimed_by_another_account', link: null }
  }
  return {
    status:
      link.verificationMethod === 'direct_owner'
        ? 'verified_owner'
        : 'managed_by_policy_controller',
    link,
  }
}

export async function inspectCreatorCoinLink(params: {
  sessionAddress: string
  roomId: string
  creatorCoinAddress: string
  executionAddress: string
  db?: Db
  client?: PublicClientLike
}): Promise<CreatorCoinInspection> {
  const db = params.db ?? (await getDb())
  if (!db) throw new CreatorCoinLinkError('db_unavailable', 503, 'Database unavailable')
  const roomId = normalizeRoomId(params.roomId)
  if (!roomId) throw new CreatorCoinLinkError('invalid_room_id', 400, 'A positive roomId is required')
  const creatorCoinAddress = normalizeAddress(params.creatorCoinAddress)
  if (!creatorCoinAddress) {
    throw new CreatorCoinLinkError('invalid_creator_coin_address', 400, 'A valid Creator Coin address is required')
  }
  const profile = await resolveCreatorCoinLinkProfile(db, params.sessionAddress)
  const executionAddress = validateExecutionAddress(profile, params.executionAddress)
  const client =
    params.client ??
    ((await getAlfaClubPublicClient()) as unknown as PublicClientLike)

  await assertRoomOwnedByProfile({ profile, tokenId: roomId, client })
  const coin = await readCreatorCoin({ creatorCoinAddress, client })
  const claims = await readLinkClaims(db, roomId, creatorCoinAddress)
  const conflictingClaim = claims.find(
    (claim) =>
      claim.profileId !== profile.profileId ||
      claim.roomId !== roomId ||
      claim.creatorCoinAddress !== creatorCoinAddress,
  )
  const existingLink =
    claims.find(
      (claim) =>
        claim.profileId === profile.profileId &&
        claim.roomId === roomId &&
        claim.creatorCoinAddress === creatorCoinAddress,
    ) ?? null

  let directAuthority = false
  if (coin.owners.includes(executionAddress)) {
    try {
      await client.call({
        to: creatorCoinAddress,
        account: executionAddress,
        data: encodeFunctionData({
          abi: CREATOR_COIN_ABI,
          functionName: 'setPayoutRecipient',
          args: [coin.payoutRecipient],
        }),
      })
      directAuthority = true
    } catch {
      directAuthority = false
    }
  }

  const policyControllerAddress = directAuthority
    ? null
    : await resolveProfilePolicyController({
        db,
        profile,
        creatorCoin: creatorCoinAddress,
        owners: coin.owners,
        client,
      })
  const verificationMethod: CreatorCoinVerificationMethod | null = directAuthority
    ? 'direct_owner'
    : policyControllerAddress
      ? 'policy_controller'
      : null
  const status: CreatorCoinLinkStatus = conflictingClaim
    ? 'claimed_by_another_account'
    : verificationMethod === 'direct_owner'
      ? 'verified_owner'
      : verificationMethod === 'policy_controller'
        ? 'managed_by_policy_controller'
        : 'control_not_verified'

  return {
    status,
    roomId,
    tokenId: roomId,
    creatorCoinAddress,
    executionAddress,
    verificationMethod,
    verificationBlock: coin.blockNumber.toString(),
    coinName: coin.name,
    coinSymbol: coin.symbol,
    coinDecimals: coin.decimals,
    creator: coin.creator,
    owners: coin.owners,
    creatorCoinPayoutRecipient: coin.payoutRecipient,
    policyControllerAddress,
    existingLink,
  }
}

export function buildCreatorCoinLinkChallengeMessage(params: {
  profileId: number
  roomId: string
  tokenId: string
  creatorCoinAddress: Address
  executionAddress: Address
  nonce: string
  expiresAt: string
}): string {
  return [
    '4626.fun: AlfaClub Creator Coin link',
    '',
    'Chain: Base (8453)',
    `4626 Account: ${params.profileId}`,
    `Room: ${params.roomId}`,
    `FriendKey Token ID: ${params.tokenId}`,
    `Creator Coin: ${params.creatorCoinAddress}`,
    `Execution Address: ${params.executionAddress}`,
    `Nonce: ${params.nonce}`,
    `Expires: ${params.expiresAt}`,
    '',
    'This signature only links an existing Creator Coin to an AlfaClub room.',
    'It does not change ownership, the creatorCoinPayoutRecipient, or liquidity.',
  ].join('\n')
}

function challengeHash(nonce: string): string {
  return createHash('sha256').update(nonce, 'utf8').digest('hex')
}

export async function issueCreatorCoinLinkChallenge(params: {
  sessionAddress: string
  inspection: CreatorCoinInspection
  db?: Db
  ttlSeconds?: number
}): Promise<{ nonce: string; message: string; expiresAt: string }> {
  if (
    params.inspection.status === 'control_not_verified' ||
    params.inspection.status === 'claimed_by_another_account' ||
    !params.inspection.verificationMethod
  ) {
    throw new CreatorCoinLinkError('control_not_verified', 403, 'Creator Coin control is not verified')
  }
  const db = params.db ?? (await getDb())
  if (!db) throw new CreatorCoinLinkError('db_unavailable', 503, 'Database unavailable')
  const profile = await resolveCreatorCoinLinkProfile(db, params.sessionAddress)
  const ttlSeconds = Math.max(60, Math.min(30 * 60, Math.floor(params.ttlSeconds ?? CHALLENGE_TTL_SECONDS)))
  const nonce = typeof randomUUID === 'function' ? randomUUID() : randomBytes(16).toString('hex')
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
  const message = buildCreatorCoinLinkChallengeMessage({
    profileId: profile.profileId,
    roomId: params.inspection.roomId,
    tokenId: params.inspection.tokenId,
    creatorCoinAddress: params.inspection.creatorCoinAddress,
    executionAddress: params.inspection.executionAddress,
    nonce,
    expiresAt,
  })

  await db.sql`
    DELETE FROM alfaclub.creator_coin_link_challenges
    WHERE profile_id = ${profile.profileId}
      AND room_id = ${params.inspection.roomId};
  `
  await db.sql`
    INSERT INTO alfaclub.creator_coin_link_challenges (
      nonce_hash,
      profile_id,
      room_id,
      token_id,
      creator_coin_address,
      execution_address,
      expires_at
    ) VALUES (
      ${challengeHash(nonce)},
      ${profile.profileId},
      ${params.inspection.roomId},
      ${params.inspection.tokenId},
      ${params.inspection.creatorCoinAddress},
      ${params.inspection.executionAddress},
      ${expiresAt}
    );
  `
  return { nonce, message, expiresAt }
}

export async function consumeCreatorCoinLinkChallenge(params: {
  sessionAddress: string
  nonce: string
  db?: Db
}): Promise<{ row: ChallengeRow; message: string }> {
  const nonce = params.nonce.trim()
  if (!nonce) throw new CreatorCoinLinkError('invalid_challenge', 400, 'Challenge nonce is required')
  const db = params.db ?? (await getDb())
  if (!db) throw new CreatorCoinLinkError('db_unavailable', 503, 'Database unavailable')
  const profile = await resolveCreatorCoinLinkProfile(db, params.sessionAddress)
  const result = await db.sql`
    DELETE FROM alfaclub.creator_coin_link_challenges
    WHERE nonce_hash = ${challengeHash(nonce)}
      AND profile_id = ${profile.profileId}
      AND expires_at > NOW()
    RETURNING profile_id, room_id, token_id, creator_coin_address, execution_address, expires_at;
  `
  const raw = result.rows?.[0]
  const creatorCoinAddress = normalizeAddress(raw?.creator_coin_address)
  const executionAddress = normalizeAddress(raw?.execution_address)
  if (!raw || !creatorCoinAddress || !executionAddress) {
    throw new CreatorCoinLinkError('invalid_or_expired_challenge', 409, 'Challenge is invalid, expired, or already used')
  }
  const row: ChallengeRow = {
    profileId: Number(raw.profile_id),
    roomId: String(raw.room_id),
    tokenId: String(raw.token_id),
    creatorCoinAddress,
    executionAddress,
    expiresAt: toIso(raw.expires_at),
  }
  return {
    row,
    message: buildCreatorCoinLinkChallengeMessage({
      ...row,
      nonce,
    }),
  }
}

export async function persistCreatorCoinLink(params: {
  inspection: CreatorCoinInspection
  profileId: number
  verifiedSignerAddress: Address | null
  contractSignatureValidated: boolean
  db?: Db
}): Promise<CreatorCoinLinkRecord> {
  if (!params.inspection.verificationMethod) {
    throw new CreatorCoinLinkError('control_not_verified', 403, 'Creator Coin control is not verified')
  }
  const db = params.db ?? (await getDb())
  if (!db) throw new CreatorCoinLinkError('db_unavailable', 503, 'Database unavailable')
  try {
    const result = await db.sql`
      INSERT INTO alfaclub.creator_coin_links (
        room_id,
        token_id,
        creator_coin_address,
        profile_id,
        execution_address,
        verified_signer_address,
        verification_method,
        verification_block,
        coin_name,
        coin_symbol,
        coin_decimals,
        owner_snapshot,
        creator_coin_payout_recipient,
        policy_controller_address,
        verification_metadata
      ) VALUES (
        ${params.inspection.roomId},
        ${params.inspection.tokenId},
        ${params.inspection.creatorCoinAddress},
        ${params.profileId},
        ${params.inspection.executionAddress},
        ${params.verifiedSignerAddress},
        ${params.inspection.verificationMethod},
        ${params.inspection.verificationBlock},
        ${params.inspection.coinName},
        ${params.inspection.coinSymbol},
        ${params.inspection.coinDecimals},
        ${JSON.stringify(params.inspection.owners)}::jsonb,
        ${params.inspection.creatorCoinPayoutRecipient},
        ${params.inspection.policyControllerAddress},
        ${{
          creator: params.inspection.creator,
          signatureContractValidated: params.contractSignatureValidated,
        }}
      )
      RETURNING *;
    `
    const link = mapLink(result.rows?.[0])
    if (!link) throw new Error('link_insert_failed')
    return link
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    if (message.includes('unique') || message.includes('duplicate')) {
      throw new CreatorCoinLinkError(
        'claimed_by_another_account',
        409,
        'This room or Creator Coin is already linked',
      )
    }
    throw error
  }
}
