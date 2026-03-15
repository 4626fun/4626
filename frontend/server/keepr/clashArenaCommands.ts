import { getDb } from '../_lib/postgres.js'
import {
  bindTelegramArenaWatchMatch,
  ensureTelegramTradingSchema,
  getTelegramArenaWatchByChatId,
  setTelegramArenaWatch,
} from '../_lib/telegramTrading.js'

type ClashArenaCommandResult =
  | { ok: true; response: string }
  | { ok: false; response: string }

type ClashArenaConfig = {
  apiKey: string
  baseUrl: string
}

type ClashZone = 'NW' | 'N' | 'NE' | 'W' | 'C' | 'E' | 'SW' | 'S' | 'SE'
type ClashZoneCommand = 'attack' | 'defend' | 'scout' | 'expand' | 'hold' | 'raid' | 'retreat'
type ClashDial = 'ECO' | 'TECH' | 'DEF' | 'AIR' | 'ASSIST'

type ClashTuningPayload = Partial<{
  attack_power: number
  eco_scale: number
  expansion: number
  retreat: number
  defense: number
  air_focus: number
  raid_power: number
  commander_safety: number
}>

type ClashArenaCommandContext = {
  chatId?: string
  userId?: string
}

const CLASH_API_DEFAULT_BASE_URL = 'https://clashofclaw.com/api/v1'
const CLASH_ZONE_RE = /^(NW|N|NE|W|C|E|SW|S|SE):(attack|defend|scout|expand|hold|raid|retreat)$/i
const CLASH_COMMANDER_RE = /^(?:commander|cmdr|comm)(?:=|:)(NW|N|NE|W|C|E|SW|S|SE)$/i
const CLASH_RULE_RE = /^(ECO|TECH|DEF|AIR|ASSIST):(\d{1,2})$/i
const CLASH_IDENTIFY_NAME_RE = /^[A-Za-z0-9_-]{3,24}$/

const CLASH_TUNING_ALIASES: Record<string, keyof ClashTuningPayload> = {
  attack: 'attack_power',
  attack_power: 'attack_power',
  eco: 'eco_scale',
  eco_scale: 'eco_scale',
  expansion: 'expansion',
  retreat: 'retreat',
  defense: 'defense',
  def: 'defense',
  air: 'air_focus',
  air_focus: 'air_focus',
  raid: 'raid_power',
  raid_power: 'raid_power',
  safety: 'commander_safety',
  commander_safety: 'commander_safety',
  cmdr_safety: 'commander_safety',
}

const CLASH_TUNING_LIMITS: Record<keyof ClashTuningPayload, { min: number; max: number }> = {
  attack_power: { min: 10, max: 300 },
  eco_scale: { min: 0.3, max: 3.0 },
  expansion: { min: 0.5, max: 3.0 },
  retreat: { min: 0.2, max: 0.9 },
  defense: { min: 0, max: 4 },
  air_focus: { min: 0, max: 2 },
  raid_power: { min: 5, max: 100 },
  commander_safety: { min: 1, max: 30 },
}

