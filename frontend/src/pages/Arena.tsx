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

type ChecklistItem = {
  label: string
  state: 'done' | 'pending'
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

const acceptanceChecklist: ChecklistItem[] = [
  { label: 'Deterministic input-to-decision flow documented', state: 'done' },
  { label: 'Risk caps and kill-switch behavior explicitly defined', state: 'done' },
  { label: 'Operator controls scaffold is read-only in v1', state: 'done' },
  { label: 'Dry-run decision logging path validated before live execution', state: 'pending' },
  { label: 'Gated execution rollout reviewed against runbook', state: 'pending' },
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
              Public architecture + deterministic strategy contract for the counter-trade engine. This page is
              implementation-facing: identical event streams must produce identical state transitions and guarded outputs.
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
                body="AlfaClub fill events + Hyperliquid market reads + operator bias input"
              />
              <FlowNode
                icon={<Gauge className="w-4 h-4 text-cyan-300" />}
                title="Counter Engine"
                body="Opposite-direction candidate generation with deterministic leverage and notional policy"
              />
              <FlowNode
                icon={<ShieldCheck className="w-4 h-4 text-cyan-300" />}
                title="Risk Gate"
                body="Caps, allowlists, cooldowns, daily budgets, and kill-switch enforcement"
              />
              <FlowNode
                icon={<Bot className="w-4 h-4 text-cyan-300" />}
                title="Arena Executor"
                body="arenaClient/dgclaw submission lane + state persistence + ops telemetry emission"
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
              Instance key = <span className="font-mono text-zinc-300">room + market + identity</span>. State is the canonical
              decision context and idempotency checkpoint.
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
              <li>- User LONG fill -&gt; evaluate opposite SHORT candidate.</li>
              <li>- User SHORT fill -&gt; evaluate opposite LONG candidate.</li>
              <li>- Reject events outside configured room/identity allowlists.</li>
              <li>- Enforce stream idempotency with <span className="font-mono text-zinc-200">lastProcessedTradeId</span>.</li>
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
              Bias tunes aggressiveness ceilings, but can never bypass hard risk limits.
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
            <div className="rounded-xl border border-zinc-900/60 bg-black/25 p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Deterministic decision shape</div>
              <pre className="text-[11px] sm:text-xs text-zinc-300 overflow-x-auto">
                <code>{`if (!allowlisted || killSwitch || now < cooldownUntil) skip
candidate = opposite(userFill.side)
candidateLeverage = userLeverage * leverageMultiplier
finalLeverage = min(candidateLeverage, maxCounterLeverage, riskAdjustedLeverageCap)
finalNotional = min(userNotional, maxCounterNotionalPerTrade, remainingDailyNotionalCap)
submit if finalNotional > 0`}</code>
              </pre>
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
                  Decision + execution outcomes persist to strategy state and emit ops events and room updates for observability.
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
              Controls below are read-only placeholders for v1. Writable control-plane endpoints remain intentionally out of
              scope for this page pass.
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
                  Runtime operations, safety toggles, and failure handling procedures.
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
                  Pre-production gate review before enabling any live execution lane.
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
            <div className="pt-3">
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Acceptance checklist</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {acceptanceChecklist.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-zinc-900/60 bg-black/20 px-3 py-2 flex items-center gap-2"
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-flex h-2.5 w-2.5 rounded-full ${
                        item.state === 'done' ? 'bg-emerald-400/90' : 'bg-zinc-600'
                      }`}
                    />
                    <span className="text-xs text-zinc-400">{item.label}</span>
                  </div>
                ))}
              </div>
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

function ControlStub({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
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
