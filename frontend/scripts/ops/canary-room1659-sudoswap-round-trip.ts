#!/usr/bin/env tsx

import {
  createPublicClient,
  erc20Abi,
  getAddress,
  http,
  isAddress,
  parseAbi,
  parseEventLogs,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";

import {
  ROOM_1659_CREATOR_COIN,
  ROOM_1659_FRIEND_KEY,
  ROOM_1659_PAIR_FEE,
  ROOM_1659_PAIR_VARIANT,
  ROOM_1659_POOL_TYPE,
  ROOM_1659_TOKEN_ID,
} from "../../server/_lib/alfaclub/room1659SudoswapPairPlan.js";
import {
  readCanonicalCswAddressEnv,
  readCanonicalCswOwnerIndexEnv,
  readCanonicalCswPrivyWalletIdEnv,
} from "../../server/_lib/wallet/canonicalCswEnv.js";
import {
  resolvePrivyCoinbaseSmartWalletOwnerContext,
  sendPrivyCoinbaseSmartWalletUserOperation,
} from "../../server/_lib/wallet/privyCoinbaseSmartWallet.js";
import { CANONICAL_CSW_ADDRESS } from "../../src/wallet/canonicalWalletPolicy.js";
import {
  addSlippageBps,
  buildAlfaClubSudoswapRoundTripCalls,
  subtractSlippageBps,
} from "../../src/lib/alfaclub/sudoswapRouter.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const OFFICIAL_FACTORY = getAddress(
  "0x605145D263482684590f630E9e581B21E4938eb8",
);
const OFFICIAL_XYK_CURVE = getAddress(
  "0xd0A2f4ae5E816ec09374c67F6532063B60dE037B",
);
const MARKET_ADMIN_SAFE = getAddress(
  "0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3",
);
const ALFACLUB_ADAPTER = getAddress(
  "0x961b113FF5E3547e8198758900b8f4Fa552A3Fe5",
);
const ALFACLUB_ROUTER = getAddress(
  "0x14c0e8840A3B7caE49EbdA899C7101A827598e9f",
);
const PERMIT2 = getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3");
const KEY_AMOUNT = 1n;
const DEFAULT_SLIPPAGE_BPS = 100n;
const MAX_SLIPPAGE_BPS = 500n;
const DEADLINE_SECONDS = 15n * 60n;

