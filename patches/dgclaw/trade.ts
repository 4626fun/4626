import 'dotenv/config';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { HttpTransport, ExchangeClient, InfoClient } from '@nktkas/hyperliquid';

// ---- Config ----

const HL_API_URL = 'https://api.hyperliquid.xyz';

/**
 * Cabals.com Hyperliquid builder (from Cabals web client orderWire).
 * Orders that include this builder pay Cabals' 0.05% builder fee and count
 * toward Cabals competition / membership builder_volume. Arena attribution
 * remains wallet-based and is unaffected.
 */
const CABALS_HL_BUILDER_ADDRESS_DEFAULT =
  '0x6D4D5e0bFF83a0f2C1278b94e141809d5597D356' as const
/** 50 × 0.1 bps = 5 bps = 0.05% (Cabals documented fee). */
const CABALS_HL_BUILDER_FEE_TENTHS_BPS_DEFAULT = 50
const CABALS_HL_BUILDER_MAX_FEE_RATE_DEFAULT = '0.05%'

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACP_DIR = process.env.ACP_CLI_DIR || resolve(__dirname, '..', '..', 'acp-cli');

type CabalsBuilderConfig = {
  address: `0x${string}`
  feeTenthsOfBps: number
  maxFeeRate: `${string}%`
}

function envFlagEnabled(name: string): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function readCabalsBuilderConfig(): CabalsBuilderConfig | null {
  if (!envFlagEnabled('ARENA_CABALS_BUILDER_ENABLED')) return null

  const addressRaw = String(
    process.env.ARENA_CABALS_BUILDER_ADDRESS ?? CABALS_HL_BUILDER_ADDRESS_DEFAULT,
  )
    .trim()
    .toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(addressRaw)) {
    console.error(
      'ARENA_CABALS_BUILDER_ENABLED is set but ARENA_CABALS_BUILDER_ADDRESS is invalid',
    )
    process.exit(1)
  }

  const feeRaw = String(
    process.env.ARENA_CABALS_BUILDER_FEE_TENTHS_BPS ??
      CABALS_HL_BUILDER_FEE_TENTHS_BPS_DEFAULT,
  ).trim()
  const feeTenthsOfBps = Number(feeRaw)
  if (
    !Number.isInteger(feeTenthsOfBps) ||
    feeTenthsOfBps < 0 ||
    feeTenthsOfBps > 1000
  ) {
    console.error(
      'ARENA_CABALS_BUILDER_FEE_TENTHS_BPS must be an integer in [0, 1000]',
    )
    process.exit(1)
  }

  const maxFeeRateRaw = String(
    process.env.ARENA_CABALS_BUILDER_MAX_FEE_RATE ??
      CABALS_HL_BUILDER_MAX_FEE_RATE_DEFAULT,
  ).trim()
  if (!/^[0-9]+(\.[0-9]+)?%$/.test(maxFeeRateRaw)) {
    console.error(
      'ARENA_CABALS_BUILDER_MAX_FEE_RATE must look like "0.05%"',
    )
    process.exit(1)
  }

  return {
    address: addressRaw as `0x${string}`,
    feeTenthsOfBps,
    maxFeeRate: maxFeeRateRaw as `${string}%`,
  }
}

function withOptionalCabalsBuilder<T extends Record<string, unknown>>(
  params: T,
  builder: CabalsBuilderConfig | null,
): T & { builder?: { b: `0x${string}`; f: number } } {
  if (!builder) return params
  return {
    ...params,
    builder: { b: builder.address, f: builder.feeTenthsOfBps },
  }
}

function getAcpBin(): string {
  const fromEnv = String(process.env.ACP_BIN ?? process.env.ARENA_ACP_BIN ?? '').trim()
  if (fromEnv) return fromEnv
  try {
    execSync('command -v acp', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: '/bin/sh',
    })
    return 'acp'
  } catch {
    // fall through to dev checkout
  }
  const bin = resolve(ACP_DIR, 'bin', 'acp.ts');
  if (!existsSync(bin)) {
    console.error(`acp-cli not found at ${bin}`);
    console.error('Set ACP_CLI_DIR or clone acp-cli as a sibling directory.');
    process.exit(1);
  }
  return `npx tsx ${bin}`;
}

interface TradeArgs {
  command: string;
  pair?: string;
  side?: 'long' | 'short';
  size?: string;
  leverage?: number;
  orderType?: 'market' | 'limit';
  limitPrice?: string;
  stopLoss?: string;
  takeProfit?: string;
  amount?: string;
  to?: 'perp' | 'spot';
  subaccount?: string;
}

// ---- CLI Parsing ----

