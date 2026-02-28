import type { VercelRequest, VercelResponse } from '@vercel/node'

import { existsSync } from 'node:fs'

import { createPublicClient, getAddress, http, isAddress, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getApiContracts } from '../../../server/_lib/contracts.js'
import { getSessionAddress, isAdminAddress } from '../../../server/_lib/session.js'

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
  // Backward-compatible alias for older dashboards/scripts.
  defaultRouteShareOft: Address | null
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
  const candidates = [
    process.env.SOLANA_DEFAULT_MINT_BYTES32,
    process.env.SOLANA_MINT_BYTES32,
    process.env.SOLANA_SHARE_OFT_DEFAULT_MINT,
  ]
  for (const c of candidates) {
    const v = String(c ?? '').trim()
    if (isBytes32Hex(v) && v.toLowerCase() !== ZERO_BYTES32.toLowerCase()) return v as Hex
  }
  return null
}

function readRegistrationSignerPk(): Hex | null {
  const candidates = [
    process.env.SOLANA_ADAPTER_OWNER_PRIVATE_KEY,
    process.env.KEEPR_PRIVATE_KEY,
    process.env.PRIVATE_KEY,
  ]
  for (const c of candidates) {
    const v = String(c ?? '').trim()
    if (/^0x[0-9a-fA-F]{64}$/.test(v)) return v as Hex
  }
  return null
}

function readDefaultRouteBridgeTokenFromEnv(): Address | null {
  const candidates = [
    process.env.SOLANA_DEFAULT_BRIDGE_TOKEN,
    process.env.SOLANA_DEFAULT_SHARE_OFT,
  ]
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

async function probeProvisioner(url: string, secret: string): Promise<{ reachable: boolean; statusCode: number | null }> {
  if (!url) return { reachable: false, statusCode: null }
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 4_000)
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      signal: ac.signal,
    })
    return { reachable: true, statusCode: res.status }
  } catch {
    return { reachable: false, statusCode: null }
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!isAdminAddress(admin)) {
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
  const remoteProvisionerUrlConfigured = !!remoteProvisionerUrl
  const remoteProvisionerSecretConfigured = !!remoteProvisionerSecret
  const remoteProvisionerHealthUrlConfigured = !!remoteProvisionerHealthUrl

  const signerPk = readRegistrationSignerPk()
  const signerConfigured = !!signerPk
  const signerAddress = signerPk ? getAddress(privateKeyToAccount(signerPk).address) : null

  let batcherAdapter: Address | null = null
  let batcherDestination: Hex | null = null
  let solanaEnabledOnBatcher = false
  let adapterHasCode: boolean | null = null
  let adapterOwner: Address | null = null
  let signerMatchesAdapterOwner: boolean | null = null

  if (batcherAddress) {
    const [adapterRaw, destinationRaw] = await Promise.all([
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
    ])

    batcherAdapter = getAddress((adapterRaw as Address) || ZERO_ADDRESS)
    batcherDestination = ((destinationRaw as Hex) || ZERO_BYTES32) as Hex
    solanaEnabledOnBatcher =
      batcherAdapter.toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
      batcherDestination.toLowerCase() !== ZERO_BYTES32.toLowerCase()

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

  const dynamicProvisioningMode = deriveDynamicProvisioningMode({
    enabled: dynamicRouteEnabled,
    cliExists: localCliDirExists,
    provisionerUrlConfigured: remoteProvisionerUrlConfigured,
  })
  const provisionerProbe = remoteProvisionerUrlConfigured
    ? await probeProvisioner(
        remoteProvisionerHealthUrlConfigured ? remoteProvisionerHealthUrl : remoteProvisionerUrl,
        remoteProvisionerSecret,
      )
    : { reachable: false, statusCode: null as number | null }
  const remoteProvisionerReachable = remoteProvisionerUrlConfigured ? provisionerProbe.reachable : null
  const remoteProvisionerStatusCode = remoteProvisionerUrlConfigured ? provisionerProbe.statusCode : null

  const blockers: string[] = []
  if (!batcherAddress) {
    blockers.push('Deployment batcher (CreatorVaultDeployer) is not configured on server.')
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

  const hasRouteSource =
    (defaultMintConfigured && defaultMintRouteReady !== false) ||
    (dynamicRouteEnabled && dynamicProvisioningMode !== 'misconfigured')
  const signerReady = signerConfigured && signerMatchesAdapterOwner !== false
  const readyForAutoRegistration =
    !!batcherAddress &&
    (!solanaEnabledOnBatcher || (adapterHasCode !== false && signerReady && hasRouteSource && blockers.length === 0))

  const data: SolanaInfraStatusResponse = {
    admin: getAddress(admin as Address),
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
    defaultRouteShareOft: defaultRouteBridgeToken,
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
    remoteProvisionerHealthProbeUrl: remoteProvisionerUrlConfigured
      ? (remoteProvisionerHealthUrlConfigured ? remoteProvisionerHealthUrl : remoteProvisionerUrl)
      : null,
    remoteProvisionerReachable,
    remoteProvisionerStatusCode,
    readyForAutoRegistration,
    blockers,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<SolanaInfraStatusResponse>)
}
