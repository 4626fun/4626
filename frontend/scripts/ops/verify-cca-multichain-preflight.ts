#!/usr/bin/env tsx
/**
 * Read-only preflight for the multi-chain ■AKITA CCA launch.
 *
 *   pnpm -C frontend ops:verify-cca-multichain
 *   pnpm -C frontend ops:verify-cca-multichain --chain ethereum
 *
 * Checks (no onchain mutation):
 *  1. RPC connectivity / chainId match
 *  2. CCA factory v2.1.0 code present (Robinhood empty = expected pre-bootstrap)
 *  3. If factory exists: protocolFeeController + getProtocolFeeAmount(ETH, 1e18) == 0
 *     (CCALaunchArm.migrate() requires swept == currencyRaised)
 *  4. Uniswap v4 PoolManager code present
 *  5. LayerZero EndpointV2 code present
 *
 * Exit 0 = all checked chains PASS (or WARN-only on expected-empty Robinhood factory).
 * Exit 1 = any FAIL.
 */
import { createPublicClient, http, type Address, type Hex } from 'viem'

import {
  CCA_FACTORY_V210,
  CCA_LAUNCH_CHAINS,
  CCA_LAUNCH_CHAIN_KEYS,
  type CcaLaunchChain,
  type CcaLaunchChainKey,
} from '../../src/config/ccaLaunchChains.ts'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
}

const FACTORY_ABI = [
  {
    type: 'function',
    name: 'protocolFeeController',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const FEE_CONTROLLER_ABI = [
  {
    type: 'function',
    name: 'getProtocolFeeAmount',
    stateMutability: 'view',
    inputs: [
      { name: 'currency', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const

const ONE_ETH = 10n ** 18n
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

type RowStatus = 'PASS' | 'FAIL' | 'WARN'

type CheckRow = {
  chain: string
  status: RowStatus
  detail: string
}

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function rpcUrlFor(chain: CcaLaunchChain): string {
  return process.env[chain.rpcEnvKey]?.trim() || chain.defaultRpcUrl
}

function hasCode(code: Hex | undefined): boolean {
  return !!code && code !== '0x' && code.length > 2
}

async function checkChain(key: CcaLaunchChainKey): Promise<CheckRow[]> {
  const chain = CCA_LAUNCH_CHAINS[key]
  const rows: CheckRow[] = []
  const rpc = rpcUrlFor(chain)
  const client = createPublicClient({
    chain: {
      id: chain.chainId,
      name: chain.label,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [rpc] } },
    },
    transport: http(rpc, { timeout: 20_000 }),
  })

  try {
    const onchainId = await client.getChainId()
    if (onchainId !== chain.chainId) {
      rows.push({
        chain: chain.label,
        status: 'FAIL',
        detail: `RPC chainId ${onchainId} != expected ${chain.chainId} (${rpc})`,
      })
      return rows
    }
  } catch (err) {
    rows.push({
      chain: chain.label,
      status: 'FAIL',
      detail: `RPC unreachable: ${err instanceof Error ? err.message : String(err)}`,
    })
    return rows
  }

  const factory = (chain.targetCcaFactoryVersion === 'v2.1.0'
    ? chain.ccaFactoryV210
    : chain.ccaFactoryV110) as Address

  const [factoryCode, poolManagerCode, lzCode] = await Promise.all([
    client.getCode({ address: factory }),
    client.getCode({ address: chain.poolManagerV4 }),
    client.getCode({ address: chain.lzEndpointV2 }),
  ])

  if (!hasCode(factoryCode)) {
    if (chain.ccaFactoryV210ExpectedEmptyPreBootstrap) {
      rows.push({
        chain: chain.label,
        status: 'WARN',
        detail: `CCA factory ${factory} empty (expected pre-bootstrap — deploy v2.1.0 with feeController=0)`,
      })
    } else {
      rows.push({
        chain: chain.label,
        status: 'FAIL',
        detail: `CCA factory ${factory} has no code`,
      })
    }
  } else {
    try {
      const feeController = (await client.readContract({
        address: factory,
        abi: FACTORY_ABI,
        functionName: 'protocolFeeController',
      })) as Address

      let feeAmount = 0n
      if (feeController.toLowerCase() !== ZERO_ADDRESS) {
        try {
          feeAmount = (await client.readContract({
            address: feeController,
            abi: FEE_CONTROLLER_ABI,
            functionName: 'getProtocolFeeAmount',
            args: [ZERO_ADDRESS, ONE_ETH],
          })) as bigint
        } catch {
          // Failing controller is treated as zero by Uniswap ProtocolFeeLib — OK for migrate.
          feeAmount = 0n
        }
      }

      if (chain.requireZeroCcaProtocolFee && feeAmount !== 0n) {
        rows.push({
          chain: chain.label,
          status: 'FAIL',
          detail: `protocol fee ${feeAmount} != 0 (controller ${feeController}); migrate requires swept == currencyRaised`,
        })
      } else {
        rows.push({
          chain: chain.label,
          status: 'PASS',
          detail: `factory ${factory} live; feeController=${feeController}; fee(1 ETH)=${feeAmount}`,
        })
      }
    } catch (err) {
      rows.push({
        chain: chain.label,
        status: 'FAIL',
        detail: `factory fee probe failed: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  rows.push({
    chain: chain.label,
    status: hasCode(poolManagerCode) ? 'PASS' : 'FAIL',
    detail: hasCode(poolManagerCode)
      ? `v4 PoolManager ${chain.poolManagerV4} live`
      : `v4 PoolManager ${chain.poolManagerV4} has no code`,
  })

  rows.push({
    chain: chain.label,
    status: hasCode(lzCode) ? 'PASS' : 'FAIL',
    detail: hasCode(lzCode)
      ? `LZ EndpointV2 ${chain.lzEndpointV2} live (eid ${chain.eid})`
      : `LZ EndpointV2 ${chain.lzEndpointV2} has no code`,
  })

  return rows
}

async function main(): Promise<void> {
  const only = getArg('--chain')
  const keys = (only
    ? CCA_LAUNCH_CHAIN_KEYS.filter((k) => k === only)
    : CCA_LAUNCH_CHAIN_KEYS) as CcaLaunchChainKey[]

  if (only && keys.length === 0) {
    process.stdout.write(`Unknown --chain ${only}. Valid: ${CCA_LAUNCH_CHAIN_KEYS.join(', ')}\n`)
    process.exit(1)
  }

  process.stdout.write(`CCA multi-chain preflight (factory ${CCA_FACTORY_V210})\n`)
  process.stdout.write(`Chains: ${keys.join(', ')}\n\n`)

  const allRows: CheckRow[] = []
  for (const key of keys) {
    const rows = await checkChain(key)
    allRows.push(...rows)
  }

  const width = Math.max(...allRows.map((r) => r.chain.length), 8)
  for (const row of allRows) {
    process.stdout.write(
      `${row.status.padEnd(4)}  ${row.chain.padEnd(width)}  ${row.detail}\n`,
    )
  }

  const fails = allRows.filter((r) => r.status === 'FAIL')
  const warns = allRows.filter((r) => r.status === 'WARN')
  process.stdout.write(
    `\nSummary: ${allRows.filter((r) => r.status === 'PASS').length} PASS, ${warns.length} WARN, ${fails.length} FAIL\n`,
  )

  if (fails.length > 0) {
    process.stdout.write('RESULT: FAIL\n')
    process.exit(1)
  }
  process.stdout.write('RESULT: PASS\n')
  process.exit(0)
}

main().catch((err) => {
  process.stdout.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
