/**
 * Room 1659 Market Context for Hermit — FULLY SET UP
 *
 * This is the complete, automatic integration for giving Hermit4626
 * real-time market awareness **only in AlfaClub room 1659**.
 *
 * When anyone runs /hermit, /meme, or /gmeow in room 1659, this context
 * is automatically resolved and injected into the prompt.
 *
 * Includes:
 *   - Sophisticated multi-factor hype score (HL leverage + volatility + dexscreener heat + on-chain maturity)
 *   - Live liquidation price and full user position from Hyperliquid
 *   - Spot positions + PNL history from AlfaClub /api/spot
 *   - Full on-chain FriendKey bonding curve data using the EXACT quadratic formula
 *     from https://github.com/FriendDotSpace/contracts (BondingCurveLib.sol)
 *
 * Fully set up for room 1659:
 *   - Numeric tokenId = 1659 (confirmed)
 *   - FriendKey = 0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F (official from contracts repo)
 *   - Real sum-of-squares bonding curve prices for multiple depths (1/5/10/20/50 keys)
 *   - Correct USDC 6-decimal formatting + tier awareness
 *
 * The on-chain block fed to Hermit is deliberately rich for theatrical marketing copy.
 */

import { getClearinghouseState } from './hyperliquid.js'
import {
  ALFACLUB_API_COMMON_BROWSER_HEADERS,
  buildAlfaClubApiHeaders,
  readAlfaClubApiAuthFlags,
  resolveAlfaClubApiCallBaseUrl,
  resolveAlfaClubProxySecret,
} from './apiAuth.js'
import { computeLiquidationProximityPct, estimateMarkPrice } from './positionProximity.js'
import { createPublicClient, http, parseAbi, type Address } from 'viem'
import { base } from 'viem/chains'
import { ALFACLUB } from '../wallet/alfaclub.js'

/**
 * Exact port of BondingCurveLib.getPrice from the official FriendDotSpace/contracts repo.
 * https://github.com/FriendDotSpace/contracts/blob/main/src/libraries/BondingCurveLib.sol
 *
 * price = (sumOfSquares(supply + amount - 1) - sumOfSquares(supply - 1)) * priceUnit / divisor
 *
 * This is the real quadratic (sum-of-squares) bonding curve used on-chain for room 1659.
 * We implement it here so we can compute multi-depth prices efficiently and explain
 * the acceleration to Hermit for theatrical marketing copy.
 */
function sumOfSquaresUpTo(n: bigint): bigint {
  if (n <= 0n) return 0n
  // sum_{i=1 to n} i^2 = n*(n+1)*(2*n+1)/6
  const nn = n
  const np1 = n + 1n
  const twoNPlus1 = 2n * n + 1n
  return (nn * np1 * twoNPlus1) / 6n
}

export function friendKeyGetPrice(supply: bigint, amount: bigint, divisor: bigint, priceUnit: bigint): bigint {
  if (divisor === 0n) throw new Error('ZeroDivisor')

  // sum of squares from 0 to (supply-1)
  const sum1 = supply === 0n ? 0n : sumOfSquaresUpTo(supply - 1n)

  // sum of squares from 0 to (supply + amount - 1)
  const sum2 = (supply === 0n && amount === 1n)
    ? 0n
    : sumOfSquaresUpTo(supply + amount - 1n)

  const summation = sum2 - sum1
  return (summation * priceUnit) / divisor
}

// USDC on Base has 6 decimals for this bonding curve
const USDC_DECIMALS = 1_000_000n

const ROOM_1659_DEFAULT_HL_PORTFOLIO_USER = '0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2' as const
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

/**
 * Room 1659 uses a dedicated Hyperliquid portfolio identity for room-level market context.
 * Override via ROOM_1659_HYPERLIQUID_PORTFOLIO_USER when needed.
 */
export function resolveRoom1659HyperliquidPortfolioUser(): string {
  const configured = String(process.env.ROOM_1659_HYPERLIQUID_PORTFOLIO_USER ?? '').trim()
  if (EVM_ADDRESS_RE.test(configured)) return configured.toLowerCase()
  return ROOM_1659_DEFAULT_HL_PORTFOLIO_USER
}

