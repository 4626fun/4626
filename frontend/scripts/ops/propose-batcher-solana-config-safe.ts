#!/usr/bin/env node

import Safe from '@safe-global/protocol-kit'
import { OperationType } from '@safe-global/types-kit'
import { encodeFunctionData, getAddress, isAddress, type Address } from 'viem'
import {
  SPLIT_PHASE1_DEPLOYMENT_BATCHER,
  SPLIT_PHASE1_PHASE1_MODULE,
  SPLIT_PHASE1_PHASE2_MODULE,
  SPLIT_PHASE1_PHASE3_HELPER,
  SPLIT_PHASE1_UNIV4_HELPER,
  SPLIT_PHASE1_UTILS_HELPER,
  isDeprecatedCreatorVaultBatcherAddress,
} from '../../src/config/contracts.defaults.js'
import { deploymentBatcherNotConfiguredMessage } from '../../src/lib/deploy/deploymentBatcherConfigError.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const DEFAULT_SAFE_SERVICE_URL = 'https://api.safe.global/tx-service/base'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

const SET_SOLANA_CONFIG_ABI = [
  {
    type: 'function',
    name: 'setSolanaConfig',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_adapter', type: 'address' },
      { name: '_destination', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

const SET_OVAULT_RUNTIME_CONFIG_ABI = [
  {
    type: 'function',
    name: 'setOVaultRuntimeConfig',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_hubComposer', type: 'address' },
      { name: '_solanaEid', type: 'uint32' },
      { name: '_enabled', type: 'bool' },
    ],
    outputs: [],
  },
] as const

const SET_SOLANA_SHARE_OFT_PEER_ABI = [
  {
    type: 'function',
    name: 'setSolanaShareOftPeer',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_peer', type: 'bytes32' }],
    outputs: [],
  },
] as const

const WIRE_DEPLOYMENT_HELPERS_ABI = [
  {
    type: 'function',
    name: 'wireDeploymentHelpers',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_phase2Module', type: 'address' },
      { name: '_phase3Helper', type: 'address' },
      { name: '_uniV4Helper', type: 'address' },
      { name: '_utilsHelper', type: 'address' },
    ],
    outputs: [],
  },
] as const

const SET_PHASE1_MODULE_ABI = [
  {
    type: 'function',
    name: 'setPhase1Module',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_phase1Module', type: 'address' }],
    outputs: [],
  },
] as const

type ProposalSpec = {
  label: string
  to: Address
  data: `0x${string}`
}

function usage(): void {
  process.stdout.write(`Usage:
  pnpm -C frontend exec tsx scripts/ops/propose-batcher-solana-config-safe.ts [options]

Options:
  --propose                  Submit proposal to Safe service (default: dry-run)
  --no-solana-config         Skip setSolanaConfig proposal
  --only-ovault-runtime      Propose only setOVaultRuntimeConfig
  --batcher <address>        DeploymentBatcher address (default from env)
  --adapter <address>        Solana bridge adapter (default: SOLANA_BRIDGE_ADAPTER)
  --destination <bytes32>    Solana destination pubkey bytes32 (default: SOLANA_DESTINATION)
  --safe-address <address>   Safe address (default: SAFE_ADDRESS or PROTOCOL_TREASURY)
  --safe-owner-pk <hex>      Safe owner private key signer (default: SAFE_OWNER_* or PRIVATE_KEY)
  --safe-service-url <url>   Safe transaction service URL (default: Base service)
  --safe-api-key <key>       Safe API key (default: SAFE_API_KEY env)
  --include-ovault-runtime   Also propose setOVaultRuntimeConfig(...)
  --no-ovault-runtime        Force skipping OVault runtime proposal
  --include-share-oft-peer   Also propose setSolanaShareOftPeer(...)
  --only-share-oft-peer      Propose only setSolanaShareOftPeer
  --include-wire-helpers     Propose wireDeploymentHelpers + setPhase1Module (default for new batcher cutover)
  --only-wire-helpers        Propose only helper wiring (no solana/ovault config)
  --phase1-module <address>  Phase1 module (default: SPLIT_PHASE1_PHASE1_MODULE)
  --phase2-module <address>  Phase2 module (default: SPLIT_PHASE1_PHASE2_MODULE)
  --phase3-helper <address>    Phase3 helper (default: SPLIT_PHASE1_PHASE3_HELPER)
  --uni-v4-helper <address>    UniV4 helper (default: SPLIT_PHASE1_UNIV4_HELPER)
  --utils-helper <address>     Utils helper (default: SPLIT_PHASE1_UTILS_HELPER)
  --share-oft-peer <bytes32> Default ShareOFT mesh peer (default: SOLANA_SHARE_OFT_PEER)
  --ovault-hub-composer <a>  OVault hub composer (default: OVAULT_HUB_COMPOSER)
  --ovault-solana-eid <n>    OVault Solana EID (default: OVAULT_SOLANA_EID)
  --ovault-enabled <bool>    OVault runtime enabled flag (default: true)
  --rpc <url>                RPC URL (default: BASE_RPC_URL)
  --chain-id <id>            Chain ID (default: CHAIN_ID or 8453)
  --help                     Show this help

Examples:
  pnpm -C frontend exec tsx scripts/ops/propose-batcher-solana-config-safe.ts \\
    --batcher 0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8

  pnpm -C frontend exec tsx scripts/ops/propose-batcher-solana-config-safe.ts \\
    --only-ovault-runtime --batcher 0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8 --ovault-hub-composer <address> --ovault-solana-eid 30168
`)
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function normalizeAddress(value: unknown): Address | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!isAddress(raw)) return null
  return getAddress(raw) as Address
}

