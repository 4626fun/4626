export type NumberedCommandOption = {
  index: number
  command: string
  description: string
}

const DEFAULT_OPTIONS: readonly NumberedCommandOption[] = [
  { index: 1, command: '/help', description: 'see all commands' },
  { index: 2, command: '/keepr status', description: 'check this vault' },
  { index: 3, command: '/keepr health', description: 'check keeper health' },
  { index: 4, command: '/wallet', description: 'review wallet + positions' },
  { index: 5, command: '/ai <question>', description: 'ask in plain English' },
]

function renderNumberedOptions(options: readonly NumberedCommandOption[]): string[] {
  return options.map((entry) => `${entry.index}) ${entry.command} — ${entry.description}`)
}

export function formatNumberedCommandFallback(params?: {
  intro?: string
  includeHint?: string | null
}): string {
  const intro = params?.intro ?? 'Try one of these:'
  const lines = [intro, '', ...renderNumberedOptions(DEFAULT_OPTIONS)]
  const hint = String(params?.includeHint ?? '').trim()
  if (hint) lines.push('', hint)
  return lines.join('\n')
}

export function formatWelcomeNumberedOptions(): string {
  return [
    `o henlo! I'm Keepr, your 4626 assistant.`,
    '',
    'Start with one of these (you can also reply with a number):',
    '',
    ...renderNumberedOptions(DEFAULT_OPTIONS),
  ].join('\n')
}

export function formatAiPromptGuidance(): string {
  return 'Ask me anything about this vault or DeFi on Base — for example: `/ai what is idle liquidity?`'
}

const MENU_NUMBER_RE = /^(\d{1,2})$/

export type WelcomeMenuResolution =
  | { kind: 'passthrough' }
  | { kind: 'command'; resolvedText: string }
  | { kind: 'ai_prompt' }
  | { kind: 'invalid'; selection: string }

export function resolveWelcomeMenuSelection(index: number): WelcomeMenuResolution {
  const option = DEFAULT_OPTIONS.find((entry) => entry.index === index)
  if (!option) {
    return { kind: 'invalid', selection: String(index) }
  }
  if (option.command.startsWith('/ai')) {
    return { kind: 'ai_prompt' }
  }
  return { kind: 'command', resolvedText: option.command }
}

export function resolveInboundMenuText(input: string): WelcomeMenuResolution {
  const trimmed = String(input ?? '').trim()
  const match = trimmed.match(MENU_NUMBER_RE)
  if (!match) return { kind: 'passthrough' }
  return resolveWelcomeMenuSelection(Number(match[1]))
}