/**
 * Room 1659 market context always tracks the dedicated room portfolio wallet.
 * Sender wallet is intentionally ignored for Hyperliquid account selection.
 */
export function resolveRoom1659HyperliquidUserForSnapshot(_senderAddress: string): string {
  return resolveRoom1659HyperliquidPortfolioUser()
}

/** Canonical FriendKey contract for room-key supply/pricing reads on Base. */
export function resolveRoom1659FriendKeyAddress(): Address {
  const configured = String(process.env.ROOM_1659_FRIENDKEY_TOKEN ?? '').trim()
  if (EVM_ADDRESS_RE.test(configured)) return configured as Address
  return ALFACLUB.friendKey
}

export function formatUsdc(raw: bigint | null | undefined): string {
  if (raw == null) return '?'
  const whole = Number(raw / USDC_DECIMALS)
  const frac = Number(raw % USDC_DECIMALS) / 1_000_000
  if (whole === 0) return frac.toFixed(4)
  return (whole + frac).toFixed(4)
}

export type Room1659MarketSnapshot = {
  hyperliquidUser: string
  hype: number | null          // e.g. 67
  liquidation: number | null   // e.g. 69
  userPosition?: {
    side: 'long' | 'short' | null
    sizeUsd: number | null
    entryPrice: number | null
    unrealizedPnlUsd: number | null
    liquidationPrice: number | null
  } | null
  roomTotalOpenInterestUsd?: number | null

  // On-chain FriendKey data for room 1659 (real quadratic curve from BondingCurveLib)
  onchain?: {
    tokenId: Address
    roomTokenId: string
    tier?: 'Casual' | 'Club' | 'Exclusive' | 'Unknown'
    totalSupply: bigint | null
    userBalance: bigint | null

    // Marginal / depth prices (pre-fee, in USDC smallest units)
    marginalBuy1: bigint | null     // cost of the very next key
    marginalSell1: bigint | null
    buy5: bigint | null             // cost to buy next 5 keys (great for scarcity theater)
    buy10: bigint | null
    buy20: bigint | null
    buy50: bigint | null

    note?: string
  } | null

  fetchedAt: string
  ok: boolean
  errorReason?: string | null
}

type Room1659HlLeg = {
  side?: 'long' | 'short' | null
  entryPx?: number | null
  positionValue?: number | null
  unrealizedPnl?: number | null
  liquidationPx?: number | null
}

function legLiqDistance(leg: Room1659HlLeg): number | null {
  if (
    !leg.side ||
    leg.entryPx == null ||
    leg.positionValue == null ||
    leg.unrealizedPnl == null ||
    leg.liquidationPx == null
  ) {
    return null
  }
  const mark = estimateMarkPrice({
    entryPx: leg.entryPx,
    positionValueUsd: leg.positionValue,
    unrealizedPnlUsd: leg.unrealizedPnl,
    side: leg.side,
  })
  if (mark == null) return null
  return computeLiquidationProximityPct({
    markPrice: mark,
    liquidationPrice: leg.liquidationPx,
    side: leg.side,
  })
}

function pickPrimaryHyperliquidLeg(hlState: any): Room1659HlLeg | null {
  const legs = Array.isArray(hlState?.assetPositions) ? (hlState.assetPositions as Room1659HlLeg[]) : []
  if (legs.length === 0) return null
  const ranked = legs
    .map((leg) => ({
      leg,
      liqDist: legLiqDistance(leg),
      pnlAbs: Math.abs(leg.unrealizedPnl ?? 0),
      notional: leg.positionValue ?? 0,
    }))
    .sort((a, b) => {
      const aRisk = a.liqDist ?? Number.POSITIVE_INFINITY
      const bRisk = b.liqDist ?? Number.POSITIVE_INFINITY
      if (aRisk !== bRisk) return aRisk - bRisk
      if (a.pnlAbs !== b.pnlAbs) return b.pnlAbs - a.pnlAbs
      if (a.notional !== b.notional) return b.notional - a.notional
      return 0
    })
  return ranked[0]?.leg ?? null
}

