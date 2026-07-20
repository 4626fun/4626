import {
  encodeFunctionData,
  erc20Abi,
  getAddress,
  parseAbi,
  type Address,
} from "viem";

import type { TransactionRequest } from "@/lib/uniswap/tradingApi";

export const SUDOSWAP_TRADE_POOL_TYPE = 2;
export const SUDOSWAP_FEE_SCALE = 10n ** 18n;
export const SUDOSWAP_MAX_TRADE_FEE = 5n * 10n ** 17n;
export const UINT96_MAX = (1n << 96n) - 1n;
export const UINT128_MAX = (1n << 128n) - 1n;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export const SUDOSWAP_LIQUIDITY_FACTORY_ABI = parseAbi([
  "function createPairERC1155ERC20((address token,address nft,address bondingCurve,address assetRecipient,uint8 poolType,uint128 delta,uint96 fee,uint128 spotPrice,uint256 nftId,uint256 initialNFTBalance,uint256 initialTokenBalance,address hookAddress,address referralAddress) params) returns (address pair)",
]);

export const SUDOSWAP_LIQUIDITY_PAIR_ABI = parseAbi([
  "function owner() view returns (address)",
  "function changeSpotPrice(uint128 newSpotPrice)",
  "function changeDelta(uint128 newDelta)",
  "function changeFee(uint96 newFee)",
  "function withdrawERC20(address token, uint256 amount)",
  "function withdrawERC1155(address token, uint256[] ids, uint256[] amounts)",
]);

export const SUDOSWAP_LIQUIDITY_ERC1155_ABI = parseAbi([
  "function setApprovalForAll(address operator, bool approved)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
]);

export type SudoswapLiquidityCallPlan = {
  calls: TransactionRequest[];
  steps: string[];
};

export type SudoswapQuoteValues = {
  errorCode: bigint;
  amount: bigint;
  newSpotPrice: bigint;
  newDelta: bigint;
  tradeFee: bigint;
  protocolFee: bigint;
  royaltyAmount: bigint;
};

export type SudoswapQuotePreview = {
  direction: "buy" | "sell";
  amount: bigint;
  effectiveUnitPrice: bigint;
  marginalUnitPrice: bigint;
  tradeFee: bigint;
  protocolFee: bigint;
  royaltyAmount: bigint;
  priceImpactBps: bigint;
  minimumReceived: bigint | null;
  maximumPaid: bigint | null;
  newSpotPrice: bigint;
  newDelta: bigint;
};

function transaction(
  to: Address,
  from: Address,
  data: `0x${string}`,
): TransactionRequest {
  return { to, from, data, value: "0", chainId: 8453 };
}

function positive(name: string, value: bigint): void {
  if (value <= 0n) throw new Error(`${name}_must_be_positive`);
}

function uint128(name: string, value: bigint): void {
  positive(name, value);
  if (value > UINT128_MAX) throw new Error(`${name}_exceeds_uint128`);
}

function fee(value: bigint): void {
  if (value < 0n || value > SUDOSWAP_MAX_TRADE_FEE || value > UINT96_MAX) {
    throw new Error("sudoswap_fee_invalid");
  }
}

export function buildSudoswapCreatePoolPlan(params: {
  sender: Address;
  factory: Address;
  bondingCurve: Address;
  erc1155: Address;
  tokenId: bigint;
  erc1155Amount: bigint;
  erc20: Address;
  erc20Amount: bigint;
  virtualKeyReserve: bigint;
  virtualTokenReserve: bigint;
  fee: bigint;
}): SudoswapLiquidityCallPlan {
  const sender = getAddress(params.sender);
  const factory = getAddress(params.factory);
  const erc1155 = getAddress(params.erc1155);
  const erc20 = getAddress(params.erc20);
  const bondingCurve = getAddress(params.bondingCurve);
  positive("token_id", params.tokenId);
  positive("erc1155_amount", params.erc1155Amount);
  positive("erc20_amount", params.erc20Amount);
  if (params.virtualKeyReserve <= params.erc1155Amount) {
    throw new Error("virtual_key_reserve_must_exceed_inventory");
  }
  uint128("virtual_key_reserve", params.virtualKeyReserve);
  uint128("virtual_token_reserve", params.virtualTokenReserve);
  fee(params.fee);

  return {
    steps: [
      "Approve ERC-1155 to the official factory",
      "Approve the exact ERC-20 seed amount",
      "Create and seed the official Sudoswap v2 pair",
      "Revoke the ERC-1155 factory approval",
      "Clear the ERC-20 factory allowance",
    ],
    calls: [
      transaction(
        erc1155,
        sender,
        encodeFunctionData({
          abi: SUDOSWAP_LIQUIDITY_ERC1155_ABI,
          functionName: "setApprovalForAll",
          args: [factory, true],
        }),
      ),
      transaction(
        erc20,
        sender,
        encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [factory, params.erc20Amount],
        }),
      ),
      transaction(
        factory,
        sender,
        encodeFunctionData({
          abi: SUDOSWAP_LIQUIDITY_FACTORY_ABI,
          functionName: "createPairERC1155ERC20",
          args: [
            {
              token: erc20,
              nft: erc1155,
              bondingCurve,
              assetRecipient: ZERO_ADDRESS,
              poolType: SUDOSWAP_TRADE_POOL_TYPE,
              delta: params.virtualKeyReserve,
              fee: params.fee,
              spotPrice: params.virtualTokenReserve,
              nftId: params.tokenId,
              initialNFTBalance: params.erc1155Amount,
              initialTokenBalance: params.erc20Amount,
              hookAddress: ZERO_ADDRESS,
              referralAddress: ZERO_ADDRESS,
            },
          ],
        }),
      ),
      transaction(
        erc1155,
        sender,
        encodeFunctionData({
          abi: SUDOSWAP_LIQUIDITY_ERC1155_ABI,
          functionName: "setApprovalForAll",
          args: [factory, false],
        }),
      ),
      transaction(
        erc20,
        sender,
        encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [factory, 0n],
        }),
      ),
    ],
  };
}

