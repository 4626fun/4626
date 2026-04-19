#!/usr/bin/env tsx
/**
 * Operator script: verify that a creator coin's Solana bridge-wrapped mint
 * is in strict-parity / lowercase-coerced alignment with its Base ERC-20.
 *
 * Reads the Base ERC-20 `name()` / `symbol()`, derives the expected
 * Solana mint PDA, compares it to what the `SolanaBridgeAdapter` actually
 * has registered, and compares the live Solana Token-2022 metadata.
 *
 * Exit codes:
 *   0 — all three layers (Base, adapter, Solana mint) agree
 *   1 — invocation / config error (bad flags, unreadable env, etc.)
 *   2 — drift detected; report printed to stdout
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/verify-solana-mint-parity.ts \
 *     --creator 0x5b674196812451b7cec024fe9d22d2c0b172fa75
 *
 *   # Override adapter / RPCs / deploy env:
 *   pnpm -C frontend exec tsx scripts/verify-solana-mint-parity.ts \
 *     --creator 0x5b67... \
 *     --adapter 0x6533... \
 *     --base-rpc https://... \
 *     --solana-rpc https://api.mainnet-beta.solana.com \
 *     --deploy-env mainnet \
 *     --decimals 9 \
 *     --scaler 9 \
 *     --json
 *
 * The script reads defaults from env:
 *   - BASE_RPC_URL           (Base RPC; comma-sep list is allowed, first is used)
 *   - SOLANA_RPC_URL         (Solana RPC)
 *   - VITE_SOLANA_BRIDGE_ADAPTER or SOLANA_BRIDGE_ADAPTER (adapter address)
 *
 * This is a read-only tool. It never writes onchain or to the DB.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

import {
  createSolanaRpcMintMetadataFetcher,
  verifyCreatorSolanaMintParity,
} from '../server/_lib/onchain/verifyCreatorSolanaMintParity.js'
import type { BridgeDeployEnv } from '../server/_lib/onchain/solanaWrappedMintPda.js'

function loadEnvFile(path: string): void {
  let raw = ''
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && !process.env[key]) process.env[key] = value
  }
}

function parseArgs(argv: string[]): {
  creator: string | null
  adapter: string | null
  baseRpc: string | null
  solanaRpc: string | null
  deployEnv: BridgeDeployEnv
  decimals: number
  scalerExponent: number
  json: boolean
  help: boolean
} {
  const map = new Map<string, string>()
  const flags = new Set<string>()
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token?.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      flags.add(key)
    } else {
      map.set(key, next)
      i += 1
    }
  }
  const deployEnvRaw = map.get('deploy-env') ?? 'mainnet'
  if (deployEnvRaw !== 'mainnet' && deployEnvRaw !== 'testnet-prod' && deployEnvRaw !== 'testnet-alpha') {
    throw new Error(`invalid --deploy-env ${deployEnvRaw}`)
  }
  const decimals = Number.parseInt(map.get('decimals') ?? '9', 10)
  const scaler = Number.parseInt(map.get('scaler') ?? map.get('scaler-exponent') ?? '9', 10)
  if (!Number.isFinite(decimals) || decimals < 0 || decimals > 255) {
    throw new Error('decimals must be 0..255')
  }
  if (!Number.isFinite(scaler) || scaler < 0 || scaler > 255) {
    throw new Error('scaler must be 0..255')
  }
  return {
    creator: map.get('creator') ?? null,
    adapter: map.get('adapter') ?? null,
    baseRpc: map.get('base-rpc') ?? null,
    solanaRpc: map.get('solana-rpc') ?? null,
    deployEnv: deployEnvRaw,
    decimals,
    scalerExponent: scaler,
    json: flags.has('json'),
    help: flags.has('help') || flags.has('h'),
  }
}

function usage(): never {
  const lines = [
    'Usage:',
    '  pnpm -C frontend exec tsx scripts/verify-solana-mint-parity.ts \\',
    '    --creator 0x<base-erc20-address>',
    '',
    'Required:',
    '  --creator 0x...             Base creator coin address to verify',
    '',
    'Optional:',
    '  --adapter 0x...             SolanaBridgeAdapter address (default: env VITE_SOLANA_BRIDGE_ADAPTER / SOLANA_BRIDGE_ADAPTER)',
    '  --base-rpc <url>            Base RPC URL (default: env BASE_RPC_URL or https://mainnet.base.org)',
    '  --solana-rpc <url>          Solana RPC URL (default: env SOLANA_RPC_URL or https://api.mainnet-beta.solana.com)',
    '  --deploy-env <env>          mainnet | testnet-prod | testnet-alpha (default: mainnet)',
    '  --decimals <n>              Expected Solana decimals (default: 9)',
    '  --scaler <n>                Expected bridge scaler exponent (default: decimals)',
    '  --json                      Emit machine-readable JSON instead of pretty output',
    '  --help                      This message',
    '',
    'Exit codes: 0 = parity, 1 = invocation error, 2 = drift',
  ]
  console.error(lines.join('\n'))
  process.exit(1)
}

async function main(): Promise<void> {
  // Load env files the same way the rest of the scripts do.
  loadEnvFile(resolve(process.cwd(), '.env'))
  loadEnvFile(resolve(process.cwd(), '..', '.env'))

  const args = parseArgs(process.argv.slice(2))
  if (args.help) usage()
  if (!args.creator || !isAddress(args.creator)) {
    console.error('Missing or invalid --creator')
    usage()
  }
  const creator = getAddress(args.creator) as Address
  const adapterRaw =
    args.adapter ??
    process.env.VITE_SOLANA_BRIDGE_ADAPTER ??
    process.env.SOLANA_BRIDGE_ADAPTER ??
    ''
  if (!isAddress(adapterRaw)) {
    console.error('Missing adapter address. Pass --adapter or set VITE_SOLANA_BRIDGE_ADAPTER / SOLANA_BRIDGE_ADAPTER.')
    process.exit(1)
  }
  const adapter = getAddress(adapterRaw) as Address
  const baseRpcUrl = (args.baseRpc ?? process.env.BASE_RPC_URL ?? 'https://mainnet.base.org')
    .split(',')[0]
    .trim()
  const solanaRpcUrl = (args.solanaRpc ?? process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com').trim()

  const basePublicClient = createPublicClient({
    chain: base,
    transport: http(baseRpcUrl, { timeout: 20_000 }),
  })
  const solanaMintMetadataFetcher = createSolanaRpcMintMetadataFetcher(solanaRpcUrl)

  const report = await verifyCreatorSolanaMintParity({
    creatorToken: creator,
    adapterAddress: adapter,
    deployEnv: args.deployEnv,
    expectedDecimals: args.decimals,
    expectedScalerExponent: args.scalerExponent,
    basePublicClient,
    solanaMintMetadataFetcher,
  })

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    const status = report.matched ? 'PASS' : 'FAIL'
    console.log(`=============================================`)
    console.log(`  Solana mint parity: ${status}`)
    console.log(`=============================================`)
    console.log(`creatorToken:           ${report.creatorToken}`)
    console.log(`adapterAddress:         ${report.adapterAddress}`)
    console.log(`Base ERC-20 name:       "${report.baseName}"`)
    console.log(`Base ERC-20 symbol:     "${report.baseSymbol}"`)
    console.log(`Lowercase name:         "${report.lowercaseName}"`)
    console.log(`Lowercase symbol:       "${report.lowercaseSymbol}"`)
    console.log(`Expected mint (PDA):    ${report.expectedMintPubkey}`)
    console.log(`Expected mintBytes32:   ${report.expectedMintBytes32}`)
    console.log(`Adapter registered:     ${report.adapterRegisteredMint}`)
    console.log(`Adapter decimals:       ${report.adapterRegisteredDecimals}`)
    console.log(`Solana on-chain name:   "${report.solanaOnchainName}"`)
    console.log(`Solana on-chain symbol: "${report.solanaOnchainSymbol}"`)
    if (report.drift.length > 0) {
      console.log()
      console.log('Drift:')
      for (const d of report.drift) console.log(`  - ${d}`)
    }
  }
  process.exit(report.matched ? 0 : 2)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