function asTrimmed(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeBaseUrl(raw: string): string {
  const cleaned = asTrimmed(raw).replace(/\/+$/, '')
  return cleaned || CLASH_API_DEFAULT_BASE_URL
}

function cleanApiMessage(value: unknown): string {
  const raw = asTrimmed(value)
  if (!raw) return ''
  return raw.length <= 300 ? raw : `${raw.slice(0, 297)}...`
}

function readArenaWatchPollSeconds(): number {
  const raw = Number(process.env.TELEGRAM_ARENA_WATCH_POLL_SECONDS ?? 60)
  if (!Number.isFinite(raw) || raw <= 0) return 60
  return Math.max(15, Math.min(60 * 60, Math.floor(raw)))
}

function readClashArenaConfig(): { ok: true; config: ClashArenaConfig } | { ok: false; response: string } {
  const apiKey = asTrimmed(process.env.CLASH_OF_CLAW_API_KEY ?? process.env.ARENA_API_KEY ?? '')
  if (!apiKey) {
    return {
      ok: false,
      response: [
        'Arena command unavailable.',
        '',
        '- missing API key: set `CLASH_OF_CLAW_API_KEY` (or `ARENA_API_KEY`)',
        '- then retry your `/arena ...` command',
      ].join('\n'),
    }
  }
  return {
    ok: true,
    config: {
      apiKey,
      baseUrl: normalizeBaseUrl(process.env.CLASH_OF_CLAW_BASE_URL ?? CLASH_API_DEFAULT_BASE_URL),
    },
  }
}

function splitArenaArgs(tokens: string[]): string[] {
  const args: string[] = []
  for (const token of tokens) {
    const parts = token.split(',').map((part) => asTrimmed(part)).filter(Boolean)
    if (parts.length === 0) continue
    args.push(...parts)
  }
  return args
}

function formatArenaNextStep(payload: any): string | null {
  const nextAction = asTrimmed(payload?.next_step?.action)
  const nextDescription = asTrimmed(payload?.next_step?.description)
  if (!nextAction && !nextDescription) return null
  if (nextAction && nextDescription) return `next: ${nextAction} — ${nextDescription}`
  return `next: ${nextAction || nextDescription}`
}

function parseRulesTokens(tokens: string[]): { ok: true; rules: string[] } | { ok: false; response: string } {
  const byDial = new Map<ClashDial, number>()
  for (const token of tokens) {
    const match = token.match(CLASH_RULE_RE)
    if (!match) {
      return {
        ok: false,
        response: `Invalid rule token: \`${token}\`. Expected format like \`ECO:6\`, \`TECH:7\`, \`DEF:4\`, \`AIR:3\`, \`ASSIST:6\`.`,
      }
    }
    const dial = match[1]!.toUpperCase() as ClashDial
    const value = Number(match[2]!)
    if (!Number.isInteger(value) || value < 0 || value > 10) {
      return { ok: false, response: `Dial out of range for \`${dial}\`: ${value}. Allowed range is 0-10.` }
    }
    byDial.set(dial, value)
  }
  if (byDial.size === 0) {
    return {
      ok: false,
      response: 'No rules supplied. Example: `/arena rules ECO:6 TECH:7 DEF:4 AIR:3 ASSIST:6`',
    }
  }
  return {
    ok: true,
    rules: Array.from(byDial.entries()).map(([dial, value]) => `${dial}:${value}`),
  }
}

function parseTuningTokens(tokens: string[]): { ok: true; tuning: ClashTuningPayload } | { ok: false; response: string } {
  const tuning: ClashTuningPayload = {}
  for (const token of tokens) {
    const eqIdx = token.indexOf('=')
    if (eqIdx <= 0) {
      return {
        ok: false,
        response: `Invalid tuning token: \`${token}\`. Expected key=value, for example \`attack=100\` or \`eco=2.1\`.`,
      }
    }
    const keyRaw = asTrimmed(token.slice(0, eqIdx)).toLowerCase().replace(/-/g, '_')
    const valueRaw = asTrimmed(token.slice(eqIdx + 1))
    const tuningKey = CLASH_TUNING_ALIASES[keyRaw]
    if (!tuningKey) {
      return {
        ok: false,
        response: `Unknown tuning key: \`${keyRaw}\`. Use keys like attack, eco, expansion, retreat, defense, air, raid, safety.`,
      }
    }
    const value = Number(valueRaw)
    const limits = CLASH_TUNING_LIMITS[tuningKey]
    if (!Number.isFinite(value) || value < limits.min || value > limits.max) {
      return {
        ok: false,
        response: `Tuning \`${keyRaw}\` out of range: ${valueRaw}. Allowed range is ${limits.min}-${limits.max}.`,
      }
    }
    tuning[tuningKey] = value
  }
  if (Object.keys(tuning).length === 0) {
    return {
      ok: false,
      response:
        'No tuning supplied. Example: `/arena tune attack=100 eco=2.1 expansion=2.4 retreat=0.55 defense=1.3 air=0.4 raid=14 safety=8`',
    }
  }
  return { ok: true, tuning }
}

function parseControlTokens(tokens: string[]): {
  ok: true
  rules: string[]
  zones: Partial<Record<ClashZone, ClashZoneCommand>>
  commander: ClashZone | null
} | {
  ok: false
  response: string
} {
  const byDial = new Map<ClashDial, number>()
  const zones: Partial<Record<ClashZone, ClashZoneCommand>> = {}
  let commander: ClashZone | null = null

  for (const token of tokens) {
    const commanderMatch = token.match(CLASH_COMMANDER_RE)
    if (commanderMatch) {
      commander = commanderMatch[1]!.toUpperCase() as ClashZone
      continue
    }

    const ruleMatch = token.match(CLASH_RULE_RE)
    if (ruleMatch) {
      const dial = ruleMatch[1]!.toUpperCase() as ClashDial
      const value = Number(ruleMatch[2]!)
      if (!Number.isInteger(value) || value < 0 || value > 10) {
        return { ok: false, response: `Dial out of range for \`${dial}\`: ${value}. Allowed range is 0-10.` }
      }
      byDial.set(dial, value)
      continue
    }

    const zoneMatch = token.match(CLASH_ZONE_RE)
    if (zoneMatch) {
      const zone = zoneMatch[1]!.toUpperCase() as ClashZone
      const command = zoneMatch[2]!.toLowerCase() as ClashZoneCommand
      zones[zone] = command
      continue
    }

    return {
      ok: false,
      response: `Unknown control token: \`${token}\`. Use rules like \`ECO:6\`, zones like \`C:attack\`, and commander like \`commander=SW\`.`,
    }
  }

  return {
    ok: true,
    rules: Array.from(byDial.entries()).map(([dial, value]) => `${dial}:${value}`),
    zones,
    commander,
  }
}

async function callArenaApi(params: {
  config: ClashArenaConfig
  method: 'GET' | 'POST'
  path: string
  body?: Record<string, unknown>
}): Promise<{ ok: true; payload: any } | { ok: false; response: string }> {
  const path = params.path.startsWith('/') ? params.path : `/${params.path}`
  const url = `${params.config.baseUrl}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${params.config.apiKey}`,
  }
  if (params.body) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    const response = await fetch(url, {
      method: params.method,
      headers,
      ...(params.body ? { body: JSON.stringify(params.body) } : {}),
    })
    const rawText = await response.text()
    let payload: any = null
    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch {
      payload = rawText
    }
    if (!response.ok) {
      const detail =
        cleanApiMessage(payload?.error) ||
        cleanApiMessage(payload?.detail) ||
        cleanApiMessage(payload?.message) ||
        cleanApiMessage(rawText) ||
        response.statusText
      return {
        ok: false,
        response: `Arena API request failed (${response.status}): ${detail || 'unknown error'}`,
      }
    }
    return { ok: true, payload }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, response: `Arena API request failed: ${cleanApiMessage(message) || 'network error'}` }
  }
}