function printUsage(): never {
  console.log(`Degenerate Claw — Hyperliquid Trading CLI

Usage: npx tsx scripts/trade.ts <command> [options]

Commands:
  open        Open a new position
  close       Close an existing position (optionally partial via --size)
  modify      Modify TP/SL/leverage on an open position
  positions   List open positions
  balance     Show account balance (spot + perp)
  tickers     List available trading pairs
  transfer    Move USDC between spot and perp accounts (--amount, --to)
  approve-cabals-builder
              One-time Hyperliquid approveBuilderFee for Cabals attribution

Note: For deposits, use ACP job (see SKILL.md). For withdrawals, use scripts/withdraw.ts.

Options:
  --pair <symbol>       Asset symbol (e.g. ETH, BTC, xyz:TSLA)
  --side <long|short>   Position side (required for open)
  --size <usd>          Position size in USD notional (required for open;
                        optional for close = partial reduce-only close)
  --leverage <n>        Leverage multiplier (default: 1)
  --type <market|limit> Order type (default: market)
  --limit-price <px>    Limit price (required for limit orders)
  --sl <px>             Stop loss trigger price
  --tp <px>             Take profit trigger price
  --amount <usdc>       USDC amount (required for transfer)
  --to <perp|spot>      Transfer destination (default: perp)
  --subaccount <addr>   Hyperliquid subaccount address (optional)

Signing:
  Default: orders are signed by your ACP agent wallet via acp-cli (no API wallet needed).
  API-wallet mode: set HL_AGENT_PRIVATE_KEY to an approved Hyperliquid API wallet
  key to sign locally for the master account in HL_MASTER_ADDRESS (no acp-cli).

Environment:
  HL_MASTER_ADDRESS     Master account address (the ACP agent wallet). Auto-detected via acp-cli if unset.
  HL_AGENT_PRIVATE_KEY  Approved HL API-wallet private key (enables local signing; requires HL_MASTER_ADDRESS)
  HL_SUBACCOUNT_ADDRESS Optional Hyperliquid subaccount address for strategy sleeve routing.
  ACP_CLI_DIR           Path to acp-cli repo (auto-detected as sibling dir if unset)
  ARENA_CABALS_BUILDER_ENABLED
                        When 1/true, attach Cabals HL builder on open/close/modify orders
                        so fills count toward Cabals builder_volume (0.05% fee).
  ARENA_CABALS_BUILDER_ADDRESS
                        Override Cabals builder (default 0x6D4D5e0b…D356).
  ARENA_CABALS_BUILDER_FEE_TENTHS_BPS
                        Builder fee in 0.1bps units (default 50 = 0.05%).
  ARENA_CABALS_BUILDER_MAX_FEE_RATE
                        Max fee string for approve-cabals-builder (default 0.05%).

Examples:
  npx tsx scripts/trade.ts open --pair ETH --side long --size 500 --leverage 5
  npx tsx scripts/trade.ts open --pair BTC --side short --size 1000 --leverage 3 --sl 105000 --tp 95000
  npx tsx scripts/trade.ts close --pair ETH
  npx tsx scripts/trade.ts modify --pair ETH --sl 3200 --tp 4000
  npx tsx scripts/trade.ts positions
  npx tsx scripts/trade.ts balance`);
  process.exit(1);
}

function parseArgs(): TradeArgs {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) printUsage();

  const command = args[0];
  const result: TradeArgs = { command };

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--pair':
        result.pair = args[++i];
        break;
      case '--side':
        result.side = args[++i] as 'long' | 'short';
        break;
      case '--size':
        result.size = args[++i];
        break;
      case '--leverage':
        result.leverage = parseInt(args[++i]);
        break;
      case '--type':
        result.orderType = args[++i] as 'market' | 'limit';
        break;
      case '--limit-price':
        result.limitPrice = args[++i];
        break;
      case '--sl':
        result.stopLoss = args[++i];
        break;
      case '--tp':
        result.takeProfit = args[++i];
        break;
      case '--amount':
        result.amount = args[++i];
        break;
      case '--to':
        result.to = args[++i] as 'perp' | 'spot';
        break;
      case '--subaccount':
        result.subaccount = args[++i];
        break;
      default:
        if (!args[i].startsWith('--')) break;
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  return result;
}

// ---- Helpers ----

interface AssetMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
}

type ResolvedAsset = {
  /** Wire asset id (main index, or HIP-3 100000 + dexIndex*10000 + localIndex). */
  index: number
  meta: AssetMeta
  /** Canonical HL coin name (e.g. BTC or xyz:SP500). */
  coin: string
  /** Builder dex name for HIP-3 pairs; null for main perps. */
  dex: string | null
}

