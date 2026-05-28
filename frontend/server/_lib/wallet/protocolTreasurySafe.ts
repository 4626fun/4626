import Safe from '@safe-global/protocol-kit'
import { OperationType } from '@safe-global/types-kit'
import { getAddress, isAddress, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { getApiContracts } from '../onchain/contracts.js'

declare const process: { env: Record<string, string | undefined> }

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/** Dedicated Charm automation signer (must be owner of protocol automation Safe). */
export const KEEPER_AUTOMATION_PRIVATE_KEY_ENV = '4626_KEEPER_AUTOMATION_PRIVATE_KEY'
export const KEEPER_AUTOMATION_PUBLIC_KEY_ENV = '4626_KEEPER_AUTOMATION_PUBLIC_KEY'

const PROTOCOL_AUTOMATION_SAFE_SIGNER_PRIVATE_KEY_ENVS = [
  KEEPER_AUTOMATION_PRIVATE_KEY_ENV,
  'PROTOCOL_AUTOMATION_SAFE_OWNER_PK',
] as const

const PROTOCOL_TREASURY_SAFE_SIGNER_PRIVATE_KEY_ENVS = [
  ...PROTOCOL_AUTOMATION_SAFE_SIGNER_PRIVATE_KEY_ENVS,
  'PROTOCOL_TREASURY_SAFE_OWNER_PK',
  'KPR_PRIVATE_KEY',
  'PRIVATE_KEY',
] as const

const GNOSIS_SAFE_ABI = [
  {
    type: 'function',
    name: 'getOwners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
] as const

const CHARM_VAULT_AUTH_ABI = [
  { type: 'function', name: 'manager', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function',
    name: 'rebalanceDelegate',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  { type: 'function', name: 'keeper', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

function readHexPrivateKey(env: Record<string, string | undefined>, key: string): `0x${string}` | null {
  const raw = (env[key] ?? '').trim()
  if (/^0x[0-9a-fA-F]{64}$/.test(raw)) return raw as `0x${string}`
  return null
}

function readConfiguredAddress(env: Record<string, string | undefined>, key: string): Address | null {
  const raw = (env[key] ?? '').trim()
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw)
}

export function resolveProtocolTreasuryAddress(): Address {
  return getAddress(getApiContracts().protocolTreasury)
}

/** Hot automation Safe — Charm vault manager on new deploys. */
export function resolveProtocolAutomationAddress(
  env: Record<string, string | undefined> = process.env,
): Address | null {
  const fromContracts = getApiContracts().protocolAutomation
  if (fromContracts && fromContracts.toLowerCase() !== ZERO_ADDRESS) {
    return getAddress(fromContracts)
  }
  return (
    readConfiguredAddress(env, 'PROTOCOL_AUTOMATION_SAFE') ??
    readConfiguredAddress(env, '4626_PROTOCOL_AUTOMATION_SAFE') ??
    null
  )
}

export function resolveProtocolAutomationSafeOwnerPrivateKey(
  env: Record<string, string | undefined> = process.env,
): `0x${string}` | null {
  for (const key of PROTOCOL_AUTOMATION_SAFE_SIGNER_PRIVATE_KEY_ENVS) {
    const pk = readHexPrivateKey(env, key)
    if (pk) return pk
  }
  return null
}

/** Legacy treasury Safe exec + keeper bootstrap fallback. */
export function resolveProtocolTreasurySafeOwnerPrivateKey(
  env: Record<string, string | undefined> = process.env,
): `0x${string}` | null {
  for (const key of PROTOCOL_TREASURY_SAFE_SIGNER_PRIVATE_KEY_ENVS) {
    const pk = readHexPrivateKey(env, key)
    if (pk) return pk
  }
  return null
}

/** Prefer automation signer; fall back to legacy treasury/keeper keys. */
export function resolveKeeperAutomationPrivateKey(
  env: Record<string, string | undefined> = process.env,
): `0x${string}` | null {
  return resolveProtocolAutomationSafeOwnerPrivateKey(env) ?? resolveProtocolTreasurySafeOwnerPrivateKey(env)
}

export function resolveKeeperAutomationPublicAddress(
  env: Record<string, string | undefined> = process.env,
): Address | null {
  const configured = (env[KEEPER_AUTOMATION_PUBLIC_KEY_ENV] ?? '').trim()
  if (configured && isAddress(configured)) return getAddress(configured)

  const automationPk = readHexPrivateKey(env, KEEPER_AUTOMATION_PRIVATE_KEY_ENV)
  if (automationPk) return getAddress(privateKeyToAccount(automationPk).address)
  return null
}

/** On-chain Ajna `keeper` slot — automation EOA for `move*` calls (not the Safe). */
export function resolveProtocolAjnaKeeperAddress(
  env: Record<string, string | undefined> = process.env,
): Address | null {
  return (
    readConfiguredAddress(env, 'PROTOCOL_AJNA_KEEPER') ??
    readConfiguredAddress(env, 'VITE_PROTOCOL_AJNA_KEEPER') ??
    resolveKeeperAutomationPublicAddress(env)
  )
}

export function assertKeeperAutomationKeyPair(
  env: Record<string, string | undefined> = process.env,
): void {
  const configuredPublic = (env[KEEPER_AUTOMATION_PUBLIC_KEY_ENV] ?? '').trim()
  if (!configuredPublic) return

  const automationPk = readHexPrivateKey(env, KEEPER_AUTOMATION_PRIVATE_KEY_ENV)
  if (!automationPk) {
    throw new Error('keeper_automation_public_key_without_private_key')
  }
  if (!isAddress(configuredPublic)) {
    throw new Error('keeper_automation_public_key_invalid')
  }

  const derived = getAddress(privateKeyToAccount(automationPk).address)
  if (derived.toLowerCase() !== getAddress(configuredPublic).toLowerCase()) {
    throw new Error(`keeper_automation_key_pair_mismatch:expected=${derived}`)
  }
}

export function isSameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  try {
    return getAddress(a).toLowerCase() === getAddress(b).toLowerCase()
  } catch {
    return false
  }
}

export function isProtocolAutomationManager(managerAddress: string | null | undefined): boolean {
  const automationSafe = resolveProtocolAutomationAddress()
  if (!automationSafe || !managerAddress) return false
  return isSameAddress(managerAddress, automationSafe)
}

/** AjnaVaultAuth.admin on new deploys — same hot Safe as Charm manager. */
export function isProtocolAutomationAjnaAdmin(adminAddress: string | null | undefined): boolean {
  return isProtocolAutomationManager(adminAddress)
}

/** @deprecated Pre-split vaults only — new deploys use protocol automation Safe as manager. */
export function isProtocolTreasuryManager(managerAddress: string | null | undefined): boolean {
  if (!managerAddress) return false
  return isSameAddress(managerAddress, resolveProtocolTreasuryAddress())
}

export type CharmAutomationAuthorization =
  | { authorized: true; lane: 'protocol_automation_manager' }
  | { authorized: true; lane: 'protocol_treasury_manager' }
  | { authorized: true; lane: 'keeper_direct' }
  | { authorized: false; reason: string }

export function resolveCharmAutomationAuthorization(params: {
  managerAddress: string | null | undefined
  delegateAddress: string | null | undefined
  charmKeeper: string | null | undefined
  charmOwner: string | null | undefined
  keeperAddress: string
}): CharmAutomationAuthorization {
  if (isProtocolAutomationManager(params.managerAddress)) {
    return { authorized: true, lane: 'protocol_automation_manager' }
  }

  if (isProtocolTreasuryManager(params.managerAddress)) {
    return { authorized: true, lane: 'protocol_treasury_manager' }
  }

  if (params.delegateAddress && isSameAddress(params.delegateAddress, params.keeperAddress)) {
    return { authorized: true, lane: 'keeper_direct' }
  }

  if (params.charmKeeper && !isSameAddress(params.charmKeeper, params.keeperAddress)) {
    return { authorized: false, reason: 'keeper_not_charm_vault_keeper' }
  }

  if (
    !params.charmKeeper &&
    params.charmOwner &&
    !isSameAddress(params.charmOwner, params.keeperAddress)
  ) {
    return { authorized: false, reason: 'keeper_not_charm_vault_owner' }
  }

  if (!params.charmKeeper && !params.charmOwner && !params.delegateAddress) {
    return { authorized: false, reason: 'charm_automation_not_configured' }
  }

  return { authorized: true, lane: 'keeper_direct' }
}

export type AjnaRebucketAuthorization =
  | { authorized: true; lane: 'protocol_automation_admin' }
  | { authorized: true; lane: 'legacy_treasury_admin' }
  | { authorized: true; lane: 'legacy_csw_admin' }
  | { authorized: false; reason: string }

export function resolveAjnaRebucketAuthorization(params: {
  authAdmin: Address
  canonicalCswAddress?: Address | null
}): AjnaRebucketAuthorization {
  if (isProtocolAutomationAjnaAdmin(params.authAdmin)) {
    return { authorized: true, lane: 'protocol_automation_admin' }
  }
  if (isProtocolTreasuryManager(params.authAdmin)) {
    return { authorized: true, lane: 'legacy_treasury_admin' }
  }
  if (params.canonicalCswAddress && isSameAddress(params.authAdmin, params.canonicalCswAddress)) {
    return { authorized: true, lane: 'legacy_csw_admin' }
  }
  return { authorized: false, reason: 'ajna_auth_admin_mismatch' }
}

export type CharmVaultAuthSnapshot = {
  managerAddress: Address | null
  delegateAddress: Address | null
  charmKeeper: Address | null
  charmOwner: Address | null
}

function asAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  return getAddress(value)
}

type CharmAuthReader = {
  readContract: (args: {
    address: Address
    abi: typeof CHARM_VAULT_AUTH_ABI
    functionName: 'manager' | 'rebalanceDelegate' | 'keeper' | 'owner'
  }) => Promise<unknown>
}

async function readAuthField(
  publicClient: CharmAuthReader,
  charmVaultAddress: Address,
  functionName: 'manager' | 'rebalanceDelegate' | 'keeper' | 'owner',
): Promise<unknown> {
  try {
    return await publicClient.readContract({
      address: charmVaultAddress,
      abi: CHARM_VAULT_AUTH_ABI,
      functionName,
    })
  } catch {
    return null
  }
}

function isProtocolManagedCharmVault(managerAddress: Address | null): boolean {
  return isProtocolAutomationManager(managerAddress) || isProtocolTreasuryManager(managerAddress)
}

/** Reads on-chain Charm auth slots; skips keeper/owner when manager is a protocol Safe. */
export async function readCharmVaultAuthSnapshot(params: {
  publicClient: CharmAuthReader
  charmVaultAddress: Address
}): Promise<CharmVaultAuthSnapshot> {
  const [managerRaw, delegateRaw] = await Promise.all([
    readAuthField(params.publicClient, params.charmVaultAddress, 'manager'),
    readAuthField(params.publicClient, params.charmVaultAddress, 'rebalanceDelegate'),
  ])
  const managerAddress = asAddress(managerRaw)
  const delegateAddress = asAddress(delegateRaw)

  if (isProtocolManagedCharmVault(managerAddress)) {
    return { managerAddress, delegateAddress, charmKeeper: null, charmOwner: null }
  }

  const [charmKeeperRaw, charmOwnerRaw] = await Promise.all([
    readAuthField(params.publicClient, params.charmVaultAddress, 'keeper'),
    readAuthField(params.publicClient, params.charmVaultAddress, 'owner'),
  ])

  return {
    managerAddress,
    delegateAddress,
    charmKeeper: asAddress(charmKeeperRaw),
    charmOwner: asAddress(charmOwnerRaw),
  }
}

export function resolveCharmKeeperAuthorization(params: {
  snapshot: CharmVaultAuthSnapshot
  keeperAddress: Address
}): CharmAutomationAuthorization {
  return resolveCharmAutomationAuthorization({
    ...params.snapshot,
    keeperAddress: params.keeperAddress,
  })
}

async function assertSafeOwner(params: {
  publicClient: { readContract: (args: unknown) => Promise<unknown> }
  safeAddress: Address
  ownerAddress: Address
  errorPrefix: string
}): Promise<void> {
  const ownersRaw = await params.publicClient.readContract({
    address: params.safeAddress,
    abi: GNOSIS_SAFE_ABI,
    functionName: 'getOwners',
  })
  const owners = Array.isArray(ownersRaw)
    ? ownersRaw.map((owner) => getAddress(String(owner)).toLowerCase())
    : []
  if (!owners.includes(params.ownerAddress.toLowerCase())) {
    throw new Error(`${params.errorPrefix}:${params.ownerAddress}`)
  }
}

async function executeViaSafe(params: {
  publicClient: {
    readContract: (args: unknown) => Promise<unknown>
    waitForTransactionReceipt: (args: { hash: `0x${string}`; timeout?: number }) => Promise<{ status: string }>
  }
  rpcUrl: string
  safeAddress: Address
  privateKey: `0x${string}`
  to: Address
  data: Hex
  value?: bigint
  ownerErrorPrefix: string
  txHashMissingError: string
  txRevertedError: string
}): Promise<{ txHash: `0x${string}`; safeAddress: Address; signerAddress: Address }> {
  const signerAddress = getAddress(privateKeyToAccount(params.privateKey).address)

  await assertSafeOwner({
    publicClient: params.publicClient,
    safeAddress: params.safeAddress,
    ownerAddress: signerAddress,
    errorPrefix: params.ownerErrorPrefix,
  })

  const protocolKit = await Safe.init({
    provider: params.rpcUrl,
    signer: params.privateKey,
    safeAddress: params.safeAddress,
  })

  const safeTransaction = await protocolKit.createTransaction({
    transactions: [
      {
        to: params.to,
        value: String(params.value ?? 0n),
        data: params.data,
        operation: OperationType.Call,
      },
    ],
  })

  const executeResponse = await protocolKit.executeTransaction(safeTransaction)
  const txHash = (executeResponse.hash ?? (executeResponse as { transactionResponse?: { hash?: `0x${string}` } }).transactionResponse?.hash) as
    | `0x${string}`
    | undefined
  if (!txHash) {
    throw new Error(params.txHashMissingError)
  }

  const receipt = await params.publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })
  if (receipt.status !== 'success') {
    throw new Error(params.txRevertedError)
  }

  return { txHash, safeAddress: params.safeAddress, signerAddress }
}

