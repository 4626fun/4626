import { useQuery } from "@tanstack/react-query";
import { erc20Abi, getAddress, type Address, type PublicClient } from "viem";

import {
  ALFACLUB,
  ALFACLUB_SUDOSWAP_ADAPTER_ABI,
  ALFACLUB_UNIVERSAL_ROUTER_ABI,
  FRIEND_KEY_ABI,
  SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
  SUDOSWAP_PAIR_FACTORY_ABI,
} from "@/lib/alfaclub/contracts";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const SUDOSWAP_ERC1155_ERC20_VARIANT = 3;
const SUDOSWAP_TRADE_POOL_TYPE = 2;
const FEE_SCALE = 10n ** 18n;
const BPS_SCALE = 10_000n;
const ROOM_1659_TRADING_PAIR_FEE = 69_000_000_000_000_000n;

export type AlfaClubSudoswapMarketConfig = {
  pair: Address;
  adapter: Address;
  router: Address;
  permit2: Address;
  factory: Address;
  curve: Address;
};

type AlfaClubMarketReadClient = Pick<
  PublicClient,
  "multicall" | "readContract"
>;

export type AlfaClubLiquidityPoolSummary = {
  pool: Address;
  owner: Address;
  creatorCoin: Address;
  tokenId: bigint;
  feeBps: number;
  spotPrice: bigint;
  delta: bigint;
  roomType: number | null;
  roomTier: number | null;
  roomCreator: Address | null;
  creatorCoinName: string;
  creatorCoinSymbol: string;
  creatorCoinDecimals: number;
  creatorCoinBalance: bigint;
  keyBalance: bigint;
  factoryValid: boolean;
  routerAllowed: boolean;
  adapterMarketAllowed: boolean;
  configurationReady: boolean;
};

export type AlfaClubLiquidityPoolDirectory = {
  pools: AlfaClubLiquidityPoolSummary[];
  totalPoolCount: number;
  isTruncated: boolean;
};

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  return null;
}

function toAddressOrNull(value: unknown): Address | null {
  if (typeof value !== "string" || value.toLowerCase() === ZERO_ADDRESS)
    return null;
  try {
    return getAddress(value) as Address;
  } catch {
    return null;
  }
}

function addressesMatch(left: unknown, right: Address): boolean {
  if (typeof left !== "string") return false;
  try {
    return getAddress(left) === getAddress(right);
  } catch {
    return false;
  }
}

function feeToBps(fee: bigint): number {
  return Number((fee * BPS_SCALE) / FEE_SCALE);
}

export function isAlfaClubSudoswapMarketConfigured(
  config: AlfaClubSudoswapMarketConfig,
): boolean {
  return Object.values(config).every(
    (address) => address.toLowerCase() !== ZERO_ADDRESS,
  );
}

