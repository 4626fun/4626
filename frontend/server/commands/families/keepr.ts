import type { Address } from 'viem'

import { checkSharesEligibility } from '../../_lib/keepr/keeprGating.js'
import { getKeeprVaultByGroupId, setKeeprJoinLocked } from '../../_lib/keepr/keeprRegistry.js'
import { formatNumberedCommandFallback } from '../../_lib/messaging/chatCommandFallback.js'
import type { KeeprCommandResult, KeeprRole } from '../types.js'

type KeeprHelpTopic = 'quick' | 'all' | 'core' | 'coin' | 'social' | 'ops' | 'wallet' | 'group' | 'admin'
type CommandScope = 'private' | 'group'
type CommandVisibility = 'all' | 'configured'
type CommandPermission = 'MEMBER' | 'ADMIN' | 'OWNER'

type HelpCommandDef = {
  command: string
  description: string
  topic: Exclude<KeeprHelpTopic, 'quick' | 'all'>
  scopes: CommandScope[]
  visibility?: CommandVisibility
  permission?: Extract<CommandPermission, 'ADMIN' | 'OWNER'>
  aliases?: string[]
  examples?: string[]
  featured?: boolean
}

type KeeprVaultRow = Awaited<ReturnType<typeof getKeeprVaultByGroupId>>

const HELP_TOPICS: Array<Exclude<KeeprHelpTopic, 'quick' | 'all'>> = [
  'core',
  'coin',
  'social',
  'ops',
  'wallet',
  'group',
  'admin',
]

