/**
 * AlfaClub Feedback Relayer — Railway-side autonomous submitter.
 *
 * Runs inside the long-lived Eliza runtime on Railway where the Privy
 * delegated-signing context is already warm (used by every XMTP message).
 * Pulls `alfaclub_publications` rows with `kind='erc8004-queued'` and
 * relays each onchain as a UserOp through the canonical Keepr CSW so
 * that `msg.sender` / reviewer address on the ERC-8004 Reputation
 * Registry matches Keepr's published Agent #2205 identity.
 *
 * "Relayer" matches the ERC-4337 mental model: the Vercel cron prepares
 * prepared calldata; the Railway relayer forwards it through the
 * bundler (and paymaster) onto chain.
 *
 * Safety rails baked in:
 *   - KILL_SWITCH halts every tick immediately.
 *   - Relayer is off by default (`ALFACLUB_VIGILANTE_RELAYER_ENABLED=0`).
 *   - Target address is rebuilt from `getReputationRegistryAddress()` every
 *     time — never trusted from the DB row.
 *   - Stored calldata must start with the `giveFeedback` selector or the
 *     row is abandoned (not submitted) — prevents tampered rows from
 *     redirecting to a different registry function.
 *   - Per-tick cap (default 5), per-row attempt cap (default 3), and
 *     a configurable sleep between sends (default 2000ms).
 *   - Submission is strictly serial to keep CSW nonces predictable.
 *   - Dry-run mode runs the Privy owner-context resolve but skips the
 *     actual UserOp send — exercises preflight without spending gas.
 */

import { toFunctionSelector, type Address, type Hex } from 'viem'

import {
  REPUTATION_REGISTRY_ABI,
  getReputationRegistryAddress,
} from '../agent/erc8004.js'
import {
  resolvePrivyCoinbaseSmartWalletOwnerContext,
  sendPrivyCoinbaseSmartWalletUserOperation,
  type CoinbaseSmartWalletCall,
} from '../wallet/privyCoinbaseSmartWallet.js'
import { resolveBundlerUrl } from '../wallet/userOperationSubmitter.js'
import {
  TARGET_CANONICAL_CSW_ADDRESS,
} from '../../../src/wallet/canonicalWalletPolicy.js'
import {
  abandonQueuedFeedback,
  attachErc8004TxHash,
  listQueuedFeedback,
  markSubmissionAttemptFailed,
  type PublicationRecord,
} from './publicationLedger.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'

declare const process: { env: Record<string, string | undefined> }

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

const DEFAULT_INTERVAL_MS = 60_000
const DEFAULT_MAX_PER_TICK = 5
const DEFAULT_SPACING_MS = 2_000
const DEFAULT_MAX_ATTEMPTS = 3

// Precomputed once — matches the giveFeedback ABI in erc8004.ts.
const GIVE_FEEDBACK_SELECTOR = toFunctionSelector(
  'giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)',
)

// ---------------------------------------------------------------------------
// Flag parsing
// ---------------------------------------------------------------------------

function parseBoolFlag(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function parsePositiveIntEnv(key: string, fallback: number, max: number): number {
  const raw = (process.env[key] ?? '').trim()
  if (!/^\d+$/.test(raw)) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, max)
}

export type RelayerFlags = {
  killSwitch: boolean
  relayerEnabled: boolean
  dryRun: boolean
  intervalMs: number
  maxPerTick: number
  spacingMs: number
  maxAttempts: number
}

