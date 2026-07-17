/**
 * Phase2 core CREATE2 fan-out (gauge/cca/oracle) exceeds Base's 2^24 tx gas cap
 * under EntryPoint AA95 when run inside a single UserOp. Pre-create those
 * contracts from an authorized create2 deployer key, then let deployPhase2Core
 * (or deployPhase2CoreWithRolePolicy) reuse them via
 * DeploymentBatcherPhase2Module._deployOrExisting and spend UserOp gas on wiring only.
 *
 * Init-code hashes are published on the Phase2 module via setPendingInitCodeHashes
 * (shell deployPhase2Core ABI stays unchanged — no hash fields on Phase2CoreParams).
 */
import {
  concat,
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  keccak256,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { resolveDeploySessionRpcUrl } from './deploySessionRpc.js'

/** Shell `deployPhase2Core` selector. */
export const SELECTOR_DEPLOY_PHASE2_CORE = '0xf9344d88'
/** Shell `deployPhase2CoreWithRolePolicy` selector (role-policy rewrite path). */
export const SELECTOR_DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY = '0x6004df9c'

const PHASE2_PARAMS_COMPONENTS = [
  { name: 'creatorToken', type: 'address' },
  { name: 'owner', type: 'address' },
  { name: 'creatorTreasury', type: 'address' },
  { name: 'payoutRecipient', type: 'address' },
  { name: 'vault', type: 'address' },
  { name: 'wrapper', type: 'address' },
  { name: 'shareOFT', type: 'address' },
  { name: 'shareSymbol', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'floorPriceQ96', type: 'uint256' },
] as const

const PHASE2_CODE_IDS_COMPONENTS = [
  { name: 'vault', type: 'bytes32' },
  { name: 'wrapper', type: 'bytes32' },
  { name: 'shareOFT', type: 'bytes32' },
  { name: 'gauge', type: 'bytes32' },
  { name: 'cca', type: 'bytes32' },
  { name: 'oracle', type: 'bytes32' },
  { name: 'oftBootstrap', type: 'bytes32' },
] as const

const DEPLOY_PHASE2_CORE_ABI = [
  {
    type: 'function',
    name: 'deployPhase2Core',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: PHASE2_PARAMS_COMPONENTS },
      { name: 'codeIds', type: 'tuple', components: PHASE2_CODE_IDS_COMPONENTS },
    ],
    outputs: [],
  },
] as const

const DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY_ABI = [
  {
    type: 'function',
    name: 'deployPhase2CoreWithRolePolicy',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: PHASE2_PARAMS_COMPONENTS },
      { name: 'codeIds', type: 'tuple', components: PHASE2_CODE_IDS_COMPONENTS },
      { name: 'rolePolicyId', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

const BATCHER_VIEW_ABI = [
  { type: 'function', name: 'create2Deployer', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'utilsHelper', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'protocolTreasury', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'registry', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'chainlinkEthUsd', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'phase2Module', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const SET_PENDING_INIT_CODE_HASHES_ABI = [
  {
    type: 'function',
    name: 'setPendingInitCodeHashes',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'salts', type: 'bytes32[3]' },
      { name: 'hashes', type: 'bytes32[3]' },
    ],
    outputs: [],
  },
] as const

const UTILS_ABI = [
  {
    type: 'function',
    name: 'deriveBaseSalt',
    stateMutability: 'pure',
    inputs: [
      { name: 'creatorToken', type: 'address' },
      { name: 'owner', type: 'address' },
      { name: 'chainId', type: 'uint256' },
      { name: 'version', type: 'string' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'saltFor',
    stateMutability: 'pure',
    inputs: [
      { name: 'baseSalt', type: 'bytes32' },
      { name: 'label', type: 'string' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'toLower',
    stateMutability: 'pure',
    inputs: [{ name: 'value', type: 'string' }],
    outputs: [{ type: 'string' }],
  },
] as const

const CREATE2_ABI = [
  {
    type: 'function',
    name: 'deploy',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'salt', type: 'bytes32' },
      { name: 'codeId', type: 'bytes32' },
      { name: 'constructorArgs', type: 'bytes' },
    ],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'computeAddress',
    stateMutability: 'view',
    inputs: [
      { name: 'salt', type: 'bytes32' },
      { name: 'initCodeHash', type: 'bytes32' },
    ],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'store',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'authorizedDeployers',
    stateMutability: 'view',
    inputs: [{ name: 'deployer', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const

const STORE_ABI = [
  {
    type: 'function',
    name: 'get',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ type: 'bytes' }],
  },
] as const

type Call = { to: string; data?: string; value?: string | number | bigint }

type Phase2CoreParams = {
  creatorToken: Address
  owner: Address
  creatorTreasury: Address
  payoutRecipient: Address
  vault: Address
  wrapper: Address
  shareOFT: Address
  shareSymbol: string
  version: string
  floorPriceQ96: bigint
}

type Phase2CodeIds = {
  vault: Hex
  wrapper: Hex
  shareOFT: Hex
  gauge: Hex
  cca: Hex
  oracle: Hex
  oftBootstrap: Hex
}

export function isPhase2CoreCalldata(data: string): boolean {
  const selector = data.slice(0, 10).toLowerCase()
  return (
    selector === SELECTOR_DEPLOY_PHASE2_CORE ||
    selector === SELECTOR_DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY
  )
}

/**
 * Precreate must use a dedicated CREATE2-authorized key — do not fall back to
 * broad operator / KPR keys that may also hold unrelated authority.
 */
export function readPrecreatePrivateKey(
  env: Record<string, string | undefined> = process.env,
): Hex | null {
  const raw = String(env.DEPLOY_SESSION_PHASE2_PRECREATE_PRIVATE_KEY ?? '').trim()
  if (!raw) return null
  const normalized = (raw.startsWith('0x') || raw.startsWith('0X') ? raw : `0x${raw}`) as Hex
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) return null
  return normalized
}

export function findPhase2CoreCall(calls: Call[]): { to: Address; data: Hex } | null {
  for (const call of calls) {
    const data = String(call.data || '')
    if (!isPhase2CoreCalldata(data)) continue
    if (!isAddress(call.to)) continue
    return { to: getAddress(call.to), data: data as Hex }
  }
  return null
}

export function decodePhase2CoreCreateArgs(data: Hex): {
  params: Phase2CoreParams
  codeIds: Phase2CodeIds
  variant: 'deployPhase2Core' | 'deployPhase2CoreWithRolePolicy'
  rolePolicyId?: bigint
} | null {
  const selector = data.slice(0, 10).toLowerCase()
  try {
    if (selector === SELECTOR_DEPLOY_PHASE2_CORE) {
      const decoded = decodeFunctionData({ abi: DEPLOY_PHASE2_CORE_ABI, data })
      if (decoded.functionName !== 'deployPhase2Core') return null
      const [params, codeIds] = decoded.args
      return { params, codeIds, variant: 'deployPhase2Core' }
    }
    if (selector === SELECTOR_DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY) {
      const decoded = decodeFunctionData({
        abi: DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY_ABI,
        data,
      })
      if (decoded.functionName !== 'deployPhase2CoreWithRolePolicy') return null
      const [params, codeIds, rolePolicyId] = decoded.args
      return { params, codeIds, variant: 'deployPhase2CoreWithRolePolicy', rolePolicyId }
    }
  } catch {
    return null
  }
  return null
}

export type Phase2CoreInitCodeHashes = {
  gauge: Hex
  cca: Hex
  oracle: Hex
}

export type Phase2CoreSalts = {
  gauge: Hex
  cca: Hex
  oracle: Hex
}

export type Phase2CorePrecreateResult = {
  skipped: boolean
  reason?: string
  deployed: Array<{ label: string; address: Address; txHash: Hex }>
  existing: Array<{ label: string; address: Address }>
  /** Present when precreate computed CREATE2 init-code hashes for all three targets. */
  initCodeHashes?: Phase2CoreInitCodeHashes
  salts?: Phase2CoreSalts
  /** True when setPendingInitCodeHashes was published on the Phase2 module. */
  publishedPendingHashes?: boolean
}

/**
 * Publish gauge/cca/oracle CREATE2 init-code hashes on the live Phase2 module
 * so deployPhase2Core can reuse precreated contracts without hashing in the UserOp.
 */
export async function publishPhase2PendingInitCodeHashes(params: {
  batcher: Address
  salts: Phase2CoreSalts
  hashes: Phase2CoreInitCodeHashes
}): Promise<{ txHash: Hex } | { skipped: true; reason: string }> {
  const pk = readPrecreatePrivateKey()
  if (!pk) {
    return { skipped: true, reason: 'precreate_key_missing' }
  }

  const account = privateKeyToAccount(pk)
  const rpcUrl = resolveDeploySessionRpcUrl()
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 120_000 }),
  })
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl, { timeout: 120_000 }),
  })

  const phase2Module = await publicClient.readContract({
    address: params.batcher,
    abi: BATCHER_VIEW_ABI,
    functionName: 'phase2Module',
  })
  if (!phase2Module || phase2Module === '0x0000000000000000000000000000000000000000') {
    return { skipped: true, reason: 'phase2_module_missing' }
  }

  try {
    const data = encodeFunctionData({
      abi: SET_PENDING_INIT_CODE_HASHES_ABI,
      functionName: 'setPendingInitCodeHashes',
      args: [
        [params.salts.gauge, params.salts.cca, params.salts.oracle],
        [params.hashes.gauge, params.hashes.cca, params.hashes.oracle],
      ],
    })
    const txHash = await walletClient.sendTransaction({
      to: getAddress(phase2Module),
      data,
      gas: 500_000n,
    })
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 })
    return { txHash }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err ?? 'publish_failed')
    return { skipped: true, reason: `setPendingInitCodeHashes_failed:${msg.slice(0, 160)}` }
  }
}