const HELP_COMMANDS: HelpCommandDef[] = [
  {
    command: '/start',
    description: 'open the home screen',
    topic: 'core',
    scopes: ['private', 'group'],
    visibility: 'all',
    featured: true,
  },
  {
    command: '/help [topic]',
    description: 'view help and topic guides',
    topic: 'core',
    scopes: ['private', 'group'],
    visibility: 'all',
    examples: ['/help', '/help all', '/help coin'],
    featured: true,
  },
  {
    command: '/link',
    description: 'connect Telegram to your 4626 account',
    topic: 'core',
    scopes: ['private', 'group'],
    visibility: 'all',
    featured: true,
  },
  {
    command: '/status',
    description: 'check link and wallet status',
    topic: 'core',
    scopes: ['private', 'group'],
    visibility: 'all',
    featured: true,
  },
  {
    command: '/id',
    description: 'show the current user, group, or channel ID',
    topic: 'group',
    scopes: ['group'],
    visibility: 'all',
  },
  {
    command: '/buy',
    description: 'guided buy flow',
    topic: 'core',
    scopes: ['private', 'group'],
    visibility: 'all',
    aliases: ['/sell', '/bid'],
    featured: true,
  },
  {
    command: '/sell',
    description: 'guided sell flow',
    topic: 'core',
    scopes: ['private', 'group'],
    visibility: 'all',
  },
  {
    command: '/bid',
    description: 'guided bid flow',
    topic: 'core',
    scopes: ['private', 'group'],
    visibility: 'all',
  },
  {
    command: '/vaults',
    description: 'browse scoped vaults',
    topic: 'group',
    scopes: ['private', 'group'],
    visibility: 'all',
    featured: true,
  },
  {
    command: '/auctions',
    description: 'browse auctions',
    topic: 'group',
    scopes: ['private', 'group'],
    visibility: 'all',
  },
  {
    command: '/wallet',
    description: 'wallet balances, positions, and activity',
    topic: 'wallet',
    scopes: ['private', 'group'],
    visibility: 'all',
    featured: true,
  },
  {
    command: '/whois <address>',
    description: 'resolve ENS or Basename identity',
    topic: 'wallet',
    scopes: ['private', 'group'],
    visibility: 'all',
    examples: ['/whois 0xabc...'],
  },
  {
    command: '/intel <address>',
    description: 'wallet intelligence report',
    topic: 'wallet',
    scopes: ['private', 'group'],
    visibility: 'all',
    examples: ['/intel 0xabc...'],
  },
  {
    command: '/reputation [agentId]',
    description: 'ERC-8004 reputation graph',
    topic: 'wallet',
    scopes: ['private', 'group'],
    visibility: 'all',
  },
  {
    command: '/feedback [agentId]',
    description: 'feedback summary',
    topic: 'wallet',
    scopes: ['private', 'group'],
    visibility: 'all',
  },
  {
    command: '/send <amount> USDC to <address>',
    description: 'send USDC',
    topic: 'wallet',
    scopes: ['private', 'group'],
    visibility: 'configured',
    permission: 'ADMIN',
    examples: ['/send 10 USDC to 0xabc...'],
  },
  {
    command: '/send <amount> ETH to <address>',
    description: 'send ETH',
    topic: 'wallet',
    scopes: ['private', 'group'],
    visibility: 'configured',
    permission: 'ADMIN',
    examples: ['/send 0.1 ETH to 0xabc...'],
  },
  {
    command: '/ai <question>',
    description: 'ask Keepr in plain English',
    topic: 'core',
    scopes: ['private', 'group'],
    visibility: 'all',
    examples: ['/ai summarize this wallet'],
    featured: true,
  },
  {
    command: '/coin trend check <ticker>',
    description: 'run a trend preflight',
    topic: 'coin',
    scopes: ['private', 'group'],
    visibility: 'all',
    examples: ['/coin trend check BTC'],
    featured: true,
  },
  {
    command: '/coin create <name> <symbol> <uri>',
    description: 'create a content coin',
    topic: 'coin',
    scopes: ['private', 'group'],
    visibility: 'configured',
    permission: 'ADMIN',
  },
  {
    command: '/coin buy <address> <eth-amount>',
    description: 'buy a coin with ETH',
    topic: 'coin',
    scopes: ['private', 'group'],
    visibility: 'configured',
  },
  {
    command: '/coin sell <address> <amount>',
    description: 'sell a coin for ETH',
    topic: 'coin',
    scopes: ['private', 'group'],
    visibility: 'configured',
  },
  {
    command: '/coin balance',
    description: 'view the agent wallet balance',
    topic: 'coin',
    scopes: ['private', 'group'],
    visibility: 'configured',
  },
  {
    command: '/coin info <address>',
    description: 'view coin details',
    topic: 'coin',
    scopes: ['private', 'group'],
    visibility: 'configured',
  },
  {
    command: '/coin trend reserve <ticker>',
    description: 'deploy a trend coin',
    topic: 'coin',
    scopes: ['private', 'group'],
    visibility: 'configured',
    permission: 'ADMIN',
  },
  {
    command: '/coin trend status <ticker>',
    description: 'view trend operation status',
    topic: 'coin',
    scopes: ['private', 'group'],
    visibility: 'configured',
  },
  {
    command: '/coin trend funnel <ticker> <eth-amount>',
    description: 'run guarded flywheel action',
    topic: 'coin',
    scopes: ['private', 'group'],
    visibility: 'configured',
    permission: 'ADMIN',
  },
  {
    command: '/x status',
    description: 'check X integration status',
    topic: 'social',
    scopes: ['private', 'group'],
    visibility: 'configured',
    featured: true,
  },
  {
    command: '/x post <message> --confirm',
    description: 'publish a post',
    topic: 'social',
    scopes: ['private', 'group'],
    visibility: 'configured',
    permission: 'ADMIN',
    aliases: ['/tweet <message> --confirm'],
    examples: ['/x post hello world --confirm'],
    featured: true,
  },
  {
    command: '/keepr status',
    description: 'view current vault status',
    topic: 'ops',
    scopes: ['group'],
    visibility: 'all',
    featured: true,
  },
  {
    command: '/keepr rules',
    description: 'show active operating rules',
    topic: 'ops',
    scopes: ['group'],
    visibility: 'all',
    featured: true,
  },
  {
    command: '/keepr check',
    description: 'run a vault health or eligibility check',
    topic: 'ops',
    scopes: ['group'],
    visibility: 'configured',
    featured: true,
  },
  {
    command: '/keepr check 0x...',
    description: 'inspect a specific wallet address',
    topic: 'admin',
    scopes: ['group'],
    visibility: 'configured',
    permission: 'ADMIN',
  },
  {
    command: '/keepr lock',
    description: 'lock vault joins',
    topic: 'admin',
    scopes: ['group'],
    visibility: 'configured',
    permission: 'OWNER',
    featured: true,
  },
  {
    command: '/keepr unlock',
    description: 'unlock vault joins',
    topic: 'admin',
    scopes: ['group'],
    visibility: 'configured',
    permission: 'OWNER',
  },
  {
    command: '/keepr sync',
    description: 'resync vault config',
    topic: 'admin',
    scopes: ['group'],
    visibility: 'configured',
    permission: 'ADMIN',
    featured: true,
  },
  {
    command: '/cre status',
    description: 'view keeper states',
    topic: 'ops',
    scopes: ['group'],
    visibility: 'configured',
    featured: true,
  },
  {
    command: '/cre auction',
    description: 'view auction states',
    topic: 'ops',
    scopes: ['group'],
    visibility: 'configured',
  },
  {
    command: '/cre solana',
    description: 'view Solana price and health',
    topic: 'ops',
    scopes: ['group'],
    visibility: 'configured',
  },
  {
    command: '/cre health',
    description: 'run a combined health check',
    topic: 'ops',
    scopes: ['group'],
    visibility: 'configured',
  },
  {
    command: '/cre tend [vault]',
    description: 'deploy idle funds',
    topic: 'admin',
    scopes: ['group'],
    visibility: 'configured',
    permission: 'ADMIN',
  },
  {
    command: '/cre report [vault]',
    description: 'harvest yields',
    topic: 'admin',
    scopes: ['group'],
    visibility: 'configured',
    permission: 'ADMIN',
  },
  {
    command: '/cre settle-fees',
    description: 'settle Solana fees to Base',
    topic: 'admin',
    scopes: ['group'],
    visibility: 'configured',
    permission: 'ADMIN',
  },
  {
    command: '/cre relay-entries',
    description: 'relay Solana lottery entries',
    topic: 'admin',
    scopes: ['group'],
    visibility: 'configured',
    permission: 'ADMIN',
  },
]

