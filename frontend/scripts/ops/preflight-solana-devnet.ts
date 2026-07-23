#!/usr/bin/env tsx
/**
 * Read-only prerequisite check for the live Pipe B devnet rehearsal.
 *
 * This never funds a payer, deploys a program, creates a mint, or initializes
 * a PDA. It fails closed when the rehearsal would otherwise degrade into a
 * rent-only probe because the hook program keypair or funded payer is absent.
 */

import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { CREATOR_SHARE_HOOK_PROGRAM_ID } from '../../server/_lib/onchain/creatorShareHookPdas.js'

const DEFAULT_MIN_PAYER_SOL = 2

type Check = { id: string; passed: boolean; detail: string }

export type SolanaDevnetPreflight = {
  ok: boolean
  rpc: string
  cluster: 'devnet' | 'local' | 'other' | 'missing'
  payer: string | null
  payerBalanceSol: string | null
  hookProgram: string
  hookProgramMode: 'canonical' | 'devnet_surrogate'
  hookProgramKeypairConfigured: boolean
  checks: Check[]
  error?: string
}

function hookCheckRequired(): boolean {
  return !process.argv.includes('--skip-hook')
}

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function redactRpc(raw: string): string {
  try {
    const parsed = new URL(raw)
    return parsed.origin
  } catch {
    return '<invalid-rpc-url>'
  }
}

function clusterForRpc(rpc: string): SolanaDevnetPreflight['cluster'] {
  if (!rpc) return 'missing'
  if (/localhost|127\.0\.0\.1/.test(rpc)) return 'local'
  if (/devnet|solana-testnet/i.test(rpc)) return 'devnet'
  return 'other'
}

function decodeBase58(value: string): Uint8Array | null {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let decoded = 0n
  for (const char of value) {
    const digit = alphabet.indexOf(char)
    if (digit < 0) return null
    decoded = decoded * 58n + BigInt(digit)
  }
  const bytes: number[] = []
  while (decoded > 0n) {
    bytes.push(Number(decoded & 0xffn))
    decoded >>= 8n
  }
  bytes.reverse()
  const leadingZeroes = value.length - value.replace(/^1+/, '').length
  return Uint8Array.from([...new Array<number>(leadingZeroes).fill(0), ...bytes])
}

function readKeypairReference(reference: string): Keypair | null {
  const value = reference.trim()
  if (!value) return null
  let raw = value
  if (!value.startsWith('[') && existsSync(value)) {
    try {
      raw = readFileSync(value, 'utf8').trim()
    } catch {
      return null
    }
  }
  try {
    if (raw.startsWith('[')) {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed) || parsed.length !== 64 || !parsed.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
        return null
      }
      return Keypair.fromSecretKey(Uint8Array.from(parsed as number[]))
    }
    const bytes = decodeBase58(raw)
    return bytes?.length === 64 ? Keypair.fromSecretKey(bytes) : null
  } catch {
    return null
  }
}

function add(checks: Check[], id: string, passed: boolean, detail: string): void {
  checks.push({ id, passed, detail })
}

export type DevnetHookProgramSelection = {
  program: PublicKey
  mode: 'canonical' | 'devnet_surrogate'
  error: string | null
}

/**
 * The production hook ID is immutable. A different ID is permitted only for
 * a deliberately isolated devnet/local rehearsal, through the devnet-specific
 * variable below. Callers must never reuse this selector for a mainnet path.
 */
export function selectDevnetHookProgram(rawOverride: string): DevnetHookProgramSelection {
  const canonical = new PublicKey(CREATOR_SHARE_HOOK_PROGRAM_ID)
  const override = rawOverride.trim()
  if (!override) return { program: canonical, mode: 'canonical', error: null }
  try {
    const program = new PublicKey(override)
    if (program.equals(canonical)) {
      return { program: canonical, mode: 'canonical', error: null }
    }
    return { program, mode: 'devnet_surrogate', error: null }
  } catch {
    return { program: canonical, mode: 'canonical', error: 'invalid_solana_devnet_hook_program_id' }
  }
}

