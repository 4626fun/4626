/**
 * ElizaOS AlfaClub Plugin
 *
 * Surfaces the 4626 AlfaClub Integrity Vigilante inside chat via a single
 * `/alfa` command family. Reads directly from the server-side Vigilante
 * modules — no HTTP hop — so this works in any ElizaOS runtime (XMTP,
 * Telegram, Discord, Twitter) that reaches the server bundle.
 *
 *   /alfa                        → show current top-N leaderboard
 *   /alfa leaderboard            → same (explicit)
 *   /alfa <address>              → creator detail (rank, score, supply, PnL, latest publications)
 *   /alfa creator <address>      → same (explicit)
 *   /alfa status                 → show pipeline phase flag status
 *
 * Every response includes the onchain-derived disclaimer so the output
 * is legible to downstream consumers (XMTP clients, Farcaster bridges,
 * leaderboard screenshots). No editorial language, numeric facts only.
 */

import type {
  Action,
  Content,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  Plugin,
  State,
} from '@elizaos/core'

import {
  getLatestSnapshotTs,
  getSnapshotAt,
  listRecentPublications,
  recentPublicationsForCreator,
  type MetricsSnapshotRow,
  type PublicationRecord,
} from '../../../../_lib/alfaclub/publicationLedger.js'
import {
  readVigilanteFlags,
  type VigilanteFlags,
} from '../../../../_lib/alfaclub/vigilante.js'
import { SCORECARD_DISCLAIMER } from '../../../../_lib/alfaclub/scorecard.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseAddressFromText(text: string): string | null {
  const match = text.match(/0x[a-fA-F0-9]{40}/)
  return match ? match[0].toLowerCase() : null
}

function normalizeAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  return raw.toLowerCase()
}

function resolveSenderAddress(message: Memory): string | null {
  const metadata = message.content?.metadata as Record<string, unknown> | undefined
  return normalizeAddress(metadata?.senderAddress)
}

function shortAddress(value: string): string {
  return `${value.slice(0, 10)}...${value.slice(-6)}`
}

function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`
  return `${sign}$${abs.toFixed(2)}`
}

function parseSubcommand(text: string): {
  sub: 'leaderboard' | 'creator' | 'status' | 'help' | null
  address: string | null
} {
  const cleaned = text.trim().replace(/^\/alfa(?:club)?\s*/i, '').trim()
  if (!cleaned) return { sub: 'leaderboard', address: null }

  const parts = cleaned.split(/\s+/)
  const first = (parts[0] ?? '').toLowerCase()

  if (first === 'leaderboard' || first === 'top' || first === 'ranking') {
    return { sub: 'leaderboard', address: null }
  }
  if (first === 'status' || first === 'flags' || first === 'health') {
    return { sub: 'status', address: null }
  }
  if (first === 'help' || first === '?') {
    return { sub: 'help', address: null }
  }
  if (first === 'creator' || first === 'wallet' || first === 'addr') {
    return { sub: 'creator', address: parseAddressFromText(parts.slice(1).join(' ')) }
  }
  // Bare address — treat as creator query.
  const addr = parseAddressFromText(cleaned)
  if (addr) return { sub: 'creator', address: addr }

  return { sub: 'help', address: null }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatFlagsLine(flags: VigilanteFlags): string {
  const bits: string[] = []
  if (flags.killSwitch) bits.push('kill-switch ON')
  bits.push(flags.readEnabled ? 'read=on' : 'read=off')
  bits.push(flags.postEnabled ? 'post=on' : 'post=off')
  bits.push(flags.feedbackEnabled ? 'feedback=on' : 'feedback=off')
  bits.push(`topN=${flags.topN}`)
  bits.push(`cooldown=${flags.cooldownHours}h`)
  return bits.join(' · ')
}

function formatLeaderboard(params: {
  flags: VigilanteFlags
  snapshotTs: string | null
  rows: MetricsSnapshotRow[]
  pubsByAddress: Map<string, PublicationRecord[]>
}): string {
  const { flags, snapshotTs, rows, pubsByAddress } = params
  const lines: string[] = [`**AlfaClub Integrity Leaderboard**`]
  if (flags.killSwitch) {
    lines.push('Pipeline is in KILL_SWITCH state. No snapshot data will be returned.')
    lines.push('')
    lines.push(SCORECARD_DISCLAIMER)
    return lines.join('\n')
  }
  if (!flags.readEnabled) {
    lines.push('Pipeline is dormant. `ALFACLUB_VIGILANTE_READ_ENABLED` is off.')
    lines.push('')
    lines.push(SCORECARD_DISCLAIMER)
    return lines.join('\n')
  }
  if (!snapshotTs || rows.length === 0) {
    lines.push(
      'No snapshot available yet. The daily cron populates this surface; expect the first run at 12:00 UTC.',
    )
    lines.push('')
    lines.push(SCORECARD_DISCLAIMER)
    return lines.join('\n')
  }

  lines.push(`**Snapshot:** ${snapshotTs}`)
  lines.push(`**Flags:** ${formatFlagsLine(flags)}`)
  lines.push('')

  for (const row of rows.slice(0, flags.topN)) {
    const pubs = pubsByAddress.get(row.creatorAddress.toLowerCase()) ?? []
    const pub = pubs[0]
    const pubTag = pub
      ? pub.erc8004TxHash
        ? ` · erc8004:${pub.erc8004TxHash.slice(0, 10)}…`
        : pub.lensPostId
          ? ` · lens:${pub.lensPostId.slice(0, 10)}…`
          : ` · ${pub.kind}`
      : ''
    lines.push(
      `${String(row.rank).padStart(2, ' ')}. \`${shortAddress(row.creatorAddress)}\` #${row.tokenId.toString()} ` +
        `· supply=${row.totalSupply.toString()} · staked=${row.stakedSupply.toString()} ` +
        `· pnl30d=${formatUsd(row.pnl30dUsd ?? null)} · score=${row.score.toFixed(4)}${pubTag}`,
    )
  }

  lines.push('')
  lines.push(SCORECARD_DISCLAIMER)
  return lines.join('\n')
}

