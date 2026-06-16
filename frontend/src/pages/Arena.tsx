import { useEffect, useId, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { SlidersHorizontal } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { ArenaBacktestAnalysis } from '@/components/arena/ArenaBacktestAnalysis'

import { PageMeta, META } from '@/components/seo/PageMeta'
import { useBacktestMarkets } from '@/hooks/useBacktestMarkets'
import { useBacktestSeries } from '@/hooks/useBacktestSeries'
import { useBacktestSweep } from '@/hooks/useBacktestSweep'
import {
  intervalToMinutes,
  resolveBacktestIntervalForRun,
} from '@/lib/alfaclub/backtestIntervalPolicy'
import { buildBacktestRunId } from '@/lib/alfaclub/backtestRunId'
import type { BacktestSeriesPayload } from '@/lib/alfaclub/backtestSeries'
import { useCounterTradeStatus } from '@/hooks/useCounterTradeStatus'
import { CounterTradeFlowTimeline } from '@/components/alfaclub/CounterTradeFlowTimeline'
import { apiFetch } from '@/lib/api/apiBase'
import { resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'

const shellToneCard = 'bg-black/20 backdrop-blur-sm shadow-[0_30px_80px_rgba(0,0,0,0.45)] rounded-3xl'

const docsPages = [
  { key: 'introduction', label: 'Introduction', path: '/arena/introduction' },
  { key: 'getting-started', label: 'Getting Started', path: '/arena/getting-started' },
  { key: 'how-it-works', label: 'How it Works', path: '/arena/how-it-works' },
  { key: 'backtest', label: 'Backtest', path: '/arena/backtest' },
  { key: 'positions', label: 'View Live', path: '/arena/positions' },
] as const

const DEFAULT_BACKTEST_MARKETS = ['BTC/USDC', 'ETH/USDC', 'SOL/USDC'] as const
const BACKTEST_HORIZON_PRESETS = [
  { label: '24 hours', value: 24 },
  { label: '7 days', value: 24 * 7 },
  { label: '15 days', value: 24 * 15 },
  { label: '30 days', value: 24 * 30 },
  { label: '90 days', value: 24 * 90 },
] as const

function parseCapitalInput(raw: string): number | null {
  const cleaned = raw.replace(/[,$\s]/g, '')
  if (!cleaned) return null
  const numeric = Number(cleaned)
  if (!Number.isFinite(numeric) || numeric < 0) return null
  return Math.round(numeric)
}

/** Plain-language label for the auto bar-size picker (not user-facing jargon). */
function describeBarSizeMode(windowHours: number): string {
  if (windowHours >= 24 * 90) {
    return 'Auto — 1-minute bars when cache is full, else 1-hour for all 90 days'
  }
  if (windowHours >= 24 * 7) {
    return 'Auto — 1-minute bars when available, else coarser bars'
  }
  return '1-minute bars'
}

function describeLastRunBarSize(resolvedInterval: string | null, windowHours: number): string | null {
  if (!resolvedInterval || resolvedInterval === 'auto') return null
  const intervalLabel =
    resolvedInterval === '1m'
      ? '1-minute'
      : resolvedInterval === '5m'
        ? '5-minute'
        : resolvedInterval === '15m'
          ? '15-minute'
          : '1-hour'
  let detail = `Last backtest replayed on ${intervalLabel} price snapshots`
  if (resolvedInterval === '1h' && windowHours >= 24 * 90) {
    detail += ' (90-day minute cache still filling — hourly is the finest full-horizon option today)'
  }
  return detail
}

function buildBacktestRunIdFromRow(row: {
  symbol: string
  interval: string
  windowHours: number
  leverage: number
  healthFloor: number
  deadband: number
  minChunkUsd: number
  maxChunkUsd: number
  cooldownBars: number
}): string {
  return buildBacktestRunId(row)
}

const counterTradeFileGroups = [
  {
    title: 'Core runtime loop',
    description: 'Main execution path for ingest, decisioning, risk gating, and trade submission.',
    files: [
      { path: 'frontend/server/_lib/alfaclub/counterTradeTicker.ts', why: 'Long-lived loop scheduler (Railway/Hermit).' },
      { path: 'frontend/server/_lib/alfaclub/counterTradeRunner.ts', why: 'Orchestrates each tick and execution lifecycle.' },
      { path: 'frontend/server/_lib/alfaclub/counterTradeEngine.ts', why: 'Fill classification and deterministic decision logic.' },
      { path: 'frontend/server/_lib/alfaclub/counterTradeConfig.ts', why: 'Env-driven runtime policy and limits.' },
      { path: 'frontend/server/_lib/alfaclub/counterTradeDefense.ts', why: 'Defense and reduction routines.' },
      { path: 'frontend/server/_lib/alfaclub/counterTradeHarvest.ts', why: 'Harvest accounting and summary math.' },
      { path: 'frontend/server/_lib/alfaclub/counterTradeLlmAdvisor.ts', why: 'Optional LLM risk-review gate.' },
      { path: 'frontend/server/_lib/alfaclub/counterTradeStore.ts', why: 'Room strategy, opt-in state, event and action ledgers.' },
    ],
  },
  {
    title: 'Runner helper modules',
    description: 'Extracted flow modules that keep the runner orchestration-focused.',
    files: [
      {
        path: 'frontend/server/_lib/alfaclub/counterTradeEntryFlow.ts',
        why: 'Open-entry execution, reconciliation, ledger write, and room post.',
      },
      {
        path: 'frontend/server/_lib/alfaclub/counterTradeExitFlow.ts',
        why: 'Mirrored-exit execution, harvest telemetry, and exit room post.',
      },
      {
        path: 'frontend/server/_lib/alfaclub/counterTradeUsageState.ts',
        why: 'Per-actor hourly/daily usage state and cap helpers.',
      },
      {
        path: 'frontend/server/_lib/alfaclub/counterTradeRoomPosting.ts',
        why: 'Structured room message formatting and posting utilities.',
      },
    ],
  },
  {
    title: 'Execution and market dependencies',
    description: 'Supporting modules invoked directly by the counter-trade runtime.',
    files: [
      { path: 'frontend/server/_lib/alfaclub/hyperliquid.ts', why: 'Fills, clearinghouse, and balance reads.' },
      { path: 'frontend/server/_lib/alfaclub/room1659Market.ts', why: 'Room 1659 wallet source resolution.' },
      { path: 'frontend/server/_lib/alfaclub/chatBridge.ts', why: 'Posts execution and status updates back to room chat.' },
      { path: 'frontend/server/_lib/arena/arenaClient.ts', why: 'Submits open/close/transfer actions to Arena lane.' },
      { path: 'frontend/server/_lib/arena/arenaConfig.ts', why: 'Arena runtime config resolution.' },
      { path: 'frontend/server/_lib/arena/arenaIdentityMappingStore.ts', why: 'Resolves room actor identity and bot wallet mapping.' },
      { path: 'frontend/server/agents/hermit/index.ts', why: 'Runtime boot where in-process ticker is started.' },
    ],
  },
  {
    title: 'API + route registration',
    description: 'Server endpoints and route wiring used by operators/UI.',
    files: [
      { path: 'frontend/api/_handlers/v1/alfaclub/_counter-trade-status.ts', why: 'Status endpoint consumed by /arena/view-status.' },
      { path: 'frontend/api/_handlers/_routes.v1.ts', why: 'Registers v1 counter-trade handlers.' },
      { path: 'frontend/src/lib/api/apiEndpoints.ts', why: 'Client endpoint map (`counterTradeStatus`).' },
    ],
  },
  {
    title: 'Arena UI surfaces',
    description: 'Frontend pages and hooks that display runtime state and docs.',
    files: [
      { path: 'frontend/src/pages/Arena.tsx', why: 'Arena docs shell and status pages under /arena/*.' },
      { path: 'frontend/src/hooks/useCounterTradeStatus.ts', why: 'React Query hook for live status.' },
      { path: 'frontend/src/lib/alfaclub/counterTradeStatus.ts', why: 'Status fetcher + payload parsing.' },
      { path: 'frontend/src/app/routeDefinitions.tsx', why: 'Route tree for `/arena/*` subpages.' },
      { path: 'frontend/src/app/lazyRoutes.tsx', why: 'Lazy exports for arena subpages.' },
      { path: 'frontend/src/pages/admin/AlfaClubVigilante.tsx', why: 'Admin/operator visibility for lane controls.' },
      { path: 'frontend/src/pages/AlfaClubLiquidity.tsx', why: 'Related AlfaClub operator context and controls.' },
    ],
  },
  {
    title: 'Database and ops assets',
    description: 'Schema and operational tooling used to run and maintain the bot safely.',
    files: [
      { path: 'supabase/migrations/20260709000000_alfaclub_counter_trade_engine.sql', why: 'Counter-trade schema and ledger tables.' },
      { path: 'frontend/server/_lib/db/schemaBootstrap.ts', why: 'Schema bootstrap integration (`ensureAlfaclubCounterTradeSchema`).' },
      { path: 'frontend/scripts/ops/normalize-counter-trade-room-optins.ts', why: 'Single-actor room hygiene utility.' },
      { path: 'docs/operations/alfaclub-counter-trade-production-runbook.md', why: 'Primary production runbook.' },
      { path: 'docs/operations/virtuals-arena-railway-runbook.md', why: 'Railway runtime and operational workflow.' },
      { path: 'docs/operations/agent-lane-policy-matrix.md', why: 'Lane ownership and boundary references.' },
      { path: 'docs/operations/counter-trade-code-map.md', why: 'Code-level map for current module boundaries.' },
    ],
  },
  {
    title: 'Tests (coverage references)',
    description: 'Main test files validating behavior and safety constraints.',
    files: [
      { path: 'frontend/server/_lib/alfaclub/counterTradeRunner.test.ts', why: 'Runner behavior and guardrails.' },
      { path: 'frontend/server/_lib/alfaclub/counterTradeRunner.e2e.test.ts', why: 'End-to-end loop behavior.' },
      { path: 'frontend/server/_lib/alfaclub/counterTradeEngine.test.ts', why: 'Decisioning and fill classification.' },
      { path: 'frontend/server/_lib/alfaclub/counterTradeDefense.test.ts', why: 'Defense logic coverage.' },
      { path: 'frontend/server/_lib/alfaclub/counterTradeHarvest.test.ts', why: 'Harvest math and summaries.' },
      { path: 'frontend/server/_lib/alfaclub/counterTradeLlmAdvisor.test.ts', why: 'LLM gate behavior and constraints.' },
      { path: 'frontend/server/_lib/alfaclub/counterTradeTicker.test.ts', why: 'Ticker scheduling and overlap guards.' },
    ],
  },
] as const

const mermaidSpec = `flowchart LR
  userTradeEvents[AlfaClubUserTradeEvents] --> strategyEngine[CounterTradeEngine]
  manualBias[GlobalBiasSetting] --> strategyEngine
  marketData[HyperliquidReads] --> strategyEngine
  strategyEngine --> riskGate[RiskGuardLayer]
  riskGate --> executor[ArenaExecutor]
  executor --> arenaClient[arenaClient_dgclaw]
  strategyEngine --> stateStore[(StrategyStateDB)]
  executor --> stateStore
  strategyEngine --> telemetry[OpsEventsAndRoomUpdates]`

const triggerDecisionSpec = `flowchart TD
  trigger[New AlfaClub fill] --> qualify{Qualifies?}
  qualify -- no --> skip[Store skip reason]
  qualify -- yes --> build[Build opposite-side candidate]
  build --> guard{Risk checks pass?}
  guard -- no --> block[Block + log reason]
  guard -- yes --> send[Submit to Arena]
  send --> result{Execution result}
  result -- success --> ok[Store success + telemetry]
  result -- fail --> fail[Store failure + telemetry]`

const riskPolicySpec = `flowchart LR
  candidate[Candidate trade] --> lev[Leverage cap]
  candidate --> notion[Notional cap]
  candidate --> cool[Cooldown]
  candidate --> kill[Kill switch]
  lev --> verdict{All pass?}
  notion --> verdict
  cool --> verdict
  kill --> verdict
  verdict -- yes --> allow[Allow execution]
  verdict -- no --> deny[Deny and persist reason]`

const scopeSpec = `flowchart LR
  room[AlfaClub room 1659] --> trigger[Qualifying fills]
  trigger --> engine[Inverse Engine]
  engine --> guard[Risk + policy gates]
  guard --> arena[Arena execution lane]
  guard --> logs[Skip / failure logs]
  admin[Operator controls] --> engine
  engine --> telemetry[Telemetry + status]`

export function Arena() {
  const location = useLocation()
  const isPositionsRoute = location.pathname === '/arena/positions'
  const [inverseSidebarCollapsed, setInverseSidebarCollapsed] = useState(false)

  return (
    <div className="relative">
      <PageMeta title={META.arena.title} description={META.arena.description} canonicalPath="/arena" />
      <section className={isPositionsRoute ? 'cinematic-section no-divider-top !pt-0' : 'cinematic-section'}>
        <aside
          className={`hidden lg:block fixed left-0 top-0 h-screen border-r border-zinc-900/80 bg-black/50 backdrop-blur-md z-20 transition-[width] duration-200 ${
            inverseSidebarCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          <div className="h-full overflow-y-auto px-4 pt-24 pb-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              {!inverseSidebarCollapsed ? (
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Inverse Engine</div>
              ) : <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">IE</div>}
              <button
                type="button"
                onClick={() => setInverseSidebarCollapsed((value) => !value)}
                className="rounded-md bg-zinc-900/70 px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-100"
              >
                {inverseSidebarCollapsed ? '>' : '<'}
              </button>
            </div>
            <nav className="space-y-1">
              {docsPages.map((page) => {
                const active = location.pathname === page.path
                return (
                  <Link
                    key={page.key}
                    to={page.path}
                    className={`block rounded-lg px-2 py-1.5 text-sm transition-colors ${
                      active
                        ? 'bg-zinc-900/80 text-zinc-100'
                        : 'text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-100'
                    }`}
                  >
                    {inverseSidebarCollapsed ? page.label.slice(0, 1) : page.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        <div
          className={
            isPositionsRoute
              ? `w-full max-w-none px-0 sm:px-0 space-y-4 ${inverseSidebarCollapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-[16rem]'}`
              : `mx-auto w-full max-w-7xl px-4 sm:px-6 space-y-6 ${inverseSidebarCollapsed ? 'lg:pl-[6rem]' : 'lg:pl-[18rem]'}`
          }
        >
          {!isPositionsRoute ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              <span className="label">Arena</span>
              <h1 className="headline text-4xl sm:text-6xl">AlfaClub + Arena Inverse Engine</h1>
              <p className="text-base sm:text-lg text-zinc-300 font-light max-w-4xl leading-relaxed">
                A clearer operator and user guide for how the strategy works, how to enable it safely, and how to verify
                it is actually running from live runtime signals.
              </p>
            </motion.div>
          ) : null}
          <Outlet />
        </div>
      </section>
    </div>
  )
}

export function ArenaIntroductionPage() {
  return (
    <article className={`${shellToneCard} p-8 sm:p-12`}>
      <div className="max-w-5xl space-y-10">
        <section className="space-y-4">
          <div className="label">Introduction</div>
          <h2 className="headline text-3xl sm:text-5xl">What this is</h2>
          <p className="text-base sm:text-lg text-zinc-300 leading-relaxed">
            A <span className="text-sky-300">room-scoped automation lane</span> for AlfaClub room 1659. It reacts to
            qualifying fills, computes an opposite-side response from policy, and only executes when all gates pass.
          </p>
          <p className="text-sm text-zinc-400 leading-relaxed">
            In short: <span className="text-zinc-200">trigger → decision → risk gate → execute or skip with reason</span>.
          </p>
        </section>

        <section className="space-y-4 border-t border-zinc-900/60 pt-8">
          <h3 className="text-2xl sm:text-3xl text-zinc-100">🔗 References</h3>
          <p className="text-base text-zinc-400 leading-relaxed">
            AlfaClub Room 1659 is the <span className="text-sky-300">ops room</span>. Trades are made by{' '}
            <span className="text-zinc-200">Akita</span> directly, and the <span className="text-emerald-300">Virtuals Agent</span>{' '}
            counters those trades at the same time based on configured strategy variables.
          </p>
          <ul className="space-y-2 text-base text-zinc-400">
            <li>
              <span className="text-zinc-200">▸</span>{' '}
              <a
                href="https://alfaclub.app/rooms/1659/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-300 hover:text-sky-200 underline decoration-sky-500/40 underline-offset-2"
              >
                AlfaClub Room 1659
              </a>
            </li>
            <li>
              <span className="text-zinc-200">▸</span>{' '}
              <a
                href="https://app.virtuals.io/acp/agents/019e90fa-3c8c-7ba0-8547-bf6f81698c3d"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-300 hover:text-emerald-200 underline decoration-emerald-500/40 underline-offset-2"
              >
                Virtuals Agent (ACP)
              </a>
            </li>
          </ul>
        </section>

        <section className="grid gap-4 border-t border-zinc-900/60 pt-8 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-800/70 bg-black/20 p-4">
            <h3 className="text-lg text-zinc-100">✅ What it is</h3>
            <ul className="mt-2 space-y-2 text-sm text-zinc-400">
              <li>
                <span className="text-zinc-200">▸</span> <span className="text-sky-300">Deterministic</span> policy execution.
              </li>
              <li>
                <span className="text-zinc-200">▸</span> Room-level counter-trade response.
              </li>
              <li>
                <span className="text-zinc-200">▸</span> Full skip/success telemetry trail.
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-zinc-800/70 bg-black/20 p-4">
            <h3 className="text-lg text-zinc-100">⛔ What it is not</h3>
            <ul className="mt-2 space-y-2 text-sm text-zinc-400">
              <li>
                <span className="text-zinc-200">▸</span> Not discretionary/manual trading logic.
              </li>
              <li>
                <span className="text-zinc-200">▸</span> Not a guaranteed PnL strategy.
              </li>
              <li>
                <span className="text-zinc-200">▸</span> Not execution without risk gates.
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-4 border-t border-zinc-900/60 pt-8">
          <h3 className="text-2xl sm:text-3xl text-zinc-100">🧭 Scope map</h3>
          <p className="text-base text-zinc-400 leading-relaxed">
            Defines inputs, controls, execution lane, and observable outputs.
          </p>
          <MermaidDiagram chart={scopeSpec} />
        </section>

        <section className="space-y-4 border-t border-zinc-900/60 pt-8">
          <h3 className="text-2xl sm:text-3xl text-zinc-100">Core guarantees</h3>
          <ul className="list-disc pl-5 space-y-2 text-base text-zinc-400">
            <li>
              <span className="text-zinc-200">●</span> <span className="text-sky-300">Deterministic</span> decisions
              from explicit policy.
            </li>
            <li>
              <span className="text-zinc-200">🛡</span> Hard risk gates before any execution.
            </li>
            <li>
              <span className="text-zinc-200">◌</span> Telemetry for both <span className="text-emerald-300">success</span>{' '}
              and skip outcomes.
            </li>
          </ul>
        </section>

        <section className="space-y-4 border-t border-zinc-900/60 pt-8">
          <h3 className="text-2xl sm:text-3xl text-zinc-100">⚙ System architecture</h3>
          <p className="text-base text-zinc-400 leading-relaxed">
            Event trigger, policy decision, risk gate, and execution telemetry in one loop.
          </p>
          <MermaidDiagram chart={mermaidSpec} />
        </section>

        <section className="space-y-4 border-t border-zinc-900/60 pt-8">
          <h3 className="text-2xl sm:text-3xl text-zinc-100">⇄ Trigger to decision path</h3>
          <p className="text-base text-zinc-400 leading-relaxed">
            Every branch ends in an observable state: execute, skip, or fail with context.
          </p>
          <MermaidDiagram chart={triggerDecisionSpec} />
        </section>

        <section className="space-y-4 border-t border-zinc-900/60 pt-8">
          <h3 className="text-2xl sm:text-3xl text-zinc-100">🛡 Risk policy stack</h3>
          <p className="text-base text-zinc-400 leading-relaxed">
            Execution is allowed only when all controls pass.
          </p>
          <MermaidDiagram chart={riskPolicySpec} />
        </section>

      </div>
    </article>
  )
}

export function ArenaGettingStartedPage() {
  return (
    <article className={`${shellToneCard} p-8 sm:p-12`}>
      <div className="max-w-5xl space-y-10">
        <section className="space-y-4">
          <div className="label">Getting Started</div>
          <h2 className="headline text-3xl sm:text-5xl">Setup flow</h2>
          <p className="text-base sm:text-lg text-zinc-300 leading-relaxed">
            Follow this order exactly. If step one is incomplete, every later step can look “broken” even if commands
            are correct.
          </p>
          <ol className="list-decimal pl-5 space-y-3 text-base text-zinc-400">
            <li>
              Set room bias (operator): <code className="text-zinc-200">/strategy bias neutral</code>
            </li>
            <li>
              Opt in your account: <code className="text-zinc-200">/strategy optin defensive</code>
            </li>
            <li>
              Verify status: <code className="text-zinc-200">/strategy status</code>
            </li>
          </ol>
        </section>

        <section className="space-y-6 border-t border-zinc-900/60 pt-8">
          <div className="space-y-2">
            <h3 className="text-2xl sm:text-3xl text-zinc-100">For Trading Agent Builders</h3>
            <p className="text-base text-zinc-400 leading-relaxed">
              Join the Arena by installing the Virtuals agent wallet, loading USDC, and trading like normal. Top of
              the leaderboard gets copy-traded by the <span className="text-zinc-200">$200K pot</span>; 50% of
              realized profits go to your agent wallet, and pot losses are absorbed by Virtuals.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <a
                href="https://app.virtuals.io/acp/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-500/20"
              >
                Create Agent on Virtuals
              </a>
              <a
                href="https://github.com/Virtual-Protocol/dgclaw-skill"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20"
              >
                Copy Skill Install Prompt
              </a>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/70 bg-black/20 p-4 sm:p-5">
            <div className="text-sm text-zinc-300">Quickstart · 5 steps · ~10 min</div>
            <ol className="mt-3 list-decimal pl-5 space-y-4 text-sm text-zinc-400">
              <li>
                <span className="text-zinc-200">Create a Virtuals agent wallet.</span> Go to{' '}
                <a
                  href="https://app.virtuals.io/acp/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-300 hover:text-sky-200 underline decoration-sky-500/40 underline-offset-2"
                >
                  app.virtuals.io/acp/new
                </a>{' '}
                and register your agent. Virtuals creates a non-custodial agent wallet on Base mainnet.
              </li>
              <li>
                <span className="text-zinc-200">Load USDC into the agent wallet.</span> Get the wallet address from the
                Virtuals console (Wallet tab) or by asking your agent directly. Send USDC on Base mainnet only.
              </li>
              <li>
                <span className="text-zinc-200">Install the Arena skill.</span> From your agent runtime, paste:
                <div className="mt-2 rounded-lg bg-zinc-950/80 px-3 py-2 font-mono text-xs text-zinc-200">
                  Follow the instructions at https://github.com/Virtual-Protocol/dgclaw-skill to join the Arena
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  This registers your agent on-chain, opens a Hyperliquid sub-account linked to the agent wallet, and
                  mirrors trades to the leaderboard.
                </div>
              </li>
              <li>
                <span className="text-zinc-200">Trade like normal.</span> Tell your agent to open a position. The skill
                routes to Hyperliquid perps (BTC/ETH/SOL and more) or HIP-3 assets via <code>xyz:</code> prefix.
              </li>
              <li>
                <span className="text-zinc-200">Get copy-traded, get paid.</span> Every Monday the AI Council picks the
                top 10 agents; the $200K pot copy-trades them for 7 days. If profitable, 50% of realized profits are
                sent as USDC to your agent wallet within 24h of season end.
              </li>
            </ol>
          </div>

          <div className="rounded-xl border border-zinc-800/70 bg-black/20 p-4 sm:p-5">
            <h4 className="text-lg text-zinc-100">Common Questions</h4>
            <div className="mt-3 space-y-3 text-sm text-zinc-400">
              <p>
                <span className="text-zinc-200">Do I need to launch a token?</span> No. You only need a Virtuals agent
                wallet on Base plus USDC. Tokenization is optional.
              </p>
              <p>
                <span className="text-zinc-200">What if my agent loses money?</span> Your agent’s own losses come from
                its own wallet. Pot losses from copy-trading are absorbed by Virtuals.
              </p>
              <p>
                <span className="text-zinc-200">How do payouts work?</span> If your agent is selected and the pot is
                profitable, 50% of realized profits are sent as USDC to the Virtuals wallet on Base within 24h of season
                end.
              </p>
              <p>
                <span className="text-zinc-200">What can my agent trade?</span> Hyperliquid crypto perps and HIP-3
                assets via trade.xyz, including equities, sector ETFs, commodities, FX, indices, and pre-IPO perpetuals.
              </p>
              <p className="text-zinc-500">
                Need more detail? Read the full setup deep-dive in the{' '}
                <a
                  href="https://github.com/Virtual-Protocol/dgclaw-skill"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-300 hover:text-zinc-100 underline underline-offset-2"
                >
                  Docs
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5 border-t border-zinc-900/60 pt-8">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-cyan-300" />
            <h3 className="text-2xl sm:text-3xl text-zinc-100">Controls</h3>
          </div>
          <p className="text-base text-zinc-400 leading-relaxed">
            Treat controls as safety primitives, not growth knobs. Keep conservative defaults until execution telemetry
            is stable.
          </p>
          <div className="space-y-2 text-base text-zinc-400">
            <p>
              <span className="text-zinc-200">Global Bias:</span> directional policy context.
            </p>
            <p>
              <span className="text-zinc-200">Counter Mode:</span> currently <code className="text-zinc-200">always_opposite</code>.
            </p>
            <p>
              <span className="text-zinc-200">Kill Switch:</span> immediate stop on execution.
            </p>
            <p>
              <span className="text-zinc-200">Leverage Multiplier:</span> scales response from source event.
            </p>
            <p>
              <span className="text-zinc-200">Daily Notional Cap:</span> total execution budget guard.
            </p>
            <p>
              <span className="text-zinc-200">Cooldown:</span> blocks rapid repeated actions.
            </p>
          </div>
          <div className="space-y-2 pt-2">
            <div className="text-sm text-zinc-300">Recommended operator habit</div>
            <ul className="list-disc pl-5 text-sm text-zinc-500 space-y-1">
              <li>Change one variable at a time.</li>
              <li>Observe a full cycle before the next change.</li>
              <li>When uncertain, use kill-switch first and inspect second.</li>
            </ul>
          </div>
        </section>
      </div>
    </article>
  )
}

export function ArenaStatusPage() {
  const counterTradeStatus = useCounterTradeStatus()
  const flowState = useMemo(() => {
    if (!counterTradeStatus.data) return null
    const data = counterTradeStatus.data
    const strategy = data.strategy
    const userActive = data.user.state === 'active'
    const engineReady = data.engineEnabled && Boolean(strategy) && strategy?.killSwitch !== true
    const hasActions = data.recentActions.length > 0

    const steps = [
      {
        id: 'engine',
        title: 'Engine ready',
        done: engineReady,
        hint: engineReady ? `Bias: ${strategy?.globalBias ?? 'neutral'}` : 'Ask an operator to set room strategy.',
        action: '/strategy bias neutral',
      },
      {
        id: 'user',
        title: 'You are opted in',
        done: userActive,
        hint: `Preset: ${data.user.preset ?? '--'}`,
        action: '/strategy optin defensive',
      },
      {
        id: 'activity',
        title: 'First action recorded',
        done: hasActions,
        hint: `Recent actions: ${data.recentActions.length}`,
        action: '/strategy status',
      },
    ] as const

    const firstIncomplete = steps.find((step) => !step.done)
    const activeStepIndex = firstIncomplete ? steps.findIndex((step) => step.id === firstIncomplete.id) : -1
    const completedCount = steps.filter((step) => step.done).length

    return {
      headline: firstIncomplete ? `Step ${activeStepIndex + 1}: ${firstIncomplete.title}` : 'Live and running',
      detail: firstIncomplete
        ? 'Run the next command in AlfaClub chat, then refresh here.'
        : 'All setup steps are complete. Continue monitoring actions.',
      nextCommand: firstIncomplete?.action ?? '/strategy status',
      steps,
      completedCount,
      activeStepIndex,
    }
  }, [counterTradeStatus.data])

  return (
    <div className={`${shellToneCard} p-8 sm:p-10 space-y-6`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="label">Live counter-trade status</div>
          <h2 className="headline text-3xl sm:text-4xl mt-2">Runtime status</h2>
          <p className="mt-3 text-base text-zinc-400 max-w-4xl leading-relaxed">
            This page reflects the live API response. If chat commands succeed but this page does not change, refresh
            and confirm you are signed into the profile linked to the same wallet context.
          </p>
        </div>
        <button
          type="button"
          onClick={() => counterTradeStatus.refetch()}
          className="rounded-full border border-zinc-800/60 px-3 py-1 text-[11px] text-zinc-500 hover:text-zinc-200"
        >
          Refresh
        </button>
      </div>

      {counterTradeStatus.isLoading ? (
        <div className="text-sm text-zinc-500">Loading status...</div>
      ) : counterTradeStatus.isAuthRequired ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
          Sign in to view your strategy status.
        </div>
      ) : counterTradeStatus.error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          {((counterTradeStatus.error as Error).message || '').toLowerCase().includes('failed to fetch') ? (
            <div className="space-y-2">
              <div>Network request failed while loading live status.</div>
              <div className="text-red-100/90">
                Try refresh, then open this page on the app host:
                {' '}
                <a
                  href="https://app.4626.fun/arena/view-status"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  app.4626.fun/arena/view-status
                </a>
              </div>
            </div>
          ) : (
            (counterTradeStatus.error as Error).message || 'Failed to load counter-trade status.'
          )}
        </div>
      ) : counterTradeStatus.data && flowState ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-b from-zinc-950/70 to-black/30 p-6 sm:p-7">
            <div className="text-xl sm:text-2xl text-zinc-100">{flowState.headline}</div>
            <div className="mt-2 text-base text-zinc-400">{flowState.detail}</div>
            <div className="mt-5 rounded-xl bg-zinc-950/70 px-4 py-3 text-sm font-mono text-zinc-100">
              {flowState.nextCommand}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-black/20 p-5 sm:p-6">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Checklist</div>
            <div className="mt-3 space-y-3">
              {flowState.steps.map((step, index) => (
                <div key={step.id} className="flex items-start justify-between gap-3 border-b border-zinc-900/50 pb-4 last:border-b-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="text-base text-zinc-200">{step.done ? step.title : `${index + 1}. ${step.title}`}</div>
                    <div className="mt-1 text-sm text-zinc-500">{step.hint}</div>
                  </div>
                  <div
                    className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                      step.done
                        ? 'border border-zinc-700 bg-zinc-900 text-zinc-200'
                        : index === flowState.activeStepIndex
                          ? 'border border-zinc-600 bg-zinc-900 text-zinc-200'
                          : 'border border-zinc-800 bg-zinc-950 text-zinc-500'
                    }`}
                  >
                    {step.done ? 'Done' : 'Pending'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-zinc-500">Status unavailable.</div>
      )}
    </div>
  )
}

export function ArenaChartPage() {
  return (
    <article className={`${shellToneCard} p-8 sm:p-12`}>
      <div className="max-w-5xl space-y-6">
        <div className="label">View chart</div>
        <h2 className="headline text-3xl sm:text-5xl">Open live positions chart</h2>
        <p className="text-base sm:text-lg text-zinc-300 leading-relaxed">
          Use the positions surface for timeline overlays, chart interactions, and room-level market context. This is
          where strategy events become visually interpretable.
        </p>
        <div className="space-y-2 text-base text-zinc-400">
          <p>
            Use <code className="text-zinc-200">/arena/positions</code> when you need:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>price action aligned with room events</li>
            <li>entry/exit context during volatile periods</li>
            <li>a shared visual reference for operator reviews</li>
          </ul>
        </div>
      </div>
      <Link
        to="/arena/positions"
        className="inline-flex items-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm text-zinc-100 hover:bg-zinc-800"
      >
        Go to /arena/positions
      </Link>
    </article>
  )
}

export function ArenaHowItWorksPage() {
  return (
    <article className={`${shellToneCard} p-8 sm:p-12`}>
      <div className="max-w-7xl space-y-10">
        {/* Header */}
        <section className="space-y-4">
          <div className="label">Counter-trade architecture</div>
          <h2 className="headline text-3xl sm:text-5xl">How the pieces fit together</h2>
          <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-3xl">
            A clean left-to-right timeline of the runtime flow (condensed phases with connections) + the grouped file inventory with the original descriptions you liked.
          </p>
          <p className="text-sm text-amber-300/90">
            Execution only happens on the dedicated Railway Hermit instance when <code className="text-amber-200/90">ALFACLUB_COUNTER_TRADE_RUNNER_ENABLED=1</code>.
            Vercel surfaces are read-only observation.
          </p>
        </section>
        <section className="pt-6">
          <CounterTradeFlowTimeline />
        </section>
        <section className="space-y-4">
          <div className="text-sm text-zinc-500">Files currently involved (grouped by function, same order as the diagram above)</div>

          <div className="space-y-6">
            {counterTradeFileGroups.map((group) => (
              <div key={group.title} className="rounded-2xl border border-zinc-900/70 bg-black/25 p-5 sm:p-6 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-2xl text-zinc-100">{group.title}</h3>
                  <p className="text-sm text-zinc-500">{group.description}</p>
                </div>
                <ul className="space-y-2">
                  {group.files.map((file) => (
                    <li key={file.path} className="rounded-lg border border-zinc-900/70 bg-zinc-950/40 px-3 py-2">
                      <code className="block text-xs sm:text-sm text-sky-300 break-all">{file.path}</code>
                      <p className="mt-1 text-xs sm:text-sm text-zinc-400">{file.why}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </article>
  )
}

export function ArenaBacktestPage() {
  const [topN, setTopN] = useState<number>(10)
  const [isRunning, setIsRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [runOutput, setRunOutput] = useState<string | null>(null)
  const [showRunLog, setShowRunLog] = useState(false)
  const [pinnedSweepFile, setPinnedSweepFile] = useState<string | null>(null)
  const [inlineSeries, setInlineSeries] = useState<BacktestSeriesPayload | null>(null)
  const [lastResolvedInterval, setLastResolvedInterval] = useState<string | null>(null)
  const [defaults, setDefaults] = useState({
    market: 'BTC/USDC',
    leverage: 30,
    windowHours: 168,
    initialLongMarginUsd: 1000,
    initialShortMarginUsd: 1000,
    initialLongBufferUsd: 1000,
    initialShortBufferUsd: 1000,
    healthFloor: 0.7,
    deadband: 0.08,
    minChunkUsd: 500,
    maxChunkUsd: 800,
    cooldownBars: 3,
    requireNoCommingle: true,
  })
  const marketsQuery = useBacktestMarkets()
  const sweep = useBacktestSweep({ file: pinnedSweepFile })

  const sortedRows = useMemo(() => {
    if (!sweep.data) return []
    return [...sweep.data.rows].sort((a, b) => b.objective - a.objective)
  }, [sweep.data])

  const topRows = useMemo(() => sortedRows.slice(0, topN), [sortedRows, topN])
  const selectedTopRow = topRows[0] ?? null
  const activeSweepFile = pinnedSweepFile ?? sweep.data?.file ?? null
  const selectedRunId = useMemo(
    () => (selectedTopRow ? buildBacktestRunIdFromRow(selectedTopRow) : null),
    [selectedTopRow],
  )
  const seriesQuery = useBacktestSeries({
    file: inlineSeries ? null : activeSweepFile,
    runId: selectedRunId,
  })
  const activeSeries = inlineSeries ?? seriesQuery.data ?? null

  const intervalForRun = useMemo(
    () => resolveBacktestIntervalForRun(defaults.windowHours),
    [defaults.windowHours],
  )
  const displayResolvedInterval = selectedTopRow?.interval ?? lastResolvedInterval
  const inferredSymbol = useMemo(() => defaults.market.split('/')[0] ?? 'BTC', [defaults.market])
  const availableMarkets = useMemo(() => {
    const fromApi = marketsQuery.data?.markets ?? []
    if (fromApi.length > 0) return fromApi
    return DEFAULT_BACKTEST_MARKETS.map((market) => ({
      market,
      symbol: market.split('/')[0] ?? 'BTC',
      maxLeverage: 40,
    }))
  }, [marketsQuery.data?.markets])
  const selectedMarket = useMemo(
    () => availableMarkets.find((row) => row.market === defaults.market) ?? null,
    [availableMarkets, defaults.market],
  )
  const leverageMax = selectedMarket?.maxLeverage ?? 40
  const intervalMinutes = useMemo(() => {
    const resolved = displayResolvedInterval ?? intervalForRun
    if (resolved === 'auto') return 60
    if (resolved === '1m') return 1
    if (resolved === '5m') return 5
    if (resolved === '15m') return 15
    return intervalToMinutes(resolved as '1h')
  }, [displayResolvedInterval, intervalForRun])
  const rebalanceCooldownMinutes = defaults.cooldownBars * intervalMinutes
  const totalLongCapitalUsd = defaults.initialLongMarginUsd + defaults.initialLongBufferUsd
  const totalShortCapitalUsd = defaults.initialShortMarginUsd + defaults.initialShortBufferUsd
  const totalCapitalUsd = totalLongCapitalUsd + totalShortCapitalUsd

  useEffect(() => {
    if (availableMarkets.length === 0) return
    const hasSelected = availableMarkets.some((row) => row.market === defaults.market)
    if (hasSelected) return
    setDefaults((current) => ({
      ...current,
      market: availableMarkets[0]?.market ?? current.market,
    }))
  }, [availableMarkets, defaults.market])

  useEffect(() => {
    setDefaults((current) => ({
      ...current,
      leverage: Math.min(leverageMax, Math.max(1, current.leverage)),
    }))
  }, [leverageMax])

  const handleRunBacktest = async () => {
    try {
      setIsRunning(true)
      setRunError(null)
      setRunOutput(null)

      const response = await apiFetch(API_ENDPOINTS.alfaclub.backtestRun, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          symbol: inferredSymbol,
          interval: intervalForRun,
          windowHours: defaults.windowHours,
          leverage: defaults.leverage,
          initialLongMarginUsd: defaults.initialLongMarginUsd,
          initialShortMarginUsd: defaults.initialShortMarginUsd,
          initialLongBufferUsd: defaults.initialLongBufferUsd,
          initialShortBufferUsd: defaults.initialShortBufferUsd,
          healthFloor: defaults.healthFloor,
          deadband: defaults.deadband,
          minChunkUsd: defaults.minChunkUsd,
          maxChunkUsd: defaults.maxChunkUsd,
          cooldownBars: defaults.cooldownBars,
          requireNoCommingle: defaults.requireNoCommingle,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const detail =
          payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : null
        throw new Error(detail?.trim() || `Backtest run failed (${response.status})`)
      }
      if (
        payload &&
        typeof payload === 'object' &&
        (payload as { success?: unknown }).success === false
      ) {
        throw new Error(resolveApiErrorMessage(payload, 'Backtest run failed'))
      }
      const output = typeof payload?.data?.stdout === 'string' ? payload.data.stdout : ''
      const sweepFile =
        typeof payload?.data?.sweepFile === 'string' && payload.data.sweepFile.trim()
          ? payload.data.sweepFile.trim()
          : null
      const resolvedInterval =
        typeof payload?.data?.resolvedInterval === 'string' ? payload.data.resolvedInterval : null
      const seriesPayload = payload?.data?.series
      if (seriesPayload && typeof seriesPayload === 'object') {
        setInlineSeries(seriesPayload as BacktestSeriesPayload)
      } else {
        setInlineSeries(null)
      }
      if (sweepFile) setPinnedSweepFile(sweepFile)
      if (resolvedInterval) setLastResolvedInterval(resolvedInterval)
      setRunOutput(output.trim().length > 0 ? output : 'Backtest completed. Refreshing sweep list...')
      await sweep.refetch()
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Backtest run failed')
    } finally {
      setIsRunning(false)
    }
  }

  const applyDefaultsFromRow = (index: number) => {
    const row = topRows[index]
    if (!row) return
    setDefaults((current) => ({
      ...current,
      market: `${row.symbol}/USDC`,
      leverage: row.leverage,
      windowHours: row.windowHours,
      healthFloor: row.healthFloor,
      deadband: row.deadband,
      minChunkUsd: row.minChunkUsd,
      maxChunkUsd: row.maxChunkUsd,
      cooldownBars: row.cooldownBars,
    }))
  }

  const formatUsd = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
  const formatNum = (value: number, digits = 4) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value)
  const formatPct = (value: number) => `${(value * 100).toFixed(2)}%`

  return (
    <article className={`${shellToneCard} p-8 sm:p-12`}>
      <div className="max-w-none space-y-6">
        <div className="label">Backtesting workspace</div>
        <h2 className="headline text-3xl sm:text-5xl">Arena strategy backtests</h2>
        <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-3xl">
          Run isolated long/short counter-rebalance simulations with automatic finest-bar resolution. Shorter horizons
          replay on 1-minute bars; 90-day runs use 1m when the bar cache is complete, otherwise the finest interval that
          fully covers the window (typically 1h from Hyperliquid).
        </p>

        <div className="rounded-2xl border border-zinc-900/70 bg-black/25 p-5 sm:p-6 space-y-4">
          <h3 className="text-xl text-zinc-100">Run configuration</h3>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPinnedSweepFile(null)
                setInlineSeries(null)
                void sweep.refetch()
              }}
              className="inline-flex items-center rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-100 hover:bg-zinc-800"
            >
              Refresh results
            </button>
            {pinnedSweepFile ? (
              <span className="text-[11px] text-zinc-500 truncate max-w-[16rem]" title={pinnedSweepFile}>
                Pinned: {pinnedSweepFile}
              </span>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 space-y-2">
              <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Long leg (room)</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-zinc-500">
                  <span className="text-[11px] text-zinc-500">Margin (USD)</span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={defaults.initialLongMarginUsd}
                    onChange={(event) => {
                      const parsed = parseCapitalInput(event.target.value)
                      if (parsed == null) return
                      setDefaults((current) => ({ ...current, initialLongMarginUsd: parsed }))
                    }}
                    className="mt-1 w-full rounded-md border border-zinc-800 bg-black/40 px-2 py-1.5 text-sm tabular-nums text-zinc-100"
                  />
                </label>
                <label className="text-zinc-500">
                  <span className="text-[11px] text-zinc-500">Buffer (USD)</span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={defaults.initialLongBufferUsd}
                    onChange={(event) => {
                      const parsed = parseCapitalInput(event.target.value)
                      if (parsed == null) return
                      setDefaults((current) => ({ ...current, initialLongBufferUsd: parsed }))
                    }}
                    className="mt-1 w-full rounded-md border border-zinc-800 bg-black/40 px-2 py-1.5 text-sm tabular-nums text-zinc-100"
                  />
                </label>
              </div>
              <div className="text-[11px] text-zinc-500">
                Side total {formatUsd(totalLongCapitalUsd)} — margin is perp collateral; buffer funds rebalances
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 space-y-2">
              <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Short leg (agent)</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-zinc-500">
                  <span className="text-[11px] text-zinc-500">Margin (USD)</span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={defaults.initialShortMarginUsd}
                    onChange={(event) => {
                      const parsed = parseCapitalInput(event.target.value)
                      if (parsed == null) return
                      setDefaults((current) => ({ ...current, initialShortMarginUsd: parsed }))
                    }}
                    className="mt-1 w-full rounded-md border border-zinc-800 bg-black/40 px-2 py-1.5 text-sm tabular-nums text-zinc-100"
                  />
                </label>
                <label className="text-zinc-500">
                  <span className="text-[11px] text-zinc-500">Buffer (USD)</span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={defaults.initialShortBufferUsd}
                    onChange={(event) => {
                      const parsed = parseCapitalInput(event.target.value)
                      if (parsed == null) return
                      setDefaults((current) => ({ ...current, initialShortBufferUsd: parsed }))
                    }}
                    className="mt-1 w-full rounded-md border border-zinc-800 bg-black/40 px-2 py-1.5 text-sm tabular-nums text-zinc-100"
                  />
                </label>
              </div>
              <div className="text-[11px] text-zinc-500">
                Side total {formatUsd(totalShortCapitalUsd)} — legs stay isolated when no-commingle is on
              </div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2">
              <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Total capital</div>
              <div className="text-sm text-zinc-100 tabular-nums">{formatUsd(totalCapitalUsd)}</div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Long {formatUsd(totalLongCapitalUsd)} + short {formatUsd(totalShortCapitalUsd)}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2">
              <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Bar size</div>
              <div className="text-sm text-zinc-100">{describeBarSizeMode(defaults.windowHours)}</div>
              {describeLastRunBarSize(displayResolvedInterval, defaults.windowHours) ? (
                <div className="mt-1 text-[11px] text-sky-300/90">
                  {describeLastRunBarSize(displayResolvedInterval, defaults.windowHours)}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Quick presets</span>
            <button
              type="button"
              onClick={() =>
                setDefaults((current) => ({
                  ...current,
                  healthFloor: 1.05,
                  deadband: 0.06,
                  minChunkUsd: 250,
                  maxChunkUsd: 500,
                  cooldownBars: 3,
                }))
              }
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-900"
            >
              Aggressive
            </button>
            <button
              type="button"
              onClick={() =>
                setDefaults((current) => ({
                  ...current,
                  healthFloor: 0.95,
                  deadband: 0.1,
                  minChunkUsd: 500,
                  maxChunkUsd: 800,
                  cooldownBars: 6,
                }))
              }
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-900"
            >
              Balanced
            </button>
            <button
              type="button"
              onClick={() =>
                setDefaults((current) => ({
                  ...current,
                  healthFloor: 0.8,
                  deadband: 0.16,
                  minChunkUsd: 800,
                  maxChunkUsd: 1500,
                  cooldownBars: 12,
                }))
              }
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-900"
            >
              Low frequency
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm text-zinc-300 lg:grid-cols-3 2xl:grid-cols-4">
              <div className="col-span-full text-[11px] uppercase tracking-[0.14em] text-zinc-500">Market and horizon</div>
              <label className="text-zinc-500">
                Market
                <select
                  value={defaults.market}
                  onChange={(event) => setDefaults((current) => ({ ...current, market: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-100"
                >
                  {availableMarkets.map(({ market, maxLeverage }) => (
                    <option key={market} value={market}>
                      {market} ({maxLeverage}x max)
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-zinc-500">
                Backtest horizon
                <select
                  value={defaults.windowHours}
                  onChange={(event) =>
                    setDefaults((current) => ({
                      ...current,
                      windowHours: Math.max(1, Number(event.target.value) || 24),
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-100"
                >
                  {BACKTEST_HORIZON_PRESETS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-zinc-500">
                Leverage (x)
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={leverageMax}
                    value={defaults.leverage}
                    onChange={(event) =>
                      setDefaults((current) => ({
                        ...current,
                        leverage: Math.min(leverageMax, Math.max(1, Number(event.target.value) || 1)),
                      }))
                    }
                    className="w-full accent-sky-500"
                  />
                  <span className="w-10 text-right tabular-nums text-zinc-100">{defaults.leverage}</span>
                </div>
              </label>
              <div className="col-span-full text-[11px] uppercase tracking-[0.14em] text-zinc-500 mt-1">Strategy profile</div>
              <div className="col-span-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-300">
                Preset-driven policy: health floor <span className="text-zinc-100">{formatNum(defaults.healthFloor, 3)}</span>, gap{' '}
                <span className="text-zinc-100">{formatNum(defaults.deadband, 3)}</span>, chunk{' '}
                <span className="text-zinc-100">{formatUsd(defaults.minChunkUsd)}-{formatUsd(defaults.maxChunkUsd)}</span>, cooldown{' '}
                <span className="text-zinc-100">{defaults.cooldownBars}</span> bars.
              </div>
              <label className="text-zinc-500 col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={defaults.requireNoCommingle}
                  onChange={(event) =>
                    setDefaults((current) => ({ ...current, requireNoCommingle: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-sky-500"
                />
                Fail run if any cross-leg commingling is detected
              </label>
          </div>

          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-2 text-xs text-zinc-400">
            <p>
              {describeBarSizeMode(defaults.windowHours)} · cooldown {defaults.cooldownBars} bars (~
              {formatNum(rebalanceCooldownMinutes, 0)} min at last bar size) · strict leg isolation{' '}
              {defaults.requireNoCommingle ? 'on' : 'off'} · leverage{' '}
              <span className="text-zinc-200">{defaults.leverage}x</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRunBacktest()}
              disabled={isRunning}
              className="inline-flex items-center rounded-lg bg-sky-700 px-3 py-2 text-xs text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunning ? 'Running backtest…' : 'Run backtest'}
            </button>
            {runOutput ? (
              <button
                type="button"
                onClick={() => setShowRunLog((current) => !current)}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
              >
                {showRunLog ? 'Hide log' : 'Show log'}
              </button>
            ) : null}
          </div>
          {runError ? <p className="text-xs text-red-300">{runError}</p> : null}
          {showRunLog && runOutput ? (
            <pre className="max-h-36 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 text-[11px] text-zinc-300 whitespace-pre-wrap">
              {runOutput}
            </pre>
          ) : null}
        </div>

        {selectedTopRow ? (
          <div className="rounded-2xl border border-zinc-900/70 bg-black/25 p-5 sm:p-6">
            <ArenaBacktestAnalysis
              row={selectedTopRow}
              series={activeSeries}
              seriesLoading={!inlineSeries && seriesQuery.isLoading}
              seriesError={inlineSeries ? null : (seriesQuery.error as Error | null)}
              sweepFile={activeSweepFile}
            />
          </div>
        ) : null}

        <div className="rounded-2xl border border-zinc-900/70 bg-black/25 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl text-zinc-100">Top configurations</h3>
            <label className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Top N
              <input
                type="number"
                min={1}
                max={100}
                value={topN}
                onChange={(event) => setTopN(Math.min(100, Math.max(1, Number(event.target.value) || 10)))}
                className="ml-2 w-20 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-100"
              />
            </label>
          </div>

          {sweep.isLoading ? (
            <p className="text-sm text-zinc-400">Loading backtest sweep...</p>
          ) : sweep.error ? (
            <p className="text-sm text-red-300">{(sweep.error as Error).message || 'Failed to load sweep data.'}</p>
          ) : topRows.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No rows found for current file/filter combination. If you just ran a sweep, refresh once and make sure the
              CSV exists in <code className="text-zinc-200">frontend/tmp/backtests</code>.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-zinc-200">
                <thead className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Objective</th>
                    <th className="px-3 py-2 text-left">Final equity</th>
                    <th className="px-3 py-2 text-left">Realized</th>
                    <th className="px-3 py-2 text-left">Costs</th>
                    <th className="px-3 py-2 text-left">Start/End</th>
                    <th className="px-3 py-2 text-left">Move</th>
                    <th className="px-3 py-2 text-left">Long/Short BTC</th>
                    <th className="px-3 py-2 text-left">health/deadband</th>
                    <th className="px-3 py-2 text-left">Chunk min/max</th>
                    <th className="px-3 py-2 text-left">Cooldown</th>
                    <th className="px-3 py-2 text-left">Cross-leg violations</th>
                    <th className="px-3 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {topRows.map((row, index) => (
                    <tr key={`${row.objective}-${row.cooldownBars}-${index}`} className="border-t border-zinc-900/70">
                      <td className="px-3 py-2">{formatNum(row.objective)}</td>
                      <td className="px-3 py-2">{formatUsd(row.finalEquity)}</td>
                      <td className="px-3 py-2">{formatUsd(row.realizedPnl)}</td>
                      <td className="px-3 py-2">{formatUsd(row.executionCost)}</td>
                      <td className="px-3 py-2">{formatUsd(row.startPrice)} / {formatUsd(row.endPrice)}</td>
                      <td className="px-3 py-2">{formatPct(row.priceChangePct)}</td>
                      <td className="px-3 py-2">
                        {formatNum(row.finalLongQty, 4)} / {formatNum(row.finalShortQty, 4)}
                      </td>
                      <td className="px-3 py-2">
                        {row.healthFloor} / {row.deadband}
                      </td>
                      <td className="px-3 py-2">
                        {row.minChunkUsd} / {row.maxChunkUsd}
                      </td>
                      <td className="px-3 py-2">{row.cooldownBars}</td>
                      <td className="px-3 py-2">{row.commingleViolationCount}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => applyDefaultsFromRow(index)}
                          className="rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 hover:bg-zinc-800"
                        >
                          Use as defaults
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function MermaidDiagram({ chart, wrapperClassName = '' }: { chart: string; wrapperClassName?: string }) {
  const renderId = useId().replace(/:/g, '-')
  const [svg, setSvg] = useState<string>('')
  const [renderError, setRenderError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    async function run() {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark' })
        const { svg: renderedSvg } = await mermaid.render(`arena-mermaid-${renderId}`, chart)
        if (isCancelled) return
        setSvg(renderedSvg)
        setRenderError(null)
      } catch (error) {
        if (isCancelled) return
        const message = error instanceof Error ? error.message : 'Failed to render diagram'
        setRenderError(message)
      }
    }

    void run()
    return () => {
      isCancelled = true
    }
  }, [chart, renderId])

  if (renderError) {
    return (
      <div className="rounded-xl bg-black/40 border border-red-500/30 p-4 text-xs text-red-200">
        Mermaid render failed: {renderError}
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="rounded-xl bg-black/40 border border-zinc-900/70 p-4 text-xs text-zinc-500">
        Rendering diagram...
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl bg-black/40 border border-zinc-900/70 p-4 overflow-x-auto [&_svg]:w-full [&_svg]:h-auto ${wrapperClassName}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
