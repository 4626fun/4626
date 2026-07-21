import { useCallback, useMemo, useState } from "react";
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

import { toast } from "@/components/ui/Toast";
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
import { creatorCoinRawLogo } from "@/lib/uniswap/swapUtils";
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
};

export function AlfaClubLiquidity({
  initialCreatorCoin = null,
  initialTokenId = null,
  initialMode = "buy",
  embedded = false,
}: AlfaClubLiquidityProps = {}) {
  const queryClient = useQueryClient();
  const account = useAccount();
  const accountContext = useAccountContext();
  const publicClient = usePublicClient({ chainId: base.id });
  const { data: walletClient } = useWalletClient({ chainId: base.id });
  const { switchChainAsync, isPending: switchingChain } = useSwitchChain();

  const [mode, setMode] = useState<Mode>(
    initialMode === "sell"
      ? "sell"
      : initialMode === "buyWithEth"
        ? "buyWithEth"
        : "buy",
  );
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
  const executionAddress = (accountContext.activeAccount ??
    (executionMode === "eoa"
      ? accountContext.signerAddress
      : null)) as Address | null;

  const snapshotQuery = useQuery({
    queryKey: [
      "alfaclub-sudoswap-market",
      pair?.toLowerCase() ?? "",
      executionAddress?.toLowerCase() ?? "",
      keyAmount?.toString() ?? "",
    ],
    enabled: Boolean(
      configReady &&
        requestedMarketMatches &&
        publicClient &&
        executionAddress &&
        keyAmount,
    ),
    staleTime: 8_000,
    queryFn: async (): Promise<AlfaClubSudoswapSnapshot> => {
      if (
        !publicClient ||
        !executionAddress ||
        !keyAmount ||
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
        buyQuote,
        sellQuote,
        oneKeyBuyQuote,
        oneKeySellQuote,
        buyCurveQuote,
        sellCurveQuote,
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
          args: [ROOM_1659_TOKEN_ID, keyAmount],
        }),
        publicClient.readContract({
          address: pair,
          abi: SUDOSWAP_ERC1155_ERC20_PAIR_ABI,
          functionName: "getSellNFTQuote",
          args: [ROOM_1659_TOKEN_ID, keyAmount],
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
          args: [spotPrice, delta, keyAmount, fee, protocolFeeMultiplier],
        }),
        publicClient.readContract({
          address: xykCurve,
          abi: SUDOSWAP_XYK_CURVE_ABI,
          functionName: "getSellInfo",
          args: [spotPrice, delta, keyAmount, fee, protocolFeeMultiplier],
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
        buyQuote: normalizeQuote(buyQuote, buyCurveQuote),
        sellQuote: normalizeQuote(sellQuote, sellCurveQuote),
        oneKeyBuyQuote: normalizeQuote(oneKeyBuyQuote, oneKeyBuyCurveQuote),
        oneKeySellQuote: normalizeQuote(oneKeySellQuote, oneKeySellCurveQuote),
      };
    },
  });

  const snapshot = snapshotQuery.data ?? null;
  const quote = mode === "sell" ? snapshot?.sellQuote : snapshot?.buyQuote;
  const quotePreview = useMemo(() => {
    if (!snapshot || !keyAmount) return null;
    try {
      return deriveSudoswapQuotePreview({
        direction: mode === "sell" ? "sell" : "buy",
        quantity: keyAmount,
        quote: mode === "sell" ? snapshot.sellQuote : snapshot.buyQuote,
        oneItemQuote:
          mode === "sell" ? snapshot.oneKeySellQuote : snapshot.oneKeyBuyQuote,
        slippageBps,
      });
    } catch {
      return null;
    }
  }, [keyAmount, mode, slippageBps, snapshot]);
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
      return;
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
      await queryClient.invalidateQueries({
        queryKey: ["alfaclub-sudoswap-market"],
      });
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
    loading: snapshotQuery.isLoading,
    snapshot,
    mode,
    keyAmount,
    ethAmount,
  });

  return (
    <div className={embedded ? "relative" : "relative pb-24 md:pb-0"}>
      <section className={embedded ? "" : "cinematic-section"}>
        <div className={embedded ? "" : "mx-auto max-w-6xl px-4 sm:px-6"}>
          {!embedded ? (
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
          ) : null}

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
                <label className="space-y-2">
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
                  <label className="space-y-2">
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
                <label className="space-y-2">
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

              <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt=""
                        className="h-9 w-9 rounded-full"
                      />
                    ) : (
                      <Coins className="h-9 w-9 p-1.5 text-zinc-500" />
                    )}
                    <div>
                      <div className="text-sm text-zinc-200">
                        {snapshot?.creatorCoinName ?? "AKITA Creator Coin"}
                      </div>
                      <div className="font-mono text-xs text-zinc-600">
                        Key #{ROOM_1659_TOKEN_ID.toString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg text-white">
                      {formatTokenAmount(quote?.amount, decimals)}
                    </div>
                    <div className="text-xs text-zinc-600">
                      {snapshot?.creatorCoinSymbol ?? "CREATOR"}
                    </div>
                  </div>
                </div>
                {quotePreview ? (
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/[0.07] pt-4 text-xs sm:grid-cols-3">
                    <div>
                      <dt className="text-zinc-600">
                        {mode === "sell" ? "You receive" : "You pay"}
                      </dt>
                      <dd className="mt-1 text-zinc-200">
                        {formatTokenAmount(quotePreview.amount, decimals)}{" "}
                        {snapshot?.creatorCoinSymbol}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Effective / key</dt>
                      <dd className="mt-1 text-zinc-200">
                        {formatTokenAmount(
                          quotePreview.effectiveUnitPrice,
                          decimals,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Price impact</dt>
                      <dd className="mt-1 text-zinc-200">
                        {(
                          Number(quotePreview.priceImpactBps) / 100
                        ).toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })}
                        %
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">LP fee</dt>
                      <dd className="mt-1 text-zinc-200">
                        {formatTokenAmount(quotePreview.tradeFee, decimals)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Protocol + royalty</dt>
                      <dd className="mt-1 text-zinc-200">
                        {formatTokenAmount(
                          quotePreview.protocolFee + quotePreview.royaltyAmount,
                          decimals,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">
                        {mode === "sell" ? "Minimum received" : "Maximum paid"}
                      </dt>
                      <dd className="mt-1 text-zinc-200">
                        {formatTokenAmount(
                          mode === "sell"
                            ? quotePreview.minimumReceived
                            : quotePreview.maximumPaid,
                          decimals,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Post-trade virtual keys</dt>
                      <dd className="mt-1 text-zinc-200">
                        {quotePreview.newDelta.toString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">
                        Post-trade virtual token
                      </dt>
                      <dd className="mt-1 text-zinc-200">
                        {formatTokenAmount(quotePreview.newSpotPrice, decimals)}
                      </dd>
                    </div>
                  </dl>
                ) : snapshotQuery.isLoading ? (
                  <div
                    className="mt-4 h-20 animate-pulse rounded-xl bg-white/[0.04]"
                    aria-label="Loading quote preview"
                  />
                ) : null}
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

            <aside className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-sm font-semibold text-zinc-100">
                  Official Sudoswap v2 market
                </h2>
                <dl className="mt-4 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <dt className="text-zinc-600">Actual keys</dt>
                    <dd className="mt-1 text-zinc-200">
                      {snapshot?.pairKeyBalance.toString() ?? "--"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Actual coin</dt>
                    <dd className="mt-1 text-zinc-200">
                      {formatTokenAmount(
                        snapshot?.pairCreatorCoinBalance,
                        decimals,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Virtual keys</dt>
                    <dd className="mt-1 text-zinc-200">
                      {snapshot?.delta.toString() ?? "--"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Virtual coin</dt>
                    <dd className="mt-1 text-zinc-200">
                      {formatTokenAmount(snapshot?.spotPrice, decimals)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Pair fee</dt>
                    <dd className="mt-1 text-zinc-200">
                      {snapshot ? `${formatUnits(snapshot.fee, 16)}%` : "--"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Adapter</dt>
                    <dd className="mt-1 font-mono text-zinc-200">
                      {shortAddress(adapter)}
                    </dd>
                  </div>
                </dl>
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