const TOPIC_COPY: Record<Exclude<KeeprHelpTopic, 'quick' | 'all'>, { title: string; intro: string }> = {
  core: {
    title: '🎮 <b>Core Commands</b>',
    intro: 'Start here for linking, trading, and general navigation.',
  },
  coin: {
    title: '🪙 <b>Coin Commands</b>',
    intro: 'Content coin creation, trading, and trend workflows.',
  },
  social: {
    title: '📣 <b>Social Commands</b>',
    intro: 'Status and posting workflows for X.',
  },
  ops: {
    title: '🛠 <b>Ops Commands</b>',
    intro: 'Vault, keeper, and runtime health workflows.',
  },
  wallet: {
    title: '👛 <b>Wallet Commands</b>',
    intro: 'Balances, identity, reputation, and transfers.',
  },
  group: {
    title: '👥 <b>Group Commands</b>',
    intro: 'Commands you will commonly use inside chats and groups.',
  },
  admin: {
    title: '🛡 <b>Admin Commands</b>',
    intro: 'Restricted operational actions for admins and owners.',
  },
}

function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatTelegramQuote(content: string, options?: { expandable?: boolean }): string {
  return `<blockquote${options?.expandable ? ' expandable' : ''}>${content}</blockquote>`
}

function isConfiguredVault(vault: KeeprVaultRow): vault is NonNullable<KeeprVaultRow> {
  return Boolean(vault)
}

function hasPermission(required: Extract<CommandPermission, 'ADMIN' | 'OWNER'> | undefined, role: KeeprRole): boolean {
  if (!required) return true
  if (required === 'ADMIN') return role === 'ADMIN' || role === 'OWNER'
  return role === 'OWNER'
}

function formatPermissionLabel(permission?: Extract<CommandPermission, 'ADMIN' | 'OWNER'>): string {
  if (!permission) return ''
  return permission === 'OWNER' ? ' <i>(OWNER)</i>' : ' <i>(ADMIN/OWNER)</i>'
}

function formatHelpCommandRow(def: HelpCommandDef): string {
  const command = escapeTelegramHtml(def.command)
  const description = escapeTelegramHtml(def.description)
  return `<code>${command}</code> — ${description}${formatPermissionLabel(def.permission)}`
}

function formatHelpTreeSection(title: string, rows: string[]): string {
  return [
    title,
    ...rows.map((row, index) => `${index === rows.length - 1 ? '└' : '├'} ${row}`),
  ].join('\n')
}