/** Batch protocol treasury Safe exec for router admin lanes (keeper, swap paths, external approvals). */
export async function executeBatchViaProtocolTreasurySafe(params: {
  publicClient: {
    readContract: (args: unknown) => Promise<unknown>
    waitForTransactionReceipt: (args: { hash: `0x${string}`; timeout?: number }) => Promise<{ status: string }>
  }
  rpcUrl: string
  calls: Array<{ to: Address; data: Hex; value?: bigint }>
  env?: Record<string, string | undefined>
}): Promise<{ txHash: `0x${string}`; safeAddress: Address; signerAddress: Address }> {
  if (params.calls.length === 0) {
    throw new Error('protocol_treasury_safe_batch_empty')
  }

  const env = params.env ?? process.env
  const privateKey = resolveProtocolTreasurySafeOwnerPrivateKey(env)
  if (!privateKey) {
    throw new Error('protocol_treasury_safe_owner_key_missing')
  }

  const safeAddress = resolveProtocolTreasuryAddress()
  const signerAddress = getAddress(privateKeyToAccount(privateKey).address)

  await assertSafeOwner({
    publicClient: params.publicClient,
    safeAddress,
    ownerAddress: signerAddress,
    errorPrefix: 'protocol_treasury_safe_signer_not_owner',
  })

  const protocolKit = await Safe.init({
    provider: params.rpcUrl,
    signer: privateKey,
    safeAddress,
  })

  const safeTransaction = await protocolKit.createTransaction({
    transactions: params.calls.map((call) => ({
      to: call.to,
      value: String(call.value ?? 0n),
      data: call.data,
      operation: OperationType.Call,
    })),
  })

  const executeResponse = await protocolKit.executeTransaction(safeTransaction)
  const txHash = (executeResponse.hash ??
    (executeResponse as { transactionResponse?: { hash?: `0x${string}` } }).transactionResponse?.hash) as
    | `0x${string}`
    | undefined
  if (!txHash) {
    throw new Error('protocol_treasury_safe_tx_hash_missing')
  }

  const receipt = await params.publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })
  if (receipt.status !== 'success') {
    throw new Error('protocol_treasury_safe_tx_reverted')
  }

  return { txHash, safeAddress, signerAddress }
}