/**
 * Resolve current market state for room 1659 for a specific user.
 *
 * On-chain reads from Friend contracts (once we have the tokenId for room 1659):
 *
 * From FriendKey (the ERC1155):
 *   - totalSupply(tokenId)                    → current "float" / holder count proxy
 *   - balanceOf(senderAddress, tokenId)       → user's direct position size in the room
 *   - getBuyPrice(tokenId, 1) / getSellPrice  → current marginal price on the curve
 *   - creatorByTokenId(tokenId)               → the creator wallet for this room
 *   - roomTypes / roomTiers                   → confirm it's a Trading room + tier
 *
 * From FriendRoomManager (via FriendKey):
 *   - getDivisor(...)                         → the bonding curve steepness parameter
 *
 * Additional (recommended):
 *   - Recent Trade events (indexed)           → to compute short-term "hype" (buy pressure)
 *   - Bonding curve reserves (if exposed)     → depth / liquidity on the curve
 *
 * For "liquidation" risk:
 *   - Combine curve price action + user's Hyperliquid exposure (via existing hyperliquid.ts)
 */
export async function resolveRoom1659MarketContext(
  senderAddress: string
): Promise<Room1659MarketSnapshot> {
  const now = new Date().toISOString();
  const hyperliquidUser = resolveRoom1659HyperliquidUserForSnapshot(senderAddress)

  try {
    // === Real endpoints observed from AlfaClub client in room 1659 ===

    // 1. User's spot positions in room 1659 (direct from AlfaClub)
    let userSpotPositions = null;
    try {
      const positionsRes = await fetchAlfaClubSpot(`/api/spot/positions?roomId=1659`);
      userSpotPositions = positionsRes?.positions ?? positionsRes ?? null;
    } catch (e) {
      // fail open
    }

    // 2. PNL history for hype signals
    let pnlHistory = null;
    try {
      pnlHistory = await fetchAlfaClubSpot(`/api/spot/pnl-history?roomId=1659&period=7d`);
    } catch {}

    // 3. Spot token market data (dexscreener for the room's token 0x5b67... ) - great for price/volume as hype signal
    let dexData = null;
    try {
      dexData = await fetchAlfaClubSpot(
        `/api/spot/dexscreener/tokens?address=0x5b674196812451b7cec024fe9d22d2c0b172fa75`
      );
    } catch {}

    // 4. Hyperliquid data (rich version)
    const hlUserState = await getClearinghouseState(hyperliquidUser);

    // === On-chain FriendKey data for room 1659 (FULLY ENABLED) ===
    // Official contract from Alfa Club contract list (FriendKey):
    // ALFACLUB.friendKey
    // Numeric tokenId: 1659 (confirmed by you)
    const ROOM_1659_FRIENDKEY = resolveRoom1659FriendKeyAddress();
    let onchainData = null;
    try {
      onchainData = await fetchRoom1659OnchainData(ROOM_1659_FRIENDKEY, senderAddress as Address);
    } catch (e) {
      // fail open for on-chain
    }

    // Sophisticated hype: multi-factor (HL + spot + dexscreener + on-chain maturity)
    const hype = computeHypeFromHl(hlUserState, userSpotPositions, pnlHistory, dexData, onchainData);

    // Liquidation from the prioritized leg (risk-first, then pnl impact, then size)
    const primaryLeg = pickPrimaryHyperliquidLeg(hlUserState)
    const liquidation = primaryLeg?.liquidationPx ?? null;

    return {
      hyperliquidUser,
      hype,
      liquidation,
      userPosition: mapToPosition(userSpotPositions, hlUserState),
      roomTotalOpenInterestUsd: hlUserState?.totalNtlPosUsd ?? null,
      onchain: onchainData,
      fetchedAt: now,
      ok: true,
    };
  } catch (err: any) {
    return {
      hyperliquidUser,
      hype: null,
      liquidation: null,
      userPosition: null,
      fetchedAt: now,
      ok: false,
      errorReason: err?.message || 'fetch_failed',
    };
  }
}

