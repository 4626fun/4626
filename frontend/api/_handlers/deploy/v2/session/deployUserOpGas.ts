/**
 * Fat deploy stages (esp. phase2 core CREATE2 fan-out) use multi-million execution gas.
 * Viem's default estimate path seeds callGasLimit=0, which reverts on these ops
 * before a real estimate can complete.
 *
 * Coinbase Smart Wallet uses EntryPoint 0.6. Do not attach EP0.7-only
 * paymasterVerificationGasLimit / paymasterPostOpGasLimit — CDP rejects them on
 * pm_getPaymasterData. Do not pass gas into sendUserOperation args either:
 * pm_getPaymasterStubData runs before gas fill and expects zeroish gas.
 *
 * CDP bundler precheck rejects UserOps whose total gas (call + verification +
 * preVerification + paymaster overhead) exceeds 14_500_000. Phase2 core is above
 * that ceiling, so those ops must be self-bundled via EntryPoint.handleOps.
 *
 * Base RPC rejects eth_sendRawTransaction when tx.gas > 2^24 (16_777_216) even
 * though block gasLimit is far higher — observed 2026-07-15 on mainnet.base.org
 * and Matrixed. Outer handleOps gas and UserOp call+verification must fit under
 * that per-tx cap.
 *
 * CDP paymaster validation is not reliable when the same UserOp is submitted via
 * our own handleOps (short-lived sponsorship windows / bundler-bound context).
 * Fat self-bundled ops therefore omit the paymaster and pull gas from the
 * sender's EntryPoint deposit (topped up by the self-bundle key when needed).
 */
import {
  BaseError,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  http,
  toHex,
  type Hex,
  type Log,
  type Transport,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { entryPoint06Address, getUserOperationHash } from 'viem/account-abstraction'

import { resolveDeploySessionRpcUrl } from './deploySessionRpc.js'

/** Base mempool/RPC per-transaction gas ceiling (2^24). */
export const BASE_MAX_TX_GAS = 16_777_216n

/**
 * EntryPoint 0.6 AA95: before running an op it requires
 * `gasleft() * 63 / 64 >= callGasLimit + verificationGasLimit`.
 * Always submit handleOps with the full Base tx gas cap, and keep
 * call+verification under that 63/64 budget (with a small safety margin).
 */
const SELF_BUNDLE_AA95_SAFETY = 50_000n

/** In-process map so advance can resolve self-bundled receipts without a bundler index. */
const selfBundledTxByUserOpHash = new Map<string, Hex>()

export const DEPLOY_SESSION_USEROP_GAS = {
  // Maximize call gas under AA95 budget: BASE_MAX*63/64 - SAFETY ≈ 16_465_072.
  // Keep verification high enough for CSW owner-index validateUserOp.
  callGasLimit: 15_850_000n,
  verificationGasLimit: 600_000n,
  preVerificationGas: 100_000n,
} as const

/** CDP eth_sendUserOperation precheck ceiling (observed 2026-07-15). */
export const CDP_MAX_TOTAL_USEROP_GAS = 14_500_000n

/**
 * Explicit call+verification+preVerification sum above this triggers
 * self-bundle, leaving headroom for CDP paymaster overhead (~1.4–1.5M).
 */
export const CDP_SELF_BUNDLE_EXPLICIT_GAS_SUM = 12_000_000n

/**
 * withDeploySessionUserOpGas forces limits above CDP_SELF_BUNDLE_EXPLICIT_GAS_SUM,
 * so those UserOps always self-bundle. Call sites must omit CDP paymaster sponsorship.
 */
export const DEPLOY_SESSION_OMIT_PAYMASTER = true

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

const ENTRY_POINT_V06_ABI = [
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
  {
    type: 'function',
    name: 'depositTo',
    stateMutability: 'payable',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'UserOperationEvent',
    inputs: [
      { name: 'userOpHash', type: 'bytes32', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
      { name: 'paymaster', type: 'address', indexed: true },
      { name: 'nonce', type: 'uint256', indexed: false },
      { name: 'success', type: 'bool', indexed: false },
      { name: 'actualGasCost', type: 'uint256', indexed: false },
      { name: 'actualGasUsed', type: 'uint256', indexed: false },
    ],
  },
] as const

export function peekSelfBundledTxHash(userOpHash: Hex | string): Hex | undefined {
  return selfBundledTxByUserOpHash.get(userOpHash.toLowerCase())
}

export function readUserOperationEventSuccess(
  logs: readonly Log[],
  userOpHash: Hex,
): { success: boolean; actualGasUsed: bigint } | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: ENTRY_POINT_V06_ABI,
        data: log.data,
        topics: log.topics,
      })
      if (decoded.eventName !== 'UserOperationEvent') continue
      const args = decoded.args as {
        userOpHash?: Hex
        success?: boolean
        actualGasUsed?: bigint
      }
      if (!args.userOpHash || args.userOpHash.toLowerCase() !== userOpHash.toLowerCase()) continue
      if (typeof args.success !== 'boolean') continue
      return {
        success: args.success,
        actualGasUsed: typeof args.actualGasUsed === 'bigint' ? args.actualGasUsed : 0n,
      }
    } catch {
      // not an EntryPoint UserOperationEvent
    }
  }
  return null
}

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
  if (typeof value === 'string' && value.trim()) {
    const s = value.trim()
    // viem request dumps sometimes format fees as "0.014 gwei"
    const gwei = /^([0-9]+(?:\.[0-9]+)?)\s*gwei$/i.exec(s)
    if (gwei) {
      const [whole, frac = ''] = gwei[1].split('.')
      const fracPadded = (frac + '000000000').slice(0, 9)
      return BigInt(whole) * 1_000_000_000n + BigInt(fracPadded)
    }
    return BigInt(s)
  }
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

