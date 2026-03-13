export type ChatCommandRisk = 'read' | 'write'
export type ChatCommandMode = 'send' | 'prefill'
export type ChatCommandCategoryId =
  | 'vault'
  | 'market'
  | 'bankr'
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
  risk: ChatCommandRisk
  mode: ChatCommandMode
  followUpIds?: readonly string[]
}

export const CHAT_COMMAND_CATEGORIES: readonly ChatCommandCategory[] = [
  { id: 'vault', label: 'Vault' },
  { id: 'market', label: 'Market' },
  { id: 'bankr', label: 'Bankr' },
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
    followUpIds: ['vault-status', 'bankr-status', 'cre-health'],
  },
  {
    id: 'ai-assistant',
    label: 'Ask AI',
    description: 'Prefill a vault assistant question.',
    category: 'knowledge',
    command: '/ai What should I do next?',
    risk: 'read',
    mode: 'prefill',
    followUpIds: ['vault-status', 'market-quote-eth'],
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
    id: 'market-quote-eth',
    label: 'ETH Quote',
    description: 'Get current ETH quote snapshot.',
    category: 'market',
    command: '/mkt quote ETH',
    risk: 'read',
    mode: 'send',
    followUpIds: ['market-chart-eth'],
  },
  {
    id: 'market-chart-eth',
    label: 'ETH 1M Chart',
    description: 'Get 1 month ETH chart summary.',
    category: 'market',
    command: '/mkt chart ETH 1M',
    risk: 'read',
    mode: 'send',
    followUpIds: ['market-quote-eth'],
  },
  {
    id: 'bankr-status',
    label: 'Bankr Status',
    description: 'Verify Bankr config and canonical wallet match.',
    category: 'bankr',
    command: '/bankr status',
    risk: 'read',
    mode: 'send',
    followUpIds: ['bankr-me', 'bankr-balances'],
  },
  {
    id: 'bankr-me',
    label: 'Bankr Account',
    description: 'View current Bankr account metadata.',
    category: 'bankr',
    command: '/bankr me',
    risk: 'read',
    mode: 'send',
    followUpIds: ['bankr-balances', 'bankr-ask'],
  },
  {
    id: 'bankr-balances',
    label: 'Bankr Balances',
    description: 'View balances across Base and Solana.',
    category: 'bankr',
    command: '/bankr balances base,solana',
    risk: 'read',
    mode: 'send',
    followUpIds: ['bankr-status', 'bankr-ask'],
  },
  {
    id: 'bankr-ask',
    label: 'Bankr Ask',
    description: 'Ask Bankr a read-only question.',
    category: 'bankr',
    command: '/bankr ask summarize my current market exposure',
    risk: 'read',
    mode: 'send',
    followUpIds: ['bankr-status', 'bankr-balances'],
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
    followUpIds: ['cre-health', 'cre-flush-fees'],
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
    label: 'Portfolio Lookup',
    description: 'Prefill portfolio command template.',
    category: 'wallet',
    command: '/portfolio 0x...',
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
    id: 'bankr-exec-template',
    label: 'Bankr Write (Template)',
    description: 'Prefill write command template requiring explicit instruction.',
    category: 'advanced',
    command: '/bankr exec <instruction> --confirm',
    risk: 'write',
    mode: 'prefill',
    followUpIds: ['bankr-status'],
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
    id: 'cre-flush-fees',
    label: 'CRE Flush Fees',
    description: 'Trigger Solana fee flush operation.',
    category: 'advanced',
    command: '/cre flush-fees',
    risk: 'write',
    mode: 'send',
    followUpIds: ['cre-solana', 'cre-health'],
  },
]

const QUICK_ACTION_IDS = [
  'help',
  'vault-status',
  'bankr-status',
  'cre-health',
  'market-quote-eth',
] as const

const CHAT_COMMAND_BY_ID = new Map<string, ChatCommandDefinition>(
  CHAT_COMMANDS.map((entry) => [entry.id, entry]),
)

const CHAT_COMMAND_BY_NORMALIZED_COMMAND = new Map<string, ChatCommandDefinition>(
  CHAT_COMMANDS.map((entry) => [normalizeCommand(entry.command), entry]),
)

function normalizeCommand(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
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
    const normalizedCommand = normalizeCommand(entry.command)
    const normalizedLabel = entry.label.toLowerCase()
    const normalizedDescription = entry.description.toLowerCase()

    let score = 0
    if (normalizedCommand === normalized) score += 100
    else if (normalizedCommand.startsWith(normalized)) score += 70
    else if (normalizedLabel.includes(normalized.replace(/^\//, ''))) score += 45
    else if (normalizedDescription.includes(normalized.replace(/^\//, ''))) score += 25

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
  if (lower.includes('bankr status')) return 'bankr-status'
  if (lower.includes('bankr account') || lower.includes('/bankr me')) return 'bankr-me'
  if (lower.includes('bankr balances')) return 'bankr-balances'
  if (lower.includes('cre health')) return 'cre-health'
  if (lower.includes('cre status')) return 'cre-status'
  if (lower.includes('solana') && lower.includes('cre')) return 'cre-solana'
  if (lower.includes('keepr status') || lower.includes('vault status')) return 'vault-status'
  if (lower.includes('keepr rules') || lower.includes('gating')) return 'vault-rules'
  if (lower.includes('commands') || lower.includes('/help')) return 'help'
  if (lower.includes('chart') && lower.includes('eth')) return 'market-chart-eth'
  if (lower.includes('quote') && lower.includes('eth')) return 'market-quote-eth'
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

