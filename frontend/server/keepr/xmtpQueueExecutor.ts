import { Agent, createSigner, createUser, getInstallationInfo } from '@xmtp/agent-sdk'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { getDb } from '../_lib/postgres.js'
import { logger } from '../_lib/logger.js'
import { resolveXmtpDbDirectory } from '../_lib/xmtpDbDirectory.js'
import { decryptPrivateKey, ensureCreatorXmtpAgentsSchema } from '../_lib/creatorXmtpAgents.js'
import { createPrivyScwSigner } from '../_lib/privyXmtpSigner.js'
import { ensureKeeprSchema } from '../_lib/keeprSchema.js'

declare const process: { env: Record<string, string | undefined>; cwd(): string }

const ETHEREUM_IDENTIFIER_KIND = 0

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
}

type SupportedActionType =
  | 'xmtp.group.add_member'
  | 'xmtp.group.remove_member'
  | 'xmtp.group.send_message'
  | 'xmtp.group.sync_members'

type QueueAgentRow = {
  vaultAddress: string
  groupId: string
  canonicalOwnerAddress: string
  creatorAddress: string | null
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
 * the same installation across invocations instead of registering a new one
 * every time (which burns through the 10-installation limit).
 */
const KEEPR_XMTP_DB_DIR = resolveXmtpDbDirectory()
const SQLITE_HEADER = Buffer.from('SQLite format 3\u0000', 'utf8')
const XMTP_DB_FORCE_ENCRYPTED_MIGRATION = (process.env.XMTP_DB_FORCE_ENCRYPTED_MIGRATION ?? '0').trim() === '1'

function fileLooksLikePlainSqlite(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false
    const fd = fs.openSync(filePath, 'r')
    try {
      const header = Buffer.alloc(SQLITE_HEADER.length)
      const bytesRead = fs.readSync(fd, header, 0, header.length, 0)
      if (bytesRead !== SQLITE_HEADER.length) return false
      return header.equals(SQLITE_HEADER)
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return false
  }
}

function rotateLegacyPlaintextDbIfNeeded(filePath: string): void {
  const encKey = getDbEncryptionKey()
  if (!encKey) return
  if (!XMTP_DB_FORCE_ENCRYPTED_MIGRATION) return
  if (!fileLooksLikePlainSqlite(filePath)) return
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
  if (!XMTP_DB_FORCE_ENCRYPTED_MIGRATION && fileLooksLikePlainSqlite(filePath)) {
    logger.warn(
      '[keepr/xmtp-queue] Legacy plaintext DB detected; using compatibility mode for this run. ' +
      'Set XMTP_DB_FORCE_ENCRYPTED_MIGRATION=1 to force encrypted migration.',
      { filePath },
    )
    return undefined
  }
  return encKey
}

function makeKeeprDbPath(vaultAddress: string): string {
  fs.mkdirSync(KEEPR_XMTP_DB_DIR, { recursive: true, mode: 0o700 })
  const env = parseXmtpEnv()
  const safe = vaultAddress.toLowerCase().replace(/[^a-z0-9]/g, '')
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

async function executeNormalizedAction(
  actionType: SupportedActionType,
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
    if (row.groupId !== String(input.groupId)) {
      return { success: false, retryable: false, actionType: normalizedActionType, error: 'group_mismatch' }
    }
    if (!row.creatorAddress) {
      return { success: false, retryable: false, actionType: normalizedActionType, error: 'creator_agent_not_configured' }
    }

    let signer: any
    if (row.agentType === 'csw' && row.privyWalletId && row.cswAddress) {
      signer = createPrivyScwSigner({
        walletId: row.privyWalletId,
        cswAddress: normalizeAddress(row.cswAddress, 'cswAddress'),
        chainId: 8453,
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

    const dbPath = makeKeeprDbPath(normalizedVaultAddress)
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

    const conversationCtx = await agent.getConversationContext(input.groupId)
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
      details,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const retryable =
      err instanceof KeeprQueueError ? err.retryable : !isLikelyNonRetryableExecutionError(message)
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
