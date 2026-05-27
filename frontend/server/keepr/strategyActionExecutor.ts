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

import { getKeeprVaultAutomationByVaultAddress } from '../_lib/keepr/keeprAutomation.js'
import {
  formatTrustZoneDisabledError,
  isKeeprTrustZoneWriteEnabled,
  resolveKeeprEffectiveActionType,
  resolveKeeprTrustZone,
} from '../_lib/agentControl/trustZones.js'
import { getDb } from '../_lib/db/postgres.js'
import { logger } from '../_lib/infra/logger.js'
import { ensureCreatorXmtpAgentsSchema } from '../_lib/messaging/creatorXmtpAgents.js'
import {
  findCoinbaseSmartWalletOwnerIndex,
  sendCoinbaseSmartWalletUserOperation,
  sendPrivyCoinbaseSmartWalletUserOperation,
  resolvePrivyCoinbaseSmartWalletOwnerContext,
} from '../_lib/wallet/privyCoinbaseSmartWallet.js'
import { ensureKeeprSchema } from '../_lib/keepr/keeprSchema.js'
import { isOfficialCharmVault, officialCharmVaultError } from '../_lib/deploy/charmVaults.js'
import {
  executeViaProtocolAutomationSafe,
  executeViaProtocolTreasurySafe,
  readCharmVaultAuthSnapshot,
  resolveCharmKeeperAuthorization,
  resolveKeeperAutomationPrivateKey,
  isProtocolAutomationAjnaAdmin,
  isProtocolTreasuryManager,
  isSameAddress,
} from '../_lib/wallet/protocolTreasurySafe.js'

declare const process: { env: Record<string, string | undefined> }

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const AJNA_MIN_BUCKET_INDEX_MIN = 0n
const AJNA_MIN_BUCKET_INDEX_MAX = 7388n
const AJNA_AUTOMATION_SCOPE = 'ajna_min_bucket_only'

export type StrategyActionType = 'strategy.ajna.rebucket' | 'strategy.charm.rebalance'

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

export type StrategyQueueAgentRow = {
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

export type ExecuteKeeprStrategyActionInput = {
  vaultAddress: string
  actionType?: string | null
  action: Record<string, unknown>
}

export type ExecuteKeeprStrategyActionResult = {
  success: boolean
  retryable: boolean
  actionType: StrategyActionType | 'unknown'
  error?: string
  details?: Record<string, unknown>
}

export class KeeprStrategyError extends Error {
  retryable: boolean

  constructor(message: string, retryable: boolean) {
    super(message)
    this.retryable = retryable
  }
}

function isAddressLike(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

function normalizeAddress(value: unknown, field: string): `0x${string}` {
  if (!isAddressLike(value)) throw new KeeprStrategyError(`invalid_${field}`, false)
  return value.toLowerCase().trim() as `0x${string}`
}

function getBaseRpcUrl(): string {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  return raw || 'https://mainnet.base.org'
}

function getKeeperAccount() {
  const pk = resolveKeeperAutomationPrivateKey()
  if (!pk) {
    throw new KeeprStrategyError('keeper_private_key_missing', false)
  }
  return privateKeyToAccount(pk)
}

function getBundlerAndPaymasterUrl(): string {
  const direct =
    (process.env.CDP_PAYMASTER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT ?? '').trim() ||
    (process.env.PAYMASTER_URL ?? '').trim() ||
    (process.env.BUNDLER_URL ?? '').trim()
  if (!direct) {
    throw new KeeprStrategyError('cdp_paymaster_url_missing', false)
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
    const helperError = toKeeprStrategyErrorFromCoinbaseSmartWalletHelper(err)
    if (helperError) throw helperError
    throw err
  }
  if (ownerIndex === null) {
    throw new KeeprStrategyError('keeper_not_csw_owner', false)
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
    const helperError = toKeeprStrategyErrorFromCoinbaseSmartWalletHelper(err)
    if (helperError) throw helperError
    throw err
  }
}

function parseUintLikeFromAction(action: Record<string, unknown>, key: string): bigint {
  const raw = action[key]
  if (typeof raw === 'bigint') {
    if (raw < 0n) throw new KeeprStrategyError(`invalid_${key}`, false)
    return raw
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0 || !Number.isInteger(raw)) {
      throw new KeeprStrategyError(`invalid_${key}`, false)
    }
    return BigInt(raw)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) throw new KeeprStrategyError(`missing_${key}`, false)
    try {
      const out = BigInt(trimmed)
      if (out < 0n) throw new KeeprStrategyError(`invalid_${key}`, false)
      return out
    } catch {
      throw new KeeprStrategyError(`invalid_${key}`, false)
    }
  }
  throw new KeeprStrategyError(`missing_${key}`, false)
}

