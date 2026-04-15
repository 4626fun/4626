import type { Address, Hex } from 'viem'
import { decodeFunctionData, encodeFunctionData, getAddress } from 'viem'

import { logger } from '@/lib/observability/logger'
import { appendBuilderSuffixToHex, DATA_SUFFIX, isBaseChain } from '@/lib/base/baseBuilderCodes'

const UNIVERSAL_ROUTER_EXECUTE_SELECTOR = '0x3593564c' as const
const UNIVERSAL_ROUTER_BASE_CURRENT = getAddress('0x6ff5693b99212da76ad316178a184ab56d299b43').toLowerCase()
const UNISWAP_UNIVERSAL_ROUTER_ABI = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

function isUniversalRouterTarget(to: Address): boolean {
  const target = String(to).toLowerCase()
  return target === UNIVERSAL_ROUTER_BASE_CURRENT
}

function stripKnownBuilderDataSuffix(data: Hex | undefined, dataSuffix: Hex | undefined): Hex | undefined {
  if (!data || data === '0x' || !dataSuffix) return data
  const payload = data.slice(2)
  const suffix = dataSuffix.slice(2)
  if (!suffix) return data
  if (payload.length <= suffix.length) return data
  if (!payload.toLowerCase().endsWith(suffix.toLowerCase())) return data
  return `0x${payload.slice(0, payload.length - suffix.length)}` as Hex
}

function canonicalizeUniversalRouterExecuteCalldata(data: Hex | undefined): Hex | undefined {
  if (!data || data === '0x') return data
  if (!data.toLowerCase().startsWith(UNIVERSAL_ROUTER_EXECUTE_SELECTOR)) return data

  try {
    const decoded = decodeFunctionData({
      abi: UNISWAP_UNIVERSAL_ROUTER_ABI,
      data,
    })
    if (decoded.functionName !== 'execute') return data
    return encodeFunctionData({
      abi: UNISWAP_UNIVERSAL_ROUTER_ABI,
      functionName: 'execute',
      args: decoded.args,
    })
  } catch {
    // If decode fails, preserve original payload rather than mutating semantics.
    return data
  }
}

export function applyBuilderDataSuffixToCalls(
  calls: Array<{ to: Address; value?: bigint; data?: Hex }>,
  chainId: number,
  dataSuffix: Hex | undefined = DATA_SUFFIX,
  debug = false,
  smartWallet?: Address,
): Array<{ to: Address; value?: bigint; data?: Hex }> {
  if (!dataSuffix || !isBaseChain(chainId)) return calls

  return calls.map((c) => {
    // Never append builder suffix to self-calls (CSW owner management).
    // The suffix corrupts the ABI-encoded calldata for functions like
    // addOwnerAddress, removeOwnerAtIndex, etc., causing the bundler's
    // eth_estimateUserOperationGas simulation to revert.
    if (smartWallet && c.to.toLowerCase() === smartWallet.toLowerCase()) {
      if (debug) {
        logger.debug('[Builder] Smart wallet self-call detected; skipping suffix', {
          target: c.to,
          dataPrefix: String(c.data ?? '').slice(0, 10),
        })
      }
      return c
    }

    if (isUniversalRouterTarget(c.to)) {
      const cleanedData = stripKnownBuilderDataSuffix(c.data, dataSuffix)
      const candidateData = canonicalizeUniversalRouterExecuteCalldata(cleanedData ?? c.data)
      const isCanonical =
        !!candidateData &&
        candidateData !== '0x' &&
        candidateData.toLowerCase().startsWith(UNIVERSAL_ROUTER_EXECUTE_SELECTOR)

      if (debug) {
        logger.debug('[Builder] Universal Router call detected', {
          target: c.to,
          originalDataPrefix: String(c.data ?? '').slice(0, 30),
          cleanedDataPrefix: cleanedData?.slice(0, 30) ?? 'none',
          willPreserveCanonical: isCanonical,
        })
      }

      if (isCanonical) {
        if (debug) logger.info('[Builder] Preserving canonical Universal Router calldata (no suffix)')
      } else if (debug) {
        logger.warn('[Builder] Universal Router calldata is non-canonical; preserving without suffix mutation', {
          target: c.to,
          cleanedDataPrefix: cleanedData?.slice(0, 30) ?? 'none',
        })
      }

      // Never append builder suffix to Universal Router calls.
      return {
        ...c,
        data: candidateData ?? cleanedData ?? c.data,
      }
    }

    return {
      ...c,
      data: appendBuilderSuffixToHex(c.data, { chainId, dataSuffix }),
    }
  })
}