function requiredPrefundWei(userOp: Record<string, unknown>): bigint {
  const gas = userOpExplicitGasSum(userOp)
  const maxFeePerGas = hexToBigInt(userOp.maxFeePerGas)
  // EP0.6: requiredPrefund = (call+verification+preVerification) * maxFeePerGas
  // Add 10% buffer for tip / rounding during validation.
  return (gas * maxFeePerGas * 110n) / 100n
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 500)
  try {
    return String(err).slice(0, 500)
  } catch {
    return 'unknown_error'
  }
}

function throwSelfBundleError(message: string): never {
  // sendUserOperation wraps transport errors with getBundlerError, which calls
  // err.walk(). Plain Error throws "err.walk is not a function"; BaseError is required.
  throw new BaseError(message)
}

async function selfBundleUserOp(userOp: Record<string, unknown>): Promise<Hex> {
  const pk = readSelfBundlePrivateKey()
  if (!pk) {
    throwSelfBundleError(
      'deploy_session_self_bundle_key_missing: set DEPLOY_SESSION_SELF_BUNDLE_PRIVATE_KEY (or KPR_PRIVATE_KEY / PRIVATE_KEY) for UserOps above the CDP 14.5M gas cap',
    )
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

  const paymasterAndData = ((userOp.paymasterAndData as Hex) || '0x') as Hex
  if (paymasterAndData !== '0x' && paymasterAndData.length > 2) {
    // Keep a clear signal if a call site still attaches CDP sponsorship to a fat op.
    // Validation against Coinbase's paymaster is unreliable outside their bundler.
    throwSelfBundleError(
      'deploy_session_self_bundle_paymaster_not_supported: omit paymaster for UserOps above the CDP gas cap so EntryPoint deposit can sponsor gas',
    )
  }

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
    paymasterAndData: '0x' as Hex,
    signature: userOp.signature as Hex,
  }

  // Prefer encode+sendTransaction over writeContract: writeContract's getContractError
  // path assumes viem BaseError.walk() and can throw "err.walk is not a function"
  // on some RPC revert shapes for FailedOp.
  try {
    const requiredWei = requiredPrefundWei(opTuple)
    if (requiredWei > 0n) {
      const balance = (await publicClient.readContract({
        address: entryPoint06Address,
        abi: ENTRY_POINT_V06_ABI,
        functionName: 'balanceOf',
        args: [opTuple.sender],
      })) as bigint

      if (balance < requiredWei) {
        const shortfall = requiredWei - balance
        const funderBalance = await publicClient.getBalance({ address: account.address })
        // Leave a small native reserve for the outer handleOps tx itself.
        const outerTxReserve = 250_000n * 50_000_000n // ~0.0000125 ETH at 0.05 gwei
        if (funderBalance <= shortfall + outerTxReserve) {
          throwSelfBundleError(
            `deploy_session_self_bundle_deposit_underfunded: need ${shortfall} wei EntryPoint deposit for ${opTuple.sender}; ` +
              `funder ${account.address} has ${funderBalance} wei`,
          )
        }
        const depositData = encodeFunctionData({
          abi: ENTRY_POINT_V06_ABI,
          functionName: 'depositTo',
          args: [opTuple.sender],
        })
        const depositTx = await walletClient.sendTransaction({
          to: entryPoint06Address,
          data: depositData,
          value: shortfall,
          // Explicit gas/fees skip eth_estimateGas; some RPC revert shapes are not
          // viem BaseErrors and trip getNodeError's err.walk assumption.
          gas: 120_000n,
          maxFeePerGas: opTuple.maxFeePerGas > 0n ? opTuple.maxFeePerGas * 2n : 50_000_000n,
          maxPriorityFeePerGas:
            opTuple.maxPriorityFeePerGas > 0n ? opTuple.maxPriorityFeePerGas : 1_000_000n,
        })
        await publicClient.waitForTransactionReceipt({ hash: depositTx, timeout: 120_000 })
      }
    }

    const handleOpsData = encodeFunctionData({
      abi: ENTRY_POINT_V06_ABI,
      functionName: 'handleOps',
      args: [[opTuple], account.address],
    })
    // Use the full Base per-tx gas cap. EP0.6 AA95 requires
    // gasleft()*63/64 >= call+verification before the op runs.
    const handleOpsGas = BASE_MAX_TX_GAS
    const opExecutionGas = opTuple.callGasLimit + opTuple.verificationGasLimit
    const aa95Budget = (handleOpsGas * 63n) / 64n - SELF_BUNDLE_AA95_SAFETY
    if (opExecutionGas > aa95Budget) {
      throwSelfBundleError(
        `deploy_session_self_bundle_gas_exceeds_aa95_budget: call+verification=${opExecutionGas} exceeds EntryPoint AA95 budget ${aa95Budget} under Base tx gas cap ${BASE_MAX_TX_GAS}`,
      )
    }
    const txHash = await walletClient.sendTransaction({
      to: entryPoint06Address,
      data: handleOpsData,
      gas: handleOpsGas,
      maxFeePerGas: opTuple.maxFeePerGas > 0n ? opTuple.maxFeePerGas * 2n : 50_000_000n,
      maxPriorityFeePerGas:
        opTuple.maxPriorityFeePerGas > 0n ? opTuple.maxPriorityFeePerGas : 1_000_000n,
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 })
    if (receipt.status !== 'success') {
      throwSelfBundleError(
        `deploy_session_self_bundle_handleOps_reverted: tx=${txHash} gasUsed=${receipt.gasUsed}`,
      )
    }

    let userOpHash: Hex
    try {
      userOpHash = getUserOperationHash({
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
      // Fallback keeps prior behavior when hashing fails, but still refuse silent failure.
      userOpHash = txHash
    }

    const opEvent = readUserOperationEventSuccess(receipt.logs, userOpHash)
    if (!opEvent) {
      throwSelfBundleError(
        `deploy_session_self_bundle_missing_userop_event: tx=${txHash} userOpHash=${userOpHash}`,
      )
    }
    if (!opEvent.success) {
      throwSelfBundleError(
        `deploy_session_self_bundle_userop_failed: tx=${txHash} userOpHash=${userOpHash} actualGasUsed=${opEvent.actualGasUsed}`,
      )
    }

    selfBundledTxByUserOpHash.set(userOpHash.toLowerCase(), txHash)
    return userOpHash
  } catch (err) {
    if (err instanceof BaseError && String(err.message || '').includes('deploy_session_self_bundle_')) {
      throw err
    }
    throwSelfBundleError(`deploy_session_self_bundle_failed: ${safeErrorMessage(err)}`)
  }
}

/**
 * Wrap a CDP bundler/paymaster HTTP transport so fat UserOps are self-bundled
 * via EntryPoint.handleOps instead of failing CDP's 14.5M total-gas precheck.
 *
 * Also short-circuit eth_estimateUserOperationGas: CDP rejects / mis-handles
 * these oversized ops and viem's error path can throw "err.walk is not a function".
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
        if (args.method === 'eth_estimateUserOperationGas') {
          return {
            callGasLimit: toHex(DEPLOY_SESSION_USEROP_GAS.callGasLimit),
            verificationGasLimit: toHex(DEPLOY_SESSION_USEROP_GAS.verificationGasLimit),
            preVerificationGas: toHex(DEPLOY_SESSION_USEROP_GAS.preVerificationGas),
          }
        }
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
