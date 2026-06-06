import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  Ban,
  Bot,
  Gauge,
  Radar,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react'

import { PageMeta, META } from '@/components/seo/PageMeta'
import { Button } from '@/components/ui/Button'
import { getCanonicalMarketingWaitlistPath } from '@/lib/auth/waitlistEntry'

type StrategyStateField = {
  key: string
  desc: string
}

type BiasRule = {
  bias: 'bearish' | 'bullish' | 'neutral'
  priority: string
  reducedOrSkipped: string
}

const stateFields: StrategyStateField[] = [
  { key: 'globalBias', desc: 'bullish | bearish | neutral' },
  { key: 'counterMode', desc: 'always_opposite (v1)' },
  { key: 'leverageMultiplier', desc: 'scales user leverage into candidate counter leverage' },
  { key: 'maxCounterLeverage', desc: 'hard max leverage bound' },
  { key: 'maxCounterNotionalPerTrade', desc: 'hard cap per trade' },
  { key: 'dailyCounterNotionalCap', desc: 'daily notional ceiling per instance' },
  { key: 'cooldownUntil', desc: 'block execution until cooldown clears' },
  { key: 'killSwitch', desc: 'halts all execution when enabled' },
  { key: 'lastProcessedTradeId', desc: 'idempotency checkpoint per stream' },
]

const biasRules: BiasRule[] = [
  {
    bias: 'bearish',
    priority: 'Countering user LONG is prioritized (SHORT response).',
    reducedOrSkipped: 'Countering user SHORT can be reduced or skipped.',
  },
  {
    bias: 'bullish',
    priority: 'Countering user SHORT is prioritized (LONG response).',
    reducedOrSkipped: 'Countering user LONG can be reduced or skipped.',
  },
  {
    bias: 'neutral',
    priority: 'Symmetric opposite countering on both sides.',
    reducedOrSkipped: 'Use conservative baseline leverage and notional.',
  },
]

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

const shellToneCard = 'glass-card ring-1 ring-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.6)]'