/** Normalize to HL coin form: BTC or xyz:SP500 (dex lower, symbol upper). */
function normalizePair(pair: string): string {
  const raw = String(pair ?? '').trim()
  if (!raw) return ''
  const colon = raw.indexOf(':')
  if (colon === -1) return raw.toUpperCase()
  const dex = raw.slice(0, colon).toLowerCase()
  const symbol = raw.slice(colon + 1).toUpperCase()
  return `${dex}:${symbol}`
}

function pairDex(pair: string): string | null {
  const normalized = normalizePair(pair)
  const colon = normalized.indexOf(':')
  return colon === -1 ? null : normalized.slice(0, colon)
}

function coinsEqual(a: string, b: string): boolean {
  return normalizePair(a) === normalizePair(b)
}

/**
 * Resolve a trading pair to its Hyperliquid asset id.
 *
 * Main perps use universe index. HIP-3 builder-dex assets (e.g. xyz:SP500)
 * live on a named dex and use asset id = 100000 + dexIndex*10000 + localIndex.
 * @see https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/asset-ids
 */
async function getAssetIndex(
  info: InfoClient,
  pair: string,
): Promise<ResolvedAsset> {
  const normalized = normalizePair(pair)
  if (!normalized) {
    console.error('Pair is required')
    process.exit(1)
  }

  const dex = pairDex(normalized)
  if (!dex) {
    const metaResponse = await info.meta()
    const universe = metaResponse.universe
    const idx = universe.findIndex((a: any) => coinsEqual(a.name, normalized))
    if (idx === -1) {
      console.error(`Unknown pair: ${pair}`)
      console.error(`Available: ${universe.map((a: any) => a.name).join(', ')}`)
      process.exit(1)
    }
    const meta = universe[idx] as AssetMeta
    return { index: idx, meta, coin: meta.name, dex: null }
  }

  const perpDexs = await info.perpDexs()
  const dexIndex = perpDexs.findIndex(
    (entry: any) =>
      entry &&
      typeof entry.name === 'string' &&
      entry.name.toLowerCase() === dex,
  )
  // Index 0 is the main dex (null entry); builder dexs start at 1.
  if (dexIndex <= 0) {
    console.error(`Unknown HIP-3 dex: ${dex}`)
    const known = perpDexs
      .filter((entry: any) => entry && entry.name)
      .map((entry: any) => entry.name)
      .join(', ')
    console.error(`Available HIP-3 dexs: ${known || '(none)'}`)
    process.exit(1)
  }

  const metaResponse = await info.meta({ dex })
  const universe = metaResponse.universe
  const localIdx = universe.findIndex((a: any) => coinsEqual(a.name, normalized))
  if (localIdx === -1) {
    console.error(`Unknown pair: ${pair}`)
    console.error(
      `Available on ${dex}: ${universe.map((a: any) => a.name).join(', ')}`,
    )
    process.exit(1)
  }

  const meta = universe[localIdx] as AssetMeta
  const index = 100_000 + dexIndex * 10_000 + localIdx
  return { index, meta, coin: meta.name, dex }
}

async function getMidPrice(
  info: InfoClient,
  coin: string,
  dex: string | null,
): Promise<number> {
  const mids = dex ? await info.allMids({ dex }) : await info.allMids()
  const direct = parseFloat(mids[coin])
  if (Number.isFinite(direct) && direct > 0) return direct
  const key = Object.keys(mids).find((k) => coinsEqual(k, coin))
  if (key) {
    const px = parseFloat(mids[key])
    if (Number.isFinite(px) && px > 0) return px
  }
  console.error(`Could not get mid price for ${coin}`)
  process.exit(1)
}

async function readClearinghouseState(
  info: InfoClient,
  user: `0x${string}`,
  dex: string | null,
) {
  return dex
    ? info.clearinghouseState({ user, dex })
    : info.clearinghouseState({ user })
}

async function readOpenOrders(
  info: InfoClient,
  user: `0x${string}`,
  dex: string | null,
) {
  return dex ? info.openOrders({ user, dex }) : info.openOrders({ user })
}

function formatPrice(price: number, significantFigures: number = 5): string {
  return price.toPrecision(significantFigures);
}

function formatSize(usdSize: number, price: number, szDecimals: number): string {
  const rawSize = usdSize / price;
  return rawSize.toFixed(szDecimals);
}