export function buildSudoswapFundPoolPlan(params: {
  sender: Address;
  pair: Address;
  erc1155: Address;
  tokenId: bigint;
  erc1155Amount: bigint;
  erc20: Address;
  erc20Amount: bigint;
}): SudoswapLiquidityCallPlan {
  const sender = getAddress(params.sender);
  const pair = getAddress(params.pair);
  const calls: TransactionRequest[] = [];
  const steps: string[] = [];
  if (params.erc20Amount > 0n) {
    calls.push(
      transaction(
        getAddress(params.erc20),
        sender,
        encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [pair, params.erc20Amount],
        }),
      ),
    );
    steps.push("Deposit ERC-20 inventory into the pair");
  }
  if (params.erc1155Amount > 0n) {
    positive("token_id", params.tokenId);
    calls.push(
      transaction(
        getAddress(params.erc1155),
        sender,
        encodeFunctionData({
          abi: SUDOSWAP_LIQUIDITY_ERC1155_ABI,
          functionName: "safeTransferFrom",
          args: [sender, pair, params.tokenId, params.erc1155Amount, "0x"],
        }),
      ),
    );
    steps.push("Deposit ERC-1155 inventory into the pair");
  }
  if (calls.length === 0) throw new Error("liquidity_deposit_empty");
  return { calls, steps };
}

export function buildSudoswapWithdrawPoolPlan(params: {
  sender: Address;
  pair: Address;
  erc1155: Address;
  tokenId: bigint;
  erc1155Amount: bigint;
  erc20: Address;
  erc20Amount: bigint;
}): SudoswapLiquidityCallPlan {
  const sender = getAddress(params.sender);
  const pair = getAddress(params.pair);
  const calls: TransactionRequest[] = [];
  const steps: string[] = [];
  if (params.erc20Amount > 0n) {
    calls.push(
      transaction(
        pair,
        sender,
        encodeFunctionData({
          abi: SUDOSWAP_LIQUIDITY_PAIR_ABI,
          functionName: "withdrawERC20",
          args: [getAddress(params.erc20), params.erc20Amount],
        }),
      ),
    );
    steps.push("Withdraw ERC-20 inventory to the pair owner");
  }
  if (params.erc1155Amount > 0n) {
    positive("token_id", params.tokenId);
    calls.push(
      transaction(
        pair,
        sender,
        encodeFunctionData({
          abi: SUDOSWAP_LIQUIDITY_PAIR_ABI,
          functionName: "withdrawERC1155",
          args: [
            getAddress(params.erc1155),
            [params.tokenId],
            [params.erc1155Amount],
          ],
        }),
      ),
    );
    steps.push("Withdraw ERC-1155 inventory to the pair owner");
  }
  if (calls.length === 0) throw new Error("liquidity_withdrawal_empty");
  return { calls, steps };
}