// --- Helper stubs (to be implemented properly using existing AlfaClub patterns) ---

async function fetchAlfaClubSpot(path: string, init?: RequestInit) {
  const flags = readAlfaClubApiAuthFlags()
  const apiBaseUrl = resolveAlfaClubApiCallBaseUrl(flags)
  const fingerprintBaseUrl = flags.apiBaseUrl
  const proxySecret = resolveAlfaClubProxySecret(flags)
  const readBotToken = flags.readBotToken || flags.botToken
  const jwt = flags.jwt

  if (!jwt && !readBotToken) {
    throw new Error('no_alfaclub_auth_for_spot');
  }

  // Room-1659 market context is Hermit-adjacent, so prefer read-scoped bot
  // credentials over bridge runtime-secret state.
  const authHeaders = readBotToken
    ? {
        ...ALFACLUB_API_COMMON_BROWSER_HEADERS,
        Authorization: `Bearer ${readBotToken}`,
        ...(proxySecret ? { 'x-proxy-secret': proxySecret } : {}),
      }
    : jwt
    ? buildAlfaClubApiHeaders({
        jwt,
        fingerprintBaseUrl,
        proxySecret,
      })
    : {}

  const url = new URL(path, apiBaseUrl).toString();

  const res = await fetch(url, {
    ...init,
    headers: {
      'accept': 'application/json',
      'user-agent': 'Mozilla/5.0 (compatible; Hermit4626/1.0)',
      ...authHeaders,
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`alfaclub_spot_${res.status}:${text.slice(0, 300)}`);
  }

  return res.json();
}

// (Hyperliquid calls now go through the existing getClearinghouseState helper)

function mapToPosition(spotPositions: any, hlState: any): Room1659MarketSnapshot['userPosition'] {
  if (!hlState) return null;

  const firstPos = pickPrimaryHyperliquidLeg(hlState);
  if (!firstPos) return null;

  return {
    side: firstPos.side ?? null,
    sizeUsd: firstPos.positionValue ?? null,
    entryPrice: firstPos.entryPx ?? null,
    unrealizedPnlUsd: firstPos.unrealizedPnl ?? null,
    liquidationPrice: firstPos.liquidationPx ?? null,
  };
}

function computeHypeFromHl(hlState: any, spotPositions: any, pnlHistory?: any, dexData?: any, onchain?: any): number | null {
  if (!hlState) return null;

  const notional = hlState.totalNtlPosUsd ?? 0;
  const accountValue = hlState.accountValueUsd ?? 1;

  // === Sophisticated multi-factor hype formula for room 1659 ===
  // Weighted components (tunable):
  // - 35% Leverage/conviction (HL notional vs equity) — high leverage = degen hype
  // - 20% Active positioning (spot + HL)
  // - 15% Market heat (dexscreener volume + volatility + thin liq)
  // - 15% Recent volatility (PNL swings)
  // - 15% On-chain room maturity (supply/price level as proxy for "hype stage")

  let score = 0;

  // 1. Leverage component (0-35)
  const leverage = notional / Math.max(accountValue, 1);
  const levScore = Math.min(leverage * 8, 35); // ~4.3x leverage = ~35 pts
  score += levScore;

  // 2. Positioning component (0-20)
  let posScore = 0;
  if (spotPositions && Array.isArray(spotPositions) && spotPositions.length > 0) posScore += 10;
  if (hlState.assetPositions && hlState.assetPositions.length > 0) posScore += 10;
  score += Math.min(posScore, 20);

  // 3. Dexscreener heat (0-15)
  let dexScore = 0;
  if (dexData && dexData.pairs && dexData.pairs.length > 0) {
    const pair = dexData.pairs[0];
    const vol = parseFloat(pair.volume?.h24 || '0');
    const chg = Math.abs(parseFloat(pair.priceChange?.h24 || '0'));
    const liq = parseFloat(pair.liquidity?.usd || '0');

    if (vol > 100000) dexScore += 6;
    else if (vol > 30000) dexScore += 3;

    if (chg > 15) dexScore += 5;
    else if (chg > 5) dexScore += 2;

    if (liq > 0 && liq < 80000) dexScore += 4; // thin = hype
  }
  score += Math.min(dexScore, 15);

  // 4. Volatility from PNL (0-15)
  let volScore = 0;
  if (pnlHistory && Array.isArray(pnlHistory) && pnlHistory.length > 2) {
    const recent = pnlHistory.slice(-5);
    let sumAbsChange = 0;
    for (let i = 1; i < recent.length; i++) {
      sumAbsChange += Math.abs((recent[i]?.pnl || 0) - (recent[i-1]?.pnl || 0));
    }
    const avg = sumAbsChange / (recent.length - 1);
    if (avg > 5000) volScore = 12;
    else if (avg > 1500) volScore = 7;
    else if (avg > 500) volScore = 3;
  }
  score += volScore;

  // 5. On-chain maturity (0-15) — uses real quadratic curve data
  // Early supply + rising marginal prices = "the window is still open" hype
  // Higher supply + expensive next keys = "late stage believers only" signal
  if (onchain) {
    let onScore = 0;
    const supply = onchain.totalSupply != null ? Number(onchain.totalSupply) : 0;
    const marginal = onchain.marginalBuy1 != null ? Number(onchain.marginalBuy1) : 0;

    // Supply phase (more keys = more legitimacy but less "early alpha" energy)
    if (supply > 0 && supply < 50) onScore += 9;      // extremely early — strongest narrative
    else if (supply < 150) onScore += 7;
    else if (supply < 500) onScore += 5;
    else if (supply < 2000) onScore += 3;
    else onScore += 1;

    // Price acceleration phase (quadratic getting spicy)
    // marginalBuy1 is in USDC 6-decimal units
    if (marginal > 100_000_000) onScore += 6;        // > $100 per key — very late / expensive
    else if (marginal > 10_000_000) onScore += 4;    // > $10
    else if (marginal > 1_000_000) onScore += 2;     // > $1

    score += Math.min(onScore, 15);
  }

  return Math.max(Math.min(Math.floor(score), 100), 5);
}

// Rich ABI for FriendKey (official from https://github.com/FriendDotSpace/contracts)
const FRIENDKEY_RICH_ABI = parseAbi([
  'function totalSupply(uint256 id) view returns (uint256)',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function getBuyPrice(uint256 id, uint256 amount) view returns (uint256)',
  'function getSellPrice(uint256 id, uint256 amount) view returns (uint256)',
  'function roomTiers(uint256) view returns (uint8)', // 0=Casual, 1=Club, 2=Exclusive
  'function creatorByTokenId(uint256) view returns (address)',
]);

const TIER_LABELS: Record<number, 'Casual' | 'Club' | 'Exclusive'> = {
  0: 'Casual',
  1: 'Club',
  2: 'Exclusive',
};

async function fetchRoom1659OnchainData(friendKeyContract: Address, user: Address) {
  const client = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
  });

  const roomTokenId = BigInt(process.env.ROOM_1659_FRIENDKEY_ID || '1659');

  if (roomTokenId === 0n) {
    return {
      tokenId: friendKeyContract,
      roomTokenId: '0',
      totalSupply: null,
      userBalance: null,
      marginalBuy1: null,
      marginalSell1: null,
      buy5: null,
      buy10: null,
      buy20: null,
      buy50: null,
      note: 'ROOM_1659_FRIENDKEY_ID resolved to 0 — this should not happen.',
    };
  }

  // Pull tier + core numbers + multiple curve depths in parallel.
  // All getBuyPrice calls use the real on-chain BondingCurveLib math.
  const [totalSupply, userBalance, tierRaw, buy1, sell1, buy5, buy10, buy20, buy50] = await Promise.all([
    client.readContract({ address: friendKeyContract, abi: FRIENDKEY_RICH_ABI, functionName: 'totalSupply', args: [roomTokenId] }).catch(() => null),
    client.readContract({ address: friendKeyContract, abi: FRIENDKEY_RICH_ABI, functionName: 'balanceOf', args: [user, roomTokenId] }).catch(() => null),
    client.readContract({ address: friendKeyContract, abi: FRIENDKEY_RICH_ABI, functionName: 'roomTiers', args: [roomTokenId] }).catch(() => null),
    client.readContract({ address: friendKeyContract, abi: FRIENDKEY_RICH_ABI, functionName: 'getBuyPrice', args: [roomTokenId, 1n] }).catch(() => null),
    client.readContract({ address: friendKeyContract, abi: FRIENDKEY_RICH_ABI, functionName: 'getSellPrice', args: [roomTokenId, 1n] }).catch(() => null),
    client.readContract({ address: friendKeyContract, abi: FRIENDKEY_RICH_ABI, functionName: 'getBuyPrice', args: [roomTokenId, 5n] }).catch(() => null),
    client.readContract({ address: friendKeyContract, abi: FRIENDKEY_RICH_ABI, functionName: 'getBuyPrice', args: [roomTokenId, 10n] }).catch(() => null),
    client.readContract({ address: friendKeyContract, abi: FRIENDKEY_RICH_ABI, functionName: 'getBuyPrice', args: [roomTokenId, 20n] }).catch(() => null),
    client.readContract({ address: friendKeyContract, abi: FRIENDKEY_RICH_ABI, functionName: 'getBuyPrice', args: [roomTokenId, 50n] }).catch(() => null),
  ]);

  const tierNum = tierRaw != null ? Number(tierRaw) : -1;
  const tier = TIER_LABELS[tierNum] ?? 'Unknown';

  return {
    tokenId: friendKeyContract,
    roomTokenId: roomTokenId.toString(),
    tier,
    totalSupply: totalSupply as bigint | null,
    userBalance: userBalance as bigint | null,
    marginalBuy1: buy1 as bigint | null,
    marginalSell1: sell1 as bigint | null,
    buy5: buy5 as bigint | null,
    buy10: buy10 as bigint | null,
    buy20: buy20 as bigint | null,
    buy50: buy50 as bigint | null,
  };
}

