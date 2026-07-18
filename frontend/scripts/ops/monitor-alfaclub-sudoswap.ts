#!/usr/bin/env tsx

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbi,
  parseUnits,
  type Address,
} from "viem";
import { base } from "viem/chains";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const CANONICAL_PERMIT2 = getAddress(
  "0x000000000022D473030F116dDEE9F6B43aC78BA3",
);
const FRIEND_KEY = getAddress("0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F");
const DEFAULT_CREATOR_COIN = getAddress(
  "0x5b674196812451b7cec024fe9d22d2c0b172fa75",
);
const DEFAULT_TOKEN_ID = 1659n;
const ERC1155_ERC20_VARIANT = 3;
const TRADE_POOL_TYPE = 2;
const TRADING_PAIR_FEE = 69_000_000_000_000_000n;
const BPS = 10_000n;

const FACTORY_ABI = parseAbi([
  "function isValidPair(address pair) view returns (bool)",
  "function bondingCurveAllowed(address curve) view returns (bool)",
]);
const ADAPTER_ABI = parseAbi([
  "function owner() view returns (address)",
  "function factory() view returns (address)",
  "function permit2() view returns (address)",
  "function friendKey() view returns (address)",
  "function xykCurve() view returns (address)",
  "function universalRouter() view returns (address)",
  "function markets(address pair) view returns (address creatorCoin, uint256 tokenId, bool allowed)",
]);
const ROUTER_ABI = parseAbi([
  "function SUDOSWAP_ADAPTER() view returns (address)",
]);
const PAIR_ABI = parseAbi([
  "function factory() view returns (address)",
  "function pairVariant() pure returns (uint8)",
  "function poolType() view returns (uint8)",
  "function token() view returns (address)",
  "function nft() view returns (address)",
  "function nftId() pure returns (uint256)",
  "function bondingCurve() view returns (address)",
  "function fee() view returns (uint96)",
  "function spotPrice() view returns (uint128)",
  "function delta() view returns (uint128)",
  "function getBuyNFTQuote(uint256 assetId, uint256 numItems) view returns (uint8 errorCode, uint256 newSpotPrice, uint256 newDelta, uint256 inputAmount, uint256 protocolFee, uint256 royaltyAmount)",
  "function getSellNFTQuote(uint256 assetId, uint256 numItems) view returns (uint8 errorCode, uint256 newSpotPrice, uint256 newDelta, uint256 outputAmount, uint256 protocolFee, uint256 royaltyAmount)",
]);
const FRIEND_KEY_ABI = parseAbi([
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function getBuyPriceAfterFee(uint256 id, uint256 amount) view returns (uint256)",
  "function getSellPriceAfterFee(uint256 id, uint256 amount) view returns (uint256)",
]);
const ERC20_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

type MonitorState = {
  consecutiveDivergentSamples: number;
  lastBlock: string | null;
  lastSampleAt: string | null;
};

type Config = {
  safe: Address;
  factory: Address;
  curve: Address;
  adapter: Address;
  router: Address;
  pair: Address;
  creatorCoin: Address;
  tokenId: bigint;
};

function envAddress(names: readonly string[], fallback?: Address): Address {
  const raw = names.map((name) => process.env[name]?.trim()).find(Boolean);
  if (!raw && fallback) return fallback;
  if (!raw || !isAddress(raw)) throw new Error(`${names[0]}_not_configured`);
  const address = getAddress(raw);
  if (address === ZERO_ADDRESS) throw new Error(`${names[0]}_not_configured`);
  return address;
}

function envPositiveBigInt(name: string, fallback: bigint): bigint {
  const raw = String(process.env[name] ?? fallback).trim();
  if (!/^\d+$/.test(raw) || BigInt(raw) <= 0n)
    throw new Error(`${name}_invalid`);
  return BigInt(raw);
}

