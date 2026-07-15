/**
 * Fat deploy stages (esp. phase2 core CREATE2 fan-out) use ~10–16M execution gas.
 * Viem's default estimate path seeds callGasLimit=0, which reverts on these ops
 * before a real estimate can complete.
 *
 * Coinbase Smart Wallet uses EntryPoint 0.6. Do not attach EP0.7-only
 * paymasterVerificationGasLimit / paymasterPostOpGasLimit — CDP rejects them on
 * pm_getPaymasterData. Do not pass gas into sendUserOperation args either:
 * pm_getPaymasterStubData runs before gas fill and expects zeroish gas.
 *
 * CDP bundler precheck rejects UserOps whose total gas (call + verification +
 * preVerification + paymaster overhead) exceeds 14_500_000. Phase2 core needs
 * ~16.4M call gas alone, so those ops must be self-bundled via EntryPoint.handleOps.
 */
import {
  createWalletClient,
  http,
  type Hex,
  type Transport,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { entryPoint06Address, getUserOperationHash } from 'viem/account-abstraction'

import { resolveDeploySessionRpcUrl } from './deploySessionRpc.js'

export const DEPLOY_SESSION_USEROP_GAS = {
  // ~16.4M observed on phase2 executeBatch; leave a small buffer.
  callGasLimit: 16_750_000n,
  verificationGasLimit: 800_000n,
  preVerificationGas: 200_000n,
} as const

/** CDP eth_sendUserOperation precheck ceiling (observed 2026-07-15). */
export const CDP_MAX_TOTAL_USEROP_GAS = 14_500_000n

/**
 * Explicit call+verification+preVerification sum above this triggers
 * self-bundle, leaving headroom for CDP paymaster overhead (~1.4–1.5M).
 */
export const CDP_SELF_BUNDLE_EXPLICIT_GAS_SUM = 12_000_000n

type AccountWithUserOpGas = {
  userOperation?: {
    estimateGas?: (userOperation: unknown) => Promise<Record<string, bigint>> | Record<string, bigint>
    [key: string]: unknown
  }
  [key: string]: unknown
}

export function withDeploySessionUserOpGas<T extends AccountWithUserOpGas>(account: T): T {
  const previous = account.userOperation
  return {
    ...account,
    userOperation: {
      ...previous,
      estimateGas: async (userOperation: unknown) => {
        if (typeof previous?.estimateGas === 'function') {
          const estimated = await previous.estimateGas(userOperation)
          return { ...estimated, ...DEPLOY_SESSION_USEROP_GAS }
        }
        return { ...DEPLOY_SESSION_USEROP_GAS }
      },
    },
  }
}

const ENTRY_POINT_V06_HANDLE_OPS_ABI = [
  {
    type: 'function',
    name: 'handleOps',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'ops',
        type: 'tuple[]',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'callGasLimit', type: 'uint256' },
          { name: 'verificationGasLimit', type: 'uint256' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'maxFeePerGas', type: 'uint256' },
          { name: 'maxPriorityFeePerGas', type: 'uint256' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      },
      { name: 'beneficiary', type: 'address' },
    ],
    outputs: [],
  },
] as const

function readSelfBundlePrivateKey(): Hex | null {
  // Prefer an explicitly funded deploy bundler key, then the ops Safe owner key
  // (PRIVATE_KEY), before KPR automation which is often gas-poor on Base.
  for (const key of [
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

function hexToBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value))
  if (typeof value === 'string' && value.trim()) return BigInt(value.trim())
  return 0n
}

function userOpExplicitGasSum(userOp: Record<string, unknown>): bigint {
  return (
    hexToBigInt(userOp.callGasLimit) +
    hexToBigInt(userOp.verificationGasLimit) +
    hexToBigInt(userOp.preVerificationGas)
  )
}

function shouldSelfBundleUserOp(userOp: Record<string, unknown>): boolean {
  // CDP adds paymaster overhead (~1.4–1.5M observed) on top of explicit fields.
  return userOpExplicitGasSum(userOp) > CDP_SELF_BUNDLE_EXPLICIT_GAS_SUM
}

async function selfBundleUserOp(userOp: Record<string, unknown>): Promise<Hex> {
  const pk = readSelfBundlePrivateKey()
  if (!pk) {
    throw new Error(
      'deploy_session_self_bundle_key_missing: set DEPLOY_SESSION_SELF_BUNDLE_PRIVATE_KEY (or KPR_PRIVATE_KEY / PRIVATE_KEY) for UserOps above the CDP 14.5M gas cap',
    )
  }

  const account = privateKeyToAccount(pk)
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(resolveDeploySessionRpcUrl(), { timeout: 120_000 }),
  })

  const opTuple = {
    sender: userOp.sender as `0x${string}`,
    nonce: hexToBigInt(userOp.nonce),
    initCode: (userOp.initCode as Hex) || '0x',
    callData: userOp.callData as Hex,
    callGasLimit: hexToBigInt(userOp.callGasLimit),
    verificationGasLimit: hexToBigInt(userOp.verificationGasLimit),
    preVerificationGas: hexToBigInt(userOp.preVerificationGas),
    maxFeePerGas: hexToBigInt(userOp.maxFeePerGas),
    maxPriorityFeePerGas: hexToBigInt(userOp.maxPriorityFeePerGas),
    paymasterAndData: (userOp.paymasterAndData as Hex) || '0x',
    signature: userOp.signature as Hex,
  }

  const txHash = await walletClient.writeContract({
    address: entryPoint06Address,
    abi: ENTRY_POINT_V06_HANDLE_OPS_ABI,
    functionName: 'handleOps',
    args: [[opTuple], account.address],
  })

  // Deploy-session tracking expects a UserOp hash. Prefer computing it when possible;
  // fall back to the outer tx hash so resume can still confirm inclusion.
  try {
    return getUserOperationHash({
      chainId: base.id,
      entryPointAddress: entryPoint06Address,
      entryPointVersion: '0.6',
      userOperation: {
        sender: opTuple.sender,
        nonce: opTuple.nonce,
        initCode: opTuple.initCode,
        callData: opTuple.callData,
        callGasLimit: opTuple.callGasLimit,
        verificationGasLimit: opTuple.verificationGasLimit,
        preVerificationGas: opTuple.preVerificationGas,
        maxFeePerGas: opTuple.maxFeePerGas,
        maxPriorityFeePerGas: opTuple.maxPriorityFeePerGas,
        paymasterAndData: opTuple.paymasterAndData,
        signature: opTuple.signature,
      },
    })
  } catch {
    return txHash
  }
}

/**
 * Wrap a CDP bundler/paymaster HTTP transport so fat UserOps are self-bundled
 * via EntryPoint.handleOps instead of failing CDP's 14.5M total-gas precheck.
 */
export function createDeploySessionBundlerTransport(
  url: string,
  httpOpts?: Parameters<typeof http>[1],
): Transport {
  const upstream = http(url, httpOpts)
  return ((opts) => {
    const upstreamTransport = upstream(opts)
    return {
      ...upstreamTransport,
      async request(args, options) {
        if (args.method !== 'eth_sendUserOperation') {
          return upstreamTransport.request(args, options)
        }
        const params = Array.isArray(args.params) ? args.params : []
        const userOp = (params[0] ?? {}) as Record<string, unknown>
        if (!shouldSelfBundleUserOp(userOp)) {
          return upstreamTransport.request(args, options)
        }
        return await selfBundleUserOp(userOp)
      },
    }
  }) as Transport
}
