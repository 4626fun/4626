/**
 * Phase2 core CREATE2 fan-out (gauge/cca/oracle) exceeds Base's 2^24 tx gas cap
 * under EntryPoint AA95 when run inside a single UserOp. Pre-create those
 * contracts from an authorized create2 deployer key, then let deployPhase2Core
 * reuse them via DeploymentBatcherPhase2Module._deployOrExisting and spend
 * UserOp gas on wiring only.
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

const SELECTOR_DEPLOY_PHASE2_CORE = '0xf9344d88'

const DEPLOY_PHASE2_CORE_ABI = [
  {
    type: 'function',
    name: 'deployPhase2Core',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
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
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'bytes32' },
          { name: 'wrapper', type: 'bytes32' },
          { name: 'shareOFT', type: 'bytes32' },
          { name: 'gauge', type: 'bytes32' },
          { name: 'cca', type: 'bytes32' },
          { name: 'oracle', type: 'bytes32' },
          { name: 'oftBootstrap', type: 'bytes32' },
        ],
      },
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

function readPrecreatePrivateKey(): Hex | null {
  for (const key of [
    'DEPLOY_SESSION_PHASE2_PRECREATE_PRIVATE_KEY',
    'DEPLOY_SESSION_SELF_BUNDLE_PRIVATE_KEY',
    'PRIVATE_KEY',
    'KPR_PRIVATE_KEY',
  ]) {
    const raw = String(process.env[key] ?? '').trim()
    if (!raw) continue
    const normalized = (raw.startsWith('0x') || raw.startsWith('0X') ? raw : `0x${raw}`) as Hex
    if (/^0x[0-9a-fA-F]{64}$/.test(normalized)) return normalized
  }
  return null
}

function findPhase2CoreCall(calls: Call[]): { to: Address; data: Hex } | null {
  for (const call of calls) {
    const data = String(call.data || '')
    if (!data.toLowerCase().startsWith(SELECTOR_DEPLOY_PHASE2_CORE)) continue
    if (!isAddress(call.to)) continue
    return { to: getAddress(call.to), data: data as Hex }
  }
  return null
}

export type Phase2CorePrecreateResult = {
  skipped: boolean
  reason?: string
  deployed: Array<{ label: string; address: Address; txHash: Hex }>
  existing: Array<{ label: string; address: Address }>
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

  const decoded = decodeFunctionData({
    abi: DEPLOY_PHASE2_CORE_ABI,
    data: core.data,
  })
  if (decoded.functionName !== 'deployPhase2Core') {
    return { skipped: true, reason: 'unexpected_selector', deployed: [], existing: [] }
  }
  const [params, codeIds] = decoded.args

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
      label: 'gauge',
      saltLabel: 'gauge',
      codeId: codeIds.gauge as Hex,
      args: encodeAbiParameters(
        [{ type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'address' }],
        [params.shareOFT, treasury, protocolTreasury, tempOwner],
      ),
    },
    {
      label: 'cca',
      saltLabel: 'cca',
      codeId: codeIds.cca as Hex,
      args: encodeAbiParameters(
        [{ type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'address' }],
        [params.shareOFT, '0x0000000000000000000000000000000000000000', params.vault, params.vault, tempOwner],
      ),
    },
    {
      label: 'oracle',
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

  for (const item of planned) {
    const salt = await publicClient.readContract({
      address: utilsHelper,
      abi: UTILS_ABI,
      functionName: 'saltFor',
      args: [baseSalt, item.saltLabel],
    })
    const creationCode = (await publicClient.readContract({
      address: store,
      abi: STORE_ABI,
      functionName: 'get',
      args: [item.codeId],
    })) as Hex
    const initCodeHash = keccak256(concat([creationCode, item.args]))
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

  return { skipped: false, deployed, existing }
}
