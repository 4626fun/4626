import type { Address } from 'viem'

import { checkSharesEligibility } from '../../_lib/keeprGating.js'
import { getKeeprVaultByGroupId, setKeeprJoinLocked } from '../../_lib/keeprRegistry.js'
import { formatNumberedCommandFallback } from '../../_lib/chatCommandFallback.js'
import type { KeeprCommandResult, KeeprRole } from '../types.js'

type KeeprHelpTopic = 'quick' | 'all' | 'core' | 'coin' | 'social' | 'ops' | 'wallet'

function formatHelpCommandRow(command: string, description: string, permission?: 'OWNER' | 'ADMIN/OWNER'): string {
  const safeCommand = escapeTelegramHtml(command)
  const safeDescription = escapeTelegramHtml(description)
  if (permission) {
    const safePermission = escapeTelegramHtml(permission)
    return `<code>${safeCommand}</code> — ${safeDescription} <i>(${safePermission})</i>`
  }
  return `<code>${safeCommand}</code> — ${safeDescription}`
}

function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatKeeprHelpTopics(): string[] {
  return ['<blockquote>Need more? <code>/help core|coin|social|ops|wallet</code> • <code>/help all</code></blockquote>']
}

function formatTelegramQuote(content: string, options?: { expandable?: boolean }): string {
  return `<blockquote${options?.expandable ? ' expandable' : ''}>${content}</blockquote>`
}

function formatHelpSection(title: string, rows: string[]): string[] {
  return [
    `<u>${escapeTelegramHtml(title)}</u>`,
    formatTelegramQuote(rows.join('\n'), { expandable: rows.length >= 4 }),
    '',
  ]
}

function formatKeeprHelpFull(): string {
  return [
    '<b>Keepr — Help</b>',
    '',
    '<blockquote>Use <code>/help</code> for quick mode, or <code>/help &lt;topic&gt;</code> for sections.</blockquote>',
    '',
    ...formatHelpSection('start', [
      formatHelpCommandRow('/start', 'menu'),
      formatHelpCommandRow('/id', 'pick a user, group, or channel ID'),
      formatHelpCommandRow('/help', 'command guide'),
      formatHelpCommandRow('/link', 'connect Telegram + Zora CSW'),
      formatHelpCommandRow('/linked', 'link status'),
      formatHelpCommandRow('/wallet', 'wallet + positions'),
      formatHelpCommandRow('/buy | /sell | /bid', 'guided trade flow'),
      formatHelpCommandRow('/vaults | /auctions', 'discovery + monitoring'),
    ]),
    ...formatHelpSection('manage', [
      formatHelpCommandRow('/keepr status', 'vault status'),
      formatHelpCommandRow('/keepr rules', 'active rules'),
      formatHelpCommandRow('/keepr check', 'health check'),
      formatHelpCommandRow('/keepr check 0x...', 'inspect specific address', 'ADMIN/OWNER'),
      formatHelpCommandRow('/keepr lock | /keepr unlock', 'toggle vault actions', 'OWNER'),
      formatHelpCommandRow('/keepr sync', 'resync vault config', 'ADMIN/OWNER'),
      formatHelpCommandRow('/coin help | /cre status | /cre health', 'coin + keeper health'),
    ]),
    ...formatHelpSection('analyze', [
      formatHelpCommandRow('/ai <question>', 'ask Keepr'),
      formatHelpCommandRow('/coin trend check <ticker>', 'trend preflight'),
      formatHelpCommandRow('/whois | /intel | /reputation | /feedback', 'identity + intel'),
    ]),
    ...formatHelpSection('publish', [
      formatHelpCommandRow('/x status', 'X integration'),
      formatHelpCommandRow('/x post <message> --confirm', 'publish a post', 'ADMIN/OWNER'),
      formatHelpCommandRow('/tweet <message> --confirm', 'alias for posting', 'ADMIN/OWNER'),
      formatHelpCommandRow('/coin trend reserve <ticker>', 'deploy trend coin', 'ADMIN/OWNER'),
      formatHelpCommandRow('/coin trend status <ticker>', 'trend status'),
      formatHelpCommandRow('/coin trend funnel <ticker> <eth-amount>', 'guarded flywheel', 'ADMIN/OWNER'),
    ]),
    ...formatHelpSection('transfer', [
      formatHelpCommandRow('/send <amount> USDC to <address>', 'send USDC', 'ADMIN/OWNER'),
      formatHelpCommandRow('/send <amount> ETH to <address>', 'send ETH', 'ADMIN/OWNER'),
      'Example: <code>/send 25 USDC to 0xabc...123</code>',
    ]),
    ...formatHelpSection('advanced', [
      formatHelpCommandRow('/coin create <name> <symbol> <uri>', 'create content coin', 'ADMIN/OWNER'),
      formatHelpCommandRow('/coin buy | /coin sell | /coin balance | /coin info', 'coin ops'),
      formatHelpCommandRow('/cre auction | /cre solana | /cre tend | /cre report | /cre settle-fees | /cre relay-entries', 'keeper ops'),
      'Telegram ops: tap <b>CRE Ops</b> or <b>Solana</b> in the bot menu for one-tap operator actions.',
    ]),
    ...formatHelpSection('permissions', [
      '<b>OWNER</b> — highest privilege',
      '<b>ADMIN</b> — management actions',
      'Restricted commands fail without required role',
    ]),
    ...formatHelpSection('help by topic', [
      '<code>/help coin</code> — Zora Coin commands',
      '<code>/help x</code> — X / Twitter commands',
      '<code>/help cre</code> — CRE Keeper commands',
      '<code>/help wallet</code> — wallet and identity commands',
    ]),
    '<blockquote>Tip: keep short help in groups, and use full help in DMs/admin flows.</blockquote>',
  ].join('\n')
}