function assertOrderAccepted(result: any, context: string): void {
  if (!result || result.status !== 'ok') {
    console.error(`${context} failed:`);
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  const statuses = result?.response?.data?.statuses;
  if (!Array.isArray(statuses) || statuses.length === 0) return;

  for (const status of statuses) {
    if (status?.error) {
      console.error(`${context} rejected by exchange: ${String(status.error)}`);
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }
  }
}

function normalizeAddressOrNull(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  return /^0x[a-fA-F0-9]{40}$/.test(raw) ? raw.toLowerCase() : null;
}

function resolveSubaccountAddress(args: TradeArgs): string | null {
  const fromArg = normalizeAddressOrNull(args.subaccount);
  if (args.subaccount && !fromArg) {
    console.error(`Invalid --subaccount address: ${args.subaccount}`);
    process.exit(1);
  }
  const fromEnv = normalizeAddressOrNull(process.env.HL_SUBACCOUNT_ADDRESS);
  if (process.env.HL_SUBACCOUNT_ADDRESS && !fromEnv) {
    console.error('HL_SUBACCOUNT_ADDRESS is set but is not a valid 0x address.');
    process.exit(1);
  }
  return fromArg ?? fromEnv;
}

// ---- Commands ----

async function openPosition(
  exchange: ExchangeClient,
  info: InfoClient,
  args: TradeArgs,
  cabalsBuilder: CabalsBuilderConfig | null,
) {
  if (!args.pair) { console.error('--pair is required'); process.exit(1); }
  if (!args.side) { console.error('--side is required'); process.exit(1); }
  if (!args.size) { console.error('--size is required'); process.exit(1); }

  const { index: assetId, meta, coin, dex } = await getAssetIndex(info, args.pair);
  const isBuy = args.side === 'long';
  const leverage = args.leverage ?? 1;

  // Set leverage first
  await exchange.updateLeverage({
    asset: assetId,
    isCross: true,
    leverage,
  });
  console.log(`Leverage set to ${leverage}x (cross margin)`);

  // Get current mid price for market orders (HIP-3 mids are dex-scoped)
  const midPrice = await getMidPrice(info, coin, dex);

  let orderPrice: string;
  let tif: 'Ioc' | 'Gtc';

  if (args.orderType === 'limit' && args.limitPrice) {
    orderPrice = args.limitPrice;
    tif = 'Gtc';
  } else {
    // Market order: use IoC with 1% slippage buffer
    const slippage = isBuy ? 1.01 : 0.99;
    orderPrice = formatPrice(midPrice * slippage);
    tif = 'Ioc';
  }

  const sz = formatSize(parseFloat(args.size), midPrice, meta.szDecimals);

  console.log(`Opening ${args.side} ${coin} — size: ${sz} ($${args.size}), price: ${orderPrice}, leverage: ${leverage}x`);
  if (cabalsBuilder) {
    console.log(
      `Cabals builder attached: ${cabalsBuilder.address} feeTenthsOfBps=${cabalsBuilder.feeTenthsOfBps}`,
    )
  }

  const result = await exchange.order(
    withOptionalCabalsBuilder(
      {
        orders: [{
          a: assetId,
          b: isBuy,
          r: false,
          p: orderPrice,
          s: sz,
          t: { limit: { tif } },
        }],
        grouping: 'na' as const,
      },
      cabalsBuilder,
    ),
  );

  console.log(JSON.stringify(result, null, 2));
  assertOrderAccepted(result, `Open ${coin}`);

  // Place TP/SL trigger orders if specified
  if (args.takeProfit) {
    console.log(`Setting take profit at ${args.takeProfit}...`);
    const tpResult = await exchange.order(
      withOptionalCabalsBuilder(
        {
          orders: [{
            a: assetId,
            b: !isBuy,
            r: true,
            p: args.takeProfit,
            s: sz,
            t: {
              trigger: {
                triggerPx: args.takeProfit,
                isMarket: true,
                tpsl: 'tp' as const,
              },
            },
          }],
          grouping: 'na' as const,
        },
        cabalsBuilder,
      ),
    );
    console.log('Take profit set:', JSON.stringify(tpResult, null, 2));
  }

  if (args.stopLoss) {
    console.log(`Setting stop loss at ${args.stopLoss}...`);
    const slResult = await exchange.order(
      withOptionalCabalsBuilder(
        {
          orders: [{
            a: assetId,
            b: !isBuy,
            r: true,
            p: args.stopLoss,
            s: sz,
            t: {
              trigger: {
                triggerPx: args.stopLoss,
                isMarket: true,
                tpsl: 'sl' as const,
              },
            },
          }],
          grouping: 'na' as const,
        },
        cabalsBuilder,
      ),
    );
    console.log('Stop loss set:', JSON.stringify(slResult, null, 2));
  }
}

async function closePosition(
  exchange: ExchangeClient,
  info: InfoClient,
  args: TradeArgs,
  accountAddressForReads: string,
  cabalsBuilder: CabalsBuilderConfig | null,
) {
  if (!args.pair) { console.error('--pair is required'); process.exit(1); }

  const { index: assetId, meta, coin, dex } = await getAssetIndex(info, args.pair);

  // Get current position to determine size and side
  const state = await readClearinghouseState(
    info,
    accountAddressForReads as `0x${string}`,
    dex,
  );
  const position = state.assetPositions.find((p: any) =>
    coinsEqual(p.position.coin, coin),
  );

  if (!position) {
    console.error(`No open position for ${coin}`);
    process.exit(1);
  }

  const posSize = parseFloat(position.position.szi);
  const isBuy = posSize < 0; // Close short = buy, close long = sell
  const fullSize = Math.abs(posSize);

  // Market close with 1% slippage
  const midPrice = await getMidPrice(info, coin, dex);
  const slippage = isBuy ? 1.01 : 0.99;
  const orderPrice = formatPrice(midPrice * slippage);

  // Optional partial close: --size <usd> reduces the position by that USD
  // notional (reduce-only). Falls back to a full close when the requested
  // size rounds to zero or meets/exceeds the open position.
  let sz = fullSize.toString();
  let closeKind = 'full';
  if (args.size) {
    const requestedUsd = parseFloat(args.size);
    if (!Number.isFinite(requestedUsd) || requestedUsd <= 0) {
      console.error('--size must be a positive USD amount when closing');
      process.exit(1);
    }
    const requestedSize = parseFloat(formatSize(requestedUsd, midPrice, meta.szDecimals));
    if (requestedSize > 0 && requestedSize < fullSize) {
      sz = requestedSize.toFixed(meta.szDecimals);
      closeKind = 'partial';
    }
  }

  console.log(`Closing ${coin} position (${closeKind}) — size: ${sz} of ${fullSize}, price: ${orderPrice}`);
  if (cabalsBuilder) {
    console.log(
      `Cabals builder attached: ${cabalsBuilder.address} feeTenthsOfBps=${cabalsBuilder.feeTenthsOfBps}`,
    )
  }

  const result = await exchange.order(
    withOptionalCabalsBuilder(
      {
        orders: [{
          a: assetId,
          b: isBuy,
          r: true,
          p: orderPrice,
          s: sz,
          t: { limit: { tif: 'Ioc' as const } },
        }],
        grouping: 'na' as const,
      },
      cabalsBuilder,
    ),
  );

  console.log(JSON.stringify(result, null, 2));
  assertOrderAccepted(result, `Close ${coin}`);
}

async function modifyPosition(
  exchange: ExchangeClient,
  info: InfoClient,
  args: TradeArgs,
  accountAddressForReads: string,
  cabalsBuilder: CabalsBuilderConfig | null,
) {
  if (!args.pair) { console.error('--pair is required'); process.exit(1); }
  if (!args.leverage && !args.stopLoss && !args.takeProfit) {
    console.error('At least one of --leverage, --sl, or --tp is required');
    process.exit(1);
  }

  const { index: assetId, coin, dex } = await getAssetIndex(info, args.pair);

  // Get current position
  const state = await readClearinghouseState(
    info,
    accountAddressForReads as `0x${string}`,
    dex,
  );
  const position = state.assetPositions.find((p: any) =>
    coinsEqual(p.position.coin, coin),
  );

  if (!position) {
    console.error(`No open position for ${coin}`);
    process.exit(1);
  }

  const posSize = parseFloat(position.position.szi);
  const isBuy = posSize > 0; // Long position
  const sz = Math.abs(posSize).toString();

  if (args.leverage) {
    await exchange.updateLeverage({
      asset: assetId,
      isCross: true,
      leverage: args.leverage,
    });
    console.log(`Leverage updated to ${args.leverage}x`);
  }

  // Cancel existing TP/SL orders before placing new ones
  const openOrders = await readOpenOrders(
    info,
    accountAddressForReads as `0x${string}`,
    dex,
  );
  const tpslOrders = openOrders.filter(
    (o: any) => coinsEqual(String(o.coin ?? ''), coin) && o.orderType?.includes('trigger'),
  );
  if (tpslOrders.length > 0) {
    for (const order of tpslOrders) {
      try {
        await exchange.cancel({ cancels: [{ a: assetId, o: order.oid }] });
      } catch {
        // Ignore cancel failures for already-filled orders
      }
    }
  }

  if (args.takeProfit) {
    console.log(`Setting take profit at ${args.takeProfit}...`);
    const tpResult = await exchange.order(
      withOptionalCabalsBuilder(
        {
          orders: [{
            a: assetId,
            b: !isBuy,
            r: true,
            p: args.takeProfit,
            s: sz,
            t: {
              trigger: {
                triggerPx: args.takeProfit,
                isMarket: true,
                tpsl: 'tp' as const,
              },
            },
          }],
          grouping: 'na' as const,
        },
        cabalsBuilder,
      ),
    );
    console.log('Take profit set:', JSON.stringify(tpResult, null, 2));
  }

  if (args.stopLoss) {
    console.log(`Setting stop loss at ${args.stopLoss}...`);
    const slResult = await exchange.order(
      withOptionalCabalsBuilder(
        {
          orders: [{
            a: assetId,
            b: !isBuy,
            r: true,
            p: args.stopLoss,
            s: sz,
            t: {
              trigger: {
                triggerPx: args.stopLoss,
                isMarket: true,
                tpsl: 'sl' as const,
              },
            },
          }],
          grouping: 'na' as const,
        },
        cabalsBuilder,
      ),
    );
    console.log('Stop loss set:', JSON.stringify(slResult, null, 2));
  }
}

async function approveCabalsBuilder(
  exchange: ExchangeClient,
  info: InfoClient,
  masterAddress: string,
  builder: CabalsBuilderConfig,
) {
  const approved = await info.maxBuilderFee({
    user: masterAddress as `0x${string}`,
    builder: builder.address,
  })
  console.log(
    JSON.stringify(
      {
        user: masterAddress,
        builder: builder.address,
        maxFeeRate: builder.maxFeeRate,
        currentMaxBuilderFeeTenthsOfBps: approved,
      },
      null,
      2,
    ),
  )
  if (typeof approved === 'number' && approved >= builder.feeTenthsOfBps) {
    console.log('Cabals builder already approved at sufficient max fee; skipping.')
    return
  }

  const result = await exchange.approveBuilderFee({
    maxFeeRate: builder.maxFeeRate,
    builder: builder.address,
  })
  console.log(JSON.stringify(result, null, 2))
  const after = await info.maxBuilderFee({
    user: masterAddress as `0x${string}`,
    builder: builder.address,
  })
  if (typeof after !== 'number' || after < builder.feeTenthsOfBps) {
    console.error(
      `approveBuilderFee completed but maxBuilderFee is still insufficient (got ${String(after)})`,
    )
    process.exit(1)
  }
  console.log(
    `Cabals builder approved: ${builder.address} maxFeeRate=${builder.maxFeeRate} (tenthsOfBps=${after})`,
  )
}

async function showPositions(info: InfoClient, accountAddressForReads: string) {
  const user = accountAddressForReads as `0x${string}`
  const positions: any[] = []

  const mainState = await info.clearinghouseState({ user })
  for (const p of mainState.assetPositions) {
    if (parseFloat(p.position.szi) !== 0) positions.push(p)
  }

  // HIP-3 positions are scoped per builder dex.
  const perpDexs = await info.perpDexs()
  for (const entry of perpDexs) {
    if (!entry || typeof entry.name !== 'string' || !entry.name) continue
    try {
      const state = await info.clearinghouseState({ user, dex: entry.name })
      for (const p of state.assetPositions) {
        if (parseFloat(p.position.szi) !== 0) positions.push(p)
      }
    } catch {
      // Ignore dexes the account cannot read.
    }
  }

  if (positions.length === 0) {
    console.log('No open positions')
    return
  }

  console.log(JSON.stringify(positions, null, 2))
}

async function showBalance(info: InfoClient, accountAddressForReads: string) {
  const user = accountAddressForReads as `0x${string}`;

  // Spot balance (primary balance in unified account mode)
  const spotState = await info.spotClearinghouseState({ user });
  const spotBalances = spotState.balances.filter(
    (b: any) => parseFloat(b.hold) !== 0 || parseFloat(b.total) !== 0,
  );

  // Perp balance (margin summary)
  const perpState = await info.clearinghouseState({ user });

  console.log(
    JSON.stringify(
      {
        spot: {
          balances: spotBalances,
        },
        perp: {
          accountValue: perpState.marginSummary.accountValue,
          totalMarginUsed: perpState.marginSummary.totalMarginUsed,
          withdrawable: perpState.withdrawable,
          crossMaintenanceMarginUsed: perpState.crossMaintenanceMarginUsed,
        },
      },
      null,
      2,
    ),
  );
}

async function showTickers(info: InfoClient) {
  const tickers: Array<{
    symbol: string
    midPrice: string
    maxLeverage: number
    szDecimals: number
    dex: string
  }> = []

  const mainMeta = await info.meta()
  const mainMids = await info.allMids()
  for (const asset of mainMeta.universe as any[]) {
    tickers.push({
      symbol: asset.name,
      midPrice: mainMids[asset.name] ?? 'N/A',
      maxLeverage: asset.maxLeverage,
      szDecimals: asset.szDecimals,
      dex: '',
    })
  }

  const perpDexs = await info.perpDexs()
  for (const entry of perpDexs) {
    if (!entry || typeof entry.name !== 'string' || !entry.name) continue
    try {
      const [meta, mids] = await Promise.all([
        info.meta({ dex: entry.name }),
        info.allMids({ dex: entry.name }),
      ])
      for (const asset of meta.universe as any[]) {
        tickers.push({
          symbol: asset.name,
          midPrice: mids[asset.name] ?? 'N/A',
          maxLeverage: asset.maxLeverage,
          szDecimals: asset.szDecimals,
          dex: entry.name,
        })
      }
    } catch {
      // Ignore dexes that fail metadata reads.
    }
  }

  console.log(JSON.stringify(tickers, null, 2))
}

// ---- Signing (ACP CLI, master wallet — no API wallet) ----

// EIP-712 primaryType is the root struct: the one not referenced as a field
// type by any other struct. The SDK omits it when calling an ethers-style
// signer, but acp-cli needs it in the typed-data payload.
function derivePrimaryType(
  types: Record<string, Array<{ name: string; type: string }>>,
): string {
  const referenced = new Set<string>();
  for (const fields of Object.values(types)) {
    for (const f of fields) {
      const base = f.type.replace(/(\[\d*\])+$/, '');
      if (types[base]) referenced.add(base);
    }
  }
  return Object.keys(types).find((t) => !referenced.has(t)) ?? Object.keys(types)[0];
}

// Approved Hyperliquid API-wallet private key (optional). When set, orders are
// signed locally with this agent key instead of shelling out to acp-cli. The
// exchange resolves the agent signature to the master account that approved
// it, so HL_MASTER_ADDRESS must point at that master account.
function getAgentPrivateKey(): string | null {
  const raw = (process.env.HL_AGENT_PRIVATE_KEY ?? '').trim();
  if (!raw) return null;
  const normalized = raw.startsWith('0x') ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    console.error('HL_AGENT_PRIVATE_KEY is set but is not a 32-byte hex private key.');
    process.exit(1);
  }
  return normalized;
}

