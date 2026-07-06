import type { CounterTradeRuntimeConfig } from './counterTradeConfig.js'
import { formatSizeCapForMembers } from './counterTradeSizing.js'

/** Nullable room overrides merged on top of env-backed runtime defaults. */
export type CounterTradeRoomConfigOverrides = {
  inverseRebalanceScalePct?: number
  harvestTriggerRoiPct?: number
  harvestFraction?: number
  defendLiqDistancePct?: number
  defendReduceFraction?: number
  maxCounterNotionalPctOfFund?: number
  maxCounterNotionalCeilingPctOfFund?: number
  minReduceNotionalUsd?: number
  dipDrawdownFullSizePct?: number
  dipDrawdownCurveAlpha?: number
  maxDipAddsPerLeg?: number
}

export type CounterTradeConfigGroup = 'rebalance' | 'harvest' | 'defend' | 'limits'

export type CounterTradeConfigKeySpec = {
  alias: string
  field: keyof CounterTradeRoomConfigOverrides
  group: CounterTradeConfigGroup
  label: string
  min: number
  max: number
  integer?: boolean
  /** When true, CLI accepts 1–100 meaning % and stores as 0–1 fraction. */
  asFractionOfHundred?: boolean
}

export const COUNTER_TRADE_CONFIG_GROUP_META: Record<
  CounterTradeConfigGroup,
  { title: string; blurb: string; resetBlurb: string }
> = {
  rebalance: {
    title: 'Syncs when you trade',
    blurb:
      'When a member adds or cuts size, the bot takes profit on the leg that is green and adds to the leg that is red — so the paired hedge stays balanced.',
    resetBlurb: 'Trade-sync strength is back on the default playbook.',
  },
  harvest: {
    title: 'Banks green PnL',
    blurb:
      'On positions that are clearly in profit, the bot trims automatically — locking gains and freeing margin for the next move.',
    resetBlurb: 'Profit-taking rules are back on the default playbook.',
  },
  defend: {
    title: 'Safety near liquidation',
    blurb:
      'If a leg drifts too close to liquidation, the bot trims early to pull the liq price back and protect the wallet.',
    resetBlurb: 'Liquidation safety rules are back on the default playbook.',
  },
  limits: {
    title: 'Size cap (% of fund)',
    blurb:
      'Each automated response is capped at a percentage of the bot trading fund so one fill cannot oversize the book.',
    resetBlurb: 'Trade size guardrails are back on the default playbook.',
  },
}

export const COUNTER_TRADE_CONFIG_KEY_SPECS: CounterTradeConfigKeySpec[] = [
  {
    alias: 'rebalance-pct',
    field: 'inverseRebalanceScalePct',
    group: 'rebalance',
    label: 'Sync strength',
    min: 0,
    max: 500,
    integer: true,
  },
  {
    alias: 'harvest-roi',
    field: 'harvestTriggerRoiPct',
    group: 'harvest',
    label: 'Take profit after you are up',
    min: 1,
    max: 500,
  },
  {
    alias: 'harvest-pct',
    field: 'harvestFraction',
    group: 'harvest',
    label: 'How much we bank each time',
    min: 1,
    max: 75,
    asFractionOfHundred: true,
  },
  {
    alias: 'defend-liq',
    field: 'defendLiqDistancePct',
    group: 'defend',
    label: 'Start trimming this far from liq',
    min: 1,
    max: 80,
  },
  {
    alias: 'defend-pct',
    field: 'defendReduceFraction',
    group: 'defend',
    label: 'How much we cut when defending',
    min: 1,
    max: 75,
    asFractionOfHundred: true,
  },
  {
    alias: 'max-trade-pct',
    field: 'maxCounterNotionalPctOfFund',
    group: 'limits',
    label: 'Response size (% of trading fund)',
    min: 1,
    max: 100,
    integer: true,
  },
  {
    alias: 'max-trade-ceiling-pct',
    field: 'maxCounterNotionalCeilingPctOfFund',
    group: 'limits',
    label: 'Hard max (% of trading fund)',
    min: 1,
    max: 100,
    integer: true,
  },
  {
    alias: 'min-reduce',
    field: 'minReduceNotionalUsd',
    group: 'limits',
    label: 'Smallest partial trim',
    min: 10,
    max: 1_000,
  },
  {
    alias: 'dip-drawdown-full',
    field: 'dipDrawdownFullSizePct',
    group: 'limits',
    label: 'Full dip size at this drawdown (D)',
    min: 5,
    max: 100,
    integer: true,
  },
  {
    alias: 'dip-drawdown-alpha',
    field: 'dipDrawdownCurveAlpha',
    group: 'limits',
    label: 'Dip curve shape (alpha)',
    min: 0.25,
    max: 4,
  },
  {
    alias: 'max-dip-adds',
    field: 'maxDipAddsPerLeg',
    group: 'limits',
    label: 'Max dip adds per leg',
    min: 0,
    max: 20,
    integer: true,
  },
]