// ---------------------------------------------------------------------------
// Future: You can also add a lightweight "room summary" for the prompt
// ---------------------------------------------------------------------------
export type Room1659MarketSummaryForPrompt = {
  hype: string
  liquidation: string
  yourPosition: string
}

/** Compact position summary for `/help` and `/halp` in room 1659. */
export function formatRoom1659PositionHelpBlock(
  snapshot: Room1659MarketSnapshot,
  walletAddress?: string | null,
): string {
  const hlLabel = snapshot.hyperliquidUser
    ? `${snapshot.hyperliquidUser.slice(0, 6)}…${snapshot.hyperliquidUser.slice(-4)}`
    : 'room portfolio'
  const walletLabel = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : 'your wallet'
  const lines: string[] = [
    `**Room 1659 HL position** (${hlLabel})`,
    `(_viewer wallet: ${walletLabel}_)`,
  ]

  if (!snapshot.ok) {
    lines.push('_Live position data unavailable right now._')
    return lines.join('\n')
  }

  if (snapshot.userPosition) {
    const p = snapshot.userPosition
    const side = (p.side ?? 'flat').toUpperCase()
    const size = p.sizeUsd != null ? `$${Number(p.sizeUsd).toFixed(0)}` : '?'
    const pnl =
      p.unrealizedPnlUsd != null
        ? `${p.unrealizedPnlUsd >= 0 ? '+' : ''}$${Number(p.unrealizedPnlUsd).toFixed(0)} PnL`
        : null
    const liq =
      p.liquidationPrice != null ? `LIQ @ $${Number(p.liquidationPrice).toFixed(2)}` : null
    lines.push(`- ${side} ${size}${pnl ? ` · ${pnl}` : ''}${liq ? ` · ${liq}` : ''}`)
  } else {
    lines.push('- No open Hyperliquid position on the room 1659 portfolio user.')
  }

  const meta: string[] = []
  if (snapshot.hype != null) meta.push(`Hype **${snapshot.hype}**`)
  if (snapshot.liquidation != null) meta.push(`Liq **${snapshot.liquidation}**`)
  const keyBalance = snapshot.onchain?.userBalance
  if (keyBalance != null && keyBalance > 0n) {
    const keys = Number(keyBalance)
    meta.push(`${keys.toLocaleString('en-US')} FriendKey${keys === 1 ? '' : 's'}`)
  }
  if (meta.length > 0) lines.push(`- ${meta.join(' · ')}`)

  return lines.join('\n')
}

