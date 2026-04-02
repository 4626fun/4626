#!/usr/bin/env node

import Safe from '@safe-global/protocol-kit'
import SafeApiKit from '@safe-global/api-kit'
import { OperationType } from '@safe-global/types-kit'
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const DEFAULT_SAFE_SERVICE_URL = 'https://api.safe.global/tx-service/base'
const DEFAULT_CHAIN_ID = 8453n
const DEFAULT_RPC_URL = 'https://mainnet.base.org'
const DEFAULT_EXTERNAL_TARGETS = [
  getAddress('0x6ff5693b99212da76ad316178a184ab56d299b43'),
] as const
const DEFAULT_EXTERNAL_SPENDERS = [
  getAddress('0x000000000022D473030F116dDEE9F6B43aC78BA3'),
  getAddress('0x6ff5693b99212da76ad316178a184ab56d299b43'),
] as const

const OWNABLE_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const PAYOUT_ROUTER_APPROVAL_ABI = [
  {
    type: 'function',
    name: 'approvedExternalSwapTargets',
    stateMutability: 'view',
    inputs: [{ name: 'target', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'approvedExternalSwapSpenders',
    stateMutability: 'view',
    inputs: [{ name: 'spender', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setExternalSwapTargetApproval',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setExternalSwapSpenderApproval',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
] as const

type RouterPlan = {
  router: Address
  owner: Address | null
  ownerMatchesTreasury: boolean
  externalLaneSupported: boolean
  missingTargets: Address[]
  missingSpenders: Address[]
  skipReason?: string
}

type TxSpec = {
  to: Address
  value: string
  data: `0x${string}`
  operation: OperationType
}

function usage(): void {
  process.stdout.write(`Usage:
  pnpm -C frontend exec tsx scripts/ops/payout-router-external-approvals-safe.ts [options]

Required:
  --routers <addr[,addr...]>  Comma/space separated payout router addresses
                              (fallback env: PAYOUT_ROUTER_ADDRESSES)

Options:
  --targets <addr[,addr...]>  External swap targets to approve
                              (default Base UR current)
  --spenders <addr[,addr...]> External swap spenders to approve
                              (default Permit2 + Base UR current)
  --protocol-treasury <addr>  Expected owner for each router
                              (default SAFE_ADDRESS || PROTOCOL_TREASURY)
  --allow-owner-mismatch      Include routers even when owner != protocol treasury
  --rpc <url>                 RPC URL (default: BASE_RPC_URL or mainnet)
  --chain-id <id>             Safe chain id (default 8453)
  --propose                   Propose one batched Safe transaction
  --safe-address <address>    Safe address used for proposal mode
  --safe-owner-pk <hex>       Safe owner private key signer
  --safe-service-url <url>    Safe service URL (default Base)
  --safe-api-key <key>        Safe API key (optional)
  --help                      Show this help

Examples:
  pnpm -C frontend exec tsx scripts/ops/payout-router-external-approvals-safe.ts \\
    --routers 0xRouter1,0xRouter2

  pnpm -C frontend exec tsx scripts/ops/payout-router-external-approvals-safe.ts \\
    --routers 0xRouter1 --propose --safe-address 0xSafe --safe-owner-pk 0x...
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

function normalizeAddressList(raw: string, fallback: readonly Address[] = []): Address[] {
  const source = raw.trim()
  const out: Address[] = []
  const seen = new Set<string>()
  const push = (candidate: string | Address) => {
    const normalized = normalizeAddress(candidate)
    if (!normalized) return
    const key = normalized.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(normalized)
  }
  if (!source) {
    for (const candidate of fallback) push(candidate)
    return out
  }
  for (const part of source.split(/[\s,]+/g)) push(part)
  return out
}

function normalizePrivateKey(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
}

function parseChainId(raw: string): bigint {
  const value = Number(raw.trim())
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid chain id: ${raw}`)
  return BigInt(Math.trunc(value))
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function isTransientRpcError(message: string): boolean {
  const lc = message.toLowerCase()
  return (
    lc.includes('timeout') ||
    lc.includes('timed out') ||
    lc.includes('rate limit') ||
    lc.includes('too many requests') ||
    lc.includes('429') ||
    lc.includes('temporarily unavailable') ||
    lc.includes('service unavailable') ||
    lc.includes('network error') ||
    lc.includes('failed to fetch') ||
    lc.includes('gateway timeout') ||
    lc.includes('econnreset') ||
    lc.includes('etimedout') ||
    lc.includes('eai_again')
  )
}

function isLegacyExternalLaneProbeError(message: string): boolean {
  const lc = message.toLowerCase()
  return (
    (lc.includes('approvedexternalswaptargets') && lc.includes('revert')) ||
    (lc.includes('approvedexternalswaptargets') && lc.includes('returned no data')) ||
    lc.includes('function selector was not recognized') ||
    lc.includes('function does not exist')
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readContractWithRetry<T>(context: string, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const message = toErrorMessage(error)
      if (attempt === 0 && isTransientRpcError(message)) {
        await sleep(350)
        continue
      }
      throw new Error(`${context}: ${message}`)
    }
  }
  throw new Error(`${context}: ${toErrorMessage(lastError)}`)
}

async function buildPlan(params: {
  rpcUrl: string
  routers: Address[]
  expectedTreasury: Address | null
  allowOwnerMismatch: boolean
  targets: Address[]
  spenders: Address[]
}): Promise<{ plans: RouterPlan[]; txs: TxSpec[] }> {
  const client = createPublicClient({
    chain: base,
    transport: http(params.rpcUrl, { timeout: 30_000 }),
  })

  const plans: RouterPlan[] = []
  const txs: TxSpec[] = []

  for (const router of params.routers) {
    let owner: Address | null = null
    try {
      const rawOwner = await client.readContract({
        address: router,
        abi: OWNABLE_ABI,
        functionName: 'owner',
      })
      owner = normalizeAddress(rawOwner)
    } catch {
      owner = null
    }

    const ownerMatchesTreasury =
      !!owner && !!params.expectedTreasury && owner.toLowerCase() === params.expectedTreasury.toLowerCase()
    if (!params.allowOwnerMismatch && params.expectedTreasury && !ownerMatchesTreasury) {
      plans.push({
        router,
        owner,
        ownerMatchesTreasury: false,
        externalLaneSupported: false,
        missingTargets: [],
        missingSpenders: [],
        skipReason: 'owner_mismatch',
      })
      continue
    }

    let externalLaneSupported = true
    if (params.targets.length > 0) {
      try {
        await readContractWithRetry(
          `Failed probing router ${router} for external swap support`,
          () =>
            client.readContract({
              address: router,
              abi: PAYOUT_ROUTER_APPROVAL_ABI,
              functionName: 'approvedExternalSwapTargets',
              args: [params.targets[0]!],
            }),
        )
      } catch (error) {
        const message = toErrorMessage(error)
        if (isLegacyExternalLaneProbeError(message)) {
          externalLaneSupported = false
        } else {
          throw error
        }
      }
    }
    if (!externalLaneSupported) {
      throw new Error(
        `Router ${router} does not support external swap approvals (legacy router). ` +
          'Redeploy the payout router and repoint payout recipient before running this script.',
      )
    }

    const missingTargets: Address[] = []
    for (const target of params.targets) {
      const approved = await readContractWithRetry(
        `Failed reading target approval for router ${router} target ${target}`,
        () =>
          client.readContract({
            address: router,
            abi: PAYOUT_ROUTER_APPROVAL_ABI,
            functionName: 'approvedExternalSwapTargets',
            args: [target],
          }),
      )
      if (approved !== true) {
        missingTargets.push(target)
        txs.push({
          to: router,
          value: '0',
          operation: OperationType.Call,
          data: encodeFunctionData({
            abi: PAYOUT_ROUTER_APPROVAL_ABI,
            functionName: 'setExternalSwapTargetApproval',
            args: [target, true],
          }),
        })
      }
    }

    const missingSpenders: Address[] = []
    for (const spender of params.spenders) {
      const approved = await readContractWithRetry(
        `Failed reading spender approval for router ${router} spender ${spender}`,
        () =>
          client.readContract({
            address: router,
            abi: PAYOUT_ROUTER_APPROVAL_ABI,
            functionName: 'approvedExternalSwapSpenders',
            args: [spender],
          }),
      )
      if (approved !== true) {
        missingSpenders.push(spender)
        txs.push({
          to: router,
          value: '0',
          operation: OperationType.Call,
          data: encodeFunctionData({
            abi: PAYOUT_ROUTER_APPROVAL_ABI,
            functionName: 'setExternalSwapSpenderApproval',
            args: [spender, true],
          }),
        })
      }
    }

    plans.push({
      router,
      owner,
      ownerMatchesTreasury: params.expectedTreasury ? ownerMatchesTreasury : true,
      externalLaneSupported: true,
      missingTargets,
      missingSpenders,
    })
  }

  return { plans, txs }
}

async function proposeSafeBatch(params: {
  chainId: bigint
  safeAddress: Address
  safeOwnerPrivateKey: string
  safeServiceUrl: string
  safeApiKey: string
  rpcUrl: string
  txs: TxSpec[]
}): Promise<{ safeTxHash: string; nonce: number; safeUrl: string }> {
  const protocolKit = await Safe.init({
    provider: params.rpcUrl,
    signer: params.safeOwnerPrivateKey,
    safeAddress: params.safeAddress,
  })
  const signerAddressRaw = await protocolKit.getSafeProvider().getSignerAddress()
  const signerAddress = normalizeAddress(signerAddressRaw)
  if (!signerAddress) throw new Error('Unable to resolve Safe signer address')

  const apiKit = new SafeApiKit({
    chainId: params.chainId,
    txServiceUrl: params.safeServiceUrl,
    apiKey: params.safeApiKey || undefined,
  })
  const nonce = Number(await apiKit.getNextNonce(params.safeAddress))
  if (!Number.isFinite(nonce) || nonce < 0) throw new Error('Invalid Safe nonce')

  const safeTx = await protocolKit.createTransaction({
    transactions: params.txs,
    options: { nonce },
  })
  const signedSafeTx = await protocolKit.signTransaction(safeTx)
  const safeTxHash = await protocolKit.getTransactionHash(signedSafeTx)
  const senderSignature =
    (signedSafeTx as any)?.getSignature?.(signerAddress)?.data ??
    (signedSafeTx as any)?.signatures?.get?.(signerAddress.toLowerCase())?.data
  if (!senderSignature) throw new Error(`Missing signer signature for Safe tx ${safeTxHash}`)

  await apiKit.proposeTransaction({
    safeAddress: params.safeAddress,
    safeTransactionData: signedSafeTx.data,
    safeTxHash,
    senderAddress: signerAddress,
    senderSignature,
    origin: 'payout-router-external-approvals',
  })

  const safeUrl = `https://app.safe.global/transactions/tx?id=base:${params.safeAddress}:${safeTxHash}&safe=base:${params.safeAddress}`
  return { safeTxHash, nonce, safeUrl }
}

async function main() {
  if (hasFlag('--help')) {
    usage()
    return
  }

  const propose = hasFlag('--propose')
  const allowOwnerMismatch = hasFlag('--allow-owner-mismatch')

  const routersRaw = getArg('--routers', process.env.PAYOUT_ROUTER_ADDRESSES || '')
  const routers = normalizeAddressList(routersRaw)
  if (routers.length === 0) {
    if (!routersRaw.trim()) {
      throw new Error('Missing --routers (or PAYOUT_ROUTER_ADDRESSES env)')
    }
    throw new Error(
      `No valid router addresses parsed from --routers/PAYOUT_ROUTER_ADDRESSES: "${routersRaw}". ` +
        'Expected one or more 0x-prefixed 40-hex EVM addresses.',
    )
  }

  const targets = normalizeAddressList(
    getArg('--targets', process.env.PAYOUT_ROUTER_EXTERNAL_SWAP_TARGETS || ''),
    DEFAULT_EXTERNAL_TARGETS,
  )
  const spenders = normalizeAddressList(
    getArg('--spenders', process.env.PAYOUT_ROUTER_EXTERNAL_SWAP_SPENDERS || ''),
    DEFAULT_EXTERNAL_SPENDERS,
  )
  if (targets.length === 0 || spenders.length === 0) {
    throw new Error('Targets/spenders resolved to empty list')
  }

  const expectedTreasury = normalizeAddress(
    getArg('--protocol-treasury', process.env.SAFE_ADDRESS || process.env.PROTOCOL_TREASURY || ''),
  )
  const rpcUrl = getArg('--rpc', process.env.BASE_RPC_URL || DEFAULT_RPC_URL)
  const chainId = parseChainId(getArg('--chain-id', process.env.CHAIN_ID || String(DEFAULT_CHAIN_ID)))

  const { plans, txs } = await buildPlan({
    rpcUrl,
    routers,
    expectedTreasury,
    allowOwnerMismatch,
    targets,
    spenders,
  })

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: propose ? 'propose' : 'dry-run',
        chainId: chainId.toString(),
        expectedTreasury,
        routers: routers.length,
        targets,
        spenders,
        txCount: txs.length,
        plans,
      },
      null,
      2,
    )}\n`,
  )

  if (!propose) {
    process.stdout.write('Dry-run complete. Re-run with --propose to submit one batched Safe proposal.\n')
    return
  }

  if (txs.length === 0) {
    process.stdout.write('No missing approvals found. Nothing to propose.\n')
    return
  }

  const safeAddress = normalizeAddress(
    getArg('--safe-address', process.env.SAFE_ADDRESS || process.env.PROTOCOL_TREASURY || ''),
  )
  if (!safeAddress) throw new Error('Missing --safe-address (or SAFE_ADDRESS / PROTOCOL_TREASURY env)')
  const safeOwnerPrivateKey = normalizePrivateKey(
    getArg('--safe-owner-pk', process.env.SAFE_OWNER_PRIVATE_KEY || process.env.SAFE_OWNER_PK || ''),
  )
  if (!safeOwnerPrivateKey) throw new Error('Missing --safe-owner-pk (or SAFE_OWNER_PRIVATE_KEY / SAFE_OWNER_PK env)')
  const safeServiceUrl = getArg('--safe-service-url', process.env.SAFE_TX_SERVICE_URL || DEFAULT_SAFE_SERVICE_URL)
  const safeApiKey = getArg('--safe-api-key', process.env.SAFE_API_KEY || '')

  const proposed = await proposeSafeBatch({
    chainId,
    safeAddress,
    safeOwnerPrivateKey,
    safeServiceUrl,
    safeApiKey,
    rpcUrl,
    txs,
  })

  process.stdout.write(`${JSON.stringify({ proposed: true, txCount: txs.length, ...proposed }, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})

