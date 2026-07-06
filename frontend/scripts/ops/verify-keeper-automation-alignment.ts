#!/usr/bin/env tsx
/**
 * Verify keeper automation env pins match the canonical KPR EOA and on-chain AKITA keeper.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/verify-keeper-automation-alignment.ts
 *   pnpm -C frontend exec tsx scripts/ops/verify-keeper-automation-alignment.ts --vault 0x...
 */

import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { resolvePayoutRouterKeeperAddress } from '../../server/_lib/onchain/payoutRouterRuntime.js'
import {
  CANONICAL_KEEPER_AUTOMATION_EOA,
  isCanonicalKeeperAutomationEoa,
} from '../../server/_lib/wallet/keeperAutomationPolicy.js'
import {
  resolveProtocolAjnaKeeperAddress,
  resolveProtocolAutomationAddress,
  resolveProtocolTreasuryAddress,
} from '../../server/_lib/wallet/protocolTreasurySafe.js'

const DEFAULT_AKITA_VAULT = '0x82C06EaAE27B1Ca31fA29F22341A162A670A4471' as const

const VAULT_KEEPER_ABI = [
  {
    type: 'function',
    name: 'keeper',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const SAFE_IS_OWNER_ABI = [
  {
    type: 'function',
    name: 'isOwner',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return null
  return process.argv[idx + 1] ?? null
}

function normalizePrivateKey(raw: string | undefined): `0x${string}` | null {
  const trimmed = String(raw ?? '').trim()
  const key = trimmed.startsWith('0x') || trimmed.startsWith('0X') ? `0x${trimmed.slice(2)}` : `0x${trimmed}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return null
  return key as `0x${string}`
}

function deriveKprAddress(): Address | null {
  const pk = normalizePrivateKey(process.env.KPR_PRIVATE_KEY)
  if (!pk) return null
  return getAddress(privateKeyToAccount(pk).address)
}

async function main(): Promise<void> {
  const rpcUrl = (process.env.BASE_RPC_URL ?? process.env.VITE_BASE_RPC_URL ?? 'https://mainnet.base.org').trim()
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })

  const vaultArg = getArg('--vault')
  const vaultAddress = getAddress(
    vaultArg && isAddress(vaultArg) ? vaultArg : DEFAULT_AKITA_VAULT,
  )

  const kprDerived = deriveKprAddress()
  const ajnaKeeper = resolveProtocolAjnaKeeperAddress()
  const payoutKeeper = resolvePayoutRouterKeeperAddress()
  const automationSafe = resolveProtocolAutomationAddress()
  const treasurySafe = resolveProtocolTreasuryAddress()

  const onChainKeeper = getAddress(
    await client.readContract({
      address: vaultAddress,
      abi: VAULT_KEEPER_ABI,
      functionName: 'keeper',
    }),
  )

  const lines: string[] = []
  const errors: string[] = []
  const warnings: string[] = []

  lines.push(`Canonical keeper EOA: ${CANONICAL_KEEPER_AUTOMATION_EOA}`)
  lines.push(`KPR_PRIVATE_KEY derives: ${kprDerived ?? '(unset or invalid)'}`)
  lines.push(`PROTOCOL_AJNA_KEEPER resolves: ${ajnaKeeper ?? '(null)'}`)
  lines.push(`PAYOUT_ROUTER_KEEPER resolves: ${payoutKeeper ?? '(null)'}`)
  lines.push(`Vault ${vaultAddress} on-chain keeper: ${onChainKeeper}`)

  if (!kprDerived) {
    errors.push('KPR_PRIVATE_KEY missing or invalid (expected 64-byte hex).')
  } else if (!isCanonicalKeeperAutomationEoa(kprDerived)) {
    errors.push(`KPR_PRIVATE_KEY derives to ${kprDerived}, not canonical ${CANONICAL_KEEPER_AUTOMATION_EOA}.`)
  }

  if (!ajnaKeeper) {
    errors.push('PROTOCOL_AJNA_KEEPER could not be resolved.')
  } else if (!isCanonicalKeeperAutomationEoa(ajnaKeeper)) {
    errors.push(`PROTOCOL_AJNA_KEEPER=${ajnaKeeper} does not match canonical keeper EOA.`)
  }

  if (payoutKeeper && !isCanonicalKeeperAutomationEoa(payoutKeeper)) {
    errors.push(`PAYOUT_ROUTER_KEEPER=${payoutKeeper} does not match canonical keeper EOA.`)
  }

  if (onChainKeeper.toLowerCase() !== CANONICAL_KEEPER_AUTOMATION_EOA) {
    errors.push(
      `On-chain vault keeper ${onChainKeeper} != canonical ${CANONICAL_KEEPER_AUTOMATION_EOA}. Run setKeeper rotation if intentional.`,
    )
  }

  if (kprDerived && ajnaKeeper && kprDerived.toLowerCase() !== ajnaKeeper.toLowerCase()) {
    errors.push('KPR_PRIVATE_KEY address and PROTOCOL_AJNA_KEEPER disagree.')
  }

  if (automationSafe) {
    lines.push(`PROTOCOL_AUTOMATION_SAFE: ${automationSafe}`)
  }

  if (kprDerived && automationSafe) {
    const isAutomationOwner = await client.readContract({
      address: automationSafe,
      abi: SAFE_IS_OWNER_ABI,
      functionName: 'isOwner',
      args: [kprDerived],
    })
    lines.push(`Keeper EOA is owner of hot automation Safe ${automationSafe}: ${isAutomationOwner}`)
    if (!isAutomationOwner) {
      errors.push(
        `Keeper EOA is not an owner of hot automation Safe ${automationSafe}. Run ops:deploy-protocol-automation-safe or addOwner on that Safe.`,
      )
    }
  } else if (kprDerived) {
    warnings.push('PROTOCOL_AUTOMATION_SAFE not configured — Charm/Ajna may still use treasury Safe manager lane.')
  }

  if (kprDerived) {
    const isTreasuryOwner = await client.readContract({
      address: treasurySafe,
      abi: SAFE_IS_OWNER_ABI,
      functionName: 'isOwner',
      args: [kprDerived],
    })
    lines.push(`Keeper EOA is owner of cold treasury Safe ${treasurySafe}: ${isTreasuryOwner}`)
    if (isTreasuryOwner) {
      warnings.push(
        `Keeper EOA should not remain a treasury Safe owner once hot automation Safe is live — run ops:deploy-protocol-automation-safe -- --remove-keeper-from-treasury`,
      )
    }
  }

  for (const line of lines) console.log(line)
  for (const warning of warnings) console.warn(`WARN: ${warning}`)

  if (errors.length > 0) {
    console.error('\nKeeper automation alignment FAILED:')
    for (const error of errors) console.error(`  - ${error}`)
    process.exit(1)
  }

  console.log('\nKeeper automation alignment OK.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