export function Arena() {
  return (
    <div className="relative">
      <PageMeta title={META.arena.title} description={META.arena.description} canonicalPath="/arena" />

      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            <span className="label">Arena</span>
            <h1 className="headline text-3xl sm:text-5xl">AlfaClub + Arena Volatility Harvesting Engine</h1>
            <p className="text-sm text-zinc-400 font-light max-w-3xl">
              Public architecture and strategy spec for the counter-trade engine. This page is implementation-focused and
              intentionally deterministic: same input event stream, same state machine, same guarded output decisions.
            </p>
          </motion.div>

          <div className={`${shellToneCard} p-6 sm:p-8 space-y-4`}>
            <div className="flex items-center gap-2 text-zinc-200 text-sm">
              <Activity className="w-4 h-4 text-cyan-300" />
              Target execution loop
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FlowNode
                icon={<Radar className="w-4 h-4 text-cyan-300" />}
                title="Event Intake"
                body="AlfaClub user fills + Hyperliquid reads + manual bias settings"
              />
              <FlowNode
                icon={<Gauge className="w-4 h-4 text-cyan-300" />}
                title="Counter Engine"
                body="Opposite-side candidate generation with deterministic leverage policy"
              />
              <FlowNode
                icon={<ShieldCheck className="w-4 h-4 text-cyan-300" />}
                title="Risk Gate"
                body="Caps, allowlists, cooldowns, daily budgets, and kill-switch enforcement"
              />
              <FlowNode
                icon={<Bot className="w-4 h-4 text-cyan-300" />}
                title="Arena Executor"
                body="arenaClient/dgclaw execution path + state updates + ops telemetry"
              />
            </div>
          </div>

          <div className={`${shellToneCard} p-6 sm:p-8 space-y-4`}>
            <div className="label">Canonical architecture graph</div>
            <p className="text-xs text-zinc-500">
              Keep this graph synced with implementation docs and runbooks when components or boundaries change.
            </p>
            <pre className="rounded-xl bg-black/40 border border-zinc-900/70 p-4 text-[11px] sm:text-xs text-zinc-300 overflow-x-auto">
              <code>{mermaidSpec}</code>
            </pre>
          </div>
        </div>
      </section>

      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
          <div className={`${shellToneCard} p-6 sm:p-8 space-y-5`}>
            <div className="label">Deterministic strategy specification</div>
            <h2 className="headline text-2xl sm:text-3xl">1) State model per instance</h2>
            <p className="text-sm text-zinc-500 max-w-3xl">
              Instance key = <span className="font-mono text-zinc-300">room + market + identity</span>. The state store is the
              decision anchor and idempotency checkpoint.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {stateFields.map((field) => (
                <div key={field.key} className="rounded-xl border border-zinc-900/60 bg-black/25 p-4">
                  <div className="text-sm text-zinc-100 font-mono">{field.key}</div>
                  <div className="text-xs text-zinc-500 mt-1">{field.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${shellToneCard} p-6 sm:p-8 space-y-5`}>
            <h2 className="headline text-2xl sm:text-3xl">2) Event trigger model</h2>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li>- On user LONG fill event, evaluate an opposite SHORT candidate.</li>
              <li>- On user SHORT fill event, evaluate an opposite LONG candidate.</li>
              <li>- Ignore events outside room and identity allowlists.</li>
              <li>- Keep stream idempotent with <span className="font-mono text-zinc-200">lastProcessedTradeId</span>.</li>
            </ul>
          </div>

          <div className={`${shellToneCard} p-6 sm:p-8 space-y-5`}>
            <h2 className="headline text-2xl sm:text-3xl">3) Leverage mapping policy</h2>
            <div className="rounded-xl border border-zinc-900/60 bg-black/25 p-4">
              <p className="text-sm text-zinc-400">
                Candidate leverage is computed as:
              </p>
              <p className="font-mono text-xs sm:text-sm text-cyan-200 mt-2">
                candidateLeverage = userLeverage * leverageMultiplier
              </p>
              <p className="font-mono text-xs sm:text-sm text-cyan-200 mt-2">
                finalLeverage = min(candidateLeverage, maxCounterLeverage, riskAdjustedLeverageCap)
              </p>
            </div>
            <p className="text-sm text-zinc-500">
              Bias modifies aggressiveness ceilings but never bypasses hard guardrails.
            </p>
          </div>

          <div className={`${shellToneCard} p-6 sm:p-8 space-y-5`}>
            <h2 className="headline text-2xl sm:text-3xl">4) Directional response by bias</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {biasRules.map((rule) => (
                <div key={rule.bias} className="rounded-xl border border-zinc-900/60 bg-black/25 p-4 space-y-2">
                  <div className="text-sm uppercase tracking-wide text-zinc-200">{rule.bias}</div>
                  <div className="text-xs text-zinc-400">{rule.priority}</div>
                  <div className="text-xs text-zinc-600">{rule.reducedOrSkipped}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${shellToneCard} p-6 sm:p-8 space-y-5`}>
            <h2 className="headline text-2xl sm:text-3xl">5) Risk guard layer</h2>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li>- Enforce per-trade notional caps before submit.</li>
              <li>- Enforce daily aggregate notional caps per strategy instance.</li>
              <li>- Block execution while cooldown is active.</li>
              <li>- Halt all executions when kill switch is enabled.</li>
              <li>- Reject events from non-allowlisted rooms/identities/markets.</li>
            </ul>
          </div>

          <div className={`${shellToneCard} p-6 sm:p-8 space-y-5`}>
            <h2 className="headline text-2xl sm:text-3xl">6) Executor and telemetry path</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-900/60 bg-black/25 p-4">
                <div className="text-sm text-zinc-100">Execution path</div>
                <p className="text-xs text-zinc-500 mt-2">
                  <span className="font-mono text-zinc-300">strategyEngine -&gt; riskGate -&gt; executor -&gt; arenaClient/dgclaw</span>
                </p>
              </div>
              <div className="rounded-xl border border-zinc-900/60 bg-black/25 p-4">
                <div className="text-sm text-zinc-100">State and telemetry path</div>
                <p className="text-xs text-zinc-500 mt-2">
                  Decision and execution outcomes persist to strategy state and emit ops events + room updates for observability.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
          <div className={`${shellToneCard} p-6 sm:p-8 space-y-5`}>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-cyan-300" />
              <h2 className="headline text-2xl sm:text-3xl">Operator controls (v1 scaffold)</h2>
            </div>
            <p className="text-sm text-zinc-500 max-w-3xl">
              Controls below are intentionally read-only placeholders for v1 page launch. Live mutation endpoints are out of scope in
              this pass.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ControlStub label="Global Bias" value="neutral" />
              <ControlStub label="Counter Mode" value="always_opposite" />
              <ControlStub label="Kill Switch" value="disabled" icon={<Ban className="w-3.5 h-3.5 text-zinc-500" />} />
              <ControlStub label="Leverage Multiplier" value="1.00x" />
              <ControlStub label="Daily Notional Cap" value="$0 (placeholder)" />
              <ControlStub label="Cooldown" value="inactive" />
              <ControlStub label="Dry Run" value="enabled (recommended until phase 2)" />
              <ControlStub label="Room Allowlist" value="1659 (example)" />
              <ControlStub label="Market Scope" value="configured subset" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href="https://docs.4626.fun/operations/virtuals-arena-railway-runbook"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-zinc-900/60 bg-black/25 p-4 hover:border-white/10 transition-colors"
              >
                <div className="text-sm text-zinc-100">Execution runbook</div>
                <p className="text-xs text-zinc-500 mt-2">
                  Virtuals Arena Railway runbook, safety toggles, and operational checks.
                </p>
              </a>
              <a
                href="https://docs.4626.fun/operations/virtuals-arena-staging-checklist"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-zinc-900/60 bg-black/25 p-4 hover:border-white/10 transition-colors"
              >
                <div className="text-sm text-zinc-100">Staging checklist</div>
                <p className="text-xs text-zinc-500 mt-2">
                  Pre-production readiness checklist before enabling live execution paths.
                </p>
              </a>
            </div>
          </div>

          <div className={`${shellToneCard} p-6 sm:p-8 space-y-4`}>
            <div className="label">Rollout phases</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <PhaseCard
                title="Phase 0"
                subtitle="Spec + scaffolding"
                desc="Publish architecture and deterministic behavior contract. Keep controls read-only."
              />
              <PhaseCard
                title="Phase 1"
                subtitle="Dry-run decisions"
                desc="Generate and log counter decisions without placing trades; validate telemetry and guardrails."
              />
              <PhaseCard
                title="Phase 2"
                subtitle="Gated execution"
                desc="Enable constrained execution per room/identity allowlists with kill-switch and hard caps."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="cinematic-section">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-10">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <h2 className="headline text-3xl sm:text-5xl">Follow the Arena rollout</h2>
            <p className="text-sm text-zinc-500 mt-3 max-w-2xl mx-auto">
              Join the waitlist for release notes and staged access as execution moves from dry-run to guarded live trading.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button variant="primary" asChild>
                <Link to={getCanonicalMarketingWaitlistPath()}>Join waitlist</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/positions">
                  View Positions
                  <TrendingUp className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

function FlowNode({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-zinc-900/60 bg-black/25 p-4 space-y-2">
      <div className="flex items-center gap-2 text-zinc-100 text-sm">
        {icon}
        {title}
      </div>
      <p className="text-xs text-zinc-500">{body}</p>
    </div>
  )
}

function ControlStub({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-900/60 bg-black/25 p-4 space-y-2">
      <div className="text-xs text-zinc-500 uppercase tracking-wide">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-zinc-200">{value}</div>
        {icon ?? <span className="inline-flex h-2.5 w-2.5 rounded-full bg-zinc-700" aria-hidden="true" />}
      </div>
    </div>
  )
}

function PhaseCard({ title, subtitle, desc }: { title: string; subtitle: string; desc: string }) {
  return (
    <div className="rounded-xl border border-zinc-900/60 bg-black/25 p-4 text-left space-y-2">
      <div className="text-xs text-cyan-300 uppercase tracking-wide">{title}</div>
      <div className="text-sm text-zinc-100">{subtitle}</div>
      <p className="text-xs text-zinc-500">{desc}</p>
    </div>
  )
}
