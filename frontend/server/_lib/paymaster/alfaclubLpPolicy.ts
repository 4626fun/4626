import {
  decodeAbiParameters,
  decodeFunctionData,
  encodeAbiParameters,
  getAddress,
  isAddress,
  parseAbi,
  parseAbiParameters,
  toFunctionSelector,
  type Address,
  type Hex,
} from "viem";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const MSG_SENDER_RECIPIENT =
  "0x0000000000000000000000000000000000000001" as Address;
const CANONICAL_PERMIT2 = getAddress(
  "0x000000000022D473030F116dDEE9F6B43aC78BA3",
);
const BASE_WETH = getAddress(
  "0x4200000000000000000000000000000000000006",
);
const ZORA_BASE_UNIVERSAL_ROUTER = getAddress(
  "0x6ff5693b99212da76ad316178a184ab56d299b43",
);
const ALFACLUB_SUDOSWAP_BUY_COMMAND = 0x41;
const ALFACLUB_SUDOSWAP_SELL_COMMAND = 0x42;

export const ALFACLUB_FRIEND_KEY = getAddress(
  "0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F",
);
export const ROOM_1659_CREATOR_COIN = getAddress(
  "0x5b674196812451b7cec024fe9d22d2c0b172fa75",
);
export const ROOM_1659_TOKEN_ID = 1659n;
export const ROOM_1659_TRADING_PAIR_FEE = 69_000_000_000_000_000n;

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);
const ERC1155_ABI = parseAbi([
  "function setApprovalForAll(address operator, bool approved)",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
]);
const SUDOSWAP_ERC1155_ERC20_PAIR_ABI = parseAbi([
  "function factory() view returns (address)",
  "function pairVariant() pure returns (uint8)",
  "function poolType() view returns (uint8)",
  "function token() view returns (address)",
  "function nft() view returns (address)",
  "function nftId() pure returns (uint256)",
  "function bondingCurve() view returns (address)",
  "function fee() view returns (uint96)",
  "function getBuyNFTQuote(uint256 assetId, uint256 numItems) view returns (uint8 errorCode, uint256 newSpotPrice, uint256 newDelta, uint256 inputAmount, uint256 protocolFee, uint256 royaltyAmount)",
  "function getSellNFTQuote(uint256 assetId, uint256 numItems) view returns (uint8 errorCode, uint256 newSpotPrice, uint256 newDelta, uint256 outputAmount, uint256 protocolFee, uint256 royaltyAmount)",
]);
const SUDOSWAP_PAIR_FACTORY_ABI = parseAbi([
  "function isValidPair(address pair) view returns (bool)",
  "function routerStatus(address router) view returns (bool allowed, bool wasEverTouched)",
]);
const ALFACLUB_SUDOSWAP_ADAPTER_ABI = parseAbi([
  "function factory() view returns (address)",
  "function permit2() view returns (address)",
  "function friendKey() view returns (address)",
  "function xykCurve() view returns (address)",
  "function universalRouter() view returns (address)",
  "function markets(address pair) view returns (address creatorCoin, uint256 tokenId, bool allowed)",
]);
export const ALFACLUB_SPONSORED_ROUTER_ABI = parseAbi([
  "function execute(bytes commands, bytes[] inputs, uint256 deadline) payable",
  "function SUDOSWAP_ADAPTER() view returns (address)",
]);
const PERMIT2_ALLOWANCE_TRANSFER_ABI = parseAbi([
  "function approve(address token, address spender, uint160 amount, uint48 expiration)",
]);
const SUDOSWAP_INPUT_PARAMETERS = parseAbiParameters(
  "address pair, address recipient, uint256 keyAmount, uint256 limit, bool payerIsUser",
);

const EXECUTE_SELECTOR = toFunctionSelector("execute(bytes,bytes[],uint256)");
const ZORA_EXECUTE_SELECTOR = "0x24856bc3";
const WETH_DEPOSIT_SELECTOR = "0xd0e30db0";
const APPROVE_SELECTOR = toFunctionSelector("approve(address,uint256)");
const PERMIT2_APPROVE_SELECTOR = toFunctionSelector(
  "approve(address,address,uint160,uint48)",
);
const SET_APPROVAL_FOR_ALL_SELECTOR = toFunctionSelector(
  "setApprovalForAll(address,bool)",
);