export function buildSudoswapConfigurePoolPlan(params: {
  sender: Address;
  pair: Address;
  currentSpotPrice: bigint;
  currentDelta: bigint;
  currentFee: bigint;
  nextSpotPrice: bigint;
  nextDelta: bigint;
  nextFee: bigint;
}): SudoswapLiquidityCallPlan {
  uint128("spot_price", params.nextSpotPrice);
  uint128("delta", params.nextDelta);
  fee(params.nextFee);
  const sender = getAddress(params.sender);
  const pair = getAddress(params.pair);
  const calls: TransactionRequest[] = [];
  const steps: string[] = [];
  if (params.nextSpotPrice !== params.currentSpotPrice) {
    calls.push(
      transaction(
        pair,
        sender,
        encodeFunctionData({
          abi: SUDOSWAP_LIQUIDITY_PAIR_ABI,
          functionName: "changeSpotPrice",
          args: [params.nextSpotPrice],
        }),
      ),
    );
    steps.push("Update the virtual ERC-20 reserve");
  }
  if (params.nextDelta !== params.currentDelta) {
    calls.push(
      transaction(
        pair,
        sender,
        encodeFunctionData({
          abi: SUDOSWAP_LIQUIDITY_PAIR_ABI,
          functionName: "changeDelta",
          args: [params.nextDelta],
        }),
      ),
    );
    steps.push("Update the virtual ERC-1155 reserve");
  }
  if (params.nextFee !== params.currentFee) {
    calls.push(
      transaction(
        pair,
        sender,
        encodeFunctionData({
          abi: SUDOSWAP_LIQUIDITY_PAIR_ABI,
          functionName: "changeFee",
          args: [params.nextFee],
        }),
      ),
    );
    steps.push("Update the pair LP fee");
  }
  if (calls.length === 0) throw new Error("pool_configuration_unchanged");
  return { calls, steps };
}

function slippage(value: bigint, bps: bigint, add: boolean): bigint {
  if (bps < 0n || bps >= 10_000n) throw new Error("slippage_bps_invalid");
  return add
    ? (value * (10_000n + bps) + 9_999n) / 10_000n
    : (value * (10_000n - bps)) / 10_000n;
}

function curveAmountBeforeFees(
  direction: "buy" | "sell",
  quote: SudoswapQuoteValues,
): bigint {
  const fees = quote.tradeFee + quote.protocolFee + quote.royaltyAmount;
  if (direction === "buy") {
    if (fees >= quote.amount)
      throw new Error("sudoswap_quote_fee_breakdown_invalid");
    return quote.amount - fees;
  }
  return quote.amount + fees;
}

export function deriveSudoswapQuotePreview(params: {
  direction: "buy" | "sell";
  quantity: bigint;
  quote: SudoswapQuoteValues;
  oneItemQuote: SudoswapQuoteValues;
  slippageBps: bigint;
}): SudoswapQuotePreview {
  positive("quantity", params.quantity);
  if (params.quote.errorCode !== 0n || params.oneItemQuote.errorCode !== 0n) {
    throw new Error("sudoswap_quote_not_executable");
  }
  positive("quote_amount", params.quote.amount);
  positive("one_item_quote_amount", params.oneItemQuote.amount);
  const effectiveUnitPrice = params.quote.amount / params.quantity;
  const marginalUnitPrice = params.oneItemQuote.amount;
  const curveEffectiveUnitPrice =
    curveAmountBeforeFees(params.direction, params.quote) / params.quantity;
  const curveMarginalUnitPrice = curveAmountBeforeFees(
    params.direction,
    params.oneItemQuote,
  );
  positive("curve_effective_unit_price", curveEffectiveUnitPrice);
  positive("curve_marginal_unit_price", curveMarginalUnitPrice);
  const priceImpactBps =
    params.direction === "buy"
      ? curveEffectiveUnitPrice > curveMarginalUnitPrice
        ? ((curveEffectiveUnitPrice - curveMarginalUnitPrice) * 10_000n) /
          curveMarginalUnitPrice
        : 0n
      : curveEffectiveUnitPrice < curveMarginalUnitPrice
        ? ((curveMarginalUnitPrice - curveEffectiveUnitPrice) * 10_000n) /
          curveMarginalUnitPrice
        : 0n;

  return {
    direction: params.direction,
    amount: params.quote.amount,
    effectiveUnitPrice,
    marginalUnitPrice,
    tradeFee: params.quote.tradeFee,
    protocolFee: params.quote.protocolFee,
    royaltyAmount: params.quote.royaltyAmount,
    priceImpactBps,
    minimumReceived:
      params.direction === "sell"
        ? slippage(params.quote.amount, params.slippageBps, false)
        : null,
    maximumPaid:
      params.direction === "buy"
        ? slippage(params.quote.amount, params.slippageBps, true)
        : null,
    newSpotPrice: params.quote.newSpotPrice,
    newDelta: params.quote.newDelta,
  };
}