const CONFIG_KEY_BY_ALIAS = new Map<string, CounterTradeConfigKeySpec>()
const CONFIG_KEY_BY_FIELD = new Map<keyof CounterTradeRoomConfigOverrides, CounterTradeConfigKeySpec>()
for (const spec of COUNTER_TRADE_CONFIG_KEY_SPECS) {
  CONFIG_KEY_BY_ALIAS.set(spec.alias, spec)
  CONFIG_KEY_BY_FIELD.set(spec.field, spec)
}

export function resolveCounterTradeConfigKeySpec(aliasInput: string): CounterTradeConfigKeySpec | null {
  const alias = String(aliasInput ?? '').trim().toLowerCase()
  return CONFIG_KEY_BY_ALIAS.get(alias) ?? null
}

export function resolveCounterTradeConfigFieldSpec(
  field: keyof CounterTradeRoomConfigOverrides,
): CounterTradeConfigKeySpec | null {
  return CONFIG_KEY_BY_FIELD.get(field) ?? null
}

export function listCounterTradeConfigFieldsForGroup(
  group: CounterTradeConfigGroup,
): Array<keyof CounterTradeRoomConfigOverrides> {
  return COUNTER_TRADE_CONFIG_KEY_SPECS.filter((spec) => spec.group === group).map((spec) => spec.field)
}

export function parseCounterTradeConfigGroup(value: string): CounterTradeConfigGroup | null {
  return resolveCounterTradeConfigGroupToken(value)
}

const COUNTER_TRADE_GROUP_SHORT: Record<CounterTradeConfigGroup, { one: string; two: string }> = {
  rebalance: { one: 's', two: 'sy' },
  harvest: { one: 'b', two: 'bk' },
  defend: { one: 'd', two: 'sa' },
  limits: { one: 'c', two: 'cp' },
}

const COUNTER_TRADE_GROUP_TOKEN_ALIASES: Record<string, CounterTradeConfigGroup> = {
  m: 'rebalance',
  mirror: 'rebalance',
  s: 'rebalance',
  sy: 'rebalance',
  sync: 'rebalance',
  rebalance: 'rebalance',
  y: 'rebalance',
  b: 'harvest',
  bk: 'harvest',
  bank: 'harvest',
  harvest: 'harvest',
  profits: 'harvest',
  profit: 'harvest',
  d: 'defend',
  r: 'defend',
  risk: 'defend',
  sa: 'defend',
  sf: 'defend',
  f: 'defend',
  safety: 'defend',
  defend: 'defend',
  safe: 'defend',
  liq: 'defend',
  c: 'limits',
  cp: 'limits',
  sz: 'limits',
  z: 'limits',
  size: 'limits',
  limits: 'limits',
  limit: 'limits',
  caps: 'limits',
  cap: 'limits',
}

export function resolveCounterTradeConfigGroupToken(token: string): CounterTradeConfigGroup | null {
  const normalized = String(token ?? '').trim().toLowerCase()
  return COUNTER_TRADE_GROUP_TOKEN_ALIASES[normalized] ?? null
}