function formatKeeprQuickHelp(unknownTopic: string | null = null): string {
  const lines: string[] = ['<b>Keepr — Quick Start</b>', '']
  if (unknownTopic) {
    lines.push(`<blockquote>Unknown help topic: <code>${escapeTelegramHtml(unknownTopic)}</code></blockquote>`)
    lines.push('')
  }
  lines.push(
    '<u>start</u>',
    '',
    formatHelpCommandRow('/link', 'connect Telegram to your 4626 Privy + Zora CSW'),
    formatHelpCommandRow('/buy | /sell | /bid', 'guided flows: pick vault -> size -> Accept'),
    formatHelpCommandRow('/wallet', 'wallet, positions, and recent actions'),
    '',
    '<u>most used</u>',
    formatHelpCommandRow('/keepr status', 'vault status and config'),
    formatHelpCommandRow('/ai <question>', 'ask in plain English'),
    formatHelpCommandRow('/coin trend check <ticker>', 'trend preflight check'),
    formatHelpCommandRow('/x post <message> --confirm', 'publish a post', 'ADMIN/OWNER'),
    '<blockquote>symbol example: <code>BTC</code></blockquote>',
    '<blockquote>Telegram operators: use the <b>CRE Ops</b> and <b>Solana</b> buttons for tap-first flows.</blockquote>',
    '',
    ...formatKeeprHelpTopics(),
  )
  return lines.join('\n')
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
    case 'vault':
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
      return { topic: 'ops', unknownTopic: null }
    case 'wallet':
    case 'identity':
    case 'reputation':
      return { topic: 'wallet', unknownTopic: null }
    default:
      return { topic: 'quick', unknownTopic: token }
  }
}

