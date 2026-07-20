import { describe, expect, it } from "vitest";
import { decodeFunctionData, getAddress } from "viem";

import {
  SUDOSWAP_LIQUIDITY_ERC1155_ABI,
  SUDOSWAP_LIQUIDITY_FACTORY_ABI,
  SUDOSWAP_LIQUIDITY_PAIR_ABI,
  buildSudoswapConfigurePoolPlan,
  buildSudoswapCreatePoolPlan,
  buildSudoswapFundPoolPlan,
  buildSudoswapWithdrawPoolPlan,
  deriveSudoswapQuotePreview,
} from "./sudoswapLiquidity";

const SENDER = getAddress("0x1000000000000000000000000000000000000001");
const FACTORY = getAddress("0x2000000000000000000000000000000000000002");
const CURVE = getAddress("0x3000000000000000000000000000000000000003");
const KEY = getAddress("0x4000000000000000000000000000000000000004");
const COIN = getAddress("0x5000000000000000000000000000000000000005");
const PAIR = getAddress("0x6000000000000000000000000000000000000006");

describe("Sudoswap v2 liquidity plans", () => {
  it("builds an approval-clean official ERC-1155/ERC-20 create batch", () => {
    const plan = buildSudoswapCreatePoolPlan({
      sender: SENDER,
      factory: FACTORY,
      bondingCurve: CURVE,
      erc1155: KEY,
      tokenId: 1659n,
      erc1155Amount: 5n,
      erc20: COIN,
      erc20Amount: 1_000n,
      virtualKeyReserve: 24n,
      virtualTokenReserve: 2_000n,
      fee: 69_000_000_000_000_000n,
    });
    expect(plan.calls).toHaveLength(5);
    const approval = decodeFunctionData({
      abi: SUDOSWAP_LIQUIDITY_ERC1155_ABI,
      data: plan.calls[0]!.data as `0x${string}`,
    });
    expect(approval.args).toEqual([FACTORY, true]);
    const create = decodeFunctionData({
      abi: SUDOSWAP_LIQUIDITY_FACTORY_ABI,
      data: plan.calls[2]!.data as `0x${string}`,
    });
    expect(create.functionName).toBe("createPairERC1155ERC20");
    expect(create.args[0]).toMatchObject({
      token: COIN,
      nft: KEY,
      bondingCurve: CURVE,
      poolType: 2,
      nftId: 1659n,
      initialNFTBalance: 5n,
      initialTokenBalance: 1_000n,
    });
    const revoke = decodeFunctionData({
      abi: SUDOSWAP_LIQUIDITY_ERC1155_ABI,
      data: plan.calls[3]!.data as `0x${string}`,
    });
    expect(revoke.args).toEqual([FACTORY, false]);
  });

  it("rejects an XYK virtual key reserve that cannot cover inventory", () => {
    expect(() =>
      buildSudoswapCreatePoolPlan({
        sender: SENDER,
        factory: FACTORY,
        bondingCurve: CURVE,
        erc1155: KEY,
        tokenId: 1659n,
        erc1155Amount: 5n,
        erc20: COIN,
        erc20Amount: 1_000n,
        virtualKeyReserve: 5n,
        virtualTokenReserve: 2_000n,
        fee: 0n,
      }),
    ).toThrow("virtual_key_reserve_must_exceed_inventory");
  });

  it("builds direct deposits without broad token approvals", () => {
    const plan = buildSudoswapFundPoolPlan({
      sender: SENDER,
      pair: PAIR,
      erc1155: KEY,
      tokenId: 1659n,
      erc1155Amount: 2n,
      erc20: COIN,
      erc20Amount: 300n,
    });
    expect(plan.calls.map((call) => call.to)).toEqual([COIN, KEY]);
    const keyDeposit = decodeFunctionData({
      abi: SUDOSWAP_LIQUIDITY_ERC1155_ABI,
      data: plan.calls[1]!.data as `0x${string}`,
    });
    expect(keyDeposit.args).toEqual([SENDER, PAIR, 1659n, 2n, "0x"]);
  });

  it("limits withdrawals and configuration to explicit owner calls", () => {
    const withdraw = buildSudoswapWithdrawPoolPlan({
      sender: SENDER,
      pair: PAIR,
      erc1155: KEY,
      tokenId: 1659n,
      erc1155Amount: 1n,
      erc20: COIN,
      erc20Amount: 100n,
    });
    expect(withdraw.calls).toHaveLength(2);
    expect(
      decodeFunctionData({
        abi: SUDOSWAP_LIQUIDITY_PAIR_ABI,
        data: withdraw.calls[1]!.data as `0x${string}`,
      }).args,
    ).toEqual([KEY, [1659n], [1n]]);

    const configure = buildSudoswapConfigurePoolPlan({
      sender: SENDER,
      pair: PAIR,
      currentSpotPrice: 1_000n,
      currentDelta: 20n,
      currentFee: 10n,
      nextSpotPrice: 1_100n,
      nextDelta: 21n,
      nextFee: 11n,
    });
    expect(configure.calls).toHaveLength(3);
  });
});

describe("Sudoswap quote preview", () => {
  it("shows separate buy impact and maximum paid from onchain quote values", () => {
    const preview = deriveSudoswapQuotePreview({
      direction: "buy",
      quantity: 2n,
      slippageBps: 100n,
      oneItemQuote: {
        errorCode: 0n,
        amount: 100n,
        newSpotPrice: 0n,
        newDelta: 0n,
        tradeFee: 7n,
        protocolFee: 1n,
        royaltyAmount: 2n,
      },
      quote: {
        errorCode: 0n,
        amount: 220n,
        newSpotPrice: 1_220n,
        newDelta: 18n,
        tradeFee: 14n,
        protocolFee: 2n,
        royaltyAmount: 4n,
      },
    });
    expect(preview.effectiveUnitPrice).toBe(110n);
    expect(preview.priceImpactBps).toBe(1_000n);
    expect(preview.maximumPaid).toBe(223n);
    expect(preview.minimumReceived).toBeNull();
  });

  it("shows separate sell impact and minimum received", () => {
    const preview = deriveSudoswapQuotePreview({
      direction: "sell",
      quantity: 2n,
      slippageBps: 100n,
      oneItemQuote: {
        errorCode: 0n,
        amount: 100n,
        newSpotPrice: 0n,
        newDelta: 0n,
        tradeFee: 7n,
        protocolFee: 1n,
        royaltyAmount: 2n,
      },
      quote: {
        errorCode: 0n,
        amount: 180n,
        newSpotPrice: 820n,
        newDelta: 22n,
        tradeFee: 14n,
        protocolFee: 2n,
        royaltyAmount: 4n,
      },
    });
    expect(preview.effectiveUnitPrice).toBe(90n);
    expect(preview.priceImpactBps).toBe(1_000n);
    expect(preview.minimumReceived).toBe(178n);
    expect(preview.maximumPaid).toBeNull();
  });
});