export function primaryCounterTradeGroupCommand(group: CounterTradeConfigGroup): string {
  const words: Record<CounterTradeConfigGroup, string> = {
    rebalance: 'mirror',
    harvest: 'profit',
    defend: 'risk',
    limits: 'size',
  }
  return words[group]
}

export function shortCounterTradeGroupCommand(group: CounterTradeConfigGroup): string {
  return COUNTER_TRADE_GROUP_SHORT[group].one
}

function isPlaybookToken(token: string): boolean {
  return ['p', 'pb', 't', 'tune', 'playbook', 'rules', 'show', 'config', 'cfg'].includes(token)
}

function isWhenToken(token: string): boolean {
  return ['when', 'at', 'up', 'roi', 'w'].includes(token)
}

function isTakeToken(token: string): boolean {
  return ['take', 'trim', 'cut', 't', 'c'].includes(token)
}

function isMaxToken(token: string): boolean {
  return ['max', 'x', 'hi'].includes(token)
}

function isMinToken(token: string): boolean {
  return ['min', 'n', 'lo'].includes(token)
}

function isDepthToken(token: string): boolean {
  return ['depth', 'd', 'dd'].includes(token)
}

function isCurveToken(token: string): boolean {
  return ['curve', 'alpha', 'a'].includes(token)
}

function isAddsToken(token: string): boolean {
  return ['adds'].includes(token)
}

export function parseCounterTradeConfigValue(
  spec: CounterTradeConfigKeySpec,
  rawValue: string,
): number | null {
  const parsed = Number(String(rawValue ?? '').trim())
  if (!Number.isFinite(parsed)) return null
  const minVal = spec.asFractionOfHundred ? spec.min / 100 : spec.min
  const maxVal = spec.asFractionOfHundred ? spec.max / 100 : spec.max
  const value = spec.asFractionOfHundred ? parsed / 100 : parsed
  if (value < minVal || value > maxVal) return null
  if (spec.integer && !Number.isInteger(parsed)) return null
  return value
}

export function mergeCounterTradeRuntimeWithRoomOverrides(
  base: CounterTradeRuntimeConfig,
  overrides: CounterTradeRoomConfigOverrides | null | undefined,
): CounterTradeRuntimeConfig {
  if (!overrides) return base
  return {
    ...base,
    ...(overrides.inverseRebalanceScalePct != null
      ? { inverseRebalanceScalePct: overrides.inverseRebalanceScalePct }
      : {}),
    ...(overrides.harvestTriggerRoiPct != null ? { harvestTriggerRoiPct: overrides.harvestTriggerRoiPct } : {}),
    ...(overrides.harvestFraction != null ? { harvestFraction: overrides.harvestFraction } : {}),
    ...(overrides.defendLiqDistancePct != null ? { defendLiqDistancePct: overrides.defendLiqDistancePct } : {}),
    ...(overrides.defendReduceFraction != null ? { defendReduceFraction: overrides.defendReduceFraction } : {}),
    ...(overrides.maxCounterNotionalPctOfFund != null
      ? { maxCounterNotionalPctOfFund: overrides.maxCounterNotionalPctOfFund }
      : {}),
    ...(overrides.maxCounterNotionalCeilingPctOfFund != null
      ? { maxCounterNotionalCeilingPctOfFund: overrides.maxCounterNotionalCeilingPctOfFund }
      : {}),
    ...(overrides.minReduceNotionalUsd != null ? { minReduceNotionalUsd: overrides.minReduceNotionalUsd } : {}),
    ...(overrides.dipDrawdownFullSizePct != null
      ? { dipDrawdownFullSizePct: overrides.dipDrawdownFullSizePct }
      : {}),
    ...(overrides.dipDrawdownCurveAlpha != null
      ? { dipDrawdownCurveAlpha: overrides.dipDrawdownCurveAlpha }
      : {}),
    ...(overrides.maxDipAddsPerLeg != null ? { maxDipAddsPerLeg: overrides.maxDipAddsPerLeg } : {}),
  }
}

