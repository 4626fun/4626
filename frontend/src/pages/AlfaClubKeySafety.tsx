import { Pencil } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { InfoHint } from '@/components/alfaclub/InfoHint'
import {
  KeySafetyAttackPanel,
  type AttackExitScenario,
  type InsiderWorstCase,
} from '@/components/alfaclub/KeySafetyAttackPanel'
import { KeyOwnershipSunburst, type SunburstHolder } from '@/components/alfaclub/KeyOwnershipSunburst'
import {
  KeySafetyRoomPicker,
  type KeySafetyRoomOption,
} from '@/components/alfaclub/KeySafetyRoomPicker'
import {
  keySafetyStatusMeta,
  type KeySafetyStatus,
} from '@/components/alfaclub/KeySafetyStatusHero'
import { TradingRoomCurvePreview } from '@/components/alfaclub/TradingRoomCurvePreview'
import { TooltipProvider } from '@/components/ui/Tooltip'
import {
  attackerKeysToPassVote,
  breakEvenPotUsdcAfterOthersExit,
  breakEvenPotUsdcForAttack,
  buyCostAfterFee,
  curveCost,
  curveDivisor,
  evaluateKeyDefense,
  raidProfit,
  raidProfitAfterOthersExit,
  sellProceedsAfterFee,
  tradeFeeFraction,
  type AlfaRoomTier,
  type AlfaRoomType,
  type KeyDefenseEvaluation,
} from '@/lib/alfaclub/keyDefense'
import { formatAlfaClubRoomLabel } from '@/lib/alfaclub/roomLabel'
import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import { cn } from '@/lib/shared/utils'

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  })
}

type SafetyStatus = KeySafetyStatus

export type AlfaClubKeySafetyPricingSummary = {
  currentUsdc: number
  buyUsdc: number
  sellUsdc: number
  reportedFundUsdc: number
  treasuryLabel: string
  treasuryUsdc: number
}

/** Everything the "Who controls this room" card needs, so a caller can render
 *  it in a different spot in the page than the rest of the key-safety analysis. */
export type AlfaClubKeySafetyOwnershipSummary = {
  keySupply: number
  ownerKeys: number
  ownerStakedKeys: number
  stakedSupply: number
  ownerLabel: string | null
  ownerWalletKeys: number
  dataSource: string | null
  othersHolders: SunburstHolder[]
  takeoverKeys: number
  onResetTakeover?: () => void
}

export type AlfaClubKeySafetySummary = {
  status: SafetyStatus
  label: string
  headline: string
  pricing?: AlfaClubKeySafetyPricingSummary
  ownership?: AlfaClubKeySafetyOwnershipSummary
} | null

type AlfaClubKeySafetyProps = {
  roomId?: string
  embedded?: boolean
  summaryOnly?: boolean
  /** Set false when the caller renders the "Who controls this room" card itself
   *  (via the `ownership` field on `onSummaryChange`) elsewhere on the page. */
  showOwnershipCard?: boolean
  onSummaryChange?: (summary: AlfaClubKeySafetySummary) => void
}

type KeySafetyRoomContext = KeySafetyRoomOption & {
  tokenId: string
  creatorAddress: string | null
  hostWalletKeys: number
  hostStakedKeys: number
  hostKeys: number
  hostSharePercent: number
  stakedSupply: number
  stakeRatioPercent: number | null
  distributionPotUsdc: number | null
  totalTreasuryUsdc: number | null
  debankTotalUsd: number | null
  hyperliquidAccountValueUsd: number | null
  attackModelPotUsdc?: number
  attackPotSource?: 'treasury' | 'distribution_fund' | 'fee_baseline'
  feeBaselinePotUsdc: number
  knownOtherHolders?: Array<{
    address: string
    label: string | null
    avatarUrl: string | null
    keys: number | null
  }>
  tier: AlfaRoomTier | null
  roomType: AlfaRoomType | null
  sources: {
    keySupply: 'onchain' | 'snapshot'
    hostWalletKeys: 'onchain' | 'snapshot'
    hostStakedKeys: 'onchain' | 'snapshot' | 'unavailable'
    stakedSupply: 'onchain' | 'unavailable'
  }
}

