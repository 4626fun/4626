import type { IntegrityCardRoomMetrics } from './integrityCardPolicy.js'
import { h, type SatoriNode } from './satoriRenderer.js'
import type { Scorecard } from './scorecard.js'

export const INTEGRITY_CARD_CANVAS = { width: 1080, height: 1350 } as const

const PALETTE = {
  ink: '#090a0e',
  inkSoft: '#12141a',
  parchment: '#f4efe6',
  parchmentSoft: 'rgba(244,239,230,0.88)',
  stone: '#a39a8e',
  stoneSoft: 'rgba(163,154,142,0.78)',
  champagne: '#d6b889',
  champagneBright: '#e4c9a0',
  champagneSoft: 'rgba(214,184,137,0.2)',
  line: 'rgba(244,239,230,0.12)',
  lineStrong: 'rgba(244,239,230,0.2)',
  veil: 'rgba(7,8,11,0.42)',
  veilMid: 'rgba(7,8,11,0.18)',
  veilDeep: 'rgba(7,8,11,0.88)',
  glass: 'rgba(12,13,18,0.72)',
  positive: '#9fceb0',
  negative: '#d9a39a',
} as const

const FONT = 'Inter'
const FONT_MONO = 'JetBrains Mono'

export type IntegrityCardVisuals = {
  roomImageDataUrl?: string | null
  pfpDataUrl?: string | null
  hermitMarkDataUrl?: string | null
  displayName: string
  handle: string | null
  roomName: string | null
  scorecardUri?: string | null
  /**
   * When room chip metrics come from a live upsert (not the Grove scorecard),
   * pass that row's ingestedAt so the card does not imply they share snapshotTs.
   */
  roomMetricsAsOf?: string | null
}

export type IntegrityCardInput = {
  scorecard: Scorecard
  visuals: IntegrityCardVisuals
  roomMetrics?: IntegrityCardRoomMetrics | null
}

type MetricTone = 'neutral' | 'positive' | 'negative'

function truncate(value: string, max: number): string {
  const clean = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (clean.length <= max) return clean
  return `${clean.slice(0, Math.max(1, max - 1))}…`
}

function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 100_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  const abs = Math.abs(value)
  if (abs >= 100) return `${sign}${value.toFixed(0)}%`
  if (abs >= 10) return `${sign}${value.toFixed(1)}%`
  return `${sign}${value.toFixed(2)}%`
}

function formatInt(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('en-US')
}

function formatThirtyDayPnl(metrics: IntegrityCardRoomMetrics | null | undefined): string {
  if (!metrics) return '—'
  if (metrics.pnl30dUsd != null && Number.isFinite(metrics.pnl30dUsd)) {
    return formatUsd(metrics.pnl30dUsd)
  }
  return formatPct(metrics.pnlPct30d)
}

function toneFromNumber(value: number | null | undefined): MetricTone {
  if (value == null || !Number.isFinite(value) || value === 0) return 'neutral'
  return value > 0 ? 'positive' : 'negative'
}

function thirtyDayTone(metrics: IntegrityCardRoomMetrics | null | undefined): MetricTone {
  if (!metrics) return 'neutral'
  if (metrics.pnl30dUsd != null && Number.isFinite(metrics.pnl30dUsd)) {
    return toneFromNumber(metrics.pnl30dUsd)
  }
  return toneFromNumber(metrics.pnlPct30d)
}

function formatSnapshotDate(iso: string): string {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return truncate(iso, 24)
  return new Date(ts).toISOString().slice(0, 10)
}

function shortHash(uri: string | null | undefined): string {
  const raw = String(uri ?? '').trim()
  if (!raw) return ''
  const key = raw.replace(/^lens:\/\//, '').replace(/^https?:\/\/[^/]+\//, '')
  if (key.length <= 12) return key
  return `${key.slice(0, 6)}…${key.slice(-4)}`
}

function podiumLabel(rank: number): string | null {
  if (rank === 1) return 'DAILY LEAD'
  if (rank === 2) return 'RUNNER-UP'
  if (rank === 3) return 'PODIUM'
  return null
}

function imgNode(src: string, width: number, height: number, extraStyle: Record<string, string | number> = {}): SatoriNode {
  return {
    type: 'img',
    props: {
      src,
      width,
      height,
      style: {
        width,
        height,
        display: 'flex',
        ...extraStyle,
      },
    },
  } as unknown as SatoriNode
}

function metricChip(label: string, value: string, tone: MetricTone = 'neutral'): SatoriNode {
  const valueColor =
    tone === 'positive'
      ? PALETTE.positive
      : tone === 'negative'
        ? PALETTE.negative
        : PALETTE.parchment

  return h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      paddingTop: 16,
      paddingBottom: 16,
      paddingLeft: 18,
      paddingRight: 18,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.035)',
      border: `1px solid ${PALETTE.line}`,
      minWidth: 176,
      flexGrow: 1,
    },
    h(
      'div',
      {
        display: 'flex',
        fontSize: 14,
        fontFamily: FONT,
        fontWeight: 500,
        letterSpacing: 1.6,
        color: PALETTE.stone,
      },
      label.toUpperCase(),
    ),
    h(
      'div',
      {
        display: 'flex',
        marginTop: 8,
        fontSize: 30,
        fontFamily: FONT_MONO,
        fontWeight: 500,
        color: valueColor,
        letterSpacing: -0.6,
      },
      value,
    ),
  )
}

