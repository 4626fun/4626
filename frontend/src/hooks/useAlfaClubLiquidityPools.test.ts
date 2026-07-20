import { describe, expect, it, vi } from "vitest";
import { getAddress, type Address, type PublicClient } from "viem";

import { ALFACLUB } from "@/lib/alfaclub/contracts";

import {
  filterAlfaClubLiquidityPools,
  filterAlfaClubLiquidityPoolsByRoomId,
  formatAlfaClubPoolFee,
  isAlfaClubSudoswapMarketConfigured,
  readAlfaClubLiquidityPools,
  type AlfaClubLiquidityPoolSummary,
  type AlfaClubSudoswapMarketConfig,
} from "./useAlfaClubLiquidityPools";

const FACTORY = "0x1000000000000000000000000000000000000000" as Address;
const PAIR = "0x2000000000000000000000000000000000000000" as Address;
const CREATOR_COIN = "0x3000000000000000000000000000000000000000" as Address;
const ROOM_CREATOR = "0x4000000000000000000000000000000000000000" as Address;
const ADAPTER = "0x5000000000000000000000000000000000000000" as Address;
const CURVE = "0x6000000000000000000000000000000000000000" as Address;
const ROUTER = "0x7000000000000000000000000000000000000000" as Address;
const PERMIT2 = "0x8000000000000000000000000000000000000000" as Address;
const OWNER = "0x9000000000000000000000000000000000000000" as Address;

const CONFIG: AlfaClubSudoswapMarketConfig = {
  pair: PAIR,
  adapter: ADAPTER,
  router: ROUTER,
  permit2: PERMIT2,
  factory: FACTORY,
  curve: CURVE,
};

type ReadRequest = {
  address: Address;
  functionName: string;
  args?: readonly unknown[];
};

function makePool(
  overrides: Partial<AlfaClubLiquidityPoolSummary> = {},
): AlfaClubLiquidityPoolSummary {
  return {
    pool: PAIR,
    owner: OWNER,
    creatorCoin: CREATOR_COIN,
    tokenId: 1659n,
    feeBps: 690,
    spotPrice: 20_000n,
    delta: 40n,
    roomType: 0,
    roomTier: 1,
    roomCreator: ROOM_CREATOR,
    creatorCoinName: "Akita Creator Coin",
    creatorCoinSymbol: "AKITA",
    creatorCoinDecimals: 18,
    creatorCoinBalance: 10_000n,
    keyBalance: 25n,
    factoryValid: true,
    routerAllowed: true,
    adapterMarketAllowed: true,
    configurationReady: true,
    ...overrides,
  };
}