function getVisibleHelpCommands(params: {
  topic?: Exclude<KeeprHelpTopic, 'quick' | 'all'>
  scope?: CommandScope
  role?: KeeprRole
  vault?: KeeprVaultRow
  featuredOnly?: boolean
}): HelpCommandDef[] {
  const scope = params.scope ?? 'group'
  const role = params.role ?? 'MEMBER'
  const configured = isConfiguredVault(params.vault ?? null)

  return HELP_COMMANDS.filter((def) => {
    if (params.topic && def.topic !== params.topic) return false
    if (!def.scopes.includes(scope)) return false
    if (params.featuredOnly && !def.featured) return false
    if ((def.visibility ?? 'configured') === 'configured' && !configured) return false
    if (!hasPermission(def.permission, role)) return false
    return true
  })
}

function formatKeeprHelpTopics(): string[] {
  return [
    'Need more? <code>/help core</code> • <code>/help coin</code> • <code>/help social</code> • <code>/help ops</code> • <code>/help wallet</code> • <code>/help group</code> • <code>/help admin</code> • <code>/help all</code>',
  ]
}

function renderHelpExamples(commands: HelpCommandDef[]): string | null {
  const examples = commands.flatMap((cmd) => cmd.examples ?? []).slice(0, 4)
  if (!examples.length) return null

  const body = examples.map((example) => `• <code>${escapeTelegramHtml(example)}</code>`).join('\n')
  return formatTelegramQuote(`Examples\n${body}`, { expandable: true })
}

function renderTopicHelp(params: {
  topic: Exclude<KeeprHelpTopic, 'quick' | 'all'>
  vault?: KeeprVaultRow
  role?: KeeprRole
  scope?: CommandScope
}): string {
  const copy = TOPIC_COPY[params.topic]
  const commands = getVisibleHelpCommands({
    topic: params.topic,
    vault: params.vault,
    role: params.role,
    scope: params.scope,
  })

  const lines: string[] = [copy.title, '', copy.intro, '']

  if (commands.length) {
    lines.push(...commands.map(formatHelpCommandRow))
  } else {
    lines.push('No commands are visible for this topic in the current context.')
  }

  const exampleBlock = renderHelpExamples(commands)
  if (exampleBlock) {
    lines.push('', exampleBlock)
  }

  lines.push('', 'Need everything? <code>/help all</code>')
  return lines.join('\n')
}

function renderQuickHelp(params: {
  vault?: KeeprVaultRow
  role?: KeeprRole
  scope?: CommandScope
  unknownTopic?: string | null
}): string {
  const scope = params.scope ?? 'group'
  const vault = params.vault ?? null
  const role = params.role ?? 'MEMBER'

  const startHere = getVisibleHelpCommands({ scope, vault, role, featuredOnly: true }).slice(0, 4)
  const groupCommands = getVisibleHelpCommands({ topic: 'group', scope, vault, role }).slice(0, 4)
  const adminCommands = getVisibleHelpCommands({ topic: 'admin', scope, vault, role }).slice(0, 4)

  const lines: string[] = ['<b>Keepr — Quick Start</b>', '']

  if (params.unknownTopic) {
    lines.push(`Unknown help topic: <code>${escapeTelegramHtml(params.unknownTopic)}</code>`, '')
  }

  lines.push(
    formatHelpTreeSection(
      '🎮 <b>Commands</b>',
      startHere.length ? startHere.map(formatHelpCommandRow) : ['No commands available.'],
    ),
    '',
    formatHelpTreeSection(
      '👥 <b>Group Commands</b>',
      groupCommands.length ? groupCommands.map(formatHelpCommandRow) : ['No group commands available.'],
    ),
  )

  if (adminCommands.length) {
    lines.push('', formatHelpTreeSection('🛡 <b>Admin Commands</b>', adminCommands.map(formatHelpCommandRow)))
  }

  lines.push('', ...formatKeeprHelpTopics())
  return lines.join('\n')
}

function renderFullHelp(params: { vault?: KeeprVaultRow; role?: KeeprRole; scope?: CommandScope }): string {
  const scope = params.scope ?? 'group'
  const vault = params.vault ?? null
  const role = params.role ?? 'MEMBER'

  const sections = HELP_TOPICS
    .map((topic) => {
      const rows = getVisibleHelpCommands({ topic, scope, vault, role }).map(formatHelpCommandRow)
      if (!rows.length) return null
      return formatHelpTreeSection(TOPIC_COPY[topic].title, rows)
    })
    .filter(Boolean)

  return ['<b>Keepr — Help</b>', '', ...sections].join('\n\n')
}