export async function readSolanaDevnetPreflight(): Promise<SolanaDevnetPreflight> {
  const rpc = env('SOLANA_DEVNET_RPC_URL') || env('RPC_URL_SOLANA_TESTNET') || env('SOLANA_RPC_URL')
  const cluster = clusterForRpc(rpc)
  const hookSelection = selectDevnetHookProgram(env('SOLANA_DEVNET_HOOK_PROGRAM_ID'))
  const hookProgram = hookSelection.program
  const checks: Check[] = []
  const payerReference = env('COST_PROBE_KEYPAIR') || env('SOLANA_PRIVATE_KEY')
  const payer = readKeypairReference(payerReference)
  const requireHook = hookCheckRequired()
  const hookProgramKeypairReference =
    env('SOLANA_DEVNET_HOOK_PROGRAM_KEYPAIR') || env('COST_PROBE_HOOK_PROGRAM_KEYPAIR')
  const hookProgramKeypair = requireHook ? readKeypairReference(hookProgramKeypairReference) : null
  const minPayerSolRaw = env('SOLANA_DEVNET_MIN_PAYER_SOL') || String(DEFAULT_MIN_PAYER_SOL)
  const minPayerSol = Number(minPayerSolRaw)

  add(checks, 'devnet_rpc_configured', Boolean(rpc), rpc ? redactRpc(rpc) : 'missing')
  add(checks, 'devnet_rpc_cluster', cluster === 'devnet' || cluster === 'local', cluster)
  add(
    checks,
    'hook_program_selection',
    !hookSelection.error && (hookSelection.mode === 'canonical' || cluster === 'devnet' || cluster === 'local'),
    hookSelection.error ?? `mode=${hookSelection.mode},program=${hookProgram.toBase58()}`,
  )
  add(checks, 'payer_keypair_configured', Boolean(payer), payer ? payer.publicKey.toBase58() : 'missing_or_invalid')
  if (requireHook && hookProgramKeypair) {
    add(
      checks,
      'hook_program_keypair_matches_selected_id',
      hookProgramKeypair.publicKey.equals(hookProgram),
      hookProgramKeypair.publicKey.toBase58(),
    )
  }
  if (!Number.isFinite(minPayerSol) || minPayerSol <= 0) {
    add(checks, 'minimum_payer_balance_configured', false, `invalid=${minPayerSolRaw}`)
  }

  let balanceSol: string | null = null
  if (!rpc || !payer || cluster === 'other') {
    add(checks, 'payer_balance', false, 'not_checked_until_devnet_rpc_and_payer_are_valid')
      add(checks, 'hook_program_on_cluster_or_keypair_ready', !requireHook, requireHook ? 'not_checked_until_devnet_rpc_and_payer_are_valid' : 'not_required')
  } else {
    try {
      const connection = new Connection(rpc, 'finalized')
      const lamports = BigInt(await connection.getBalance(payer.publicKey, 'finalized'))
      const whole = lamports / 1_000_000_000n
      const fractional = lamports % 1_000_000_000n
      balanceSol = `${whole}.${fractional.toString().padStart(9, '0')}`
      add(checks, 'payer_balance', Number(balanceSol) >= minPayerSol, `balance=${balanceSol},minimum=${minPayerSol}`)
      if (!requireHook) {
        add(checks, 'hook_program_on_cluster_or_keypair_ready', true, 'not_required')
      } else {
        const hookInfo = await connection.getAccountInfo(hookProgram, 'finalized')
        const hookDeployed = hookInfo?.executable === true
        add(checks, 'hook_program_on_cluster_or_keypair_ready', hookDeployed || Boolean(hookProgramKeypair), hookDeployed ? 'executable_on_cluster' : 'not_deployed_keypair_required')
      }
    } catch (error) {
      add(checks, 'payer_balance', false, error instanceof Error ? error.message : String(error))
      add(checks, 'hook_program_on_cluster_or_keypair_ready', false, 'rpc_read_failed')
    }
  }

  return {
    ok: checks.length > 0 && checks.every((check) => check.passed),
    rpc,
    cluster,
    payer: payer?.publicKey.toBase58() ?? null,
    payerBalanceSol: balanceSol,
    hookProgram: hookProgram.toBase58(),
    hookProgramMode: hookSelection.mode,
    hookProgramKeypairConfigured: Boolean(hookProgramKeypair),
    checks,
  }
}

async function main(): Promise<void> {
  const result = await readSolanaDevnetPreflight()
  process.stdout.write(`${JSON.stringify({ ...result, rpc: result.rpc ? redactRpc(result.rpc) : '' }, null, 2)}\n`)
  if (!result.ok) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