/** Primary Charm rebalance path for new deploys (manager = protocol automation Safe). */
export async function executeViaProtocolAutomationSafe(params: {
  publicClient: {
    readContract: (args: unknown) => Promise<unknown>
    waitForTransactionReceipt: (args: { hash: `0x${string}`; timeout?: number }) => Promise<{ status: string }>
  }
  rpcUrl: string
  to: Address
  data: Hex
  value?: bigint
  env?: Record<string, string | undefined>
}): Promise<{ txHash: `0x${string}`; safeAddress: Address; signerAddress: Address }> {
  const env = params.env ?? process.env
  assertKeeperAutomationKeyPair(env)

  const automationSafe = resolveProtocolAutomationAddress(env)
  if (!automationSafe) {
    throw new Error('protocol_automation_safe_not_configured')
  }

  const privateKey = resolveProtocolAutomationSafeOwnerPrivateKey(env)
  if (!privateKey) {
    throw new Error('protocol_automation_safe_owner_key_missing')
  }

  return executeViaSafe({
    publicClient: params.publicClient,
    rpcUrl: params.rpcUrl,
    safeAddress: automationSafe,
    privateKey,
    to: params.to,
    data: params.data,
    value: params.value,
    ownerErrorPrefix: 'protocol_automation_safe_signer_not_owner',
    txHashMissingError: 'protocol_automation_safe_tx_hash_missing',
    txRevertedError: 'protocol_automation_safe_tx_reverted',
  })
}

