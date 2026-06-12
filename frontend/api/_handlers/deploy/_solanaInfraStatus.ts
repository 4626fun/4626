import type { VercelRequest, VercelResponse } from '@vercel/node'

import { timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'

import { createPublicClient, getAddress, http, isAddress, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getApiContracts,
  getSessionAddress,
  isAdminAddress,
} from '@4626/server-core'



import {
  evaluateSolanaOvaultMintCompatibility,
  normalizeSolanaAssetMintOrigin,
  readSolanaOvaultMintCompatibilityHintsFromEnv,
} from '../../../server/_lib/onchain/solanaOvaultCompatibility.js'
import {
  evaluateCanonicalBridgeTokenPolicy,
  evaluateRemoteProvisionerLiveness,
  probeRemoteProvisionerHealth,
  readCanonicalBridgeTokenAllowlist,
  readCanonicalBridgeTokenAllowlistRequired,
  readSolanaBridgeLivenessPolicy,
} from '../../../server/_lib/onchain/solanaBridgePolicy.js'

const ZERO_ADDRESS = `0x${'00'.repeat(20)}` as Address
const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex
const BASE_SOLANA_BRIDGE = '0x3eff766c76a1be2ce1acf2b69c78bcae257d5188' as Address

const CREATOR_VAULT_BATCHER_SOLANA_VIEW_ABI = [
  {
    type: 'function',
    name: 'solanaBridgeAdapter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'solanaDestination',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'getOVaultRuntimeConfig',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'hubComposer', type: 'address' },
          { name: 'solanaEid', type: 'uint32' },
          { name: 'enabled', type: 'bool' },
        ],
      },
    ],
  },
] as const