function formatArenaIdentifyResponse(payload: any): ClashArenaCommandResult {
  if (payload?.success === false) {
    return { ok: false, response: cleanApiMessage(payload?.error) || 'Arena identify failed.' }
  }
  const lines = [
    'Arena identity updated.',
    '',
    `- name: ${asTrimmed(payload?.name) || 'unknown'}`,
    `- agent_id: ${asTrimmed(payload?.agent_id) || 'unknown'}`,
  ]
  const next = formatArenaNextStep(payload)
  if (next) lines.push(`- ${next}`)
  return { ok: true, response: lines.join('\n') }
}

function formatArenaFindResponse(payload: any): ClashArenaCommandResult {
  if (payload?.success === false) {
    return { ok: false, response: cleanApiMessage(payload?.error) || 'Arena match search failed.' }
  }
  if (payload?.match) {
    const match = payload.match
    const lines = [
      'Arena match found.',
      '',
      `- match_id: ${asTrimmed(match?.match_id) || 'unknown'}`,
      `- you: ${asTrimmed(payload?.your_name) || 'unknown'}`,
      `- opponent: ${asTrimmed(payload?.opponent_name) || 'unknown'}`,
      `- map: ${asTrimmed(match?.map_name) || 'unknown'}`,
      `- state: ${asTrimmed(match?.state) || 'unknown'}`,
    ]
    const next = formatArenaNextStep(payload)
    if (next) lines.push(`- ${next}`)
    return { ok: true, response: lines.join('\n') }
  }
  const lines = [
    'Arena search queued.',
    '',
    `- searching: ${String(Boolean(payload?.searching))}`,
    `- poll_interval_seconds: ${String(payload?.poll_interval_seconds ?? 'n/a')}`,
    `- search_seconds: ${String(payload?.search_seconds ?? 'n/a')}`,
  ]
  const next = formatArenaNextStep(payload)
  if (next) lines.push(`- ${next}`)
  return { ok: true, response: lines.join('\n') }
}

