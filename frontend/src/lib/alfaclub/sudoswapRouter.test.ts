import { describe, expect, it } from "vitest";
import { decodeFunctionData, getAddress } from "viem";

import {
  ALFACLUB_UNIVERSAL_ROUTER_ABI,
  PERMIT2_ALLOWANCE_TRANSFER_ABI,
} from "./contracts";
import {
  ALFACLUB_SUDOSWAP_BUY_COMMAND,
  ALFACLUB_SUDOSWAP_SELL_COMMAND,
  buildAlfaClubSudoswapCalls,
  buildAlfaClubSudoswapRoundTripCalls,
  decodeAlfaClubSudoswapInput,
} from "./sudoswapRouter";

const ROUTER = getAddress("0x1000000000000000000000000000000000000001");
const ADAPTER = getAddress("0x2000000000000000000000000000000000000002");
const PERMIT2 = getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3");
const FRIEND_KEY = getAddress("0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F");
const CREATOR_COIN = getAddress("0x5b674196812451b7cec024fe9d22d2c0b172fa75");
const PAIR = getAddress("0x3000000000000000000000000000000000000003");
const SENDER = getAddress("0x4000000000000000000000000000000000000004");
const DEADLINE = 2_000_000_000n;

function baseParams() {
  return {
    router: ROUTER,
    adapter: ADAPTER,
    permit2: PERMIT2,
    friendKey: FRIEND_KEY,
    creatorCoin: CREATOR_COIN,
    pair: PAIR,
    sender: SENDER,
    keyAmount: 2n,
    limit: 1_050n,
    deadline: DEADLINE,
  };
}

describe("AlfaClub Sudoswap Universal Router encoder", () => {
  it("builds one atomic buy batch with exact ERC20 and Permit2 approvals", () => {
    const calls = buildAlfaClubSudoswapCalls({
      ...baseParams(),
      direction: "buy",
    });
    expect(calls.map((call) => call.to)).toEqual([
      CREATOR_COIN,
      PERMIT2,
      ROUTER,
    ]);

    const permit = decodeFunctionData({
      abi: PERMIT2_ALLOWANCE_TRANSFER_ABI,
      data: calls[1]!.data,
    });
    expect(permit.functionName).toBe("approve");
    expect(permit.args).toEqual([
      CREATOR_COIN,
      ADAPTER,
      1_050n,
      Number(DEADLINE),
    ]);

    const execute = decodeFunctionData({
      abi: ALFACLUB_UNIVERSAL_ROUTER_ABI,
      data: calls[2]!.data,
    });
    expect(execute.functionName).toBe("execute");
    if (execute.functionName !== "execute")
      throw new Error("execute decode failed");
    expect(execute.args[0]).toBe(
      `0x${ALFACLUB_SUDOSWAP_BUY_COMMAND.toString(16)}`,
    );
    expect(decodeAlfaClubSudoswapInput(execute.args[1][0]!)).toEqual({
      pair: PAIR,
      recipient: SENDER,
      keyAmount: 2n,
      limit: 1_050n,
      payerIsUser: true,
    });
  });

  it("omits approvals only when both buy allowances cover the exact deadline", () => {
    const calls = buildAlfaClubSudoswapCalls({
      ...baseParams(),
      direction: "buy",
      erc20AllowanceToPermit2: 1_050n,
      permit2AllowanceToAdapter: { amount: 1_050n, expiration: DEADLINE },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.to).toBe(ROUTER);
  });

  it("builds sell approval plus command 0x42 for the parent sender", () => {
    const calls = buildAlfaClubSudoswapCalls({
      ...baseParams(),
      direction: "sell",
    });
    expect(calls.map((call) => call.to)).toEqual([FRIEND_KEY, ROUTER]);
    const execute = decodeFunctionData({
      abi: ALFACLUB_UNIVERSAL_ROUTER_ABI,
      data: calls[1]!.data,
    });
    if (execute.functionName !== "execute")
      throw new Error("execute decode failed");
    expect(execute.args[0]).toBe(
      `0x${ALFACLUB_SUDOSWAP_SELL_COMMAND.toString(16)}`,
    );
    expect(decodeAlfaClubSudoswapInput(execute.args[1][0]!).recipient).toBe(
      SENDER,
    );
  });

  it("fails closed when a buy limit cannot fit Permit2 uint160", () => {
    expect(() =>
      buildAlfaClubSudoswapCalls({
        ...baseParams(),
        direction: "buy",
        limit: 1n << 160n,
      }),
    ).toThrow("alfaclub_sudoswap_limit_too_large");
  });

  it("builds an atomic approval-clean buy and sell round trip", () => {
    const calls = buildAlfaClubSudoswapRoundTripCalls({
      ...baseParams(),
      buyLimit: 1_050n,
      sellLimit: 800n,
      erc20AllowanceToPermit2: 0n,
      permit2AllowanceToAdapter: { amount: 0n, expiration: 0n },
      keyApprovedForAdapter: false,
    });

    expect(calls.map((call) => call.to)).toEqual([
      CREATOR_COIN,
      PERMIT2,
      ROUTER,
      FRIEND_KEY,
      ROUTER,
      FRIEND_KEY,
      PERMIT2,
      CREATOR_COIN,
    ]);

    const buy = decodeFunctionData({
      abi: ALFACLUB_UNIVERSAL_ROUTER_ABI,
      data: calls[2]!.data,
    });
    const sell = decodeFunctionData({
      abi: ALFACLUB_UNIVERSAL_ROUTER_ABI,
      data: calls[4]!.data,
    });
    if (buy.functionName !== "execute" || sell.functionName !== "execute") {
      throw new Error("execute decode failed");
    }
    expect(buy.args[0]).toBe(`0x${ALFACLUB_SUDOSWAP_BUY_COMMAND.toString(16)}`);
    expect(sell.args[0]).toBe(
      `0x${ALFACLUB_SUDOSWAP_SELL_COMMAND.toString(16)}`,
    );
    expect(decodeAlfaClubSudoswapInput(buy.args[1][0]!).limit).toBe(1_050n);
    expect(decodeAlfaClubSudoswapInput(sell.args[1][0]!).limit).toBe(800n);

    const permit2Cleanup = decodeFunctionData({
      abi: PERMIT2_ALLOWANCE_TRANSFER_ABI,
      data: calls[6]!.data,
    });
    expect(permit2Cleanup.functionName).toBe("approve");
    expect(permit2Cleanup.args).toEqual([CREATOR_COIN, ADAPTER, 0n, 0]);
  });

  it("restores the exact pre-existing approval state", () => {
    const calls = buildAlfaClubSudoswapRoundTripCalls({
      ...baseParams(),
      buyLimit: 1_050n,
      sellLimit: 800n,
      erc20AllowanceToPermit2: 5_000n,
      permit2AllowanceToAdapter: {
        amount: 4_000n,
        expiration: DEADLINE + 1n,
      },
      keyApprovedForAdapter: true,
    });

    expect(calls.map((call) => call.to)).toEqual([
      ROUTER,
      ROUTER,
      FRIEND_KEY,
      PERMIT2,
      CREATOR_COIN,
    ]);
    const permit2Restore = decodeFunctionData({
      abi: PERMIT2_ALLOWANCE_TRANSFER_ABI,
      data: calls[3]!.data,
    });
    expect(permit2Restore.functionName).toBe("approve");
    expect(permit2Restore.args).toEqual([
      CREATOR_COIN,
      ADAPTER,
      4_000n,
      Number(DEADLINE + 1n),
    ]);
  });
});