/**
 * Produces a high-signal, theatrical-marketing-ready block for Hermit.
 * This is the text that actually reaches the model when someone types
 * /hermit or /meme in room 1659. It is deliberately written to give the
 * creative agent real numbers it can turn into unhinged, quotable, dramatic copy.
 */
export function formatRoom1659MarketForHermit(
  snapshot: Room1659MarketSnapshot
): Room1659MarketSummaryForPrompt {
  const hype = snapshot.hype != null ? `${snapshot.hype}` : 'unknown'
  const liq = snapshot.liquidation != null ? `${snapshot.liquidation}` : 'unknown'

  let yourPos = 'You have no open position in this room.'
  if (snapshot.userPosition) {
    const p = snapshot.userPosition
    const side = (p.side ?? '???').toUpperCase()
    const size = p.sizeUsd != null ? `$${Number(p.sizeUsd).toFixed(0)}` : '?'
    const pnl = p.unrealizedPnlUsd != null ? ` PnL $${Number(p.unrealizedPnlUsd).toFixed(0)}` : ''
    const liqPx = p.liquidationPrice != null ? ` | LIQ @ $${Number(p.liquidationPrice).toFixed(2)}` : ''
    yourPos = `YOUR POSITION: ${side} ${size}${pnl}${liqPx}`
  }

  const lines: string[] = [yourPos]

  // === The good stuff: real quadratic curve data for theatrical copy ===
  if (snapshot.onchain && !snapshot.onchain.note) {
    const oc = snapshot.onchain
    const supply = oc.totalSupply != null ? Number(oc.totalSupply) : null

    const buy1 = formatUsdc(oc.marginalBuy1)
    const sell1 = formatUsdc(oc.marginalSell1)
    const b5 = formatUsdc(oc.buy5)
    const b10 = formatUsdc(oc.buy10)
    const b20 = formatUsdc(oc.buy20)
    const b50 = formatUsdc(oc.buy50)

    const tier = oc.tier && oc.tier !== 'Unknown' ? ` (${oc.tier} tier)` : ''

    lines.push('')
    lines.push(`ON-CHAIN FRIENDKEY CURVE (room 1659, tokenId ${oc.roomTokenId}${tier})`)
    lines.push(`Current supply: ${supply != null ? supply.toLocaleString() : '?'} keys minted`)

    if (buy1 !== '?') {
      lines.push(`Next 1 key costs: $${buy1} USDC`)
    }
    if (b5 !== '?') lines.push(`Next 5 keys cost: $${b5}`)
    if (b10 !== '?') lines.push(`Next 10 keys cost: $${b10}`)
    if (b20 !== '?') lines.push(`Next 20 keys cost: $${b20}`)
    if (b50 !== '?') lines.push(`Next 50 keys cost: $${b50}`)

    if (sell1 !== '?') {
      lines.push(`Selling 1 key right now returns: $${sell1}`)
    }

    // Give Hermit explicit dramatic language it can steal
    if (supply != null && supply < 100) {
      lines.push('CURVE STAGE: Extremely early. The quadratic is still almost flat. This is the "cheap keys" window.')
    } else if (supply != null && supply < 500) {
      lines.push('CURVE STAGE: Early. Acceleration is visible but still accessible for believers.')
    } else {
      lines.push('CURVE STAGE: Maturing. Each additional key is materially more expensive than the last.')
    }
  }

  return {
    hype,
    liquidation: liq,
    yourPosition: lines.join('\n'),
  }
}