function formatArenaStateResponse(payload: any): ClashArenaCommandResult {
  if (payload?.success === false) {
    const error = cleanApiMessage(payload?.error) || 'Arena state unavailable.'
    if (error.toLowerCase().includes('match not running')) {
      return {
        ok: true,
        response: ['Arena state', '', '- match: not running', '- next: /arena find'].join('\n'),
      }
    }
    return { ok: false, response: error }
  }

  if (asTrimmed(payload?.phase).toLowerCase() === 'pregame') {
    const state = payload?.state ?? {}
    const lines = [
      'Arena pregame',
      '',
      `- map: ${asTrimmed(state?.map_name) || 'unknown'}`,
      `- spawn: ${asTrimmed(state?.your_spawn) || 'unknown'} vs ${asTrimmed(state?.enemy_spawn) || 'unknown'}`,
      `- pregame_remaining_seconds: ${String(payload?.pregame_remaining_seconds ?? 'n/a')}`,
      `- strategy_submitted: ${String(Boolean(payload?.strategy_submitted))}`,
    ]
    const next = formatArenaNextStep(payload)
    if (next) lines.push(`- ${next}`)
    return { ok: true, response: lines.join('\n') }
  }

  const state = payload?.state ?? {}
  const lines = [
    'Arena state',
    '',
    `- time: ${asTrimmed(state?.game?.time ?? state?.time) || 'n/a'}`,
    `- tech_tier: ${String(state?.military?.techTier ?? 'n/a')}`,
    `- army_value: ${String(state?.military?.armyValue ?? 'n/a')}`,
    `- enemy_estimate: ${String(state?.intel?.enemyArmyEstimate ?? 'n/a')}`,
    `- map_visibility: ${String(state?.strategic?.mapVisibility ?? 'n/a')}`,
    `- metal_stalling: ${String(state?.economy?.stallingResource ?? (state?.economy?.isStalling ? 'yes' : 'no'))}`,
    `- game_over: ${String(Boolean(payload?.game_over))}`,
  ]
  const next = formatArenaNextStep(payload)
  if (next) lines.push(`- ${next}`)
  return { ok: true, response: lines.join('\n') }
}

function formatArenaResultResponse(payload: any): ClashArenaCommandResult {
  if (payload?.success === false) {
    return { ok: false, response: cleanApiMessage(payload?.error) || 'Arena result unavailable.' }
  }
  const lines = [
    'Arena result',
    '',
    `- match_id: ${asTrimmed(payload?.match_id) || 'n/a'}`,
    `- status: ${asTrimmed(payload?.status) || 'n/a'}`,
    `- game_over: ${String(Boolean(payload?.game_over))}`,
    `- duration_seconds: ${String(payload?.duration_seconds ?? 'n/a')}`,
  ]
  const result = payload?.result
  if (result !== null && result !== undefined) {
    if (typeof result === 'string') {
      lines.push(`- result: ${result}`)
    } else {
      lines.push(`- result: ${JSON.stringify(result)}`)
    }
  } else {
    lines.push('- result: pending')
  }
  return { ok: true, response: lines.join('\n') }
}

function formatArenaPostedControlResponse(params: {
  payload: any
  summaryLabel: string
  summaryValue: string
}): ClashArenaCommandResult {
  if (params.payload?.success === false) {
    return { ok: false, response: cleanApiMessage(params.payload?.error) || 'Arena control command failed.' }
  }
  const lines = ['Arena control sent.', '', `- ${params.summaryLabel}: ${params.summaryValue}`]
  const tuningApplied = params.payload?.tuning_applied
  if (tuningApplied && typeof tuningApplied === 'object') {
    lines.push(`- tuning_applied: ${JSON.stringify(tuningApplied)}`)
  }
  const next = formatArenaNextStep(params.payload)
  if (next) lines.push(`- ${next}`)
  return { ok: true, response: lines.join('\n') }
}

export function isClashArenaCommand(rawLower: string): boolean {
  return /^\/arena(\s|$)/.test(rawLower) || /^arena(\s|$)/.test(rawLower)
}