function formatConfigValue(spec: CounterTradeConfigKeySpec, runtime: CounterTradeRuntimeConfig): string {
  const raw = runtime[spec.field as keyof CounterTradeRuntimeConfig]
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 'n/a'
  if (spec.asFractionOfHundred) return `${(raw * 100).toFixed(0)}%`
  if (spec.field === 'inverseRebalanceScalePct') return `${raw}%`
  if (spec.field === 'maxCounterNotionalPctOfFund' || spec.field === 'maxCounterNotionalCeilingPctOfFund') {
    return `${raw}%`
  }
  if (spec.field === 'dipDrawdownFullSizePct') return `${raw}%`
  if (spec.field === 'dipDrawdownCurveAlpha') return `${raw}`
  if (spec.field === 'maxDipAddsPerLeg') return `${raw}`
  if (spec.field === 'minReduceNotionalUsd') {
    return `$${raw}`
  }
  return `${raw}%`
}

function formatOverrideValue(spec: CounterTradeConfigKeySpec, value: number): string {
  if (spec.asFractionOfHundred) return `${(value * 100).toFixed(0)}%`
  if (spec.field === 'inverseRebalanceScalePct') return `${value}%`
  if (spec.field === 'maxCounterNotionalPctOfFund' || spec.field === 'maxCounterNotionalCeilingPctOfFund') {
    return `${value}%`
  }
  if (spec.field === 'dipDrawdownFullSizePct') return `${value}%`
  if (spec.field === 'dipDrawdownCurveAlpha') return `${value}`
  if (spec.field === 'maxDipAddsPerLeg') return `${value}`
  if (spec.field === 'minReduceNotionalUsd') {
    return `$${value}`
  }
  return `${value}%`
}

function formatSpecLine(
  spec: CounterTradeConfigKeySpec,
  params: { runtime: CounterTradeRuntimeConfig; overrides: CounterTradeRoomConfigOverrides },
  audience: 'room' | 'operator' = 'room',
): string {
  const effective = formatConfigValue(spec, params.runtime)
  if (audience === 'room') {
    return `• ${spec.label}: **${effective}**`
  }
  const overrideRaw = params.overrides[spec.field]
  const source =
    overrideRaw != null ? `room override ${formatOverrideValue(spec, overrideRaw)}` : 'platform default'
  return `• ${spec.label}: **${effective}** (${source})`
}

export type CounterTradeConfigAudience = 'room' | 'operator'

export function formatCounterTradeRoomPlaybookIntro(): string {
  return [
    '**Room playbook** (shared — same for everyone here)',
    '`/h start` · `/h stop` · `/h resume` · `/h status` · `/h rules`',
    'Start shows the 4-step walkthrough: resize sync → bank winners → safety → size cap.',
  ].join('\n')
}

/** Member-facing walkthrough after join or `/h setup`. Not user-configurable knobs. */
export function formatCounterTradeMemberOnboarding(params: {
  runtime: CounterTradeRuntimeConfig
  preset: string
}): string {
  const r = params.runtime
  const harvestTrimPct = Number.isFinite(r.harvestFraction) ? (r.harvestFraction * 100).toFixed(0) : '?'
  const defendCutPct = Number.isFinite(r.defendReduceFraction)
    ? (r.defendReduceFraction * 100).toFixed(0)
    : '?'
  const steps = [
    `**1 · When you resize** — bot syncs the pair at **${r.inverseRebalanceScalePct}%** of your move: banks green, refills red.`,
    `**2 · Banking winners** — trims green legs after **+${r.harvestTriggerRoiPct}%**, **${harvestTrimPct}%** each pass.`,
    `**3 · Safety** — trims early **${defendCutPct}%** when a leg is within **${r.defendLiqDistancePct}%** of liquidation.`,
    `**4 · Size cap** — each bot response stays under ${formatSizeCapForMembers(r)}.`,
  ]

  return [
    `**You're in** (${params.preset} preset). Here's how this room trades with you:`,
    '',
    ...steps,
    '',
    '_Shared room rules — not personal settings. Operators tune these for the whole room._',
    'Pause: `/h pause` · Full guide: `/h rules` · Replay: `/h setup`',
  ].join('\n')
}

