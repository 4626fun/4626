/**
 * ElizaOS Keeper Plugin — Observe & Trigger keeper operations
 *
 * Imports keeper action modules directly (same repo, resolved by tsx).
 * Provides two command groups:
 *
 *   Observe (read-only, open to all):
 *     /keepr status     — Vault states (idle funds, last report, deployment threshold)
 *     /keepr auction    — CCA auction states (active, graduated, pending settlement)
 *     /keepr solana     — Solana status (price deviation, pending entries, fee balances)
 *     /keepr health     — Combined health check across all systems
 *
 *   Trigger (admin-only, requires OWNER/ADMIN role):
 *     /keepr tend [vault]       — Force-tend a vault (deploy idle funds)
 *     /keepr report [vault]     — Force-report a vault (harvest yields)
 *     /keepr settle [strategy]  — Force CCA finalization
 *     /keepr settle-fees        — Force Solana fee settlement to Base
 *     /keepr relay-entries      — Force relay of Solana lottery entries to Base
 *     /keepr relay-winners      — Force relay winners to Solana
 *     /keepr graduate           — Force graduation check
 *     /keepr queue              — Force process pending Keepr action queue items
 *
 * Graceful degradation: if required env vars are missing, commands return
 * a helpful "not configured" message instead of crashing.
 */

import type {
  Action,
  Content,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  Plugin,
  State,
} from '@elizaos/core'
import { getKeeprVaultByGroupId } from '../../../../_lib/keepr/keeprRegistry.js'
import { resolveVaultAccessRoleFromVault } from '../../../core/resolveVaultRole.js'

// ---------------------------------------------------------------------------
// Keeper action imports (relative path from frontend/server/agent/eliza/plugins/keeperOps/)
// These resolve at runtime via tsx — keeper modules are ESM in the same repo.
// ---------------------------------------------------------------------------

// We use dynamic imports so the plugin loads even if keeper deps are missing.
// Each handler catches import errors and returns a "not configured" message.

type VaultState = {
  vaultAddress: `0x${string}`
  coinBalance: bigint
  deploymentThreshold: bigint
  minimumTotalIdle: bigint
  totalStrategyWeight: bigint
  lastReport: bigint
  isShutdown: boolean
  paused: boolean
  totalAssets: bigint
  totalAssetsAtLastReport: bigint
  blockTimestamp: bigint
}

type AuctionState = {
  ccaStrategyAddress: `0x${string}`
  currentAuction: `0x${string}`
  hasActiveAuction: boolean
  isGraduated: boolean
}

type BatchKeeperResult = {
  totalVaults: number
  processed: number
  tended: number
  reported: number
  skipped: number
  errors: number
  results: Array<{
    vaultAddress: `0x${string}`
    tended: boolean
    reported: boolean
    skippedReason?: string
  }>
}

type BatchCcaFinalizationResult = {
  totalStrategies: number
  processed: number
  settled: number
  skipped: number
  errors: number
  results: Array<{
    ccaStrategyAddress: `0x${string}`
    swept: boolean
    unsoldSwept: boolean
    skippedReason?: string
  }>
}

type PriceMonitorResult = {
  basePriceUsd: string
  solanaPriceUsd: string
  oracleCreatorPerSol?: string
  solanaCreatorPerSol?: string
  deviationBps: number
  action: 'none' | 'alert' | 'recenter' | 'halt'
}

type EntryRelayResult = {
  entriesQueued: number
  entriesRelayed: number
  overflowCount: number
  emergencyRelay: boolean
}

type FeeSettlementResult = {
  feesSettled: boolean
  amountSettled: string
  bridged: boolean
  forwardedToGauge: boolean
}

type WinnerRelayResult = {
  eventsProcessed: number
  winnersRecorded: number
}

type GraduationResult = {
  baseCCAGraduated: boolean
  alphaVaultClosed: boolean
  deadlineTriggered: boolean
}

type KeeprActionQueueResult = {
  processed: number
  succeeded: number
  failed: number
  retried: number
  actions: Array<{
    id: number
    actionType: string | null
    outcome: 'executed' | 'failed' | 'retry'
    error?: string
  }>
}

type KeeprRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export const KEEPR_WRITE_SUBCOMMAND_PREFIXES = [
  'tend',
  'report',
  'settle',
  'settle-fees',
  'relay-entries',
  'relay-winners',
  'graduate',
  'queue',
] as const

export function isKeeperWriteCommandText(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!normalized.startsWith('/keepr ') && !normalized.startsWith('keepr ')) return false
  const withoutPrefix = normalized.startsWith('/keepr ')
    ? normalized.slice('/keepr '.length).trim()
    : normalized.slice('keepr '.length).trim()
  if (!withoutPrefix) return false
  return KEEPR_WRITE_SUBCOMMAND_PREFIXES.some((cmd) => withoutPrefix.startsWith(cmd))
}

// ---------------------------------------------------------------------------
// Env var checks
// ---------------------------------------------------------------------------

declare const process: { env: Record<string, string | undefined> }

function hasBaseKeeper(): boolean {
  return !!(process.env.KEEPR_PRIVATE_KEY ?? '').trim()
}

function hasBaseRpc(): boolean {
  return !!(process.env.BASE_RPC_URL ?? '').trim()
}

function hasSolana(): boolean {
  return !!(process.env.SOLANA_RPC_URL ?? '').trim()
}

function hasKeeprApi(): boolean {
  return !!(process.env.KEEPR_API_KEY ?? '').trim()
}

