import { Agent, createSigner, createUser, getInstallationInfo } from '@xmtp/agent-sdk'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  type Abi,
  type Address,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { getKeeprVaultAutomationByVaultAddress } from '../_lib/keeprAutomation.js'
import { getDb } from '../_lib/postgres.js'
import { logger } from '../_lib/logger.js'
import { resolveXmtpDbDirectory } from '../_lib/xmtpDbDirectory.js'
import {
  fileLooksLikePlainSqlite,
  hasLegacyMigrationBackupForFile,
} from '../_lib/xmtpDbEncryption.js'
import { decryptPrivateKey, ensureCreatorXmtpAgentsSchema } from '../_lib/creatorXmtpAgents.js'
import {
  findCoinbaseSmartWalletOwnerIndex,
  sendCoinbaseSmartWalletUserOperation,
  sendPrivyCoinbaseSmartWalletUserOperation,
  resolvePrivyCoinbaseSmartWalletOwnerContext,
} from '../_lib/privyCoinbaseSmartWallet.js'
import { createPrivyScwSigner } from '../_lib/privyXmtpSigner.js'
import { ensureKeeprSchema } from '../_lib/keeprSchema.js'
import { isOfficialCharmVault, officialCharmVaultError } from '../_lib/charmVaults.js'

declare const process: { env: Record<string, string | undefined>; cwd(): string }

const ETHEREUM_IDENTIFIER_KIND = 0
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const AJNA_MIN_BUCKET_INDEX_MIN = 0n
const AJNA_MIN_BUCKET_INDEX_MAX = 7388n
const AJNA_AUTOMATION_SCOPE = 'ajna_min_bucket_only'

type XmtpActionType =
  | 'xmtp.group.add_member'
  | 'xmtp.group.remove_member'
  | 'xmtp.group.send_message'
  | 'xmtp.group.sync_members'

type StrategyActionType =
  | 'strategy.ajna.rebucket'
  | 'strategy.charm.rebalance'

type SupportedActionType = XmtpActionType | StrategyActionType

const ACTION_ALIASES: Record<string, SupportedActionType> = {
  'xmtp.group.add_member': 'xmtp.group.add_member',
  add_member: 'xmtp.group.add_member',
  addMember: 'xmtp.group.add_member',
  'xmtp.group.remove_member': 'xmtp.group.remove_member',
  remove_member: 'xmtp.group.remove_member',
  removeMember: 'xmtp.group.remove_member',
  'xmtp.group.send_message': 'xmtp.group.send_message',
  send_message: 'xmtp.group.send_message',
  sendMessage: 'xmtp.group.send_message',
  'xmtp.group.sync_members': 'xmtp.group.sync_members',
  sync_members: 'xmtp.group.sync_members',
  syncMembers: 'xmtp.group.sync_members',
  'strategy.ajna.rebucket': 'strategy.ajna.rebucket',
  ajna_rebucket: 'strategy.ajna.rebucket',
  ajnaRebucket: 'strategy.ajna.rebucket',
  'strategy.charm.rebalance': 'strategy.charm.rebalance',
  charm_rebalance: 'strategy.charm.rebalance',
  charmRebalance: 'strategy.charm.rebalance',
}

const AJNA_VAULT_AUTH_ADMIN_ABI = [
  {
    type: 'function',
    name: 'setMinBucketIndex',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'nextMinBucketIndex', type: 'uint256' }],
    outputs: [],
  },
] as const

