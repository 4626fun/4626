export type ChatCommandRisk = 'read' | 'write'
export type ChatCommandMode = 'send' | 'prefill'
export type ChatCommandCategoryId =
  | 'vault'
  | 'cre'
  | 'wallet'
  | 'knowledge'
  | 'advanced'

export type ChatCommandCategory = {
  id: ChatCommandCategoryId
  label: string
}

export type ChatCommandDefinition = {
  id: string
  label: string
  description: string
  category: ChatCommandCategoryId
  command: string
  aliases?: readonly string[]
  risk: ChatCommandRisk
  mode: ChatCommandMode
  followUpIds?: readonly string[]
}

export const CHAT_COMMAND_CATEGORIES: readonly ChatCommandCategory[] = [
  { id: 'vault', label: 'Vault' },
  { id: 'cre', label: 'CRE' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'advanced', label: 'Advanced' },
]

const CHAT_COMMANDS: readonly ChatCommandDefinition[] = [
  {
    id: 'help',
    label: 'Command Help',
    description: 'Show all available commands.',
    category: 'vault',
    command: '/help',
    risk: 'read',
    mode: 'send',
    followUpIds: ['vault-status', 'cre-health'],
  },
  {
    id: 'ai-assistant',
    label: 'Ask AI',
    description: 'Prefill a vault assistant question.',
    category: 'knowledge',
    command: '/ai What should I do next?',
    risk: 'read',
    mode: 'prefill',
    followUpIds: ['vault-status', 'cre-health'],
  },
  {
    id: 'vault-status',
    label: 'Vault Status',
    description: 'Check current vault configuration and state.',
    category: 'vault',
    command: '/keepr status',
    risk: 'read',
    mode: 'send',
    followUpIds: ['vault-rules', 'cre-health'],
  },
  {
    id: 'vault-rules',
    label: 'Vault Rules',
    description: 'Show gating and access rules.',
    category: 'vault',
    command: '/keepr rules',
    risk: 'read',
    mode: 'send',
    followUpIds: ['vault-status'],
  },
  {
    id: 'cre-health',
    label: 'CRE Health',
    description: 'Run combined CRE health check.',
    category: 'cre',
    command: '/cre health',
    risk: 'read',
    mode: 'send',
    followUpIds: ['cre-status', 'cre-solana'],
  },
  {
    id: 'cre-status',
    label: 'CRE Status',
    description: 'Show vault keeper status.',
    category: 'cre',
    command: '/cre status',
    risk: 'read',
    mode: 'send',
    followUpIds: ['cre-health', 'cre-tend'],
  },
  {
    id: 'cre-solana',
    label: 'CRE Solana',
    description: 'Show Solana monitor status.',
    category: 'cre',
    command: '/cre solana',
    risk: 'read',
    mode: 'send',
    followUpIds: ['cre-health', 'cre-settle-fees', 'cre-relay-entries'],
  },
  {
    id: 'intel-template',
    label: 'Wallet Intel',
    description: 'Prefill wallet intelligence command template.',
    category: 'wallet',
    command: '/intel 0x...',
    risk: 'read',
    mode: 'prefill',
    followUpIds: ['labels-template', 'portfolio-template'],
  },
  {
    id: 'portfolio-template',
    label: 'Wallet Lookup',
    description: 'Prefill wallet command template.',
    category: 'wallet',
    command: '/wallet 0x...',
    risk: 'read',
    mode: 'prefill',
    followUpIds: ['intel-template'],
  },
  {
    id: 'labels-template',
    label: 'Address Labels',
    description: 'Prefill labels command template.',
    category: 'wallet',
    command: '/labels 0x...',
    risk: 'read',
    mode: 'prefill',
    followUpIds: ['intel-template'],
  },
  {
    id: 'knowledge-reputation',
    label: 'Knowledge: Reputation',
    description: 'Search local docs for reputation system details.',
    category: 'knowledge',
    command: '/knowledge how does onchain reputation work',
    risk: 'read',
    mode: 'send',
    followUpIds: ['help'],
  },
  {
    id: 'cre-tend',
    label: 'CRE Tend',
    description: 'Trigger vault tend operation.',
    category: 'advanced',
    command: '/cre tend',
    risk: 'write',
    mode: 'send',
    followUpIds: ['cre-status', 'cre-health'],
  },
  {
    id: 'cre-report',
    label: 'CRE Report',
    description: 'Trigger vault report operation.',
    category: 'advanced',
    command: '/cre report',
    risk: 'write',
    mode: 'send',
    followUpIds: ['cre-status', 'cre-health'],
  },
  {
    id: 'cre-settle-fees',
    label: 'CRE Settle Fees',
    description: 'Settle Solana fees to Base.',
    category: 'advanced',
    command: '/cre settle-fees',
    risk: 'write',
    mode: 'send',
    followUpIds: ['cre-solana', 'cre-health'],
  },
  {
    id: 'cre-relay-entries',
    label: 'CRE Relay Entries',
    description: 'Relay Solana lottery entries to Base.',
    category: 'advanced',
    command: '/cre relay-entries',
    risk: 'write',
    mode: 'send',
    followUpIds: ['cre-solana', 'cre-health'],
  },
]