/** Shown on `/h resume` before the user confirms. */
export function formatCounterTradeResumePreview(params: {
  runtime: CounterTradeRuntimeConfig
  preset: string
}): string {
  const r = params.runtime
  const harvestTrimPct = Number.isFinite(r.harvestFraction) ? (r.harvestFraction * 100).toFixed(0) : '?'
  const defendCutPct = Number.isFinite(r.defendReduceFraction)
    ? (r.defendReduceFraction * 100).toFixed(0)
    : '?'

  return [
    '**Resume mirrored trading?**',
    `Your preset: **${params.preset}**`,
    '',
    '**Current room playbook:**',
    `• Resize sync: **${r.inverseRebalanceScalePct}%** (green profit, red refill)`,
    `• Bank winners: after **+${r.harvestTriggerRoiPct}%**, trim **${harvestTrimPct}%**`,
    `• Safety: cut **${defendCutPct}%** within **${r.defendLiqDistancePct}%** of liq`,
    `• Size cap: ${formatSizeCapForMembers(r)}`,
    '',
    '_Shared room rules — confirm to turn mirroring back on._',
    '**`/h resume confirm`**',
  ].join('\n')
}

export function formatCounterTradeResumeConfirmed(params: { preset: string }): string {
  return [
    '**Mirroring resumed.**',
    `Preset: **${params.preset}**.`,
    'Pause anytime: `/h pause` · Guide: `/h rules`',
  ].join('\n')
}

function remapCounterTradeHArgs(tail: string): { command: '/s' | '/arena' | '/hermit'; args: string } | null {
  const trimmed = tail.trim()
  if (!trimmed) return { command: '/hermit', args: 'help' }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  const sub = parts[0].toLowerCase()
  const rest = parts.slice(1).join(' ')
  switch (sub) {
    case 'help':
    case '?':
      return { command: '/hermit', args: 'help' }
    case '1':
    case '2':
    case '3':
    case '4':
      return { command: '/arena', args: `positions ${sub}` }
    case 'arena':
    case 'a':
      return { command: '/arena', args: rest || 'status' }
    case 'positions':
    case 'pos':
    case 'position':
    case 'opens':
      return { command: '/arena', args: rest ? `positions ${rest}` : 'positions' }
    case 'join':
    case 'j':
    case 'copy':
    case 'start':
      return { command: '/s', args: rest ? `join ${rest}` : 'join' }
    case 'pause':
    case 'stop':
    case 'x':
      return { command: '/s', args: 'pause' }
    case 'resume':
    case 're':
      if (rest === 'confirm' || rest === 'yes') {
        return { command: '/s', args: 'resume confirm' }
      }
      return { command: '/s', args: 'resume' }
    case 'status':
    case 'st':
      return { command: '/s', args: '?' }
    case 'setup':
      return { command: '/s', args: 'setup' }
    case 'rules':
    case 'guide':
    case 'playbook':
      return { command: '/s', args: 'p' }
    case 'mirror':
    case 'sync':
    case 'sy':
      return { command: '/s', args: rest ? `sync ${rest}` : 'sync' }
    case 'profit':
    case 'lock':
    case 'bank':
    case 'ba':
      return { command: '/s', args: rest ? `bank ${rest}` : 'bank' }
    case 'risk':
    case 'guard':
    case 'safety':
    case 'safe':
    case 'sa':
      return { command: '/s', args: rest ? `safe ${rest}` : 'safe' }
    case 'size':
    case 'sz':
    case 'cap':
    case 'caps':
      return { command: '/s', args: rest ? `size ${rest}` : 'size' }
    case 'defaults':
    case 'reset':
    case 'rs':
      return { command: '/s', args: rest ? `reset ${rest}` : 'reset' }
    default:
      return null
  }
}

