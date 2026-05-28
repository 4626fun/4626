export type CommandScope = 'private' | 'group' | 'admin'

export type TelegramBotMenuCommand = {
  command: string
  description: string
}

type CommandFamily =
  | 'start'
  | 'help'
  | 'keepr'
  | 'id'
  | 'whois'
  | 'link'
  | 'status'
  | 'unlink'
  | 'zora'
  | 'deploy'
  | 'vaultdeploy'
  | 'join'
  | 'rooms'
  | 'eligibility'
  | 'wallet'
  | 'alfaclub'
  | 'vaults'
  | 'auctions'
  | 'mybids'
  | 'buy'
  | 'sell'
  | 'bid'
  | 'twitter'
  | 'ai'
  | 'coin'
  | 'send'
  | 'hermit'

type CommandDefinition = {
  head: string
  family: CommandFamily
  aliases?: readonly string[]
  telegramNative?: boolean
  botMenu?: Partial<Record<CommandScope, string>>
}

const COMMAND_DEFINITIONS: readonly CommandDefinition[] = [
  {
    head: 'start',
    family: 'start',
    telegramNative: true,
    botMenu: {
      private: 'Open the main menu',
      group: 'Open the main menu',
      admin: 'Open the main menu',
    },
  },
  {
    head: 'id',
    family: 'id',
    aliases: ['getid', 'get_id'],
    telegramNative: true,
    botMenu: {
      private: 'Pick a user, group, or channel ID',
      admin: 'Pick a user, group, or channel ID',
    },
  },
  {
    head: 'help',
    family: 'help',
    botMenu: {
      private: 'Show available commands',
      group: 'Show available commands',
      admin: 'Show available commands',
    },
  },
  { head: 'keepr', family: 'keepr' },
  { head: 'whois', family: 'whois' },
  {
    head: 'link',
    family: 'link',
    telegramNative: true,
    botMenu: {
      private: 'Link Telegram to your 4626 account',
      group: 'Link Telegram to your 4626 account',
      admin: 'Link Telegram to your 4626 account',
    },
  },
  {
    head: 'status',
    family: 'status',
    telegramNative: true,
    botMenu: {
      private: 'Check wallet link status',
    },
  },
  { head: 'unlink', family: 'unlink', telegramNative: true },
  { head: 'zora', family: 'zora', telegramNative: true },
  {
    head: 'vaultdeploy',
    family: 'vaultdeploy',
    telegramNative: true,
  },
  {
    head: 'deploy',
    family: 'deploy',
    telegramNative: true,
    botMenu: {
      admin: 'Deploy a vault',
    },
  },
  { head: 'join', family: 'join', telegramNative: true },
  { head: 'rooms', family: 'rooms', telegramNative: true },
  { head: 'eligibility', family: 'eligibility', telegramNative: true },
  {
    head: 'wallet',
    family: 'wallet',
    telegramNative: true,
    botMenu: {
      private: 'Your wallet, positions, and actions',
      admin: 'Linked wallet activity',
    },
  },
  {
    head: 'alfa',
    family: 'alfaclub',
    aliases: ['alfaclub'],
  },
  {
    head: 'bridge',
    family: 'alfaclub',
    aliases: [],
  },
  {
    head: 'vaults',
    family: 'vaults',
    telegramNative: true,
    botMenu: {
      private: 'Browse vaults',
      group: 'Vaults in this chat',
      admin: 'Vaults in this chat',
    },
  },
  { head: 'auctions', family: 'auctions', telegramNative: true },
  { head: 'mybids', family: 'mybids', telegramNative: true },
  {
    head: 'buy',
    family: 'buy',
    telegramNative: true,
    botMenu: {
      private: 'Guided buy flow',
      group: 'Guided buy flow',
      admin: 'Guided buy flow',
    },
  },
  {
    head: 'sell',
    family: 'sell',
    telegramNative: true,
    botMenu: {
      private: 'Guided sell flow',
      group: 'Guided sell flow',
      admin: 'Guided sell flow',
    },
  },
  {
    head: 'bid',
    family: 'bid',
    telegramNative: true,
    botMenu: {
      private: 'Guided bid flow',
      group: 'Guided bid flow',
      admin: 'Guided bid flow',
    },
  },
  { head: 'x', family: 'twitter', aliases: ['tweet'] },
  { head: 'ai', family: 'ai' },
  { head: 'coin', family: 'coin' },
  { head: 'send', family: 'send' },
  { head: 'hermit', family: 'hermit', aliases: ['gmeow', 'meme'] },
] as const

