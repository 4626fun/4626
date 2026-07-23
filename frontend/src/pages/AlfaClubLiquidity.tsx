import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownUp, Coins, ShoppingCart } from "lucide-react";
import {
  erc20Abi,
  encodeFunctionData,
  formatUnits,
  getAddress,
  parseEther,
  type Address,
} from "viem";
import { base } from "viem/chains";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from "wagmi";

import { InfoHint } from "@/components/alfaclub/InfoHint";
import { SwapCard } from "@/components/swap/SwapCard";
import { TokenAvatar } from "@/components/swap/TokenAvatar";
import { toast } from "@/components/ui/Toast";
import { DEFAULT_CHAIN_ID } from "@/config/chains";
import { ALFACLUB_ORIGIN } from "@/lib/env/host";
import { CONTRACTS } from "@/config/contracts";
import {
  ALFACLUB,
  ALFACLUB_SUDOSWAP_ADAPTER_ABI,
  ALFACLUB_UNIVERSAL_ROUTER_ABI,
  FRIEND_KEY_ABI,
  PERMIT2_ALLOWANCE_TRANSFER_ABI,
  SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
  SUDOSWAP_PAIR_FACTORY_ABI,
  SUDOSWAP_XYK_CURVE_ABI,
} from "@/lib/alfaclub/contracts";
import { amountUnitsFromBalancePercent } from "@/lib/swap/swapDisplayAmount";
import {
  formatAlfaClubKeyLabel,
  resolveAlfaClubKeyImageUrl,
} from "@/lib/swap/alfaclubRoomTokens";
import {
  creatorCoinRawLogo,
  NATIVE_TOKEN_ADDRESS,
  uniswapChainLogo,
  type TokenDisplay,
} from "@/lib/uniswap/swapUtils";
import {
  addSlippageBps,
  buildAlfaClubSudoswapCalls,
  subtractSlippageBps,
  type AlfaClubSudoswapDirection,
  type Permit2AllowanceSnapshot,
} from "@/lib/alfaclub/sudoswapRouter";
import {
  deriveSudoswapQuotePreview,
  type SudoswapQuoteValues,
} from "@/lib/alfaclub/sudoswapLiquidity";
import {
  buildAlfaClubEthFundingCalls,
  BASE_WETH_TOKEN,
  ZORA_NATIVE_ETH_TOKEN,
} from "@/lib/alfaclub/ethFundingRouter";
import {
  buildSwapFromZoraQuote,
  fetchZoraTradeQuoteFromApi,
  signZoraQuotePermits,
  zoraTradeQuoteToResponse,
} from "@/lib/zora/zoraTradeApi";
import {
  buildAndSendCalls,
  type TxRouterContext,
  type UserExecutionTrack,
} from "@/lib/tx/txRouter";
import type { TransactionRequest } from "@/lib/uniswap/tradingApi";
import { useAccountContext } from "@/wallet/accountContext";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const ROOM_1659_CREATOR_COIN = getAddress(
  "0x5b674196812451b7cec024fe9d22d2c0b172fa75",
);
const ROOM_1659_TOKEN_ID = 1659n;
const ROOM_1659_TRADING_PAIR_FEE = 69_000_000_000_000_000n;
const QUOTE_DEADLINE_SECONDS = 600n;

export const ALFACLUB_MAX_KEY_AMOUNT = 100n;
export const ALFACLUB_MAX_SLIPPAGE_BPS = 500n;

type LegacyMode = "create" | "add" | "buy" | "sell" | "remove";
type Mode = AlfaClubSudoswapDirection | "buyWithEth";

type Quote = SudoswapQuoteValues;

export type AlfaClubSudoswapSnapshot = {
  creatorCoinName: string;
  creatorCoinSymbol: string;
  creatorCoinDecimals: number;
  creatorCoinBalance: bigint;
  keyBalance: bigint;
  erc20AllowanceToPermit2: bigint;
  permit2AllowanceToAdapter: Permit2AllowanceSnapshot;
  keyApprovedForAdapter: boolean;
  pairCreatorCoinBalance: bigint;
  pairKeyBalance: bigint;
  spotPrice: bigint;
  delta: bigint;
  fee: bigint;
  buyQuote: Quote;
  sellQuote: Quote;
  oneKeyBuyQuote: Quote;
  oneKeySellQuote: Quote;
};

export function getAlfaClubLiquidityDisabledReason(params: {
  configReady: boolean;
  requestedMarketMatches: boolean;
  executionAddress: Address | null;
  loading: boolean;
  snapshot: AlfaClubSudoswapSnapshot | null;
  mode: Mode;
  keyAmount: bigint | null;
  ethAmount?: bigint | null;
}): string | null {
  if (!params.configReady)
    return "Official Sudoswap market deployment is not configured";
  if (!params.requestedMarketMatches)
    return "No official Sudoswap market is configured for this key";
  if (!params.executionAddress) return "Connect an execution-ready wallet";
  if (!params.keyAmount) return "Enter a positive key amount";
  if (params.mode === "buyWithEth" && !params.ethAmount)
    return "Enter a positive ETH amount";
  if (params.keyAmount > ALFACLUB_MAX_KEY_AMOUNT)
    return "Key amount exceeds the supported maximum of 100";
  if (params.loading) return "Verifying the live Sudoswap market";
  if (!params.snapshot) return "Onchain market verification failed";

  const quote =
    params.mode === "sell"
      ? params.snapshot.sellQuote
      : params.snapshot.buyQuote;
  if (quote.errorCode !== 0n || quote.amount <= 0n)
    return "A live Sudoswap quote is unavailable";
  if (params.mode === "buy" || params.mode === "buyWithEth") {
    if (params.snapshot.pairKeyBalance < params.keyAmount)
      return "The pair has insufficient key inventory";
    if (
      params.mode === "buy" &&
      params.snapshot.creatorCoinBalance < quote.amount
    )
      return "Creator Coin balance is too low";
  } else {
    if (params.snapshot.keyBalance < params.keyAmount)
      return "FriendKey balance is too low";
    if (
      params.snapshot.pairCreatorCoinBalance <
      quote.amount + quote.protocolFee + quote.royaltyAmount
    ) {
      return "The pair has insufficient Creator Coin inventory";
    }
  }
  return null;
}

function configuredAddress(value: Address | null | undefined): Address | null {
  if (!value || value.toLowerCase() === ZERO_ADDRESS) return null;
  return getAddress(value);
}

function parsePositiveBigInt(value: string): bigint | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const amount = BigInt(normalized);
  return amount > 0n ? amount : null;
}

function parsePositiveEther(value: string): bigint | null {
  try {
    const amount = parseEther(value.trim());
    return amount > 0n ? amount : null;
  } catch {
    return null;
  }
}

export function parseSlippageBps(value: string): bigint {
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0) return 100n;
  return BigInt(
    Math.min(Number(ALFACLUB_MAX_SLIPPAGE_BPS), Math.floor(percent * 100)),
  );
}

