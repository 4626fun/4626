#!/usr/bin/env node
/**
 * Smoke-check AMOE + protocol CSW alignment (on-chain + local env).
 *
 * Usage:
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/verify-amoe-protocol-csw.ts
 */

import { createPublicClient, getAddress, http, type Address } from 'viem'
import { base } from 'viem/chains'

import { resolveServerAgentCswAddress } from '../../server/_lib/wallet/canonicalCswEnv.js'

const ROUTER_ABI = [
  { type: 'function', name: 'allowlistPublisher', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'pointsLedgerPublisher', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

async function main() {
  const protocol = getAddress(resolveServerAgentCswAddress()) as Address
  const routerRaw = String(process.env.LOTTERY_AMOE_ROUTER ?? '').trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(routerRaw)) {
    throw new Error('LOTTERY_AMOE_ROUTER missing')
  }
  const router = getAddress(routerRaw) as Address
  const rpc = String(process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim()

  const publicClient = createPublicClient({ chain: base, transport: http(rpc) })
  const [allowlist, ledger] = await Promise.all([
    publicClient.readContract({ address: router, abi: ROUTER_ABI, functionName: 'allowlistPublisher' }),
    publicClient.readContract({ address: router, abi: ROUTER_ABI, functionName: 'pointsLedgerPublisher' }),
  ])

  const envLedger = String(process.env.AMOE_LEDGER_PUBLISHER_SMART_WALLET ?? '').trim()
  const envRelay = String(process.env.LOTTERY_AMOE_RELAY_SMART_WALLET ?? '').trim()

  const checks: Array<{ label: string; ok: boolean; detail: string }> = [
    {
      label: 'router.allowlistPublisher',
      ok: getAddress(String(allowlist)).toLowerCase() === protocol.toLowerCase(),
      detail: `${allowlist} (expected ${protocol})`,
    },
    {
      label: 'router.pointsLedgerPublisher',
      ok: getAddress(String(ledger)).toLowerCase() === protocol.toLowerCase(),
      detail: `${ledger} (expected ${protocol})`,
    },
    {
      label: 'env.AMOE_LEDGER_PUBLISHER_SMART_WALLET',
      ok: !envLedger || getAddress(envLedger).toLowerCase() === protocol.toLowerCase(),
      detail: envLedger || '(unset — code falls back to protocol)',
    },
    {
      label: 'env.LOTTERY_AMOE_RELAY_SMART_WALLET',
      ok: !envRelay || getAddress(envRelay).toLowerCase() === protocol.toLowerCase(),
      detail: envRelay || '(unset — code falls back to protocol)',
    },
  ]

  let failed = false
  for (const check of checks) {
    const status = check.ok ? 'OK' : 'FAIL'
    console.log(`[${status}] ${check.label}: ${check.detail}`)
    if (!check.ok) failed = true
  }

  if (failed) process.exit(1)
  console.log('[verify-amoe] all checks passed')
}

main().catch((error) => {
  console.error(`[verify-amoe] ${String(error instanceof Error ? error.message : error)}`)
  process.exit(1)
})