function decodeAlfaClubSudoswapInput(input: Hex): {
  pair: Address;
  recipient: Address;
  keyAmount: bigint;
  limit: bigint;
  payerIsUser: boolean;
} {
  if ((input.length - 2) / 2 !== 160)
    throw new Error("alfaclub_sudoswap_input_length_invalid");
  const decoded = decodeAbiParameters(SUDOSWAP_INPUT_PARAMETERS, input);
  const result = {
    pair: getAddress(decoded[0]),
    recipient: getAddress(decoded[1]),
    keyAmount: decoded[2],
    limit: decoded[3],
    payerIsUser: decoded[4],
  };
  const canonical = encodeAbiParameters(SUDOSWAP_INPUT_PARAMETERS, [
    result.pair,
    result.recipient,
    result.keyAmount,
    result.limit,
    result.payerIsUser,
  ]);
  if (canonical.toLowerCase() !== input.toLowerCase()) {
    throw new Error("alfaclub_sudoswap_input_noncanonical");
  }
  return result;
}

export type AlfaClubLpInnerCall = {
  target: Address;
  value: bigint;
  data: Hex;
};

type ReadClient = {
  readContract: (params: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }) => Promise<unknown>;
};

export type AlfaClubLpPolicyResult = {
  creatorCoin: Address;
  tokenId: bigint;
  pool: Address;
};

function splitCanonicalEthFundingCalls(
  calls: AlfaClubLpInnerCall[],
  permit2: Address,
): AlfaClubLpInnerCall[] | null {
  const firstWethDeposit = calls.findIndex(
    (call) =>
      call.target === BASE_WETH && selector(call.data) === WETH_DEPOSIT_SELECTOR,
  );
  if (firstWethDeposit === -1) return null;
  if (firstWethDeposit !== 0 || calls.length < 4) {
    throw new Error("alfaclub_sudoswap_eth_funding_order_invalid");
  }

  const deposit = calls[0]!;
  const wethApproval = calls[1]!;
  const zoraCall = calls[2]!;
  if (deposit.value <= 0n) {
    throw new Error("alfaclub_sudoswap_eth_funding_value_invalid");
  }
  if (
    wethApproval.target !== BASE_WETH ||
    selector(wethApproval.data) !== APPROVE_SELECTOR ||
    wethApproval.value !== 0n
  ) {
    throw new Error("alfaclub_sudoswap_weth_approval_invalid");
  }
  const approval = decodeFunctionData({
    abi: ERC20_ABI,
    data: wethApproval.data,
  });
  if (
    approval.functionName !== "approve" ||
    getAddress(approval.args[0]) !== permit2 ||
    approval.args[1] !== deposit.value
  ) {
    throw new Error("alfaclub_sudoswap_weth_approval_mismatch");
  }
  if (
    zoraCall.target !== ZORA_BASE_UNIVERSAL_ROUTER ||
    selector(zoraCall.data) !== ZORA_EXECUTE_SELECTOR ||
    zoraCall.value !== 0n
  ) {
    throw new Error("alfaclub_sudoswap_eth_funding_route_invalid");
  }

  return calls.slice(3);
}

export type AlfaClubLpPolicyConfig = {
  router: Address;
  adapter: Address;
  pair: Address;
  factory: Address;
  xykCurve: Address;
  permit2: Address;
  creatorCoin: Address;
  tokenId: bigint;
  maxKeyAmount: bigint;
  maxSlippageBps: bigint;
  maxDeadlineSeconds: bigint;
};

function selector(data: Hex): Hex {
  return data.slice(0, 10) as Hex;
}

function optionalConfiguredAddress(raw: string | undefined): Address | null {
  const value = String(raw ?? "").trim();
  if (!isAddress(value)) return null;
  const address = getAddress(value);
  return address === ZERO_ADDRESS ? null : address;
}

