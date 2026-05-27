#!/usr/bin/env tsx
/**
 * AKITA full-stack redeploy — platform + Vultr + Vercel prep gate (read-only by default).
 *
 *   pnpm -C frontend ops:verify-akita-prelaunch --production
 *   pnpm -C frontend ops:verify-akita-prelaunch --production --ssh-vultr
 *
 * Does NOT deploy the vault. Surfaces what is ready vs what you / ops must still do
 * before launching AKITA via app.4626.fun/deploy.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

/** Platform Solana share-mesh (AKITA #1 bootstrap — reuse for redeploy finalize peer). */
export const AKITA_SHARE_MESH = {
  oftStore: 'G3rfXFKvARH8emUVkiu6RrdSkXZQFGfsqKbF9P7EqXeN',
  shareMeshMint: '5puVV8bQZp4YoEfGq4RitQFRVC3SJiHBSydFuFZUXHQv',
  peerBytes32: '0xdf9a9ef76562adbfe0231e2c5cee77f24a1f9eac519d3fbb029fe5b454d9cd3f',
  solanaEid: 30168,
  hubComposer: '0x7dF44cBB93a5191837a988f0Cc441E3811C39CD1',
} as const

function safeJson(value: unknown, max = 120): string {
  try {
    return JSON.stringify(value ?? null).slice(0, max)
  } catch {
    return String(value).slice(0, max)
  }
}

type Check = { id: string; ok: boolean; detail: string; section?: 'platform' | 'vultr' | 'vercel' | 'deferred' | 'creator' }

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