export function formatKeeprHelp(rawTopic: string | null = null): string {
  const { topic, unknownTopic } = resolveKeeprHelpTopic(rawTopic)
  if (topic === 'all') return formatKeeprHelpFull()
  if (topic === 'quick') return formatKeeprQuickHelp(unknownTopic)

  if (topic === 'core') {
    return [
      '<b>Keepr — core</b>',
      '',
      formatHelpCommandRow('/keepr status', 'view current vault status'),
      formatHelpCommandRow('/keepr rules', 'show active operating rules'),
      formatHelpCommandRow('/keepr check', 'run a vault health check'),
      formatHelpCommandRow('/keepr check 0x...', 'inspect a specific address', 'ADMIN/OWNER'),
      formatHelpCommandRow('/keepr lock', 'lock vault actions', 'OWNER'),
      formatHelpCommandRow('/keepr unlock', 'unlock vault actions', 'OWNER'),
      formatHelpCommandRow('/keepr sync', 'sync vault state and config', 'ADMIN/OWNER'),
      '',
      '<blockquote>Need everything? <code>/help all</code></blockquote>',
    ].join('\n')
  }

  if (topic === 'coin') {
    return [
      '<b>Keepr — coin</b>',
      '',
      formatHelpCommandRow('/coin create <name> <symbol> <uri>', 'create a content coin', 'ADMIN/OWNER'),
      formatHelpCommandRow('/coin buy <address> <eth-amount>', 'buy a coin with ETH'),
      formatHelpCommandRow('/coin sell <address> <amount>', 'sell a coin for ETH'),
      formatHelpCommandRow('/coin balance', 'view agent wallet balance'),
      formatHelpCommandRow('/coin info <address>', 'view coin details'),
      formatHelpCommandRow('/coin trend check <ticker>', 'run trend preflight checks'),
      formatHelpCommandRow('/coin trend reserve <ticker>', 'deploy a trend coin', 'ADMIN/OWNER'),
      formatHelpCommandRow('/coin trend status <ticker>', 'view trend operation status'),
      formatHelpCommandRow('/coin trend funnel <ticker> <eth-amount>', 'run guarded flywheel action', 'ADMIN/OWNER'),
      '',
      '<blockquote>Need everything? <code>/help all</code></blockquote>',
    ].join('\n')
  }

  if (topic === 'social') {
    return [
      '<b>Keepr — social</b>',
      '',
      formatHelpCommandRow('/x status', 'check X integration status'),
      formatHelpCommandRow('/x post <message> --confirm', 'publish a post', 'ADMIN/OWNER'),
      formatHelpCommandRow('/tweet <message> --confirm', 'alias for posting', 'ADMIN/OWNER'),
      '',
      '<blockquote>Need everything? <code>/help all</code></blockquote>',
    ].join('\n')
  }

  if (topic === 'ops') {
    return [
      '<b>Keepr — ops</b>',
      '',
      formatHelpCommandRow('/cre status', 'view vault keeper states'),
      formatHelpCommandRow('/cre auction', 'view CCA auction states'),
      formatHelpCommandRow('/cre solana', 'Solana price and health'),
      formatHelpCommandRow('/cre health', 'combined health check'),
      formatHelpCommandRow('/cre tend [vault]', 'deploy idle funds', 'ADMIN/OWNER'),
      formatHelpCommandRow('/cre report [vault]', 'harvest yields', 'ADMIN/OWNER'),
      formatHelpCommandRow('/cre settle-fees', 'settle Solana fees to Base', 'ADMIN/OWNER'),
      formatHelpCommandRow('/cre relay-entries', 'relay Solana lottery entries', 'ADMIN/OWNER'),
      '',
      '<blockquote>Need everything? <code>/help all</code></blockquote>',
    ].join('\n')
  }

  return [
    '<b>Keepr — wallet</b>',
    '',
    formatHelpCommandRow('/wallet', 'wallet, positions, and recent actions'),
    formatHelpCommandRow('/send <amount> USDC to <address>', 'send USDC', 'ADMIN/OWNER'),
    formatHelpCommandRow('/send <amount> ETH to <address>', 'send ETH', 'ADMIN/OWNER'),
    formatHelpCommandRow('/whois <address>', 'resolve ENS / Basename identity'),
    formatHelpCommandRow('/intel <address>', 'wallet intelligence report'),
    formatHelpCommandRow('/reputation [agentId]', 'ERC-8004 reputation graph'),
    formatHelpCommandRow('/feedback [agentId]', 'feedback summary'),
    '',
    '<blockquote>Need everything? <code>/help all</code></blockquote>',
  ].join('\n')
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
    'Group Setup (4626)',
    '',
    'I can help once this Telegram chat is linked to a 4626 vault.',
    '',
    'Setup steps:',
    '1) In this chat, run /link, then open the bot DM and send /start + /link to complete wallet linking',
    '2) Run /linked and confirm ownerVerified is true',
    '3) Scope at least one vault to this chat in 4626',
    '4) Run /vaults, then /keepr status to confirm config',
    '',
    `If the app asks for the chat/group identifier, use: ${groupId}`,
  ].join('\n')
}

export function formatAssistantOnlyBlocked(command: string): string {
  return [
    'Assistant-only mode',
    '',
    `- ${command} is disabled until this group is connected to a 4626 vault`,
    '- You can still use /ai, /help, /whois, and /wallet',
    '- To enable full actions: run /link, verify /linked, scope a vault, then confirm with /keepr status',
  ].join('\n')
}

export function formatVaultStatus(v: Awaited<ReturnType<typeof getKeeprVaultByGroupId>>): string {
  if (!v) {
    return [
      'Keepr status',
      '',
      '- configured: no',
      '- mode: assistant_only (setup pending)',
      '- next: ask the creator to connect this group in 4626',
    ].join('\n')
  }
  return [
    'Keepr status',
    '',
    '- configured: yes',
    '- vaultAddress: ' + v.vaultAddress,
    '- chainId: ' + String(v.chainId),
    '- groupId: ' + v.groupId,
    '- lensGroupAddress: ' + String(v.lensGroupAddress ?? 'n/a'),
    '- canonicalOwner: ' + v.canonicalOwnerAddress,
    '- gating:',
    '  - enabled: ' + String(v.gatingEnabled),
    '  - mode: ' + String(v.gatingMode),
    '  - joinLocked: ' + String(v.joinLocked),
    '  - minShares: ' + String(v.minShares ?? 'n/a'),
    '  - failClosed: ' + String(v.failClosed),
    '- configHash: ' + v.configHash,
  ].join('\n')
}

