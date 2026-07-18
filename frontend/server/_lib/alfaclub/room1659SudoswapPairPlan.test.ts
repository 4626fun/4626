import { decodeFunctionData, getAddress } from "viem";
import { describe, expect, it } from "vitest";

import {
  ROOM_1659_CREATOR_COIN,
  ROOM_1659_ERC1155_ABI,
  ROOM_1659_ERC20_ABI,
  ROOM_1659_FACTORY_ABI,
  ROOM_1659_FRIEND_KEY,
  ROOM_1659_PAIR_ABI,
  ROOM_1659_PAIR_FEE,
  ROOM_1659_TOKEN_ID,
  buildRoom1659CreateCalls,
  buildRoom1659PairOwnershipTransferCall,
  type Room1659PairPlanConfig,
} from "./room1659SudoswapPairPlan.js";

const FACTORY = getAddress("0x1000000000000000000000000000000000000001");
const CURVE = getAddress("0x2000000000000000000000000000000000000002");
const PAIR = getAddress("0x3000000000000000000000000000000000000003");
const SAFE = getAddress("0x4000000000000000000000000000000000000004");

function config(
  overrides: Partial<Room1659PairPlanConfig> = {},
): Room1659PairPlanConfig {
  return {
    factory: FACTORY,
    xykCurve: CURVE,
    pairOwner: SAFE,
    initialKeyBalance: 3n,
    initialCreatorCoinBalance: 25_000_000n * 10n ** 18n,
    virtualKeyReserve: 100n,
    virtualCreatorCoinReserve: 100_000_000n * 10n ** 18n,
    pairFee: ROOM_1659_PAIR_FEE,
    ...overrides,
  };
}

describe("Room 1659 Sudoswap CSW call plan", () => {
  it("builds exact approve, create, and revoke calls in one atomic order", () => {
    const planned = config();
    const calls = buildRoom1659CreateCalls(planned);

    expect(calls).toHaveLength(5);
    expect(calls.map((call) => call.to)).toEqual([
      ROOM_1659_FRIEND_KEY,
      ROOM_1659_CREATOR_COIN,
      FACTORY,
      ROOM_1659_FRIEND_KEY,
      ROOM_1659_CREATOR_COIN,
    ]);
    expect(calls.every((call) => call.value === 0n)).toBe(true);

    expect(
      decodeFunctionData({ abi: ROOM_1659_ERC1155_ABI, data: calls[0]!.data }),
    ).toEqual({ functionName: "setApprovalForAll", args: [FACTORY, true] });
    expect(
      decodeFunctionData({ abi: ROOM_1659_ERC20_ABI, data: calls[1]!.data }),
    ).toEqual({
      functionName: "approve",
      args: [FACTORY, planned.initialCreatorCoinBalance],
    });

    const create = decodeFunctionData({
      abi: ROOM_1659_FACTORY_ABI,
      data: calls[2]!.data,
    });
    expect(create.functionName).toBe("createPairERC1155ERC20");
    expect(create.args?.[0]).toEqual({
      token: ROOM_1659_CREATOR_COIN,
      nft: ROOM_1659_FRIEND_KEY,
      bondingCurve: CURVE,
      assetRecipient: "0x0000000000000000000000000000000000000000",
      poolType: 2,
      delta: planned.virtualKeyReserve,
      fee: ROOM_1659_PAIR_FEE,
      spotPrice: planned.virtualCreatorCoinReserve,
      nftId: ROOM_1659_TOKEN_ID,
      initialNFTBalance: planned.initialKeyBalance,
      initialTokenBalance: planned.initialCreatorCoinBalance,
      hookAddress: "0x0000000000000000000000000000000000000000",
      referralAddress: "0x0000000000000000000000000000000000000000",
    });

    expect(
      decodeFunctionData({ abi: ROOM_1659_ERC1155_ABI, data: calls[3]!.data }),
    ).toEqual({ functionName: "setApprovalForAll", args: [FACTORY, false] });
    expect(
      decodeFunctionData({ abi: ROOM_1659_ERC20_ABI, data: calls[4]!.data }),
    ).toEqual({
      functionName: "approve",
      args: [FACTORY, 0n],
    });
  });

  it("rejects unsafe fee and reserve configurations before encoding calls", () => {
    expect(() =>
      buildRoom1659CreateCalls(config({ pairFee: ROOM_1659_PAIR_FEE - 1n })),
    ).toThrow("PAIR_FEE_must_equal_690_bps");
    expect(() =>
      buildRoom1659CreateCalls(config({ virtualKeyReserve: 1n })),
    ).toThrow("VIRTUAL_KEY_RESERVE_invalid");
    expect(() =>
      buildRoom1659CreateCalls(config({ initialKeyBalance: 0n })),
    ).toThrow("INITIAL_KEY_BALANCE_invalid");
  });

  it("builds a separate pair ownership transfer to the admin Safe", () => {
    const call = buildRoom1659PairOwnershipTransferCall(PAIR, SAFE);
    expect(call).toMatchObject({ to: PAIR, value: 0n });
    expect(
      decodeFunctionData({ abi: ROOM_1659_PAIR_ABI, data: call.data }),
    ).toEqual({
      functionName: "transferOwnership",
      args: [SAFE, "0x"],
    });
  });
});