function readConfiguredAddress(
  raw: string | undefined,
  error: string,
): Address {
  const address = optionalConfiguredAddress(raw);
  if (!address) throw new Error(error);
  return address;
}

function readPositiveInteger(
  raw: string | undefined,
  fallback: string,
  error: string,
): bigint {
  const value = String(raw ?? fallback).trim();
  if (!/^\d+$/.test(value) || BigInt(value) <= 0n) throw new Error(error);
  return BigInt(value);
}

export function resolveAlfaClubLpPolicyConfig(
  env: Record<string, string | undefined>,
): AlfaClubLpPolicyConfig {
  const creatorCoinRaw = env.ALFACLUB_LP_CREATOR_COIN?.trim();
  const tokenId = readPositiveInteger(
    env.ALFACLUB_LP_TOKEN_ID,
    ROOM_1659_TOKEN_ID.toString(),
    "alfaclub_sudoswap_token_id_invalid",
  );
  const maxSlippageRaw = String(
    env.ALFACLUB_LP_MAX_SLIPPAGE_BPS ?? "500",
  ).trim();
  if (!/^\d+$/.test(maxSlippageRaw) || BigInt(maxSlippageRaw) >= 10_000n) {
    throw new Error("alfaclub_sudoswap_max_slippage_bps_invalid");
  }

  return {
    router: readConfiguredAddress(
      env.ALFACLUB_UNIVERSAL_ROUTER ?? env.VITE_ALFACLUB_UNIVERSAL_ROUTER,
      "alfaclub_sudoswap_router_not_configured",
    ),
    adapter: readConfiguredAddress(
      env.ALFACLUB_SUDOSWAP_ADAPTER ?? env.VITE_ALFACLUB_SUDOSWAP_ADAPTER,
      "alfaclub_sudoswap_adapter_not_configured",
    ),
    pair: readConfiguredAddress(
      env.ALFACLUB_ROOM_1659_SUDOSWAP_PAIR ??
        env.VITE_ALFACLUB_ROOM_1659_SUDOSWAP_PAIR,
      "alfaclub_sudoswap_pair_not_configured",
    ),
    factory: readConfiguredAddress(
      env.SUDOSWAP_PAIR_FACTORY ?? env.VITE_SUDOSWAP_PAIR_FACTORY,
      "alfaclub_sudoswap_factory_not_configured",
    ),
    xykCurve: readConfiguredAddress(
      env.SUDOSWAP_XYK_CURVE ?? env.VITE_SUDOSWAP_XYK_CURVE,
      "alfaclub_sudoswap_curve_not_configured",
    ),
    permit2:
      optionalConfiguredAddress(env.PERMIT2 ?? env.VITE_PERMIT2) ??
      CANONICAL_PERMIT2,
    creatorCoin: creatorCoinRaw
      ? readConfiguredAddress(
          creatorCoinRaw,
          "alfaclub_sudoswap_creator_coin_not_configured",
        )
      : ROOM_1659_CREATOR_COIN,
    tokenId,
    maxKeyAmount: readPositiveInteger(
      env.ALFACLUB_LP_MAX_KEY_AMOUNT,
      "100",
      "alfaclub_sudoswap_max_key_amount_invalid",
    ),
    maxSlippageBps: BigInt(maxSlippageRaw),
    maxDeadlineSeconds: readPositiveInteger(
      env.ALFACLUB_LP_MAX_DEADLINE_SECONDS,
      "1200",
      "alfaclub_sudoswap_max_deadline_invalid",
    ),
  };
}

function addressResult(value: unknown, error: string): Address {
  if (typeof value !== "string" || !isAddress(value)) throw new Error(error);
  return getAddress(value);
}

function integerResult(value: unknown, error: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    return BigInt(value);
  throw new Error(error);
}

function tupleResult(
  value: unknown,
  length: number,
  error: string,
): readonly unknown[] {
  if (!Array.isArray(value) || value.length < length) throw new Error(error);
  return value;
}

