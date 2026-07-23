#!/usr/bin/env tsx
/**
 * AKITA full-stack redeploy — platform + Vultr + Vercel prep gate.
 *
 *   pnpm -C frontend ops:verify-akita-prelaunch --production
 *   pnpm -C frontend ops:verify-akita-prelaunch --production --ssh-vultr
 *
 * Does NOT deploy the vault. Surfaces what is ready vs what you / ops must still do
 * before launching AKITA via app.4626.fun/deploy.
 *
 * LAUNCH-002: Deploy status and preflight checks are read-only. This script
 * never invokes keeper reconciliation or any Solana/Base mutation endpoint.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PublicKey } from '@solana/web3.js'
import type { Address } from 'viem'

import { AKITA_DEFAULTS, SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '../..')
const REPO_ROOT = resolve(FRONTEND_ROOT, '..')

const AKITA_CREATOR = AKITA_DEFAULTS.token as Address
const BATCHER = SPLIT_PHASE1_DEPLOYMENT_BATCHER

/** Retired B1 identity. It is standard SPL and must never be reused for B2. */
export const RETIRED_AKITA_B1_SHARE_MESH = {
  oftStore: 'G3rfXFKvARH8emUVkiu6RrdSkXZQFGfsqKbF9P7EqXeN',
  shareMeshMint: '5puVV8bQZp4YoEfGq4RitQFRVC3SJiHBSydFuFZUXHQv',
  peerBytes32: '0xdf9a9ef76562adbfe0231e2c5cee77f24a1f9eac519d3fbb029fe5b454d9cd3f',
  solanaEid: 30168,
  hubComposer: '0x7dF44cBB93a5191837a988f0Cc441E3811C39CD1',
} as const

function checkFreshB2MeshInputs(): Check[] {
  const shareMeshMint = String(process.env.AKITA_B2_SHARE_MESH_MINT ?? '').trim()
  const oftStore = String(process.env.AKITA_B2_OFT_STORE ?? '').trim()
  const peerBytes32 = String(process.env.AKITA_B2_SHARE_PEER_BYTES32 ?? '').trim().toLowerCase()

  if (!shareMeshMint || !oftStore || !peerBytes32) {
    return [
      {
        section: 'platform',
        id: 'akita_b2_fresh_mesh_identity',
        ok: false,
        detail:
          'set AKITA_B2_SHARE_MESH_MINT, AKITA_B2_OFT_STORE, and AKITA_B2_SHARE_PEER_BYTES32 after provisioning the fresh Token-2022 B2 mint',
      },
    ]
  }

  try {
    const mintKey = new PublicKey(shareMeshMint)
    const storeKey = new PublicKey(oftStore)
    const expectedPeer = `0x${Buffer.from(storeKey.toBytes()).toString('hex')}`
    const isFresh =
      mintKey.toBase58() !== RETIRED_AKITA_B1_SHARE_MESH.shareMeshMint &&
      storeKey.toBase58() !== RETIRED_AKITA_B1_SHARE_MESH.oftStore &&
      peerBytes32 !== RETIRED_AKITA_B1_SHARE_MESH.peerBytes32
    const peerMatches = /^0x[0-9a-f]{64}$/.test(peerBytes32) && peerBytes32 === expectedPeer
    return [
      {
        section: 'platform',
        id: 'akita_b2_fresh_mesh_identity',
        ok: isFresh && peerMatches,
        detail: !isFresh
          ? 'retired B1 mint/store/peer rejected'
          : peerMatches
            ? `fresh mint=${mintKey.toBase58()},store=${storeKey.toBase58()}`
            : `OFT Store peer mismatch; expected ${expectedPeer}`,
      },
    ]
  } catch {
    return [
      {
        section: 'platform',
        id: 'akita_b2_fresh_mesh_identity',
        ok: false,
        detail: 'invalid AKITA_B2_SHARE_MESH_MINT or AKITA_B2_OFT_STORE public key',
      },
    ]
  }
}

function safeJson(value: unknown, max = 120): string {
  try {
    return JSON.stringify(value ?? null).slice(0, max)
  } catch {
    return String(value).slice(0, max)
  }
}

type Check = { id: string; ok: boolean; detail: string; section?: 'platform' | 'vultr' | 'vercel' | 'creator' }

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(resolve(FRONTEND_ROOT, '.env.local'))
loadEnvFile(resolve(FRONTEND_ROOT, '.env'))

function run(cmd: string, args: string[], cwd = REPO_ROOT): { ok: boolean; detail: string } {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe' })
  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  const tail = out.split('\n').slice(-3).join(' | ')
  return { ok: result.status === 0, detail: tail || `(exit ${result.status ?? 'unknown'})` }
}

const DEFAULT_FETCH_TIMEOUT_MS = 20_000