const QUICK_ACTION_IDS = [
  'help',
  'vault-status',
  'cre-health',
  'cre-status',
] as const

const CHAT_COMMAND_BY_ID = new Map<string, ChatCommandDefinition>(
  CHAT_COMMANDS.map((entry) => [entry.id, entry]),
)

const CHAT_COMMAND_BY_NORMALIZED_COMMAND = new Map<string, ChatCommandDefinition>(
  CHAT_COMMANDS.flatMap((entry) => [
    [normalizeCommand(entry.command), entry] as const,
    ...(entry.aliases ?? []).map((alias) => [normalizeCommand(alias), entry] as const),
  ]),
)

function normalizeCommand(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function getCommandVariants(entry: ChatCommandDefinition): readonly string[] {
  return [entry.command, ...(entry.aliases ?? [])]
}

export function listQuickChatCommands(): ChatCommandDefinition[] {
  return QUICK_ACTION_IDS.map((id) => CHAT_COMMAND_BY_ID.get(id)).filter(
    (entry): entry is ChatCommandDefinition => Boolean(entry),
  )
}

export function listChatCommandsByCategory(categoryId: ChatCommandCategoryId): ChatCommandDefinition[] {
  return CHAT_COMMANDS.filter((entry) => entry.category === categoryId)
}

export function getChatCommandById(id: string): ChatCommandDefinition | null {
  return CHAT_COMMAND_BY_ID.get(id) ?? null
}

export function listAllChatCommands(): ChatCommandDefinition[] {
  return [...CHAT_COMMANDS]
}

export function getChatCommandByCommandText(commandText: string): ChatCommandDefinition | null {
  const normalized = normalizeCommand(commandText)
  if (!normalized) return null
  return CHAT_COMMAND_BY_NORMALIZED_COMMAND.get(normalized) ?? null
}

export function searchChatCommands(query: string, limit = 8): ChatCommandDefinition[] {
  const normalized = normalizeCommand(query)
  if (!normalized.startsWith('/')) return []

  const scored = CHAT_COMMANDS.map((entry) => {
    const normalizedLabel = entry.label.toLowerCase()
    const normalizedDescription = entry.description.toLowerCase()

    let score = 0
    for (const commandVariant of getCommandVariants(entry)) {
      const normalizedCommand = normalizeCommand(commandVariant)
      if (normalizedCommand === normalized) {
        score = Math.max(score, 100)
      } else if (normalizedCommand.startsWith(normalized)) {
        score = Math.max(score, 70)
      }
    }
    if (score === 0 && normalizedLabel.includes(normalized.replace(/^\//, ''))) score = 45
    else if (score === 0 && normalizedDescription.includes(normalized.replace(/^\//, ''))) score = 25

    if (entry.mode === 'send') score += 5
    return { entry, score }
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit))

  return scored.map((row) => row.entry)
}

export function inferCommandIdFromAgentText(text: string): string | null {
  const lower = text.toLowerCase()
  if (lower.includes('cre health')) return 'cre-health'
  if (lower.includes('cre status')) return 'cre-status'
  if (lower.includes('settle fees') || lower.includes('fee settlement') || lower.includes('fees settled')) return 'cre-settle-fees'
  if (lower.includes('relay entries') || lower.includes('entry relay') || lower.includes('entries relayed')) return 'cre-relay-entries'
  if (lower.includes('solana') && lower.includes('cre')) return 'cre-solana'
  if (lower.includes('keepr status') || lower.includes('vault status')) return 'vault-status'
  if (lower.includes('keepr rules') || lower.includes('gating')) return 'vault-rules'
  if (lower.includes('commands') || lower.includes('/help')) return 'help'
  return null
}

export function listChatFollowUps(commandId: string | null): ChatCommandDefinition[] {
  if (!commandId) return []
  const command = getChatCommandById(commandId)
  if (!command?.followUpIds?.length) return []
  return command.followUpIds
    .map((id) => CHAT_COMMAND_BY_ID.get(id))
    .filter((entry): entry is ChatCommandDefinition => Boolean(entry))
}