// Build a viem local account from the API-wallet key. viem is an optional
// dependency only required for this signing lane, so it is imported lazily —
// the default ACP lane must keep working in environments without viem.
async function makeApiWallet(privateKey: string) {
  try {
    const { privateKeyToAccount } = await import('viem/accounts');
    return privateKeyToAccount(privateKey as `0x${string}`);
  } catch (err: any) {
    console.error('HL_AGENT_PRIVATE_KEY signing requires the `viem` package.');
    console.error('Install it in dgclaw-skill: npm install viem');
    console.error(err?.message ?? err);
    process.exit(1);
  }
}

async function transferUsdClass(exchange: ExchangeClient, args: TradeArgs): Promise<void> {
  const amount = String(args.amount ?? '').trim();
  if (!amount || !(parseFloat(amount) > 0)) {
    console.error('transfer requires --amount <usdc> (positive number)');
    process.exit(1);
  }
  const toPerp = (args.to ?? 'perp') !== 'spot';

  console.log(`Transferring ${amount} USDC ${toPerp ? 'spot -> perp' : 'perp -> spot'}...`);
  const result = await exchange.usdClassTransfer({ amount, toPerp });
  if ((result as any)?.status === 'ok') {
    console.log('Transfer submitted successfully.');
  } else {
    console.error('Transfer failed:');
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

// Resolve the master (ACP agent) wallet address. This is the account that
// signs orders and whose positions/balances we read.
function getMasterAddress(): string {
  const env = process.env.HL_MASTER_ADDRESS;
  if (env) return env;

  if (getAgentPrivateKey()) {
    console.error('HL_AGENT_PRIVATE_KEY is set but HL_MASTER_ADDRESS is missing.');
    console.error('API-wallet signing needs the master account address explicitly.');
    process.exit(1);
  }

  const acp = getAcpBin();
  try {
    const result = execSync(`${acp} agent whoami --json`, {
      encoding: 'utf-8',
      cwd: ACP_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(result);
    const addr = parsed.walletAddress ?? parsed.data?.walletAddress ?? parsed.address;
    if (!addr) throw new Error('no address in acp whoami output');
    return addr;
  } catch {
    console.error('HL_MASTER_ADDRESS not set and could not auto-detect via acp-cli.');
    console.error('Set HL_MASTER_ADDRESS or run: acp configure && acp agent create');
    process.exit(1);
  }
}

// An ethers-v6-shaped signer the Hyperliquid SDK can use. Instead of holding a
// private key, every EIP-712 signature is delegated to the ACP CLI, which signs
// with the agent's managed (master) wallet — same mechanism as withdraw.ts.
// The SDK detects this as an ethers v6 signer (signTypedData arity 3 + getAddress).
function makeAcpWallet(masterAddress: string) {
  const acp = getAcpBin();
  return {
    async getAddress(): Promise<string> {
      return masterAddress;
    },
    async signTypedData(domain: any, types: any, message: any): Promise<string> {
      const typedData = {
        domain,
        types,
        primaryType: derivePrimaryType(types),
        message,
      };
      try {
        const result = execSync(
          `${acp} wallet sign-typed-data --data '${JSON.stringify(typedData)}' --json`,
          { encoding: 'utf-8', cwd: ACP_DIR, stdio: ['pipe', 'pipe', 'pipe'] },
        );
        const parsed = JSON.parse(result);
        return parsed.signature ?? parsed.data?.signature ?? result.trim();
      } catch (err: any) {
        console.error('Failed to sign with ACP CLI. Make sure acp-cli is configured:');
        console.error('  acp configure && acp agent add-signer');
        console.error(err.stderr || err.message);
        process.exit(1);
      }
    },
  };
}

// ---- Main ----

async function main() {
  const args = parseArgs();
  const subaccountAddress = resolveSubaccountAddress(args);

  const transport = new HttpTransport({ url: HL_API_URL });
  const info = new InfoClient({ transport });

  // Read-only, no wallet/acp-cli required.
  if (args.command === 'tickers') {
    await showTickers(info);
    return;
  }

  const masterAddress = getMasterAddress();
  const accountAddressForReads = subaccountAddress ?? masterAddress;

  switch (args.command) {
    case 'positions':
      await showPositions(info, accountAddressForReads);
      break;
    case 'balance':
      await showBalance(info, accountAddressForReads);
      break;
    case 'open':
    case 'close':
    case 'modify': {
      const agentKey = getAgentPrivateKey();
      const wallet = agentKey ? await makeApiWallet(agentKey) : makeAcpWallet(masterAddress);
      const exchange = new ExchangeClient({
        wallet: wallet as any,
        transport,
        ...(subaccountAddress ? { defaultVaultAddress: subaccountAddress as `0x${string}` } : {}),
      } as any);
      const cabalsBuilder = readCabalsBuilderConfig();
      if (args.command === 'open') {
        await openPosition(exchange, info, args, cabalsBuilder);
      } else if (args.command === 'close') {
        await closePosition(exchange, info, args, accountAddressForReads, cabalsBuilder);
      } else {
        await modifyPosition(exchange, info, args, accountAddressForReads, cabalsBuilder);
      }
      break;
    }
    case 'approve-cabals-builder': {
      // Approve must be signed by the master HL account (ACP agent wallet), not
      // an API-wallet key — same constraint as usdClassTransfer.
      const builder =
        readCabalsBuilderConfig() ??
        ({
          address: CABALS_HL_BUILDER_ADDRESS_DEFAULT.toLowerCase() as `0x${string}`,
          feeTenthsOfBps: CABALS_HL_BUILDER_FEE_TENTHS_BPS_DEFAULT,
          maxFeeRate: CABALS_HL_BUILDER_MAX_FEE_RATE_DEFAULT,
        } satisfies CabalsBuilderConfig)
      const exchange = new ExchangeClient({
        wallet: makeAcpWallet(masterAddress) as any,
        transport,
      } as any)
      await approveCabalsBuilder(exchange, info, masterAddress, builder)
      break
    }
    case 'transfer': {
      // usdClassTransfer is a user-signed action: Hyperliquid moves funds on
      // the account that SIGNS, so an API-wallet key would transfer the API
      // wallet's own (empty) balance instead of the master's. ACP lane only.
      if (getAgentPrivateKey()) {
        console.error('transfer is not supported in API-wallet mode (HL_AGENT_PRIVATE_KEY set).');
        console.error('usdClassTransfer must be signed by the master wallet via acp-cli.');
        process.exit(1);
      }
      const wallet = makeAcpWallet(masterAddress);
      const exchange = new ExchangeClient({
        wallet: wallet as any,
        transport,
        ...(subaccountAddress ? { defaultVaultAddress: subaccountAddress as `0x${string}` } : {}),
      } as any);
      await transferUsdClass(exchange, args);
      break;
    }
    default:
      console.error(`Unknown command: ${args.command}`);
      printUsage();
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