function envFlagEnabled(raw: string | undefined): boolean {
  const value = String(raw ?? '').trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

function isDryRunEnabled(): boolean {
  return (
    envFlagEnabled(process.env.ELIZA_KEEPR_DRY_RUN)
    || envFlagEnabled(process.env.ELIZA_CRE_DRY_RUN)
    || envFlagEnabled(process.env.DRY_RUN)
  )
}

// ---------------------------------------------------------------------------
// Dynamic keeper imports (lazy, cached)
// ---------------------------------------------------------------------------

const KEEPR_BASE = '../../../../../../cre'

async function importVaultKeeper() {
  return import(/* @vite-ignore */ `${KEEPR_BASE}/actions/vault-keeper.action.js`)
}

async function importCcaFinalization() {
  return import(/* @vite-ignore */ `${KEEPR_BASE}/actions/cca-finalization.action.js`)
}

async function importKeeprActionQueue() {
  return import(/* @vite-ignore */ `${KEEPR_BASE}/actions/keepr-action-queue.action.js`)
}

async function importRelayEntries() {
  return import(/* @vite-ignore */ `${KEEPR_BASE}/actions/keepr-solana-relay-entries.action.js`)
}

async function importFeeSettlement() {
  return import(/* @vite-ignore */ `${KEEPR_BASE}/actions/keepr-solana-settle-fees.action.js`)
}

async function importWinnerRelay() {
  return import(/* @vite-ignore */ `${KEEPR_BASE}/actions/keepr-solana-winner-relay.action.js`)
}

async function importGraduation() {
  return import(/* @vite-ignore */ `${KEEPR_BASE}/actions/keepr-solana-graduation.action.js`)
}

async function importPriceMonitor() {
  return import(/* @vite-ignore */ `${KEEPR_BASE}/actions/keepr-solana-price-monitor.action.js`)
}

async function importRegistry() {
  return import(/* @vite-ignore */ `${KEEPR_BASE}/utils/registry.js`)
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtTokens(raw: bigint, decimals = 6): string {
  const n = Number(raw) / 10 ** decimals
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function fmtAge(lastReport: bigint, now: bigint): string {
  const diff = Number(now - lastReport)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatVaultState(s: VaultState): string {
  const idle = fmtTokens(s.coinBalance)
  const threshold = fmtTokens(s.deploymentThreshold)
  const total = fmtTokens(s.totalAssets)
  const reportAge = fmtAge(s.lastReport, s.blockTimestamp)
  const strategies = Number(s.totalStrategyWeight) > 0 ? 'active' : 'none'
  const status = s.isShutdown ? 'SHUTDOWN' : s.paused ? 'PAUSED' : 'active'
  const addr = `${s.vaultAddress.slice(0, 8)}...${s.vaultAddress.slice(-6)}`

  return [
    `**${addr}** (${status})`,
    `  Idle: ${idle} | Threshold: ${threshold} | Total: ${total}`,
    `  Last report: ${reportAge} | Strategies: ${strategies}`,
  ].join('\n')
}

function formatAuctionState(s: AuctionState): string {
  const addr = `${s.ccaStrategyAddress.slice(0, 8)}...${s.ccaStrategyAddress.slice(-6)}`
  const status = s.isGraduated ? 'GRADUATED' : s.hasActiveAuction ? 'active' : 'no auction'
  return `**${addr}** — ${status}`
}

function formatPriceMonitor(r: PriceMonitorResult): string {
  const lines = [
    `**Price Monitor**`,
    `  Base oracle: $${r.basePriceUsd}`,
    ...(r.oracleCreatorPerSol ? [`  Oracle implied: ${r.oracleCreatorPerSol} creator / 1 SOL`] : []),
    `  Solana DLMM: $${r.solanaPriceUsd}`,
    ...(r.solanaCreatorPerSol ? [`  DLMM implied: ${r.solanaCreatorPerSol} creator / 1 SOL`] : []),
    `  Deviation: ${r.deviationBps} bps`,
    `  Action: ${r.action}`,
  ]
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Observe action
// ---------------------------------------------------------------------------

const keeprObserveAction: Action = {
  name: 'KEEPR_OBSERVE',
  similes: ['keepr status', 'keepr health', 'keepr auction', 'keepr solana', 'keeper status'],
  description: 'Show keeper status — vault states, auction states, Solana health, or combined health check.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    if (!text.startsWith('/keepr ')) return false
    const sub = text.slice('/keepr '.length).trim()
    return ['status', 'health', 'auction', 'solana'].some((cmd) => sub.startsWith(cmd))
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    const sub = text.slice('/keepr '.length).trim()

    try {
      if (sub.startsWith('status') || sub.startsWith('health')) {
        await handleObserveStatus(callback, sub.startsWith('health'))
      } else if (sub.startsWith('auction')) {
        await handleObserveAuction(callback)
      } else if (sub.startsWith('solana')) {
        await handleObserveSolana(callback)
      }
    } catch (err: any) {
      await callback?.({ text: `keeper observe error: ${err.message}` } as Content)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/keepr status' } },
      { name: 'agent', content: { text: 'Keeper Vault Status\n...' } },
    ],
    [
      { name: 'user', content: { text: '/keepr health' } },
      { name: 'agent', content: { text: 'Keeper Health Check\n...' } },
    ],
  ],
}

async function handleObserveStatus(callback: HandlerCallback | undefined, includeAll: boolean): Promise<void> {
  const parts: string[] = ['**Keeper Status**\n']

  // Vault states
  try {
    const registry = await importRegistry()
    const vaults = await registry.fetchActiveVaults()
    if (vaults.length === 0) {
      parts.push('No active vaults registered.\n')
    } else {
      const vk = await importVaultKeeper()
      parts.push(`**Vaults (${vaults.length}):**`)
      for (const v of vaults.slice(0, 10)) {
        try {
          const state: VaultState = await vk.readVaultStateForAddress(v.vaultAddress as `0x${string}`)
          parts.push(formatVaultState(state))
        } catch (err: any) {
          parts.push(`  ${v.vaultAddress.slice(0, 10)}... — error: ${err.message}`)
        }
      }
      if (vaults.length > 10) parts.push(`  ... and ${vaults.length - 10} more`)
    }
  } catch (err: any) {
    if (err.message?.includes('Cannot find module') || err.message?.includes('KEEPR_API')) {
      parts.push('Vault status: not configured (missing KEEPR_API_KEY or keeper modules)')
    } else {
      parts.push(`Vault status error: ${err.message}`)
    }
  }

  if (includeAll) {
    // Auction states
    parts.push('')
    try {
      const registry = await importRegistry()
      const vaults = await registry.fetchActiveVaults()
      const withCCA = vaults.filter((v: any) => v.ccaStrategyAddress)
      if (withCCA.length > 0) {
        const as = await importCcaFinalization()
        parts.push(`**Auctions (${withCCA.length}):**`)
        for (const v of withCCA.slice(0, 10)) {
          try {
            const state: AuctionState = await as.readAuctionStateForAddress(v.ccaStrategyAddress as `0x${string}`)
            parts.push(`  ${formatAuctionState(state)}`)
          } catch (err: any) {
            parts.push(`  ${v.ccaStrategyAddress.slice(0, 10)}... — error: ${err.message}`)
          }
        }
      } else {
        parts.push('No CCA strategies registered.')
      }
    } catch {
      parts.push('Auction status: not available')
    }

    // Solana
    if (hasSolana()) {
      parts.push('')
      try {
        const pm = await importPriceMonitor()
        const result: PriceMonitorResult = await pm.executeSolanaPriceMonitor()
        parts.push(formatPriceMonitor(result))
      } catch (err: any) {
        parts.push(`Solana price monitor error: ${err.message}`)
      }
    } else {
      parts.push('\nSolana: not configured')
    }
  }

  await callback?.({ text: parts.join('\n') } as Content)
}

async function handleObserveAuction(callback: HandlerCallback | undefined): Promise<void> {
  try {
    const registry = await importRegistry()
    const vaults = await registry.fetchActiveVaults()
    const withCCA = vaults.filter((v: any) => v.ccaStrategyAddress)

    if (withCCA.length === 0) {
      await callback?.({ text: 'No CCA strategies registered.' } as Content)
      return
    }

    const as = await importCcaFinalization()
    const lines = [`**CCA Auction Status (${withCCA.length}):**\n`]

    for (const v of withCCA.slice(0, 15)) {
      try {
        const state: AuctionState = await as.readAuctionStateForAddress(v.ccaStrategyAddress as `0x${string}`)
        lines.push(formatAuctionState(state))
      } catch (err: any) {
        lines.push(`${v.ccaStrategyAddress.slice(0, 10)}... — error: ${err.message}`)
      }
    }

    await callback?.({ text: lines.join('\n') } as Content)
  } catch (err: any) {
    await callback?.({ text: `Auction status error: ${err.message}` } as Content)
  }
}

async function handleObserveSolana(callback: HandlerCallback | undefined): Promise<void> {
  if (!hasSolana()) {
    await callback?.({ text: 'Solana not configured. Set `SOLANA_RPC_URL` to enable.' } as Content)
    return
  }

  const parts = ['**Solana Status**\n']

  try {
    const pm = await importPriceMonitor()
    const result: PriceMonitorResult = await pm.executeSolanaPriceMonitor()
    parts.push(formatPriceMonitor(result))
  } catch (err: any) {
    parts.push(`Price monitor: ${err.message}`)
  }

  await callback?.({ text: parts.join('\n') } as Content)
}

// ---------------------------------------------------------------------------
// Trigger action
// ---------------------------------------------------------------------------

const keeprTriggerAction: Action = {
  name: 'KEEPR_TRIGGER',
  similes: [
    'keepr tend', 'keepr report', 'keepr settle',
    'keepr settle fees', 'keepr settle-fees',
    'keepr relay entries', 'keepr relay-entries',
    'keepr graduate', 'keepr queue',
  ],
  description: 'Trigger keeper operations on demand — tend, report, settle, settle-fees, relay-entries, relay-winners, graduate, queue.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return isKeeperWriteCommandText(text)
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const text = (message.content?.text ?? '').trim()
    const sub = text.slice('/keepr '.length).trim().toLowerCase()
    const dryRunEnabled = isDryRunEnabled()
    const meta = (message.content as any)?.metadata
    const conversationId = String(meta?.conversationId ?? '').trim()
    const senderAddress = String(meta?.senderAddress ?? '').trim().toLowerCase()

    // Parse optional address argument: /keepr tend 0x1234...
    const addressMatch = text.match(/(0x[a-fA-F0-9]{40})/i)
    const address = addressMatch ? addressMatch[1] as `0x${string}` : undefined

    if (dryRunEnabled) {
      const command = sub.split(/\s+/)[0] ?? sub
      const target = address ? ` target=${address}` : ''
      await callback?.({
        text:
          `DRY_RUN is enabled. Skipping mutating keeper command \`/keepr ${command}\`${target}.\n` +
          'Set DRY_RUN=0 and ELIZA_KEEPR_DRY_RUN=0 to execute live operations.',
      } as Content)
      return
    }

    if (!conversationId) {
      await callback?.({ text: 'Could not determine conversation ID.' } as Content)
      return
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(senderAddress)) {
      await callback?.({ text: 'Could not determine sender wallet address.' } as Content)
      return
    }

    const vault = await getKeeprVaultByGroupId(conversationId)
    if (!vault) {
      await callback?.({
        text: 'Vault not configured. /keepr trigger commands require a connected vault.',
      } as Content)
      return
    }
    const role = resolveVaultAccessRoleFromVault({ wallet: senderAddress, vault })
    if (role === 'MEMBER') {
      await callback?.({ text: 'Denied: ADMIN or OWNER only.' } as Content)
      return
    }

    try {
      if (sub.startsWith('tend')) {
        await handleTriggerTend(callback, address)
      } else if (sub.startsWith('report')) {
        await handleTriggerReport(callback, address)
      } else if (sub.startsWith('settle-fees')) {
        await handleTriggerSettleFees(callback)
      } else if (sub.startsWith('settle')) {
        await handleTriggerSettle(callback, address)
      } else if (sub.startsWith('relay-entries')) {
        await handleTriggerRelayEntries(callback)
      } else if (sub.startsWith('relay-winners')) {
        await handleTriggerRelayWinners(callback)
      } else if (sub.startsWith('graduate')) {
        await handleTriggerGraduation(callback)
      } else if (sub.startsWith('queue')) {
        await handleTriggerQueue(callback)
      } else {
        await callback?.({ text: `Unknown keeper trigger: \`${sub}\`. Use \`/keepr help\` for available commands.` } as Content)
      }
    } catch (err: any) {
      await callback?.({ text: `keeper trigger error: ${err.message}` } as Content)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/keepr tend' } },
      { name: 'agent', content: { text: 'Running vault tend...\nTended 2/3 vaults, reported 1.' } },
    ],
    [
      { name: 'user', content: { text: '/keepr settle-fees' } },
      { name: 'agent', content: { text: 'Running Solana fee settlement...\nFees settled: 1,234 tokens, bridged to Base.' } },
    ],
  ],
}

// --- Trigger handlers ---

async function handleTriggerTend(callback: HandlerCallback | undefined, vault?: `0x${string}`): Promise<void> {
  if (!hasBaseKeeper()) {
    await callback?.({ text: 'Keeper wallet not configured. Set `KEEPR_PRIVATE_KEY` to enable.' } as Content)
    return
  }

  await callback?.({ text: `Running vault tend${vault ? ` for ${vault.slice(0, 10)}...` : ' (all vaults)'}...` } as Content)

  const vk = await importVaultKeeper()

  if (vault) {
    const state: VaultState = await vk.readVaultStateForAddress(vault)
    if (!vk.shouldTend(state)) {
      await callback?.({ text: `Vault ${vault.slice(0, 10)}... does not need tending.\n${formatVaultState(state)}` } as Content)
      return
    }
    const result = await vk.executeKeeperForVault(vault)
    await callback?.({ text: `Tend result: ${result.tended ? 'SUCCESS' : 'skipped'}${result.skippedReason ? ` (${result.skippedReason})` : ''}` } as Content)
  } else {
    const result: BatchKeeperResult = await vk.executeKeeper()
    const lines = [
      `**Tend complete**`,
      `  Vaults: ${result.totalVaults} | Tended: ${result.tended} | Reported: ${result.reported}`,
      `  Skipped: ${result.skipped} | Errors: ${result.errors}`,
    ]
    await callback?.({ text: lines.join('\n') } as Content)
  }
}

async function handleTriggerReport(callback: HandlerCallback | undefined, vault?: `0x${string}`): Promise<void> {
  if (!hasBaseKeeper()) {
    await callback?.({ text: 'Keeper wallet not configured. Set `KEEPR_PRIVATE_KEY` to enable.' } as Content)
    return
  }

  await callback?.({ text: `Running vault report${vault ? ` for ${vault.slice(0, 10)}...` : ' (all vaults)'}...` } as Content)

  const vk = await importVaultKeeper()

  if (vault) {
    const result = await vk.executeKeeperForVault(vault)
    await callback?.({ text: `Report result: ${result.reported ? 'SUCCESS' : 'skipped'}${result.skippedReason ? ` (${result.skippedReason})` : ''}` } as Content)
  } else {
    const result: BatchKeeperResult = await vk.executeKeeper()
    const lines = [
      `**Report complete**`,
      `  Vaults: ${result.totalVaults} | Reported: ${result.reported}`,
      `  Skipped: ${result.skipped} | Errors: ${result.errors}`,
    ]
    await callback?.({ text: lines.join('\n') } as Content)
  }
}

async function handleTriggerSettle(callback: HandlerCallback | undefined, strategy?: `0x${string}`): Promise<void> {
  if (!hasBaseKeeper()) {
    await callback?.({ text: 'Keeper wallet not configured. Set `KEEPR_PRIVATE_KEY` to enable.' } as Content)
    return
  }

  await callback?.({ text: `Running CCA finalization${strategy ? ` for ${strategy.slice(0, 10)}...` : ' (all strategies)'}...` } as Content)

  const as = await importCcaFinalization()

  if (strategy) {
    const result = await as.executeCcaFinalizationForStrategy(strategy)
    await callback?.({ text: `CCA finalization: ${result.swept ? 'swept' : 'skipped'}${result.unsoldSwept ? ' + unsold swept' : ''}${result.skippedReason ? ` (${result.skippedReason})` : ''}` } as Content)
  } else {
    const result: BatchCcaFinalizationResult = await as.executeCcaFinalization()
    const lines = [
      `**CCA Finalization complete**`,
      `  Strategies: ${result.totalStrategies} | Settled: ${result.settled}`,
      `  Skipped: ${result.skipped} | Errors: ${result.errors}`,
    ]
    await callback?.({ text: lines.join('\n') } as Content)
  }
}

async function handleTriggerSettleFees(callback: HandlerCallback | undefined): Promise<void> {
  if (!hasSolana()) {
    await callback?.({ text: 'Solana not configured. Set `SOLANA_RPC_URL` to enable.' } as Content)
    return
  }

  await callback?.({ text: 'Running Solana fee settlement...' } as Content)

  const ff = await importFeeSettlement()
  const result: FeeSettlementResult = await ff.executeSolanaFeeSettlement()

  const lines = [
    `**Fee Settlement Result**`,
    `  Fees settled: ${result.feesSettled ? 'yes' : 'no'}`,
    `  Amount: ${result.amountSettled}`,
    `  Bridged: ${result.bridged ? 'yes' : 'no'}`,
    `  Forwarded to gauge: ${result.forwardedToGauge ? 'yes' : 'no'}`,
  ]
  await callback?.({ text: lines.join('\n') } as Content)
}

async function handleTriggerRelayEntries(callback: HandlerCallback | undefined): Promise<void> {
  if (!hasSolana()) {
    await callback?.({ text: 'Solana not configured. Set `SOLANA_RPC_URL` to enable.' } as Content)
    return
  }

  await callback?.({ text: 'Relaying Solana entries...' } as Content)

  const er = await importRelayEntries()
  const result: EntryRelayResult = await er.executeSolanaRelayEntries()

  const lines = [
    `**Entry Relay Result**`,
    `  Entries queued: ${result.entriesQueued}`,
    `  Entries relayed: ${result.entriesRelayed}`,
    `  Overflow: ${result.overflowCount}`,
    `  Emergency relay: ${result.emergencyRelay ? 'YES' : 'no'}`,
  ]
  await callback?.({ text: lines.join('\n') } as Content)
}

async function handleTriggerRelayWinners(callback: HandlerCallback | undefined): Promise<void> {
  if (!hasSolana()) {
    await callback?.({ text: 'Solana not configured. Set `SOLANA_RPC_URL` to enable.' } as Content)
    return
  }

  await callback?.({ text: 'Running Solana winner relay...' } as Content)

  const wr = await importWinnerRelay()
  const result: WinnerRelayResult = await wr.executeSolanaWinnerRelay()

  const lines = [
    `**Winner Relay Result**`,
    `  Events processed: ${result.eventsProcessed}`,
    `  Winners recorded: ${result.winnersRecorded}`,
  ]
  await callback?.({ text: lines.join('\n') } as Content)
}

async function handleTriggerGraduation(callback: HandlerCallback | undefined): Promise<void> {
  if (!hasSolana()) {
    await callback?.({ text: 'Solana not configured. Set `SOLANA_RPC_URL` to enable.' } as Content)
    return
  }

  await callback?.({ text: 'Running graduation check...' } as Content)

  const gr = await importGraduation()
  const result: GraduationResult = await gr.executeSolanaGraduation()

  const lines = [
    `**Graduation Result**`,
    `  Base CCA graduated: ${result.baseCCAGraduated ? 'yes' : 'no'}`,
    `  Alpha Vault closed: ${result.alphaVaultClosed ? 'yes' : 'no'}`,
    `  Deadline triggered: ${result.deadlineTriggered ? 'yes' : 'no'}`,
  ]
  await callback?.({ text: lines.join('\n') } as Content)
}

async function handleTriggerQueue(callback: HandlerCallback | undefined): Promise<void> {
  if (!hasKeeprApi()) {
    await callback?.({ text: 'Keepr API not configured. Set `KEEPR_API_KEY` to enable.' } as Content)
    return
  }

  await callback?.({ text: 'Processing pending Keepr action queue items...' } as Content)

  const qe = await importKeeprActionQueue()
  const result: KeeprActionQueueResult = await qe.executeKeeprActionQueue()

  const lines = [
    `**Keepr Action Queue Result**`,
    `  Processed: ${result.processed}`,
    `  Succeeded: ${result.succeeded}`,
    `  Failed: ${result.failed}`,
    `  Retried: ${result.retried}`,
  ]

  if (result.actions.length > 0) {
    lines.push(`\n**Actions:**`)
    for (const a of result.actions.slice(0, 10)) {
      lines.push(`  #${a.id} ${a.actionType ?? 'unknown'} → ${a.outcome}${a.error ? ` (${a.error})` : ''}`)
    }
    if (result.actions.length > 10) lines.push(`  ... and ${result.actions.length - 10} more`)
  }

  await callback?.({ text: lines.join('\n') } as Content)
}

// ---------------------------------------------------------------------------
// Help action
// ---------------------------------------------------------------------------

const keeprHelpAction: Action = {
  name: 'KEEPR_HELP',
  similes: ['keepr help', 'keepr commands'],
  description: 'Show available keeper commands.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text === '/keepr' || text === '/keepr help' || text === '/keepr commands'
  },

  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const baseConfigured = hasBaseKeeper() ? 'yes' : 'no'
    const solanaConfigured = hasSolana() ? 'yes' : 'no'
    const apiConfigured = hasKeeprApi() ? 'yes' : 'no'
    const dryRun = isDryRunEnabled() ? 'yes' : 'no'

    const helpText = [
      '**Keeper Commands**\n',
      '**Observe (read-only):**',
      '  `/keepr status` — Vault states (idle funds, last report)',
      '  `/keepr auction` — CCA auction states',
      '  `/keepr solana` — Solana price deviation & health',
      '  `/keepr health` — Combined health check\n',
      '**Trigger (execute operations):**',
      '  `/keepr tend [vault]` — Deploy idle funds',
      '  `/keepr report [vault]` — Harvest yields',
      '  `/keepr settle [strategy]` — Run CCA finalization',
      '  `/keepr settle-fees` — Settle Solana fees to Base',
      '  `/keepr relay-entries` — Relay lottery entries from Solana',
      '  `/keepr relay-winners` — Relay winners to Solana',
      '  `/keepr graduate` — Check graduation status',
      '  `/keepr queue` — Process pending queue actions\n',
      `**Config:** Base keeper: ${baseConfigured} | Solana: ${solanaConfigured} | API: ${apiConfigured} | Dry run: ${dryRun}`,
    ]

    await callback?.({ text: helpText.join('\n') } as Content)
  },

  examples: [
    [
      { name: 'user', content: { text: '/keepr help' } },
      { name: 'agent', content: { text: 'Keeper Commands\n...' } },
    ],
  ],
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

export const keeprOpsPlugin: Plugin = {
  name: '@4626/plugin-keepr',
  description: 'Keeper operations — observe vault/auction/Solana status and trigger keeper actions on demand.',
  actions: [keeprHelpAction, keeprObserveAction, keeprTriggerAction],
}

export default keeprOpsPlugin