/** Remap `/h …` into strategy/arena/hermit command args. */
export function remapCounterTradeTopLevelCommand(
  command: string,
  args: string,
): { command: '/s' | '/arena' | '/hermit'; args: string } | null {
  const cmd = command.trim().toLowerCase()
  const tail = args.trim()

  if (cmd === '/h') {
    return remapCounterTradeHArgs(tail)
  }
  return null
}

export function formatCounterTradeSettingAnnouncement(params: {
  field: keyof CounterTradeRoomConfigOverrides
  rawValue: string
}): string {
  const suffix =
    params.field === 'maxCounterNotionalPctOfFund' ||
      params.field === 'maxCounterNotionalCeilingPctOfFund' ||
      params.field === 'minReduceNotionalUsd'
      ? ''
      : params.field === 'harvestFraction' ||
          params.field === 'defendReduceFraction' ||
          params.field.endsWith('Pct')
        ? '%'
        : ''
  const usdSuffix = params.field === 'minReduceNotionalUsd' ? ' USD' : ''
  const value = `${params.rawValue}${suffix}${usdSuffix}`

  switch (params.field) {
    case 'inverseRebalanceScalePct':
      return `**Room update** — When someone here adds or cuts size, the bot now syncs at **${value}** of that move: banks green, refills red.`
    case 'harvestTriggerRoiPct':
      return `**Room update** — The bot now starts banking winners after they are up **${value}**.`
    case 'harvestFraction':
      return `**Room update** — On green positions, the bot now trims **${value}** each pass to lock profit.`
    case 'defendLiqDistancePct':
      return `**Room update** — Safety trims now kick in **${value}** before liquidation.`
    case 'defendReduceFraction':
      return `**Room update** — When defending, the bot now cuts **${value}** of the at-risk leg.`
    case 'maxCounterNotionalPctOfFund':
      return `**Room update** — Each automated response is now capped at **${params.rawValue}%** of the trading fund.`
    case 'maxCounterNotionalCeilingPctOfFund':
      return `**Room update** — Hard max response size is now **${params.rawValue}%** of the trading fund.`
    case 'minReduceNotionalUsd':
      return `**Room update** — Smallest partial trim is now **$${params.rawValue}**.`
    case 'dipDrawdownFullSizePct':
      return `**Room update** — Dip adds now reach full target size at **${params.rawValue}%** adverse drawdown.`
    case 'dipDrawdownCurveAlpha':
      return `**Room update** — Dip sizing curve shape (alpha) is now **${params.rawValue}**.`
    case 'maxDipAddsPerLeg':
      return `**Room update** — Max dip adds per leg is now **${params.rawValue}**.`
    default: {
      const _exhaustive: never = params.field
      return _exhaustive
    }
  }
}

export function formatCounterTradeGroupResetAnnouncement(group: CounterTradeConfigGroup | 'all'): string {
  if (group === 'all') {
    return '**Room update** — Settings restored to the default playbook.'
  }
  return `**Room update** — ${COUNTER_TRADE_CONFIG_GROUP_META[group].resetBlurb}`
}

export function formatCounterTradeGroupStatus(params: {
  group: CounterTradeConfigGroup
  runtime: CounterTradeRuntimeConfig
  overrides: CounterTradeRoomConfigOverrides
  audience?: CounterTradeConfigAudience
}): string {
  const audience = params.audience ?? 'room'
  const meta = COUNTER_TRADE_CONFIG_GROUP_META[params.group]
  const specs = COUNTER_TRADE_CONFIG_KEY_SPECS.filter((spec) => spec.group === params.group)
  const lines = [
    audience === 'room' ? `**Room playbook · ${meta.title}**` : `**${meta.title}**`,
    meta.blurb,
    '',
  ]
  for (const spec of specs) {
    lines.push(formatSpecLine(spec, params, audience))
  }
  if (audience === 'operator') {
    lines.push('', groupCommandHint(params.group))
  }
  return lines.join('\n')
}

