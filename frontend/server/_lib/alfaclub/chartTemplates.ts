import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { h, type SatoriNode } from './satoriRenderer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const HERMIT_AVATAR_PATH = resolve(__dirname, 'assets/hermit-avatar.png')

let hermitAvatarDataUrlCache: string | null = null

function getHermitAvatarDataUrl(): string {
  if (hermitAvatarDataUrlCache !== null) return hermitAvatarDataUrlCache
  try {
    const buf = readFileSync(HERMIT_AVATAR_PATH)
    hermitAvatarDataUrlCache = `data:image/png;base64,${buf.toString('base64')}`
  } catch (err) {
    console.warn('[alfa/charts] hermit avatar load failed:', err)
    hermitAvatarDataUrlCache = ''
  }
  return hermitAvatarDataUrlCache
}

const PALETTE = {
  bg: '#07080c',
  bgSoft: '#0c0e15',
  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#fafbff',
  secondary: '#b6becd',
  muted: '#7a8295',
  accent: '#5c8cff',
  accentSoft: 'rgba(92,140,255,0.16)',
  accentRich: '#7aa2ff',
  positive: '#3ddc97',
  negative: '#ff6b6b',
} as const

const RAMP: readonly string[] = [
  '#7aa2ff',
  '#5c8cff',
  '#4878f0',
  '#3964d6',
  '#2a52bd',
  '#22468f',
  '#3a4d6b',
] as const

const FONT_INTER = 'Inter'
const FONT_MONO = 'JetBrains Mono'

const CANVAS = { width: 1200, height: 1200 } as const
const HERO_HEIGHT = 460
const CHART_HEIGHT = CANVAS.height - HERO_HEIGHT
const SIDE_PADDING = 64

type ShellInput = {
  eyebrow: string
  heroValue: string
  heroCaption: string
  context?: string
  chart: SatoriNode
  source: string
}

function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  if (abs >= 100) return `$${value.toFixed(0)}`
  if (abs >= 1) return `$${value.toFixed(2)}`
  if (abs > 0) return `$${value.toFixed(3)}`
  return '$0'
}

function formatInt(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString('en-US')
}

function formatTimestampShort(date = new Date()): string {
  const iso = date.toISOString()
  return `${iso.slice(0, 10)} · ${iso.slice(11, 16)} UTC`
}

function truncate(value: string, max: number): string {
  const clean = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (clean.length <= max) return clean
  return `${clean.slice(0, Math.max(1, max - 1))}…`
}

