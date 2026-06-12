/**
 * Harvest accounting for the counter-trade exit mirror.
 *
 * Every user round trip forces a bot round trip, so chop converts into
 * realized PnL transfers between the two wallets. This module makes that
 * channel observable: per-close "banked" amounts pulled from the bot
 * wallet's own Hyperliquid fills, and window summaries (realized PnL, fees,
 * gross volume, round-trip counts) for any wallet. Hyperliquid fills are the
 * source of truth (`closedPnl` / `fee` per fill) — no local schema is needed.
 */
import { getUserFillsByTimeDetailed, type HyperliquidUserFillDetailed } from './hyperliquid.js'
import { classifyCounterTradeFillAction } from './counterTradeEngine.js'

const PNL_EPSILON = 1e-9
/** Tolerance for clock skew / submission latency when matching close fills. */
const CLOSE_MATCH_BUFFER_MS = 30_000
const DEFAULT_BANKED_POLL_ATTEMPTS = 3
const DEFAULT_BANKED_POLL_DELAY_MS = 1_500

export type HarvestWalletSummary = {
  walletAddress: string
  fillCount: number
  grossVolumeUsd: number
  realizedPnlUsd: number
  feesUsd: number
  netRealizedUsd: number
  closingFillCount: number
  winningCloses: number
  losingCloses: number
}

export type BankedCloseSummary = {
  realizedPnlUsd: number
  feesUsd: number
  netRealizedUsd: number
  fillCount: number
}

function fillNotionalUsd(fill: HyperliquidUserFillDetailed): number {
  if (fill.px == null || fill.sz == null) return 0
  const notional = Math.abs(fill.px * fill.sz)
  return Number.isFinite(notional) ? notional : 0
}

function isClosingFill(fill: HyperliquidUserFillDetailed): boolean {
  if (Math.abs(fill.closedPnl) > PNL_EPSILON) return true
  const action = classifyCounterTradeFillAction(fill)
  return action === 'close' || action === 'reduce' || action === 'liquidated'
}

/**
 * Pure aggregation over a wallet's fills: gross volume, realized PnL, fees,
 * and round-trip (closing-fill) win/loss counts.
 */
export function summarizeHarvestFills(params: {
  walletAddress: string
  fills: HyperliquidUserFillDetailed[] | null | undefined
}): HarvestWalletSummary {
  let grossVolumeUsd = 0
  let realizedPnlUsd = 0
  let feesUsd = 0
  let closingFillCount = 0
  let winningCloses = 0
  let losingCloses = 0
  const fills = params.fills ?? []

  for (const fill of fills) {
    grossVolumeUsd += fillNotionalUsd(fill)
    realizedPnlUsd += Number.isFinite(fill.closedPnl) ? fill.closedPnl : 0
    feesUsd += Number.isFinite(fill.fee) ? fill.fee : 0
    if (isClosingFill(fill)) {
      closingFillCount += 1
      if (fill.closedPnl > PNL_EPSILON) winningCloses += 1
      else if (fill.closedPnl < -PNL_EPSILON) losingCloses += 1
    }
  }

  return {
    walletAddress: params.walletAddress,
    fillCount: fills.length,
    grossVolumeUsd,
    realizedPnlUsd,
    feesUsd,
    netRealizedUsd: realizedPnlUsd - feesUsd,
    closingFillCount,
    winningCloses,
    losingCloses,
  }
}

/**
 * Pure matcher: pick the bot's close fills for one mirrored exit out of a
 * fills list (same coin, at/after close submission, realized PnL attached).
 */
export function summarizeBankedCloseFills(params: {
  fills: HyperliquidUserFillDetailed[] | null | undefined
  coin: string
  closeSubmittedAtMs: number
}): BankedCloseSummary | null {
  const target = params.coin.trim().toUpperCase()
  if (!target) return null
  const earliestMs = params.closeSubmittedAtMs - CLOSE_MATCH_BUFFER_MS

  let realizedPnlUsd = 0
  let feesUsd = 0
  let fillCount = 0
  for (const fill of params.fills ?? []) {
    if (String(fill.coin ?? '').trim().toUpperCase() !== target) continue
    if (fill.time < earliestMs) continue
    if (Math.abs(fill.closedPnl) <= PNL_EPSILON && !isClosingFill(fill)) continue
    realizedPnlUsd += fill.closedPnl
    feesUsd += Number.isFinite(fill.fee) ? fill.fee : 0
    fillCount += 1
  }

  if (fillCount === 0) return null
  return { realizedPnlUsd, feesUsd, netRealizedUsd: realizedPnlUsd - feesUsd, fillCount }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Best-effort lookup of what the bot just banked on a mirrored close.
 * Polls the bot wallet's fills briefly (the fill usually lands within a
 * second or two of the close order); returns null when nothing matched so
 * callers can post the exit card without a banked line.
 */
export async function resolveBotBankedPnlForClose(params: {
  botWalletAddress: string
  coin: string
  closeSubmittedAtMs: number
  attempts?: number
  pollDelayMs?: number
}): Promise<BankedCloseSummary | null> {
  const attempts = Math.max(1, params.attempts ?? DEFAULT_BANKED_POLL_ATTEMPTS)
  const pollDelayMs = Math.max(0, params.pollDelayMs ?? DEFAULT_BANKED_POLL_DELAY_MS)
  const sinceMs = params.closeSubmittedAtMs - CLOSE_MATCH_BUFFER_MS

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0 && pollDelayMs > 0) await sleep(pollDelayMs)
    const fills = await getUserFillsByTimeDetailed(params.botWalletAddress, sinceMs)
    const summary = summarizeBankedCloseFills({
      fills,
      coin: params.coin,
      closeSubmittedAtMs: params.closeSubmittedAtMs,
    })
    if (summary) return summary
  }
  return null
}

export function formatSignedUsd(value: number): string {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(value).toFixed(2)}`
}