function assertAjnaMinBucketIndex(value: bigint, label: string): void {
  if (value < AJNA_MIN_BUCKET_INDEX_MIN || value > AJNA_MIN_BUCKET_INDEX_MAX) {
    throw new KeeprStrategyError(
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
    throw new KeeprStrategyError('ajna_automation_context_missing', false)
  }
  if (!row.automationEnabled || row.revokedAt) {
    throw new KeeprStrategyError('ajna_automation_disabled', false)
  }
  if (row.automationScope !== AJNA_AUTOMATION_SCOPE) {
    throw new KeeprStrategyError('ajna_automation_scope_invalid', false)
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

function toKeeprStrategyErrorFromCoinbaseSmartWalletHelper(
  error: unknown,
  prefix?: string,
): KeeprStrategyError | null {
  const helperError = getCoinbaseSmartWalletHelperErrorSignal(error)
  if (!helperError) return null
  return new KeeprStrategyError(
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

export async function loadStrategyQueueAgentRow(vaultAddress: `0x${string}`): Promise<StrategyQueueAgentRow | null> {
  const db = await getDb()
  if (!db) throw new KeeprStrategyError('db_not_configured', false)

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

export function isStrategyActionType(actionType: string): actionType is StrategyActionType {
  return actionType.startsWith('strategy.')
}

export async function executeStrategyAction(
  actionType: StrategyActionType,
  action: Record<string, unknown>,
  options?: { queueRow?: StrategyQueueAgentRow | null; vaultAddress?: `0x${string}` },
): Promise<Record<string, unknown>> {
  const rpcUrl = getBaseRpcUrl()
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) }) as any

  if (actionType === 'strategy.ajna.rebucket') {
    const targetBucket = parseUintLikeFromAction(action, 'targetBucket')
    assertAjnaMinBucketIndex(targetBucket, 'targetBucket')
    const methodRaw = typeof action.method === 'string' ? action.method.trim() : ''
    if (methodRaw && methodRaw !== 'setMinBucketIndex') {
      throw new KeeprStrategyError('invalid_method', false)
    }
    const authAddress = normalizeAddress(action.authAddress ?? action.targetAddress, 'authAddress')
    const strategyAddress =
      action.strategyAddress == null ? null : normalizeAddress(action.strategyAddress, 'strategyAddress')

    let authAdminRaw: unknown
    try {
      authAdminRaw = await publicClient.readContract({
        address: authAddress,
        abi: AJNA_VAULT_AUTH_VIEW_ABI,
        functionName: 'admin',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new KeeprStrategyError(`ajna_auth_admin_read_failed:${message}`, isLikelyRetryableRpcError(message))
    }
    if (!isAddressLike(authAdminRaw)) {
      throw new KeeprStrategyError('ajna_auth_admin_unreadable', false)
    }
    const authAdmin = normalizeAddress(authAdminRaw, 'authAdmin')

    const automationRow =
      options?.vaultAddress ? await getKeeprVaultAutomationByVaultAddress(options.vaultAddress) : null

    const rebucketCalldata = encodeFunctionData({
      abi: AJNA_VAULT_AUTH_ADMIN_ABI as unknown as Abi,
      functionName: 'setMinBucketIndex',
      args: [targetBucket],
    })

    const rebucketResultBase = {
      strategyAddress,
      authAddress,
      targetAddress: authAddress,
      method: 'setMinBucketIndex',
      targetBucket: targetBucket.toString(),
    }

    if (isProtocolAutomationAjnaAdmin(authAdmin)) {
      try {
        const viaSafe = await executeViaProtocolAutomationSafe({
          publicClient,
          rpcUrl,
          to: authAddress,
          data: rebucketCalldata,
        })
        return {
          ...rebucketResultBase,
          txHash: viaSafe.txHash,
          mode: 'protocol_automation_safe',
          safeAddress: viaSafe.safeAddress,
          signerAddress: viaSafe.signerAddress,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (message.startsWith('protocol_automation_safe_owner_key_missing')) {
          throw new KeeprStrategyError(message, false)
        }
        if (message.startsWith('protocol_automation_safe_not_configured')) {
          throw new KeeprStrategyError(message, false)
        }
        if (message.startsWith('protocol_automation_safe_signer_not_owner')) {
          throw new KeeprStrategyError(message, false)
        }
        throw new KeeprStrategyError(
          `protocol_automation_safe_failed:${message}`,
          isLikelyRetryableRpcError(message),
        )
      }
    }

    if (isProtocolTreasuryManager(authAdmin)) {
      try {
        const viaSafe = await executeViaProtocolTreasurySafe({
          publicClient,
          rpcUrl,
          to: authAddress,
          data: rebucketCalldata,
        })
        return {
          ...rebucketResultBase,
          txHash: viaSafe.txHash,
          mode: 'protocol_treasury_safe',
          safeAddress: viaSafe.safeAddress,
          signerAddress: viaSafe.signerAddress,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        throw new KeeprStrategyError(`protocol_treasury_safe_failed:${message}`, isLikelyRetryableRpcError(message))
      }
    }

    if (options?.vaultAddress && !automationRow) {
      const db = await getDb()
      if (!db) {
        throw new KeeprStrategyError('ajna_automation_backend_unavailable', true)
      }
      throw new KeeprStrategyError('ajna_automation_context_missing', false)
    }
    const automation = getAjnaAutomationContextOrThrow(automationRow)
    if (!isSameAddress(authAdmin, automation.canonicalCswAddress)) {
      logger.warn('[keepr/strategy] legacy CSW Ajna rebucket admin mismatch', {
        authAddress,
        authAdmin,
        canonicalCswAddress: automation.canonicalCswAddress,
      })
      throw new KeeprStrategyError(
        `ajna_auth_admin_mismatch:canonical=${automation.canonicalCswAddress}:admin=${authAdmin}`,
        false,
      )
    }

    let ownerContext: { ownerAddress: `0x${string}`; ownerIndex: number }
    try {
      const resolvedOwner = await resolvePrivyCoinbaseSmartWalletOwnerContext({
        publicClient,
        walletId: automation.privyWalletId,
        smartWallet: automation.canonicalCswAddress,
        expectedOwnerAddress: automation.embeddedEoaAddress,
        maxScan: 512,
      })
      ownerContext = {
        ownerAddress: resolvedOwner.ownerAddress as `0x${string}`,
        ownerIndex: resolvedOwner.ownerIndex,
      }
    } catch (err) {
      const helperError = toKeeprStrategyErrorFromCoinbaseSmartWalletHelper(
        err,
        'ajna_owner_revalidation_failed',
      )
      if (helperError) throw helperError
      const message = err instanceof Error ? err.message : String(err)
      throw new KeeprStrategyError(`ajna_owner_revalidation_failed:${message}`, false)
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
      const helperError = toKeeprStrategyErrorFromCoinbaseSmartWalletHelper(err, 'ajna_userop_failed')
      if (helperError) throw helperError
      const message = err instanceof Error ? err.message : String(err)
      if (message === 'transaction_reverted') {
        throw new KeeprStrategyError(message, false)
      }
      throw new KeeprStrategyError(`ajna_userop_failed:${message}`, isLikelyRetryableRpcError(message))
    }

    return {
      txHash: viaUserOp.txHash,
      userOpHash: viaUserOp.userOpHash,
      sender: viaUserOp.smartWallet,
      ownerAddress: viaUserOp.ownerAddress,
      ownerIndex: viaUserOp.ownerIndex,
      mode: 'erc4337_privy',
      ...rebucketResultBase,
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
    throw new KeeprStrategyError(officialCharmVaultError(charmVaultAddress), false)
  }

  const keeperAddress = normalizeAddress(account.address, 'keeperAddress')
  const authSnapshot = await readCharmVaultAuthSnapshot({ publicClient, charmVaultAddress })
  const authorization = resolveCharmKeeperAuthorization({ snapshot: authSnapshot, keeperAddress })
  if (!authorization.authorized) {
    throw new KeeprStrategyError(authorization.reason, false)
  }

  const rebalanceCalldata = encodeFunctionData({
    abi: CHARM_VAULT_ADMIN_ABI as unknown as Abi,
    functionName: 'rebalance',
    args: [],
  })

  if (authorization.lane === 'protocol_automation_manager') {
    try {
      const viaSafe = await executeViaProtocolAutomationSafe({
        publicClient,
        rpcUrl,
        to: charmVaultAddress,
        data: rebalanceCalldata,
      })
      return {
        txHash: viaSafe.txHash,
        charmVaultAddress,
        mode: 'protocol_automation_safe',
        safeAddress: viaSafe.safeAddress,
        signerAddress: viaSafe.signerAddress,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.warn('[keepr/strategy] charm rebalance automation Safe path failed', {
        charmVaultAddress,
        managerAddress: authSnapshot.managerAddress,
        error: message,
      })
      if (message.startsWith('protocol_automation_safe_owner_key_missing')) {
        throw new KeeprStrategyError(message, false)
      }
      if (message.startsWith('protocol_automation_safe_not_configured')) {
        throw new KeeprStrategyError(message, false)
      }
      if (message.startsWith('protocol_automation_safe_signer_not_owner')) {
        throw new KeeprStrategyError(message, false)
      }
      if (message.startsWith('keeper_automation_key_pair_mismatch')) {
        throw new KeeprStrategyError(message, false)
      }
      throw new KeeprStrategyError(
        `protocol_automation_safe_failed:${message}`,
        isLikelyRetryableRpcError(message),
      )
    }
  }

  if (authorization.lane === 'protocol_treasury_manager') {
    try {
      const viaSafe = await executeViaProtocolTreasurySafe({
        publicClient,
        rpcUrl,
        to: charmVaultAddress,
        data: rebalanceCalldata,
      })
      return {
        txHash: viaSafe.txHash,
        charmVaultAddress,
        mode: 'protocol_treasury_safe',
        safeAddress: viaSafe.safeAddress,
        signerAddress: viaSafe.signerAddress,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.warn('[keepr/strategy] charm rebalance treasury Safe path failed', {
        charmVaultAddress,
        managerAddress: authSnapshot.managerAddress,
        error: message,
      })
      if (message.startsWith('protocol_treasury_safe_owner_key_missing')) {
        throw new KeeprStrategyError(message, false)
      }
      if (message.startsWith('protocol_treasury_safe_signer_not_owner')) {
        throw new KeeprStrategyError(message, false)
      }
      throw new KeeprStrategyError(
        `protocol_treasury_safe_failed:${message}`,
        isLikelyRetryableRpcError(message),
      )
    }
  }

  const delegateAddress = authSnapshot.delegateAddress
  const keeperCanDirectlyRebalance = Boolean(delegateAddress && isSameAddress(delegateAddress, keeperAddress))
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
      throw new KeeprStrategyError('transaction_reverted', false)
    }
    return {
      txHash,
      charmVaultAddress,
      mode: 'direct_eoa',
    }
  }

  const cswAddress =
    delegateAddress && delegateAddress !== ZERO_ADDRESS && delegateAddress !== keeperAddress
      ? delegateAddress
      : null
  if (!cswAddress) {
    throw new KeeprStrategyError('charm_rebalance_not_authorized_for_keeper', false)
  }

  try {
    const viaUserOp = await executeCharmRebalanceViaCswUserOperation({
      publicClient,
      ownerAccount: account,
      charmVaultAddress,
      cswAddress: cswAddress as `0x${string}`,
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
    const message = err instanceof Error ? err.message : String(err)
    logger.warn('[keepr/strategy] charm rebalance userop path failed', {
      charmVaultAddress,
      cswAddress,
      error: message,
    })
    if (err instanceof KeeprStrategyError) throw err
    throw new KeeprStrategyError(
      `charm_rebalance_userop_failed:${message}`,
      isLikelyRetryableRpcError(message),
    )
  }
}

export async function executeKeeprStrategyAction(
  input: ExecuteKeeprStrategyActionInput,
): Promise<ExecuteKeeprStrategyActionResult> {
  const normalizedVaultAddress = normalizeAddress(input.vaultAddress, 'vaultAddress')
  const normalizedActionType = resolveKeeprEffectiveActionType(
    input.actionType,
    input.action ?? {},
  ) as StrategyActionType | null
  if (!normalizedActionType || !isStrategyActionType(normalizedActionType)) {
    return { success: false, retryable: false, actionType: 'unknown', error: 'unknown_action_type' }
  }

  const trustZone = resolveKeeprTrustZone(normalizedActionType)
  if (!isKeeprTrustZoneWriteEnabled(trustZone, process.env)) {
    return {
      success: false,
      retryable: false,
      actionType: normalizedActionType,
      error: formatTrustZoneDisabledError(trustZone),
      details: { trustZone },
    }
  }

  try {
    const row = await loadStrategyQueueAgentRow(normalizedVaultAddress)
    if (!row) {
      return {
        success: false,
        retryable: false,
        actionType: normalizedActionType,
        error: 'vault_not_configured',
      }
    }

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
  } catch (err) {
    if (err instanceof KeeprStrategyError) {
      return {
        success: false,
        retryable: err.retryable,
        actionType: normalizedActionType,
        error: err.message,
      }
    }
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      retryable: true,
      actionType: normalizedActionType,
      error: message,
    }
  }
}