function buildShell(input: ShellInput): SatoriNode {
  const { eyebrow, heroValue, heroCaption, context, chart, source } = input

  const avatarUrl = getHermitAvatarDataUrl()
  const avatarSize = 52
  const avatarMark: SatoriNode = avatarUrl
    ? ({
        type: 'img',
        props: {
          src: avatarUrl,
          width: avatarSize,
          height: avatarSize,
          style: {
            width: avatarSize,
            height: avatarSize,
            display: 'flex',
          },
        },
      } as unknown as SatoriNode)
    : ({
        type: 'div',
        props: {
          style: {
            width: avatarSize,
            height: avatarSize,
            borderRadius: 12,
            backgroundColor: PALETTE.accent,
            display: 'flex',
          },
        },
      } as unknown as SatoriNode)

  const topBar = h(
    'div',
    {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      paddingTop: 4,
    },
    h(
      'div',
      {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
      },
      avatarMark,
      h(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          marginLeft: 14,
          justifyContent: 'center',
        },
        h(
          'div',
          {
            fontSize: 20,
            fontFamily: FONT_INTER,
            fontWeight: 700,
            letterSpacing: -0.5,
            color: PALETTE.text,
            lineHeight: 1.05,
            display: 'flex',
          },
          'hermit4626bot',
        ),
        h(
          'div',
          {
            fontSize: 12,
            fontFamily: FONT_INTER,
            fontWeight: 500,
            color: PALETTE.muted,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginTop: 4,
            display: 'flex',
          },
          'intern to the intern cats',
        ),
      ),
    ),
    h(
      'div',
      {
        fontSize: 12,
        fontFamily: FONT_MONO,
        fontWeight: 500,
        color: PALETTE.muted,
        letterSpacing: 0.3,
        display: 'flex',
      },
      formatTimestampShort(),
    ),
  )

  const heroBlock = h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      flex: 1,
      justifyContent: 'flex-end',
      paddingBottom: 8,
    },
    h(
      'div',
      {
        fontSize: 12,
        fontFamily: FONT_INTER,
        fontWeight: 600,
        letterSpacing: 3,
        textTransform: 'uppercase',
        color: PALETTE.accent,
        marginBottom: 18,
        display: 'flex',
      },
      eyebrow,
    ),
    h(
      'div',
      {
        fontSize: 132,
        fontFamily: FONT_INTER,
        fontWeight: 700,
        letterSpacing: -4,
        color: PALETTE.text,
        lineHeight: 1,
        display: 'flex',
      },
      heroValue,
    ),
    h(
      'div',
      {
        fontSize: 22,
        fontFamily: FONT_INTER,
        fontWeight: 500,
        color: PALETTE.secondary,
        marginTop: 18,
        lineHeight: 1.3,
        letterSpacing: -0.3,
        maxWidth: CANVAS.width - SIDE_PADDING * 2,
        display: 'flex',
      },
      heroCaption,
    ),
    context
      ? h(
          'div',
          {
            fontSize: 14,
            fontFamily: FONT_MONO,
            fontWeight: 500,
            color: PALETTE.muted,
            marginTop: 8,
            letterSpacing: 0.4,
            display: 'flex',
          },
          context,
        )
      : false,
  )

  const heroRegion = h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: HERO_HEIGHT,
      paddingLeft: SIDE_PADDING,
      paddingRight: SIDE_PADDING,
      paddingTop: 48,
      paddingBottom: 28,
    },
    topBar,
    heroBlock,
  )

  const chartRegion = h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: CHART_HEIGHT,
      paddingLeft: SIDE_PADDING,
      paddingRight: SIDE_PADDING,
      paddingTop: 12,
      paddingBottom: 36,
      borderTop: `1px solid ${PALETTE.border}`,
      backgroundColor: PALETTE.bgSoft,
    },
    h(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        flex: 1,
      },
      chart,
    ),
    h(
      'div',
      {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginTop: 18,
        paddingTop: 14,
        borderTop: `1px solid ${PALETTE.border}`,
      },
      h(
        'div',
        {
          fontSize: 12,
          fontFamily: FONT_MONO,
          fontWeight: 500,
          color: PALETTE.muted,
          letterSpacing: 0.4,
          display: 'flex',
        },
        source,
      ),
    ),
  )

  return h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      width: CANVAS.width,
      height: CANVAS.height,
      backgroundColor: PALETTE.bg,
      backgroundImage: 'radial-gradient(circle at 84% -8%, rgba(122,162,255,0.22), transparent 52%), radial-gradient(circle at 0% 110%, rgba(45,90,180,0.12), transparent 60%)',
      fontFamily: FONT_INTER,
      color: PALETTE.text,
    },
    heroRegion,
    chartRegion,
  )
}

export type TopVolumeInput = {
  rows: Array<{ name: string; volume: number; subtitle?: string }>
  totalVolume: number
}