function resolveKeeprHelpTopic(rawTopic: string | null | undefined): { topic: KeeprHelpTopic; unknownTopic: string | null } {
  const token = String(rawTopic ?? '').trim().toLowerCase().split(/\s+/g)[0] ?? ''
  if (!token) return { topic: 'quick', unknownTopic: null }

  switch (token) {
    case 'quick':
    case 'start':
    case 'starter':
      return { topic: 'quick', unknownTopic: null }
    case 'all':
    case 'full':
    case 'everything':
    case 'commands':
      return { topic: 'all', unknownTopic: null }
    case 'core':
    case 'main':
      return { topic: 'core', unknownTopic: null }
    case 'coin':
    case 'coins':
    case 'zora':
      return { topic: 'coin', unknownTopic: null }
    case 'social':
    case 'x':
    case 'twitter':
      return { topic: 'social', unknownTopic: null }
    case 'ops':
    case 'cre':
    case 'keeper':
    case 'keepr':
      return { topic: 'ops', unknownTopic: null }
    case 'wallet':
    case 'identity':
    case 'reputation':
      return { topic: 'wallet', unknownTopic: null }
    case 'group':
    case 'chat':
      return { topic: 'group', unknownTopic: null }
    case 'admin':
    case 'owner':
      return { topic: 'admin', unknownTopic: null }
    default:
      return { topic: 'quick', unknownTopic: token }
  }
}