export function readRelayerFlags(): RelayerFlags {
  return {
    killSwitch: parseBoolFlag(process.env.ALFACLUB_VIGILANTE_KILL_SWITCH),
    relayerEnabled: parseBoolFlag(process.env.ALFACLUB_VIGILANTE_RELAYER_ENABLED),
    dryRun: parseBoolFlag(process.env.ALFACLUB_VIGILANTE_RELAYER_DRY_RUN),
    intervalMs: parsePositiveIntEnv(
      'ALFACLUB_VIGILANTE_RELAYER_INTERVAL_MS',
      DEFAULT_INTERVAL_MS,
      24 * 60 * 60 * 1_000,
    ),
    maxPerTick: parsePositiveIntEnv(
      'ALFACLUB_VIGILANTE_RELAYER_MAX_PER_TICK',
      DEFAULT_MAX_PER_TICK,
      50,
    ),
    spacingMs: parsePositiveIntEnv(
      'ALFACLUB_VIGILANTE_RELAYER_SPACING_MS',
      DEFAULT_SPACING_MS,
      60_000,
    ),
    maxAttempts: parsePositiveIntEnv(
      'ALFACLUB_VIGILANTE_RELAYER_MAX_ATTEMPTS',
      DEFAULT_MAX_ATTEMPTS,
      20,
    ),
  }
}

// ---------------------------------------------------------------------------
// Env preflight
// ---------------------------------------------------------------------------

function resolvePrivyEnv(): {
  walletId: string | null
  appId: string | null
  appSecret: string | null
  authKey: string | null
  bundlerUrl: string | null
} {
  return {
    walletId: (process.env.XMTP_AGENT_PRIVY_WALLET_ID ?? '').trim() || null,
    appId: (process.env.PRIVY_APP_ID ?? '').trim() || null,
    appSecret: (process.env.PRIVY_APP_SECRET ?? '').trim() || null,
    authKey: (process.env.PRIVY_WALLET_AUTHORIZATION_KEY ?? '').trim() || null,
    bundlerUrl: resolveBundlerUrl(),
  }
}