function normalizeQuote(
  value: readonly [number, bigint, bigint, bigint, bigint, bigint],
  curveValue?: readonly [number, bigint, bigint, bigint, bigint, bigint],
): Quote {
  return {
    errorCode: BigInt(value[0]),
    newSpotPrice: value[1],
    newDelta: value[2],
    amount: value[3],
    tradeFee: curveValue?.[4] ?? 0n,
    protocolFee: value[4],
    royaltyAmount: value[5],
  };
}

function formatTokenAmount(
  value: bigint | null | undefined,
  decimals: number,
): string {
  if (value === null || value === undefined) return "--";
  const [whole = "0", fraction = ""] = formatUnits(value, decimals).split(".");
  const shortFraction = fraction.replace(/0+$/, "").slice(0, 6);
  return shortFraction ? `${whole}.${shortFraction}` : whole;
}

function shortAddress(value: string | null | undefined): string {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "--";
}

type AlfaClubLiquidityProps = {
  initialCreatorCoin?: Address | null;
  initialTokenId?: bigint | null;
  initialMode?: LegacyMode | "buyWithEth";
  embedded?: boolean;
  initialImageUrl?: string | null;
  initialKeyLabel?: string | null;
  onOpenTokenSelector?: (side: "input" | "output") => void;
  onSwitchTokens?: () => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  forcePrimaryActionEnabled?: boolean;
  primaryActionHint?: string | null;
};