export function formatClashArenaHelpTopic(): string {
  return [
    '<b>Keepr — arena</b>',
    '',
    '<blockquote>Control Clash of Claw (Beyond All Reason) from Telegram.</blockquote>',
    formatCommandLine('/arena identify <name>', 'register commander name (3-24 chars)'),
    formatCommandLine('/arena play', 'one-tap: enable watch + search for a match'),
    formatCommandLine('/arena find', 'search for a match'),
    formatCommandLine('/arena state', 'current game state snapshot'),
    formatCommandLine('/arena result', 'latest match result'),
    formatCommandLine('/arena tune attack=100 eco=2.1 expansion=2.4 retreat=0.55 defense=1.3 air=0.4 raid=14 safety=8', 'set pregame tuning'),
    formatCommandLine('/arena rules ECO:6 TECH:7 DEF:4 AIR:3 ASSIST:6', 'update production dials (0-10)'),
    formatCommandLine('/arena zones C:attack W:defend N:scout commander=SW', 'zone orders + commander move'),
    formatCommandLine('/arena control ECO:6 TECH:7 C:attack NE:scout commander=SW', 'combined dials + zones'),
    formatCommandLine('/arena watch on | off | status', 'Telegram live state updates every minute'),
    '',
    '<blockquote>Env: set <code>CLASH_OF_CLAW_API_KEY</code> (or <code>ARENA_API_KEY</code>).</blockquote>',
    '<blockquote>Need everything? <code>/help all</code></blockquote>',
  ].join('\n')
}

function formatCommandLine(command: string, description: string): string {
  return `<code>${command}</code> — ${description}`
}

export async function handleClashArenaCommand(rawText: string): Promise<ClashArenaCommandResult> {
  return handleClashArenaCommandWithContext(rawText, {})
}

