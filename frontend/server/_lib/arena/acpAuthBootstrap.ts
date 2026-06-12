import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

import { logger } from '../infra/logger.js'
import { readArenaConfig, type ArenaConfig } from './arenaConfig.js'

const execFileAsync = promisify(execFile)

declare const process: {
  env: Record<string, string | undefined>
  cwd: () => string
}

/**
 * ACP auth bootstrap for the Railway Hermit container.
 *
 * acp-cli keeps three pieces of signing state on the local filesystem:
 *   1. `$ACP_CONFIG_DIR/config.json` (active wallet, agent ids, signer publicKey)
 *   2. cross-keychain token store (access/refresh tokens; file backend on headless Linux)
 *   3. the P256 signer private key written by `acp agent add-signer` (native keystore,
 *      file backend on headless Linux) — this one CANNOT be regenerated headlessly,
 *      it requires one-time human approval via a signer URL.
 *
 * All three live under the process home dir, so persistence across redeploys is
 * achieved by pointing `ARENA_ACP_HOME` at a Railway volume mount and running every
 * acp/dgclaw child process with HOME (and ACP_CONFIG_DIR) set to that path.
 *
 * This bootstrap, run once at Hermit startup:
 *   - ensures the state dir exists
 *   - probes auth via `acp agent whoami --json`
 *   - if unauthenticated and ACP_ACCESS_TOKEN/ACP_REFRESH_TOKEN/ACP_OWNER_WALLET are
 *     present, seeds the token store via headless `acp configure --json`
 *   - ensures the configured ARENA_AGENT_ID is the active agent (`acp agent use`)
 *   - reports signer readiness (publicKey present in config.json) with operator
 *     guidance when the one-time `add-signer` approval is still missing
 */

export type AcpBootstrapStep = {
  step: 'whoami' | 'configure' | 'agent_use' | 'whoami_recheck'
  ok: boolean
  detail?: string
}

export type AcpAuthBootstrapResult = {
  attempted: boolean
  reason?: string
  stateDir: string | null
  statePersistent: boolean
  authenticated: boolean
  configuredFromEnv: boolean
  activeAgentEnsured: boolean
  signerReady: boolean
  steps: AcpBootstrapStep[]
}

type AcpCliJson = Record<string, unknown> & {
  error?: string
  code?: string
  recovery?: string
}

const BOOTSTRAP_COMMAND_TIMEOUT_MS = 30_000

/**
 * Env overrides that pin all acp-cli state (config.json, cross-keychain file
 * backend, signer keystore file backend) to the persistent ARENA_ACP_HOME dir.
 * Shared by the bootstrap and by arena child-process command env so trade.ts
 * signing sees the same state the bootstrap prepared.
 */
export function resolveAcpStateEnv(env: Record<string, string | undefined> = process.env): Record<string, string> {
  const stateDir = String(env.ARENA_ACP_HOME ?? '').trim()
  if (!stateDir) return {}
  return {
    HOME: stateDir,
    ACP_CONFIG_DIR: resolve(stateDir, '.config', 'acp'),
  }
}

export function resolveAcpConfigJsonPath(env: Record<string, string | undefined> = process.env): string | null {
  const stateEnv = resolveAcpStateEnv(env)
  if (stateEnv.ACP_CONFIG_DIR) return resolve(stateEnv.ACP_CONFIG_DIR, 'config.json')
  const home = String(env.HOME ?? '').trim()
  if (!home) return null
  return resolve(home, '.config', 'acp', 'config.json')
}

export function parseAcpCliJson(stdout: string): AcpCliJson | null {
  const text = String(stdout ?? '').trim()
  if (!text) return null
  // acp-cli writes one JSON object per line in --json mode; the result is the
  // last parseable line (earlier lines can be progress noise from npx/tsx).
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const parsed = JSON.parse(lines[i]!) as unknown
      if (parsed && typeof parsed === 'object') return parsed as AcpCliJson
    } catch {
      // keep scanning upward
    }
  }
  return null
}

/**
 * Reads the signer publicKey for a wallet from acp-cli's config.json.
 * A non-empty publicKey means `acp agent add-signer` completed (key registered
 * and approved); the private half lives in the keystore next to it.
 */