export function AlfaClubLiquidity({
  initialCreatorCoin = null,
  initialTokenId = null,
  initialMode = "buy",
  embedded = false,
  initialImageUrl = null,
  initialKeyLabel = null,
  onOpenTokenSelector,
  onSwitchTokens,
  primaryActionLabel: primaryActionLabelOverride,
  onPrimaryAction,
  forcePrimaryActionEnabled,
  primaryActionHint = null,
}: AlfaClubLiquidityProps = {}) {
  const queryClient = useQueryClient();
  const account = useAccount();
  const accountContext = useAccountContext();
  const publicClient = usePublicClient({ chainId: base.id });
  const { data: walletClient } = useWalletClient({ chainId: base.id });
  const { switchChainAsync, isPending: switchingChain } = useSwitchChain();

  const [mode, setMode] = useState<Mode>(() => {
    if (initialMode === "sell") return "sell";
    if (initialMode === "buyWithEth") return "buyWithEth";
    return "buy";
  });

  useEffect(() => {
    if (!embedded) return;
    if (initialMode === "sell") {
      setMode("sell");
      return;
    }
    if (initialMode === "buyWithEth") {
      setMode("buyWithEth");
      return;
    }
    // Keep an active ETH funding mode; otherwise default to creator-coin buy.
    setMode((current) => (current === "buyWithEth" ? current : "buy"));
  }, [embedded, initialMode]);
  const [keyAmountInput, setKeyAmountInput] = useState("1");
  const [ethAmountInput, setEthAmountInput] = useState("0.001");
  const [slippageInput, setSlippageInput] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastHash, setLastHash] = useState<string | null>(null);

  const router = configuredAddress(CONTRACTS.alfaClubUniversalRouter);
  const adapter = configuredAddress(CONTRACTS.alfaClubSudoswapAdapter);
  const pair = configuredAddress(CONTRACTS.room1659SudoswapPair);
  const factory = configuredAddress(CONTRACTS.sudoswapPairFactory);
  const xykCurve = configuredAddress(CONTRACTS.sudoswapXykCurve);
  const permit2 = configuredAddress(CONTRACTS.permit2);
  const configReady = Boolean(
    router && adapter && pair && factory && xykCurve && permit2,
  );
  const requestedMarketMatches =
    (!initialCreatorCoin ||
      getAddress(initialCreatorCoin) === ROOM_1659_CREATOR_COIN) &&
    (!initialTokenId || initialTokenId === ROOM_1659_TOKEN_ID);
  const keyAmount = useMemo(
    () => parsePositiveBigInt(keyAmountInput),
    [keyAmountInput],
  );
  const ethAmount = useMemo(
    () => parsePositiveEther(ethAmountInput),
    [ethAmountInput],
  );
  const slippageBps = useMemo(
    () => parseSlippageBps(slippageInput),
    [slippageInput],
  );

  const executionMode =
    accountContext.activeAccountType === "SMART_WALLET" ? "canonical" : "eoa";
  // Match /swap sender resolution: prefer the active account, then the profile CSW
  // (session can be execution-ready via CSW even when wagmi has no signer yet).
  const executionAddress = (accountContext.activeAccount ??
    accountContext.cswAddress ??
    (executionMode === "eoa"
      ? (accountContext.signerAddress ?? account.address ?? null)
      : null)) as Address | null;

  const marketQuery = useQuery({
    queryKey: [
      "alfaclub-sudoswap-market",
      pair?.toLowerCase() ?? "",
      executionAddress?.toLowerCase() ?? "",
    ],
    enabled: Boolean(
      configReady &&
        requestedMarketMatches &&
        publicClient &&
        executionAddress,
    ),
    staleTime: 12_000,
    queryFn: async (): Promise<
      Omit<AlfaClubSudoswapSnapshot, "buyQuote" | "sellQuote"> & {
        protocolFeeMultiplier: bigint;
      }
    > => {
      if (
        !publicClient ||
        !executionAddress ||
        !router ||
        !adapter ||
        !pair ||
        !factory ||
        !xykCurve ||
        !permit2
      ) {
        throw new Error("Official AlfaClub market configuration is incomplete");
      }

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
        market,
        routerAdapter,
      ] = await Promise.all([
        publicClient.readContract({
          address: factory,
          abi: SUDOSWAP_PAIR_FACTORY_ABI,
          functionName: "isValidPair",
          args: [pair],
        }),
        publicClient.readContract({
          address: pair,
          abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
          functionName: "factory",
        }),
        publicClient.readContract({
          address: pair,
          abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
          functionName: "pairVariant",
        }),
        publicClient.readContract({
          address: pair,
          abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
          functionName: "poolType",
        }),
        publicClient.readContract({
          address: pair,
          abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
          functionName: "token",
        }),
        publicClient.readContract({
          address: pair,
          abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
          functionName: "nft",
        }),
        publicClient.readContract({
          address: pair,
          abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
          functionName: "nftId",
        }),
        publicClient.readContract({
          address: pair,
          abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
          functionName: "bondingCurve",
        }),
        publicClient.readContract({
          address: pair,
          abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
          functionName: "fee",
        }),
        publicClient.readContract({
          address: adapter,
          abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
          functionName: "factory",
        }),
        publicClient.readContract({
          address: adapter,
          abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
          functionName: "permit2",
        }),
        publicClient.readContract({
          address: adapter,
          abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
          functionName: "friendKey",
        }),
        publicClient.readContract({
          address: adapter,
          abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
          functionName: "xykCurve",
        }),
        publicClient.readContract({
          address: adapter,
          abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
          functionName: "universalRouter",
        }),
        publicClient.readContract({
          address: adapter,
          abi: ALFACLUB_SUDOSWAP_ADAPTER_ABI,
          functionName: "markets",
          args: [pair],
        }),
        publicClient.readContract({
          address: router,
          abi: ALFACLUB_UNIVERSAL_ROUTER_ABI,
          functionName: "SUDOSWAP_ADAPTER",
        }),
      ]);

      const invariantOk =
        validPair &&
        getAddress(pairFactory) === factory &&
        Number(pairVariant) === 3 &&
        Number(poolType) === 2 &&
        getAddress(pairToken) === ROOM_1659_CREATOR_COIN &&
        getAddress(pairNft) === ALFACLUB.friendKey &&
        pairTokenId === ROOM_1659_TOKEN_ID &&
        getAddress(pairCurve) === xykCurve &&
        pairFee === ROOM_1659_TRADING_PAIR_FEE &&
        getAddress(adapterFactory) === factory &&
        getAddress(adapterPermit2) === permit2 &&
        getAddress(adapterFriendKey) === ALFACLUB.friendKey &&
        getAddress(adapterCurve) === xykCurve &&
        getAddress(adapterRouter) === router &&
        getAddress(routerAdapter) === adapter &&
        getAddress(market[0]) === ROOM_1659_CREATOR_COIN &&
        market[1] === ROOM_1659_TOKEN_ID &&
        market[2];
      if (!invariantOk)
        throw new Error(
          "Configured Sudoswap market failed live invariant checks",
        );

      const [spotPrice, delta, fee, protocolFeeMultiplier] = await Promise.all([
        publicClient.readContract({
          address: pair,
          abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
          functionName: "spotPrice",
        }),
        publicClient.readContract({
          address: pair,
          abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
          functionName: "delta",
        }),
        publicClient.readContract({
          address: pair,
          abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
          functionName: "fee",
        }),
        publicClient.readContract({
          address: factory,
          abi: SUDOSWAP_PAIR_FACTORY_ABI,
          functionName: "protocolFeeMultiplier",
        }),
      ]);

      const [
        name,
        symbol,
        decimals,
        creatorCoinBalance,
        erc20AllowanceToPermit2,
        permit2Allowance,
        keyBalance,
        keyApprovedForAdapter,
        pairCreatorCoinBalance,
        pairKeyBalance,
        oneKeyBuyQuote,
        oneKeySellQuote,
        oneKeyBuyCurveQuote,
        oneKeySellCurveQuote,
      ] = await Promise.all([
        publicClient
          .readContract({
            address: ROOM_1659_CREATOR_COIN,
            abi: erc20Abi,
            functionName: "name",
          })
          .catch(() => "Creator Coin"),
        publicClient
          .readContract({
            address: ROOM_1659_CREATOR_COIN,
            abi: erc20Abi,
            functionName: "symbol",
          })
          .catch(() => "CREATOR"),
        publicClient
          .readContract({
            address: ROOM_1659_CREATOR_COIN,
            abi: erc20Abi,
            functionName: "decimals",
          })
          .catch(() => 18),
        publicClient.readContract({
          address: ROOM_1659_CREATOR_COIN,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [executionAddress],
        }),
        publicClient.readContract({
          address: ROOM_1659_CREATOR_COIN,
          abi: erc20Abi,
          functionName: "allowance",
          args: [executionAddress, permit2],
        }),
        publicClient.readContract({
          address: permit2,
          abi: PERMIT2_ALLOWANCE_TRANSFER_ABI,
          functionName: "allowance",
          args: [executionAddress, ROOM_1659_CREATOR_COIN, adapter],
        }),
        publicClient.readContract({
          address: ALFACLUB.friendKey,
          abi: FRIEND_KEY_ABI,
          functionName: "balanceOf",
          args: [executionAddress, ROOM_1659_TOKEN_ID],
        }),
        publicClient.readContract({
          address: ALFACLUB.friendKey,
          abi: FRIEND_KEY_ABI,
          functionName: "isApprovedForAll",
          args: [executionAddress, adapter],
        }),
        publicClient.readContract({
          address: ROOM_1659_CREATOR_COIN,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [pair],
        }),
        publicClient.readContract({
          address: ALFACLUB.friendKey,
          abi: FRIEND_KEY_ABI,
          functionName: "balanceOf",
          args: [pair, ROOM_1659_TOKEN_ID],
        }),
        publicClient.readContract({
          address: pair,
          abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
          functionName: "getBuyNFTQuote",
          args: [ROOM_1659_TOKEN_ID, 1n],
        }),
        publicClient.readContract({
          address: pair,
          abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
          functionName: "getSellNFTQuote",
          args: [ROOM_1659_TOKEN_ID, 1n],
        }),
        publicClient.readContract({
          address: xykCurve,
          abi: SUDOSWAP_XYK_CURVE_ABI,
          functionName: "getBuyInfo",
          args: [spotPrice, delta, 1n, fee, protocolFeeMultiplier],
        }),
        publicClient.readContract({
          address: xykCurve,
          abi: SUDOSWAP_XYK_CURVE_ABI,
          functionName: "getSellInfo",
          args: [spotPrice, delta, 1n, fee, protocolFeeMultiplier],
        }),
      ]);

      return {
        creatorCoinName: name,
        creatorCoinSymbol: symbol,
        creatorCoinDecimals: Number(decimals),
        creatorCoinBalance,
        keyBalance,
        erc20AllowanceToPermit2,
        permit2AllowanceToAdapter: {
          amount: permit2Allowance[0],
          expiration: BigInt(permit2Allowance[1]),
        },
        keyApprovedForAdapter,
        pairCreatorCoinBalance,
        pairKeyBalance,
        spotPrice,
        delta,
        fee,
        protocolFeeMultiplier,
        oneKeyBuyQuote: normalizeQuote(oneKeyBuyQuote, oneKeyBuyCurveQuote),
        oneKeySellQuote: normalizeQuote(oneKeySellQuote, oneKeySellCurveQuote),
      };
    },
  });

  const quoteQuery = useQuery({
    queryKey: [
      "alfaclub-sudoswap-quote",
      pair?.toLowerCase() ?? "",
      keyAmount?.toString() ?? "",
      marketQuery.dataUpdatedAt,
    ],
    enabled: Boolean(
      marketQuery.data &&
        publicClient &&
        pair &&
        xykCurve &&
        keyAmount,
    ),
    staleTime: 8_000,
    queryFn: async (): Promise<{ buyQuote: Quote; sellQuote: Quote }> => {
      const market = marketQuery.data;
      if (!publicClient || !pair || !xykCurve || !keyAmount || !market) {
        throw new Error("Official AlfaClub market quote inputs are incomplete");
      }
      const { spotPrice, delta, fee, protocolFeeMultiplier } = market;
      const [buyQuote, sellQuote, buyCurveQuote, sellCurveQuote] =
        await Promise.all([
          publicClient.readContract({
            address: pair,
            abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
            functionName: "getBuyNFTQuote",
            args: [ROOM_1659_TOKEN_ID, keyAmount],
          }),
          publicClient.readContract({
            address: pair,
            abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
            functionName: "getSellNFTQuote",
            args: [ROOM_1659_TOKEN_ID, keyAmount],
          }),
          publicClient.readContract({
            address: xykCurve,
            abi: SUDOSWAP_XYK_CURVE_ABI,
            functionName: "getBuyInfo",
            args: [spotPrice, delta, keyAmount, fee, protocolFeeMultiplier],
          }),
          publicClient.readContract({
            address: xykCurve,
            abi: SUDOSWAP_XYK_CURVE_ABI,
            functionName: "getSellInfo",
            args: [spotPrice, delta, keyAmount, fee, protocolFeeMultiplier],
          }),
        ]);
      return {
        buyQuote: normalizeQuote(buyQuote, buyCurveQuote),
        sellQuote: normalizeQuote(sellQuote, sellCurveQuote),
      };
    },
  });

  const snapshotQuery = {
    isLoading: marketQuery.isLoading,
    isFetching: marketQuery.isFetching || quoteQuery.isFetching,
    error: marketQuery.error ?? quoteQuery.error,
    dataUpdatedAt: Math.max(marketQuery.dataUpdatedAt, quoteQuery.dataUpdatedAt),
  };

  const snapshot = useMemo<AlfaClubSudoswapSnapshot | null>(() => {
    const market = marketQuery.data
    if (!market) return null
    return {
      creatorCoinName: market.creatorCoinName,
      creatorCoinSymbol: market.creatorCoinSymbol,
      creatorCoinDecimals: market.creatorCoinDecimals,
      creatorCoinBalance: market.creatorCoinBalance,
      keyBalance: market.keyBalance,
      erc20AllowanceToPermit2: market.erc20AllowanceToPermit2,
      permit2AllowanceToAdapter: market.permit2AllowanceToAdapter,
      keyApprovedForAdapter: market.keyApprovedForAdapter,
      pairCreatorCoinBalance: market.pairCreatorCoinBalance,
      pairKeyBalance: market.pairKeyBalance,
      spotPrice: market.spotPrice,
      delta: market.delta,
      fee: market.fee,
      oneKeyBuyQuote: market.oneKeyBuyQuote,
      oneKeySellQuote: market.oneKeySellQuote,
      // Prefer live quantity quotes; fall back only while the qty quote is in flight.
      buyQuote: quoteQuery.data?.buyQuote ?? market.oneKeyBuyQuote,
      sellQuote: quoteQuery.data?.sellQuote ?? market.oneKeySellQuote,
    }
  }, [marketQuery.data, quoteQuery.data])

  const quantityQuote = quoteQuery.data
    ? mode === "sell"
      ? quoteQuery.data.sellQuote
      : quoteQuery.data.buyQuote
    : null;
  const quote = quantityQuote;
  const quotePreview = useMemo(() => {
    if (!snapshot || !keyAmount || !quantityQuote) return null;
    try {
      return deriveSudoswapQuotePreview({
        direction: mode === "sell" ? "sell" : "buy",
        quantity: keyAmount,
        quote: quantityQuote,
        oneItemQuote:
          mode === "sell" ? snapshot.oneKeySellQuote : snapshot.oneKeyBuyQuote,
        slippageBps,
      });
    } catch {
      return null;
    }
  }, [keyAmount, mode, quantityQuote, slippageBps, snapshot]);
  const decimals = snapshot?.creatorCoinDecimals ?? 18;
  const logoUrl = creatorCoinRawLogo(ROOM_1659_CREATOR_COIN, base.id);

  const buildTxContext = useCallback((): TxRouterContext => {
    if (!walletClient || !publicClient || !executionAddress)
      throw new Error("Wallet execution is not ready");
    return {
      chainId: base.id,
      executionMode,
      executionTrack: null as UserExecutionTrack | null,
      walletClient,
      publicClient,
      canonicalAddress: accountContext.cswAddress ?? null,
      signerAddress: accountContext.signerAddress ?? null,
      executionAddress,
      signerType: accountContext.signerType,
      connectorId: account.connector?.id ?? null,
      connectorName: account.connector?.name ?? null,
      capabilities: accountContext.capabilities,
      requireCanonicalSponsorship: executionMode === "canonical",
    };
  }, [
    account.connector?.id,
    account.connector?.name,
    accountContext.capabilities,
    accountContext.cswAddress,
    accountContext.signerAddress,
    accountContext.signerType,
    executionAddress,
    executionMode,
    publicClient,
    walletClient,
  ]);

  const submit = useCallback(async () => {
    if (
      !publicClient ||
      !executionAddress ||
      !keyAmount ||
      (mode === "buyWithEth" && !ethAmount) ||
      !router ||
      !adapter ||
      !pair ||
      !permit2
    ) {
      toast.error(
        "The official AlfaClub market or execution wallet is not ready.",
      );
      return;
    }
    if (account.chainId !== base.id) {
      await switchChainAsync({ chainId: base.id });
      // Continue after the wallet reports Base — avoid a dead-end second click.
    }

    setIsSubmitting(true);
    try {
      const deadline =
        BigInt(Math.floor(Date.now() / 1000)) + QUOTE_DEADLINE_SECONDS;
      const [
        freshQuoteRaw,
        freshPairFee,
        erc20Allowance,
        permit2Allowance,
        keyApproved,
        keyBalance,
        pairKeyBalance,
        pairCoinBalance,
      ] = await Promise.all([
        publicClient.readContract({
          address: pair,
          abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
          functionName: mode === "sell" ? "getSellNFTQuote" : "getBuyNFTQuote",
          args: [ROOM_1659_TOKEN_ID, keyAmount],
        }),
        publicClient.readContract({
          address: pair,
          abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
          functionName: "fee",
        }),
        publicClient.readContract({
          address: ROOM_1659_CREATOR_COIN,
          abi: erc20Abi,
          functionName: "allowance",
          args: [executionAddress, permit2],
        }),
        publicClient.readContract({
          address: permit2,
          abi: PERMIT2_ALLOWANCE_TRANSFER_ABI,
          functionName: "allowance",
          args: [executionAddress, ROOM_1659_CREATOR_COIN, adapter],
        }),
        publicClient.readContract({
          address: ALFACLUB.friendKey,
          abi: FRIEND_KEY_ABI,
          functionName: "isApprovedForAll",
          args: [executionAddress, adapter],
        }),
        publicClient.readContract({
          address: ALFACLUB.friendKey,
          abi: FRIEND_KEY_ABI,
          functionName: "balanceOf",
          args: [executionAddress, ROOM_1659_TOKEN_ID],
        }),
        publicClient.readContract({
          address: ALFACLUB.friendKey,
          abi: FRIEND_KEY_ABI,
          functionName: "balanceOf",
          args: [pair, ROOM_1659_TOKEN_ID],
        }),
        publicClient.readContract({
          address: ROOM_1659_CREATOR_COIN,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [pair],
        }),
      ]);
      const freshQuote = normalizeQuote(freshQuoteRaw);
      if (freshPairFee !== ROOM_1659_TRADING_PAIR_FEE) {
        throw new Error(
          "The Sudoswap pair trading fee no longer matches the AlfaClub market",
        );
      }
      if (freshQuote.errorCode !== 0n || freshQuote.amount <= 0n) {
        throw new Error("Sudoswap returned a non-executable quote");
      }
      if (
        (mode === "buy" || mode === "buyWithEth") &&
        pairKeyBalance < keyAmount
      )
        throw new Error("The pair no longer has enough keys");
      if (mode === "sell" && keyBalance < keyAmount)
        throw new Error("FriendKey balance is too low");
      if (
        mode === "sell" &&
        pairCoinBalance <
          freshQuote.amount + freshQuote.protocolFee + freshQuote.royaltyAmount
      ) {
        throw new Error("The pair no longer has enough Creator Coin inventory");
      }

      const limit =
        mode === "sell"
          ? subtractSlippageBps(freshQuote.amount, slippageBps)
          : addSlippageBps(freshQuote.amount, slippageBps);

      let calls: TransactionRequest[];
      if (mode === "buyWithEth") {
        if (!ethAmount) throw new Error("Enter a positive ETH amount");
        const canonicalEthFunding = executionMode === "canonical";
        const tokenIn = canonicalEthFunding
          ? BASE_WETH_TOKEN
          : ZORA_NATIVE_ETH_TOKEN;
        let zoraPayload = await fetchZoraTradeQuoteFromApi({
          tokenIn,
          tokenOut: ROOM_1659_CREATOR_COIN,
          amountIn: ethAmount.toString(),
          sender: executionAddress,
          slippagePct: Number(slippageInput),
        });
        let zoraQuote = zoraTradeQuoteToResponse({
          tokenIn,
          tokenOut: ROOM_1659_CREATOR_COIN,
          amountIn: ethAmount.toString(),
          payload: zoraPayload,
        });

        const preparatoryCalls: TransactionRequest[] = [];
        if (canonicalEthFunding) {
          if (!walletClient || !publicClient || !accountContext.signerAddress) {
            throw new Error(
              "Canonical ETH funding needs an owner signer and wallet client",
            );
          }
          const signatures = await signZoraQuotePermits({
            quote: zoraQuote,
            signerAddress: accountContext.signerAddress,
            executionAddress,
            forceResignPermits: true,
            walletClient: walletClient as any,
            publicClient: publicClient as any,
          });
          if (signatures.length === 0) {
            throw new Error("Zora did not return a WETH Permit2 authorization");
          }
          zoraPayload = await fetchZoraTradeQuoteFromApi({
            tokenIn,
            tokenOut: ROOM_1659_CREATOR_COIN,
            amountIn: ethAmount.toString(),
            sender: executionAddress,
            slippagePct: Number(slippageInput),
            signatures,
          });
          zoraQuote = zoraTradeQuoteToResponse({
            tokenIn,
            tokenOut: ROOM_1659_CREATOR_COIN,
            amountIn: ethAmount.toString(),
            payload: zoraPayload,
          });
          preparatoryCalls.push(
            {
              to: BASE_WETH_TOKEN,
              from: executionAddress,
              data: encodeFunctionData({
                abi: [
                  {
                    type: "function",
                    name: "deposit",
                    stateMutability: "payable",
                    inputs: [],
                    outputs: [],
                  },
                ] as const,
                functionName: "deposit",
              }),
              value: ethAmount.toString(),
              chainId: base.id,
            },
            {
              to: BASE_WETH_TOKEN,
              from: executionAddress,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [permit2, ethAmount],
              }),
              value: "0",
              chainId: base.id,
            },
          );
        }

        const { swap: fundingSwap } = buildSwapFromZoraQuote({
          quote: zoraQuote,
          executionAddress,
          chainId: base.id,
        });
        const fundingOutputAmount = BigInt(
          String(zoraPayload.quote?.amountOut ?? "0"),
        );
        if (fundingOutputAmount <= 0n) {
          throw new Error("Zora returned no AKITA output for this ETH quote");
        }

        calls = buildAlfaClubEthFundingCalls({
          fundingSwap,
          preparatoryCalls,
          fundingOutputAmount,
          sender: executionAddress,
          router,
          adapter,
          permit2,
          friendKey: ALFACLUB.friendKey,
          creatorCoin: ROOM_1659_CREATOR_COIN,
          pair,
          keyAmount,
          buyLimit: limit,
          deadline,
          erc20AllowanceToPermit2: erc20Allowance,
          permit2AllowanceToAdapter: {
            amount: permit2Allowance[0],
            expiration: BigInt(permit2Allowance[1]),
          },
        });
      } else {
        calls = buildAlfaClubSudoswapCalls({
          direction: mode,
          router,
          adapter,
          permit2,
          friendKey: ALFACLUB.friendKey,
          creatorCoin: ROOM_1659_CREATOR_COIN,
          pair,
          sender: executionAddress,
          keyAmount,
          limit,
          deadline,
          erc20AllowanceToPermit2: erc20Allowance,
          permit2AllowanceToAdapter: {
            amount: permit2Allowance[0],
            expiration: BigInt(permit2Allowance[1]),
          },
          keyApprovedForAdapter: keyApproved,
        });
      }

      const result = await buildAndSendCalls({
        context: buildTxContext(),
        calls,
      });
      const hash =
        result.send.transactionHash ??
        result.send.txHashes.at(-1) ??
        result.send.callsId ??
        null;
      setLastHash(hash);
      toast.success(
        mode === "buyWithEth"
          ? "ETH → ZORA → AKITA → FriendKey submitted."
          : `AlfaClub ${mode} submitted through the Universal Router.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["alfaclub-sudoswap-market"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["alfaclub-sudoswap-quote"],
        }),
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "AlfaClub swap failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    account.chainId,
    accountContext.signerAddress,
    adapter,
    buildTxContext,
    ethAmount,
    executionAddress,
    executionMode,
    keyAmount,
    mode,
    pair,
    permit2,
    publicClient,
    queryClient,
    router,
    slippageBps,
    slippageInput,
    switchChainAsync,
    walletClient,
  ]);

  const disabledReason = getAlfaClubLiquidityDisabledReason({
    configReady,
    requestedMarketMatches,
    executionAddress,
    loading: marketQuery.isLoading || (Boolean(keyAmount) && quoteQuery.isFetching && !quoteQuery.data),
    snapshot,
    mode,
    keyAmount,
    ethAmount,
  });

  const marketStats = (
    <dl
      className={
        embedded
          ? "grid grid-cols-2 gap-x-3 gap-y-3 text-xs"
          : "mt-4 grid grid-cols-2 gap-4 text-xs"
      }
    >
      <div className="min-w-0">
        <dt className="text-zinc-600">Actual keys</dt>
        <dd className="mt-1 truncate text-zinc-200">
          {snapshot?.pairKeyBalance.toString() ?? "--"}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-zinc-600">Actual coin</dt>
        <dd className="mt-1 truncate text-zinc-200">
          {formatTokenAmount(snapshot?.pairCreatorCoinBalance, decimals)}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-zinc-600">Virtual keys</dt>
        <dd className="mt-1 truncate text-zinc-200">
          {snapshot?.delta.toString() ?? "--"}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-zinc-600">Virtual coin</dt>
        <dd className="mt-1 truncate text-zinc-200">
          {formatTokenAmount(snapshot?.spotPrice, decimals)}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-zinc-600">Pair fee</dt>
        <dd className="mt-1 truncate text-zinc-200">
          {snapshot ? `${formatUnits(snapshot.fee, 16)}%` : "--"}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-zinc-600">Adapter</dt>
        <dd className="mt-1 truncate font-mono text-zinc-200">
          {shortAddress(adapter)}
        </dd>
      </div>
    </dl>
  );

  if (embedded) {
    const sellingKeys = mode === "sell";
    const keySymbol =
      initialKeyLabel?.trim() ||
      formatAlfaClubKeyLabel({
        keyId: ROOM_1659_TOKEN_ID,
        roomName: "AKITA",
      });
    const creatorSymbol = snapshot?.creatorCoinSymbol ?? "AKITA";
    const keyIdForImage = (initialTokenId ?? ROOM_1659_TOKEN_ID).toString();
    const keyImageUrl = resolveAlfaClubKeyImageUrl({
      keyId: keyIdForImage,
      imageUrl: initialImageUrl,
    });
    // Keep picker labels as the room name; disambiguate colliding coin/key chips here
    // (including case-only collisions like AKITA vs akita so the rate reads clearly).
    const keyChipSymbol =
      keySymbol.toLowerCase() === creatorSymbol.toLowerCase()
        ? `${keySymbol} key`
        : keySymbol;
    const keyDisplay: TokenDisplay = {
      symbol: keyChipSymbol,
      name: `AlfaClub · #${keyIdForImage}`,
      logoUrl: keyImageUrl,
    };
    const creatorDisplay: TokenDisplay = {
      symbol: creatorSymbol,
      name: snapshot?.creatorCoinName ?? "AKITA Creator Coin",
      logoUrl: logoUrl ?? null,
    };
    const payingWithEth = mode === "buyWithEth";
    const ethDisplay: TokenDisplay = {
      symbol: "ETH",
      name: "Ether",
      logoUrl: uniswapChainLogo(BASE_WETH_TOKEN, base.id),
    };
    const quotedCoinAmount =
      keyAmount && quote ? formatTokenAmount(quote.amount, decimals) : "";
    const keyBalanceForMax = sellingKeys
      ? (snapshot?.keyBalance ?? 0n)
      : (snapshot?.pairKeyBalance ?? 0n);
    const cappedKeyBalance =
      keyBalanceForMax > ALFACLUB_MAX_KEY_AMOUNT
        ? ALFACLUB_MAX_KEY_AMOUNT
        : keyBalanceForMax;
    const keyBalanceLabel = snapshot
      ? sellingKeys
        ? snapshot.keyBalance > ALFACLUB_MAX_KEY_AMOUNT
          ? `${snapshot.keyBalance.toString()} held · max 100`
          : `${snapshot.keyBalance.toString()} held`
        : `${cappedKeyBalance.toString()} available`
      : undefined;
    const coinBalanceLabel = snapshot
      ? `${formatTokenAmount(snapshot.creatorCoinBalance, decimals)} ${creatorSymbol}`
      : undefined;
    const softDisabledReason =
      !disabledReason ||
      disabledReason.startsWith("Enter a positive") ||
      disabledReason === "Verifying the live Sudoswap market" ||
      disabledReason === "Connect an execution-ready wallet";
    const hardError =
      snapshotQuery.error instanceof Error
        ? snapshotQuery.error.message
        : disabledReason && !softDisabledReason
          ? disabledReason
          : null;
    const priceImpactLabel = quotePreview
      ? `${(Number(quotePreview.priceImpactBps) / 100).toLocaleString("en-US", {
          maximumFractionDigits: 2,
        })}%`
      : null;

    return (
      <div className="relative min-w-0 space-y-3">
        {!sellingKeys ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-zinc-500">Pay with</span>
            <div className="inline-flex rounded-lg border border-white/[0.08] bg-black/30 p-0.5">
              <button
                type="button"
                onClick={() => setMode("buy")}
                className={
                  payingWithEth
                    ? "rounded-md px-2.5 py-1 text-zinc-500 transition hover:text-zinc-300"
                    : "rounded-md bg-brand-primary px-2.5 py-1 font-medium text-white"
                }
              >
                {creatorSymbol}
              </button>
              <button
                type="button"
                onClick={() => setMode("buyWithEth")}
                className={
                  payingWithEth
                    ? "rounded-md bg-brand-primary px-2.5 py-1 font-medium text-white"
                    : "rounded-md px-2.5 py-1 text-zinc-500 transition hover:text-zinc-300"
                }
              >
                ETH
              </button>
            </div>
            {payingWithEth ? (
              <>
                <span className="text-zinc-600">ETH → ZORA → {creatorSymbol} → key</span>
                <label className="ml-auto inline-flex items-center gap-1.5 text-zinc-500">
                  Keys
                  <input
                    type="text"
                    inputMode="numeric"
                    value={keyAmountInput}
                    onChange={(event) =>
                      setKeyAmountInput(event.target.value.replace(/[^\d]/g, ""))
                    }
                    className="h-7 w-14 rounded-md border border-white/[0.08] bg-black/40 px-2 text-right tabular-nums text-zinc-200 outline-none focus:border-brand-primary/40"
                    aria-label="Key quantity to buy"
                  />
                </label>
              </>
            ) : null}
          </div>
        ) : null}
        <SwapCard
          tokenInDisplay={
            sellingKeys ? keyDisplay : payingWithEth ? ethDisplay : creatorDisplay
          }
          tokenOutDisplay={sellingKeys ? creatorDisplay : keyDisplay}
          tokenInIdentityLoading={!snapshot && snapshotQuery.isLoading}
          tokenOutIdentityLoading={!snapshot && snapshotQuery.isLoading}
          // Creator-coin buy: edit key qty on Buy. ETH funding: edit ETH on Sell,
          // keep key qty on Buy via estimatedOut + amountEditSide sell.
          amountInUnits={payingWithEth ? ethAmountInput : keyAmountInput}
          estimatedOut={
            payingWithEth
              ? keyAmountInput
              : quotedCoinAmount === "--"
                ? ""
                : quotedCoinAmount
          }
          buyQuoteLoading={
            payingWithEth
              ? false
              : Boolean(keyAmount) && quoteQuery.isFetching && !quote
          }
          estimatedOutUsd={null}
          tokenInSymbol={
            sellingKeys ? keyChipSymbol : payingWithEth ? "ETH" : creatorSymbol
          }
          tokenOutSymbol={sellingKeys ? creatorSymbol : keyChipSymbol}
          tokenInBalanceLabel={
            sellingKeys ? keyBalanceLabel : payingWithEth ? undefined : coinBalanceLabel
          }
          tokenOutBalanceLabel={sellingKeys ? coinBalanceLabel : keyBalanceLabel}
          tokenInAddress={
            sellingKeys
              ? ALFACLUB.friendKey
              : payingWithEth
                ? NATIVE_TOKEN_ADDRESS
                : ROOM_1659_CREATOR_COIN
          }
          tokenOutAddress={
            sellingKeys ? ROOM_1659_CREATOR_COIN : ALFACLUB.friendKey
          }
          isConnected={Boolean(executionAddress)}
          isReady={!disabledReason && !isSubmitting && !switchingChain}
          busy={isSubmitting ? "submit" : switchingChain ? "chain" : null}
          status={lastHash}
          error={hardError}
          routeSummary={
            payingWithEth ? "ETH → ZORA → AKITA → Sudoswap" : "Sudoswap v2"
          }
          gasEstimateLabel={
            executionMode === "canonical" ? "Sponsored" : null
          }
          priceImpactLabel={priceImpactLabel}
          selectedChainId={DEFAULT_CHAIN_ID}
          walletChainId={account.chainId}
          onSelectChain={(chainId) => {
            if (chainId === base.id) {
              void switchChainAsync({ chainId: base.id }).catch(() => {});
            }
          }}
          slippagePct={slippageInput}
          slippageIsAuto={false}
          onOpenTokenSelector={(side) => onOpenTokenSelector?.(side)}
          onAmountChange={(value) => {
            if (payingWithEth) {
              setEthAmountInput(value.replace(/[^0-9.]/g, ""))
              return
            }
            setKeyAmountInput(value.replace(/[^\d]/g, ""))
          }}
          onQuickPercent={(pct) => {
            if (payingWithEth) return
            setKeyAmountInput(
              amountUnitsFromBalancePercent(
                { raw: cappedKeyBalance, decimals: 0 },
                pct,
              ),
            );
          }}
          onSwitchTokens={() => {
            if (onSwitchTokens) {
              onSwitchTokens();
              return;
            }
            setMode((current) => (current === "sell" ? "buy" : "sell"));
          }}
          onReviewTrade={() => {
            void submit();
          }}
          onSetSlippagePct={setSlippageInput}
          executionMode={executionMode}
          fallbackActive={false}
          swapProviderLabel="Sudoswap"
          quoteAggregatorLabel="Sudoswap"
          amountEditSide={sellingKeys || payingWithEth ? "sell" : "buy"}
          primaryActionLabel={
            primaryActionLabelOverride ??
            (!executionAddress
              ? "Connect wallet"
              : switchingChain
                ? "Switching chain"
                : isSubmitting
                  ? "Submitting…"
                  : sellingKeys
                    ? `Sell ${keySymbol}`
                    : payingWithEth
                      ? `Buy ${keyAmountInput || "1"} ${keySymbol} with ETH`
                      : `Buy ${keySymbol}`)
          }
          onPrimaryAction={onPrimaryAction}
          forcePrimaryActionEnabled={forcePrimaryActionEnabled}
          primaryActionHint={
            primaryActionHint ??
            (!executionAddress
              ? "Sign in to use your 4626 wallet for this key market."
              : null)
          }
        />

        <section className="min-w-0 space-y-3 border-t border-white/[0.06] px-0.5 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.01em] text-zinc-300">
                <a
                  href="https://sudoswap.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-1.5 truncate transition-colors hover:text-white"
                >
                  <img
                    src="/brands/sudoswap.png"
                    alt=""
                    className="h-3.5 w-3.5 rounded-full object-cover"
                    loading="lazy"
                  />
                  <span className="truncate">Sudoswap market</span>
                </a>
                <InfoHint
                  label="About Sudoswap"
                  content={
                    <>
                      <p>
                        Sudoswap is an NFT AMM that prices ERC-1155 keys against an ERC-20 in a bonding-curve pool.
                      </p>
                      <p className="text-zinc-400">
                        This market settles FriendKey trades on Sudoswap&apos;s Base v2 pair.
                      </p>
                    </>
                  }
                />
              </p>
              <p className="flex max-w-full items-center gap-1.5 truncate text-[11px] text-zinc-600">
                <a
                  href={ALFACLUB_ORIGIN}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-1.5 truncate transition-colors hover:text-zinc-300"
                >
                  <img
                    src="/protocols/alfaclub.svg"
                    alt=""
                    className="h-3.5 w-3.5 shrink-0 object-contain"
                    loading="lazy"
                  />
                  <span className="truncate">AlfaClub Key</span>
                </a>
                <InfoHint
                  label="About AlfaClub"
                  content={
                    <>
                      <p>
                        AlfaClub keys are ERC-1155 FriendKeys that gate rooms and settle against the creator coin.
                      </p>
                      <p className="text-zinc-400">
                        Open AlfaClub for rooms, chat, and key safety context.
                      </p>
                    </>
                  }
                />
              </p>
            </div>
            <span className="shrink-0 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-medium tabular-nums text-zinc-400">
              {snapshot ? `${formatUnits(snapshot.fee, 16)}% fee` : "—"}
            </span>
          </div>

          {snapshotQuery.isLoading && !snapshot ? (
            <div className="space-y-2" aria-label="Loading market">
              <div className="h-3 w-24 animate-pulse rounded bg-white/[0.05]" />
              <div className="h-8 animate-pulse rounded bg-white/[0.07]" />
              <div className="h-8 animate-pulse rounded bg-white/[0.07]" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/20">
              <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-white/[0.06] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-600">
                <span>Asset</span>
                <span className="text-right">Pool</span>
                <span className="text-right">Virtual</span>
              </div>
              <div className="divide-y divide-white/[0.05]">
                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 text-xs">
                  <div className="flex min-w-0 items-center gap-1.5 text-zinc-300">
                    <TokenAvatar
                      token={{
                        address: ALFACLUB.friendKey,
                        symbol: keyChipSymbol,
                        logoUrl: keyImageUrl ?? undefined,
                      }}
                      symbol={keyChipSymbol}
                      size={16}
                    />
                    <span className="truncate">ERC-1155</span>
                  </div>
                  <div className="truncate text-right tabular-nums text-zinc-100">
                    {snapshot?.pairKeyBalance.toString() ?? "—"}
                  </div>
                  <div className="truncate text-right tabular-nums text-zinc-500">
                    {snapshot?.delta.toString() ?? "—"}
                  </div>
                </div>
                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 text-xs">
                  <div className="flex min-w-0 items-center gap-1.5 text-zinc-300">
                    <TokenAvatar
                      token={{
                        address: ROOM_1659_CREATOR_COIN,
                        symbol: creatorSymbol,
                        logoUrl: logoUrl ?? undefined,
                      }}
                      symbol={creatorSymbol}
                      size={16}
                    />
                    <span className="truncate">ERC-20</span>
                  </div>
                  <div className="truncate text-right tabular-nums text-zinc-100">
                    {formatTokenAmount(snapshot?.pairCreatorCoinBalance, decimals)}
                  </div>
                  <div className="truncate text-right tabular-nums text-zinc-500">
                    {formatTokenAmount(snapshot?.spotPrice, decimals)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  const quotePreviewRows = quotePreview ? (
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/[0.07] pt-4 text-xs sm:grid-cols-3">
      <div className="min-w-0">
        <dt className="text-zinc-600">
          {mode === "sell" ? "You receive" : "You pay"}
        </dt>
        <dd className="mt-1 truncate text-zinc-200">
          {formatTokenAmount(quotePreview.amount, decimals)}{" "}
          {snapshot?.creatorCoinSymbol}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-zinc-600">Effective / key</dt>
        <dd className="mt-1 truncate text-zinc-200">
          {formatTokenAmount(quotePreview.effectiveUnitPrice, decimals)}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-zinc-600">Price impact</dt>
        <dd className="mt-1 truncate text-zinc-200">
          {(Number(quotePreview.priceImpactBps) / 100).toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })}
          %
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-zinc-600">LP fee</dt>
        <dd className="mt-1 truncate text-zinc-200">
          {formatTokenAmount(quotePreview.tradeFee, decimals)}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-zinc-600">Protocol + royalty</dt>
        <dd className="mt-1 truncate text-zinc-200">
          {formatTokenAmount(
            quotePreview.protocolFee + quotePreview.royaltyAmount,
            decimals,
          )}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-zinc-600">
          {mode === "sell" ? "Minimum received" : "Maximum paid"}
        </dt>
        <dd className="mt-1 truncate text-zinc-200">
          {formatTokenAmount(
            mode === "sell"
              ? quotePreview.minimumReceived
              : quotePreview.maximumPaid,
            decimals,
          )}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-zinc-600">Post-trade virtual keys</dt>
        <dd className="mt-1 truncate text-zinc-200">
          {quotePreview.newDelta.toString()}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-zinc-600">Post-trade virtual token</dt>
        <dd className="mt-1 truncate text-zinc-200">
          {formatTokenAmount(quotePreview.newSpotPrice, decimals)}
        </dd>
      </div>
    </dl>
  ) : snapshotQuery.isLoading ? (
    <div
      className="mt-4 h-20 animate-pulse rounded-xl bg-white/[0.04]"
      aria-label="Loading quote preview"
    />
  ) : null;

  return (
    <div className="relative pb-24 md:pb-0">
      <section className="cinematic-section">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <span className="label">AlfaClub secondary market</span>
              <h1 className="headline mt-3 text-3xl sm:text-5xl">
                Keys / Creator Coin
              </h1>
            </div>
            <div className="font-mono text-xs text-zinc-500">
              {shortAddress(pair)}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-black/30 p-1.5">
                {(["buy", "buyWithEth", "sell"] as const).map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    onClick={() => setMode(direction)}
                    className={`h-10 rounded-lg text-sm font-medium transition ${
                      mode === direction
                        ? "bg-brand-primary text-white"
                        : "text-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    {direction === "buyWithEth"
                      ? "Buy with ETH"
                      : direction === "buy"
                        ? "Buy with AKITA"
                        : "Sell keys"}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="min-w-0 space-y-2">
                  <span className="text-xs text-zinc-500">Keys</span>
                  <input
                    value={keyAmountInput}
                    onChange={(event) =>
                      setKeyAmountInput(
                        event.target.value.replace(/[^\d]/g, ""),
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-white outline-none"
                  />
                </label>
                {mode === "buyWithEth" ? (
                  <label className="min-w-0 space-y-2">
                    <span className="text-xs text-zinc-500">ETH to route</span>
                    <div className="flex rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                      <input
                        type="text"
                        value={ethAmountInput}
                        onChange={(event) =>
                          setEthAmountInput(event.target.value)
                        }
                        inputMode="decimal"
                        className="min-w-0 flex-1 bg-transparent text-white outline-none"
                      />
                      <span className="text-zinc-500">ETH</span>
                    </div>
                  </label>
                ) : null}
                <label className="min-w-0 space-y-2">
                  <span className="text-xs text-zinc-500">
                    Maximum slippage
                  </span>
                  <div className="flex rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                    <input
                      type="number"
                      value={slippageInput}
                      onChange={(event) => setSlippageInput(event.target.value)}
                      min="0"
                      max="5"
                      step="0.1"
                      inputMode="decimal"
                      className="min-w-0 flex-1 bg-transparent text-white outline-none"
                    />
                    <span className="text-zinc-500">%</span>
                  </div>
                </label>
              </div>

              <div className="min-w-0 rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-full"
                      />
                    ) : (
                      <Coins className="h-9 w-9 shrink-0 p-1.5 text-zinc-500" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm text-zinc-200">
                        {snapshot?.creatorCoinName ?? "AKITA Creator Coin"}
                      </div>
                      <div className="font-mono text-xs text-zinc-600">
                        {formatAlfaClubKeyLabel({
                          keyId: ROOM_1659_TOKEN_ID,
                          roomName: "AKITA",
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg text-white">
                      {formatTokenAmount(quote?.amount, decimals)}
                    </div>
                    <div className="text-xs text-zinc-600">
                      {snapshot?.creatorCoinSymbol ?? "CREATOR"}
                    </div>
                  </div>
                </div>
                {quotePreviewRows}
              </div>

              <button
                type="button"
                disabled={
                  Boolean(disabledReason) || isSubmitting || switchingChain
                }
                onClick={() => void submit()}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-600"
              >
                {mode === "buy" || mode === "buyWithEth" ? (
                  <ShoppingCart className="h-4 w-4" />
                ) : (
                  <ArrowDownUp className="h-4 w-4" />
                )}
                {switchingChain
                  ? "Switching chain"
                  : isSubmitting
                    ? "Submitting"
                    : (disabledReason ??
                      (mode === "buyWithEth"
                        ? "Buy keys with ETH"
                        : mode === "buy"
                          ? "Buy keys"
                          : "Sell keys"))}
              </button>
              {disabledReason ? (
                <div className="text-xs text-amber-300" role="status">
                  {disabledReason}
                </div>
              ) : null}
              {snapshotQuery.error ? (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
                  {snapshotQuery.error instanceof Error
                    ? snapshotQuery.error.message
                    : "Market verification failed"}
                </div>
              ) : null}
              {lastHash ? (
                <div className="truncate font-mono text-xs text-zinc-600">
                  {lastHash}
                </div>
              ) : null}
            </div>

            <aside className="min-w-0 space-y-5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-sm font-semibold text-zinc-100">
                  Official Sudoswap v2 market
                </h2>
                {marketStats}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-xs text-zinc-500">
                <p>
                  Approvals and the swap are submitted atomically by your
                  execution account.
                </p>
                <p className="mt-2">
                  Canonical wallets require sponsorship for the complete batch
                  and never fall back to a direct signer transaction.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