function minWithSlippage(value: bigint, slippageBps: bigint): bigint {
  return (value * (10_000n - slippageBps)) / 10_000n;
}

function maxWithSlippage(value: bigint, slippageBps: bigint): bigint {
  return (value * (10_000n + slippageBps) + 9_999n) / 10_000n;
}

async function validateLiveMarket(params: {
  client: ReadClient;
  config: AlfaClubLpPolicyConfig;
  direction: "buy" | "sell";
  keyAmount: bigint;
}): Promise<{
  quoteAmount: bigint;
  protocolFee: bigint;
  royaltyAmount: bigint;
}> {
  const { client, config } = params;
  const [
    validPair,
    pairFactory,
    pairVariant,
    poolType,
    pairToken,
    pairNft,
    pairTokenId,
    pairCurve,
    pairFee,
    adapterFactory,
    adapterPermit2,
    adapterFriendKey,
    adapterCurve,
    adapterRouter,
    adapterMarket,
    routerAdapter,
    quoteRaw,
    pairKeyBalance,
    pairCoinBalance,
  ] = await Promise.all([
    client.readContract({
      address: config.factory,
      abi: SUDOSWAP_PAIR_FACTORY_ABI,
      functionName: "isValidPair",
      args: [config.pair],
    }),
    client.readContract({
      address: config.pair,
      abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
      functionName: "factory",
    }),
    client.readContract({
      address: config.pair,
      abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
      functionName: "pairVariant",
    }),
    client.readContract({
      address: config.pair,
      abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
      functionName: "poolType",
    }),
    client.readContract({
      address: config.pair,
      abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
      functionName: "token",
    }),
    client.readContract({
      address: config.pair,
      abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
      functionName: "nft",
    }),
    client.readContract({
      address: config.pair,
      abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
      functionName: "nftId",
    }),
    client.readContract({
      address: config.pair,
      abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
      functionName: "bondingCurve",
    }),
    client.readContract({
      address: config.pair,
      abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
      functionName: "fee",
    }),
    client.readContract({
      address: config.adapter,
      abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
      functionName: "factory",
    }),
    client.readContract({
      address: config.adapter,
      abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
      functionName: "permit2",
    }),
    client.readContract({
      address: config.adapter,
      abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
      functionName: "friendKey",
    }),
    client.readContract({
      address: config.adapter,
      abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
      functionName: "xykCurve",
    }),
    client.readContract({
      address: config.adapter,
      abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
      functionName: "universalRouter",
    }),
    client.readContract({
      address: config.adapter,
      abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
      functionName: "markets",
      args: [config.pair],
    }),
    client.readContract({
      address: config.router,
      abi: ALFACLUB_SPONSORED_ROUTER_ABI,
      functionName: "SUDOSWAP_ADAPTER",
    }),
    client.readContract({
      address: config.pair,
      abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
      functionName:
        params.direction === "buy" ? "getBuyNFTQuote" : "getSellNFTQuote",
      args: [config.tokenId, params.keyAmount],
    }),
    client.readContract({
      address: ALFACLUB_FRIEND_KEY,
      abi: ERC1155_ABI,
      functionName: "balanceOf",
      args: [config.pair, config.tokenId],
    }),
    client.readContract({
      address: config.creatorCoin,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [config.pair],
    }),
  ]);

  if (validPair !== true) throw new Error("alfaclub_sudoswap_pair_invalid");
  if (
    addressResult(pairFactory, "alfaclub_sudoswap_pair_factory_unavailable") !==
    config.factory
  ) {
    throw new Error("alfaclub_sudoswap_pair_factory_mismatch");
  }
  if (
    integerResult(pairVariant, "alfaclub_sudoswap_pair_variant_unavailable") !==
    3n
  ) {
    throw new Error("alfaclub_sudoswap_pair_variant_mismatch");
  }
  if (
    integerResult(poolType, "alfaclub_sudoswap_pool_type_unavailable") !== 2n
  ) {
    throw new Error("alfaclub_sudoswap_pool_type_mismatch");
  }
  if (
    addressResult(pairToken, "alfaclub_sudoswap_pair_token_unavailable") !==
    config.creatorCoin
  ) {
    throw new Error("alfaclub_sudoswap_creator_coin_mismatch");
  }
  if (
    addressResult(pairNft, "alfaclub_sudoswap_pair_nft_unavailable") !==
    ALFACLUB_FRIEND_KEY
  ) {
    throw new Error("alfaclub_sudoswap_friend_key_mismatch");
  }
  if (
    integerResult(
      pairTokenId,
      "alfaclub_sudoswap_pair_token_id_unavailable",
    ) !== config.tokenId
  ) {
    throw new Error("alfaclub_sudoswap_token_id_mismatch");
  }
  if (
    addressResult(pairCurve, "alfaclub_sudoswap_pair_curve_unavailable") !==
    config.xykCurve
  ) {
    throw new Error("alfaclub_sudoswap_curve_mismatch");
  }
  if (
    integerResult(pairFee, "alfaclub_sudoswap_pair_fee_unavailable") !==
    ROOM_1659_TRADING_PAIR_FEE
  ) {
    throw new Error("alfaclub_sudoswap_pair_fee_mismatch");
  }

  if (
    addressResult(
      adapterFactory,
      "alfaclub_sudoswap_adapter_factory_unavailable",
    ) !== config.factory
  ) {
    throw new Error("alfaclub_sudoswap_adapter_factory_mismatch");
  }
  if (
    addressResult(
      adapterPermit2,
      "alfaclub_sudoswap_adapter_permit2_unavailable",
    ) !== config.permit2
  ) {
    throw new Error("alfaclub_sudoswap_adapter_permit2_mismatch");
  }
  if (
    addressResult(
      adapterFriendKey,
      "alfaclub_sudoswap_adapter_friend_key_unavailable",
    ) !== ALFACLUB_FRIEND_KEY
  ) {
    throw new Error("alfaclub_sudoswap_adapter_friend_key_mismatch");
  }
  if (
    addressResult(
      adapterCurve,
      "alfaclub_sudoswap_adapter_curve_unavailable",
    ) !== config.xykCurve
  ) {
    throw new Error("alfaclub_sudoswap_adapter_curve_mismatch");
  }
  if (
    addressResult(
      adapterRouter,
      "alfaclub_sudoswap_adapter_router_unavailable",
    ) !== config.router
  ) {
    throw new Error("alfaclub_sudoswap_adapter_router_mismatch");
  }
  if (
    addressResult(
      routerAdapter,
      "alfaclub_sudoswap_router_adapter_unavailable",
    ) !== config.adapter
  ) {
    throw new Error("alfaclub_sudoswap_router_adapter_mismatch");
  }

  const market = tupleResult(
    adapterMarket,
    3,
    "alfaclub_sudoswap_market_unavailable",
  );
  if (
    addressResult(market[0], "alfaclub_sudoswap_market_coin_unavailable") !==
      config.creatorCoin ||
    integerResult(
      market[1],
      "alfaclub_sudoswap_market_token_id_unavailable",
    ) !== config.tokenId ||
    market[2] !== true
  ) {
    throw new Error("alfaclub_sudoswap_market_not_allowed");
  }

  const quote = tupleResult(quoteRaw, 6, "alfaclub_sudoswap_quote_unavailable");
  if (
    integerResult(quote[0], "alfaclub_sudoswap_quote_error_unavailable") !== 0n
  ) {
    throw new Error("alfaclub_sudoswap_quote_error");
  }
  const quoteAmount = integerResult(
    quote[3],
    "alfaclub_sudoswap_quote_amount_unavailable",
  );
  const protocolFee = integerResult(
    quote[4],
    "alfaclub_sudoswap_quote_fee_unavailable",
  );
  const royaltyAmount = integerResult(
    quote[5],
    "alfaclub_sudoswap_quote_royalty_unavailable",
  );
  if (quoteAmount <= 0n)
    throw new Error("alfaclub_sudoswap_quote_amount_invalid");

  if (params.direction === "buy") {
    if (
      integerResult(
        pairKeyBalance,
        "alfaclub_sudoswap_key_inventory_unavailable",
      ) < params.keyAmount
    ) {
      throw new Error("alfaclub_sudoswap_key_inventory_insufficient");
    }
  } else if (
    integerResult(
      pairCoinBalance,
      "alfaclub_sudoswap_coin_inventory_unavailable",
    ) <
    quoteAmount + protocolFee + royaltyAmount
  ) {
    throw new Error("alfaclub_sudoswap_coin_inventory_insufficient");
  }

  return { quoteAmount, protocolFee, royaltyAmount };
}

