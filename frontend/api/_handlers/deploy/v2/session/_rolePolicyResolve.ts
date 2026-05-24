import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

import { resolveDeploySessionRpcUrl } from './deploySessionRpc.js'
import {
  type ApiEnvelope,
  getApiContracts,
  handleOptions,
  readRequestPrincipalAddress,
  setCors,
  setNoStore,
} from '../../../../../packages/server-core/src/index.js'
import { isServerAdminAddress } from '../../../../../server/_lib/infra/trust.js'
import { resolveCoinPartiesAndOwner } from '../../../../../server/_lib/onchain/coinParties.js'
import { resolveRolePolicyIdForSession } from './_createCore.js'

const BATCHER_ROLE_POLICY_ABI = [
  { type: 'function', name: 'vaultRolePolicyManager', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'vaultRolePolicyId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

const ROLE_POLICY_MANAGER_ABI = [
  {
    type: 'function',
    name: 'policies',
    stateMutability: 'view',
    inputs: [{ name: 'policyId', type: 'uint256' }],
    outputs: [
      { name: 'active', type: 'bool' },
      { name: 'requireOwnerEoa', type: 'bool' },
      { name: 'managementRule', type: 'uint8' },
      { name: 'keeperRule', type: 'uint8' },
      { name: 'emergencyAdminRule', type: 'uint8' },
    ],
  },
  {
    type: 'function',
    name: 'allowlistedAccounts',
    stateMutability: 'view',
    inputs: [
      { name: 'policyId', type: 'uint256' },
      { name: 'role', type: 'uint8' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'validateRoleAssignments',
    stateMutability: 'view',
    inputs: [
      { name: 'policyId', type: 'uint256' },
      { name: 'owner', type: 'address' },
      { name: 'management', type: 'address' },
      { name: 'keeper', type: 'address' },
      { name: 'emergencyAdmin', type: 'address' },
    ],
    outputs: [],
  },
] as const

type PolicyReadout = {
  policyId: number
  active: boolean
  requireOwnerEoa: boolean
  rules: {
    management: 'any' | 'must_equal_owner' | 'must_be_allowlisted' | 'unknown'
    keeper: 'any' | 'must_equal_owner' | 'must_be_allowlisted' | 'unknown'
    emergencyAdmin: 'any' | 'must_equal_owner' | 'must_be_allowlisted' | 'unknown'
  }
  ownerAllowlisted: {
    management: boolean
    keeper: boolean
    emergencyAdmin: boolean
  }
  ownerTupleValidation: {
    passes: boolean
    error: string | null
  }
}

type RolePolicyResolveResponse = {
  creatorToken: Address
  principalAddress: Address
  creatorCoinOwner: Address | null
  batcherAddress: Address | null
  requestedRolePolicyId: number | null
  effectiveResolution: {
    rolePolicyId: number | null
    source: 'request' | 'creator_default' | 'global_default' | 'none'
  }
  onchainBatcherDefaults: {
    rolePolicyManager: Address | null
    rolePolicyId: number | null
  }
  effectivePolicyReadout: PolicyReadout | null
  batcherDefaultPolicyReadout: PolicyReadout | null
  generatedAt: string
}

function parseBigIntLike(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value >= 0n ? value : null
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return BigInt(Math.trunc(value))
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = BigInt(value.trim())
      return parsed >= 0n ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string') return null
  if (!isAddress(value)) return null
  return getAddress(value as Address)
}

function normalizeQueryAddress(value: unknown): Address | null {
  if (typeof value !== 'string') return null
  return normalizeAddress(value.trim())
}

function roleRuleLabel(rule: number): 'any' | 'must_equal_owner' | 'must_be_allowlisted' | 'unknown' {
  if (rule === 0) return 'any'
  if (rule === 1) return 'must_equal_owner'
  if (rule === 2) return 'must_be_allowlisted'
  return 'unknown'
}

function inferErrorMessage(error: unknown): string {
  const cause = error as { shortMessage?: string; message?: string }
  return String(cause?.shortMessage ?? cause?.message ?? 'validation_failed')
}

async function readPolicy(params: {
  client: any
  manager: Address
  policyId: bigint
  owner: Address
}): Promise<PolicyReadout | null> {
  if (params.policyId < 0n || params.policyId > 65_535n) return null
  const policyTuple = await params.client.readContract({
    address: params.manager,
    abi: ROLE_POLICY_MANAGER_ABI,
    functionName: 'policies',
    args: [params.policyId],
  })

  const [managementAllowlisted, keeperAllowlisted, emergencyAllowlisted] = await Promise.all([
    params.client.readContract({
      address: params.manager,
      abi: ROLE_POLICY_MANAGER_ABI,
      functionName: 'allowlistedAccounts',
      args: [params.policyId, 0, params.owner],
    }),
    params.client.readContract({
      address: params.manager,
      abi: ROLE_POLICY_MANAGER_ABI,
      functionName: 'allowlistedAccounts',
      args: [params.policyId, 1, params.owner],
    }),
    params.client.readContract({
      address: params.manager,
      abi: ROLE_POLICY_MANAGER_ABI,
      functionName: 'allowlistedAccounts',
      args: [params.policyId, 2, params.owner],
    }),
  ])

  let ownerTupleValidation: PolicyReadout['ownerTupleValidation'] = {
    passes: true,
    error: null,
  }
  try {
    await params.client.readContract({
      address: params.manager,
      abi: ROLE_POLICY_MANAGER_ABI,
      functionName: 'validateRoleAssignments',
      args: [params.policyId, params.owner, params.owner, params.owner, params.owner],
    })
  } catch (error) {
    ownerTupleValidation = {
      passes: false,
      error: inferErrorMessage(error),
    }
  }

  return {
    policyId: Number(params.policyId),
    active: policyTuple[0] === true,
    requireOwnerEoa: policyTuple[1] === true,
    rules: {
      management: roleRuleLabel(Number(policyTuple[2] ?? 0)),
      keeper: roleRuleLabel(Number(policyTuple[3] ?? 0)),
      emergencyAdmin: roleRuleLabel(Number(policyTuple[4] ?? 0)),
    },
    ownerAllowlisted: {
      management: managementAllowlisted === true,
      keeper: keeperAllowlisted === true,
      emergencyAdmin: emergencyAllowlisted === true,
    },
    ownerTupleValidation,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = readRequestPrincipalAddress(req, { lowercase: true })
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<never>)
  }

  const creatorToken = normalizeQueryAddress(req.query.creatorToken)
    ?? normalizeQueryAddress(req.query.creator)
  if (!creatorToken) {
    return res.status(400).json({ success: false, error: 'creatorToken is required' } satisfies ApiEnvelope<never>)
  }

  const requestedRolePolicyIdRaw = parseBigIntLike(req.query.rolePolicyId)
  if (requestedRolePolicyIdRaw !== null && requestedRolePolicyIdRaw > 65_535n) {
    return res.status(400).json({ success: false, error: 'rolePolicyId out of supported range (max 65535)' } satisfies ApiEnvelope<never>)
  }

  const parties = await resolveCoinPartiesAndOwner(creatorToken)
  const creatorCoinOwner = normalizeAddress(parties.owner)
  const normalizedPrincipal = getAddress(principalAddress as Address)
  const isAdmin = isServerAdminAddress(normalizedPrincipal)
  if (!isAdmin && (!creatorCoinOwner || creatorCoinOwner.toLowerCase() !== normalizedPrincipal.toLowerCase())) {
    return res.status(403).json({
      success: false,
      error: 'Creator owner access required for role policy diagnostics',
    } satisfies ApiEnvelope<never>)
  }

  const resolution = resolveRolePolicyIdForSession({
    creatorToken,
    requestedRolePolicyId: requestedRolePolicyIdRaw,
  })

  const contracts = getApiContracts()
  const batcherAddress = contracts.creatorVaultBatcher ?? null
  const client = createPublicClient({
    chain: base,
    transport: http(resolveDeploySessionRpcUrl(), { timeout: 12_000 }),
  })

  let onchainRolePolicyManager: Address | null = null
  let onchainRolePolicyId: bigint | null = null
  if (batcherAddress) {
    try {
      const [managerAddress, policyId] = await Promise.all([
        client.readContract({
          address: batcherAddress,
          abi: BATCHER_ROLE_POLICY_ABI,
          functionName: 'vaultRolePolicyManager',
        }),
        client.readContract({
          address: batcherAddress,
          abi: BATCHER_ROLE_POLICY_ABI,
          functionName: 'vaultRolePolicyId',
        }),
      ])
      onchainRolePolicyManager = normalizeAddress(managerAddress)
      onchainRolePolicyId = typeof policyId === 'bigint' ? policyId : null
    } catch {
      onchainRolePolicyManager = null
      onchainRolePolicyId = null
    }
  }

  let effectivePolicyReadout: PolicyReadout | null = null
  let batcherDefaultPolicyReadout: PolicyReadout | null = null
  if (onchainRolePolicyManager && creatorCoinOwner) {
    const effectivePolicyId = resolution.rolePolicyId
    if (effectivePolicyId !== null) {
      effectivePolicyReadout = await readPolicy({
        client,
        manager: onchainRolePolicyManager,
        policyId: effectivePolicyId,
        owner: creatorCoinOwner,
      }).catch(() => null)
    }
    if (
      onchainRolePolicyId !== null &&
      (effectivePolicyId === null || onchainRolePolicyId !== effectivePolicyId)
    ) {
      batcherDefaultPolicyReadout = await readPolicy({
        client,
        manager: onchainRolePolicyManager,
        policyId: onchainRolePolicyId,
        owner: creatorCoinOwner,
      }).catch(() => null)
    }
    if (onchainRolePolicyId !== null && effectivePolicyId !== null && onchainRolePolicyId === effectivePolicyId) {
      batcherDefaultPolicyReadout = effectivePolicyReadout
    }
  }

  const data: RolePolicyResolveResponse = {
    creatorToken,
    principalAddress: normalizedPrincipal,
    creatorCoinOwner,
    batcherAddress,
    requestedRolePolicyId: requestedRolePolicyIdRaw === null ? null : Number(requestedRolePolicyIdRaw),
    effectiveResolution: {
      rolePolicyId: resolution.rolePolicyId === null ? null : Number(resolution.rolePolicyId),
      source: resolution.source,
    },
    onchainBatcherDefaults: {
      rolePolicyManager: onchainRolePolicyManager,
      rolePolicyId: onchainRolePolicyId === null ? null : Number(onchainRolePolicyId),
    },
    effectivePolicyReadout,
    batcherDefaultPolicyReadout,
    generatedAt: new Date().toISOString(),
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<RolePolicyResolveResponse>)
}
