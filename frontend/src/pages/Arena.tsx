import { useEffect, useId, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { SlidersHorizontal } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { PageMeta, META } from '@/components/seo/PageMeta'
import { useCounterTradeStatus } from '@/hooks/useCounterTradeStatus'

const shellToneCard = 'bg-black/20 backdrop-blur-sm shadow-[0_30px_80px_rgba(0,0,0,0.45)] rounded-3xl'

const docsPages = [
  { key: 'introduction', label: 'Introduction', path: '/arena/introduction' },
  { key: 'getting-started', label: 'Getting Started', path: '/arena/getting-started' },
  { key: 'view-status', label: 'View Status', path: '/arena/view-status' },
  { key: 'view-chart', label: 'View Chart', path: '/arena/view-chart' },
  { key: 'counter-trade-files', label: 'Counter-Trade Files', path: '/arena/counter-trade-files' },
  { key: 'positions', label: 'Positions', path: '/arena/positions' },
] as const

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
      { path: 'frontend/api/_handlers/v1/alfaclub/_counter-trade-run.ts', why: 'Cron/manual trigger endpoint for loop execution.' },
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
      { path: 'scripts/ops/counter-trade-smoke.sh', why: 'Smoke test script for lane verification.' },
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

  return (
    <div className="relative">
      <PageMeta title={META.arena.title} description={META.arena.description} canonicalPath="/arena" />
      <section className="cinematic-section">
        <aside className="hidden lg:block fixed left-0 top-0 h-screen w-64 border-r border-zinc-900/80 bg-black/50 backdrop-blur-md z-20">
          <div className="h-full overflow-y-auto px-4 pt-24 pb-6">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-3">Inverse Engine</div>
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
                    {page.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        <div
          className={
            isPositionsRoute
              ? 'mx-auto w-full max-w-[1920px] px-0 sm:px-0 lg:pl-[18rem] space-y-4'
              : 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:pl-[18rem] space-y-6'
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

export function ArenaCounterTradeFilesPage() {
  return (
    <article className={`${shellToneCard} p-8 sm:p-12`}>
      <div className="max-w-6xl space-y-10">
        <section className="space-y-4">
          <div className="label">Counter-trade inventory</div>
          <h2 className="headline text-3xl sm:text-5xl">Files currently involved</h2>
          <p className="text-base sm:text-lg text-zinc-300 leading-relaxed">
            Living index of the counter-trading bot codepath used by the Arena inverse engine. Grouped by function so
            operators can quickly locate execution logic, API surfaces, data model, and tests.
          </p>
          <p className="text-sm text-zinc-500">
            Updated for the latest runner modularization (entry flow, exit flow, usage state, and room posting helpers).
          </p>
        </section>

        <section className="space-y-6">
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
        </section>
      </div>
    </article>
  )
}

function MermaidDiagram({ chart }: { chart: string }) {
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
      className="rounded-xl bg-black/40 border border-zinc-900/70 p-4 overflow-x-auto [&_svg]:w-full [&_svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