export function formatAlfaClubPoolFee(feeBps: number): string {
  const percent = feeBps / 100;
  return `${percent.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

export function filterAlfaClubLiquidityPools(
  pools: AlfaClubLiquidityPoolSummary[],
  search: string,
): AlfaClubLiquidityPoolSummary[] {
  const query = search.trim().toLowerCase();
  if (!query) return pools;
  return pools.filter((pool) => {
    return (
      pool.creatorCoinName.toLowerCase().includes(query) ||
      pool.creatorCoinSymbol.toLowerCase().includes(query) ||
      pool.tokenId.toString().includes(query) ||
      pool.creatorCoin.toLowerCase().includes(query) ||
      pool.pool.toLowerCase().includes(query)
    );
  });
}

export function filterAlfaClubLiquidityPoolsByRoomId(
  pools: AlfaClubLiquidityPoolSummary[],
  roomId: string,
): AlfaClubLiquidityPoolSummary[] {
  if (!/^\d+$/.test(roomId)) return [];
  const tokenId = BigInt(roomId);
  return pools.filter((pool) => pool.tokenId === tokenId);
}

export async function readAlfaClubLiquidityPools(
  publicClient: AlfaClubMarketReadClient,
  config: AlfaClubSudoswapMarketConfig,
): Promise<AlfaClubLiquidityPoolDirectory> {
  const pair = getAddress(config.pair) as Address;
  const adapter = getAddress(config.adapter) as Address;
  const router = getAddress(config.router) as Address;
  const permit2 = getAddress(config.permit2) as Address;
  const factory = getAddress(config.factory) as Address;
  const curve = getAddress(config.curve) as Address;

  const coreReads = (await publicClient.multicall({
    allowFailure: false,
    contracts: [
      {
        address: pair,
        abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
        functionName: "owner",
      },
      {
        address: pair,
        abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
        functionName: "factory",
      },
      {
        address: pair,
        abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
        functionName: "pairVariant",
      },
      {
        address: pair,
        abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
        functionName: "poolType",
      },
      {
        address: pair,
        abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
        functionName: "token",
      },
      {
        address: pair,
        abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
        functionName: "nft",
      },
      {
        address: pair,
        abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
        functionName: "nftId",
      },
      {
        address: pair,
        abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
        functionName: "bondingCurve",
      },
      {
        address: pair,
        abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
        functionName: "fee",
      },
      {
        address: pair,
        abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
        functionName: "spotPrice",
      },
      {
        address: pair,
        abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
        functionName: "delta",
      },
      {
        address: factory,
        abi: SUDOSWAP_PAIR_FACTORY_ABI,
        functionName: "isValidPair",
        args: [pair],
      },
      {
        address: factory,
        abi: SUDOSWAP_PAIR_FACTORY_ABI,
        functionName: "routerStatus",
        args: [adapter],
      },
      {
        address: adapter,
        abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
        functionName: "factory",
      },
      {
        address: adapter,
        abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
        functionName: "friendKey",
      },
      {
        address: adapter,
        abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
        functionName: "xykCurve",
      },
      {
        address: adapter,
        abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
        functionName: "permit2",
      },
      {
        address: adapter,
        abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
        functionName: "universalRouter",
      },
      {
        address: router,
        abi: ALFACLUB_UNIVERSAL_ROUTER_ABI,
        functionName: "SUDOSWAP_ADAPTER",
      },
      {
        address: adapter,
        abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
        functionName: "markets",
        args: [pair],
      },
    ],
  })) as unknown[];

  const owner = getAddress(coreReads[0] as Address) as Address;
  const pairFactory = coreReads[1];
  const pairVariant = toNullableNumber(coreReads[2]);
  const poolType = toNullableNumber(coreReads[3]);
  const creatorCoin = getAddress(coreReads[4] as Address) as Address;
  const nft = coreReads[5];
  const tokenId = coreReads[6] as bigint;
  const bondingCurve = coreReads[7];
  const fee = coreReads[8] as bigint;
  const spotPrice = coreReads[9] as bigint;
  const delta = coreReads[10] as bigint;
  const factoryValid = coreReads[11] === true;
  const routerStatus = coreReads[12] as readonly [boolean, boolean];
  const adapterFactory = coreReads[13];
  const adapterFriendKey = coreReads[14];
  const adapterCurve = coreReads[15];
  const adapterPermit2 = coreReads[16];
  const adapterRouter = coreReads[17];
  const routerAdapter = coreReads[18];
  const adapterMarket = coreReads[19] as readonly [Address, bigint, boolean];
  const routerAllowed = routerStatus[0] === true;
  const adapterMarketAllowed =
    adapterMarket[2] === true &&
    addressesMatch(adapterMarket[0], creatorCoin) &&
    adapterMarket[1] === tokenId;

  const [
    balances,
    nameRaw,
    symbolRaw,
    decimalsRaw,
    roomTypeRaw,
    roomTierRaw,
    roomCreatorRaw,
  ] = await Promise.all([
    publicClient.multicall({
      allowFailure: false,
      contracts: [
        {
          address: creatorCoin,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [pair],
        },
        {
          address: ALFACLUB.friendKey,
          abi: FRIEND_KEY_ABI,
          functionName: "balanceOf",
          args: [pair, tokenId],
        },
      ],
    }) as Promise<readonly [bigint, bigint]>,
    publicClient
      .readContract({
        address: creatorCoin,
        abi: erc20Abi,
        functionName: "name",
      })
      .catch(() => "Creator Coin"),
    publicClient
      .readContract({
        address: creatorCoin,
        abi: erc20Abi,
        functionName: "symbol",
      })
      .catch(() => "CREATOR"),
    publicClient
      .readContract({
        address: creatorCoin,
        abi: erc20Abi,
        functionName: "decimals",
      })
      .catch(() => 18),
    publicClient
      .readContract({
        address: ALFACLUB.friendKey,
        abi: FRIEND_KEY_ABI,
        functionName: "roomTypes",
        args: [tokenId],
      })
      .catch(() => null),
    publicClient
      .readContract({
        address: ALFACLUB.friendKey,
        abi: FRIEND_KEY_ABI,
        functionName: "roomTiers",
        args: [tokenId],
      })
      .catch(() => null),
    publicClient
      .readContract({
        address: ALFACLUB.friendKey,
        abi: FRIEND_KEY_ABI,
        functionName: "creatorByTokenId",
        args: [tokenId],
      })
      .catch(() => null),
  ]);

  const configurationReady =
    addressesMatch(pairFactory, factory) &&
    pairVariant === SUDOSWAP_ERC1155_ERC20_VARIANT &&
    poolType === SUDOSWAP_TRADE_POOL_TYPE &&
    addressesMatch(nft, ALFACLUB.friendKey) &&
    addressesMatch(bondingCurve, curve) &&
    fee === ROOM_1659_TRADING_PAIR_FEE &&
    factoryValid &&
    addressesMatch(adapterFactory, factory) &&
    addressesMatch(adapterFriendKey, ALFACLUB.friendKey) &&
    addressesMatch(adapterCurve, curve) &&
    addressesMatch(adapterPermit2, permit2) &&
    addressesMatch(adapterRouter, router) &&
    addressesMatch(routerAdapter, adapter) &&
    adapterMarketAllowed;

  return {
    pools: [
      {
        pool: pair,
        owner,
        creatorCoin,
        tokenId,
        feeBps: feeToBps(fee),
        spotPrice,
        delta,
        roomType: toNullableNumber(roomTypeRaw),
        roomTier: toNullableNumber(roomTierRaw),
        roomCreator: toAddressOrNull(roomCreatorRaw),
        creatorCoinName: typeof nameRaw === "string" ? nameRaw : "Creator Coin",
        creatorCoinSymbol:
          typeof symbolRaw === "string" ? symbolRaw : "CREATOR",
        creatorCoinDecimals:
          typeof decimalsRaw === "number" ? decimalsRaw : Number(decimalsRaw),
        creatorCoinBalance: balances[0],
        keyBalance: balances[1],
        factoryValid,
        routerAllowed,
        adapterMarketAllowed,
        configurationReady,
      },
    ],
    totalPoolCount: 1,
    isTruncated: false,
  };
}

export function useAlfaClubLiquidityPools(
  publicClient: AlfaClubMarketReadClient | undefined,
  config: AlfaClubSudoswapMarketConfig | null,
) {
  const configured = Boolean(
    config && isAlfaClubSudoswapMarketConfigured(config),
  );
  return useQuery({
    queryKey: [
      "alfaclub-sudoswap-markets",
      config?.pair.toLowerCase() ?? "",
      config?.adapter.toLowerCase() ?? "",
      config?.router.toLowerCase() ?? "",
      config?.permit2.toLowerCase() ?? "",
      config?.factory.toLowerCase() ?? "",
      config?.curve.toLowerCase() ?? "",
    ],
    enabled: Boolean(publicClient && configured),
    staleTime: 20_000,
    queryFn: async () => {
      if (!publicClient || !config)
        throw new Error("AlfaClub Sudoswap market is unavailable");
      return readAlfaClubLiquidityPools(publicClient, config);
    },
  });
}