export function buildTopVolumeTree(input: TopVolumeInput): SatoriNode {
  const visible = input.rows.slice(0, 6)
  const max = visible.reduce((acc, r) => Math.max(acc, r.volume), 0) || 1
  const top = visible[0]
  const sum = input.rows.reduce((acc, r) => acc + r.volume, 0)
  const share = input.totalVolume > 0 ? (sum / input.totalVolume) * 100 : 0

  const rows = visible.map((row, idx) => {
    const pct = Math.max(2, (row.volume / max) * 100)
    const isTop = idx === 0
    return h(
      'div',
      {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        height: 76,
        marginBottom: idx === visible.length - 1 ? 0 : 10,
        position: 'relative',
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.05)',
      },
      h('div', {
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${pct}%`,
        height: '100%',
        borderTopLeftRadius: 14,
        borderBottomLeftRadius: 14,
        borderTopRightRadius: pct >= 99 ? 14 : 4,
        borderBottomRightRadius: pct >= 99 ? 14 : 4,
        backgroundImage: isTop
          ? 'linear-gradient(90deg, rgba(122,162,255,0.95) 0%, rgba(92,140,255,0.85) 100%)'
          : 'linear-gradient(90deg, rgba(92,140,255,0.7) 0%, rgba(58,99,196,0.55) 100%)',
        display: 'flex',
      }),
      h(
        'div',
        {
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          paddingLeft: 22,
          paddingRight: 24,
          position: 'relative',
        },
        h(
          'div',
          {
            fontSize: 13,
            fontFamily: FONT_MONO,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.9)',
            letterSpacing: 0.5,
            marginRight: 18,
            width: 26,
            display: 'flex',
          },
          String(idx + 1).padStart(2, '0'),
        ),
        h(
          'div',
          {
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
          },
          h(
            'div',
            {
              fontSize: 22,
              fontFamily: FONT_INTER,
              fontWeight: 600,
              color: '#ffffff',
              letterSpacing: -0.3,
              lineHeight: 1.1,
              display: 'flex',
            },
            truncate(row.name, 30),
          ),
          row.subtitle
            ? h(
                'div',
                {
                  fontSize: 13,
                  fontFamily: FONT_INTER,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.65)',
                  marginTop: 4,
                  letterSpacing: 0.1,
                  display: 'flex',
                },
                truncate(row.subtitle, 28),
              )
            : false,
        ),
        h(
          'div',
          {
            fontSize: 26,
            fontFamily: FONT_MONO,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: -0.2,
            display: 'flex',
          },
          formatCompactUsd(row.volume),
        ),
      ),
    )
  })

  return buildShell({
    eyebrow: 'AlfaClub · top rooms by volume',
    heroValue: formatCompactUsd(top?.volume ?? 0),
    heroCaption: top
      ? `${truncate(top.name, 36)} leads all-time volume${top.subtitle ? ` · ${truncate(top.subtitle, 24)}` : ''}.`
      : 'No volume recorded yet.',
    context: `Top ${visible.length} = ${formatCompactUsd(sum)} · ${share.toFixed(1)}% of catalog`,
    chart: h(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        flex: 1,
        justifyContent: 'center',
      },
      ...rows,
    ),
    source: 'public.alfaclub_rooms_snapshot · order by volume desc',
  })
}

export type TierMixInput = {
  segments: Array<{ label: string; rooms: number }>
  totalRooms: number
}

export function buildTierMixTree(input: TierMixInput): SatoriNode {
  const sorted = [...input.segments].sort((a, b) => b.rooms - a.rooms)
  const top = sorted.slice(0, 6)
  const otherRooms = sorted.slice(6).reduce((acc, s) => acc + s.rooms, 0)
  const segments = otherRooms > 0 ? [...top, { label: 'other', rooms: otherRooms }] : top
  const total = segments.reduce((acc, s) => acc + s.rooms, 0) || input.totalRooms || 1
  const maxRooms = segments.reduce((acc, s) => Math.max(acc, s.rooms), 0) || 1
  const topSeg = sorted[0]

  const chartW = CANVAS.width - SIDE_PADDING * 2
  const chartInnerH = 440
  const labelAreaH = 110
  const colWidth = chartW / segments.length

  const columns = segments.map((seg, idx) => {
    const heightPct = Math.max(8, (seg.rooms / maxRooms) * 100)
    const sharePct = (seg.rooms / total) * 100
    const isTop = idx === 0
    const [type, tier] = String(seg.label).split('·').map((s) => s.trim())
    const barH = Math.round((chartInnerH * heightPct) / 100)
    return h(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        width: colWidth,
        height: chartInnerH + labelAreaH,
        alignItems: 'center',
        justifyContent: 'flex-end',
      },
      h(
        'div',
        {
          width: '70%',
          height: barH,
          backgroundImage: isTop
            ? 'linear-gradient(180deg, rgba(122,162,255,1) 0%, rgba(74,118,224,1) 100%)'
            : 'linear-gradient(180deg, rgba(92,140,255,0.78) 0%, rgba(34,70,143,0.65) 100%)',
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: 12,
        },
        h(
          'div',
          {
            fontSize: 14,
            fontFamily: FONT_MONO,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: 0.2,
            display: 'flex',
          },
          `${sharePct.toFixed(1)}%`,
        ),
      ),
      h(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: colWidth,
          height: labelAreaH,
          paddingTop: 20,
        },
        h(
          'div',
          {
            fontSize: 18,
            fontFamily: FONT_INTER,
            fontWeight: 600,
            color: PALETTE.text,
            letterSpacing: -0.2,
            marginBottom: 4,
            textAlign: 'center',
            display: 'flex',
          },
          truncate((type ?? seg.label).toLowerCase(), 14),
        ),
        h(
          'div',
          {
            fontSize: 13,
            fontFamily: FONT_INTER,
            fontWeight: 500,
            color: PALETTE.muted,
            letterSpacing: 0.2,
            marginBottom: 8,
            display: 'flex',
          },
          truncate((tier ?? '').toLowerCase(), 14),
        ),
        h(
          'div',
          {
            fontSize: 22,
            fontFamily: FONT_MONO,
            fontWeight: 700,
            color: PALETTE.text,
            letterSpacing: 0.2,
            display: 'flex',
          },
          formatInt(seg.rooms),
        ),
      ),
    )
  })

  return buildShell({
    eyebrow: 'AlfaClub · room mix',
    heroValue: formatInt(input.totalRooms),
    heroCaption: topSeg
      ? `rooms across ${sorted.length} segments — ${truncate(topSeg.label.toLowerCase(), 28)} leads with ${((topSeg.rooms / total) * 100).toFixed(1)}%.`
      : `rooms across ${sorted.length} segments.`,
    chart: h(
      'div',
      {
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        flex: 1,
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      },
      ...columns,
    ),
    source: 'public.alfaclub_rooms_snapshot · grouped by room_type, tier',
  })
}

export type PnlBucket = { bucketStart: number; bucketEnd: number; rooms: number }

export type PnlDistributionInput = {
  buckets: PnlBucket[]
  totalRooms: number
}

function monotoneCubicPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`
  const n = points.length
  const slopes: number[] = new Array(n - 1)
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x
    slopes[i] = dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx
  }
  const tangents: number[] = new Array(n)
  tangents[0] = slopes[0]
  tangents[n - 1] = slopes[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      tangents[i] = 0
    } else {
      tangents[i] = (slopes[i - 1] + slopes[i]) / 2
      const m = 3 * Math.min(Math.abs(slopes[i - 1]), Math.abs(slopes[i]))
      if (Math.abs(tangents[i]) > m) tangents[i] = Math.sign(tangents[i]) * m
    }
  }
  let d = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const dx = (p1.x - p0.x) / 3
    const c1x = p0.x + dx
    const c1y = p0.y + tangents[i] * dx
    const c2x = p1.x - dx
    const c2y = p1.y - tangents[i + 1] * dx
    d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`
  }
  return d
}

export function buildPnlDistributionTree(input: PnlDistributionInput): SatoriNode {
  const buckets = input.buckets.slice().sort((a, b) => a.bucketStart - b.bucketStart)
  const totalRooms = input.totalRooms || buckets.reduce((acc, b) => acc + b.rooms, 0) || 1
  const peak = buckets.reduce(
    (max, b) => (b.rooms > max.rooms ? b : max),
    buckets[0] ?? { bucketStart: 0, bucketEnd: 0, rooms: 0 },
  )
  const positiveRooms = buckets
    .filter((b) => b.bucketStart >= 0)
    .reduce((acc, b) => acc + b.rooms, 0)
  const positiveShare = (positiveRooms / totalRooms) * 100
  const peakShare = (peak.rooms / totalRooms) * 100

  const chartW = CANVAS.width - SIDE_PADDING * 2
  const chartH = 540
  const padX = 8
  const padTop = 24
  const padBottom = 36
  const innerW = chartW - padX * 2
  const innerH = chartH - padTop - padBottom

  const xMin = buckets[0]?.bucketStart ?? -100
  const xMax = buckets[buckets.length - 1]?.bucketEnd ?? 300
  const yMax = buckets.reduce((m, b) => Math.max(m, b.rooms), 0) || 1

  const points = buckets.map((b) => {
    const xMid = (b.bucketStart + b.bucketEnd) / 2
    const x = padX + ((xMid - xMin) / (xMax - xMin)) * innerW
    const y = padTop + innerH - (b.rooms / yMax) * innerH
    return { x, y, bucket: b }
  })

  const linePath = monotoneCubicPath(points)
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(2)},${(padTop + innerH).toFixed(
          2,
        )} L ${points[0].x.toFixed(2)},${(padTop + innerH).toFixed(2)} Z`
      : ''

  const gridYs = [0.25, 0.5, 0.75]
  const svgChildren: SatoriNode[] = []

  svgChildren.push({
    type: 'defs',
    props: {
      children: [
        {
          type: 'linearGradient',
          props: {
            id: 'pnlAreaFill',
            x1: '0',
            y1: '0',
            x2: '0',
            y2: '1',
            children: [
              { type: 'stop', props: { offset: '0%', 'stop-color': PALETTE.accent, 'stop-opacity': '0.55' } },
              { type: 'stop', props: { offset: '100%', 'stop-color': PALETTE.accent, 'stop-opacity': '0' } },
            ],
          },
        },
      ],
    },
  })

  for (const ratio of gridYs) {
    const y = padTop + innerH * ratio
    svgChildren.push({
      type: 'line',
      props: {
        x1: padX,
        y1: y,
        x2: padX + innerW,
        y2: y,
        stroke: PALETTE.border,
        'stroke-width': 1,
      },
    })
  }

  const zeroX = padX + ((0 - xMin) / (xMax - xMin)) * innerW
  if (zeroX >= padX && zeroX <= padX + innerW) {
    svgChildren.push({
      type: 'line',
      props: {
        x1: zeroX,
        y1: padTop,
        x2: zeroX,
        y2: padTop + innerH,
        stroke: PALETTE.borderStrong,
        'stroke-width': 1,
        'stroke-dasharray': '4 5',
      },
    })
  }

  if (areaPath) {
    svgChildren.push({
      type: 'path',
      props: {
        d: areaPath,
        fill: 'url(#pnlAreaFill)',
        stroke: 'none',
      },
    })
  }

  if (linePath) {
    svgChildren.push({
      type: 'path',
      props: {
        d: linePath,
        fill: 'none',
        stroke: PALETTE.accentRich,
        'stroke-width': 3.2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    })
  }

  const peakPoint = points.find((p) => p.bucket === peak)
  if (peakPoint) {
    svgChildren.push({
      type: 'line',
      props: {
        x1: peakPoint.x,
        y1: peakPoint.y - 4,
        x2: peakPoint.x,
        y2: padTop + innerH,
        stroke: 'rgba(255,255,255,0.18)',
        'stroke-width': 1,
      },
    })
    svgChildren.push({
      type: 'circle',
      props: {
        cx: peakPoint.x,
        cy: peakPoint.y,
        r: 9,
        fill: PALETTE.accent,
        stroke: PALETTE.bg,
        'stroke-width': 4,
      },
    })
  }

  const tickValues = [-100, 0, 100, 200, 300]
  const xAxisRow = h(
    'div',
    {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      paddingTop: 14,
      paddingLeft: padX,
      paddingRight: padX,
    },
    ...tickValues.map((v) =>
      h(
        'div',
        {
          fontSize: 13,
          fontFamily: FONT_MONO,
          fontWeight: 500,
          color: PALETTE.muted,
          letterSpacing: 0.4,
          display: 'flex',
        },
        `${v > 0 ? '+' : ''}${v}%`,
      ),
    ),
  )

  const peakBadge = h(
    'div',
    {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 14,
      paddingRight: 16,
      paddingTop: 8,
      paddingBottom: 8,
      borderRadius: 999,
      backgroundColor: PALETTE.accentSoft,
      border: `1px solid ${PALETTE.borderStrong}`,
      marginBottom: 16,
    },
    h('div', {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: PALETTE.accent,
      marginRight: 10,
      display: 'flex',
    }),
    h(
      'div',
      {
        fontSize: 13,
        fontFamily: FONT_INTER,
        fontWeight: 600,
        color: PALETTE.text,
        letterSpacing: 0.2,
        display: 'flex',
      },
      `peak ${formatInt(peak.rooms)} rooms · ${peak.bucketStart}% to ${peak.bucketEnd}%`,
    ),
  )

  return buildShell({
    eyebrow: 'AlfaClub · all-time PnL',
    heroValue: `${peakShare.toFixed(1)}%`,
    heroCaption: `of rooms cluster in the ${peak.bucketStart}% to ${peak.bucketEnd}% bucket. ${positiveShare.toFixed(1)}% of rooms are net positive overall.`,
    chart: h(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        flex: 1,
      },
      h(
        'div',
        {
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          width: '100%',
        },
        peakBadge,
      ),
      {
        type: 'svg',
        props: {
          width: chartW,
          height: chartH,
          viewBox: `0 0 ${chartW} ${chartH}`,
          children: svgChildren,
        },
      } as unknown as SatoriNode,
      xAxisRow,
    ),
    source: 'public.alfaclub_rooms_snapshot · width_bucket(pnlPercentageAllTime, -100, 300, 10)',
  })
}

export const CHART_CANVAS = CANVAS