/**
 * Pure Satori tree for a daily Integrity Card. Visual assets are optional;
 * the layout remains readable with gradient fallbacks when images are missing.
 */
export function buildIntegrityCardTree(input: IntegrityCardInput): SatoriNode {
  const { scorecard, visuals } = input
  const roomMetrics = input.roomMetrics ?? null
  const rank = scorecard.scores.rank
  const total = scorecard.scores.totalRanked
  const handle = visuals.handle ? `@${visuals.handle.replace(/^@/, '')}` : null
  const roomLabel = visuals.roomName
    ? truncate(visuals.roomName, 36)
    : `Room #${scorecard.creator.tokenId}`
  const displayName = truncate(visuals.displayName || handle || roomLabel, 28)
  const snapshotDay = formatSnapshotDate(scorecard.snapshotTs)
  const roomMetricsDay = visuals.roomMetricsAsOf
    ? formatSnapshotDate(visuals.roomMetricsAsOf)
    : null
  const hashCrumb = shortHash(visuals.scorecardUri)
  const podium = podiumLabel(rank)
  const rankColor = rank <= 3 ? PALETTE.champagneBright : PALETTE.parchment
  const provenanceCrumb = [
    hashCrumb || null,
    roomMetricsDay && roomMetricsDay !== snapshotDay ? `room ${roomMetricsDay}` : null,
    `composite ${scorecard.scores.composite.toFixed(3)}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const background = visuals.roomImageDataUrl
    ? imgNode(visuals.roomImageDataUrl, INTEGRITY_CARD_CANVAS.width, INTEGRITY_CARD_CANVAS.height, {
        objectFit: 'cover',
        position: 'absolute',
        top: 0,
        left: 0,
      })
    : h('div', {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: `linear-gradient(165deg, ${PALETTE.inkSoft} 0%, ${PALETTE.ink} 55%, #1a1713 100%)`,
        display: 'flex',
      })

  const pfpSize = 128
  const pfp = visuals.pfpDataUrl
    ? imgNode(visuals.pfpDataUrl, pfpSize, pfpSize, {
        borderRadius: pfpSize / 2,
        objectFit: 'cover',
      })
    : h('div', {
        width: pfpSize,
        height: pfpSize,
        borderRadius: pfpSize / 2,
        backgroundColor: PALETTE.champagneSoft,
        border: `1px solid ${PALETTE.champagne}`,
        display: 'flex',
      })

  return h(
    'div',
    {
      width: INTEGRITY_CARD_CANVAS.width,
      height: INTEGRITY_CARD_CANVAS.height,
      display: 'flex',
      position: 'relative',
      backgroundColor: PALETTE.ink,
      color: PALETTE.parchment,
      overflow: 'hidden',
    },
    background,
    h('div', {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      backgroundImage: `linear-gradient(180deg, ${PALETTE.veil} 0%, ${PALETTE.veilMid} 34%, ${PALETTE.veilDeep} 68%, #050608 100%)`,
    }),
    h('div', {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      display: 'flex',
      backgroundColor: PALETTE.champagne,
    }),
    h(
      'div',
      {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        paddingTop: 48,
        paddingBottom: 40,
        paddingLeft: 48,
        paddingRight: 48,
      },
      // Header
      h(
        'div',
        {
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          width: '100%',
        },
        h(
          'div',
          { display: 'flex', flexDirection: 'column' },
          h(
            'div',
            {
              display: 'flex',
              fontSize: 17,
              fontFamily: FONT,
              fontWeight: 600,
              letterSpacing: 3.4,
              color: PALETTE.champagne,
            },
            'INTEGRITY SNAPSHOT',
          ),
          h(
            'div',
            {
              display: 'flex',
              marginTop: 10,
              fontSize: 22,
              fontFamily: FONT,
              fontWeight: 500,
              color: PALETTE.parchmentSoft,
            },
            snapshotDay,
          ),
        ),
        h(
          'div',
          {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
          },
          podium
            ? h(
                'div',
                {
                  display: 'flex',
                  paddingTop: 8,
                  paddingBottom: 8,
                  paddingLeft: 14,
                  paddingRight: 14,
                  borderRadius: 999,
                  backgroundColor: PALETTE.champagneSoft,
                  border: `1px solid ${PALETTE.lineStrong}`,
                  marginBottom: 10,
                },
                h(
                  'div',
                  {
                    display: 'flex',
                    fontSize: 13,
                    fontFamily: FONT,
                    fontWeight: 600,
                    letterSpacing: 1.8,
                    color: PALETTE.champagneBright,
                  },
                  podium,
                ),
              )
            : null,
          h(
            'div',
            {
              display: 'flex',
              fontSize: 17,
              fontFamily: FONT_MONO,
              fontWeight: 500,
              color: PALETTE.stone,
            },
            `${formatInt(total)} ranked`,
          ),
        ),
      ),

      // Hero identity
      h(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          flexGrow: 1,
          marginTop: 36,
          marginBottom: 28,
        },
        h(
          'div',
          {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-end',
            width: '100%',
          },
          h(
            'div',
            {
              display: 'flex',
              marginRight: 28,
            },
            h(
              'div',
              {
                display: 'flex',
                width: pfpSize + 14,
                height: pfpSize + 14,
                borderRadius: (pfpSize + 14) / 2,
                border: `1px solid ${PALETTE.champagne}`,
                backgroundColor: 'rgba(0,0,0,0.35)',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 7,
              },
              pfp,
            ),
          ),
          h(
            'div',
            {
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              paddingBottom: 2,
            },
            h(
              'div',
              {
                display: 'flex',
                fontSize: 168,
                fontFamily: FONT_MONO,
                fontWeight: 500,
                letterSpacing: -8,
                color: rankColor,
                lineHeight: 0.86,
              },
              `#${rank}`,
            ),
            h(
              'div',
              {
                display: 'flex',
                marginTop: 14,
                fontSize: 46,
                fontFamily: FONT,
                fontWeight: 600,
                letterSpacing: -1.2,
                color: PALETTE.parchment,
                lineHeight: 1.02,
              },
              displayName,
            ),
            h(
              'div',
              {
                display: 'flex',
                marginTop: 10,
                fontSize: 23,
                fontFamily: FONT,
                fontWeight: 500,
                color: PALETTE.stoneSoft,
              },
              [handle, roomLabel].filter(Boolean).join(' · '),
            ),
          ),
        ),
      ),

      // Glass deck: metrics + reporter
      h(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          borderRadius: 28,
          backgroundColor: PALETTE.glass,
          border: `1px solid ${PALETTE.line}`,
          paddingTop: 22,
          paddingBottom: 20,
          paddingLeft: 22,
          paddingRight: 22,
        },
        h(
          'div',
          {
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
          },
          h(
            'div',
            { display: 'flex', flexGrow: 1, marginRight: 12 },
            metricChip('Fund', formatUsd(roomMetrics?.fundUsd)),
          ),
          h(
            'div',
            { display: 'flex', flexGrow: 1, marginRight: 12 },
            metricChip('Holders', formatInt(roomMetrics?.holders)),
          ),
          h(
            'div',
            { display: 'flex', flexGrow: 1, marginRight: 12 },
            metricChip(
              'All-time',
              formatPct(roomMetrics?.pnlPctAllTime),
              toneFromNumber(roomMetrics?.pnlPctAllTime),
            ),
          ),
          h(
            'div',
            { display: 'flex', flexGrow: 1 },
            metricChip('30d', formatThirtyDayPnl(roomMetrics), thirtyDayTone(roomMetrics)),
          ),
        ),
        h(
          'div',
          {
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 20,
            paddingTop: 18,
            borderTop: `1px solid ${PALETTE.line}`,
            width: '100%',
          },
          h(
            'div',
            {
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              marginRight: 20,
            },
            h(
              'div',
              {
                display: 'flex',
                fontSize: 15,
                fontFamily: FONT,
                fontWeight: 500,
                color: PALETTE.stone,
              },
              "Onchain-derived · not AlfaClub's in-app rank",
            ),
            h(
              'div',
              {
                display: 'flex',
                marginTop: 6,
                fontSize: 14,
                fontFamily: FONT_MONO,
                fontWeight: 500,
                color: PALETTE.stoneSoft,
              },
              provenanceCrumb,
            ),
          ),
          h(
            'div',
            {
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              paddingTop: 8,
              paddingBottom: 8,
              paddingLeft: 10,
              paddingRight: 14,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: `1px solid ${PALETTE.line}`,
            },
            visuals.hermitMarkDataUrl
              ? h(
                  'div',
                  {
                    display: 'flex',
                    marginRight: 12,
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    overflow: 'hidden',
                  },
                  imgNode(visuals.hermitMarkDataUrl, 46, 46, {
                    borderRadius: 14,
                    objectFit: 'cover',
                  }),
                )
              : null,
            h(
              'div',
              {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              },
              h(
                'div',
                {
                  display: 'flex',
                  fontSize: 12,
                  fontFamily: FONT,
                  fontWeight: 600,
                  letterSpacing: 1.4,
                  color: PALETTE.champagne,
                },
                'REPORTED BY',
              ),
              h(
                'div',
                {
                  display: 'flex',
                  marginTop: 3,
                  fontSize: 19,
                  fontFamily: FONT,
                  fontWeight: 600,
                  color: PALETTE.parchment,
                  letterSpacing: -0.3,
                },
                'hermit4626',
              ),
            ),
          ),
        ),
      ),
    ),
  )
}

export const __integrityCardTestables = {
  formatUsd,
  formatPct,
  formatInt,
  formatThirtyDayPnl,
  toneFromNumber,
  thirtyDayTone,
  podiumLabel,
  formatSnapshotDate,
  shortHash,
  truncate,
}
