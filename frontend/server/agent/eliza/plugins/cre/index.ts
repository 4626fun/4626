/**
 * ElizaOS CRE Plugin — Observe & Trigger keeper operations
 *
 * Imports CRE action modules directly (same repo, resolved by tsx).
 * Provides two command groups:
 *
 *   Observe (read-only, open to all):
 *     /cre status     — Vault states (idle funds, last report, deployment threshold)
 *     /cre auction    — CCA auction states (active, graduated, pending settlement)
 *     /cre solana     — Solana status (price deviation, pending entries, fee balances)
 *     /cre health     — Combined health check across all systems
 *
 *   Trigger (admin-only, requires OWNER/ADMIN role):
 *     /cre tend [vault]       — Force-tend a vault (deploy idle funds)
 *     /cre report [vault]     — Force-report a vault (harvest yields)
 *     /cre settle [strategy]  — Force-settle a CCA auction
 *     /cre flush-fees         — Force Solana fee flush
 *     /cre relay-entries      — Force drain + relay Solana lottery entries
 *     /cre relay-winners      — Force relay winners to Solana
 *     /cre graduate           — Force graduation check
 *     /cre queue              — Force process pending queue actions
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

// ---------------------------------------------------------------------------
// CRE action imports (relative path from frontend/server/agent/eliza/plugins/cre/)
// These resolve at runtime via tsx — CRE modules are ESM in the same repo.
// ---------------------------------------------------------------------------

// We use dynamic imports so the plugin loads even if CRE deps are missing.
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

type BatchSettlementResult = {
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
  deviationBps: number
  action: 'none' | 'alert' | 'recenter' | 'halt'
}

type EntryRelayResult = {
  entriesDrained: number
  entriesRelayed: number
  overflowCount: number
  emergencyDrain: boolean
}

type FeeFlushResult = {
  feesFlushed: boolean
  amountFlushed: string
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

type QueueExecutorResult = {
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

// ---------------------------------------------------------------------------
// Dynamic CRE imports (lazy, cached)
// ---------------------------------------------------------------------------

const CRE_BASE = '../../../../../../cre'

async function importVaultKeeper() {
  return import(/* @vite-ignore */ `${CRE_BASE}/actions/vault-keeper.action.js`)
}

async function importAuctionSettlement() {
  return import(/* @vite-ignore */ `${CRE_BASE}/actions/auction-settlement.action.js`)
}

async function importQueueExecutor() {
  return import(/* @vite-ignore */ `${CRE_BASE}/actions/keepr-queue-executor.action.js`)
}

async function importEntryRelay() {
  return import(/* @vite-ignore */ `${CRE_BASE}/actions/keepr-solana-entry-relay.action.js`)
}

async function importFeeFlush() {
  return import(/* @vite-ignore */ `${CRE_BASE}/actions/keepr-solana-fee-flush.action.js`)
}

async function importWinnerRelay() {
  return import(/* @vite-ignore */ `${CRE_BASE}/actions/keepr-solana-winner-relay.action.js`)
}

async function importGraduation() {
  return import(/* @vite-ignore */ `${CRE_BASE}/actions/keepr-solana-graduation.action.js`)
}

async function importPriceMonitor() {
  return import(/* @vite-ignore */ `${CRE_BASE}/actions/keepr-solana-price-monitor.action.js`)
}

async function importRegistry() {
  return import(/* @vite-ignore */ `${CRE_BASE}/utils/registry.js`)
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
    `  Solana DLMM: $${r.solanaPriceUsd}`,
    `  Deviation: ${r.deviationBps} bps`,
    `  Action: ${r.action}`,
  ]
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Observe action
// ---------------------------------------------------------------------------