function roomDisplayLabel(room: {
  roomId: string
  roomName: string
  displayLabel?: string
  creatorHandle?: string | null
}): string {
  return (
    room.displayLabel ??
    formatAlfaClubRoomLabel({
      roomId: room.roomId,
      roomName: room.roomName,
      creatorHandle: room.creatorHandle,
    })
  )
}

function formatApiErrorMessage(raw: string): string {
  const normalized = raw.trim().toLowerCase()
  if (!normalized) return 'request_failed'
  if (normalized === 'not found' || normalized === 'room_not_found') {
    return 'Room not found — check the ID or try again after snapshot ingest catches up'
  }
  if (normalized.includes('privy') && normalized.includes('token')) {
    return 'unexpected auth error — this page does not require sign-in'
  }
  if (normalized.includes('authentication required')) return 'service temporarily unavailable'
  return raw
}

function parseInitialRoomId(): string {
  if (typeof window === 'undefined') return ''
  const fromUrl = new URLSearchParams(window.location.search).get('roomId')?.trim() ?? ''
  return /^\d+$/.test(fromUrl) ? fromUrl : ''
}

async function fetchKeySafetyRoomList(limit: number, signal: AbortSignal): Promise<KeySafetyRoomOption[]> {
  const res = await apiFetch(`${API_ENDPOINTS.alfaclub.keySafetyRoom}?limit=${limit}`, {
    method: 'GET',
    signal,
  })
  if (res.ok) {
    const payload = (await res.json()) as {
      success?: boolean
      data?: { rows?: KeySafetyRoomOption[] }
      error?: string
    }
    if (payload.success && Array.isArray(payload.data?.rows)) {
      return payload.data.rows
    }
    throw new Error(payload.error ?? 'room_list_payload_invalid')
  }

  const fallback = await apiFetch(`${API_ENDPOINTS.alfaclub.keySafetyClubRisk}?limit=${limit}`, {
    method: 'GET',
    signal,
  })
  if (!fallback.ok) {
    const payload = (await fallback.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? `room_list_failed_${fallback.status}`)
  }
  const payload = (await fallback.json()) as {
    success?: boolean
    data?: {
      rows?: Array<
        KeySafetyRoomOption & { supply?: number; volumeUsdc?: number; tier?: AlfaRoomTier | null }
      >
    }
    error?: string
  }
  if (!payload.success || !Array.isArray(payload.data?.rows)) {
    throw new Error(payload.error ?? 'room_list_payload_invalid')
  }
  return payload.data.rows.map((row) => ({
    roomId: row.roomId,
    roomName: row.roomName,
    displayLabel: row.displayLabel ?? roomDisplayLabel(row),
    creatorHandle: row.creatorHandle,
    tier: row.tier ?? 'club',
    keySupply: row.keySupply ?? row.supply ?? null,
    volumeUsdc: row.volumeUsdc ?? null,
  }))
}

function parseInitialTradingWallet(): string {
  if (typeof window === 'undefined') return ''
  const fromUrl = new URLSearchParams(window.location.search).get('tradingWallet')?.trim() ?? ''
  return /^0x[a-fA-F0-9]{40}$/.test(fromUrl) ? fromUrl : ''
}

async function fetchKeySafetyRoomContext(
  roomId: string,
  tradingWallet: string | undefined,
  signal: AbortSignal,
): Promise<KeySafetyRoomContext> {
  const query = new URLSearchParams({ roomId })
  if (tradingWallet) query.set('tradingWallet', tradingWallet)
  const primary = await apiFetch(`${API_ENDPOINTS.alfaclub.keySafetyRoom}?${query.toString()}`, {
    method: 'GET',
    signal,
  })
  const primaryPayload = (await primary.json().catch(() => null)) as {
    success?: boolean
    data?: { room?: KeySafetyRoomContext }
    error?: string
  } | null
  if (primary.ok && primaryPayload?.success && primaryPayload.data?.room) {
    return primaryPayload.data.room
  }

  const fallback = await apiFetch(`${API_ENDPOINTS.alfaclub.keySafetyClubRisk}?${query.toString()}`, {
    method: 'GET',
    signal,
  })
  const fallbackPayload = (await fallback.json().catch(() => null)) as {
    success?: boolean
    data?: { room?: KeySafetyRoomContext }
    error?: string
  } | null
  if (fallback.ok && fallbackPayload?.success && fallbackPayload.data?.room) {
    return fallbackPayload.data.room
  }

  throw new Error(
    fallbackPayload?.error ?? primaryPayload?.error ?? `room_context_failed_${primary.status}`,
  )
}