async function fetchResponse(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<{ ok: boolean; status: number; detail: string; data?: unknown; headers?: Headers }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    const text = await res.text()
    let data: unknown = text
    try {
      data = JSON.parse(text)
    } catch {
      // keep text
    }
    return {
      ok: res.ok,
      status: res.status,
      detail: `HTTP ${res.status}`,
      data,
      headers: res.headers,
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}

async function checkVultrAndVercelChain(appBase: string): Promise<Check[]> {
  const checks: Check[] = []
  const provSecret =
    process.env.SOLANA_HOOK_PROVISIONER_SECRET?.trim() ||
    process.env.SOLANA_METEORA_POOL_PROVISIONER_SECRET?.trim() ||
    process.env.METEORA_IX_PROVISIONER_SECRET?.trim()

  const orchHealth = await fetchResponse('https://orchestrator.4626.fun/healthz')
  checks.push({
    section: 'vultr',
    id: 'vultr_orchestrator_health',
    ok: orchHealth.ok && (orchHealth.data as { ok?: boolean })?.ok === true,
    detail: orchHealth.detail,
  })

  const b2FlagNames = [
    'SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED',
    'SOLANA_ORCHESTRATOR_LOTTERY_INGEST_ENABLED',
    'SOLANA_ORCHESTRATOR_LOTTERY_SUBMIT_ENABLED',
    'SOLANA_ORCHESTRATOR_LOTTERY_CONFIRM_ENABLED',
    'SOLANA_ORCHESTRATOR_LOTTERY_WINNER_SETTLE_ENABLED',
  ] as const
  const enabledB2Flags = b2FlagNames.filter((key) =>
    ['1', 'true', 'yes'].includes(String(process.env[key] ?? '').trim().toLowerCase()),
  )
  checks.push({
    section: 'vultr',
    id: 'b2_mutation_flags_off',
    ok: enabledB2Flags.length === 0,
    detail: enabledB2Flags.length === 0
      ? 'legacy relay and replacement B2 workers are disabled in the loaded environment'
      : `unexpected enabled flags: ${enabledB2Flags.join(',')}`,
  })

  const provUrl =
    process.env.SOLANA_PROVISIONER_HEALTH_URL?.trim() ||
    'https://provisioner.4626.fun/healthz'
  const prov = await fetchResponse(provUrl, {
    headers: provSecret ? { Authorization: `Bearer ${provSecret}` } : {},
  })
  const provData = prov.data as {
    ok?: boolean
    payerHealthy?: boolean
    service?: string
  }
  checks.push({
    section: 'vultr',
    id: 'vultr_provisioner_health',
    ok: prov.ok && provData?.ok === true && provData?.payerHealthy === true,
    detail: prov.ok
      ? `${provData?.service ?? 'provisioner'} payerHealthy=${String(provData?.payerHealthy)}`
      : prov.detail,
  })

  const provHead = await fetchResponse('https://provisioner.4626.fun/healthz')
  const server = provHead.headers?.get('server') ?? ''
  const notVercelSpa =
    server.toLowerCase().includes('nginx') ||
    (provHead.headers?.get('content-type') ?? '').includes('application/json')
  checks.push({
    section: 'vultr',
    id: 'vultr_provisioner_dns',
    ok: notVercelSpa,
    detail: notVercelSpa
      ? `DNS routes to Vultr/nginx (Server: ${server || 'unknown'})`
      : 'Provisioner may be pointing at Vercel SPA — fix DNS A-record to Vultr host',
  })

  checks.push({
    section: 'vercel',
    id: 'vercel_solana_reconcile_chain',
    ok: true,
    detail: `SKIP mutation probe for ${appBase}; preflight is read-only`,
  })

  return checks
}

async function checkVultrSsh(): Promise<Check[]> {
  const checks: Check[] = []
  const user = process.env.VULTR_USERNAME?.trim()
  const host = process.env.VULTR_IP_ADDRESS?.trim()
  if (!user || !host) {
    checks.push({
      section: 'vultr',
      id: 'vultr_ssh_systemd',
      ok: true,
      detail: 'SKIP: set VULTR_USERNAME + VULTR_IP_ADDRESS (or pass --ssh-vultr with key auth) for systemd probe',
    })
    return checks
  }

  const remoteCmd = [
    'systemctl is-active solana-keeper-orchestrator 2>/dev/null || echo inactive-or-missing',
    'curl -fsS http://127.0.0.1:8789/healthz 2>/dev/null || echo local-health-fail',
    'test -f /etc/4626/solana-keeper-orchestrator.env && echo env-file-ok || echo env-file-missing',
  ].join(' && echo "---" && ')

  const sshArgs = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=12', `${user}@${host}`, remoteCmd]
  const result = spawnSync('ssh', sshArgs, { encoding: 'utf8', stdio: 'pipe' })
  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()

  if (result.status !== 0) {
    checks.push({
      section: 'vultr',
      id: 'vultr_ssh_systemd',
      ok: true,
      detail: `SKIP: SSH unavailable (${out.slice(0, 100) || 'permission denied'}) — public HTTP checks above are authoritative`,
    })
    return checks
  }

  const active = out.includes('active')
  const localHealth = out.includes('"ok":true') || out.includes('ok":true')
  const envFile = out.includes('env-file-ok')
  checks.push({
    section: 'vultr',
    id: 'vultr_ssh_systemd',
    ok: active && localHealth && envFile,
    detail: `systemd=${active ? 'active' : 'not-active'} local_health=${localHealth} env=${envFile ? 'ok' : 'missing'}`,
  })
  return checks
}

async function checkStrategyEntitlements(): Promise<Check[]> {
  const checks: Check[] = []
  const { getDb, getDbInitError } = await import('../../server/_lib/db/postgres.js')
  const db = await getDb()
  if (!db) {
    checks.push({
      section: 'creator',
      id: 'strategy_db',
      ok: false,
      detail: `DATABASE_URL unavailable: ${getDbInitError() ?? 'unknown'}`,
    })
    return checks
  }

  const rows = await db.sql`
    SELECT feature_key, status
    FROM creator_strategy_features
    WHERE creator_token = ${AKITA_CREATOR.toLowerCase()}
      AND status IN ('pending', 'active')
    ORDER BY feature_key
  `

  const active = new Set(rows.rows.map((r: { feature_key: string }) => r.feature_key))
  const hasBundle = active.has('vault_full_deploy')
  const hasMesh =
    hasBundle || active.has('solana_ovault_mesh') || active.has('solana_meteora_alpha_vault')
  const hasStrategy =
    hasBundle || (active.has('charm_active_lp') && active.has('ajna_sleeve'))

  checks.push({
    section: 'creator',
    id: 'strategy_entitlement',
    ok: hasStrategy,
    detail: hasStrategy
      ? `active/pending: ${[...active].join(', ') || '(none)'}`
      : 'Need vault_full_deploy OR equivalent (charm_active_lp + ajna_sleeve) before deploy',
  })
  checks.push({
    section: 'creator',
    id: 'strategy_solana_mesh',
    ok: hasMesh,
    detail: hasMesh
      ? 'Solana mesh entitlement present'
      : 'Need vault_full_deploy OR solana_ovault_mesh for Pipe A / OVault session',
  })

  return checks
}

function printSection(title: string, checks: Check[]): void {
  process.stdout.write(`\n--- ${title} ---\n`)
  for (const c of checks) {
    process.stdout.write(`${c.ok ? '✓' : '✗'} ${c.id}: ${c.detail}\n`)
  }
}

async function main(): Promise<void> {
  const useProduction = hasFlag('--production')
  const appBase = useProduction ? 'https://app.4626.fun' : process.env.VITE_APP_ORIGIN ?? 'https://app.4626.fun'

  process.stdout.write('\n=== AKITA full-stack pre-launch readiness ===\n\n')
  process.stdout.write(`Creator coin (unchanged): ${AKITA_CREATOR}\n`)
  process.stdout.write(`Current stack snapshot: vault ${AKITA_DEFAULTS.vault} / share ${AKITA_DEFAULTS.shareOFT}\n`)
  process.stdout.write(`Pipe A batcher: ${BATCHER}\n`)

  const platform: Check[] = []

  const pipeA = run('pnpm', [
    '-C',
    'frontend',
    'exec',
    'tsx',
    'scripts/ops/verify-batcher-pipe-a-readiness.ts',
    '--batcher',
    BATCHER,
  ])
  platform.push({ section: 'platform', id: 'pipe_a_batcher', ok: pipeA.ok, detail: pipeA.detail })

  const releaseGuard = run('bash', ['test/current-release-target-guard.sh'])
  platform.push({ section: 'platform', id: 'release_target_guard', ok: releaseGuard.ok, detail: releaseGuard.detail })

  const hook = run('pnpm', ['-C', 'frontend', 'ops:verify-hook-mainnet-bytecode'])
  platform.push({ section: 'platform', id: 'hook_mainnet_canonical', ok: hook.ok, detail: hook.detail })

  const vitest = run('pnpm', [
    '-C',
    'frontend',
    'exec',
    'vitest',
    'run',
    'src/lib/deploy/finalizeShareBridgeFee.test.ts',
    'src/lib/deploy/shareBridgeOftWiring.test.ts',
  ])
  platform.push({ section: 'platform', id: 'vitest_pipe_a_wiring', ok: vitest.ok, detail: vitest.detail })

  const forge = run('forge', ['test', '--match-path', 'test/DeploymentBatcher.ShareOftPeerWiring.t.sol'])
  platform.push({ section: 'platform', id: 'forge_share_oft_peer', ok: forge.ok, detail: forge.detail })

  printSection('Platform (contracts + tests)', platform)

  const vultrVercel = await checkVultrAndVercelChain(appBase)
  printSection('Vultr (orchestrator + provisioner via public HTTPS)', vultrVercel.filter((c) => c.section === 'vultr'))
  printSection('Vercel → Vultr control plane', vultrVercel.filter((c) => c.section === 'vercel'))

  if (hasFlag('--ssh-vultr')) {
    const sshChecks = await checkVultrSsh()
    printSection('Vultr SSH (optional)', sshChecks)
    vultrVercel.push(...sshChecks)
  }

  process.stdout.write('\n--- Retired AKITA B1 mesh identity (DO NOT REUSE FOR B2) ---\n')
  process.stdout.write(`  oftStore:     ${RETIRED_AKITA_B1_SHARE_MESH.oftStore}\n`)
  process.stdout.write(`  share mint:   ${RETIRED_AKITA_B1_SHARE_MESH.shareMeshMint} (standard SPL)\n`)
  process.stdout.write(`  peer bytes32: ${RETIRED_AKITA_B1_SHARE_MESH.peerBytes32}\n`)

  const b2MeshChecks = checkFreshB2MeshInputs()
  printSection('Fresh AKITA B2 mesh identity', b2MeshChecks)
  const phase1Only = hasFlag('--phase1-only')
  if (phase1Only) {
    process.stdout.write(
      'Phase-1-only mode: fresh B2 mesh identity is a documented continuation gate, not a Base Phase 1 blocker.\n',
    )
  }

  const strategyChecks = await checkStrategyEntitlements()
  printSection('Creator entitlements (DB)', strategyChecks)

  process.stdout.write('\n--- Your checklist (before you launch deploy) ---\n')
  process.stdout.write('  1. Execution-ready wallet (parent CSW + embedded owner on app track)\n')
  process.stdout.write('  2. ≥50,000,000 AKITA creator tokens approved for vault deposit\n')
  process.stdout.write('  3. **`vault_full_deploy`** active/pending (or equivalent comp: charm + ajna + solana_ovault_mesh)\n')
  process.stdout.write('  4. Optional fork dry-run: pnpm -C frontend run dev:deploy-dry-run\n')
  process.stdout.write('  5. Launch at https://app.4626.fun/deploy/vault with AKITA creator coin\n')
  process.stdout.write('  6. Use a NEW deploymentVersion salt (not grandfathered addresses)\n')

  process.stdout.write('\n--- After Phase 1 (new ShareOFT address known) — operator ---\n')
  process.stdout.write('  • LZ Base init-config + wire on the NEW CreatorShareOFT (symbol ■AKITA)\n')
  process.stdout.write('  • Safe: configureTokenMesh on OVaultHubComposer\n')
  process.stdout.write('  • Vultr: update SOLANA_SHARE_OFT_MAPPING to new ShareOFT + share mesh mint; restart orchestrator\n')
  process.stdout.write('  • Update AKITA_DEFAULTS + keeper backfill + Vercel env\n')
  process.stdout.write('  • Docs: docs/operations/akita-full-stack-prelaunch.md\n')

  if (hasFlag('--grant-comp')) {
    process.stdout.write('\n--- Grant strategy comp ---\n')
    const grantArgs = [
      'exec',
      'tsx',
      'scripts/grant-creator-strategy-comp.ts',
      `--creator=${AKITA_CREATOR}`,
      '--features=vault_full_deploy',
    ]
    if (hasFlag('--execute')) grantArgs.push('--execute', '--confirm=GRANT-STRATEGY-COMP')
    const grant = run('pnpm', ['-C', 'frontend', ...grantArgs], REPO_ROOT)
    process.stdout.write(`${grant.ok ? '✓' : '✗'} grant_comp: ${grant.detail}\n`)
  }

  const blocking = [
    ...platform,
    ...vultrVercel,
    ...strategyChecks,
    ...(phase1Only ? [] : b2MeshChecks),
  ]
  const platformOk = blocking.every((c) => c.ok)

  process.stdout.write('\n')
  if (platformOk) {
    process.stdout.write(
      phase1Only
        ? 'BASE PHASE 1 GATES PASS — use a Phase-1-only deploy session. B2 remains blocked pending a fresh Token-2022 mint/OFT Store.\n\n'
        : 'ALL CONFIGURATION GATES PASS — live onchain B2 canary gates are still required before production relay enablement.\n\n',
    )
    process.exit(0)
  }

  const failed = blocking.filter((c) => !c.ok).map((c) => c.id)
  process.stdout.write(`Blockers: ${failed.join(', ')}\n\n`)
  process.exit(1)
}

main().catch((err) => {
  process.stdout.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