function groupCommandHint(group: CounterTradeConfigGroup): string {
  const word = primaryCounterTradeGroupCommand(group)
  switch (group) {
    case 'rebalance':
      return `Ops: \`/h ${word} 80\` · reset: \`/h reset ${word}\``
    case 'harvest':
      return `Ops: \`/h ${word} 50\` · \`/h ${word} trim 25\` · reset: \`/h reset ${word}\``
    case 'defend':
      return `Ops: \`/h ${word} 12\` · \`/h ${word} cut 25\` · reset: \`/h reset ${word}\``
    case 'limits':
      return `Ops: \`/h ${word} 10\` · \`/h ${word} max 25\` · \`/h ${word} depth 40\` · \`/h ${word} curve 1.5\` · \`/h ${word} adds 3\` · reset: \`/h reset ${word}\``
    default: {
      const _exhaustive: never = group
      return _exhaustive
    }
  }
}

export function formatCounterTradeConfigStatus(params: {
  runtime: CounterTradeRuntimeConfig
  overrides: CounterTradeRoomConfigOverrides
  group?: CounterTradeConfigGroup | 'all'
  audience?: CounterTradeConfigAudience
}): string {
  const audience = params.audience ?? 'room'
  if (params.group && params.group !== 'all') {
    return formatCounterTradeGroupStatus({
      group: params.group,
      runtime: params.runtime,
      overrides: params.overrides,
      audience,
    })
  }

  const lines = [
    formatCounterTradeRoomPlaybookIntro(),
    '',
    ...(['rebalance', 'harvest', 'defend', 'limits'] as const).flatMap((group) => {
      const meta = COUNTER_TRADE_CONFIG_GROUP_META[group]
      const specs = COUNTER_TRADE_CONFIG_KEY_SPECS.filter((spec) => spec.group === group)
      return [`**${meta.title}**`, ...specs.map((spec) => formatSpecLine(spec, params, audience)), '']
    }),
  ]
  if (audience === 'operator') {
    lines.push('_Ops:_ `/h mirror 80` · `/h profit trim 25` · `/h risk 12` · `/h defaults`')
  }
  return lines.join('\n')
}

export function formatCounterTradeConfigUsage(): string {
  return [
    '**Your commands**',
    '- `/h start` — opt in + 4-step room walkthrough',
    '- `/h stop` · `/h resume` — pause, or review playbook + confirm resume',
    '- `/h status` — am I in? paused?',
    '- `/h rules` — full room guide',
    '- `/h setup` — replay the 4-step walkthrough',
    '',
    '_Mirror / profit / risk / size are **room playbook** rules (shared), not personal settings._',
    '',
    '**Operators only**',
    '- `/h mirror 80` · `/h profit 50` · `/h profit trim 25`',
    '- `/h risk 12` · `/h size 10` · `/h size max 25` · `/h size depth 40` · `/h size curve 1.5` · `/h size adds 3` · `/h defaults`',
  ].join('\n')
}

export type ParsedCounterTradeConfigCommand =
  | { kind: 'show'; group: CounterTradeConfigGroup | 'all' }
  | {
      kind: 'set'
      field: keyof CounterTradeRoomConfigOverrides
      rawValue: string
      label: string
    }
  | { kind: 'reset'; group: CounterTradeConfigGroup | 'all' }