/** Legacy path for vaults that still use protocol treasury Safe as Charm manager. */
export async function executeViaProtocolTreasurySafe(params: {
  publicClient: {
    readContract: (args: unknown) => Promise<unknown>
    waitForTransactionReceipt: (args: { hash: `0x${string}`; timeout?: number }) => Promise<{ status: string }>
  }
  rpcUrl: string
  to: Address
  data: Hex
  value?: bigint
  env?: Record<string, string | undefined>
}): Promise<{ txHash: `0x${string}`; safeAddress: Address; signerAddress: Address }> {
  const env = params.env ?? process.env
  const privateKey = resolveProtocolTreasurySafeOwnerPrivateKey(env)
  if (!privateKey) {
    throw new Error('protocol_treasury_safe_owner_key_missing')
  }

  return executeViaSafe({
    publicClient: params.publicClient,
    rpcUrl: params.rpcUrl,
    safeAddress: resolveProtocolTreasuryAddress(),
    privateKey,
    to: params.to,
    data: params.data,
    value: params.value,
    ownerErrorPrefix: 'protocol_treasury_safe_signer_not_owner',
    txHashMissingError: 'protocol_treasury_safe_tx_hash_missing',
    txRevertedError: 'protocol_treasury_safe_tx_reverted',
  })
}