const BOT_MENU_ORDER: Record<CommandScope, readonly string[]> = {
  private: ['start', 'help', 'link'],
  group: ['start', 'help', 'link'],
  admin: ['start', 'help', 'link'],
} as const

type ResolvedCommandDefinition = CommandDefinition & {
  token: string
  isAlias: boolean
}

function normalizeCommandToken(rawText: string): string {
  const token = String(rawText ?? '').trim().split(/\s+/g)[0] ?? ''
  return token.replace(/^\//, '').replace(/@[\w_]+$/, '').toLowerCase()
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const resolvedCommandDefinitions: ResolvedCommandDefinition[] = COMMAND_DEFINITIONS.flatMap((definition) => [
  {
    ...definition,
    token: definition.head,
    isAlias: false,
  },
  ...((definition.aliases ?? []).map((alias) => ({
    ...definition,
    token: alias,
    isAlias: true,
  }))),
])

const commandDefinitionByToken = new Map<string, ResolvedCommandDefinition>(
  resolvedCommandDefinitions.map((definition) => [definition.token, definition]),
)

const telegramNativeHeads = resolvedCommandDefinitions
  .filter((definition) => definition.telegramNative)
  .map((definition) => definition.token)

const telegramCommandHeads = resolvedCommandDefinitions.map((definition) => definition.token)

export type { CommandFamily }

export function getCommandHead(rawText: string): string {
  return normalizeCommandToken(rawText)
}

export function resolveCommandDefinition(rawText: string): ResolvedCommandDefinition | null {
  const token = normalizeCommandToken(rawText)
  return commandDefinitionByToken.get(token) ?? null
}

export function getCommandFamily(rawText: string): CommandFamily | null {
  return resolveCommandDefinition(rawText)?.family ?? null
}

export function matchesCommandFamily(rawText: string, family: CommandFamily): boolean {
  return getCommandFamily(rawText) === family
}

export function matchesAnyCommandFamily(rawText: string, families: readonly CommandFamily[]): boolean {
  const family = getCommandFamily(rawText)
  return family ? families.includes(family) : false
}

/**
 * Command families that require Telegram group-admin privileges when invoked
 * from a group chat. Private DMs are NOT affected — /link in a DM is the
 * personal wallet-linking flow and must stay open to all users.
 *
 * Rationale: these commands either set up the group's 4626 vault connection
 * or reveal/mutate its configuration. Allowing any member to run them lets
 * them interfere with or pre-empt the group owner's setup.
 */
const GROUP_ADMIN_REQUIRED_FAMILIES: ReadonlySet<CommandFamily> = new Set<CommandFamily>([
  'link',
  'status',
  'unlink',
  'keepr',
])

export function requiresGroupAdminForFamily(family: CommandFamily | null): boolean {
  return family !== null && GROUP_ADMIN_REQUIRED_FAMILIES.has(family)
}

export function isKnownTelegramCommandHead(head: string): boolean {
  return telegramCommandHeads.includes(head)
}

export function buildTelegramBotCommands(scope: CommandScope): TelegramBotMenuCommand[] {
  return BOT_MENU_ORDER[scope].flatMap((head) => {
    const definition = COMMAND_DEFINITIONS.find((candidate) => candidate.head === head)
    const description = definition?.botMenu?.[scope]
    if (!definition || !description) return []
    return [{ command: definition.head, description }]
  })
}

export const TELEGRAM_NATIVE_COMMAND_HEADS = telegramNativeHeads
export const TELEGRAM_COMMAND_HEADS = telegramCommandHeads
export const TELEGRAM_COMMAND_HEADS_PATTERN = TELEGRAM_COMMAND_HEADS.map((head) => escapeRegex(head)).join('|')