/** Parses `/pb`, `/s y|b|f|z`, short reset (`r`), and legacy long forms. */
export function parseCounterTradeConfigCommand(trimmed: string): ParsedCounterTradeConfigCommand | null {
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null

  if (parts.length === 1 && isPlaybookToken(parts[0])) {
    return { kind: 'show', group: 'all' }
  }

  if (parts[0] === 'reset' || parts[0] === 'r') {
    const target = parts[1] ?? 'all'
    if (target === 'all') return { kind: 'reset', group: 'all' }
    const group = resolveCounterTradeConfigGroupToken(target)
    if (group) return { kind: 'reset', group }
    return null
  }

  const group = resolveCounterTradeConfigGroupToken(parts[0])
  if (!group) return null

  if (parts.length === 1) return { kind: 'show', group }

  switch (group) {
    case 'rebalance':
      if (parts.length === 2) {
        return {
          kind: 'set',
          field: 'inverseRebalanceScalePct',
          rawValue: parts[1],
          label: 'Sync strength',
        }
      }
      return null
    case 'harvest':
      if (parts.length === 3 && isWhenToken(parts[1])) {
        return {
          kind: 'set',
          field: 'harvestTriggerRoiPct',
          rawValue: parts[2],
          label: 'Take profit after you are up',
        }
      }
      if (parts.length === 3 && isTakeToken(parts[1])) {
        return {
          kind: 'set',
          field: 'harvestFraction',
          rawValue: parts[2],
          label: 'How much we bank each time',
        }
      }
      if (parts.length === 2) {
        return {
          kind: 'set',
          field: 'harvestTriggerRoiPct',
          rawValue: parts[1],
          label: 'Take profit after you are up',
        }
      }
      return null
    case 'defend':
      if (parts.length === 3 && (isWhenToken(parts[1]) || parts[1] === 'liq')) {
        return {
          kind: 'set',
          field: 'defendLiqDistancePct',
          rawValue: parts[2],
          label: 'Start trimming this far from liq',
        }
      }
      if (parts.length === 3 && isTakeToken(parts[1])) {
        return {
          kind: 'set',
          field: 'defendReduceFraction',
          rawValue: parts[2],
          label: 'How much we cut when defending',
        }
      }
      if (parts.length === 2) {
        return {
          kind: 'set',
          field: 'defendLiqDistancePct',
          rawValue: parts[1],
          label: 'Start trimming this far from liq',
        }
      }
      return null
    case 'limits':
      if (parts.length === 3 && isMaxToken(parts[1])) {
        return {
          kind: 'set',
          field: 'maxCounterNotionalCeilingPctOfFund',
          rawValue: parts[2],
          label: 'Hard max (% of trading fund)',
        }
      }
      if (parts.length === 3 && isMinToken(parts[1])) {
        return {
          kind: 'set',
          field: 'minReduceNotionalUsd',
          rawValue: parts[2],
          label: 'Smallest partial trim',
        }
      }
      if (parts.length === 3 && isDepthToken(parts[1])) {
        return {
          kind: 'set',
          field: 'dipDrawdownFullSizePct',
          rawValue: parts[2],
          label: 'Full dip size at this drawdown (D)',
        }
      }
      if (parts.length === 3 && isCurveToken(parts[1])) {
        return {
          kind: 'set',
          field: 'dipDrawdownCurveAlpha',
          rawValue: parts[2],
          label: 'Dip curve shape (alpha)',
        }
      }
      if (parts.length === 3 && isAddsToken(parts[1])) {
        return {
          kind: 'set',
          field: 'maxDipAddsPerLeg',
          rawValue: parts[2],
          label: 'Max dip adds per leg',
        }
      }
      if (parts.length === 2) {
        return {
          kind: 'set',
          field: 'maxCounterNotionalPctOfFund',
          rawValue: parts[1],
          label: 'Response size (% of trading fund)',
        }
      }
      return null
    default: {
      const _exhaustive: never = group
      return _exhaustive
    }
  }
}

export function parseCounterTradeRoomConfigOverrides(
  raw: unknown,
): CounterTradeRoomConfigOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const input = raw as Record<string, unknown>
  const out: CounterTradeRoomConfigOverrides = {}
  for (const spec of COUNTER_TRADE_CONFIG_KEY_SPECS) {
    const value = input[spec.field]
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    out[spec.field] = value
  }
  return out
}