export function formatKeeprHelp(
  rawTopic: string | null = null,
  options?: { vault?: KeeprVaultRow; role?: KeeprRole; scope?: CommandScope },
): string {
  const { topic, unknownTopic } = resolveKeeprHelpTopic(rawTopic)
  const vault = options?.vault ?? null
  const role = options?.role ?? 'MEMBER'
  const scope = options?.scope ?? 'group'

  if (topic === 'all') return renderFullHelp({ vault, role, scope })
  if (topic === 'quick') return renderQuickHelp({ vault, role, scope, unknownTopic })
  return renderTopicHelp({ topic, vault, role, scope })
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function looksLikeGroupConnectIntent(raw: string): boolean {
  const text = raw.trim().toLowerCase()
  if (!text) return false
  const asksConnect = /\b(connect|link|setup|set up|configure|onboard)\b/.test(text)
  if (!asksConnect) return false
  const mentionsGroup = /\b(group|chat|telegram|room|thread)\b/.test(text)
  const mentionsApp = /\b(4626|keepr)\b/.test(text)
  return mentionsGroup || mentionsApp
}

export function formatGroupConnectGuidance(groupId: string): string {
  return [
    '<b>Group Setup (4626)</b>',
    '',
    'I can help once this Telegram chat is linked to a 4626 vault.',
    '',
    'Setup steps:',
    '1) In this chat, run <code>/link</code>, then open the bot DM and send <code>/start</code> + <code>/link</code> to complete wallet linking',
    '2) Run <code>/status</code> and confirm <code>ownerVerified</code> is true',
    '3) Scope at least one vault to this chat in 4626',
    '4) Run <code>/vaults</code>, then <code>/keepr status</code> to confirm config',
    '',
    `If the app asks for the chat or group identifier, use: <code>${escapeTelegramHtml(groupId)}</code>`,
  ].join('\n')
}

export function formatAssistantOnlyBlocked(command: string): string {
  return [
    '<b>Assistant-only mode</b>',
    '',
    `• <code>${escapeTelegramHtml(command)}</code> is disabled until this group is connected to a 4626 vault`,
    '• You can still use <code>/ai</code>, <code>/help</code>, <code>/whois</code>, and <code>/wallet</code>',
    '• To enable full actions: run <code>/link</code>, verify <code>/status</code>, scope a vault, then confirm with <code>/keepr status</code>',
  ].join('\n')
}

/**
 * Shown when a non-admin group member invokes a setup command (/link, /status,
 * /unlink, /keepr). The command is still available to group owners and admins,
 * and to all users in private DMs with the bot.
 */
export function formatAdminOnlyRefusal(command: string): string {
  return [
    '<b>Admins only</b>',
    '',
    `• <code>${escapeTelegramHtml(command)}</code> can only be run by the group owner or an admin`,
    '• You can still use <code>/ai</code>, <code>/help</code>, <code>/whois</code>, and <code>/wallet</code>',
    '• Ask an admin to run <code>/link</code> → <code>/status</code> → scope a vault → <code>/keepr status</code>',
    '• To link your own wallet, DM the bot and send <code>/link</code> there',
  ].join('\n')
}

/**
 * Shown when we could not determine the caller's role because getChatMember
 * failed (network, rate limit, bot not admin in group). This is a "fail closed"
 * refusal — we do not allow the action until we can verify.
 */
export function formatAdminCheckUnavailable(command: string): string {
  return [
    '<b>Couldn’t verify your role</b>',
    '',
    `• <code>${escapeTelegramHtml(command)}</code> is restricted to group owners/admins, and I couldn’t confirm yours right now`,
    '• This usually means the bot lacks the permissions it needs in this group',
    '• Ask a group admin to (re)add the bot as an admin, then try again',
  ].join('\n')
}

export function formatVaultStatus(v: KeeprVaultRow): string {
  if (!v) {
    return [
      '<b>Keepr status</b>',
      '',
      '• configured: no',
      '• mode: assistant_only (setup pending)',
      '• next: ask the creator to connect this group in 4626',
    ].join('\n')
  }

  return [
    '<b>Keepr status</b>',
    '',
    `• configured: yes`,
    `• vaultAddress: <code>${escapeTelegramHtml(v.vaultAddress)}</code>`,
    `• shareTokenAddress: <code>${escapeTelegramHtml(String(v.shareTokenAddress ?? 'n/a'))}</code>`,
    `• chainId: <code>${escapeTelegramHtml(String(v.chainId))}</code>`,
    `• groupId: <code>${escapeTelegramHtml(v.groupId)}</code>`,
    `• lensGroupAddress: <code>${escapeTelegramHtml(String(v.lensGroupAddress ?? 'n/a'))}</code>`,
    `• canonicalOwner: <code>${escapeTelegramHtml(v.canonicalOwnerAddress)}</code>`,
    '• gating:',
    `  • enabled: ${escapeTelegramHtml(String(v.gatingEnabled))}`,
    `  • mode: ${escapeTelegramHtml(String(v.gatingMode))}`,
    `  • joinLocked: ${escapeTelegramHtml(String(v.joinLocked))}`,
    `  • minShares: ${escapeTelegramHtml(String(v.minShares ?? 'n/a'))}`,
    `  • failClosed: ${escapeTelegramHtml(String(v.failClosed))}`,
    `• configHash: <code>${escapeTelegramHtml(v.configHash)}</code>`,
  ].join('\n')
}

function formatRules(v: NonNullable<KeeprVaultRow>): string {
  return [
    '<b>Keepr rules</b>',
    '',
    '• joins:',
    `  • locked: ${escapeTelegramHtml(String(v.joinLocked))}`,
    '• gating:',
    `  • enabled: ${escapeTelegramHtml(String(v.gatingEnabled))}`,
    `  • mode: ${escapeTelegramHtml(String(v.gatingMode))}`,
    `  • minShares: ${escapeTelegramHtml(String(v.minShares ?? 'n/a'))}`,
    `  • failClosed: ${escapeTelegramHtml(String(v.failClosed))}`,
  ].join('\n')
}

function formatEligibilityResult(params: {
  targetWallet: Address
  result: Awaited<ReturnType<typeof checkSharesEligibility>>
}): string {
  const { targetWallet, result } = params
  return [
    `<b>Eligibility</b>: ${result.eligible ? 'yes' : 'no'}`,
    `• wallet: <code>${escapeTelegramHtml(targetWallet)}</code>`,
    `• reason: ${escapeTelegramHtml(result.reason)}`,
    `• shareBalance: <code>${escapeTelegramHtml(String(result.evidence.shareBalance))}</code>`,
    `• threshold: <code>${escapeTelegramHtml(String(result.evidence.threshold))}</code>`,
    `• blockNumber: <code>${escapeTelegramHtml(String(result.evidence.blockNumber ?? 'n/a'))}</code>`,
  ].join('\n')
}

function isKeeprPrefix(rawLower: string): boolean {
  return rawLower.startsWith('/keepr') || rawLower.startsWith('keepr')
}

function parseKeeprCommand(raw: string): { cmd: string; arg: string | null } {
  const trimmed = raw.trim()
  const parts = trimmed.split(/\s+/g).filter(Boolean)
  if (!parts.length) return { cmd: 'help', arg: null }

  const first = parts[0]?.toLowerCase() ?? ''
  if (first === '/keepr' || first === 'keepr') {
    return {
      cmd: (parts[1] ?? 'help').toLowerCase(),
      arg: parts[2] ? String(parts[2]) : null,
    }
  }

  return { cmd: 'help', arg: null }
}

function formatUnconfiguredRules(): string {
  return [
    '<b>Keepr rules</b>',
    '',
    '• configured: no',
    '• next: ask the creator to connect this group in 4626',
  ].join('\n')
}

export async function executeKeeprCommandFamily(params: {
  groupId: string
  senderWallet: Address
  text: string
  vault: KeeprVaultRow
  role: KeeprRole
}): Promise<KeeprCommandResult> {
  const raw = (params.text ?? '').trim()
  const rawLower = raw.toLowerCase()

  if (!raw) {
    return { ok: false, response: '' }
  }

  if (!isKeeprPrefix(rawLower)) {
    return { ok: false, response: '' }
  }

  const { cmd, arg } = parseKeeprCommand(raw)
  const vault = params.vault

  if (!vault) {
    if (cmd === 'help') {
      return {
        ok: true,
        response: formatKeeprHelp(arg, { vault: null, role: params.role, scope: 'group' }),
      }
    }

    if (cmd === 'status') {
      return { ok: true, response: formatVaultStatus(null) }
    }

    if (cmd === 'rules') {
      return { ok: true, response: formatUnconfiguredRules() }
    }

    if (looksLikeGroupConnectIntent(raw)) {
      return { ok: true, response: formatGroupConnectGuidance(params.groupId) }
    }

    return {
      ok: false,
      response: formatNumberedCommandFallback({
        intro: 'Keepr is not configured for this group.',
        includeHint: 'Ask the creator to connect this group in 4626.',
      }),
    }
  }

  if (cmd === 'help') {
    return {
      ok: true,
      response: formatKeeprHelp(arg, { vault, role: params.role, scope: 'group' }),
    }
  }

  if (cmd === 'status') {
    return { ok: true, response: formatVaultStatus(vault) }
  }

  if (cmd === 'rules') {
    return { ok: true, response: formatRules(vault) }
  }

  if (cmd === 'lock' || cmd === 'unlock') {
    if (params.role !== 'OWNER') {
      return { ok: false, response: 'Denied: OWNER only.' }
    }

    const joinLocked = cmd === 'lock'
    await setKeeprJoinLocked({
      vaultAddress: vault.vaultAddress,
      joinLocked,
      actorWallet: params.senderWallet,
    })

    return {
      ok: true,
      response: joinLocked ? 'Joins locked.' : 'Joins unlocked.',
      action: {
        action: joinLocked ? 'keepr.vault.lock' : 'keepr.vault.unlock',
        vaultAddress: vault.vaultAddress,
        groupId: vault.groupId,
        reason: 'owner_command',
        evidence: { actor: params.senderWallet },
      },
    }
  }

  if (cmd === 'check') {
    const targetWallet = arg && isAddressLike(arg) ? (arg.toLowerCase() as Address) : params.senderWallet
    if (arg && targetWallet !== params.senderWallet && params.role === 'MEMBER') {
      return { ok: false, response: 'Denied: ADMIN or OWNER only.' }
    }

    if (!vault.gatingEnabled || vault.gatingMode === 'none') {
      return { ok: true, response: '<b>Eligibility</b>: yes\n• reason: gating_disabled' }
    }

    if (vault.gatingMode !== 'shares') {
      return { ok: false, response: 'Unsupported gating mode.' }
    }

    const shareToken = vault.shareTokenAddress
    const minShares = vault.minShares
      ? (() => {
          try {
            return BigInt(vault.minShares)
          } catch {
            return null
          }
        })()
      : null

    if (!shareToken || !minShares) {
      return { ok: false, response: 'Misconfigured: missing share token or minShares.' }
    }

    const result = await checkSharesEligibility({
      wallet: targetWallet,
      shareToken,
      minShares,
    })

    return {
      ok: true,
      response: formatEligibilityResult({ targetWallet, result }),
    }
  }

  if (cmd === 'sync') {
    if (params.role === 'MEMBER') {
      return { ok: false, response: 'Denied: ADMIN or OWNER only.' }
    }
    return { ok: true, response: 'Sync requested. The Keepr runtime will process this shortly.' }
  }

  return {
    ok: false,
    response: formatNumberedCommandFallback({
      intro: 'Unknown command. Try /keepr help.',
    }),
  }
}