function formatCreatorDetail(params: {
  flags: VigilanteFlags
  snapshotTs: string | null
  address: string
  row: MetricsSnapshotRow | null
  publications: PublicationRecord[]
}): string {
  const { flags, snapshotTs, address, row, publications } = params
  const lines: string[] = [
    `**AlfaClub Creator** \`${address}\``,
    `**Flags:** ${formatFlagsLine(flags)}`,
  ]
  if (flags.killSwitch) {
    lines.push('Pipeline is in KILL_SWITCH state. No snapshot data will be returned.')
    lines.push('')
    lines.push(SCORECARD_DISCLAIMER)
    return lines.join('\n')
  }
  if (!flags.readEnabled) {
    lines.push('Pipeline is dormant. `ALFACLUB_VIGILANTE_READ_ENABLED` is off.')
    lines.push('')
    lines.push(SCORECARD_DISCLAIMER)
    return lines.join('\n')
  }
  if (!snapshotTs) {
    lines.push('No snapshot available yet — the cron has not run.')
    lines.push('')
    lines.push(SCORECARD_DISCLAIMER)
    return lines.join('\n')
  }
  lines.push(`**Snapshot:** ${snapshotTs}`)
  if (!row) {
    lines.push('This address is not currently indexed as an AlfaClub creator (no FriendKey room minted to it).')
    lines.push('')
    lines.push(SCORECARD_DISCLAIMER)
    return lines.join('\n')
  }
  lines.push('')
  lines.push(`**Rank:** ${row.rank}`)
  lines.push(`**Room (FriendKey tokenId):** ${row.tokenId.toString()}`)
  lines.push(`**Supply:** ${row.totalSupply.toString()} (staked ${row.stakedSupply.toString()})`)
  lines.push(
    `**Hyperliquid:** account=${formatUsd(row.hlAccountValueUsd ?? null)} · pnl30d=${formatUsd(row.pnl30dUsd ?? null)}`,
  )
  lines.push(`**Composite score:** ${row.score.toFixed(4)}`)

  if (publications.length > 0) {
    lines.push('')
    lines.push('**Recent publications:**')
    for (const p of publications.slice(0, 3)) {
      const tag =
        p.erc8004TxHash
          ? `erc8004:${p.erc8004TxHash.slice(0, 14)}…`
          : p.lensPostId
            ? `lens:${p.lensPostId.slice(0, 14)}…`
            : p.scorecardUri
              ? `scorecard:${p.scorecardUri.slice(0, 20)}…`
              : p.kind
      lines.push(`  • [${p.kind}] ${p.createdAt} — ${tag}`)
    }
  }

  lines.push('')
  lines.push(SCORECARD_DISCLAIMER)
  return lines.join('\n')
}

function formatStatus(flags: VigilanteFlags): string {
  const lines: string[] = [
    '**AlfaClub Vigilante — Pipeline Status**',
    '',
    `KILL_SWITCH: ${flags.killSwitch ? 'ON' : 'off'}`,
    `READ_ENABLED: ${flags.readEnabled ? 'on' : 'off'}`,
    `POST_ENABLED: ${flags.postEnabled ? 'on' : 'off'}`,
    `FEEDBACK_ENABLED: ${flags.feedbackEnabled ? 'on' : 'off'}`,
    `TOP_N: ${flags.topN}`,
    `COOLDOWN: ${flags.cooldownHours}h`,
    '',
    SCORECARD_DISCLAIMER,
  ]
  return lines.join('\n')
}