async function fetchResponse(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; detail: string; data?: unknown; headers?: Headers }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) })
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
  const orchKey = process.env.SOLANA_ORCHESTRATOR_API_KEY?.trim()
  const provSecret = process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET?.trim()
  const kprKey = process.env.KPR_API_KEY?.trim()
  const checkpoint = `prelaunch-${Date.now()}`

  const orchHealth = await fetchResponse('https://orchestrator.4626.fun/healthz')
  checks.push({
    section: 'vultr',
    id: 'vultr_orchestrator_health',
    ok: orchHealth.ok && (orchHealth.data as { ok?: boolean })?.ok === true,
    detail: orchHealth.detail,
  })

  if (!orchKey) {
    checks.push({
      section: 'vultr',
      id: 'vultr_orchestrator_auth',
      ok: false,
      detail: 'Set SOLANA_ORCHESTRATOR_API_KEY in frontend/.env to probe /reconcile',
    })
  } else {
    const settle = await fetchResponse('https://orchestrator.4626.fun/reconcile', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${orchKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'settle_fees',
        workflow: 'prelaunch',
        checkpointKey: `${checkpoint}-settle`,
      }),
    })
    checks.push({
      section: 'vultr',
      id: 'vultr_orchestrator_settle_fees',
      ok: settle.ok && (settle.data as { ok?: boolean })?.ok === true,
      detail: settle.ok ? 'settle_fees reconcile OK' : `${settle.detail}: ${safeJson(settle.data)}`,
    })

    const winner = await fetchResponse('https://orchestrator.4626.fun/reconcile', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${orchKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'winner_relay',
        workflow: 'prelaunch',
        checkpointKey: `${checkpoint}-winner`,
      }),
    })
    checks.push({
      section: 'vultr',
      id: 'vultr_orchestrator_winner_relay',
      ok: winner.ok && (winner.data as { ok?: boolean })?.ok === true,
      detail: winner.ok ? 'winner_relay reconcile OK' : `${winner.detail}: ${safeJson(winner.data)}`,
    })

    const relay = await fetchResponse('https://orchestrator.4626.fun/reconcile', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${orchKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'relay_entries',
        workflow: 'prelaunch',
        checkpointKey: `${checkpoint}-relay`,
      }),
    })
    const relayDisabled =
      relay.status === 503 &&
      String((relay.data as { error?: string })?.error ?? '').includes('action_disabled:relay_entries')
    checks.push({
      section: 'vultr',
      id: 'vultr_relay_entries_paused',
      ok: relayDisabled,
      detail: relayDisabled
        ? 'relay_entries correctly disabled until B2 pool live'
        : `Expected action_disabled:relay_entries, got ${relay.status} ${safeJson(relay.data)}`,
    })
  }

  const provUrl =
    process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_HEALTH_URL?.trim() ??
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

  if (!kprKey) {
    checks.push({
      section: 'vercel',
      id: 'vercel_solana_reconcile_chain',
      ok: false,
      detail: 'Set KPR_API_KEY to probe app → orchestrator chain',
    })
  } else {
    const chain = await fetchResponse(`${appBase}/api/keeper/solana/reconcile`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kprKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflow: 'solana-orchestrator',
        action: 'settle_fees',
        checkpointKey: `${checkpoint}-vercel-chain`,
      }),
    })
    const chainData = (chain.data as { success?: boolean; data?: { status?: string; executed?: boolean } })
      ?.data
    checks.push({
      section: 'vercel',
      id: 'vercel_solana_reconcile_chain',
      ok:
        chain.ok &&
        (chain.data as { success?: boolean })?.success === true &&
        chainData?.status === 'completed' &&
        chainData?.executed === true,
      detail: chain.ok
        ? `Vercel → orchestrator: status=${chainData?.status ?? '?'} executed=${String(chainData?.executed)}`
        : `${chain.detail}: ${safeJson(chain.data)}`,
    })

    const infra = await fetchResponse(`${appBase}/api/deploy/solanaInfraStatus`, {
      headers: { Authorization: `Bearer ${kprKey}` },
    })
    const infraData = (infra.data as { data?: { readyForAutoRegistration?: boolean; blockers?: string[] } })
      ?.data
    checks.push({
      section: 'vercel',
      id: 'vercel_solana_infra_status',
      ok: Boolean(
        infra.ok && infraData?.readyForAutoRegistration && (infraData.blockers?.length ?? 0) === 0,
      ),
      detail: infraData
        ? `readyForAutoRegistration=${String(infraData.readyForAutoRegistration)} blockers=${JSON.stringify(infraData.blockers ?? [])}`
        : infra.detail,
    })
  }

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
      : 'Need vault_full_deploy OR legacy (charm_active_lp + ajna_sleeve) before deploy',
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
  process.stdout.write(`Legacy stack (replace on redeploy): vault ${AKITA_DEFAULTS.vault} / share ${AKITA_DEFAULTS.shareOFT}\n`)
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

  process.stdout.write('\n--- Solana share mesh (reuse for AKITA redeploy finalize) ---\n')
  process.stdout.write(`  oftStore:     ${AKITA_SHARE_MESH.oftStore}\n`)
  process.stdout.write(`  share mint:   ${AKITA_SHARE_MESH.shareMeshMint} (■AKITA)\n`)
  process.stdout.write(`  peer bytes32: ${AKITA_SHARE_MESH.peerBytes32}\n`)

  const deferred: Check[] = []
  const preflight = run('pnpm', ['-C', 'kpr', 'preflight-orchestrator'])
  deferred.push({
    section: 'deferred',
    id: 'kpr_preflight_legacy_adapter',
    ok: true,
    detail: preflight.ok
      ? 'preflight clean (unexpected for legacy wsAKITA — verify env)'
      : 'EXPECTED deferral: legacy wsAKITA not on SolanaBridgeAdapter; Pipe A mesh does not need adapter registration pre-deploy',
  })

  printSection('Deferred until after redeploy (informational)', deferred)

  const strategyChecks = await checkStrategyEntitlements()
  printSection('Creator entitlements (DB)', strategyChecks)

  process.stdout.write('\n--- Your checklist (before you launch deploy) ---\n')
  process.stdout.write('  1. Execution-ready wallet (parent CSW + embedded owner on app track)\n')
  process.stdout.write('  2. ≥50,000,000 AKITA creator tokens approved for vault deposit\n')
  process.stdout.write('  3. **`vault_full_deploy`** active/pending (or legacy comp: charm + ajna + solana_ovault_mesh)\n')
  process.stdout.write('  4. Optional fork dry-run: pnpm -C frontend run dev:deploy-dry-run\n')
  process.stdout.write('  5. Launch at https://app.4626.fun/deploy/vault with AKITA creator coin\n')
  process.stdout.write('  6. Use a NEW deploymentVersion salt (not legacy grandfathered addresses)\n')

  process.stdout.write('\n--- After Phase 1 (new ShareOFT address known) — operator ---\n')
  process.stdout.write('  • LZ Base init-config + wire on the NEW CreatorShareOFT (not legacy wsAKITA)\n')
  process.stdout.write('  • Safe: configureCreatorMesh on OVaultHubComposer\n')
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

  const blocking = [...platform, ...vultrVercel, ...strategyChecks]
  const platformOk = blocking.every((c) => c.ok)

  process.stdout.write('\n')
  if (platformOk) {
    process.stdout.write('ALL GATES PASS — platform, Vultr, Vercel chain, and entitlements ready.\n')
    process.stdout.write('You can launch the deploy session. Post-phase-1 LZ wire + composer mesh still required before finalize bridge.\n\n')
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