function readConfig(): Config {
  return {
    safe: envAddress(["ALFACLUB_MARKET_ADMIN_SAFE"]),
    factory: envAddress([
      "SUDOSWAP_PAIR_FACTORY",
      "VITE_SUDOSWAP_PAIR_FACTORY",
    ]),
    curve: envAddress(["SUDOSWAP_XYK_CURVE", "VITE_SUDOSWAP_XYK_CURVE"]),
    adapter: envAddress([
      "ALFACLUB_SUDOSWAP_ADAPTER",
      "VITE_ALFACLUB_SUDOSWAP_ADAPTER",
    ]),
    router: envAddress([
      "ALFACLUB_UNIVERSAL_ROUTER",
      "VITE_ALFACLUB_UNIVERSAL_ROUTER",
    ]),
    pair: envAddress([
      "ALFACLUB_ROOM_1659_SUDOSWAP_PAIR",
      "VITE_ALFACLUB_ROOM_1659_SUDOSWAP_PAIR",
    ]),
    creatorCoin: envAddress(["ALFACLUB_LP_CREATOR_COIN"], DEFAULT_CREATOR_COIN),
    tokenId: envPositiveBigInt("ALFACLUB_LP_TOKEN_ID", DEFAULT_TOKEN_ID),
  };
}

function bpsDifference(left: bigint, right: bigint): bigint {
  if (right <= 0n) return 0n;
  const difference = left >= right ? left - right : right - left;
  return (difference * BPS) / right;
}

async function readState(path: string): Promise<MonitorState> {
  try {
    const parsed = JSON.parse(
      await readFile(path, "utf8"),
    ) as Partial<MonitorState>;
    return {
      consecutiveDivergentSamples: Math.max(
        0,
        Number(parsed.consecutiveDivergentSamples ?? 0),
      ),
      lastBlock: parsed.lastBlock ?? null,
      lastSampleAt: parsed.lastSampleAt ?? null,
    };
  } catch {
    return {
      consecutiveDivergentSamples: 0,
      lastBlock: null,
      lastSampleAt: null,
    };
  }
}

async function writeState(path: string, state: MonitorState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function sendAlert(webhookUrl: string, payload: unknown): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`alert_webhook_http_${response.status}`);
}

function requireAddress(
  actual: Address,
  expected: Address,
  error: string,
): void {
  if (getAddress(actual) !== getAddress(expected)) throw new Error(error);
}