const SOLANA_BRIDGE_ADAPTER_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'solanaMintToToken',
    stateMutability: 'view',
    inputs: [{ name: 'mint', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
] as const

const BASE_SOLANA_BRIDGE_ABI = [
  {
    type: 'function',
    name: 'scalars',
    stateMutability: 'view',
    inputs: [
      { name: 'localToken', type: 'address' },
      { name: 'remoteToken', type: 'bytes32' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const

type DynamicProvisioningMode = 'disabled' | 'local-cli' | 'remote-provisioner' | 'misconfigured'

type SolanaInfraStatusResponse = {
  admin: Address
  creatorVaultBatcher: Address | null
  solanaEnabledOnBatcher: boolean
  batcherAdapter: Address | null
  batcherDestination: Hex | null
  adapterHasCode: boolean | null
  adapterOwner: Address | null
  signerConfigured: boolean
  signerAddress: Address | null
  signerMatchesAdapterOwner: boolean | null
  defaultMintConfigured: boolean
  defaultMintBytes32: Hex | null
  defaultRouteBridgeToken: Address | null
  defaultMintMappedToken: Address | null
  defaultMintRouteScalar: string | null
  defaultMintRouteReady: boolean | null
  dynamicRouteEnabled: boolean
  dynamicProvisioningMode: DynamicProvisioningMode
  localCliDir: string
  localCliDirExists: boolean
  remoteProvisionerUrlConfigured: boolean
  remoteProvisionerSecretConfigured: boolean
  remoteProvisionerHealthUrlConfigured: boolean
  remoteProvisionerHealthProbeUrl: string | null
  remoteProvisionerReachable: boolean | null
  remoteProvisionerStatusCode: number | null
  remoteProvisionerHealthOk: boolean | null
  remoteProvisionerPayerConfigured: boolean | null
  remoteProvisionerPayerPubkey: string | null
  remoteProvisionerPayerBalanceSol: string | null
  remoteProvisionerPayerMinSol: string | null
  remoteProvisionerPayerHealthy: boolean | null
  remoteProvisionerPayerError: string | null
  canonicalBridgeTokenAllowlistConfigured: boolean
  canonicalBridgeTokenAllowlistSize: number
  canonicalBridgeTokenAllowlistRequired: boolean
  defaultRouteBridgeTokenAllowlisted: boolean | null
  bridgeLivenessEnforced: boolean
  bridgeLivenessMaxHealthAgeSeconds: number | null
  bridgeLivenessHealthy: boolean | null
  bridgeLivenessHealthAgeSeconds: number | null
  bridgeLivenessBlockers: string[]
  meteoraProvisionerUrlConfigured: boolean
  meteoraProvisionerSecretConfigured: boolean
  internalRegistrationSecretConfigured: boolean
  mintCompatibility: ReturnType<typeof evaluateSolanaOvaultMintCompatibility>['mintCompatibility']
  ovaultComposerConfigured: boolean
  // Compose-deposit (asset mesh) lane is dormant: deposit-eligibility hints are
  // intentionally absent so they can never gate auto-registration readiness.
  solanaShareMeshReady: boolean
  existingMintCompatible: boolean
  transferHookDetected: boolean
  oftFeeIsZero: boolean
  redeemEligible: boolean
  readyForAutoRegistration: boolean
  blockers: string[]
}

function envBool(key: string): boolean {
  const v = String(process.env[key] ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function isBytes32Hex(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

function readSolanaMintFromEnv(): Hex | null {
  const candidates = [process.env.SOLANA_DEFAULT_MINT_BYTES32, process.env.SOLANA_MINT_BYTES32]
  for (const c of candidates) {
    const v = String(c ?? '').trim()
    if (isBytes32Hex(v) && v.toLowerCase() !== ZERO_BYTES32.toLowerCase()) return v as Hex
  }
  return null
}

function readRegistrationSignerPk(): Hex | null {
  const candidates = [
    process.env.SOLANA_ADAPTER_OWNER_PRIVATE_KEY,
    process.env.KPR_PRIVATE_KEY,
    process.env.PRIVATE_KEY,
  ]
  for (const c of candidates) {
    const v = String(c ?? '').trim()
    if (/^0x[0-9a-fA-F]{64}$/.test(v)) return v as Hex
  }
  return null
}

function readDefaultRouteBridgeTokenFromEnv(): Address | null {
  const candidates = [process.env.SOLANA_DEFAULT_BRIDGE_TOKEN]
  for (const c of candidates) {
    const v = String(c ?? '').trim()
    if (isAddress(v)) return getAddress(v)
  }
  return null
}

function deriveDynamicProvisioningMode(params: {
  enabled: boolean
  cliExists: boolean
  provisionerUrlConfigured: boolean
}): DynamicProvisioningMode {
  if (!params.enabled) return 'disabled'
  if (params.cliExists) return 'local-cli'
  if (params.provisionerUrlConfigured) return 'remote-provisioner'
  return 'misconfigured'
}

function requestHeader(req: VercelRequest, key: string): string {
  const value = req.headers[key] as string | string[] | undefined
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return typeof value === 'string' ? value.trim() : ''
}

function safeCompareSecret(provided: string, configured: string): boolean {
  const expected = Buffer.from(configured)
  const actual = Buffer.from(provided)
  if (expected.length === 0 || actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

function readMachineMonitorAuth(req: VercelRequest): {
  authorized: boolean
  mode: 'keepr-api-key' | 'internal-registration-secret' | null
} {
  const bearer = requestHeader(req, 'authorization')
    .replace(/^Bearer\s+/i, '')
    .trim()
  const internalHeader = requestHeader(req, 'x-cv-solana-registration-secret')

  const keeprApiKey = String(process.env.KPR_API_KEY ?? '').trim()
  if (keeprApiKey) {
    if (bearer && safeCompareSecret(bearer, keeprApiKey)) {
      return { authorized: true, mode: 'keepr-api-key' }
    }
  }

  const internalSecret = String(
    process.env.DEPLOY_SOLANA_REGISTRATION_SECRET ??
      process.env.SOLANA_REGISTRATION_INTERNAL_SECRET ??
      '',
  ).trim()
  if (internalSecret) {
    if (bearer && safeCompareSecret(bearer, internalSecret)) {
      return { authorized: true, mode: 'internal-registration-secret' }
    }
    if (internalHeader && safeCompareSecret(internalHeader, internalSecret)) {
      return { authorized: true, mode: 'internal-registration-secret' }
    }
  }

  return { authorized: false, mode: null }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  const adminAuthorized = !!admin && isAdminAddress(admin)
  const machineAuth = readMachineMonitorAuth(req)

  if (!adminAuthorized && !machineAuth.authorized && !admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!adminAuthorized && !machineAuth.authorized) {
    return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  }

  const contracts = getApiContracts()
  const batcherRaw = contracts.creatorVaultBatcher
  const batcherAddress = batcherRaw && isAddress(batcherRaw) ? getAddress(batcherRaw) : null
  const rpcUrl = (process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim()
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 20_000 }),
  })

  const dynamicRouteEnabled = envBool('SOLANA_DYNAMIC_ROUTE_ENABLED')
  const localCliDir = String(process.env.SOLANA_BRIDGE_CLI_DIR ?? '').trim()
  const localCliDirExists = !!localCliDir && existsSync(localCliDir)
  const remoteProvisionerUrl = String(process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL ?? '').trim()
  const remoteProvisionerSecret = String(process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET ?? '').trim()
  const remoteProvisionerHealthUrl = String(process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_HEALTH_URL ?? '').trim()
  const meteoraProvisionerUrl = String(process.env.METEORA_IX_PROVISIONER_URL ?? '').trim()
  const meteoraProvisionerSecret = String(process.env.METEORA_IX_PROVISIONER_SECRET ?? '').trim() || remoteProvisionerSecret
  const internalRegistrationSecretConfigured = String(
    process.env.DEPLOY_SOLANA_REGISTRATION_SECRET ??
      process.env.SOLANA_REGISTRATION_INTERNAL_SECRET ??
      '',
  ).trim().length > 0
  const remoteProvisionerUrlConfigured = !!remoteProvisionerUrl
  const remoteProvisionerSecretConfigured = !!remoteProvisionerSecret
  const remoteProvisionerHealthUrlConfigured = !!remoteProvisionerHealthUrl
  const meteoraProvisionerUrlConfigured = !!meteoraProvisionerUrl || remoteProvisionerUrlConfigured
  const meteoraProvisionerSecretConfigured = !!meteoraProvisionerSecret

  const signerPk = readRegistrationSignerPk()
  const signerConfigured = !!signerPk
  const signerAddress = signerPk ? getAddress(privateKeyToAccount(signerPk).address) : null

  let batcherAdapter: Address | null = null
  let batcherDestination: Hex | null = null
  let solanaEnabledOnBatcher = false
  let ovaultComposerConfigured = false
  let adapterHasCode: boolean | null = null
  let adapterOwner: Address | null = null
  let signerMatchesAdapterOwner: boolean | null = null

  if (batcherAddress) {
    const [adapterRaw, destinationRaw, ovaultRuntimeRaw] = await Promise.all([
      publicClient
        .readContract({
          address: batcherAddress,
          abi: CREATOR_VAULT_BATCHER_SOLANA_VIEW_ABI,
          functionName: 'solanaBridgeAdapter',
        })
        .catch(() => ZERO_ADDRESS as Address),
      publicClient
        .readContract({
          address: batcherAddress,
          abi: CREATOR_VAULT_BATCHER_SOLANA_VIEW_ABI,
          functionName: 'solanaDestination',
        })
        .catch(() => ZERO_BYTES32 as Hex),
      publicClient
        .readContract({
          address: batcherAddress,
          abi: CREATOR_VAULT_BATCHER_SOLANA_VIEW_ABI,
          functionName: 'getOVaultRuntimeConfig',
        })
        .catch(() => null),
    ])

    batcherAdapter = getAddress((adapterRaw as Address) || ZERO_ADDRESS)
    batcherDestination = ((destinationRaw as Hex) || ZERO_BYTES32) as Hex
    solanaEnabledOnBatcher =
      batcherAdapter.toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
      batcherDestination.toLowerCase() !== ZERO_BYTES32.toLowerCase()
    const runtimeTuple = Array.isArray(ovaultRuntimeRaw) ? ovaultRuntimeRaw : null
    const runtimeObj = ovaultRuntimeRaw && typeof ovaultRuntimeRaw === 'object'
      ? (ovaultRuntimeRaw as Record<string, unknown>)
      : null
    const runtimeHubComposer =
      typeof runtimeObj?.hubComposer === 'string'
        ? runtimeObj.hubComposer
        : runtimeTuple && typeof runtimeTuple[0] === 'string'
          ? runtimeTuple[0]
          : ZERO_ADDRESS
    const runtimeSolanaEid =
      typeof runtimeObj?.solanaEid === 'number'
        ? runtimeObj.solanaEid
        : typeof runtimeObj?.solanaEid === 'bigint'
          ? Number(runtimeObj.solanaEid)
        : runtimeTuple && typeof runtimeTuple[1] === 'number'
          ? runtimeTuple[1]
          : runtimeTuple && typeof runtimeTuple[1] === 'bigint'
            ? Number(runtimeTuple[1])
          : 0
    const runtimeEnabled =
      typeof runtimeObj?.enabled === 'boolean'
        ? runtimeObj.enabled
        : runtimeTuple && typeof runtimeTuple[2] === 'boolean'
          ? runtimeTuple[2]
          : false
    ovaultComposerConfigured =
      runtimeEnabled === true &&
      typeof runtimeHubComposer === 'string' &&
      isAddress(runtimeHubComposer) &&
      getAddress(runtimeHubComposer).toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
      Number(runtimeSolanaEid) > 0

    if (solanaEnabledOnBatcher) {
      const code = await publicClient.getBytecode({ address: batcherAdapter }).catch(() => null)
      adapterHasCode = !!code && code !== '0x'
      if (adapterHasCode) {
        const ownerRaw = await publicClient
          .readContract({
            address: batcherAdapter,
            abi: SOLANA_BRIDGE_ADAPTER_ABI,
            functionName: 'owner',
          })
          .catch(() => null)
        adapterOwner = ownerRaw && isAddress(String(ownerRaw)) ? getAddress(String(ownerRaw) as Address) : null
      }
    }
  }

  if (adapterOwner && signerAddress) {
    signerMatchesAdapterOwner = signerAddress.toLowerCase() === adapterOwner.toLowerCase()
  }

  const defaultMintBytes32 = readSolanaMintFromEnv()
  const defaultMintConfigured = !!defaultMintBytes32
  const defaultRouteBridgeToken = readDefaultRouteBridgeTokenFromEnv()
  let defaultMintMappedToken: Address | null = null
  let defaultMintRouteScalar: string | null = null
  let defaultMintRouteReady: boolean | null = null

  if (defaultMintBytes32 && batcherAdapter && solanaEnabledOnBatcher && adapterHasCode) {
    defaultMintMappedToken = await publicClient
      .readContract({
        address: batcherAdapter,
        abi: SOLANA_BRIDGE_ADAPTER_ABI,
        functionName: 'solanaMintToToken',
        args: [defaultMintBytes32],
      })
      .then((v) => (typeof v === 'string' && isAddress(v) ? getAddress(v as Address) : ZERO_ADDRESS))
      .catch(() => ZERO_ADDRESS)
    if (defaultRouteBridgeToken) {
      const scalar = await publicClient
        .readContract({
          address: BASE_SOLANA_BRIDGE,
          abi: BASE_SOLANA_BRIDGE_ABI,
          functionName: 'scalars',
          args: [defaultRouteBridgeToken, defaultMintBytes32],
        })
        .then((v) => BigInt(v as bigint))
        .catch(() => null)
      defaultMintRouteScalar = scalar === null ? null : scalar.toString()
      defaultMintRouteReady = scalar === null ? null : scalar > 0n
    }
  }

  const mintCompatibilityHints = readSolanaOvaultMintCompatibilityHintsFromEnv()
  const assetMintOrigin = normalizeSolanaAssetMintOrigin(
    process.env.SOLANA_OVAULT_ASSET_MINT_ORIGIN,
    'existing',
  )
  const mintEligibility = evaluateSolanaOvaultMintCompatibility({
    assetMintOrigin,
    hints: mintCompatibilityHints,
    routeReady: defaultMintRouteReady,
    requireHintsForExisting: true,
  })
  const existingMintCompatible = mintEligibility.existingMintCompatible
  const redeemEligible = mintEligibility.redeemEligible
  const solanaShareMeshReady = redeemEligible
  const transferHookDetected = mintEligibility.mintCompatibility.transferHookDetected
  const oftFeeIsZero = mintEligibility.mintCompatibility.oftFeeIsZero

  const dynamicProvisioningMode = deriveDynamicProvisioningMode({
    enabled: dynamicRouteEnabled,
    cliExists: localCliDirExists,
    provisionerUrlConfigured: remoteProvisionerUrlConfigured,
  })
  const remoteProvisionerHealthProbeUrl = remoteProvisionerUrlConfigured
    ? (remoteProvisionerHealthUrlConfigured ? remoteProvisionerHealthUrl : remoteProvisionerUrl)
    : null
  const provisionerProbe = remoteProvisionerUrlConfigured
    ? await probeRemoteProvisionerHealth({
        url: String(remoteProvisionerHealthProbeUrl ?? ''),
        secret: remoteProvisionerSecret,
        timeoutMs: 4_000,
      })
    : {
        reachable: false,
        statusCode: null as number | null,
        healthOk: null as boolean | null,
        payerConfigured: null as boolean | null,
        payerPubkey: null as string | null,
        payerBalanceSol: null as string | null,
        payerMinSol: null as string | null,
        payerHealthy: null as boolean | null,
        payerError: null as string | null,
        reportedAtIso: null as string | null,
        reportedAtMs: null as number | null,
      }
  const remoteProvisionerReachable = remoteProvisionerUrlConfigured ? provisionerProbe.reachable : null
  const remoteProvisionerStatusCode = remoteProvisionerUrlConfigured ? provisionerProbe.statusCode : null
  const remoteProvisionerHealthOk = remoteProvisionerUrlConfigured ? provisionerProbe.healthOk : null
  const remoteProvisionerPayerConfigured = remoteProvisionerUrlConfigured ? provisionerProbe.payerConfigured : null
  const remoteProvisionerPayerPubkey = remoteProvisionerUrlConfigured ? provisionerProbe.payerPubkey : null
  const remoteProvisionerPayerBalanceSol = remoteProvisionerUrlConfigured ? provisionerProbe.payerBalanceSol : null
  const remoteProvisionerPayerMinSol = remoteProvisionerUrlConfigured ? provisionerProbe.payerMinSol : null
  const remoteProvisionerPayerHealthy = remoteProvisionerUrlConfigured ? provisionerProbe.payerHealthy : null
  const remoteProvisionerPayerError = remoteProvisionerUrlConfigured ? provisionerProbe.payerError : null
  const canonicalBridgeTokenAllowlist = readCanonicalBridgeTokenAllowlist()
  const canonicalBridgeTokenAllowlistRequired = readCanonicalBridgeTokenAllowlistRequired()
  const defaultRouteBridgeTokenPolicy = defaultRouteBridgeToken
    ? evaluateCanonicalBridgeTokenPolicy({ bridgeToken: defaultRouteBridgeToken })
    : null
  const defaultRouteBridgeTokenAllowlisted = defaultRouteBridgeTokenPolicy
    ? defaultRouteBridgeTokenPolicy.allowed
    : null
  const bridgeLivenessPolicy = readSolanaBridgeLivenessPolicy()
  const bridgeLivenessApplies =
    bridgeLivenessPolicy.enforced && dynamicProvisioningMode === 'remote-provisioner'
  const bridgeLivenessEvaluation = bridgeLivenessApplies
    ? evaluateRemoteProvisionerLiveness({
        enforced: true,
        maxHealthAgeSeconds: bridgeLivenessPolicy.maxHealthAgeSeconds,
        probe: provisionerProbe,
      })
    : { healthy: true, blockers: [] as string[], healthAgeSeconds: null as number | null }

  const blockers: string[] = []
  if (!batcherAddress) {
    blockers.push('Deployment batcher (DeploymentBatcher) is not configured on server.')
  }
  if (solanaEnabledOnBatcher && adapterHasCode === false) {
    blockers.push('Batcher Solana adapter has no bytecode on Base.')
  }
  if (solanaEnabledOnBatcher && !signerConfigured) {
    blockers.push('Server signer is missing or invalid. Configure SOLANA_ADAPTER_OWNER_PRIVATE_KEY as 0x + 64 hex.')
  }
  if (solanaEnabledOnBatcher && signerMatchesAdapterOwner === false) {
    blockers.push('Server signer does not match Solana adapter owner.')
  }
  if (dynamicProvisioningMode === 'misconfigured') {
    blockers.push(
      'No usable dynamic route runner. Set SOLANA_BRIDGE_CLI_DIR on runtime host, or configure SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL.',
    )
  }
  if (dynamicProvisioningMode === 'remote-provisioner' && remoteProvisionerReachable === false) {
    blockers.push('Remote Solana dynamic provisioner is unreachable from this runtime.')
  }
  if (dynamicProvisioningMode === 'remote-provisioner' && !remoteProvisionerSecretConfigured) {
    blockers.push('Remote Solana dynamic provisioner secret is missing (SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET).')
  }
  if (dynamicProvisioningMode === 'remote-provisioner' && remoteProvisionerHealthOk === false) {
    blockers.push('Remote Solana provisioner health check failed (ok=false).')
  }
  if (dynamicProvisioningMode === 'remote-provisioner' && remoteProvisionerPayerHealthy === false) {
    blockers.push('Remote Solana provisioner payer balance is below required minimum.')
  }
  if (meteoraProvisionerUrlConfigured && !meteoraProvisionerSecretConfigured) {
    blockers.push('Meteora ix provisioner secret is missing (METEORA_IX_PROVISIONER_SECRET).')
  }
  if (solanaEnabledOnBatcher && !defaultMintConfigured && !dynamicRouteEnabled) {
    blockers.push(
      'No default Solana mint configured and dynamic provisioning is disabled. Set SOLANA_DEFAULT_MINT_BYTES32 or enable dynamic provisioning.',
    )
  }
  if (solanaEnabledOnBatcher && defaultRouteBridgeToken && defaultMintRouteReady === false && !dynamicRouteEnabled) {
    blockers.push(
      'Default Solana mint route is not active for SOLANA_DEFAULT_BRIDGE_TOKEN (scalar=0) and dynamic provisioning is disabled.',
    )
  }
  if (solanaEnabledOnBatcher && canonicalBridgeTokenAllowlistRequired && canonicalBridgeTokenAllowlist.size === 0) {
    blockers.push(
      'Canonical bridge token allowlist is required but empty. Configure SOLANA_CANONICAL_BRIDGE_TOKEN_ALLOWLIST.',
    )
  }
  if (
    solanaEnabledOnBatcher &&
    defaultRouteBridgeTokenPolicy &&
    !defaultRouteBridgeTokenPolicy.allowed &&
    defaultRouteBridgeTokenPolicy.message
  ) {
    blockers.push(`Canonical bridge token policy: ${defaultRouteBridgeTokenPolicy.message}`)
  }
  if (solanaEnabledOnBatcher && !existingMintCompatible) {
    for (const blocker of mintEligibility.mintCompatibility.blockers) {
      blockers.push(`OVault compatibility: ${blocker}`)
    }
  }
  if (solanaEnabledOnBatcher && !ovaultComposerConfigured) {
    blockers.push('OVault runtime composer is not configured on the deployment batcher.')
  }
  if (bridgeLivenessApplies && !bridgeLivenessEvaluation.healthy) {
    for (const livenessBlocker of bridgeLivenessEvaluation.blockers) {
      blockers.push(`Bridge liveness: ${livenessBlocker}`)
    }
  }

  const hasRouteSource =
    (defaultMintConfigured && defaultMintRouteReady !== false) ||
    (dynamicRouteEnabled && dynamicProvisioningMode !== 'misconfigured')
  const remoteProvisionerReady =
    dynamicProvisioningMode !== 'remote-provisioner' ||
    (remoteProvisionerSecretConfigured &&
      remoteProvisionerReachable !== false &&
      remoteProvisionerHealthOk !== false &&
      remoteProvisionerPayerHealthy !== false)
  const bridgeLivenessReady = !bridgeLivenessApplies || bridgeLivenessEvaluation.healthy
  const meteoraProvisionerReady = !meteoraProvisionerUrlConfigured || meteoraProvisionerSecretConfigured
  const signerReady = signerConfigured && signerMatchesAdapterOwner !== false
  // Deposit eligibility (dormant compose-deposit lane) intentionally excluded.
  const ovaultEligibilityReady = !solanaEnabledOnBatcher || (existingMintCompatible && redeemEligible)
  const readyForAutoRegistration =
    !!batcherAddress &&
    (!solanaEnabledOnBatcher ||
      (adapterHasCode !== false &&
        signerReady &&
        ovaultEligibilityReady &&
        hasRouteSource &&
        remoteProvisionerReady &&
        bridgeLivenessReady &&
        meteoraProvisionerReady &&
        blockers.length === 0))

  const data: SolanaInfraStatusResponse = {
    admin: admin && isAddress(admin) ? getAddress(admin as Address) : ZERO_ADDRESS,
    creatorVaultBatcher: batcherAddress,
    solanaEnabledOnBatcher,
    batcherAdapter,
    batcherDestination,
    adapterHasCode,
    adapterOwner,
    signerConfigured,
    signerAddress,
    signerMatchesAdapterOwner,
    defaultMintConfigured,
    defaultMintBytes32,
    defaultRouteBridgeToken,
    defaultMintMappedToken,
    defaultMintRouteScalar,
    defaultMintRouteReady,
    dynamicRouteEnabled,
    dynamicProvisioningMode,
    localCliDir,
    localCliDirExists,
    remoteProvisionerUrlConfigured,
    remoteProvisionerSecretConfigured,
    remoteProvisionerHealthUrlConfigured,
    remoteProvisionerHealthProbeUrl,
    remoteProvisionerReachable,
    remoteProvisionerStatusCode,
    remoteProvisionerHealthOk,
    remoteProvisionerPayerConfigured,
    remoteProvisionerPayerPubkey,
    remoteProvisionerPayerBalanceSol,
    remoteProvisionerPayerMinSol,
    remoteProvisionerPayerHealthy,
    remoteProvisionerPayerError,
    canonicalBridgeTokenAllowlistConfigured: canonicalBridgeTokenAllowlist.size > 0,
    canonicalBridgeTokenAllowlistSize: canonicalBridgeTokenAllowlist.size,
    canonicalBridgeTokenAllowlistRequired,
    defaultRouteBridgeTokenAllowlisted,
    bridgeLivenessEnforced: bridgeLivenessPolicy.enforced,
    bridgeLivenessMaxHealthAgeSeconds: bridgeLivenessApplies
      ? bridgeLivenessPolicy.maxHealthAgeSeconds
      : null,
    bridgeLivenessHealthy: bridgeLivenessApplies ? bridgeLivenessEvaluation.healthy : null,
    bridgeLivenessHealthAgeSeconds: bridgeLivenessApplies
      ? bridgeLivenessEvaluation.healthAgeSeconds
      : null,
    bridgeLivenessBlockers: bridgeLivenessApplies ? bridgeLivenessEvaluation.blockers : [],
    meteoraProvisionerUrlConfigured,
    meteoraProvisionerSecretConfigured,
    internalRegistrationSecretConfigured,
    mintCompatibility: mintEligibility.mintCompatibility,
    ovaultComposerConfigured,
    solanaShareMeshReady,
    existingMintCompatible,
    transferHookDetected,
    oftFeeIsZero,
    redeemEligible,
    readyForAutoRegistration,
    blockers,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<SolanaInfraStatusResponse>)
}