function formatHelp(): string {
  return [
    '**/alfa** — AlfaClub Integrity Vigilante',
    '',
    '  `/alfa` — top-N leaderboard',
    '  `/alfa <address>` — detail for a specific creator address',
    '  `/alfa creator <address>` — same, explicit form',
    '  `/alfa status` — pipeline phase flag status',
    '',
    SCORECARD_DISCLAIMER,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Data loaders (thin wrappers so tests can mock them via vi.mock)
// ---------------------------------------------------------------------------

async function loadLeaderboard(flags: VigilanteFlags): Promise<{
  snapshotTs: string | null
  rows: MetricsSnapshotRow[]
  pubsByAddress: Map<string, PublicationRecord[]>
}> {
  if (!flags.readEnabled) {
    return { snapshotTs: null, rows: [], pubsByAddress: new Map() }
  }
  const snapshotTs = await getLatestSnapshotTs()
  if (!snapshotTs) {
    return { snapshotTs: null, rows: [], pubsByAddress: new Map() }
  }
  const [rows, pubs] = await Promise.all([
    getSnapshotAt(snapshotTs),
    listRecentPublications(null, 200),
  ])
  const pubsByAddress = new Map<string, PublicationRecord[]>()
  for (const p of pubs) {
    const key = p.creatorAddress.toLowerCase()
    const list = pubsByAddress.get(key) ?? []
    list.push(p)
    pubsByAddress.set(key, list)
  }
  return { snapshotTs, rows, pubsByAddress }
}

async function loadCreator(
  flags: VigilanteFlags,
  address: string,
): Promise<{
  snapshotTs: string | null
  row: MetricsSnapshotRow | null
  publications: PublicationRecord[]
}> {
  if (!flags.readEnabled) {
    return { snapshotTs: null, row: null, publications: [] }
  }
  const snapshotTs = await getLatestSnapshotTs()
  if (!snapshotTs) {
    return { snapshotTs: null, row: null, publications: [] }
  }
  const normalized = address.toLowerCase()
  const [rows, lensPubs, erc8004Pubs] = await Promise.all([
    getSnapshotAt(snapshotTs),
    recentPublicationsForCreator(normalized, 'lens', 5),
    recentPublicationsForCreator(normalized, 'erc8004-submitted', 5),
  ])
  const row = rows.find((r) => r.creatorAddress.toLowerCase() === normalized) ?? null
  const allPubs = [...lensPubs, ...erc8004Pubs].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  )
  return { snapshotTs, row, publications: allPubs }
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

const alfaclubAction: Action = {
  name: 'ALFACLUB_VIGILANTE',
  similes: ['alfa', 'alfaclub', 'vigilante', 'leaderboard', 'creator integrity'],
  description:
    'AlfaClub Integrity Vigilante — onchain-derived leaderboard (FriendKey + FriendStake + Hyperliquid) and creator scorecards.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/alfa')
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const text = message.content?.text ?? ''
    const parsed = parseSubcommand(text)
    const flags = readVigilanteFlags()

    try {
      if (parsed.sub === 'status') {
        await callback?.({ text: formatStatus(flags) } as Content)
        return
      }
      if (parsed.sub === 'help') {
        await callback?.({ text: formatHelp() } as Content)
        return
      }
      if (parsed.sub === 'creator') {
        const address = parsed.address ?? resolveSenderAddress(message)
        if (!address) {
          await callback?.({
            text: 'Usage: `/alfa <address>` or `/alfa creator <address>`.',
          } as Content)
          return
        }
        const loaded = await loadCreator(flags, address)
        await callback?.({
          text: formatCreatorDetail({
            flags,
            snapshotTs: loaded.snapshotTs,
            address,
            row: loaded.row,
            publications: loaded.publications,
          }),
        } as Content)
        return
      }
      // default: leaderboard
      const loaded = await loadLeaderboard(flags)
      await callback?.({
        text: formatLeaderboard({
          flags,
          snapshotTs: loaded.snapshotTs,
          rows: loaded.rows,
          pubsByAddress: loaded.pubsByAddress,
        }),
      } as Content)
    } catch (err: any) {
      await callback?.({
        text: `AlfaClub Vigilante command failed: ${String(err?.message ?? err)}`,
      } as Content)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/alfa' } },
      { name: 'agent', content: { text: 'AlfaClub Integrity Leaderboard\n...' } },
    ],
    [
      { name: 'user', content: { text: '/alfa 0xd8da6bf26964af9d7eed9e03e53415d37aa96045' } },
      { name: 'agent', content: { text: 'AlfaClub Creator 0xd8da...\n...' } },
    ],
    [
      { name: 'user', content: { text: '/alfa status' } },
      { name: 'agent', content: { text: 'AlfaClub Vigilante — Pipeline Status\n...' } },
    ],
  ],
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

export const alfaclubPlugin: Plugin = {
  name: '@4626/plugin-alfaclub',
  description:
    'AlfaClub Integrity Vigilante — /alfa leaderboard + creator scorecards sourced from the onchain-derived snapshot.',
  actions: [alfaclubAction],
}

export default alfaclubPlugin

// Exports used by tests only.
export { parseSubcommand, formatLeaderboard, formatCreatorDetail, formatStatus, formatHelp }