export async function handleClashArenaCommandWithContext(
  rawText: string,
  context: ClashArenaCommandContext,
): Promise<ClashArenaCommandResult> {
  const raw = asTrimmed(rawText)
  const parts = raw.split(/\s+/g).filter(Boolean)
  const prefix = asTrimmed(parts[0]).toLowerCase()
  if (prefix !== '/arena' && prefix !== 'arena') {
    return { ok: false, response: '' }
  }

  const subcommand = asTrimmed(parts[1] ?? 'help').toLowerCase()
  const rawArgs = splitArenaArgs(parts.slice(2))

  if (subcommand === 'help') {
    return { ok: true, response: formatClashArenaHelpTopic() }
  }

  if (subcommand === 'watch' || subcommand === 'stream') {
    const chatId = asTrimmed(context.chatId)
    if (!chatId) {
      return {
        ok: false,
        response: 'Arena watch is available from Telegram chats only. Try this command in Telegram: `/arena watch on`.',
      }
    }
    const db = await getDb()
    if (!db) {
      return { ok: false, response: 'Arena watch unavailable: database is not configured.' }
    }
    await ensureTelegramTradingSchema(db as any)
    const action = asTrimmed(rawArgs[0] ?? 'status').toLowerCase()

    if (!action || action === 'status') {
      const current = await getTelegramArenaWatchByChatId({
        db: db as any,
        chatId,
      })
      if (!current) {
        return {
          ok: true,
          response: ['Arena watch', '', '- enabled: false', '- status: not configured', '- command: /arena watch on'].join('\n'),
        }
      }
      return {
        ok: true,
        response: [
          'Arena watch',
          '',
          `- enabled: ${String(current.enabled)}`,
          `- poll_seconds: ${readArenaWatchPollSeconds()}`,
          `- watch_match_id: ${current.watchMatchId || 'unbound (run /arena play or /arena find)'}`,
          `- last_phase: ${current.lastPhase || 'n/a'}`,
          `- last_game_time: ${current.lastGameTime || 'n/a'}`,
          `- last_pushed_at: ${current.lastPushedAt || 'n/a'}`,
          `- next_poll_after: ${current.nextPollAfter || 'n/a'}`,
          `- last_error: ${current.lastError || 'none'}`,
        ].join('\n'),
      }
    }

    if (action === 'on' || action === 'start' || action === 'enable') {
      const watch = await setTelegramArenaWatch({
        db: db as any,
        chatId,
        enabled: true,
        requestedByUserId: asTrimmed(context.userId) || null,
      })
      if (!watch) {
        return { ok: false, response: 'Arena watch could not be enabled for this chat.' }
      }
      const hasApiKey = Boolean(asTrimmed(process.env.CLASH_OF_CLAW_API_KEY ?? process.env.ARENA_API_KEY ?? ''))
      const lines = [
        'Arena watch enabled.',
        '',
        `- poll_seconds: ${readArenaWatchPollSeconds()}`,
        '- scope: your bound match only',
        '- next: run /arena play, /arena find, or /arena state to bind match_id',
        '- updates: pushed automatically when state changes',
        '- disable: /arena watch off',
      ]
      if (!hasApiKey) {
        lines.push('- warning: missing CLASH_OF_CLAW_API_KEY, so updates will not flow yet')
      }
      return { ok: true, response: lines.join('\n') }
    }

    if (action === 'off' || action === 'stop' || action === 'disable') {
      const watch = await setTelegramArenaWatch({
        db: db as any,
        chatId,
        enabled: false,
        requestedByUserId: asTrimmed(context.userId) || null,
      })
      if (!watch) {
        return { ok: false, response: 'Arena watch could not be disabled for this chat.' }
      }
      return { ok: true, response: 'Arena watch disabled for this chat.' }
    }

    return {
      ok: false,
      response: 'Usage: `/arena watch on`, `/arena watch off`, or `/arena watch status`.',
    }
  }

  const configResult = readClashArenaConfig()
  if (!configResult.ok) return configResult
  const config = configResult.config

  if (subcommand === 'identify') {
    const name = asTrimmed(rawArgs[0])
    if (!CLASH_IDENTIFY_NAME_RE.test(name)) {
      return {
        ok: false,
        response: 'Usage: `/arena identify <name>` where name is 3-24 chars using letters, numbers, hyphen, or underscore.',
      }
    }
    const identify = await callArenaApi({
      config,
      method: 'POST',
      path: '/agents/identify',
      body: { name },
    })
    if (!identify.ok) return identify
    return formatArenaIdentifyResponse(identify.payload)
  }

  if (subcommand === 'find' || subcommand === 'play' || subcommand === 'match') {
    const chatId = asTrimmed(context.chatId)
    const requestedByUserId = asTrimmed(context.userId) || null
    let db: any = null
    let playWatchEnabled = false
    if (subcommand === 'play' && chatId) {
      db = await getDb()
      if (db) {
        await ensureTelegramTradingSchema(db as any)
        const watch = await setTelegramArenaWatch({
          db: db as any,
          chatId,
          enabled: true,
          requestedByUserId,
        })
        playWatchEnabled = Boolean(watch?.enabled)
      }
    }

    const find = await callArenaApi({
      config,
      method: 'POST',
      path: '/matches/find',
    })
    if (!find.ok) return find
    const formatted = formatArenaFindResponse(find.payload)
    if (!formatted.ok) return formatted

    const matchId = asTrimmed(find.payload?.match?.match_id)
    let responseText = formatted.response
    if (playWatchEnabled) {
      responseText = `${responseText}\n- watch: enabled`
    }
    if (chatId && matchId) {
      if (!db) {
        db = await getDb()
      }
      if (db) {
        await ensureTelegramTradingSchema(db as any)
        const bound = await bindTelegramArenaWatchMatch({
          db: db as any,
          chatId,
          matchId,
          requestedByUserId,
        })
        if (bound?.enabled) {
          return {
            ok: true,
            response: `${responseText}\n- watch_bound_match_id: ${matchId}`,
          }
        }
      }
    }
    return { ok: true, response: responseText }
  }

  if (subcommand === 'state' || subcommand === 'status') {
    const state = await callArenaApi({
      config,
      method: 'GET',
      path: '/game/state',
    })
    if (!state.ok) return state
    const formatted = formatArenaStateResponse(state.payload)
    if (!formatted.ok) return formatted

    const chatId = asTrimmed(context.chatId)
    const matchId = asTrimmed(state.payload?.match_id ?? state.payload?.state?.match_id)
    if (chatId && matchId) {
      const db = await getDb()
      if (db) {
        await ensureTelegramTradingSchema(db as any)
        const current = await getTelegramArenaWatchByChatId({
          db: db as any,
          chatId,
        })
        if (current?.enabled) {
          const bound = await bindTelegramArenaWatchMatch({
            db: db as any,
            chatId,
            matchId,
            requestedByUserId: asTrimmed(context.userId) || null,
          })
          if (bound?.enabled) {
            return {
              ok: true,
              response: `${formatted.response}\n- watch_bound_match_id: ${matchId}`,
            }
          }
        }
      }
    }
    return formatted
  }

  if (subcommand === 'result') {
    const result = await callArenaApi({
      config,
      method: 'GET',
      path: '/match/result',
    })
    if (!result.ok) return result
    return formatArenaResultResponse(result.payload)
  }

  if (subcommand === 'tune' || subcommand === 'tuning') {
    const tuningParsed = parseTuningTokens(rawArgs)
    if (!tuningParsed.ok) return tuningParsed
    const sent = await callArenaApi({
      config,
      method: 'POST',
      path: '/command',
      body: { tuning: tuningParsed.tuning },
    })
    if (!sent.ok) return sent
    return formatArenaPostedControlResponse({
      payload: sent.payload,
      summaryLabel: 'tuning',
      summaryValue: JSON.stringify(tuningParsed.tuning),
    })
  }

  if (subcommand === 'rules' || subcommand === 'dials') {
    const rulesParsed = parseRulesTokens(rawArgs)
    if (!rulesParsed.ok) return rulesParsed
    const sent = await callArenaApi({
      config,
      method: 'POST',
      path: '/command',
      body: { rules: rulesParsed.rules },
    })
    if (!sent.ok) return sent
    return formatArenaPostedControlResponse({
      payload: sent.payload,
      summaryLabel: 'rules',
      summaryValue: rulesParsed.rules.join(' '),
    })
  }

  if (subcommand === 'zones') {
    const control = parseControlTokens(rawArgs)
    if (!control.ok) return control
    if (control.rules.length > 0) {
      return {
        ok: false,
        response: 'Use `/arena rules ...` for dials or `/arena control ...` to combine dials + zones in one command.',
      }
    }
    if (Object.keys(control.zones).length === 0 && !control.commander) {
      return {
        ok: false,
        response: 'No zone directives supplied. Example: `/arena zones C:attack W:defend commander=SW`',
      }
    }
    const sent = await callArenaApi({
      config,
      method: 'POST',
      path: '/command',
      body: {
        ...(Object.keys(control.zones).length > 0 ? { zones: control.zones } : {}),
        ...(control.commander ? { commander: control.commander } : {}),
      },
    })
    if (!sent.ok) return sent
    const zonePairs = Object.entries(control.zones).map(([zone, command]) => `${zone}:${command}`)
    const summary = [...zonePairs, ...(control.commander ? [`commander=${control.commander}`] : [])].join(' ')
    return formatArenaPostedControlResponse({
      payload: sent.payload,
      summaryLabel: 'zones',
      summaryValue: summary || 'n/a',
    })
  }

  if (subcommand === 'control' || subcommand === 'command' || subcommand === 'set') {
    const control = parseControlTokens(rawArgs)
    if (!control.ok) return control
    const hasRules = control.rules.length > 0
    const hasZones = Object.keys(control.zones).length > 0
    const hasCommander = Boolean(control.commander)
    if (!hasRules && !hasZones && !hasCommander) {
      return {
        ok: false,
        response:
          'No control directives supplied. Example: `/arena control ECO:6 TECH:7 C:attack NE:scout commander=SW`',
      }
    }
    const sent = await callArenaApi({
      config,
      method: 'POST',
      path: '/command',
      body: {
        ...(hasRules ? { rules: control.rules } : {}),
        ...(hasZones ? { zones: control.zones } : {}),
        ...(hasCommander ? { commander: control.commander } : {}),
      },
    })
    if (!sent.ok) return sent
    const detailParts: string[] = []
    if (hasRules) detailParts.push(control.rules.join(' '))
    if (hasZones) {
      const zonePairs = Object.entries(control.zones).map(([zone, command]) => `${zone}:${command}`)
      detailParts.push(zonePairs.join(' '))
    }
    if (hasCommander) detailParts.push(`commander=${control.commander}`)
    return formatArenaPostedControlResponse({
      payload: sent.payload,
      summaryLabel: 'control',
      summaryValue: detailParts.join(' | '),
    })
  }

  return {
    ok: false,
    response: [
      `Unknown arena command: \`${subcommand}\`.`,
      '',
      'Try `/arena help` for usage.',
    ].join('\n'),
  }
}