/**
 * Ensure gauge/cca/oracle CREATE2 targets exist before the phase2 core UserOp.
 * No-op when the batcher call is missing or the precreate key is unauthorized.
 */
export async function ensurePhase2CoreCreatesPrecreated(calls: Call[]): Promise<Phase2CorePrecreateResult> {
  const core = findPhase2CoreCall(calls)
  if (!core) {
    return { skipped: true, reason: 'no_deployPhase2Core_call', deployed: [], existing: [] }
  }

  const pk = readPrecreatePrivateKey()
  if (!pk) {
    return { skipped: true, reason: 'precreate_key_missing', deployed: [], existing: [] }
  }

  const account = privateKeyToAccount(pk)
  const rpcUrl = resolveDeploySessionRpcUrl()
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 120_000 }),
  })
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl, { timeout: 120_000 }),
  })

  const decoded = decodePhase2CoreCreateArgs(core.data)
  if (!decoded) {
    return { skipped: true, reason: 'unexpected_selector', deployed: [], existing: [] }
  }
  const { params, codeIds } = decoded

  const [create2Deployer, utilsHelper, protocolTreasury, registry, chainlinkEthUsd] = await Promise.all([
    publicClient.readContract({ address: core.to, abi: BATCHER_VIEW_ABI, functionName: 'create2Deployer' }),
    publicClient.readContract({ address: core.to, abi: BATCHER_VIEW_ABI, functionName: 'utilsHelper' }),
    publicClient.readContract({ address: core.to, abi: BATCHER_VIEW_ABI, functionName: 'protocolTreasury' }),
    publicClient.readContract({ address: core.to, abi: BATCHER_VIEW_ABI, functionName: 'registry' }),
    publicClient.readContract({ address: core.to, abi: BATCHER_VIEW_ABI, functionName: 'chainlinkEthUsd' }),
  ])

  const [authorized, create2Owner] = await Promise.all([
    publicClient.readContract({
      address: create2Deployer,
      abi: CREATE2_ABI,
      functionName: 'authorizedDeployers',
      args: [account.address],
    }),
    publicClient.readContract({
      address: create2Deployer,
      abi: CREATE2_ABI,
      functionName: 'owner',
    }),
  ])
  if (!authorized && getAddress(create2Owner) !== getAddress(account.address)) {
    return {
      skipped: true,
      reason: `precreate_key_not_authorized:${account.address}`,
      deployed: [],
      existing: [],
    }
  }

  const store = await publicClient.readContract({
    address: create2Deployer,
    abi: CREATE2_ABI,
    functionName: 'store',
  })

  const baseSalt = await publicClient.readContract({
    address: utilsHelper,
    abi: UTILS_ABI,
    functionName: 'deriveBaseSalt',
    args: [params.creatorToken, params.owner, BigInt(base.id), params.version],
  })
  const shareSymbolLower = await publicClient.readContract({
    address: utilsHelper,
    abi: UTILS_ABI,
    functionName: 'toLower',
    args: [params.shareSymbol],
  })

  // Module uses address(this)=batcher as tempOwner in constructor args.
  const tempOwner = core.to
  const treasury = protocolTreasury

  const planned = [
    {
      label: 'gauge' as const,
      saltLabel: 'gauge',
      codeId: codeIds.gauge as Hex,
      args: encodeAbiParameters(
        [{ type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'address' }],
        [params.shareOFT, treasury, protocolTreasury, tempOwner],
      ),
    },
    {
      label: 'cca' as const,
      saltLabel: 'cca',
      codeId: codeIds.cca as Hex,
      args: encodeAbiParameters(
        [{ type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'address' }],
        [params.shareOFT, '0x0000000000000000000000000000000000000000', params.vault, params.vault, tempOwner],
      ),
    },
    {
      label: 'oracle' as const,
      saltLabel: 'oracle',
      codeId: codeIds.oracle as Hex,
      args: encodeAbiParameters(
        [{ type: 'address' }, { type: 'address' }, { type: 'string' }, { type: 'address' }],
        [registry, chainlinkEthUsd, shareSymbolLower, tempOwner],
      ),
    },
  ] as const

  const deployed: Phase2CorePrecreateResult['deployed'] = []
  const existing: Phase2CorePrecreateResult['existing'] = []
  const hashByLabel: Partial<Record<'gauge' | 'cca' | 'oracle', Hex>> = {}
  const saltByLabel: Partial<Record<'gauge' | 'cca' | 'oracle', Hex>> = {}

  for (const item of planned) {
    const salt = await publicClient.readContract({
      address: utilsHelper,
      abi: UTILS_ABI,
      functionName: 'saltFor',
      args: [baseSalt, item.saltLabel],
    })
    saltByLabel[item.label] = salt as Hex
    const creationCode = (await publicClient.readContract({
      address: store,
      abi: STORE_ABI,
      functionName: 'get',
      args: [item.codeId],
    })) as Hex
    const initCodeHash = keccak256(concat([creationCode, item.args]))
    hashByLabel[item.label] = initCodeHash
    const predicted = await publicClient.readContract({
      address: create2Deployer,
      abi: CREATE2_ABI,
      functionName: 'computeAddress',
      args: [salt, initCodeHash],
    })
    const code = await publicClient.getBytecode({ address: predicted })
    if (code && code !== '0x') {
      existing.push({ label: item.label, address: predicted })
      continue
    }

    const data = encodeFunctionData({
      abi: CREATE2_ABI,
      functionName: 'deploy',
      args: [salt, item.codeId, item.args],
    })
    const txHash = await walletClient.sendTransaction({
      to: create2Deployer,
      data,
      // Each CREATE2 is ~3.4M–7.5M; stay under Base 2^24.
      gas: 12_000_000n,
    })
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 })
    const deployedCode = await publicClient.getBytecode({ address: predicted })
    if (!deployedCode || deployedCode === '0x') {
      throw new Error(`phase2_precreate_failed:${item.label}:tx=${txHash}:addr=${predicted}`)
    }
    deployed.push({ label: item.label, address: predicted, txHash })
  }

  const initCodeHashes =
    hashByLabel.gauge && hashByLabel.cca && hashByLabel.oracle
      ? { gauge: hashByLabel.gauge, cca: hashByLabel.cca, oracle: hashByLabel.oracle }
      : undefined
  const salts =
    saltByLabel.gauge && saltByLabel.cca && saltByLabel.oracle
      ? { gauge: saltByLabel.gauge, cca: saltByLabel.cca, oracle: saltByLabel.oracle }
      : undefined

  let publishedPendingHashes = false
  if (initCodeHashes && salts) {
    const published = await publishPhase2PendingInitCodeHashes({
      batcher: core.to,
      salts,
      hashes: initCodeHashes,
    })
    if (!('skipped' in published)) {
      publishedPendingHashes = true
    }
  }

  return {
    skipped: false,
    deployed,
    existing,
    initCodeHashes,
    salts,
    publishedPendingHashes,
  }
}