const FACTORY_ABI = parseAbi([
  "function isValidPair(address pair) view returns (bool)",
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
const ADAPTER_EVENT_ABI = parseAbi([
  "event KeysBought(address indexed pair, address indexed payer, address indexed recipient, uint256 keyAmount, uint256 creatorCoinIn)",
  "event KeysSold(address indexed pair, address indexed payer, address indexed recipient, uint256 keyAmount, uint256 creatorCoinOut)",
]);
const ROUTER_ABI = parseAbi([
  "function SUDOSWAP_ADAPTER() view returns (address)",
]);
const PAIR_ABI = parseAbi([
  "function owner() view returns (address)",
  "function factory() view returns (address)",
  "function pairVariant() pure returns (uint8)",
  "function poolType() view returns (uint8)",
  "function token() view returns (address)",
  "function nft() view returns (address)",
  "function nftId() pure returns (uint256)",
  "function bondingCurve() view returns (address)",
  "function fee() view returns (uint96)",
  "function delta() view returns (uint128)",
  "function spotPrice() view returns (uint128)",
  "function getBuyNFTQuote(uint256 assetId, uint256 numItems) view returns (uint8 errorCode, uint256 newSpotPrice, uint256 newDelta, uint256 inputAmount, uint256 protocolFee, uint256 royaltyAmount)",
  "function getSellNFTQuote(uint256 assetId, uint256 numItems) view returns (uint8 errorCode, uint256 newSpotPrice, uint256 newDelta, uint256 outputAmount, uint256 protocolFee, uint256 royaltyAmount)",
]);
const FRIEND_KEY_ABI = parseAbi([
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function isApprovedForAll(address account, address operator) view returns (bool)",
]);
const PERMIT2_ABI = parseAbi([
  "function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
]);

type Mode = "dry-run" | "apply";

type Config = {
  factory: Address;
  curve: Address;
  safe: Address;
  adapter: Address;
  router: Address;
  permit2: Address;
  pair: Address;
  canonicalCsw: Address;
  slippageBps: bigint;
};

type Quote = {
  errorCode: number;
  newSpotPrice: bigint;
  newDelta: bigint;
  amount: bigint;
  protocolFee: bigint;
  royaltyAmount: bigint;
};

type Snapshot = {
  coreHasCode: boolean;
  validPair: boolean;
  pairOwner: Address;
  pairFactory: Address;
  pairVariant: number;
  pairPoolType: number;
  pairToken: Address;
  pairNft: Address;
  pairTokenId: bigint;
  pairCurve: Address;
  pairFee: bigint;
  pairDelta: bigint;
  pairSpotPrice: bigint;
  adapterOwner: Address;
  adapterFactory: Address;
  adapterPermit2: Address;
  adapterFriendKey: Address;
  adapterCurve: Address;
  adapterRouter: Address;
  routerAdapter: Address;
  marketCreatorCoin: Address;
  marketTokenId: bigint;
  marketAllowed: boolean;
  canonicalKeyBalance: bigint;
  canonicalCreatorCoinBalance: bigint;
  pairKeyBalance: bigint;
  pairCreatorCoinBalance: bigint;
  adapterKeyBalance: bigint;
  adapterCreatorCoinBalance: bigint;
  erc20AllowanceToPermit2: bigint;
  permit2AllowanceToAdapter: bigint;
  permit2AllowanceExpiration: bigint;
  keyApprovedForAdapter: boolean;
  buyQuote: Quote;
  sellQuote: Quote;
};

type AdapterSwapEvent = {
  eventName: "KeysBought" | "KeysSold";
  address: Address;
  args: {
    pair: Address;
    payer: Address;
    recipient: Address;
    keyAmount: bigint;
    creatorCoinIn?: bigint;
    creatorCoinOut?: bigint;
  };
};

function readMode(): Mode {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  if (Number(dryRun) + Number(apply) !== 1) {
    throw new Error("Pass exactly one of --dry-run or --apply");
  }
  return apply ? "apply" : "dry-run";
}

function envAddress(names: readonly string[], fallback?: Address): Address {
  const raw = names.map((name) => process.env[name]?.trim()).find(Boolean);
  if (!raw && fallback) return fallback;
  if (!raw || !isAddress(raw)) throw new Error(`${names[0]}_not_configured`);
  const value = getAddress(raw);
  if (value === ZERO_ADDRESS) throw new Error(`${names[0]}_not_configured`);
  return value;
}

function readCanonicalCsw(): Address {
  const pinned = getAddress(CANONICAL_CSW_ADDRESS);
  const configured = readCanonicalCswAddressEnv().trim();
  if (!configured) return pinned;
  if (!isAddress(configured) || getAddress(configured) !== pinned) {
    throw new Error("CANONICAL_CSW_ADDRESS_policy_mismatch");
  }
  return pinned;
}

function readSlippageBps(): bigint {
  const raw = String(
    process.env.ALFACLUB_SUDOSWAP_CANARY_SLIPPAGE_BPS ?? DEFAULT_SLIPPAGE_BPS,
  ).trim();
  if (!/^\d+$/.test(raw))
    throw new Error("ALFACLUB_SUDOSWAP_CANARY_SLIPPAGE_BPS_invalid");
  const value = BigInt(raw);
  if (value > MAX_SLIPPAGE_BPS) {
    throw new Error("ALFACLUB_SUDOSWAP_CANARY_SLIPPAGE_BPS_too_large");
  }
  return value;
}

function readConfig(): Config {
  return {
    factory: envAddress(
      ["SUDOSWAP_PAIR_FACTORY", "VITE_SUDOSWAP_PAIR_FACTORY"],
      OFFICIAL_FACTORY,
    ),
    curve: envAddress(
      ["SUDOSWAP_XYK_CURVE", "VITE_SUDOSWAP_XYK_CURVE"],
      OFFICIAL_XYK_CURVE,
    ),
    safe: envAddress(["ALFACLUB_MARKET_ADMIN_SAFE"], MARKET_ADMIN_SAFE),
    adapter: envAddress(
      ["ALFACLUB_SUDOSWAP_ADAPTER", "VITE_ALFACLUB_SUDOSWAP_ADAPTER"],
      ALFACLUB_ADAPTER,
    ),
    router: envAddress(
      ["ALFACLUB_UNIVERSAL_ROUTER", "VITE_ALFACLUB_UNIVERSAL_ROUTER"],
      ALFACLUB_ROUTER,
    ),
    permit2: envAddress(["PERMIT2_ADDRESS", "VITE_PERMIT2_ADDRESS"], PERMIT2),
    pair: envAddress([
      "ALFACLUB_ROOM_1659_SUDOSWAP_PAIR",
      "VITE_ALFACLUB_ROOM_1659_SUDOSWAP_PAIR",
    ]),
    canonicalCsw: readCanonicalCsw(),
    slippageBps: readSlippageBps(),
  };
}

function readRpcUrl(): string {
  return (
    String(process.env.BASE_RPC_URL ?? "").trim() ||
    "https://base-rpc.publicnode.com"
  );
}

function createBasePublicClient() {
  return createPublicClient({ chain: base, transport: http(readRpcUrl()) });
}

type BasePublicClient = ReturnType<typeof createBasePublicClient>;

function readBundlerUrl(): string {
  const candidates = [
    process.env.CDP_PAYMASTER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT,
  ];
  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (value) return value;
  }
  throw new Error("Bundler URL missing (CDP_PAYMASTER_URL)");
}

function normalizeQuote(
  value: readonly [number, bigint, bigint, bigint, bigint, bigint],
): Quote {
  return {
    errorCode: value[0],
    newSpotPrice: value[1],
    newDelta: value[2],
    amount: value[3],
    protocolFee: value[4],
    royaltyAmount: value[5],
  };
}

function json(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
}

function printableCalls(
  calls: ReturnType<typeof buildAlfaClubSudoswapRoundTripCalls>,
) {
  return calls.map((call, index) => ({
    index,
    to: call.to,
    from: call.from,
    value: call.value,
    data: call.data,
  }));
}

async function readSnapshot(
  client: BasePublicClient,
  config: Config,
): Promise<Snapshot> {
  const [
    factoryCode,
    curveCode,
    safeCode,
    adapterCode,
    routerCode,
    permit2Code,
    pairCode,
    canonicalCode,
    validPair,
    pairOwner,
    pairFactory,
    pairVariant,
    pairPoolType,
    pairToken,
    pairNft,
    pairTokenId,
    pairCurve,
    pairFee,
    pairDelta,
    pairSpotPrice,
    adapterOwner,
    adapterFactory,
    adapterPermit2,
    adapterFriendKey,
    adapterCurve,
    adapterRouter,
    routerAdapter,
    market,
    canonicalKeyBalance,
    canonicalCreatorCoinBalance,
    pairKeyBalance,
    pairCreatorCoinBalance,
    adapterKeyBalance,
    adapterCreatorCoinBalance,
    erc20AllowanceToPermit2,
    permit2Allowance,
    keyApprovedForAdapter,
    buyQuote,
    sellQuote,
  ] = await Promise.all([
    client.getBytecode({ address: config.factory }),
    client.getBytecode({ address: config.curve }),
    client.getBytecode({ address: config.safe }),
    client.getBytecode({ address: config.adapter }),
    client.getBytecode({ address: config.router }),
    client.getBytecode({ address: config.permit2 }),
    client.getBytecode({ address: config.pair }),
    client.getBytecode({ address: config.canonicalCsw }),
    client.readContract({
      address: config.factory,
      abi: FACTORY_ABI,
      functionName: "isValidPair",
      args: [config.pair],
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "owner",
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
      functionName: "delta",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "spotPrice",
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
      address: config.router,
      abi: ROUTER_ABI,
      functionName: "SUDOSWAP_ADAPTER",
    }),
    client.readContract({
      address: config.adapter,
      abi: ADAPTER_ABI,
      functionName: "markets",
      args: [config.pair],
    }),
    client.readContract({
      address: ROOM_1659_FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: "balanceOf",
      args: [config.canonicalCsw, ROOM_1659_TOKEN_ID],
    }),
    client.readContract({
      address: ROOM_1659_CREATOR_COIN,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [config.canonicalCsw],
    }),
    client.readContract({
      address: ROOM_1659_FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: "balanceOf",
      args: [config.pair, ROOM_1659_TOKEN_ID],
    }),
    client.readContract({
      address: ROOM_1659_CREATOR_COIN,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [config.pair],
    }),
    client.readContract({
      address: ROOM_1659_FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: "balanceOf",
      args: [config.adapter, ROOM_1659_TOKEN_ID],
    }),
    client.readContract({
      address: ROOM_1659_CREATOR_COIN,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [config.adapter],
    }),
    client.readContract({
      address: ROOM_1659_CREATOR_COIN,
      abi: erc20Abi,
      functionName: "allowance",
      args: [config.canonicalCsw, config.permit2],
    }),
    client.readContract({
      address: config.permit2,
      abi: PERMIT2_ABI,
      functionName: "allowance",
      args: [config.canonicalCsw, ROOM_1659_CREATOR_COIN, config.adapter],
    }),
    client.readContract({
      address: ROOM_1659_FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: "isApprovedForAll",
      args: [config.canonicalCsw, config.adapter],
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "getBuyNFTQuote",
      args: [ROOM_1659_TOKEN_ID, KEY_AMOUNT],
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "getSellNFTQuote",
      args: [ROOM_1659_TOKEN_ID, KEY_AMOUNT],
    }),
  ]);

  const codeValues = [
    factoryCode,
    curveCode,
    safeCode,
    adapterCode,
    routerCode,
    permit2Code,
    pairCode,
    canonicalCode,
  ];
  return {
    coreHasCode: codeValues.every((code) => Boolean(code && code !== "0x")),
    validPair,
    pairOwner: getAddress(pairOwner),
    pairFactory: getAddress(pairFactory),
    pairVariant,
    pairPoolType,
    pairToken: getAddress(pairToken),
    pairNft: getAddress(pairNft),
    pairTokenId,
    pairCurve: getAddress(pairCurve),
    pairFee,
    pairDelta,
    pairSpotPrice,
    adapterOwner: getAddress(adapterOwner),
    adapterFactory: getAddress(adapterFactory),
    adapterPermit2: getAddress(adapterPermit2),
    adapterFriendKey: getAddress(adapterFriendKey),
    adapterCurve: getAddress(adapterCurve),
    adapterRouter: getAddress(adapterRouter),
    routerAdapter: getAddress(routerAdapter),
    marketCreatorCoin: getAddress(market[0]),
    marketTokenId: market[1],
    marketAllowed: market[2],
    canonicalKeyBalance,
    canonicalCreatorCoinBalance,
    pairKeyBalance,
    pairCreatorCoinBalance,
    adapterKeyBalance,
    adapterCreatorCoinBalance,
    erc20AllowanceToPermit2,
    permit2AllowanceToAdapter: permit2Allowance[0],
    permit2AllowanceExpiration: BigInt(permit2Allowance[1]),
    keyApprovedForAdapter,
    buyQuote: normalizeQuote(buyQuote),
    sellQuote: normalizeQuote(sellQuote),
  };
}

function assertStaticInvariants(config: Config, snapshot: Snapshot): void {
  if (!snapshot.coreHasCode) throw new Error("canary_dependency_has_no_code");
  if (!snapshot.validPair) throw new Error("pair_not_factory_authenticated");
  if (snapshot.pairOwner !== config.safe)
    throw new Error("pair_owner_mismatch");
  if (snapshot.pairFactory !== config.factory)
    throw new Error("pair_factory_mismatch");
  if (snapshot.pairVariant !== ROOM_1659_PAIR_VARIANT)
    throw new Error("pair_variant_mismatch");
  if (snapshot.pairPoolType !== ROOM_1659_POOL_TYPE)
    throw new Error("pair_pool_type_mismatch");
  if (snapshot.pairToken !== ROOM_1659_CREATOR_COIN)
    throw new Error("pair_creator_coin_mismatch");
  if (snapshot.pairNft !== ROOM_1659_FRIEND_KEY)
    throw new Error("pair_friend_key_mismatch");
  if (snapshot.pairTokenId !== ROOM_1659_TOKEN_ID)
    throw new Error("pair_token_id_mismatch");
  if (snapshot.pairCurve !== config.curve)
    throw new Error("pair_curve_mismatch");
  if (snapshot.pairFee !== ROOM_1659_PAIR_FEE)
    throw new Error("pair_fee_mismatch");
  if (snapshot.adapterOwner !== config.safe)
    throw new Error("adapter_owner_mismatch");
  if (snapshot.adapterFactory !== config.factory)
    throw new Error("adapter_factory_mismatch");
  if (snapshot.adapterPermit2 !== config.permit2)
    throw new Error("adapter_permit2_mismatch");
  if (snapshot.adapterFriendKey !== ROOM_1659_FRIEND_KEY)
    throw new Error("adapter_friend_key_mismatch");
  if (snapshot.adapterCurve !== config.curve)
    throw new Error("adapter_curve_mismatch");
  if (snapshot.adapterRouter !== config.router)
    throw new Error("adapter_router_mismatch");
  if (snapshot.routerAdapter !== config.adapter)
    throw new Error("router_adapter_mismatch");
  if (!snapshot.marketAllowed) throw new Error("adapter_market_not_enabled");
  if (snapshot.marketCreatorCoin !== ROOM_1659_CREATOR_COIN)
    throw new Error("adapter_market_coin_mismatch");
  if (snapshot.marketTokenId !== ROOM_1659_TOKEN_ID)
    throw new Error("adapter_market_token_id_mismatch");
  if (snapshot.buyQuote.errorCode !== 0 || snapshot.buyQuote.amount <= 0n)
    throw new Error("buy_quote_invalid");
  if (snapshot.sellQuote.errorCode !== 0 || snapshot.sellQuote.amount <= 0n)
    throw new Error("sell_quote_invalid");
  if (snapshot.pairKeyBalance < KEY_AMOUNT)
    throw new Error("pair_key_inventory_insufficient");
  const sellFunding =
    snapshot.sellQuote.amount +
    snapshot.sellQuote.protocolFee +
    snapshot.sellQuote.royaltyAmount;
  if (snapshot.pairCreatorCoinBalance < sellFunding)
    throw new Error("pair_creator_coin_inventory_insufficient");
  if (
    snapshot.adapterKeyBalance !== 0n ||
    snapshot.adapterCreatorCoinBalance !== 0n
  ) {
    throw new Error("adapter_has_preexisting_asset_residue");
  }
}

function assertApprovalStateRestored(before: Snapshot, after: Snapshot): void {
  if (after.erc20AllowanceToPermit2 !== before.erc20AllowanceToPermit2) {
    throw new Error("erc20_permit2_allowance_not_restored");
  }
  if (after.permit2AllowanceToAdapter !== before.permit2AllowanceToAdapter) {
    throw new Error("permit2_adapter_allowance_not_restored");
  }
  // Permit2 stores expiration=block.timestamp when approve(..., 0) is used.
  // Therefore an initially empty (0, 0) allowance is restored semantically by
  // amount=0, while its stored expiration is necessarily normalized to the
  // cleanup block timestamp.
  const initialPermit2AllowanceWasEmpty =
    before.permit2AllowanceToAdapter === 0n &&
    before.permit2AllowanceExpiration === 0n;
  if (
    !initialPermit2AllowanceWasEmpty &&
    after.permit2AllowanceExpiration !== before.permit2AllowanceExpiration
  ) {
    throw new Error("permit2_adapter_allowance_not_restored");
  }
  if (after.keyApprovedForAdapter !== before.keyApprovedForAdapter) {
    throw new Error("friend_key_adapter_approval_not_restored");
  }
}

function assertRoundTripPostconditions(params: {
  config: Config;
  before: Snapshot;
  after: Snapshot;
  buyEvent: AdapterSwapEvent;
  sellEvent: AdapterSwapEvent;
  buyLimit: bigint;
  sellLimit: bigint;
}): void {
  const { config, before, after, buyEvent, sellEvent, buyLimit, sellLimit } =
    params;
  assertStaticInvariants(config, after);
  assertApprovalStateRestored(before, after);
  if (after.canonicalKeyBalance !== before.canonicalKeyBalance)
    throw new Error("canonical_key_balance_not_restored");
  if (after.pairKeyBalance !== before.pairKeyBalance)
    throw new Error("pair_key_balance_not_restored");
  if (after.pairDelta !== before.pairDelta)
    throw new Error("pair_virtual_key_reserve_not_restored");
  if (after.pairSpotPrice !== before.pairSpotPrice)
    throw new Error("pair_virtual_coin_reserve_not_restored");
  if (
    after.buyQuote.amount !== before.buyQuote.amount ||
    after.sellQuote.amount !== before.sellQuote.amount
  ) {
    throw new Error("pair_quotes_not_restored");
  }
  if (after.adapterKeyBalance !== before.adapterKeyBalance)
    throw new Error("adapter_key_residue");
  if (after.adapterCreatorCoinBalance !== before.adapterCreatorCoinBalance)
    throw new Error("adapter_coin_residue");

  for (const event of [buyEvent, sellEvent]) {
    if (getAddress(event.args.pair) !== config.pair)
      throw new Error("canary_event_pair_mismatch");
    if (getAddress(event.args.payer) !== config.canonicalCsw)
      throw new Error("canary_event_payer_mismatch");
    if (getAddress(event.args.recipient) !== config.canonicalCsw)
      throw new Error("canary_event_recipient_mismatch");
    if (event.args.keyAmount !== KEY_AMOUNT)
      throw new Error("canary_event_key_amount_mismatch");
  }

  const creatorCoinIn = buyEvent.args.creatorCoinIn;
  const creatorCoinOut = sellEvent.args.creatorCoinOut;
  if (
    creatorCoinIn === undefined ||
    creatorCoinIn <= 0n ||
    creatorCoinIn > buyLimit
  ) {
    throw new Error("canary_buy_event_amount_invalid");
  }
  if (creatorCoinOut === undefined || creatorCoinOut < sellLimit) {
    throw new Error("canary_sell_event_amount_invalid");
  }
  if (creatorCoinIn <= creatorCoinOut)
    throw new Error("canary_round_trip_cost_invalid");
  const actualCost = creatorCoinIn - creatorCoinOut;
  if (
    before.canonicalCreatorCoinBalance - after.canonicalCreatorCoinBalance !==
    actualCost
  ) {
    throw new Error("canonical_creator_coin_delta_mismatch");
  }
  if (actualCost > buyLimit - sellLimit)
    throw new Error("canary_round_trip_cost_exceeds_limits");
}

async function resolveOwnerContext(
  client: BasePublicClient,
  canonicalCsw: Address,
) {
  const walletId = readCanonicalCswPrivyWalletIdEnv();
  if (!walletId) throw new Error("CANONICAL_CSW_PRIVY_WALLET_ID_missing");
  const ownerIndexRaw = readCanonicalCswOwnerIndexEnv();
  const configuredOwnerIndex = ownerIndexRaw
    ? Number(ownerIndexRaw)
    : Number.NaN;
  const context = await resolvePrivyCoinbaseSmartWalletOwnerContext({
    publicClient: client,
    walletId,
    smartWallet: canonicalCsw,
    expectedOwnerAddress: null,
    configuredOwnerIndex: Number.isSafeInteger(configuredOwnerIndex)
      ? configuredOwnerIndex
      : null,
    allowConfiguredOwnerIndexFallback: true,
    maxScan: 512,
  });
  return { walletId, ...context };
}

function selectSwapEvents(
  receiptLogs: readonly unknown[],
  config: Config,
): {
  buyEvent: AdapterSwapEvent;
  sellEvent: AdapterSwapEvent;
} {
  const parsed = parseEventLogs({
    abi: ADAPTER_EVENT_ABI,
    logs: receiptLogs as Parameters<typeof parseEventLogs>[0]["logs"],
    strict: true,
  }).filter(
    (event) => getAddress(event.address) === config.adapter,
  ) as unknown as AdapterSwapEvent[];
  const buys = parsed.filter((event) => event.eventName === "KeysBought");
  const sells = parsed.filter((event) => event.eventName === "KeysSold");
  if (buys.length !== 1 || sells.length !== 1)
    throw new Error("expected_exactly_one_buy_and_sell_event");
  return { buyEvent: buys[0]!, sellEvent: sells[0]! };
}

async function main(): Promise<void> {
  const mode = readMode();
  const config = readConfig();
  const client = createBasePublicClient();
  const before = await readSnapshot(client, config);
  assertStaticInvariants(config, before);

  const buyLimit = addSlippageBps(before.buyQuote.amount, config.slippageBps);
  const sellLimit = subtractSlippageBps(
    before.sellQuote.amount,
    config.slippageBps,
  );
  if (buyLimit <= 0n || sellLimit <= 0n || buyLimit <= sellLimit)
    throw new Error("canary_limits_invalid");
  if (before.canonicalCreatorCoinBalance < buyLimit)
    throw new Error("canonical_creator_coin_balance_insufficient");

  const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SECONDS;
  const calls = buildAlfaClubSudoswapRoundTripCalls({
    router: config.router,
    adapter: config.adapter,
    permit2: config.permit2,
    friendKey: ROOM_1659_FRIEND_KEY,
    creatorCoin: ROOM_1659_CREATOR_COIN,
    pair: config.pair,
    sender: config.canonicalCsw,
    keyAmount: KEY_AMOUNT,
    buyLimit,
    sellLimit,
    deadline,
    erc20AllowanceToPermit2: before.erc20AllowanceToPermit2,
    permit2AllowanceToAdapter: {
      amount: before.permit2AllowanceToAdapter,
      expiration: before.permit2AllowanceExpiration,
    },
    keyApprovedForAdapter: before.keyApprovedForAdapter,
  });

  console.log(
    json({
      mode,
      chainId: base.id,
      config,
      quoteBlockState: {
        pairDelta: before.pairDelta,
        pairSpotPrice: before.pairSpotPrice,
        buyQuote: before.buyQuote,
        sellQuote: before.sellQuote,
        buyLimit,
        sellLimit,
        deadline,
      },
      balances: {
        canonicalKeys: before.canonicalKeyBalance,
        canonicalCreatorCoin: before.canonicalCreatorCoinBalance,
        pairKeys: before.pairKeyBalance,
        pairCreatorCoin: before.pairCreatorCoinBalance,
      },
      calls: printableCalls(calls),
    }),
  );

  if (mode === "dry-run") {
    console.log(
      "[room1659-canary] dry-run complete; no UserOperation was signed or submitted.",
    );
    return;
  }

  const ownerContext = await resolveOwnerContext(client, config.canonicalCsw);
  console.log(
    `[room1659-canary] canonical CSW owner resolved address=${ownerContext.ownerAddress} index=${ownerContext.ownerIndex}`,
  );
  const result = await sendPrivyCoinbaseSmartWalletUserOperation({
    publicClient: client,
    bundlerUrl: readBundlerUrl(),
    walletId: ownerContext.walletId,
    smartWallet: config.canonicalCsw,
    ownerAddress: ownerContext.ownerAddress,
    ownerIndex: ownerContext.ownerIndex,
    calls: calls.map((call) => ({
      to: call.to,
      value: 0n,
      data: call.data as Hex,
    })),
    // Per-call eth_call simulation cannot model approvals and the buy->sell
    // state dependency. The bundler still simulates the complete UserOp.
    simulate: false,
  });
  const receipt = await client.getTransactionReceipt({ hash: result.txHash });
  if (receipt.status !== "success")
    throw new Error("canary_transaction_reverted");
  const { buyEvent, sellEvent } = selectSwapEvents(receipt.logs, config);
  const after = await readSnapshot(client, config);
  assertRoundTripPostconditions({
    config,
    before,
    after,
    buyEvent,
    sellEvent,
    buyLimit,
    sellLimit,
  });

  console.log(
    json({
      completed: true,
      pair: config.pair,
      userOpHash: result.userOpHash,
      transactionHash: result.txHash,
      buy: buyEvent.args,
      sell: sellEvent.args,
      roundTripCost:
        buyEvent.args.creatorCoinIn! - sellEvent.args.creatorCoinOut!,
      approvalStateRestored: true,
      keyAndCurveStateRestored: true,
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[room1659-canary] failed: ${message}`);
  process.exitCode = 1;
});