const AJNA_VAULT_AUTH_VIEW_ABI = [
  {
    type: 'function',
    name: 'admin',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

const CHARM_VAULT_ADMIN_ABI = [
  { type: 'function', name: 'rebalance', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const

const CHARM_VAULT_AUTH_VIEW_ABI = [
  { type: 'function', name: 'manager', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function',
    name: 'rebalanceDelegate',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

type QueueAgentRow = {
  vaultAddress: string
  groupId: string
  canonicalOwnerAddress: string
  creatorAddress: string | null
  xmtpAgentAddress: string | null
  agentType: string | null
  privyWalletId: string | null
  cswAddress: string | null
  encryptedPrivateKeyB64: string | null
  encryptedPrivateKeyIvB64: string | null
  encryptedPrivateKeyTagB64: string | null
}

type GroupLike = {
  members: () => Promise<any[]>
  removeMembers: (inboxIds: string[]) => Promise<unknown>
  sendText: (text: string) => Promise<unknown>
  sync: () => Promise<unknown>
}

type GroupConversationContextLike = {
  isGroup: () => boolean
  conversation: GroupLike
}

export type ExecuteKeeprActionInput = {
  id: number
  vaultAddress: string
  groupId: string
  actionType?: string | null
  action: Record<string, unknown>
}

export type ExecuteKeeprActionResult = {
  success: boolean
  retryable: boolean
  actionType: SupportedActionType | 'unknown'
  error?: string
  details?: Record<string, unknown>
}

class KeeprQueueError extends Error {
  retryable: boolean

  constructor(message: string, retryable: boolean) {
    super(message)
    this.retryable = retryable
  }
}

function parseXmtpEnv(): 'production' | 'dev' | 'local' {
  const raw = String(process.env.XMTP_ENV ?? 'production').trim().toLowerCase()
  if (raw === 'dev' || raw === 'local' || raw === 'production') return raw
  return 'production'
}

function getDbEncryptionKey(): `0x${string}` | undefined {
  const raw = (process.env.XMTP_DB_ENCRYPTION_KEY ?? '').trim()
  if (!raw) return undefined
  return (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`
}

/**
 * Build a stable dbPath for the queue executor so Agent.create() reuses
 * the same installation across invocations. The key must be derived from the
 * agent identity, not a vault address, otherwise one inbox fans out into
 * multiple DBs and multiple XMTP installations.
 */
const KEEPR_XMTP_DB_DIR = resolveXmtpDbDirectory()
const XMTP_DB_FORCE_ENCRYPTED_MIGRATION_REQUESTED = (() => {
  const raw = (process.env.XMTP_DB_FORCE_ENCRYPTED_MIGRATION ?? '0').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
})()
const XMTP_DB_FORCE_ENCRYPTED_MIGRATION_CONFIRM = (process.env.XMTP_DB_FORCE_ENCRYPTED_MIGRATION_CONFIRM ?? '').trim().toLowerCase()
const XMTP_DB_FORCE_ENCRYPTED_MIGRATION =
  XMTP_DB_FORCE_ENCRYPTED_MIGRATION_REQUESTED &&
  XMTP_DB_FORCE_ENCRYPTED_MIGRATION_CONFIRM === 'rotate-db'

function rotateLegacyPlaintextDbIfNeeded(filePath: string): void {
  const encKey = getDbEncryptionKey()
  if (!encKey) return
  if (!XMTP_DB_FORCE_ENCRYPTED_MIGRATION) return
  if (!fileLooksLikePlainSqlite(filePath)) return
  if (hasLegacyMigrationBackupForFile(filePath)) {
    throw new KeeprQueueError(
      'forced_migration_failed_previously_plaintext_db_still_present',
      false,
    )
  }
  const backupPath = `${filePath}.legacy-unencrypted.${Date.now()}`
  try {
    fs.renameSync(filePath, backupPath)
    logger.warn(
      '[keepr/xmtp-queue] Legacy unencrypted DB detected; moved aside to recreate encrypted DB',
      { filePath, backupPath },
    )
  } catch (err) {
    logger.warn('[keepr/xmtp-queue] Failed rotating legacy unencrypted DB (continuing)', {
      filePath,
      error: String(err),
    })
  }
}

function getEffectiveDbEncryptionKeyForPath(filePath: string): `0x${string}` | undefined {
  const encKey = getDbEncryptionKey()
  if (!encKey) return undefined
  if (XMTP_DB_FORCE_ENCRYPTED_MIGRATION_REQUESTED && !XMTP_DB_FORCE_ENCRYPTED_MIGRATION && fileLooksLikePlainSqlite(filePath)) {
    throw new KeeprQueueError(
      'legacy_plaintext_db_detected_requires_confirmed_migration',
      false,
    )
  }
  if (
    XMTP_DB_FORCE_ENCRYPTED_MIGRATION &&
    fileLooksLikePlainSqlite(filePath) &&
    hasLegacyMigrationBackupForFile(filePath)
  ) {
    throw new KeeprQueueError(
      'forced_migration_failed_previously_plaintext_db_still_present',
      false,
    )
  }
  if (!XMTP_DB_FORCE_ENCRYPTED_MIGRATION && fileLooksLikePlainSqlite(filePath)) {
    throw new KeeprQueueError(
      'legacy_plaintext_db_detected_requires_migration',
      false,
    )
  }
  return encKey
}

function resolveKeeprDbIdentityKey(row: QueueAgentRow): string {
  const candidates =
    row.agentType === 'csw'
      ? [row.cswAddress, row.xmtpAgentAddress, row.creatorAddress, row.canonicalOwnerAddress, row.vaultAddress]
      : [row.xmtpAgentAddress, row.creatorAddress, row.canonicalOwnerAddress, row.vaultAddress]
  for (const candidate of candidates) {
    if (isAddressLike(candidate)) return candidate.toLowerCase()
  }
  return row.vaultAddress.toLowerCase()
}

function makeKeeprDbPath(identityKey: string): string {
  fs.mkdirSync(KEEPR_XMTP_DB_DIR, { recursive: true, mode: 0o700 })
  const env = parseXmtpEnv()
  const safe = identityKey.toLowerCase().replace(/[^a-z0-9]/g, '')
  const p = path.join(KEEPR_XMTP_DB_DIR, `keepr-${env}-${safe}.db3`)
  rotateLegacyPlaintextDbIfNeeded(p)
  logger.info(`[keepr/xmtp-queue] Using local database: ${p}`)
  return p
}

function normalizeActionType(actionType?: string | null, actionPayloadType?: string | null): SupportedActionType | null {
  const raw = String(actionType ?? actionPayloadType ?? '').trim()
  if (!raw) return null
  return ACTION_ALIASES[raw] ?? null
}

function isXmtpActionType(actionType: SupportedActionType): actionType is XmtpActionType {
  return actionType.startsWith('xmtp.group.')
}

function isStrategyActionType(actionType: SupportedActionType): actionType is StrategyActionType {
  return actionType.startsWith('strategy.')
}

function isAddressLike(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

function normalizeAddress(value: unknown, field: string): `0x${string}` {
  if (!isAddressLike(value)) throw new KeeprQueueError(`invalid_${field}`, false)
  return value.toLowerCase().trim() as `0x${string}`
}

function getWalletAddressFromAction(action: Record<string, unknown>): `0x${string}` {
  return normalizeAddress(action.wallet ?? action.walletAddress ?? action.address, 'wallet')
}

function getMessageTextFromAction(action: Record<string, unknown>): string {
  const raw = action.message ?? action.content
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) throw new KeeprQueueError('missing_message', false)
  return text
}

function getWalletArrayForSync(action: Record<string, unknown>): `0x${string}`[] {
  const candidates = action.wallets ?? action.members
  if (!Array.isArray(candidates)) return []
  const out = new Set<`0x${string}`>()
  for (const item of candidates) {
    if (!isAddressLike(item)) {
      throw new KeeprQueueError('invalid_sync_member_wallet', false)
    }
    out.add(item.toLowerCase().trim() as `0x${string}`)
  }
  return [...out]
}

function getBaseRpcUrl(): string {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  return raw || 'https://mainnet.base.org'
}

function getKeeperAccount() {
  const pk = (process.env.KEEPR_PRIVATE_KEY ?? '').trim()
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new KeeprQueueError('keeper_private_key_missing', false)
  }
  return privateKeyToAccount(pk as `0x${string}`)
}

function getBundlerAndPaymasterUrl(): string {
  const direct =
    (process.env.CDP_PAYMASTER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT ?? '').trim() ||
    (process.env.PAYMASTER_URL ?? '').trim() ||
    (process.env.BUNDLER_URL ?? '').trim()
  if (!direct) {
    throw new KeeprQueueError('cdp_paymaster_url_missing', false)
  }
  return direct
}

async function executeCharmRebalanceViaCswUserOperation(params: {
  publicClient: any
  ownerAccount: ReturnType<typeof privateKeyToAccount>
  charmVaultAddress: `0x${string}`
  cswAddress: `0x${string}`
}): Promise<{ userOpHash: `0x${string}`; txHash: `0x${string}`; smartWallet: `0x${string}`; ownerIndex: number }> {
  const bundlerUrl = getBundlerAndPaymasterUrl()
  const ownerAddress = getAddress(params.ownerAccount.address as Address)
  const smartWallet = getAddress(params.cswAddress as Address)
  let ownerIndex: number | null
  try {
    ownerIndex = await findCoinbaseSmartWalletOwnerIndex({
      publicClient: params.publicClient,
      smartWallet,
      ownerAddress,
      maxScan: 512,
    })
  } catch (err) {
    const helperError = toKeeprQueueErrorFromCoinbaseSmartWalletHelper(err)
    if (helperError) throw helperError
    throw err
  }
  if (ownerIndex === null) {
    throw new KeeprQueueError('keeper_not_csw_owner', false)
  }

  const rebalanceCalldata = encodeFunctionData({
    abi: CHARM_VAULT_ADMIN_ABI as unknown as Abi,
    functionName: 'rebalance',
    args: [],
  })

  try {
    return await sendCoinbaseSmartWalletUserOperation({
      publicClient: params.publicClient,
      bundlerUrl,
      smartWallet,
      ownerAccount: params.ownerAccount,
      ownerIndex,
      calls: [{ to: params.charmVaultAddress, value: 0n, data: rebalanceCalldata }],
      simulate: false,
    })
  } catch (err) {
    const helperError = toKeeprQueueErrorFromCoinbaseSmartWalletHelper(err)
    if (helperError) throw helperError
    throw err
  }
}

function parseUintLikeFromAction(action: Record<string, unknown>, key: string): bigint {
  const raw = action[key]
  if (typeof raw === 'bigint') {
    if (raw < 0n) throw new KeeprQueueError(`invalid_${key}`, false)
    return raw
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0 || !Number.isInteger(raw)) {
      throw new KeeprQueueError(`invalid_${key}`, false)
    }
    return BigInt(raw)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) throw new KeeprQueueError(`missing_${key}`, false)
    try {
      const out = BigInt(trimmed)
      if (out < 0n) throw new KeeprQueueError(`invalid_${key}`, false)
      return out
    } catch {
      throw new KeeprQueueError(`invalid_${key}`, false)
    }
  }
  throw new KeeprQueueError(`missing_${key}`, false)
}

function assertAjnaMinBucketIndex(value: bigint, label: string): void {
  if (value < AJNA_MIN_BUCKET_INDEX_MIN || value > AJNA_MIN_BUCKET_INDEX_MAX) {
    throw new KeeprQueueError(
      `${label} must be between ${AJNA_MIN_BUCKET_INDEX_MIN.toString()} and ${AJNA_MIN_BUCKET_INDEX_MAX.toString()}`,
      false,
    )
  }
}

function getAjnaAutomationContextOrThrow(row: Awaited<ReturnType<typeof getKeeprVaultAutomationByVaultAddress>>) {
  if (
    !row?.canonicalCswAddress ||
    !isAddressLike(row.canonicalCswAddress) ||
    !row?.privyWalletId ||
    !row?.embeddedEoaAddress ||
    !isAddressLike(row.embeddedEoaAddress)
  ) {
    throw new KeeprQueueError('ajna_automation_context_missing', false)
  }
  if (!row.automationEnabled || row.revokedAt) {
    throw new KeeprQueueError('ajna_automation_disabled', false)
  }
  if (row.automationScope !== AJNA_AUTOMATION_SCOPE) {
    throw new KeeprQueueError('ajna_automation_scope_invalid', false)
  }

  return {
    canonicalCswAddress: normalizeAddress(row.canonicalCswAddress, 'canonicalCswAddress'),
    embeddedEoaAddress: normalizeAddress(row.embeddedEoaAddress, 'embeddedEoaAddress'),
    privyWalletId: String(row.privyWalletId),
  }
}

function getCoinbaseSmartWalletHelperErrorSignal(
  error: unknown,
): { code: string; retryable: boolean } | null {
  if (typeof error !== 'object' || error === null) return null
  const code = (error as { code?: unknown }).code
  const retryable = (error as { retryable?: unknown }).retryable
  if (typeof code !== 'string' || typeof retryable !== 'boolean') return null
  return { code, retryable }
}

function toKeeprQueueErrorFromCoinbaseSmartWalletHelper(
  error: unknown,
  prefix?: string,
): KeeprQueueError | null {
  const helperError = getCoinbaseSmartWalletHelperErrorSignal(error)
  if (!helperError) return null
  return new KeeprQueueError(
    prefix ? `${prefix}:${helperError.code}` : helperError.code,
    helperError.retryable,
  )
}

function isLikelyRetryableRpcError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('timeout') ||
    m.includes('timed out') ||
    m.includes('network') ||
    m.includes('temporar') ||
    m.includes('rate limit') ||
    m.includes('too many requests') ||
    m.includes('429') ||
    m.includes('503') ||
    m.includes('gateway') ||
    m.includes('socket hang up') ||
    m.includes('connection reset')
  )
}

function getEthereumAddressFromMember(member: any): `0x${string}` | null {
  const identifiers = Array.isArray(member?.accountIdentifiers) ? member.accountIdentifiers : []
  for (const id of identifiers) {
    const kind = id?.identifierKind
    const address = typeof id?.identifier === 'string' ? id.identifier : ''
    if ((kind === ETHEREUM_IDENTIFIER_KIND || kind === 'Ethereum') && isAddressLike(address)) {
      return address.toLowerCase() as `0x${string}`
    }
  }
  return null
}

async function loadQueueAgentRow(vaultAddress: `0x${string}`): Promise<QueueAgentRow | null> {
  const db = await getDb()
  if (!db) throw new KeeprQueueError('db_not_configured', false)

  await ensureKeeprSchema()
  await ensureCreatorXmtpAgentsSchema(db as any)

  const q = await db.sql`
    SELECT
      v.vault_address,
      v.group_id,
      v.canonical_owner_address,
      a.creator_address,
      a.xmtp_agent_address,
      a.agent_type,
      a.privy_wallet_id,
      a.csw_address,
      a.encrypted_private_key_b64,
      a.encrypted_private_key_iv_b64,
      a.encrypted_private_key_tag_b64
    FROM keepr_vaults v
    LEFT JOIN creator_xmtp_agents a
      ON LOWER(a.creator_address) = LOWER(v.canonical_owner_address)
    WHERE LOWER(v.vault_address) = ${vaultAddress}
    LIMIT 1;
  `

  const row = (q.rows ?? [])[0] as any
  if (!row) return null

  return {
    vaultAddress: String(row.vault_address).toLowerCase(),
    groupId: String(row.group_id),
    canonicalOwnerAddress: String(row.canonical_owner_address).toLowerCase(),
    creatorAddress: row.creator_address ? String(row.creator_address).toLowerCase() : null,
    xmtpAgentAddress: row.xmtp_agent_address ? String(row.xmtp_agent_address).toLowerCase() : null,
    agentType: row.agent_type ? String(row.agent_type).toLowerCase() : null,
    privyWalletId: row.privy_wallet_id ? String(row.privy_wallet_id) : null,
    cswAddress: row.csw_address ? String(row.csw_address).toLowerCase() : null,
    encryptedPrivateKeyB64: row.encrypted_private_key_b64 ? String(row.encrypted_private_key_b64) : null,
    encryptedPrivateKeyIvB64: row.encrypted_private_key_iv_b64 ? String(row.encrypted_private_key_iv_b64) : null,
    encryptedPrivateKeyTagB64: row.encrypted_private_key_tag_b64 ? String(row.encrypted_private_key_tag_b64) : null,
  }
}

function isLikelyNonRetryableExecutionError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('permission') ||
    m.includes('forbidden') ||
    m.includes('unauthorized') ||
    m.includes('invalid') ||
    m.includes('not found') ||
    m.includes('missing') ||
    m.includes('revert') ||
    m.includes('unknown action')
  )
}

async function resolveInboxIdForAddress(agent: Agent, address: `0x${string}`): Promise<string | null> {
  const identifier = {
    identifier: address,
    identifierKind: ETHEREUM_IDENTIFIER_KIND as any,
  }
  return agent.client.fetchInboxIdByIdentifier(identifier)
}

async function resolveGroupConversationContext(
  agent: Agent,
  groupId: string,
): Promise<GroupConversationContextLike | null> {
  let ctx = await agent.getConversationContext(groupId)
  if (ctx?.isGroup()) return ctx as unknown as GroupConversationContextLike

  // Recovery path: if the installation is fresh, local DB might not have this group yet.
  // Try a lightweight conversations sync and retry before declaring "group_not_found".
  const conversationsApi = (agent.client as any)?.conversations as any
  if (conversationsApi && typeof conversationsApi.sync === 'function') {
    try {
      await conversationsApi.sync()
    } catch {
      // best effort
    }
  }

  ctx = await agent.getConversationContext(groupId)
  if (ctx?.isGroup()) return ctx as unknown as GroupConversationContextLike

  // Last resort: list groups and match by id.
  if (conversationsApi && typeof conversationsApi.listGroups === 'function') {
    try {
      const groups = await conversationsApi.listGroups()
      const group = Array.isArray(groups)
        ? groups.find((g: any) => String(g?.id ?? '') === groupId)
        : null
      if (group) {
        return {
          isGroup: () => true,
          conversation: group as GroupLike,
        }
      }
    } catch {
      // best effort
    }
  }

  return null
}

async function persistVaultGroupId(
  vaultAddress: `0x${string}`,
  groupId: string,
): Promise<void> {
  const db = await getDb()
  if (!db) return
  await ensureKeeprSchema()

  await db.sql`
    UPDATE keepr_vaults
      SET group_id = ${groupId},
          updated_at = NOW()
    WHERE LOWER(vault_address) = ${vaultAddress.toLowerCase()};
  `
}

async function bootstrapMissingGroupForVault(params: {
  agent: Agent
  vaultAddress: `0x${string}`
}): Promise<{ groupId: string; context: GroupConversationContextLike } | null> {
  try {
    // Create a minimal self-owned group. Membership actions can add others later.
    const group = await params.agent.createGroupWithAddresses([])
    const groupId = String((group as any)?.id ?? '').trim()
    if (!groupId) return null

    await persistVaultGroupId(params.vaultAddress, groupId).catch((err) => {
      logger.warn('[keepr/xmtp-queue] failed to persist bootstrapped group id', {
        vaultAddress: params.vaultAddress,
        groupId,
        error: String(err),
      })
    })

    const context = await resolveGroupConversationContext(params.agent, groupId)
    if (context?.isGroup()) {
      return { groupId, context }
    }
    return null
  } catch (err) {
    logger.warn('[keepr/xmtp-queue] failed to bootstrap missing group', {
      vaultAddress: params.vaultAddress,
      error: String(err),
    })
    return null
  }
}

async function executeStrategyAction(
  actionType: StrategyActionType,
  action: Record<string, unknown>,
  options?: { queueRow?: QueueAgentRow | null; vaultAddress?: `0x${string}` },
): Promise<Record<string, unknown>> {
  const rpcUrl = getBaseRpcUrl()
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) }) as any

  if (actionType === 'strategy.ajna.rebucket') {
    const targetBucket = parseUintLikeFromAction(action, 'targetBucket')
    assertAjnaMinBucketIndex(targetBucket, 'targetBucket')
    const methodRaw = typeof action.method === 'string' ? action.method.trim() : ''
    if (methodRaw && methodRaw !== 'setMinBucketIndex') {
      throw new KeeprQueueError('invalid_method', false)
    }
    const authAddress = normalizeAddress(action.authAddress ?? action.targetAddress, 'authAddress')
    const strategyAddress =
      action.strategyAddress == null ? null : normalizeAddress(action.strategyAddress, 'strategyAddress')
    const automationRow =
      options?.vaultAddress ? await getKeeprVaultAutomationByVaultAddress(options.vaultAddress) : null
    if (options?.vaultAddress && !automationRow) {
      const db = await getDb()
      if (!db) {
        throw new KeeprQueueError('ajna_automation_backend_unavailable', true)
      }
    }
    const automation = getAjnaAutomationContextOrThrow(automationRow)

    let authAdminRaw: unknown
    try {
      authAdminRaw = await publicClient.readContract({
        address: authAddress,
        abi: AJNA_VAULT_AUTH_VIEW_ABI,
        functionName: 'admin',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new KeeprQueueError(`ajna_auth_admin_read_failed:${message}`, isLikelyRetryableRpcError(message))
    }
    if (!isAddressLike(authAdminRaw)) {
      throw new KeeprQueueError('ajna_auth_admin_unreadable', false)
    }
    const authAdmin = normalizeAddress(authAdminRaw, 'authAdmin')
    if (authAdmin !== automation.canonicalCswAddress) {
      logger.warn('[keepr/xmtp-queue] canonical CSW cannot rebucket Ajna auth', {
        authAddress,
        authAdmin,
        canonicalCswAddress: automation.canonicalCswAddress,
      })
      throw new KeeprQueueError(
        `ajna_auth_admin_mismatch:canonical=${automation.canonicalCswAddress}:admin=${authAdmin}`,
        false,
      )
    }

    const rebucketCalldata = encodeFunctionData({
      abi: AJNA_VAULT_AUTH_ADMIN_ABI as unknown as Abi,
      functionName: 'setMinBucketIndex',
      args: [targetBucket],
    })

    let ownerContext: { ownerAddress: `0x${string}`; ownerIndex: number }
    try {
      ownerContext = await resolvePrivyCoinbaseSmartWalletOwnerContext({
        publicClient,
        walletId: automation.privyWalletId,
        smartWallet: automation.canonicalCswAddress,
        expectedOwnerAddress: automation.embeddedEoaAddress,
        maxScan: 512,
      })
    } catch (err) {
      const helperError = toKeeprQueueErrorFromCoinbaseSmartWalletHelper(
        err,
        'ajna_owner_revalidation_failed',
      )
      if (helperError) throw helperError
      const message = err instanceof Error ? err.message : String(err)
      throw new KeeprQueueError(`ajna_owner_revalidation_failed:${message}`, false)
    }

    let viaUserOp: {
      userOpHash: `0x${string}`
      txHash: `0x${string}`
      smartWallet: `0x${string}`
      ownerAddress: `0x${string}`
      ownerIndex: number
    }
    try {
      viaUserOp = await sendPrivyCoinbaseSmartWalletUserOperation({
        publicClient,
        bundlerUrl: getBundlerAndPaymasterUrl(),
        walletId: automation.privyWalletId,
        smartWallet: automation.canonicalCswAddress,
        ownerAddress: ownerContext.ownerAddress,
        ownerIndex: ownerContext.ownerIndex,
        calls: [{ to: authAddress, value: 0n, data: rebucketCalldata }],
        simulate: true,
      })
    } catch (err) {
      const helperError = toKeeprQueueErrorFromCoinbaseSmartWalletHelper(err, 'ajna_userop_failed')
      if (helperError) throw helperError
      const message = err instanceof Error ? err.message : String(err)
      if (message === 'transaction_reverted') {
        throw new KeeprQueueError(message, false)
      }
      throw new KeeprQueueError(`ajna_userop_failed:${message}`, isLikelyRetryableRpcError(message))
    }

    return {
      txHash: viaUserOp.txHash,
      userOpHash: viaUserOp.userOpHash,
      sender: viaUserOp.smartWallet,
      ownerAddress: viaUserOp.ownerAddress,
      ownerIndex: viaUserOp.ownerIndex,
      mode: 'erc4337_privy',
      strategyAddress,
      authAddress,
      targetAddress: authAddress,
      method: 'setMinBucketIndex',
      targetBucket: targetBucket.toString(),
    }
  }

  const account = getKeeperAccount()
  const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl, { timeout: 30_000 }) })
  const charmVaultAddress = normalizeAddress(
    action.charmVaultAddress ?? action.strategyAddress,
    'charmVaultAddress',
  )
  const isOfficialVault = await isOfficialCharmVault({
    charmVaultAddress,
    publicClient,
  })
  if (!isOfficialVault) {
    throw new KeeprQueueError(officialCharmVaultError(charmVaultAddress), false)
  }

  const keeperAddress = normalizeAddress(account.address, 'keeperAddress')
  const [managerRaw, delegateRaw] = (await Promise.all([
    publicClient
      .readContract({
        address: charmVaultAddress,
        abi: CHARM_VAULT_AUTH_VIEW_ABI,
        functionName: 'manager',
      })
      .catch(() => null),
    publicClient
      .readContract({
        address: charmVaultAddress,
        abi: CHARM_VAULT_AUTH_VIEW_ABI,
        functionName: 'rebalanceDelegate',
      })
      .catch(() => null),
  ])) as [unknown, unknown]

  const managerAddress = isAddressLike(managerRaw) ? normalizeAddress(managerRaw, 'manager') : null
  const delegateAddress = isAddressLike(delegateRaw) ? normalizeAddress(delegateRaw, 'rebalanceDelegate') : null
  const rowCswAddress =
    options?.queueRow?.cswAddress && isAddressLike(options.queueRow.cswAddress)
      ? normalizeAddress(options.queueRow.cswAddress, 'cswAddress')
      : null

  const cswCandidates = Array.from(
    new Set(
      [rowCswAddress, delegateAddress, managerAddress].filter(
        (addr): addr is `0x${string}` => Boolean(addr && addr !== ZERO_ADDRESS && addr !== keeperAddress),
      ),
    ),
  )

  let lastUserOpError: unknown = null
  let retryableUserOpError: unknown = null
  for (const cswAddress of cswCandidates) {
    try {
      const viaUserOp = await executeCharmRebalanceViaCswUserOperation({
        publicClient,
        ownerAccount: account,
        charmVaultAddress,
        cswAddress,
      })
      return {
        txHash: viaUserOp.txHash,
        userOpHash: viaUserOp.userOpHash,
        sender: viaUserOp.smartWallet,
        ownerIndex: viaUserOp.ownerIndex,
        mode: 'erc4337_paymaster',
        charmVaultAddress,
      }
    } catch (err) {
      lastUserOpError = err
      const message = err instanceof Error ? err.message : String(err)
      const retryable = err instanceof KeeprQueueError ? err.retryable : isLikelyRetryableRpcError(message)
      if (!retryableUserOpError && retryable) {
        retryableUserOpError = err
      }
      logger.warn('[keepr/xmtp-queue] charm rebalance userop path failed', {
        charmVaultAddress,
        cswAddress,
        error: message,
      })
    }
  }

  const keeperCanDirectlyRebalance =
    (delegateAddress && delegateAddress === keeperAddress) || (managerAddress && managerAddress === keeperAddress)

  if (keeperCanDirectlyRebalance) {
    const txHash = await walletClient.writeContract({
      address: charmVaultAddress,
      abi: CHARM_VAULT_ADMIN_ABI as unknown as Abi,
      functionName: 'rebalance',
      args: [],
      chain: base,
      account,
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })
    if (receipt.status !== 'success') {
      throw new KeeprQueueError('transaction_reverted', false)
    }
    return {
      txHash,
      charmVaultAddress,
      mode: 'direct_eoa',
    }
  }

  if (retryableUserOpError instanceof KeeprQueueError) throw retryableUserOpError
  if (retryableUserOpError) {
    const msg =
      retryableUserOpError instanceof Error ? retryableUserOpError.message : String(retryableUserOpError)
    throw new KeeprQueueError(`charm_rebalance_userop_failed:${msg}`, true)
  }
  if (lastUserOpError instanceof KeeprQueueError) throw lastUserOpError
  if (lastUserOpError) {
    const msg = lastUserOpError instanceof Error ? lastUserOpError.message : String(lastUserOpError)
    throw new KeeprQueueError(`charm_rebalance_userop_failed:${msg}`, isLikelyRetryableRpcError(msg))
  }
  throw new KeeprQueueError('charm_rebalance_not_authorized_for_keeper', false)

  return {
    charmVaultAddress,
    mode: 'unknown',
  }
}

async function executeNormalizedAction(
  actionType: XmtpActionType,
  action: Record<string, unknown>,
  agent: Agent,
  group: GroupLike,
): Promise<Record<string, unknown> | undefined> {
  if (actionType === 'xmtp.group.add_member') {
    const wallet = getWalletAddressFromAction(action)
    await agent.addMembersWithAddresses(group as any, [wallet])
    return { wallet }
  }

  if (actionType === 'xmtp.group.remove_member') {
    const wallet = getWalletAddressFromAction(action)
    const inboxId = await resolveInboxIdForAddress(agent, wallet)
    if (!inboxId) {
      // Idempotent no-op: if the inbox cannot be resolved, it's not in the group.
      return { wallet, removed: false, reason: 'inbox_not_found' }
    }
    await group.removeMembers([inboxId])
    return { wallet, removed: true }
  }

  if (actionType === 'xmtp.group.send_message') {
    const message = getMessageTextFromAction(action)
    await group.sendText(message)
    return { messageLength: message.length }
  }

  if (actionType === 'xmtp.group.sync_members') {
    const desiredWallets = getWalletArrayForSync(action)
    if (desiredWallets.length === 0) {
      await group.sync()
      return { synced: true, desiredCount: 0, added: 0, removed: 0 }
    }

    const members = await group.members()
    const selfInbox = agent.client.inboxId

    const currentByAddress = new Map<`0x${string}`, string>()
    for (const member of members) {
      const addr = getEthereumAddressFromMember(member)
      const inboxId = typeof member?.inboxId === 'string' ? member.inboxId : ''
      if (addr && inboxId) currentByAddress.set(addr, inboxId)
    }

    const desiredSet = new Set(desiredWallets)
    const toAdd = desiredWallets.filter((addr) => !currentByAddress.has(addr))
    const toRemove = [...currentByAddress.entries()]
      .filter(([addr, inboxId]) => !desiredSet.has(addr) && inboxId !== selfInbox)
      .map(([, inboxId]) => inboxId)

    if (toAdd.length > 0) await agent.addMembersWithAddresses(group as any, toAdd)
    if (toRemove.length > 0) await group.removeMembers(toRemove)

    return {
      synced: true,
      desiredCount: desiredWallets.length,
      added: toAdd.length,
      removed: toRemove.length,
    }
  }

  throw new KeeprQueueError(`unknown_action_type:${actionType}`, false)
}

export async function executeKeeprAction(input: ExecuteKeeprActionInput): Promise<ExecuteKeeprActionResult> {
  const normalizedVaultAddress = normalizeAddress(input.vaultAddress, 'vaultAddress')
  const normalizedActionType = normalizeActionType(input.actionType, String((input.action as any)?.action ?? ''))
  if (!normalizedActionType) {
    return { success: false, retryable: false, actionType: 'unknown', error: 'unknown_action_type' }
  }

  let agent: Agent | null = null
  try {
    const row = await loadQueueAgentRow(normalizedVaultAddress)
    if (!row) {
      return { success: false, retryable: false, actionType: normalizedActionType, error: 'vault_not_configured' }
    }
    if (isStrategyActionType(normalizedActionType)) {
      const details = await executeStrategyAction(normalizedActionType, input.action ?? {}, {
        queueRow: row,
        vaultAddress: normalizedVaultAddress,
      })
      return {
        success: true,
        retryable: false,
        actionType: normalizedActionType,
        details,
      }
    }

    const requestedGroupId = String(input.groupId)
    let effectiveGroupId = requestedGroupId
    if (row.groupId !== requestedGroupId) {
      // Prefer current vault config to avoid hard-failing stale queued actions
      // after a group migration/bootstrap.
      logger.warn('[keepr/xmtp-queue] group id mismatch, using configured vault group', {
        actionId: input.id,
        requestedGroupId,
        configuredGroupId: row.groupId,
      })
      effectiveGroupId = row.groupId
    }

    if (!row.creatorAddress) {
      return { success: false, retryable: false, actionType: normalizedActionType, error: 'creator_agent_not_configured' }
    }

    let signer: any
    if (row.agentType === 'csw' && row.privyWalletId && row.cswAddress) {
      const ownerIndexEnv = (process.env.XMTP_AGENT_CSW_OWNER_INDEX ?? '').trim()
      const ownerIndexRaw = ownerIndexEnv ? Number(ownerIndexEnv) : Number.NaN
      const ownerIndex =
        Number.isFinite(ownerIndexRaw) && ownerIndexRaw >= 0
          ? Math.floor(ownerIndexRaw)
          : undefined
      signer = createPrivyScwSigner({
        walletId: row.privyWalletId,
        cswAddress: normalizeAddress(row.cswAddress, 'cswAddress'),
        chainId: 8453,
        ...(ownerIndex !== undefined ? { ownerIndex } : {}),
      })
    } else {
      if (!row.encryptedPrivateKeyB64 || !row.encryptedPrivateKeyIvB64 || !row.encryptedPrivateKeyTagB64) {
        return { success: false, retryable: false, actionType: normalizedActionType, error: 'agent_private_key_missing' }
      }
      const privKey = decryptPrivateKey({
        ciphertextB64: row.encryptedPrivateKeyB64,
        ivB64: row.encryptedPrivateKeyIvB64,
        tagB64: row.encryptedPrivateKeyTagB64,
        aad: `creator:${row.creatorAddress}`,
      })
      signer = createSigner(createUser(privKey))
    }

    const dbPath = makeKeeprDbPath(resolveKeeprDbIdentityKey(row))
    const encKey = getEffectiveDbEncryptionKeyForPath(dbPath)
    agent = await Agent.create(signer, {
      env: parseXmtpEnv(),
      dbPath,
      ...(encKey ? { dbEncryptionKey: encKey } : {}),
    } as any)

    // Post-create guard: if near the 10-installation limit, proactively revoke
    // all other installations to prevent future 10/10 errors.
    try {
      const info = await getInstallationInfo(agent.client)
      if (info.totalInstallations >= 8) {
        logger.warn('[keepr/xmtp-queue] Inbox has %d/10 installations — auto-revoking others', info.totalInstallations)
        await agent.client.revokeAllOtherInstallations()
        logger.info('[keepr/xmtp-queue] Proactive revocation complete')
      }
    } catch (err) {
      logger.warn('[keepr/xmtp-queue] Post-create installation check failed (non-fatal)', { error: String(err) })
    }

    let conversationCtx = await resolveGroupConversationContext(agent, effectiveGroupId)
    let bootstrappedGroupId: string | null = null
    if (!conversationCtx && isXmtpActionType(normalizedActionType)) {
      const bootstrapped = await bootstrapMissingGroupForVault({
        agent,
        vaultAddress: normalizedVaultAddress,
      })
      if (bootstrapped) {
        conversationCtx = bootstrapped.context
        effectiveGroupId = bootstrapped.groupId
        bootstrappedGroupId = bootstrapped.groupId
      }
    }
    if (!conversationCtx) {
      return { success: false, retryable: false, actionType: normalizedActionType, error: 'group_not_found' }
    }
    if (!conversationCtx.isGroup()) {
      return { success: false, retryable: false, actionType: normalizedActionType, error: 'conversation_is_not_group' }
    }

    const details = await executeNormalizedAction(
      normalizedActionType,
      input.action ?? {},
      agent,
      conversationCtx.conversation,
    )

    return {
      success: true,
      retryable: false,
      actionType: normalizedActionType,
      details: {
        ...(details ?? {}),
        groupId: effectiveGroupId,
        ...(bootstrappedGroupId ? { bootstrappedGroupId } : {}),
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const helperError = getCoinbaseSmartWalletHelperErrorSignal(err)
    const retryable =
      err instanceof KeeprQueueError
        ? err.retryable
        : helperError
          ? helperError.retryable
          : isLikelyRetryableRpcError(message) || !isLikelyNonRetryableExecutionError(message)
    logger.error('[keepr/xmtp-queue] execute failed', {
      actionId: input.id,
      actionType: normalizedActionType,
      error: message,
      retryable,
    })
    return {
      success: false,
      retryable,
      actionType: normalizedActionType,
      error: message,
    }
  } finally {
    try {
      await agent?.stop()
    } catch {}
  }
}