type KeeprVaultRow = Awaited<ReturnType<typeof getKeeprVaultByGroupId>>

function isKeeprPrefix(rawLower: string): rawLower is string {
  return rawLower.startsWith('/keepr') || rawLower.startsWith('keepr')
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
  const v = params.vault

  if (!v) {
    const parts0 = rawLower.split(/\s+/g).filter(Boolean)
    const cmd0 = isKeeprPrefix(rawLower) ? (parts0[1] ?? 'help') : ''
    const arg0 = isKeeprPrefix(rawLower) ? (parts0[2] ? String(parts0[2]) : null) : null
    if (cmd0 === 'help') {
      return { ok: true, response: formatKeeprHelp(arg0) }
    }
    if (cmd0 === 'status') {
      return { ok: true, response: formatVaultStatus(null) }
    }
    if (cmd0 === 'rules') {
      return {
        ok: true,
        response: [
          'Keepr rules',
          '',
          '- configured: no',
          '- next: ask the creator to connect this group in 4626',
        ].join('\n'),
      }
    }
    if (looksLikeGroupConnectIntent(raw)) {
      return {
        ok: true,
        response: formatGroupConnectGuidance(params.groupId),
      }
    }
    return {
      ok: false,
      response: formatNumberedCommandFallback({
        intro: 'Keepr is not configured for this group.',
        includeHint: 'Ask the creator to connect this group in 4626.',
      }),
    }
  }

  const prefix = rawLower.startsWith('/keepr') ? '/keepr' : rawLower.startsWith('keepr') ? 'keepr' : null
  if (!prefix) {
    return { ok: false, response: '' }
  }
  const parts = raw.split(/\s+/g).filter(Boolean)
  const cmd = parts[0]?.toLowerCase() === prefix ? (parts[1] ? String(parts[1]).toLowerCase() : 'help') : 'help'
  const arg = parts[0]?.toLowerCase() === prefix ? (parts[2] ? String(parts[2]) : null) : null

  if (cmd === 'help') {
    return {
      ok: true,
      response: formatKeeprHelp(arg),
    }
  }

  if (cmd === 'status') {
    return { ok: true, response: formatVaultStatus(v) }
  }

  if (cmd === 'rules') {
    return {
      ok: true,
      response: [
        'Keepr rules',
        '',
        '- joins:',
        '  - locked: ' + String(v.joinLocked),
        '- gating:',
        '  - enabled: ' + String(v.gatingEnabled),
        '  - mode: ' + String(v.gatingMode),
        '  - minShares: ' + String(v.minShares ?? 'n/a'),
        '  - failClosed: ' + String(v.failClosed),
      ].join('\n'),
    }
  }

  if (cmd === 'lock' || cmd === 'unlock') {
    if (params.role !== 'OWNER') {
      return { ok: false, response: 'Denied: OWNER only.' }
    }
    const joinLocked = cmd === 'lock'
    await setKeeprJoinLocked({ vaultAddress: v.vaultAddress, joinLocked, actorWallet: params.senderWallet })
    return {
      ok: true,
      response: joinLocked ? 'Joins locked.' : 'Joins unlocked.',
      action: {
        action: joinLocked ? 'keepr.vault.lock' : 'keepr.vault.unlock',
        vaultAddress: v.vaultAddress,
        groupId: v.groupId,
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

    if (!v.gatingEnabled || v.gatingMode === 'none') {
      return { ok: true, response: 'Eligible: yes\n- reason: gating_disabled' }
    }

    if (v.gatingMode !== 'shares') {
      return { ok: false, response: 'Unsupported gating mode.' }
    }

    const shareToken = v.shareTokenAddress
    const minShares = v.minShares
      ? (() => {
          try {
            return BigInt(v.minShares)
          } catch {
            return null
          }
        })()
      : null

    if (!shareToken || !minShares) {
      return { ok: false, response: 'Misconfigured: missing share token or minShares.' }
    }

    const r = await checkSharesEligibility({ wallet: targetWallet, shareToken, minShares })
    const eligible = r.eligible ? 'yes' : 'no'
    return {
      ok: true,
      response: [
        `Eligible: ${eligible}`,
        `- wallet: ${targetWallet}`,
        `- reason: ${r.reason}`,
        `- shareBalance: ${r.evidence.shareBalance}`,
        `- threshold: ${r.evidence.threshold}`,
        `- blockNumber: ${r.evidence.blockNumber ?? 'n/a'}`,
      ].join('\n'),
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