function resolveSafetyStatus(evaluation: KeyDefenseEvaluation, potAtRiskUsdc: number): SafetyStatus {
  if (!evaluation.raid.raidUnprofitable) return 'at-risk'
  const nearThreshold =
    Number.isFinite(evaluation.maxSafePotUsdc) &&
    evaluation.maxSafePotUsdc > 0 &&
    potAtRiskUsdc / evaluation.maxSafePotUsdc >= 0.75
  return nearThreshold || !evaluation.hasVeto ? 'caution' : 'safe'
}

export function AlfaClubKeySafety({
  roomId,
  embedded = false,
  summaryOnly = false,
  showOwnershipCard = true,
  onSummaryChange,
}: AlfaClubKeySafetyProps = {}) {
  const [selectedRoomId, setSelectedRoomId] = useState(() => roomId ?? parseInitialRoomId())
  const [roomIdDraft, setRoomIdDraft] = useState(parseInitialRoomId)
  const [tradingWalletOverride] = useState(parseInitialTradingWallet)
  const [roomOptions, setRoomOptions] = useState<KeySafetyRoomOption[]>([])
  const [roomOptionsLoading, setRoomOptionsLoading] = useState(false)
  const [roomOptionsError, setRoomOptionsError] = useState<string | null>(null)
  const [roomContext, setRoomContext] = useState<KeySafetyRoomContext | null>(null)
  const [roomContextLoading, setRoomContextLoading] = useState(false)
  const [roomContextError, setRoomContextError] = useState<string | null>(null)
  const [donationUsdc, setDonationUsdc] = useState(0)
  const [roomSearch, setRoomSearch] = useState('')
  const [takeoverKeys, setTakeoverKeys] = useState(0)
  const [editingRoom, setEditingRoom] = useState(false)
  const [attackExitScenario, setAttackExitScenario] =
    useState<AttackExitScenario>('holders-stay')
  const resetTakeover = useCallback(() => setTakeoverKeys(0), [])

  const roomTier = roomContext?.tier ?? 'club'
  const roomType = roomContext?.roomType ?? 'trading'
  const keySupply = roomContext?.keySupply ?? 0
  const yourKeys = roomContext?.hostKeys ?? 0
  const sharePercent = roomContext?.hostSharePercent ?? 0
  const stakedSupply = roomContext?.stakedSupply ?? 0
  const modeledPotUsdc =
    roomContext?.attackModelPotUsdc ?? roomContext?.feeBaselinePotUsdc ?? 0
  const reportedTradingFundUsdc = roomContext?.distributionPotUsdc ?? modeledPotUsdc
  const treasuryNavUsdc =
    roomContext?.totalTreasuryUsdc ??
    (roomContext?.attackPotSource === 'treasury' ? modeledPotUsdc : null)
  const potAtRiskUsdc = Math.max(0, modeledPotUsdc + donationUsdc)
  const treasuryNavPerKeyUsdc = keySupply > 0 ? modeledPotUsdc / keySupply : 0

  // Live curve pricing for the next key at the current supply. "Current" is the
  // raw curve price; buy adds the trade fee, sell nets it out.
  const curvePricing = useMemo(() => {
    if (keySupply <= 0) return null
    const divisor = curveDivisor(roomType, roomTier)
    const fee = tradeFeeFraction(roomType)
    return {
      currentUsdc: curveCost(keySupply, 1, divisor),
      buyUsdc: buyCostAfterFee(keySupply, 1, divisor, fee),
      sellUsdc: sellProceedsAfterFee(keySupply, 1, divisor, fee),
    }
  }, [keySupply, roomTier, roomType])
  const selectedLabel = roomContext ? roomDisplayLabel(roomContext) : null
  const stakedPercent = keySupply > 0 ? Math.round((stakedSupply / keySupply) * 100) : 0
  const creatorHandle = (roomContext?.creatorHandle ?? '').trim().replace(/^@+/, '')
  const rawRoomName = (roomContext?.roomName ?? '').trim()
  const roomTitle =
    rawRoomName && !/^room\s*#?\s*\d+$/i.test(rawRoomName) && rawRoomName !== selectedRoomId
      ? rawRoomName
      : null
  const headerTitle = roomTitle ?? (selectedRoomId ? `Room #${selectedRoomId}` : 'Room')
  const showResults = Boolean(selectedRoomId && roomContext && !roomContextLoading)
  const dataSourceLabel = roomContext
    ? roomContext.sources.hostStakedKeys === 'onchain' &&
      roomContext.sources.stakedSupply === 'onchain'
      ? 'Live onchain reads'
      : roomContext.sources.hostStakedKeys === 'unavailable'
        ? 'Stake attribution loading or unavailable'
        : 'Mixed snapshot + onchain reads'
    : null

  const filteredRoomOptions = useMemo(() => {
    const q = roomSearch.trim().toLowerCase()
    if (!q) return roomOptions
    return roomOptions.filter((room) => {
      const label = roomDisplayLabel(room).toLowerCase()
      return label.includes(q) || room.roomId.includes(q)
    })
  }, [roomOptions, roomSearch])

  const evaluation = useMemo(
    () =>
      keySupply > 0
        ? evaluateKeyDefense({
            roomType,
            roomTier,
            keySupply,
            yourKeys,
            potUsdc: modeledPotUsdc,
            donationUsdc,
            targetRecoveryFraction: 0.5,
          })
        : null,
    [roomType, roomTier, keySupply, yourKeys, modeledPotUsdc, donationUsdc],
  )

  const minAttackBreakdown = useMemo(() => {
    if (!evaluation) return null
    const minAttackKeys = evaluation.raid.minAttackKeys
    if (minAttackKeys <= 0) return null
    const scenarioInputs = {
      roomType,
      roomTier,
      keySupply,
      yourKeys,
    } as const
    const point =
      attackExitScenario === 'holders-exit'
        ? raidProfitAfterOthersExit({ ...scenarioInputs, potUsdc: potAtRiskUsdc }, minAttackKeys)
        : raidProfit({ ...scenarioInputs, potUsdc: potAtRiskUsdc }, minAttackKeys)
    const eligibleAfterAttack =
      attackExitScenario === 'holders-exit' ? minAttackKeys : keySupply + minAttackKeys
    const breakEvenPotUsdc =
      attackExitScenario === 'holders-exit'
        ? breakEvenPotUsdcAfterOthersExit(scenarioInputs, minAttackKeys)
        : breakEvenPotUsdcForAttack(scenarioInputs, minAttackKeys)
    return {
      minAttackKeys,
      minAttackKeysCostUsdc: evaluation.raid.minAttackKeysCostUsdc,
      poolFeeAddedUsdc: point.poolFeeAddedUsdc,
      potSizeUsdc: point.potSizeUsdc,
      distributedPerKeyUsdc: point.distributedPerKeyUsdc,
      marginalBuyCostPerKeyUsdc: point.marginalBuyCostPerKeyUsdc,
      netDistributableUsdc: point.distributedPerKeyUsdc * eligibleAfterAttack,
      attackerNetUsdc: point.profitUsdc,
      breakEvenPotUsdc,
      fundGrowthToBreakEvenUsdc: Math.max(0, breakEvenPotUsdc - potAtRiskUsdc),
    }
  }, [attackExitScenario, evaluation, keySupply, potAtRiskUsdc, roomTier, roomType, yourKeys])

  const selectedRaidCurve = useMemo(() => {
    if (!evaluation || attackExitScenario === 'holders-stay') return evaluation?.raid.curve
    return evaluation.raid.curve.map((point) =>
      raidProfitAfterOthersExit(
        {
          roomType,
          roomTier,
          keySupply,
          yourKeys,
          potUsdc: potAtRiskUsdc,
        },
        point.keysBought,
      ),
    )
  }, [attackExitScenario, evaluation, keySupply, potAtRiskUsdc, roomTier, roomType, yourKeys])

  const safetyStatus = evaluation ? resolveSafetyStatus(evaluation, potAtRiskUsdc) : 'caution'
  const recoveryPercent = evaluation ? Math.round(evaluation.recovery.donationRecoveryFraction * 100) : 0

  // The largest non-owner holder we know about. The owner/creator is assumed
  // aligned with the room, so the real concentration risk is the biggest *other*
  // holder turning hostile.
  const biggestOtherHolder = useMemo<{ label: string; keys: number } | null>(() => {
    const holders = roomContext?.knownOtherHolders ?? []
    let best: { label: string; keys: number } | null = null
    for (const holder of holders) {
      const keys = holder.keys ?? 0
      if (keys <= 0) continue
      if (!best || keys > best.keys) {
        const label =
          holder.label?.trim() || `${holder.address.slice(0, 6)}…${holder.address.slice(-4)}`
        best = { label, keys }
      }
    }
    return best
  }, [roomContext])

  // Worst case: the biggest holder that is NOT the owner turns hostile. Because
  // every key already held lowers the buy requirement, this concentrated holder
  // is the cheapest realistic attacker — a risk even when an outside takeover
  // looks expensive. Requires real holder data; we never fall back to the owner.
  const insiderWorstCase = useMemo<InsiderWorstCase | null>(() => {
    if (!roomContext || keySupply <= 0 || !biggestOtherHolder) return null
    const holderKeys = Math.min(biggestOtherHolder.keys, keySupply)
    const keysToBuy = attackerKeysToPassVote(keySupply, holderKeys)
    const divisor = curveDivisor(roomType, roomTier)
    const fee = tradeFeeFraction(roomType)
    const costUsdc = buyCostAfterFee(keySupply, keysToBuy, divisor, fee)
    const point = raidProfit(
      {
        roomType,
        roomTier,
        keySupply,
        yourKeys: holderKeys,
        potUsdc: potAtRiskUsdc,
        attackerExistingKeys: holderKeys,
      },
      Math.max(1, keysToBuy),
    )
    return {
      holderLabel: biggestOtherHolder.label,
      holderKeys,
      holderSharePercent: Math.round((holderKeys / keySupply) * 100),
      alreadyControls: keysToBuy <= 0,
      keysToBuy,
      costUsdc,
      profitUsdc: point.profitUsdc,
    }
  }, [roomContext, keySupply, roomTier, roomType, potAtRiskUsdc, biggestOtherHolder])

  const loadRoomById = useCallback((roomId: string) => {
    const normalized = roomId.trim()
    if (!/^\d+$/.test(normalized)) return
    setSelectedRoomId(normalized)
    setRoomIdDraft(normalized)
    setTakeoverKeys(0)
    setEditingRoom(false)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('roomId', normalized)
      if (tradingWalletOverride) {
        url.searchParams.set('tradingWallet', tradingWalletOverride)
      } else {
        url.searchParams.delete('tradingWallet')
      }
      window.history.replaceState(null, '', url.toString())
    }
  }, [tradingWalletOverride])

  useEffect(() => {
    if (embedded) return
    const controller = new AbortController()
    setRoomOptionsLoading(true)
    setRoomOptionsError(null)
    void (async () => {
      try {
        const rows = await fetchKeySafetyRoomList(60, controller.signal)
        setRoomOptions(rows)
      } catch (error) {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : 'room_list_failed'
        setRoomOptionsError(formatApiErrorMessage(message))
        setRoomOptions([])
      } finally {
        if (!controller.signal.aborted) setRoomOptionsLoading(false)
      }
    })()
    return () => controller.abort()
  }, [embedded])

  useEffect(() => {
    if (!selectedRoomId) {
      setRoomContext(null)
      setRoomContextError(null)
      return
    }
    const controller = new AbortController()
    setRoomContextLoading(true)
    setRoomContextError(null)
    void (async () => {
      try {
        const room = await fetchKeySafetyRoomContext(
          selectedRoomId,
          tradingWalletOverride || undefined,
          controller.signal,
        )
        setRoomContext(room)
      } catch (error) {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : 'room_context_failed'
        setRoomContextError(formatApiErrorMessage(message))
        setRoomContext(null)
      } finally {
        if (!controller.signal.aborted) setRoomContextLoading(false)
      }
    })()
    return () => controller.abort()
  }, [selectedRoomId, tradingWalletOverride])

  const statusMeta = showResults && roomContext ? keySafetyStatusMeta(safetyStatus) : null
  const StatusIcon = statusMeta?.icon ?? null
  const statusLabel = statusMeta?.label ?? null
  const statusHeadline = statusMeta?.headline ?? null

  useEffect(() => {
    onSummaryChange?.(
      statusLabel && statusHeadline
        ? {
            status: safetyStatus,
            label: statusLabel,
            headline: statusHeadline,
            pricing: curvePricing
              ? {
                  currentUsdc: curvePricing.currentUsdc,
                  buyUsdc: curvePricing.buyUsdc,
                  sellUsdc: curvePricing.sellUsdc,
                  reportedFundUsdc: reportedTradingFundUsdc,
                  treasuryLabel: treasuryNavUsdc !== null ? 'Treasury NAV' : 'Payout pot',
                  treasuryUsdc: modeledPotUsdc,
                }
              : undefined,
            ownership: roomContext
              ? {
                  keySupply,
                  ownerKeys: yourKeys,
                  ownerStakedKeys: roomContext.hostStakedKeys,
                  stakedSupply,
                  ownerLabel: roomContext.creatorHandle ?? null,
                  ownerWalletKeys: roomContext.hostWalletKeys,
                  dataSource: dataSourceLabel,
                  othersHolders: roomContext.knownOtherHolders ?? [],
                  takeoverKeys,
                  onResetTakeover: takeoverKeys > 0 ? resetTakeover : undefined,
                }
              : undefined,
          }
        : null,
    )
  }, [
    curvePricing,
    dataSourceLabel,
    keySupply,
    modeledPotUsdc,
    onSummaryChange,
    reportedTradingFundUsdc,
    resetTakeover,
    roomContext,
    safetyStatus,
    stakedSupply,
    statusHeadline,
    statusLabel,
    takeoverKeys,
    treasuryNavUsdc,
    yourKeys,
  ])

  if (embedded && summaryOnly) return null

  return (
    <div className={cn('relative', !embedded && 'pb-24 md:pb-0')}>
      <section className={cn(!embedded && 'cinematic-section')}>
        <TooltipProvider>
          <div
            className={cn(
              'mx-auto space-y-5',
              embedded ? 'max-w-5xl' : 'max-w-3xl px-4 sm:px-6',
            )}
          >
            {!embedded && showResults && roomContext && statusMeta && StatusIcon ? (
              <header
                className={cn(
                  'rounded-3xl p-5 transition-colors',
                  'bg-[radial-gradient(120%_140%_at_0%_0%,var(--tw-gradient-from),transparent)]',
                  statusMeta.glow,
                )}
                role="status"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-inset',
                          statusMeta.badge,
                        )}
                      >
                        <StatusIcon className={cn('h-3.5 w-3.5', statusMeta.iconClass)} aria-hidden />
                        {statusMeta.label}
                      </span>
                      <span className="font-mono text-xs text-sky-200/80">#{selectedRoomId}</span>
                      <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-600">
                        AlfaClub
                      </span>
                    </div>
                    <h1 className="headline mt-2 truncate text-2xl tracking-tight sm:text-3xl">
                      {headerTitle}
                    </h1>
                    {creatorHandle ? (
                      <p className="mt-0.5 text-sm text-zinc-400">by @{creatorHandle}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingRoom((open) => !open)}
                    aria-expanded={editingRoom}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.08]"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    {editingRoom ? 'Close' : 'Change room'}
                  </button>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-zinc-300">{statusMeta.headline}</p>

                <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {(
                    [
                      { label: 'Total keys', value: keySupply.toLocaleString(), hint: null },
                      { label: 'Staked', value: `${stakedPercent}%`, hint: null },
                      { label: 'Owner share', value: `${sharePercent}%`, hint: null },
                      {
                        label: 'Reported fund',
                        value: formatUsd(reportedTradingFundUsdc),
                        hint: (
                          <p>
                            AlfaClub&apos;s reported trading-fund size from the latest room
                            snapshot.
                          </p>
                        ),
                      },
                      {
                        label: 'Payout NAV',
                        value: formatUsd(modeledPotUsdc),
                        hint: (
                          <p>
                            Current assets available to model a payout. Live treasury NAV combines
                            DeBank and Hyperliquid when both are available.
                          </p>
                        ),
                      },
                      {
                        label: 'NAV / key',
                        value: formatUsd(treasuryNavPerKeyUsdc),
                        hint: (
                          <p>
                            The payout NAV ({formatUsd(modeledPotUsdc)}) divided by all{' '}
                            {keySupply.toLocaleString()} current keys, before performance fees and
                            the 10% reserve.
                          </p>
                        ),
                      },
                    ] as const
                  ).map((stat) => (
                    <div key={stat.label} className="rounded-xl bg-black/30 px-3 py-2">
                      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
                        {stat.label}
                        {stat.hint ? <InfoHint label={`About ${stat.label}`} content={stat.hint} /> : null}
                      </dt>
                      <dd className="mt-0.5 font-mono text-base text-zinc-100 tabular-nums">
                        {stat.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </header>
            ) : null}

            {!embedded && !showResults ? (
              <div className="rounded-3xl bg-[radial-gradient(120%_140%_at_0%_0%,rgba(56,189,248,0.14),rgba(0,0,0,0))] p-6 ring-1 ring-inset ring-white/[0.04]">
                <span className="label">AlfaClub</span>
                <h1 className="headline mt-3 text-3xl tracking-tight sm:text-4xl">
                  How exposed is your room right now?
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                  Enter your room ID, review live keys and stake, then stress-test a hostile buyer
                  against the 66% distribute-vote threshold.
                </p>
              </div>
            ) : null}

            {!embedded && (!showResults || editingRoom) ? (
            <KeySafetyRoomPicker
              roomIdDraft={roomIdDraft}
              onRoomIdDraftChange={setRoomIdDraft}
              onAnalyze={() => loadRoomById(roomIdDraft)}
              selectedRoomId={selectedRoomId}
              roomSearch={roomSearch}
              onRoomSearchChange={setRoomSearch}
              filteredRoomOptions={filteredRoomOptions}
              onSelectRoom={loadRoomById}
              alwaysShowForm={showResults}
              roomOptionsLoading={roomOptionsLoading}
              roomOptionsError={roomOptionsError}
              roomContextLoading={roomContextLoading}
              roomContextError={roomContextError}
              loadedRoomLabel={selectedLabel}
            />
            ) : null}

            {showResults && selectedLabel && roomContext ? (
              <>
                {showOwnershipCard ? (
                  <div className="rounded-3xl bg-black/35 p-5 ring-1 ring-white/[0.04]">
                    <KeyOwnershipSunburst
                      keySupply={keySupply}
                      ownerKeys={yourKeys}
                      ownerStakedKeys={roomContext.hostStakedKeys}
                      stakedSupply={stakedSupply}
                      ownerLabel={roomContext.creatorHandle ?? null}
                      ownerWalletKeys={roomContext.hostWalletKeys}
                      dataSource={dataSourceLabel}
                      othersHolders={roomContext.knownOtherHolders}
                      takeoverKeys={takeoverKeys}
                      onResetTakeover={takeoverKeys > 0 ? resetTakeover : undefined}
                    />
                  </div>
                ) : null}

                <div className="rounded-3xl bg-black/35 p-5 ring-1 ring-white/[0.04]">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Bonding curve · simulate a buyer
                    </p>
                    <InfoHint
                      label="About the bonding curve"
                      content={
                        <p>
                          Each key costs more than the last (price ∝ key number²). Buying many keys
                          to attack gets expensive fast, which is what protects the room. Drag the
                          marker right to simulate a hostile buyer — the control bar above updates
                          live.
                        </p>
                      }
                    />
                  </div>
                  <p className="mt-0.5 text-sm text-zinc-300">
                    Cost to acquire keys at current tier — drag to test a takeover
                  </p>
                  {minAttackBreakdown ? (
                    <dl className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-yellow-500/[0.06] px-3 py-2 ring-1 ring-inset ring-yellow-400/15">
                        <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-yellow-200/70">
                          66% payout / key
                          <InfoHint
                            label="About payout per key at 66% control"
                            content={
                              <p>
                                Net amount paid per eligible staked key after performance fees and
                                the 10% trading reserve, using the pot after the hostile buyer&apos;s
                                key-buy fees are added.
                              </p>
                            }
                          />
                        </dt>
                        <dd className="mt-0.5 font-mono text-sm text-yellow-100 tabular-nums">
                          {formatUsd(minAttackBreakdown.distributedPerKeyUsdc)}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-yellow-500/[0.06] px-3 py-2 ring-1 ring-inset ring-yellow-400/15">
                        <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-yellow-200/70">
                          66% final key price
                          <InfoHint
                            label="About the final key price at 66% control"
                            content={
                              <p>
                                Fee-inclusive bonding-curve price of the last key the outside buyer
                                must acquire to reach the 66% control threshold.
                              </p>
                            }
                          />
                        </dt>
                        <dd className="mt-0.5 font-mono text-sm text-yellow-100 tabular-nums">
                          {formatUsd(minAttackBreakdown.marginalBuyCostPerKeyUsdc)}
                        </dd>
                      </div>
                    </dl>
                  ) : null}
                  <div className="mt-3">
                    <TradingRoomCurvePreview
                      selectedTier={roomTier}
                      activeKeyIndex={keySupply + takeoverKeys}
                      attackBaseKeyIndex={keySupply}
                      onActiveKeyChange={(nextKeyIndex) =>
                        setTakeoverKeys(Math.max(0, nextKeyIndex - keySupply))
                      }
                      fullRange
                      raidCurve={selectedRaidCurve}
                      progressiveStage={4}
                      ownerSharePercent={sharePercent}
                      maxKeys={Math.max(140, keySupply + 30)}
                      heightClassName="h-[22rem] sm:h-[28rem]"
                      withFrame={false}
                    />
                  </div>
                </div>

                <KeySafetyAttackPanel
                  safetyStatus={safetyStatus}
                  evaluation={evaluation}
                  minAttackBreakdown={minAttackBreakdown}
                  insiderWorstCase={insiderWorstCase}
                  modeledPotUsdc={modeledPotUsdc}
                  reportedTradingFundUsdc={reportedTradingFundUsdc}
                  attackPotSource={roomContext.attackPotSource}
                  potAtRiskUsdc={potAtRiskUsdc}
                  donationUsdc={donationUsdc}
                  onDonationChange={setDonationUsdc}
                  exitScenario={attackExitScenario}
                  onExitScenarioChange={setAttackExitScenario}
                  recoveryPercent={recoveryPercent}
                  formatUsd={formatUsd}
                />
              </>
            ) : selectedRoomId && roomContextLoading ? (
              <div className="rounded-3xl bg-black/35 p-8 text-center ring-1 ring-white/[0.04]">
                <p className="text-sm text-zinc-400">Resolving live keys, stake, and trading fund…</p>
              </div>
            ) : embedded && roomContextError ? (
              <div className="rounded-3xl bg-amber-500/[0.06] p-6 ring-1 ring-amber-400/20" role="alert">
                <h2 className="text-sm font-semibold text-amber-100">Safety analysis unavailable</h2>
                <p className="mt-2 text-sm text-amber-200/75">{roomContextError}</p>
              </div>
            ) : null}
          </div>
        </TooltipProvider>
      </section>
    </div>
  )
}