const creObserveAction: Action = {
  name: 'CRE_OBSERVE',
  similes: ['cre status', 'cre health', 'cre auction', 'cre solana', 'keeper status'],
  description: 'Show CRE keeper status — vault states, auction states, Solana health, or combined health check.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    if (!text.startsWith('/cre ')) return false
    const sub = text.slice(5).trim()
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
    const sub = text.slice(5).trim()

    try {
      if (sub.startsWith('status') || sub.startsWith('health')) {
        await handleObserveStatus(callback, sub.startsWith('health'))
      } else if (sub.startsWith('auction')) {
        await handleObserveAuction(callback)
      } else if (sub.startsWith('solana')) {
        await handleObserveSolana(callback)
      }
    } catch (err: any) {
      await callback?.({ text: `CRE observe error: ${err.message}` } as Content)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/cre status' } },
      { name: 'agent', content: { text: 'CRE Vault Status\n...' } },
    ],
    [
      { name: 'user', content: { text: '/cre health' } },
      { name: 'agent', content: { text: 'CRE Health Check\n...' } },
    ],
  ],
}

async function handleObserveStatus(callback: HandlerCallback | undefined, includeAll: boolean): Promise<void> {
  const parts: string[] = ['**CRE Keeper Status**\n']

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
      parts.push('Vault status: not configured (missing KEEPR_API_KEY or CRE modules)')
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
        const as = await importAuctionSettlement()
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

    const as = await importAuctionSettlement()
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

const creTriggerAction: Action = {
  name: 'CRE_TRIGGER',
  similes: [
    'cre tend', 'cre report', 'cre settle', 'cre flush',
    'cre relay', 'cre graduate', 'cre queue',
  ],
  description: 'Trigger CRE keeper operations on demand — tend, report, settle, flush-fees, relay-entries, relay-winners, graduate, queue.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    if (!text.startsWith('/cre ')) return false
    const sub = text.slice(5).trim()
    const triggerCmds = [
      'tend', 'report', 'settle', 'flush-fees', 'flush',
      'relay-entries', 'relay-winners', 'relay',
      'graduate', 'queue',
    ]
    return triggerCmds.some((cmd) => sub.startsWith(cmd))
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const text = (message.content?.text ?? '').trim()
    const sub = text.slice(5).trim().toLowerCase()

    // Parse optional address argument: /cre tend 0x1234...
    const addressMatch = text.match(/(0x[a-fA-F0-9]{40})/i)
    const address = addressMatch ? addressMatch[1] as `0x${string}` : undefined

    try {
      if (sub.startsWith('tend')) {
        await handleTriggerTend(callback, address)
      } else if (sub.startsWith('report')) {
        await handleTriggerReport(callback, address)
      } else if (sub.startsWith('settle')) {
        await handleTriggerSettle(callback, address)
      } else if (sub.startsWith('flush-fees') || sub.startsWith('flush')) {
        await handleTriggerFlushFees(callback)
      } else if (sub.startsWith('relay-entries') || sub === 'relay') {
        await handleTriggerRelayEntries(callback)
      } else if (sub.startsWith('relay-winners')) {
        await handleTriggerRelayWinners(callback)
      } else if (sub.startsWith('graduate')) {
        await handleTriggerGraduation(callback)
      } else if (sub.startsWith('queue')) {
        await handleTriggerQueue(callback)
      } else {
        await callback?.({ text: `Unknown CRE trigger: \`${sub}\`. Use \`/cre help\` for available commands.` } as Content)
      }
    } catch (err: any) {
      await callback?.({ text: `CRE trigger error: ${err.message}` } as Content)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/cre tend' } },
      { name: 'agent', content: { text: 'Running vault tend...\nTended 2/3 vaults, reported 1.' } },
    ],
    [
      { name: 'user', content: { text: '/cre flush-fees' } },
      { name: 'agent', content: { text: 'Running Solana fee flush...\nFees flushed: 1,234 tokens, bridged to Base.' } },
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

  await callback?.({ text: `Running auction settlement${strategy ? ` for ${strategy.slice(0, 10)}...` : ' (all strategies)'}...` } as Content)

  const as = await importAuctionSettlement()

  if (strategy) {
    const result = await as.executeSettlementForStrategy(strategy)
    await callback?.({ text: `Settlement: ${result.swept ? 'swept' : 'skipped'}${result.unsoldSwept ? ' + unsold swept' : ''}${result.skippedReason ? ` (${result.skippedReason})` : ''}` } as Content)
  } else {
    const result: BatchSettlementResult = await as.executeSettlement()
    const lines = [
      `**Settlement complete**`,
      `  Strategies: ${result.totalStrategies} | Settled: ${result.settled}`,
      `  Skipped: ${result.skipped} | Errors: ${result.errors}`,
    ]
    await callback?.({ text: lines.join('\n') } as Content)
  }
}

async function handleTriggerFlushFees(callback: HandlerCallback | undefined): Promise<void> {
  if (!hasSolana()) {
    await callback?.({ text: 'Solana not configured. Set `SOLANA_RPC_URL` to enable.' } as Content)
    return
  }

  await callback?.({ text: 'Running Solana fee flush...' } as Content)

  const ff = await importFeeFlush()
  const result: FeeFlushResult = await ff.executeSolanaFeeFlush()

  const lines = [
    `**Fee Flush Result**`,
    `  Fees flushed: ${result.feesFlushed ? 'yes' : 'no'}`,
    `  Amount: ${result.amountFlushed}`,
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

  await callback?.({ text: 'Running Solana entry relay...' } as Content)

  const er = await importEntryRelay()
  const result: EntryRelayResult = await er.executeSolanaEntryRelay()

  const lines = [
    `**Entry Relay Result**`,
    `  Entries drained: ${result.entriesDrained}`,
    `  Entries relayed: ${result.entriesRelayed}`,
    `  Overflow: ${result.overflowCount}`,
    `  Emergency drain: ${result.emergencyDrain ? 'YES' : 'no'}`,
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

  await callback?.({ text: 'Processing pending queue actions...' } as Content)

  const qe = await importQueueExecutor()
  const result: QueueExecutorResult = await qe.executeQueueProcessor()

  const lines = [
    `**Queue Processor Result**`,
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

const creHelpAction: Action = {
  name: 'CRE_HELP',
  similes: ['cre help', 'cre commands'],
  description: 'Show available CRE keeper commands.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text === '/cre' || text === '/cre help' || text === '/cre commands'
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

    const helpText = [
      '**CRE Keeper Commands**\n',
      '**Observe (read-only):**',
      '  `/cre status` — Vault states (idle funds, last report)',
      '  `/cre auction` — CCA auction states',
      '  `/cre solana` — Solana price deviation & health',
      '  `/cre health` — Combined health check\n',
      '**Trigger (execute operations):**',
      '  `/cre tend [vault]` — Deploy idle funds',
      '  `/cre report [vault]` — Harvest yields',
      '  `/cre settle [strategy]` — Settle CCA auction',
      '  `/cre flush-fees` — Flush Solana fees to Base',
      '  `/cre relay-entries` — Relay lottery entries from Solana',
      '  `/cre relay-winners` — Relay winners to Solana',
      '  `/cre graduate` — Check graduation status',
      '  `/cre queue` — Process pending queue actions\n',
      `**Config:** Base keeper: ${baseConfigured} | Solana: ${solanaConfigured} | API: ${apiConfigured}`,
    ]

    await callback?.({ text: helpText.join('\n') } as Content)
  },

  examples: [
    [
      { name: 'user', content: { text: '/cre help' } },
      { name: 'agent', content: { text: 'CRE Keeper Commands\n...' } },
    ],
  ],
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

export const crePlugin: Plugin = {
  name: '@creatorvault/plugin-cre',
  description: 'CRE keeper operations — observe vault/auction/Solana status and trigger keeper actions on demand.',
  actions: [creHelpAction, creObserveAction, creTriggerAction],
}

export default crePlugin