describe("AlfaClub official Sudoswap market directory", () => {
  it("formats the pair fee after converting its 1e18 fixed-point value to bps", () => {
    expect(formatAlfaClubPoolFee(690)).toBe("6.9%");
    expect(formatAlfaClubPoolFee(3)).toBe("0.03%");
  });

  it("requires every official market deployment address", () => {
    expect(isAlfaClubSudoswapMarketConfigured(CONFIG)).toBe(true);
    expect(
      isAlfaClubSudoswapMarketConfigured({
        ...CONFIG,
        pair: "0x0000000000000000000000000000000000000000",
      }),
    ).toBe(false);
  });

  it("filters by creator coin, token ID, and pair address", () => {
    const pools = [makePool()];
    expect(filterAlfaClubLiquidityPools(pools, "akita")).toEqual(pools);
    expect(filterAlfaClubLiquidityPools(pools, "1659")).toEqual(pools);
    expect(filterAlfaClubLiquidityPools(pools, PAIR.slice(-8))).toEqual(pools);
    expect(filterAlfaClubLiquidityPools(pools, "missing")).toEqual([]);
  });

  it("filters room markets by exact FriendKey token ID", () => {
    const roomPool = makePool();
    const differentRoom = makePool({
      pool: "0x7000000000000000000000000000000000000000",
      tokenId: 16590n,
    });
    expect(
      filterAlfaClubLiquidityPoolsByRoomId([roomPool, differentRoom], "1659"),
    ).toEqual([roomPool]);
    expect(
      filterAlfaClubLiquidityPoolsByRoomId([roomPool], "not-a-room"),
    ).toEqual([]);
  });

  it("reads the configured official pair, real balances, virtual reserves, and adapter market", async () => {
    const readContract = vi.fn(
      async (request: ReadRequest): Promise<unknown> => {
        switch (request.functionName) {
          case "name":
            return "Akita Creator Coin";
          case "symbol":
            return "AKITA";
          case "decimals":
            return 18;
          case "roomTypes":
            return 0;
          case "roomTiers":
            return 1;
          case "creatorByTokenId":
            return ROOM_CREATOR;
          default:
            throw new Error(`Unexpected direct read ${request.functionName}`);
        }
      },
    );
    const multicall = vi.fn(
      async ({ contracts }: { contracts: ReadRequest[] }) =>
        Promise.all(
          contracts.map(async (request) => {
            switch (request.functionName) {
              case "owner":
                return OWNER;
              case "factory":
                return FACTORY;
              case "pairVariant":
                return 3;
              case "poolType":
                return 2;
              case "token":
                return CREATOR_COIN;
              case "nft":
                return ALFACLUB.friendKey;
              case "nftId":
                return 1659n;
              case "bondingCurve":
                return CURVE;
              case "fee":
                return 69_000_000_000_000_000n;
              case "spotPrice":
                return 20_000n;
              case "delta":
                return 40n;
              case "isValidPair":
                return true;
              case "routerStatus":
                return [false, true] as const;
              case "friendKey":
                return ALFACLUB.friendKey;
              case "xykCurve":
                return CURVE;
              case "permit2":
                return PERMIT2;
              case "universalRouter":
                return ROUTER;
              case "SUDOSWAP_ADAPTER":
                return ADAPTER;
              case "markets":
                return [CREATOR_COIN, 1659n, true] as const;
              case "balanceOf":
                return getAddress(request.address) === getAddress(CREATOR_COIN)
                  ? 12_000n
                  : 24n;
              default:
                throw new Error(
                  `Unexpected multicall read ${request.functionName}`,
                );
            }
          }),
        ),
    );
    const client = { readContract, multicall } as unknown as PublicClient;

    const result = await readAlfaClubLiquidityPools(client, CONFIG);

    expect(result).toEqual({
      totalPoolCount: 1,
      isTruncated: false,
      pools: [
        expect.objectContaining({
          pool: getAddress(PAIR),
          owner: getAddress(OWNER),
          creatorCoin: getAddress(CREATOR_COIN),
          tokenId: 1659n,
          feeBps: 690,
          spotPrice: 20_000n,
          delta: 40n,
          creatorCoinBalance: 12_000n,
          keyBalance: 24n,
          routerAllowed: false,
          adapterMarketAllowed: true,
          configurationReady: true,
          roomType: 0,
          roomTier: 1,
          roomCreator: getAddress(ROOM_CREATOR),
          creatorCoinName: "Akita Creator Coin",
          creatorCoinSymbol: "AKITA",
        }),
      ],
    });
    expect(multicall).toHaveBeenCalledTimes(2);
    expect(multicall).toHaveBeenCalledWith(
      expect.objectContaining({
        contracts: expect.arrayContaining([
          expect.objectContaining({
            address: ADAPTER,
            functionName: "permit2",
          }),
          expect.objectContaining({
            address: ADAPTER,
            functionName: "universalRouter",
          }),
          expect.objectContaining({
            address: ROUTER,
            functionName: "SUDOSWAP_ADAPTER",
          }),
          expect.objectContaining({
            address: ADAPTER,
            functionName: "markets",
            args: [PAIR],
          }),
        ]),
      }),
    );
  });
});