/** Batch protocol treasury Safe exec for router admin lanes (keeper, swap paths, external approvals). */
export async function executeBatchViaProtocolTreasurySafe(params: {
  publicClient: {
    readContract: (args: unknown) => Promise<unknown>
    waitForTransactionReceipt: (args: { hash: `0x${string}`; timeout?: number }) => Promise<{ status: string }>
  }
  rpcUrl: string
  calls: Array<{ to: Address; data: Hex; value?: bigint }>
  env?: Record<string, string | undefined>
}): Promise<{ txHash: `0x${string}`; safeAddress: Address; signerAddress: Address }> {
  if (params.calls.length === 0) {
    throw new Error('protocol_treasury_safe_batch_empty')
  }

  const env = params.env ?? process.env
  const privateKey = resolveProtocolTreasurySafeOwnerPrivateKey(env)
  if (!privateKey) {
    throw new Error('protocol_treasury_safe_owner_key_missing')
  }

  const safeAddress = resolveProtocolTreasuryAddress()
  const signerAddress = getAddress(privateKeyToAccount(privateKey).address)

  await assertSafeOwner({
    publicClient: params.publicClient,
    safeAddress,
    ownerAddress: signerAddress,
    errorPrefix: 'protocol_treasury_safe_signer_not_owner',
  })

  const protocolKit = await Safe.init({
    provider: params.rpcUrl,
    signer: privateKey,
    safeAddress,
  })

  const safeTransaction = await protocolKit.createTransaction({
    transactions: params.calls.map((call) => ({
      to: call.to,
      value: String(call.value ?? 0n),
      data: call.data,
      operation: OperationType.Call,
    })),
  })

  const executeResponse = await protocolKit.executeTransaction(safeTransaction)
  const txHash = (executeResponse.hash ??
    (executeResponse as { transactionResponse?: { hash?: `0x${string}` } }).transactionResponse?.hash) as
    | `0x${string}`
    | undefined
  if (!txHash) {
    throw new Error('protocol_treasury_safe_tx_hash_missing')
  }

  const receipt = await params.publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })
  if (receipt.status !== 'success') {
    throw new Error('protocol_treasury_safe_tx_reverted')
  }

  return { txHash, safeAddress, signerAddress }
}