function normalizePrivateKey(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
}

function parseChainId(raw: string): bigint {
  const n = Number(raw.trim())
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid chain id: ${raw}`)
  }
  return BigInt(Math.floor(n))
}

function parseUint32(raw: string, label: string): number {
  const n = Number(raw.trim())
  if (!Number.isFinite(n) || n < 0 || n > 0xffffffff || !Number.isInteger(n)) {
    throw new Error(`Invalid ${label}: ${raw}`)
  }
  return n
}

function parseBool(raw: string, fallback: boolean): boolean {
  const v = raw.trim().toLowerCase()
  if (!v) return fallback
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return fallback
}

function assertBytes32(raw: string): `0x${string}` {
  const value = raw.trim().toLowerCase()
  if (!/^0x[0-9a-f]{64}$/.test(value)) {
    throw new Error(`Invalid bytes32 destination: ${raw}`)
  }
  return value as `0x${string}`
}

function buildSetSolanaConfigCalldata(adapter: Address, destination: `0x${string}`): `0x${string}` {
  return encodeFunctionData({
    abi: SET_SOLANA_CONFIG_ABI,
    functionName: 'setSolanaConfig',
    args: [adapter, destination],
  })
}

function buildSetOVaultRuntimeCalldata(
  hubComposer: Address,
  solanaEid: number,
  enabled: boolean,
): `0x${string}` {
  return encodeFunctionData({
    abi: SET_OVAULT_RUNTIME_CONFIG_ABI,
    functionName: 'setOVaultRuntimeConfig',
    args: [hubComposer, solanaEid, enabled],
  })
}

function buildSetSolanaShareOftPeerCalldata(peer: `0x${string}`): `0x${string}` {
  return encodeFunctionData({
    abi: SET_SOLANA_SHARE_OFT_PEER_ABI,
    functionName: 'setSolanaShareOftPeer',
    args: [peer],
  })
}

function buildWireDeploymentHelpersCalldata(params: {
  phase2Module: Address
  phase3Helper: Address
  uniV4Helper: Address
  utilsHelper: Address
}): `0x${string}` {
  return encodeFunctionData({
    abi: WIRE_DEPLOYMENT_HELPERS_ABI,
    functionName: 'wireDeploymentHelpers',
    args: [params.phase2Module, params.phase3Helper, params.uniV4Helper, params.utilsHelper],
  })
}

function buildSetPhase1ModuleCalldata(phase1Module: Address): `0x${string}` {
  return encodeFunctionData({
    abi: SET_PHASE1_MODULE_ABI,
    functionName: 'setPhase1Module',
    args: [phase1Module],
  })
}

function toStringInt(value: unknown, fallback = '0'): string {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value).toString()
  if (typeof value === 'string' && value.trim()) return value.trim()
  return fallback
}

function toNumberInt(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'bigint') {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    return Number.isFinite(n) ? Math.trunc(n) : fallback
  }
  return fallback
}

function resolveTxServiceApiBase(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('Safe transaction service URL is empty')
  if (trimmed.endsWith('/api/v1')) return trimmed.slice(0, -3)
  if (trimmed.endsWith('/api')) return trimmed
  return `${trimmed}/api`
}

async function txServiceRequest<T>(params: {
  url: string
  method: 'GET' | 'POST'
  apiKey: string
  body?: unknown
}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (params.body !== undefined) headers['content-type'] = 'application/json'
  if (params.apiKey) headers.authorization = `Bearer ${params.apiKey}`

  const response = await fetch(params.url, {
    method: params.method,
    headers,
    body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
  })
  const text = await response.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }
  if (!response.ok) {
    const message =
      (typeof payload === 'object' &&
        payload &&
        ((payload as any).detail || (payload as any).message || (payload as any).error)) ||
      text ||
      response.statusText
    throw new Error(`Tx service ${response.status} for ${params.url}: ${String(message)}`)
  }
  return payload as T
}

async function getNextNonceFromTxService(params: {
  txServiceApiBase: string
  safeAddress: Address
  apiKey: string
}): Promise<number> {
  const safeInfo = await txServiceRequest<{ nonce?: string | number }>({
    url: `${params.txServiceApiBase}/v1/safes/${params.safeAddress}/`,
    method: 'GET',
    apiKey: params.apiKey,
  })
  const currentNonce = toNumberInt(safeInfo?.nonce, 0)
  const pending = await txServiceRequest<{ results?: Array<{ nonce?: string | number }> }>({
    url: `${params.txServiceApiBase}/v1/safes/${params.safeAddress}/multisig-transactions/?executed=false`,
    method: 'GET',
    apiKey: params.apiKey,
  })
  let nextNonce = currentNonce
  for (const tx of pending.results ?? []) {
    const txNonce = toNumberInt(tx?.nonce, -1)
    if (txNonce >= nextNonce) nextNonce = txNonce + 1
  }
  return nextNonce
}

async function main() {
  if (hasFlag('--help')) {
    usage()
    return
  }

  const propose = hasFlag('--propose')

  const batcher = normalizeAddress(
    getArg(
      '--batcher',
      process.env.CREATOR_VAULT_BATCHER_AUTO_HANDOFF ||
        process.env.CREATOR_VAULT_BATCHER ||
        process.env.DEPLOYMENT_BATCHER ||
        '',
    ),
  )
  if (!batcher) throw new Error('Missing --batcher (or CREATOR_VAULT_BATCHER*_env)')
  if (isDeprecatedCreatorVaultBatcherAddress(batcher)) {
    throw new Error(`Deprecated batcher alias is blocked. ${deploymentBatcherNotConfiguredMessage(batcher)}`)
  }

  const onlyWireHelpers = hasFlag('--only-wire-helpers')
  const includeWireHelpers = onlyWireHelpers
    ? true
    : hasFlag('--include-wire-helpers') ||
      parseBool(process.env.CONFIGURE_BATCHER_WIRE_HELPERS || '', false)

  const includeSolanaConfig =
    onlyWireHelpers || hasFlag('--only-ovault-runtime') || hasFlag('--only-share-oft-peer')
      ? false
      : hasFlag('--no-solana-config')
        ? false
        : true
  const adapter = normalizeAddress(getArg('--adapter', process.env.SOLANA_BRIDGE_ADAPTER || ''))
  const destination = getArg('--destination', process.env.SOLANA_DESTINATION || '')
  if (includeSolanaConfig) {
    if (!adapter) throw new Error('Missing --adapter (or SOLANA_BRIDGE_ADAPTER env)')
    assertBytes32(destination)
  }

  const safeAddress = normalizeAddress(
    getArg('--safe-address', process.env.SAFE_ADDRESS || process.env.PROTOCOL_TREASURY || ''),
  )
  if (!safeAddress) throw new Error('Missing --safe-address (or SAFE_ADDRESS / PROTOCOL_TREASURY env)')

  const safeOwnerPrivateKey = normalizePrivateKey(
    getArg(
      '--safe-owner-pk',
      process.env.SAFE_OWNER_PRIVATE_KEY || process.env.SAFE_OWNER_PK || process.env.PRIVATE_KEY || '',
    ),
  )
  if (!safeOwnerPrivateKey) {
    throw new Error('Missing --safe-owner-pk (or SAFE_OWNER_PRIVATE_KEY / SAFE_OWNER_PK / PRIVATE_KEY env)')
  }

  const rpcUrl = getArg('--rpc', process.env.BASE_RPC_URL || '')
  if (!rpcUrl.trim()) throw new Error('Missing --rpc (or BASE_RPC_URL env)')

  const safeServiceUrl = getArg('--safe-service-url', process.env.SAFE_TX_SERVICE_URL || DEFAULT_SAFE_SERVICE_URL)
  const safeApiKey = getArg('--safe-api-key', process.env.SAFE_API_KEY || '')
  const txServiceApiBase = resolveTxServiceApiBase(safeServiceUrl)
  const chainId = parseChainId(getArg('--chain-id', process.env.CHAIN_ID || '8453'))

  const includeOvaultRuntime = onlyWireHelpers
    ? false
    : hasFlag('--only-share-oft-peer')
      ? false
      : hasFlag('--only-ovault-runtime')
        ? true
        : hasFlag('--include-ovault-runtime')
          ? true
          : hasFlag('--no-ovault-runtime')
            ? false
            : parseBool(process.env.CONFIGURE_OVAULT_RUNTIME || '', false)
  const includeShareOftPeer = onlyWireHelpers
    ? false
    : hasFlag('--only-share-oft-peer')
      ? true
      : hasFlag('--include-share-oft-peer')
        ? true
        : parseBool(process.env.CONFIGURE_SOLANA_SHARE_OFT_PEER || '', false)
  const shareOftPeerRaw = getArg('--share-oft-peer', process.env.SOLANA_SHARE_OFT_PEER || '')
  if (includeShareOftPeer) {
    assertBytes32(shareOftPeerRaw)
  }
  const phase1Module = normalizeAddress(
    getArg('--phase1-module', process.env.SPLIT_PHASE1_PHASE1_MODULE || SPLIT_PHASE1_PHASE1_MODULE),
  )
  const phase2Module = normalizeAddress(
    getArg('--phase2-module', process.env.SPLIT_PHASE1_PHASE2_MODULE || SPLIT_PHASE1_PHASE2_MODULE),
  )
  const phase3Helper = normalizeAddress(
    getArg('--phase3-helper', process.env.SPLIT_PHASE1_PHASE3_HELPER || SPLIT_PHASE1_PHASE3_HELPER),
  )
  const uniV4Helper = normalizeAddress(
    getArg('--uni-v4-helper', process.env.SPLIT_PHASE1_UNIV4_HELPER || SPLIT_PHASE1_UNIV4_HELPER),
  )
  const utilsHelper = normalizeAddress(
    getArg('--utils-helper', process.env.SPLIT_PHASE1_UTILS_HELPER || SPLIT_PHASE1_UTILS_HELPER),
  )
  if (includeWireHelpers) {
    if (!phase1Module || !phase2Module || !phase3Helper || !uniV4Helper || !utilsHelper) {
      throw new Error('Wire helpers requires all module/helper addresses')
    }
  }
  const ovaultHubComposer = normalizeAddress(
    getArg('--ovault-hub-composer', process.env.OVAULT_HUB_COMPOSER || ''),
  )
  const ovaultSolanaEidRaw = getArg('--ovault-solana-eid', process.env.OVAULT_SOLANA_EID || '')
  const ovaultEnabled = parseBool(getArg('--ovault-enabled', process.env.OVAULT_RUNTIME_ENABLED || ''), true)

  const proposals: ProposalSpec[] = []
  if (includeWireHelpers) {
    proposals.push({
      label: 'wireDeploymentHelpers',
      to: batcher,
      data: buildWireDeploymentHelpersCalldata({
        phase2Module: phase2Module!,
        phase3Helper: phase3Helper!,
        uniV4Helper: uniV4Helper!,
        utilsHelper: utilsHelper!,
      }),
    })
    proposals.push({
      label: 'setPhase1Module',
      to: batcher,
      data: buildSetPhase1ModuleCalldata(phase1Module!),
    })
  }
  if (includeSolanaConfig) {
    proposals.push({
      label: 'setSolanaConfig',
      to: batcher,
      data: buildSetSolanaConfigCalldata(adapter!, assertBytes32(destination)),
    })
  }
  if (includeOvaultRuntime) {
    if (ovaultEnabled) {
      if (!ovaultHubComposer) {
        throw new Error('Missing OVault hub composer (--ovault-hub-composer or OVAULT_HUB_COMPOSER env)')
      }
      const ovaultSolanaEid = parseUint32(ovaultSolanaEidRaw, 'ovault-solana-eid')
      if (ovaultSolanaEid <= 0) {
        throw new Error('OVault Solana EID must be > 0 when ovault runtime is enabled')
      }
      proposals.push({
        label: 'setOVaultRuntimeConfig',
        to: batcher,
        data: buildSetOVaultRuntimeCalldata(ovaultHubComposer, ovaultSolanaEid, true),
      })
    } else {
      proposals.push({
        label: 'setOVaultRuntimeConfig',
        to: batcher,
        data: buildSetOVaultRuntimeCalldata(ZERO_ADDRESS, 0, false),
      })
    }
  }
  if (includeShareOftPeer) {
    proposals.push({
      label: 'setSolanaShareOftPeer',
      to: batcher,
      data: buildSetSolanaShareOftPeerCalldata(assertBytes32(shareOftPeerRaw)),
    })
  }

  if (proposals.length === 0) {
    throw new Error('No proposals selected. Enable at least one operation.')
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: propose ? 'propose' : 'dry-run',
        chainId: chainId.toString(),
        safeAddress,
        batcher,
        adapter: adapter ?? null,
        destination: includeSolanaConfig ? assertBytes32(destination) : null,
        includeWireHelpers,
        includeSolanaConfig,
        includeOvaultRuntime,
        includeShareOftPeer,
        phase1Module: includeWireHelpers ? phase1Module : null,
        phase2Module: includeWireHelpers ? phase2Module : null,
        phase3Helper: includeWireHelpers ? phase3Helper : null,
        uniV4Helper: includeWireHelpers ? uniV4Helper : null,
        utilsHelper: includeWireHelpers ? utilsHelper : null,
        ovaultEnabled,
        shareOftPeer: includeShareOftPeer ? assertBytes32(shareOftPeerRaw) : null,
        safeServiceUrl,
        txServiceApiBase,
        safeApiKeyConfigured: safeApiKey.length > 0,
        proposals,
      },
      null,
      2,
    )}\n`,
  )

  if (!propose) {
    process.stdout.write('Dry-run complete. Re-run with --propose to submit to Safe.\n')
    return
  }

  const protocolKit = await Safe.init({
    provider: rpcUrl,
    signer: safeOwnerPrivateKey,
    safeAddress,
  })
  const signerAddressRaw = await protocolKit.getSafeProvider().getSignerAddress()
  const signerAddress = normalizeAddress(signerAddressRaw)
  if (!signerAddress) throw new Error('Unable to resolve Safe signer address')

  const baseNonce = await getNextNonceFromTxService({
    txServiceApiBase,
    safeAddress,
    apiKey: safeApiKey,
  })
  if (!Number.isFinite(baseNonce) || baseNonce < 0) {
    throw new Error(`Invalid Safe nonce returned by service: ${String(baseNonce)}`)
  }

  const submitted: Array<{
    label: string
    nonce: number
    safeTxHash: string
    safeUrl: string
  }> = []

  for (let index = 0; index < proposals.length; index++) {
    const proposal = proposals[index]
    if (!proposal) continue
    const txNonce = baseNonce + index

    const txData = {
      to: proposal.to,
      value: '0',
      data: proposal.data,
      operation: OperationType.Call,
    }
    const safeTx = await protocolKit.createTransaction({
      transactions: [txData],
      options: { nonce: txNonce },
    })
    const signedSafeTx = await protocolKit.signTransaction(safeTx)
    const safeTxHash = await protocolKit.getTransactionHash(signedSafeTx)
    const senderSignature =
      (signedSafeTx as any)?.getSignature?.(signerAddress)?.data ??
      (signedSafeTx as any)?.signatures?.get?.(signerAddress.toLowerCase())?.data
    if (!senderSignature) {
      throw new Error(`Missing signer signature for Safe tx ${safeTxHash}`)
    }

    const safeTxData = (signedSafeTx as any)?.data ?? {}
    const safeTransactionData = {
      to: normalizeAddress(safeTxData.to) ?? proposal.to,
      value: toStringInt(safeTxData.value, '0'),
      data: typeof safeTxData.data === 'string' ? safeTxData.data : proposal.data,
      operation: toNumberInt(safeTxData.operation, Number(OperationType.Call)),
      safeTxGas: toStringInt(safeTxData.safeTxGas, '0'),
      baseGas: toStringInt(safeTxData.baseGas, '0'),
      gasPrice: toStringInt(safeTxData.gasPrice, '0'),
      gasToken: normalizeAddress(safeTxData.gasToken) ?? ZERO_ADDRESS,
      refundReceiver: normalizeAddress(safeTxData.refundReceiver) ?? ZERO_ADDRESS,
      nonce: toNumberInt(safeTxData.nonce, txNonce),
    }

    await txServiceRequest({
      url: `${txServiceApiBase}/v1/safes/${safeAddress}/multisig-transactions/`,
      method: 'POST',
      apiKey: safeApiKey,
      body: {
        ...safeTransactionData,
        contractTransactionHash: safeTxHash,
        sender: signerAddress,
        signature: senderSignature,
        origin: `deployment-batcher-solana-config:${batcher}:${proposal.label}`,
      },
    })

    const safeUrl = `https://app.safe.global/transactions/tx?id=base:${safeAddress}:${safeTxHash}&safe=base:${safeAddress}`
    submitted.push({
      label: proposal.label,
      nonce: txNonce,
      safeTxHash,
      safeUrl,
    })
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        proposed: true,
        signerAddress,
        submitted,
      },
      null,
      2,
    )}\n`,
  )
}

main().catch((error) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