export async function validateAlfaClubLpCalls(params: {
  calls: AlfaClubLpInnerCall[];
  sender: Address;
  client: ReadClient;
  env: Record<string, string | undefined>;
  nowSeconds?: bigint;
}): Promise<AlfaClubLpPolicyResult | null> {
  const configuredRouter = optionalConfiguredAddress(
    params.env.ALFACLUB_UNIVERSAL_ROUTER ??
      params.env.VITE_ALFACLUB_UNIVERSAL_ROUTER,
  );
  if (
    !configuredRouter ||
    !params.calls.some((call) => call.target === configuredRouter)
  )
    return null;

  const config = resolveAlfaClubLpPolicyConfig(params.env);
  const sudoswapCalls =
    splitCanonicalEthFundingCalls(params.calls, config.permit2) ?? params.calls;
  if (sudoswapCalls.length > 3 || sudoswapCalls.length === 0) {
    throw new Error("alfaclub_sudoswap_call_count_not_allowed");
  }
  if (sudoswapCalls.some((call) => call.value !== 0n)) {
    throw new Error("alfaclub_sudoswap_value_not_allowed");
  }

  const routerCalls = params.calls.filter(
    (call) => call.target === config.router,
  );
  if (routerCalls.length !== 1)
    throw new Error("alfaclub_sudoswap_router_call_count_invalid");
  const routerCall = routerCalls[0]!;
  if (params.calls[params.calls.length - 1] !== routerCall) {
    throw new Error("alfaclub_sudoswap_router_call_order_invalid");
  }
  if (selector(routerCall.data) !== EXECUTE_SELECTOR) {
    throw new Error("alfaclub_sudoswap_router_selector_not_allowed");
  }

  const decoded = decodeFunctionData({
    abi: ALFACLUB_SPONSORED_ROUTER_ABI,
    data: routerCall.data,
  });
  if (decoded.functionName !== "execute")
    throw new Error("alfaclub_sudoswap_execute_decode_failed");
  const [commands, inputs, deadline] = decoded.args;
  const buyCommand = `0x${ALFACLUB_SUDOSWAP_BUY_COMMAND.toString(16)}` as Hex;
  const sellCommand = `0x${ALFACLUB_SUDOSWAP_SELL_COMMAND.toString(16)}` as Hex;
  const direction =
    commands === buyCommand ? "buy" : commands === sellCommand ? "sell" : null;
  if (!direction) throw new Error("alfaclub_sudoswap_command_not_allowed");
  if (inputs.length !== 1 || !inputs[0])
    throw new Error("alfaclub_sudoswap_input_count_invalid");

  const input = decodeAlfaClubSudoswapInput(inputs[0]);
  if (input.pair !== config.pair)
    throw new Error("alfaclub_sudoswap_pair_mismatch");
  if (
    input.recipient !== params.sender &&
    input.recipient !== MSG_SENDER_RECIPIENT
  ) {
    throw new Error("alfaclub_sudoswap_recipient_mismatch");
  }
  if (!input.payerIsUser)
    throw new Error("alfaclub_sudoswap_payer_must_be_user");
  if (input.keyAmount <= 0n)
    throw new Error("alfaclub_sudoswap_key_amount_invalid");
  if (input.keyAmount > config.maxKeyAmount)
    throw new Error("alfaclub_sudoswap_key_amount_exceeds_policy");
  if (input.limit <= 0n) throw new Error("alfaclub_sudoswap_limit_invalid");

  const nowSeconds = params.nowSeconds ?? BigInt(Math.floor(Date.now() / 1000));
  if (
    deadline < nowSeconds ||
    deadline > nowSeconds + config.maxDeadlineSeconds
  ) {
    throw new Error("alfaclub_sudoswap_deadline_not_allowed");
  }

  const live = await validateLiveMarket({
    client: params.client,
    config,
    direction,
    keyAmount: input.keyAmount,
  });
  if (direction === "buy") {
    if (
      input.limit < live.quoteAmount ||
      input.limit > maxWithSlippage(live.quoteAmount, config.maxSlippageBps)
    ) {
      throw new Error("alfaclub_sudoswap_slippage_exceeds_policy");
    }
  } else if (
    input.limit > live.quoteAmount ||
    input.limit < minWithSlippage(live.quoteAmount, config.maxSlippageBps)
  ) {
    throw new Error("alfaclub_sudoswap_slippage_exceeds_policy");
  }

  let seenErc20Approval = false;
  let seenPermit2Approval = false;
  let seenKeyApproval = false;
  for (const call of sudoswapCalls) {
    if (call === routerCall) continue;
    const callSelector = selector(call.data);
    if (direction === "buy" && callSelector === APPROVE_SELECTOR) {
      if (seenErc20Approval || seenPermit2Approval)
        throw new Error("alfaclub_sudoswap_approval_order_invalid");
      if (call.target !== config.creatorCoin)
        throw new Error("alfaclub_sudoswap_approval_token_mismatch");
      const approval = decodeFunctionData({ abi: ERC20_ABI, data: call.data });
      if (approval.functionName !== "approve")
        throw new Error("alfaclub_sudoswap_approval_decode_failed");
      if (
        getAddress(approval.args[0]) !== config.permit2 ||
        approval.args[1] !== input.limit
      ) {
        throw new Error("alfaclub_sudoswap_erc20_approval_mismatch");
      }
      seenErc20Approval = true;
      continue;
    }
    if (direction === "buy" && callSelector === PERMIT2_APPROVE_SELECTOR) {
      if (seenPermit2Approval)
        throw new Error("alfaclub_sudoswap_permit2_approval_duplicate");
      if (call.target !== config.permit2)
        throw new Error("alfaclub_sudoswap_permit2_target_mismatch");
      const approval = decodeFunctionData({
        abi: PERMIT2_ALLOWANCE_TRANSFER_ABI,
        data: call.data,
      });
      if (approval.functionName !== "approve")
        throw new Error("alfaclub_sudoswap_permit2_decode_failed");
      if (
        getAddress(approval.args[0]) !== config.creatorCoin ||
        getAddress(approval.args[1]) !== config.adapter ||
        approval.args[2] !== input.limit ||
        BigInt(approval.args[3]) !== deadline
      ) {
        throw new Error("alfaclub_sudoswap_permit2_approval_mismatch");
      }
      seenPermit2Approval = true;
      continue;
    }
    if (
      direction === "sell" &&
      callSelector === SET_APPROVAL_FOR_ALL_SELECTOR
    ) {
      if (seenKeyApproval)
        throw new Error("alfaclub_sudoswap_key_approval_duplicate");
      if (call.target !== ALFACLUB_FRIEND_KEY)
        throw new Error("alfaclub_sudoswap_friend_key_mismatch");
      const approval = decodeFunctionData({
        abi: ERC1155_ABI,
        data: call.data,
      });
      if (approval.functionName !== "setApprovalForAll")
        throw new Error("alfaclub_sudoswap_key_approval_decode_failed");
      if (
        getAddress(approval.args[0]) !== config.adapter ||
        approval.args[1] !== true
      ) {
        throw new Error("alfaclub_sudoswap_key_approval_mismatch");
      }
      seenKeyApproval = true;
      continue;
    }
    throw new Error("alfaclub_sudoswap_selector_not_allowed");
  }

  return {
    creatorCoin: config.creatorCoin,
    tokenId: config.tokenId,
    pool: config.pair,
  };
}