export function readSignerPublicKey(params: {
  configJsonPath: string | null
  walletAddress: string | null
}): string | null {
  if (!params.configJsonPath || !params.walletAddress) return null
  try {
    if (!existsSync(params.configJsonPath)) return null
    const raw = JSON.parse(readFileSync(params.configJsonPath, 'utf8')) as {
      agents?: Record<string, { publicKey?: string }>
    }
    const agents = raw.agents ?? {}
    for (const [wallet, entry] of Object.entries(agents)) {
      if (wallet.toLowerCase() === params.walletAddress.toLowerCase()) {
        const publicKey = String(entry?.publicKey ?? '').trim()
        return publicKey.length > 0 ? publicKey : null
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Pins cross-keychain to its encrypted file backend for the persistent state dir.
 *
 * Root cause this guards against (observed on Railway): the default keychain
 * backend on a headless container can accept reads and return null instead of
 * throwing NoKeyringError, so acp-cli's keyring fallback never switches to the
 * file backend on reads — `acp configure` writes tokens to the file backend
 * (writes DO throw and fall back) while every later `getToken` silently reads
 * the empty default backend and reports NOT_AUTHENTICATED. Writing
 * `<HOME>/.config/keyring/keyring.config.json` with `defaultBackend: "file"`
 * makes reads and writes deterministic. Never overwrites an existing config.
 */
export function ensureKeyringFileBackendPinned(stateDir: string): { pinned: boolean; detail?: string } {
  const keyringDir = resolve(stateDir, '.config', 'keyring')
  const configPath = resolve(keyringDir, 'keyring.config.json')
  try {
    if (existsSync(configPath)) return { pinned: true, detail: 'already_present' }
    mkdirSync(keyringDir, { recursive: true })
    writeFileSync(configPath, `${JSON.stringify({ defaultBackend: 'file' }, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    })
    return { pinned: true, detail: 'written' }
  } catch (error) {
    return { pinned: false, detail: (error as Error).message }
  }
}

export function hasHeadlessConfigureSeed(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(
    String(env.ACP_ACCESS_TOKEN ?? '').trim() &&
      String(env.ACP_REFRESH_TOKEN ?? '').trim() &&
      String(env.ACP_OWNER_WALLET ?? '').trim(),
  )
}

/**
 * Consumed-seed guard.
 *
 * ACP refresh tokens are single-use: once a seed triplet (access/refresh/owner)
 * has been fed through `acp configure`, the CLI's built-in refresh rotates the
 * on-volume tokens and the original env triplet is dead. Re-running configure
 * with the same stale triplet later (e.g. on a restart after the session broke
 * for an unrelated reason, or via the agent-create rotation path) would
 * OVERWRITE the newer rotated tokens on the volume with dead ones — this is
 * exactly how the live Railway session got poisoned in June 2026.
 *
 * After a successful configure we persist a fingerprint of the seed next to
 * config.json. Any later attempt to configure with a triplet matching that
 * fingerprint is refused; the operator must rotate fresh tokens into the
 * ACP_* envs (or run `acp configure` on the volume) instead.
 */

export function computeAcpSeedFingerprint(env: Record<string, string | undefined> = process.env): string | null {
  const access = String(env.ACP_ACCESS_TOKEN ?? '').trim()
  const refresh = String(env.ACP_REFRESH_TOKEN ?? '').trim()
  // Owner wallet is intentionally excluded: the single-use component is the
  // token pair, and callers may resolve the owner from a non-env fallback.
  if (!access || !refresh) return null
  return createHash('sha256').update(`${access}|${refresh}`).digest('hex').slice(0, 32)
}

function resolveConsumedSeedMarkerPath(env: Record<string, string | undefined> = process.env): string | null {
  const stateEnv = resolveAcpStateEnv(env)
  if (!stateEnv.ACP_CONFIG_DIR) return null
  return resolve(stateEnv.ACP_CONFIG_DIR, 'consumed-seed.json')
}

export function readConsumedAcpSeedFingerprint(env: Record<string, string | undefined> = process.env): string | null {
  const markerPath = resolveConsumedSeedMarkerPath(env)
  if (!markerPath) return null
  try {
    if (!existsSync(markerPath)) return null
    const raw = JSON.parse(readFileSync(markerPath, 'utf8')) as { fingerprint?: string }
    const fingerprint = String(raw?.fingerprint ?? '').trim()
    return fingerprint.length > 0 ? fingerprint : null
  } catch {
    return null
  }
}

export function markAcpSeedConsumed(
  fingerprint: string,
  env: Record<string, string | undefined> = process.env,
): { marked: boolean; detail?: string } {
  const markerPath = resolveConsumedSeedMarkerPath(env)
  if (!markerPath) return { marked: false, detail: 'no_persistent_state_dir' }
  try {
    mkdirSync(resolve(markerPath, '..'), { recursive: true })
    writeFileSync(markerPath, `${JSON.stringify({ fingerprint, consumedAt: new Date().toISOString() }, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    })
    return { marked: true }
  } catch (error) {
    return { marked: false, detail: (error as Error).message }
  }
}

/**
 * True when the current env seed triplet has already been consumed by a prior
 * successful configure on this state dir. Reconfiguring with it can only
 * install dead tokens over a (potentially live) rotated session.
 */
export function isEnvSeedConsumed(env: Record<string, string | undefined> = process.env): boolean {
  const fingerprint = computeAcpSeedFingerprint(env)
  if (!fingerprint) return false
  const consumed = readConsumedAcpSeedFingerprint(env)
  return consumed !== null && consumed === fingerprint
}

type RunAcpResult = {
  ok: boolean
  json: AcpCliJson | null
  raw: string
  error?: string
}

async function runAcp(config: ArenaConfig, args: string[]): Promise<RunAcpResult> {
  const stateEnv = resolveAcpStateEnv()
  try {
    const { stdout, stderr } = await execFileAsync(config.acpBin, [...args, '--json'], {
      cwd: config.dgclawDir ?? process.cwd(),
      timeout: BOOTSTRAP_COMMAND_TIMEOUT_MS,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, ...stateEnv },
    })
    const json = parseAcpCliJson(stdout ?? '')
    if (json?.error) {
      return { ok: false, json, raw: String(stdout ?? ''), error: String(json.error) }
    }
    return { ok: true, json, raw: String(stdout ?? '') || String(stderr ?? '') }
  } catch (error) {
    const err = error as { message?: string; stdout?: string; stderr?: string }
    const json = parseAcpCliJson(String(err.stdout ?? ''))
    const message = json?.error ? String(json.error) : (err.message ?? 'acp_command_failed')
    return { ok: false, json, raw: String(err.stdout ?? '') || String(err.stderr ?? ''), error: message }
  }
}

function isAuthError(result: RunAcpResult): boolean {
  const code = String(result.json?.code ?? '')
  const message = `${result.error ?? ''} ${String(result.json?.recovery ?? '')}`.toLowerCase()
  return (
    code === 'AUTH_ERROR' ||
    code === 'UNAUTHENTICATED' ||
    message.includes('not authenticated') ||
    message.includes('acp configure') ||
    message.includes('unauthorized') ||
    message.includes('401')
  )
}

function isNoActiveAgentError(result: RunAcpResult): boolean {
  const code = String(result.json?.code ?? '')
  return code === 'NO_ACTIVE_AGENT' || String(result.error ?? '').toLowerCase().includes('no active agent')
}

export async function runAcpAuthBootstrap(config = readArenaConfig()): Promise<AcpAuthBootstrapResult> {
  const stateEnv = resolveAcpStateEnv()
  const stateDir = stateEnv.HOME ?? null
  const result: AcpAuthBootstrapResult = {
    attempted: false,
    stateDir,
    statePersistent: Boolean(stateDir),
    authenticated: false,
    configuredFromEnv: false,
    activeAgentEnsured: false,
    signerReady: false,
    steps: [],
  }

  if (!config.enabled) {
    result.reason = 'arena_disabled'
    return result
  }
  if (config.dryRun) {
    result.reason = 'arena_dry_run'
    return result
  }

  result.attempted = true

  if (stateDir) {
    try {
      mkdirSync(resolve(stateDir, '.config', 'acp'), { recursive: true })
    } catch (error) {
      result.reason = `acp_state_dir_unwritable:${(error as Error).message}`
      return result
    }
    const keyringPin = ensureKeyringFileBackendPinned(stateDir)
    if (!keyringPin.pinned) {
      logger.warn('[arena] failed to pin keyring file backend (token reads may miss)', {
        stateDir,
        detail: keyringPin.detail,
      })
    }
  }

  // 1. Probe current auth/agent state.
  let whoami = await runAcp(config, ['agent', 'whoami'])
  result.steps.push({ step: 'whoami', ok: whoami.ok, detail: whoami.error })

  // 2. Seed tokens from env if unauthenticated and a seed is available.
  if (!whoami.ok && isAuthError(whoami)) {
    if (hasHeadlessConfigureSeed()) {
      if (isEnvSeedConsumed()) {
        result.reason =
          'seed_already_consumed (the ACP_* env triplet was already used to configure this volume; refresh tokens are single-use so re-seeding cannot help — rotate fresh tokens into ACP_ACCESS_TOKEN/ACP_REFRESH_TOKEN via `acp configure` on a trusted machine, or run `acp configure` directly on the volume)'
        return result
      }
      const configure = await runAcp(config, ['configure'])
      result.steps.push({ step: 'configure', ok: configure.ok, detail: configure.error })
      result.configuredFromEnv = configure.ok
      if (!configure.ok) {
        result.reason = `headless_configure_failed:${configure.error ?? 'unknown'}`
        return result
      }
      const fingerprint = computeAcpSeedFingerprint()
      if (fingerprint) {
        const marked = markAcpSeedConsumed(fingerprint)
        if (!marked.marked && marked.detail !== 'no_persistent_state_dir') {
          logger.warn('[arena] failed to persist consumed-seed marker', { detail: marked.detail })
        }
      }
    } else {
      result.reason = 'unauthenticated_no_seed (set ACP_ACCESS_TOKEN/ACP_REFRESH_TOKEN/ACP_OWNER_WALLET or run `acp configure` once on the volume)'
      return result
    }
  }

  // 3. Ensure the configured agent is the active one.
  const needsAgentUse =
    Boolean(config.agentId) &&
    (!whoami.ok || isNoActiveAgentError(whoami) || String(whoami.json?.id ?? '') !== config.agentId)
  if (needsAgentUse) {
    const use = await runAcp(config, ['agent', 'use', '--agent-id', config.agentId!])
    result.steps.push({ step: 'agent_use', ok: use.ok, detail: use.error })
    result.activeAgentEnsured = use.ok
    if (!use.ok) {
      result.reason = `agent_use_failed:${use.error ?? 'unknown'}`
      return result
    }
    whoami = await runAcp(config, ['agent', 'whoami'])
    result.steps.push({ step: 'whoami_recheck', ok: whoami.ok, detail: whoami.error })
  } else if (whoami.ok) {
    result.activeAgentEnsured = true
  }

  result.authenticated = whoami.ok
  if (!whoami.ok) {
    result.reason = `whoami_failed:${whoami.error ?? 'unknown'}`
    return result
  }

  // 4. Signer readiness — informational, cannot be fixed headlessly.
  const walletAddress =
    config.agentWalletAddress ??
    (typeof whoami.json?.walletAddress === 'string' ? (whoami.json.walletAddress as string) : null)
  const signerPublicKey = readSignerPublicKey({
    configJsonPath: resolveAcpConfigJsonPath(),
    walletAddress,
  })
  result.signerReady = Boolean(signerPublicKey)
  if (!result.signerReady) {
    result.reason =
      'signer_missing (one-time setup: run `acp agent add-signer --agent-id <id> --policy restricted --no-wait --json` on the container with ARENA_ACP_HOME set, approve the signerUrl, then `acp agent signer-status ...`; state persists on the volume)'
  }

  return result
}

export function logAcpAuthBootstrapResult(result: AcpAuthBootstrapResult): void {
  const payload = {
    attempted: result.attempted,
    reason: result.reason ?? null,
    stateDir: result.stateDir,
    statePersistent: result.statePersistent,
    authenticated: result.authenticated,
    configuredFromEnv: result.configuredFromEnv,
    activeAgentEnsured: result.activeAgentEnsured,
    signerReady: result.signerReady,
    steps: result.steps,
  }
  if (!result.attempted) {
    logger.info('[arena] ACP auth bootstrap skipped', payload)
    return
  }
  if (result.authenticated && result.signerReady) {
    logger.info('[arena] ACP auth bootstrap ok — signing ready', payload)
    return
  }
  logger.warn('[arena] ACP auth bootstrap incomplete', payload)
}
