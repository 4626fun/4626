import type { Address } from 'viem'

import { checkSharesEligibility } from '../_lib/keeprGating.js'
import { getKeeprVaultByGroupId, setKeeprJoinLocked } from '../_lib/keeprRegistry.js'
import { handleFarcasterCommand } from '../farcaster/commands.js'
import { handleCoinCommand } from '../zora/commands.js'
import { handleSendCommand } from './sendCommand.js'
import { generateLlmResponse } from '../ai/chat.js'

export type KeeprRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export type KeeprCommandResult =
  | { ok: true; response: string; action?: any }
  | { ok: false; response: string }

function formatKeeprHelp(): string {
  return [
    'Keepr commands',
    '',
    'Tip: you can type with or without a leading slash.',
    '',
    'Start here:',
    '',
    '- /help — command list',
    '- /keepr status — vault status and config',
    '- /ai <question> — ask in plain English',
    '',
    'Core Keepr commands:',
    '',
    '- keepr help',
    '- keepr status',
    '- keepr rules',
    '- keepr check',
    '- keepr check 0x... (ADMIN/OWNER)',
    '- keepr lock (OWNER)',
    '- keepr unlock (OWNER)',
    '- keepr sync (ADMIN/OWNER)',
    '',
    'Token commands:',
    '',
    '- /send <amount> USDC to <address> (ADMIN/OWNER)',
    '- /send <amount> ETH to <address> (ADMIN/OWNER)',
    '',
    'Zora Coin commands (type /coin help for more):',
    '',
    '- /coin create <name> <symbol> <uri> — create Content Coin',
    '- /coin buy <address> <eth-amount> — buy coin with ETH',
    '- /coin sell <address> <amount> — sell coin for ETH',
    '- /coin balance — agent wallet balance',
    '- /coin info <address> — coin details',
    '',
    'AI commands:',
    '',
    '- /ai <question> — ask the vault assistant',
    '- @keepr <question> — same as /ai',
    '',
    'Farcaster commands (type /fc help for more):',
    '',
    '- /fc profile <address|fid>',
    '- /fc cast <message> (ADMIN/OWNER)',
    '- /fc gallery',
    '- /fc stats',
    '',
    'CRE Keeper commands (type /cre help for more):',
    '',
    '- /cre status — vault keeper states',
    '- /cre auction — CCA auction states',
    '- /cre solana — Solana price & health',
    '- /cre health — combined health check',
    '- /cre tend [vault] — deploy idle funds',
    '- /cre report [vault] — harvest yields',
    '- /cre flush-fees — flush Solana fees',
    '',
    'Wallet & Reputation:',
    '',
    '- /intel <address> — wallet intelligence report',
    '- /reputation [agentId] — ERC-8004 reputation graph',
    '- /feedback [agentId] — feedback summary',
  ].join('\n')
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function roleForWallet(params: { wallet: Address; owner: Address; admins: Address[] }): KeeprRole {
  const w = params.wallet.toLowerCase()
  if (w === params.owner.toLowerCase()) return 'OWNER'
  if (params.admins.some((a) => a.toLowerCase() === w)) return 'ADMIN'
  return 'MEMBER'
}

function formatVaultStatus(v: Awaited<ReturnType<typeof getKeeprVaultByGroupId>>): string {
  if (!v) {
    return [
      'Keepr status',
      '',
      '- configured: no',
      '- next: ask the creator to connect this group in CreatorVault',
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

export async function handleKeeprCommand(params: {
  groupId: string
  senderWallet: Address
  text: string
}): Promise<KeeprCommandResult> {
  const raw = (params.text ?? '').trim()

  // Global aliases: /help and "help" should always respond (even without DB/vault config).
  const rawLower = raw.toLowerCase()
  if (rawLower === '/help' || rawLower === 'help') {
    return { ok: true, response: formatKeeprHelp() }
  }

  // AI commands should work even when vault config/DB is unavailable.
  const looksLikeAi =
    rawLower.startsWith('/ai') ||
    rawLower.startsWith('@keepr') ||
    rawLower.startsWith('@bot')
  if (looksLikeAi) {
    const aiText = raw.replace(/^\/?ai\s*/i, '').replace(/^@(keepr|bot)\s*/i, '').trim()
    if (!aiText) {
      return { ok: true, response: 'Ask me anything about this vault or DeFi on Base.' }
    }
    const v = await getKeeprVaultByGroupId(params.groupId)
    return generateLlmResponse({
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      text: aiText,
      vault: v,
    })
  }
  
  // Handle Farcaster commands (/fc or fc)
  const looksLikeFc = raw.toLowerCase().startsWith('/fc') || raw.toLowerCase().startsWith('fc ')
  if (looksLikeFc) {
    // Determine role for Farcaster commands
    const v = await getKeeprVaultByGroupId(params.groupId)
    let role: KeeprRole = 'MEMBER'
    if (v) {
      const owner = v.canonicalOwnerAddress
      const admins = Array.isArray(v.config?.roles?.admins) ? v.config.roles.admins : []
      const adminsLc = admins.filter(isAddressLike).map((a) => a.toLowerCase() as Address)
      role = roleForWallet({ wallet: params.senderWallet, owner, admins: adminsLc })
    }
    return handleFarcasterCommand({
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      text: raw,
      role,
    })
  }

  // Handle /send command
  const looksLikeSend = raw.toLowerCase().startsWith('/send') || raw.toLowerCase().startsWith('send ')
  if (looksLikeSend) {
    const sv = await getKeeprVaultByGroupId(params.groupId)
    if (!sv) return { ok: false, response: 'Vault not configured. /send requires a connected vault.' }
    const sOwner = sv.canonicalOwnerAddress
    const sAdmins = Array.isArray(sv.config?.roles?.admins) ? sv.config.roles.admins : []
    const sAdminsLc = sAdmins.filter(isAddressLike).map((a) => a.toLowerCase() as Address)
    const sRole = roleForWallet({ wallet: params.senderWallet, owner: sOwner, admins: sAdminsLc })
    return handleSendCommand({
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      text: raw,
      role: sRole,
      vault: sv,
    })
  }

  // Handle /coin command (Zora Coins)
  const looksLikeCoin = raw.toLowerCase().startsWith('/coin') || raw.toLowerCase().startsWith('coin ')
  if (looksLikeCoin) {
    const cv = await getKeeprVaultByGroupId(params.groupId)
    if (!cv) return { ok: false, response: 'Vault not configured. /coin requires a connected vault.' }
    const cOwner = cv.canonicalOwnerAddress
    const cAdmins = Array.isArray(cv.config?.roles?.admins) ? cv.config.roles.admins : []
    const cAdminsLc = cAdmins.filter(isAddressLike).map((a) => a.toLowerCase() as Address)
    const cRole = roleForWallet({ wallet: params.senderWallet, owner: cOwner, admins: cAdminsLc })
    return handleCoinCommand({
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      text: raw,
      role: cRole,
      vault: cv,
    })
  }

  const v = await getKeeprVaultByGroupId(params.groupId)
  if (!v) {
    // Allow basic commands to explain next steps even if not configured.
    const raw0 = raw.toLowerCase()
    const looksLikeKeepr = raw0.startsWith('/keepr') || raw0.startsWith('keepr')
    const parts0 = raw0.split(/\s+/g).filter(Boolean)
    const cmd0 = looksLikeKeepr ? (parts0[1] ?? 'help') : ''
    if (cmd0 === 'help') {
      return { ok: true, response: formatKeeprHelp() }
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
          '- next: ask the creator to connect this group in CreatorVault',
        ].join('\n'),
      }
    }
    return { ok: false, response: 'Keepr is not configured for this group.' }
  }

  const owner = v.canonicalOwnerAddress
  const admins = Array.isArray(v.config?.roles?.admins) ? v.config.roles.admins : []
  const adminsLc = admins.filter(isAddressLike).map((a) => a.toLowerCase() as Address)
  const role = roleForWallet({ wallet: params.senderWallet, owner, admins: adminsLc })

  const prefix = raw.toLowerCase().startsWith('/keepr') ? '/keepr' : raw.toLowerCase().startsWith('keepr') ? 'keepr' : null
  if (!prefix) {
    // Check for /ai, @keepr, or @bot → LLM response
    const looksLikeAi =
      raw.toLowerCase().startsWith('/ai') ||
      raw.toLowerCase().startsWith('@keepr') ||
      raw.toLowerCase().startsWith('@bot')
    if (looksLikeAi) {
      const aiText = raw.replace(/^\/?ai\s*/i, '').replace(/^@(keepr|bot)\s*/i, '').trim()
      if (aiText) {
        const llmResult = await generateLlmResponse({
          groupId: params.groupId,
          senderWallet: params.senderWallet,
          text: aiText,
          vault: v,
        })
        if (llmResult.ok) return llmResult
      }
    }
    return { ok: false, response: '' }
  }
  const parts = raw.split(/\s+/g).filter(Boolean)
  const cmd = parts[0]?.toLowerCase() === prefix ? (parts[1] ? String(parts[1]).toLowerCase() : 'help') : 'help'
  const arg = parts[0]?.toLowerCase() === prefix ? (parts[2] ? String(parts[2]) : null) : null

  if (cmd === 'help') {
    return {
      ok: true,
      response: formatKeeprHelp(),
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
    if (role !== 'OWNER') {
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
    if (arg && targetWallet !== params.senderWallet && role === 'MEMBER') {
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
    if (role === 'MEMBER') {
      return { ok: false, response: 'Denied: ADMIN or OWNER only.' }
    }
    // The long-lived Keepr runtime performs sync (group.members -> check -> remove).
    return { ok: true, response: 'Sync requested. The Keepr runtime will process this shortly.' }
  }

  return { ok: false, response: 'Unknown command. Try `/keepr help`.' }
}