function configuredOwnerIndex(): number | null {
  const raw = (process.env.XMTP_AGENT_CSW_OWNER_INDEX ?? '').trim()
  if (!/^\d+$/.test(raw)) return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RelayerSkipReason =
  | 'kill_switch'
  | 'disabled'
  | 'privy_env_missing'
  | 'owner_context_failed'
  | 'no_queued_rows'

export type RelayerTickResult = {
  picked: number
  submitted: number
  failed: number
  abandoned: number
  skipped: RelayerSkipReason | null
  txHashes: string[]
  errors: Array<{ publicationKey: string; error: string }>
  dryRun: boolean
  ownerAddress: string | null
  ownerIndex: number | null
  durationMs: number
}

export type SubmitCallFn = (params: {
  walletId: string
  smartWallet: Address
  ownerAddress: Address
  ownerIndex: number
  calls: CoinbaseSmartWalletCall[]
  bundlerUrl: string
}) => Promise<{ ok: true; txHash: string } | { ok: false; error: string }>

// ---------------------------------------------------------------------------
// Calldata validation
// ---------------------------------------------------------------------------

/**
 * Strict check: must be 0x-prefixed hex, length >= 10 (selector + at least
 * one byte of args), and the first 4 bytes must match `giveFeedback`.
 */
export function isGiveFeedbackCalldata(value: string | null): value is Hex {
  if (!value || typeof value !== 'string') return false
  if (!/^0x[0-9a-fA-F]+$/.test(value)) return false
  if (value.length < 10) return false
  return value.slice(0, 10).toLowerCase() === GIVE_FEEDBACK_SELECTOR.toLowerCase()
}

// ---------------------------------------------------------------------------
// Default submitter (real Privy + bundler)
// ---------------------------------------------------------------------------

async function defaultSubmitCall(
  params: Parameters<SubmitCallFn>[0],
): ReturnType<SubmitCallFn> {
  try {
    const { createPublicClient, http } = await import('viem')
    const { base } = await import('viem/chains')
    const rpcUrl =
      (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
    const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
    const result = await sendPrivyCoinbaseSmartWalletUserOperation({
      publicClient,
      bundlerUrl: params.bundlerUrl,
      walletId: params.walletId,
      smartWallet: params.smartWallet,
      ownerAddress: params.ownerAddress,
      ownerIndex: params.ownerIndex,
      calls: params.calls,
    })
    return { ok: true, txHash: result.txHash }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message.slice(0, 1_000) }
  }
}

// ---------------------------------------------------------------------------
// One-shot relay
// ---------------------------------------------------------------------------

function emptyResult(
  skipped: RelayerSkipReason,
  dryRun: boolean,
  started: number,
): RelayerTickResult {
  return {
    picked: 0,
    submitted: 0,
    failed: 0,
    abandoned: 0,
    skipped,
    txHashes: [],
    errors: [],
    dryRun,
    ownerAddress: null,
    ownerIndex: null,
    durationMs: Date.now() - started,
  }
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function relayAlfaClubFeedbackOnce(
  opts: {
    flags?: RelayerFlags
    maxPerTick?: number
    dryRun?: boolean
    submitCall?: SubmitCallFn
    listQueued?: (limit: number) => Promise<PublicationRecord[]>
    resolveOwnerContext?: () => Promise<{ ownerAddress: Address; ownerIndex: number }>
  } = {},
): Promise<RelayerTickResult> {
  const started = Date.now()
  const flags = opts.flags ?? readRelayerFlags()
  const dryRun = opts.dryRun ?? flags.dryRun
  const maxPerTick = opts.maxPerTick ?? flags.maxPerTick

  if (flags.killSwitch) return emptyResult('kill_switch', dryRun, started)
  if (!flags.relayerEnabled) return emptyResult('disabled', dryRun, started)

  const env = resolvePrivyEnv()
  if (!env.walletId || !env.appId || !env.appSecret || !env.authKey || !env.bundlerUrl) {
    return emptyResult('privy_env_missing', dryRun, started)
  }

  try {
    await ensureAlfaClubVigilanteSchema()
  } catch {
    // Schema bootstrap best-effort — relay proceeds either way.
  }

  const listQueued = opts.listQueued ?? listQueuedFeedback
  let queued: PublicationRecord[] = []
  try {
    queued = await listQueued(maxPerTick)
  } catch {
    queued = []
  }
  if (queued.length === 0) return emptyResult('no_queued_rows', dryRun, started)

  // Resolve the canonical CSW owner context once per tick — identical wiring
  // to the existing XMTP signer path so Privy/CSW mismatches surface here
  // rather than mid-submit.
  let ownerAddress: Address
  let ownerIndex: number
  try {
    const resolver =
      opts.resolveOwnerContext ??
      (async () => {
        const { createPublicClient, http } = await import('viem')
        const { base } = await import('viem/chains')
        const rpcUrl =
          (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
        const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
        return resolvePrivyCoinbaseSmartWalletOwnerContext({
          publicClient,
          walletId: env.walletId as string,
          smartWallet: TARGET_CANONICAL_CSW_ADDRESS as Address,
          configuredOwnerIndex: configuredOwnerIndex(),
          allowConfiguredOwnerIndexFallback: true,
        })
      })
    const resolved = await resolver()
    ownerAddress = resolved.ownerAddress
    ownerIndex = resolved.ownerIndex
  } catch {
    return emptyResult('owner_context_failed', dryRun, started)
  }

  const submitCall = opts.submitCall ?? defaultSubmitCall
  const registry = getReputationRegistryAddress()

  const txHashes: string[] = []
  const errors: Array<{ publicationKey: string; error: string }> = []
  let submitted = 0
  let failed = 0
  let abandoned = 0

  for (let i = 0; i < queued.length; i += 1) {
    const row = queued[i]!
    const key = row.publicationKey

    // Strict calldata selector validation — anything else is abandoned
    // instead of submitted. Prevents tampered rows from redirecting the
    // call to a different registry function.
    if (!isGiveFeedbackCalldata(row.erc8004Calldata)) {
      abandoned += 1
      errors.push({ publicationKey: key, error: 'invalid_calldata_selector' })
      await abandonQueuedFeedback(key, 'invalid_calldata_selector')
      continue
    }

    if (dryRun) {
      // No submit in dry run, no attempt counter change, no abandon.
      continue
    }

    const result = await submitCall({
      walletId: env.walletId,
      smartWallet: TARGET_CANONICAL_CSW_ADDRESS as Address,
      ownerAddress,
      ownerIndex,
      calls: [
        {
          to: registry,
          data: row.erc8004Calldata as Hex,
          value: 0n,
        },
      ],
      bundlerUrl: env.bundlerUrl,
    })

    if (result.ok) {
      await attachErc8004TxHash(key, result.txHash)
      submitted += 1
      txHashes.push(result.txHash)
    } else {
      failed += 1
      errors.push({ publicationKey: key, error: result.error })
      const nextAttempt = (row.submissionAttempts ?? 0) + 1
      if (nextAttempt >= flags.maxAttempts) {
        await abandonQueuedFeedback(key, result.error)
        abandoned += 1
      } else {
        await markSubmissionAttemptFailed(key, result.error)
      }
    }

    // Polite spacing between sends.
    if (i < queued.length - 1) {
      await sleep(flags.spacingMs)
    }
  }

  return {
    picked: queued.length,
    submitted,
    failed,
    abandoned,
    skipped: null,
    txHashes,
    errors,
    dryRun,
    ownerAddress,
    ownerIndex,
    durationMs: Date.now() - started,
  }
}

// ---------------------------------------------------------------------------
// Background interval
// ---------------------------------------------------------------------------

let activeHandle: ReturnType<typeof setInterval> | null = null
let activeTickPromise: Promise<unknown> | null = null

export type StartRelayerResult = {
  started: boolean
  reason?: RelayerSkipReason | 'already_running'
  intervalMs: number
  stop: () => void
}

/**
 * Start the Railway-side relayer loop. Idempotent: if already running,
 * returns the same `stop()` closure without starting a second interval.
 * The returned `stop()` cancels the interval and waits for any in-flight
 * tick.
 */
export function startAlfaClubFeedbackRelayer(opts?: {
  onTick?: (result: RelayerTickResult) => void
  onError?: (err: unknown) => void
}): StartRelayerResult {
  const flags = readRelayerFlags()
  const stop = (): void => {
    if (activeHandle !== null) {
      clearInterval(activeHandle)
      activeHandle = null
    }
  }

  if (activeHandle !== null) {
    return { started: false, reason: 'already_running', intervalMs: flags.intervalMs, stop }
  }
  if (flags.killSwitch) {
    return { started: false, reason: 'kill_switch', intervalMs: flags.intervalMs, stop }
  }
  if (!flags.relayerEnabled) {
    return { started: false, reason: 'disabled', intervalMs: flags.intervalMs, stop }
  }
  const env = resolvePrivyEnv()
  if (!env.walletId || !env.appId || !env.appSecret || !env.authKey || !env.bundlerUrl) {
    return { started: false, reason: 'privy_env_missing', intervalMs: flags.intervalMs, stop }
  }

  const runTick = async (): Promise<void> => {
    if (activeTickPromise !== null) return // Skip if the previous tick hasn't finished.
    const p = (async () => {
      try {
        const result = await relayAlfaClubFeedbackOnce()
        opts?.onTick?.(result)
      } catch (err) {
        opts?.onError?.(err)
      }
    })()
    activeTickPromise = p
    try {
      await p
    } finally {
      activeTickPromise = null
    }
  }

  activeHandle = setInterval(() => {
    void runTick()
  }, flags.intervalMs)
  if (typeof (activeHandle as { unref?: () => void }).unref === 'function') {
    // Don't keep the event loop alive solely for this interval.
    ;(activeHandle as { unref: () => void }).unref()
  }

  return { started: true, intervalMs: flags.intervalMs, stop }
}

/** Reset internal state for tests only. */
export function _resetAlfaClubRelayerStateForTests(): void {
  if (activeHandle !== null) clearInterval(activeHandle)
  activeHandle = null
  activeTickPromise = null
}

// Exposed selector so tests can assert the same byte string.
export const GIVE_FEEDBACK_FUNCTION_SELECTOR = GIVE_FEEDBACK_SELECTOR

// Re-export for convenience (keeps callers importing a single module).
export { REPUTATION_REGISTRY_ABI }