async function main(): Promise<void> {
  const config = readConfig();
  const rpcUrl =
    process.env.BASE_RPC_URL?.trim() || "https://base-rpc.publicnode.com";
  const statePath = resolve(
    process.env.ALFACLUB_LP_MONITOR_STATE_PATH?.trim() ||
      ".cache/alfaclub-sudoswap-monitor-state.json",
  );
  const divergenceThresholdBps = envPositiveBigInt(
    "ALFACLUB_LP_DIVERGENCE_BPS",
    1_000n,
  );
  const sustainedSamples = Number(
    envPositiveBigInt("ALFACLUB_LP_DIVERGENCE_SUSTAINED_SAMPLES", 3n),
  );
  const minimumKeyInventory = envPositiveBigInt(
    "ALFACLUB_LP_MIN_KEY_RESERVE",
    3n,
  );
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) });

  const [
    blockNumber,
    safeBytecode,
    validPair,
    curveAllowed,
    adapterOwner,
    adapterFactory,
    adapterPermit2,
    adapterFriendKey,
    adapterCurve,
    adapterRouter,
    adapterMarket,
    routerAdapter,
    pairFactory,
    pairVariant,
    poolType,
    pairToken,
    pairNft,
    pairTokenId,
    pairCurve,
    fee,
    spotPrice,
    delta,
    buyQuote,
    sellQuote,
    creatorCoinBalance,
    keyBalance,
    coinDecimals,
    coinSymbol,
    primaryBuyUsdc,
    primarySellUsdc,
  ] = await Promise.all([
    client.getBlockNumber(),
    client.getBytecode({ address: config.safe }),
    client.readContract({
      address: config.factory,
      abi: FACTORY_ABI,
      functionName: "isValidPair",
      args: [config.pair],
    }),
    client.readContract({
      address: config.factory,
      abi: FACTORY_ABI,
      functionName: "bondingCurveAllowed",
      args: [config.curve],
    }),
    client.readContract({
      address: config.adapter,
      abi: ADAPTER_ABI,
      functionName: "owner",
    }),
    client.readContract({
      address: config.adapter,
      abi: ADAPTER_ABI,
      functionName: "factory",
    }),
    client.readContract({
      address: config.adapter,
      abi: ADAPTER_ABI,
      functionName: "permit2",
    }),
    client.readContract({
      address: config.adapter,
      abi: ADAPTER_ABI,
      functionName: "friendKey",
    }),
    client.readContract({
      address: config.adapter,
      abi: ADAPTER_ABI,
      functionName: "xykCurve",
    }),
    client.readContract({
      address: config.adapter,
      abi: ADAPTER_ABI,
      functionName: "universalRouter",
    }),
    client.readContract({
      address: config.adapter,
      abi: ADAPTER_ABI,
      functionName: "markets",
      args: [config.pair],
    }),
    client.readContract({
      address: config.router,
      abi: ROUTER_ABI,
      functionName: "SUDOSWAP_ADAPTER",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "factory",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "pairVariant",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "poolType",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "token",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "nft",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "nftId",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "bondingCurve",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "fee",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "spotPrice",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "delta",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "getBuyNFTQuote",
      args: [config.tokenId, 1n],
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "getSellNFTQuote",
      args: [config.tokenId, 1n],
    }),
    client.readContract({
      address: config.creatorCoin,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [config.pair],
    }),
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: "balanceOf",
      args: [config.pair, config.tokenId],
    }),
    client.readContract({
      address: config.creatorCoin,
      abi: ERC20_ABI,
      functionName: "decimals",
    }),
    client.readContract({
      address: config.creatorCoin,
      abi: ERC20_ABI,
      functionName: "symbol",
    }),
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: "getBuyPriceAfterFee",
      args: [config.tokenId, 1n],
    }),
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: "getSellPriceAfterFee",
      args: [config.tokenId, 1n],
    }),
  ]);

  if (!safeBytecode || safeBytecode === "0x")
    throw new Error("market_admin_safe_has_no_code");
  requireAddress(adapterOwner, config.safe, "adapter_owner_mismatch");
  if (!validPair) throw new Error("pair_not_factory_authenticated");
  if (!curveAllowed) throw new Error("xyk_curve_not_factory_allowlisted");
  requireAddress(adapterFactory, config.factory, "adapter_factory_mismatch");
  requireAddress(adapterPermit2, CANONICAL_PERMIT2, "adapter_permit2_mismatch");
  requireAddress(adapterFriendKey, FRIEND_KEY, "adapter_friend_key_mismatch");
  requireAddress(adapterCurve, config.curve, "adapter_curve_mismatch");
  requireAddress(adapterRouter, config.router, "adapter_router_mismatch");
  requireAddress(routerAdapter, config.adapter, "router_adapter_mismatch");
  if (!adapterMarket[2]) throw new Error("adapter_market_disabled");
  requireAddress(
    adapterMarket[0],
    config.creatorCoin,
    "adapter_market_creator_coin_mismatch",
  );
  if (adapterMarket[1] !== config.tokenId)
    throw new Error("adapter_market_token_id_mismatch");
  requireAddress(pairFactory, config.factory, "pair_factory_mismatch");
  if (pairVariant !== ERC1155_ERC20_VARIANT)
    throw new Error("pair_variant_mismatch");
  if (poolType !== TRADE_POOL_TYPE) throw new Error("pair_pool_type_mismatch");
  requireAddress(pairToken, config.creatorCoin, "pair_creator_coin_mismatch");
  requireAddress(pairNft, FRIEND_KEY, "pair_friend_key_mismatch");
  if (pairTokenId !== config.tokenId) throw new Error("pair_token_id_mismatch");
  requireAddress(pairCurve, config.curve, "pair_curve_mismatch");
  if (fee !== TRADING_PAIR_FEE) throw new Error("pair_fee_not_690_bps");
  if (buyQuote[0] !== 0 || sellQuote[0] !== 0)
    throw new Error("one_key_quote_unavailable");
  if (buyQuote[3] <= 0n || sellQuote[3] <= 0n)
    throw new Error("one_key_quote_invalid");
  if (keyBalance < 1n) throw new Error("pair_has_no_buy_inventory");
  if (creatorCoinBalance < sellQuote[3] + sellQuote[4] + sellQuote[5]) {
    throw new Error("pair_has_insufficient_sell_inventory");
  }

  const creatorPriceInput =
    process.env.ALFACLUB_LP_CREATOR_PRICE_USDC?.trim() ?? "";
  const creatorPriceUsdc = creatorPriceInput
    ? parseUnits(creatorPriceInput, 18)
    : null;
  if (creatorPriceUsdc !== null && creatorPriceUsdc <= 0n) {
    throw new Error("ALFACLUB_LP_CREATOR_PRICE_USDC_invalid");
  }
  const coinScale = 10n ** BigInt(coinDecimals);
  const primaryBuyCoin = creatorPriceUsdc
    ? (primaryBuyUsdc * coinScale * 10n ** 18n) / (10n ** 6n * creatorPriceUsdc)
    : null;
  const primarySellCoin = creatorPriceUsdc
    ? (primarySellUsdc * coinScale * 10n ** 18n) /
      (10n ** 6n * creatorPriceUsdc)
    : null;
  const buyDivergenceBps = primaryBuyCoin
    ? bpsDifference(buyQuote[3], primaryBuyCoin)
    : null;
  const sellDivergenceBps = primarySellCoin
    ? bpsDifference(sellQuote[3], primarySellCoin)
    : null;
  const lowInventory = keyBalance < minimumKeyInventory;
  const priceDivergent =
    (buyDivergenceBps !== null && buyDivergenceBps >= divergenceThresholdBps) ||
    (sellDivergenceBps !== null && sellDivergenceBps >= divergenceThresholdBps);
  const divergent = lowInventory || priceDivergent;

  const previous = await readState(statePath);
  const consecutiveDivergentSamples = divergent
    ? previous.consecutiveDivergentSamples + 1
    : 0;
  const state: MonitorState = {
    consecutiveDivergentSamples,
    lastBlock: blockNumber.toString(),
    lastSampleAt: new Date().toISOString(),
  };
  await writeState(statePath, state);

  const virtualSpot = delta > 0n ? spotPrice / delta : 0n;
  const report = {
    ok: !divergent,
    alert: divergent && consecutiveDivergentSamples >= sustainedSamples,
    blockNumber: blockNumber.toString(),
    market: {
      factory: config.factory,
      adapter: config.adapter,
      router: config.router,
      pair: config.pair,
      creatorCoin: config.creatorCoin,
      friendKey: FRIEND_KEY,
      tokenId: config.tokenId.toString(),
      feeBps: 690,
    },
    inventory: {
      creatorCoin: formatUnits(creatorCoinBalance, coinDecimals),
      creatorCoinSymbol: coinSymbol,
      keys: keyBalance.toString(),
      minimumKeys: minimumKeyInventory.toString(),
    },
    virtualReserves: {
      creatorCoin: formatUnits(spotPrice, coinDecimals),
      keys: delta.toString(),
      creatorCoinPerKey: formatUnits(virtualSpot, coinDecimals),
    },
    oneKey: {
      sudoswapBuyCreatorCoin: formatUnits(buyQuote[3], coinDecimals),
      sudoswapSellCreatorCoin: formatUnits(sellQuote[3], coinDecimals),
      primaryBuyCreatorCoin:
        primaryBuyCoin === null
          ? null
          : formatUnits(primaryBuyCoin, coinDecimals),
      primarySellCreatorCoin:
        primarySellCoin === null
          ? null
          : formatUnits(primarySellCoin, coinDecimals),
      buyDivergenceBps: buyDivergenceBps?.toString() ?? null,
      sellDivergenceBps: sellDivergenceBps?.toString() ?? null,
      creatorCoinPriceUsdc: creatorPriceInput || null,
    },
    sustained: {
      samples: consecutiveDivergentSamples,
      threshold: sustainedSamples,
    },
  };
  console.log(JSON.stringify(report, null, 2));

  const webhookUrl = process.env.ALFACLUB_LP_ALERT_WEBHOOK_URL?.trim();
  if (report.alert && webhookUrl) await sendAlert(webhookUrl, report);
  if (report.alert) process.exitCode = 2;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
