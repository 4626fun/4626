import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleDot,
  ExternalLink,
  Loader2,
  Settings2,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import {
  erc20Abi,
  formatUnits,
  getAddress,
  parseUnits,
  type Address,
  type PublicClient,
} from "viem";
import { base } from "viem/chains";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from "wagmi";

import { CONTRACTS } from "@/config/contracts";
import {
  isAlfaClubSudoswapMarketConfigured,
  useAlfaClubLiquidityPools,
  type AlfaClubSudoswapMarketConfig,
} from "@/hooks/useAlfaClubLiquidityPools";
import { ALFACLUB, FRIEND_KEY_ABI } from "@/lib/alfaclub/contracts";
import {
  buildSudoswapConfigurePoolPlan,
  buildSudoswapCreatePoolPlan,
  buildSudoswapFundPoolPlan,
  buildSudoswapWithdrawPoolPlan,
  type SudoswapLiquidityCallPlan,
} from "@/lib/alfaclub/sudoswapLiquidity";
import { cn } from "@/lib/shared/utils";
import {
  buildAndSendCalls,
  type TxRouterContext,
  type UserExecutionTrack,
} from "@/lib/tx/txRouter";
import { useAccountContext } from "@/wallet/accountContext";

type ManagerMode = "create" | "deposit" | "withdraw" | "configure";

const MARKET_CONFIG: AlfaClubSudoswapMarketConfig = {
  pair: CONTRACTS.room1659SudoswapPair as Address,
  adapter: CONTRACTS.alfaClubSudoswapAdapter as Address,
  router: CONTRACTS.alfaClubUniversalRouter as Address,
  permit2: CONTRACTS.permit2 as Address,
  factory: CONTRACTS.sudoswapPairFactory as Address,
  curve: CONTRACTS.sudoswapXykCurve as Address,
};

const ROOM_1659_CREATOR_COIN = getAddress(
  "0x5b674196812451b7cec024fe9d22d2c0b172fa75",
);
const ROOM_1659_TOKEN_ID = 1659n;

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function amount(value: bigint, decimals: number, max = 4): string {
  const numeric = Number(formatUnits(value, decimals));
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString("en-US", { maximumFractionDigits: max });
}

function parseWhole(value: string): bigint {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return 0n;
  return BigInt(normalized);
}

function parseToken(value: string, decimals: number): bigint {
  try {
    return parseUnits(value.trim() || "0", decimals);
  } catch {
    return 0n;
  }
}

function parseFee(value: string): bigint {
  try {
    return parseUnits(value.trim() || "0", 16);
  } catch {
    return -1n;
  }
}

function modeLabel(mode: ManagerMode): string {
  if (mode === "create") return "Create pool";
  if (mode === "deposit") return "Add liquidity";
  if (mode === "withdraw") return "Remove liquidity";
  return "Curve & fee";
}

export function AlfaClubPoolManager() {
  const queryClient = useQueryClient();
  const account = useAccount();
  const accountContext = useAccountContext();
  const publicClient = usePublicClient({ chainId: base.id });
  const { data: walletClient } = useWalletClient({ chainId: base.id });
  const { switchChainAsync, isPending: switchingChain } = useSwitchChain();
  const [mode, setMode] = useState<ManagerMode>("deposit");
  const [keyAmountInput, setKeyAmountInput] = useState("");
  const [coinAmountInput, setCoinAmountInput] = useState("");
  const [virtualKeysInput, setVirtualKeysInput] = useState("");
  const [virtualCoinInput, setVirtualCoinInput] = useState("");
  const [feeInput, setFeeInput] = useState("6.9");
  const [expandedPreview, setExpandedPreview] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<{
    label: string;
    hash: string | null;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const configured = isAlfaClubSudoswapMarketConfigured(MARKET_CONFIG);
  const directory = useAlfaClubLiquidityPools(
    publicClient as unknown as PublicClient | undefined,
    configured ? MARKET_CONFIG : null,
  );
  const pool = directory.data?.pools[0] ?? null;
  const decimals = pool?.creatorCoinDecimals ?? 18;
  const executionMode =
    accountContext.activeAccountType === "SMART_WALLET" ? "canonical" : "eoa";
  const executionAddress = (accountContext.activeAccount ??
    (executionMode === "eoa"
      ? accountContext.signerAddress
      : null)) as Address | null;
  const ownerMatches = Boolean(
    executionAddress &&
      pool &&
      getAddress(executionAddress) === getAddress(pool.owner),
  );

  const balances = useQuery({
    queryKey: ["alfaclub-pool-manager-balances", executionAddress ?? ""],
    enabled: Boolean(publicClient && executionAddress),
    queryFn: async () => {
      if (!publicClient || !executionAddress) return null;
      const [coin, keys] = await Promise.all([
        publicClient.readContract({
          address: ROOM_1659_CREATOR_COIN,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [executionAddress],
        }),
        publicClient.readContract({
          address: ALFACLUB.friendKey,
          abi: FRIEND_KEY_ABI,
          functionName: "balanceOf",
          args: [executionAddress, ROOM_1659_TOKEN_ID],
        }),
      ]);
      return { coin, keys };
    },
  });

  const keyAmount = parseWhole(keyAmountInput);
  const coinAmount = parseToken(coinAmountInput, decimals);
  const nextSpotPrice = parseToken(virtualCoinInput, decimals);
  const nextDelta = parseWhole(virtualKeysInput);
  const nextFee = parseFee(feeInput);

  const planResult = useMemo((): {
    plan: SudoswapLiquidityCallPlan | null;
    error: string | null;
  } => {
    if (!executionAddress)
      return { plan: null, error: "Connect an execution-ready wallet" };
    if (!configured)
      return {
        plan: null,
        error: "Official Sudoswap configuration is incomplete",
      };
    try {
      if (mode === "create") {
        if (pool) {
          return {
            plan: null,
            error:
              "Room 1659 already has an official pair. Duplicate creation is disabled.",
          };
        }
        return {
          plan: buildSudoswapCreatePoolPlan({
            sender: executionAddress,
            factory: MARKET_CONFIG.factory,
            bondingCurve: MARKET_CONFIG.curve,
            erc1155: ALFACLUB.friendKey,
            tokenId: ROOM_1659_TOKEN_ID,
            erc1155Amount: keyAmount,
            erc20: ROOM_1659_CREATOR_COIN,
            erc20Amount: coinAmount,
            virtualKeyReserve: nextDelta,
            virtualTokenReserve: nextSpotPrice,
            fee: nextFee,
          }),
          error: null,
        };
      }
      if (!pool?.configurationReady) {
        return {
          plan: null,
          error: "The configured pair failed live invariant checks",
        };
      }
      if (mode === "deposit") {
        return {
          plan: buildSudoswapFundPoolPlan({
            sender: executionAddress,
            pair: pool.pool,
            erc1155: ALFACLUB.friendKey,
            tokenId: pool.tokenId,
            erc1155Amount: keyAmount,
            erc20: pool.creatorCoin,
            erc20Amount: coinAmount,
          }),
          error: null,
        };
      }
      if (!ownerMatches) {
        return {
          plan: null,
          error: `Only the pair owner ${shortAddress(pool.owner)} can ${
            mode === "withdraw" ? "withdraw inventory" : "change curve settings"
          }.`,
        };
      }
      if (mode === "withdraw") {
        return {
          plan: buildSudoswapWithdrawPoolPlan({
            sender: executionAddress,
            pair: pool.pool,
            erc1155: ALFACLUB.friendKey,
            tokenId: pool.tokenId,
            erc1155Amount: keyAmount,
            erc20: pool.creatorCoin,
            erc20Amount: coinAmount,
          }),
          error: null,
        };
      }
      if (nextFee !== 69n * 10n ** 15n) {
        return {
          plan: null,
          error:
            "Room 1659 must keep its configured 6.9% liquidity-provider fee.",
        };
      }
      return {
        plan: buildSudoswapConfigurePoolPlan({
          sender: executionAddress,
          pair: pool.pool,
          currentSpotPrice: pool.spotPrice,
          currentDelta: pool.delta,
          currentFee: BigInt(pool.feeBps) * 10n ** 14n,
          nextSpotPrice,
          nextDelta,
          nextFee,
        }),
        error: null,
      };
    } catch (error) {
      return {
        plan: null,
        error:
          error instanceof Error
            ? error.message.replaceAll("_", " ")
            : "Invalid pool inputs",
      };
    }
  }, [
    coinAmount,
    configured,
    executionAddress,
    keyAmount,
    mode,
    nextDelta,
    nextFee,
    nextSpotPrice,
    ownerMatches,
    pool,
  ]);

  const balanceError = useMemo(() => {
    if (mode === "withdraw" && pool) {
      if (keyAmount > pool.keyBalance)
        return "The pool does not hold enough FriendKeys";
      if (coinAmount > pool.creatorCoinBalance)
        return "The pool does not hold enough AKITA";
      return null;
    }
    if (!balances.data || mode === "configure") return null;
    if (keyAmount > balances.data.keys) return "FriendKey balance is too low";
    if (coinAmount > balances.data.coin) return "AKITA balance is too low";
    return null;
  }, [balances.data, coinAmount, keyAmount, mode, pool]);

  const buildTxContext = useCallback((): TxRouterContext => {
    if (!walletClient || !publicClient || !executionAddress) {
      throw new Error("Wallet execution is not ready");
    }
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
    if (!planResult.plan || balanceError) return;
    if (account.chainId !== base.id) {
      await switchChainAsync({ chainId: base.id });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setSubmission(null);
    try {
      const result = await buildAndSendCalls({
        context: buildTxContext(),
        calls: planResult.plan.calls,
      });
      const hash =
        result.send.transactionHash ??
        result.send.txHashes.at(-1) ??
        result.send.callsId ??
        null;
      setSubmission({
        label:
          result.send.mode === "canonical4337"
            ? "Sponsored UserOperation submitted"
            : result.send.txHashes.length > 1
              ? `${result.send.txHashes.length} sequential wallet transactions submitted`
              : "Wallet transaction submitted",
        hash,
      });
      if (result.send.transactionHash && publicClient) {
        await publicClient.waitForTransactionReceipt({
          hash: result.send.transactionHash as `0x${string}`,
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["alfaclub-sudoswap-markets"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["alfaclub-pool-manager-balances"],
        }),
      ]);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Pool transaction failed",
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    account.chainId,
    balanceError,
    buildTxContext,
    planResult.plan,
    publicClient,
    queryClient,
    switchChainAsync,
  ]);

  const setModeAndDefaults = (next: ManagerMode) => {
    setMode(next);
    setSubmission(null);
    setSubmitError(null);
    if (next === "configure" && pool) {
      setVirtualKeysInput(pool.delta.toString());
      setVirtualCoinInput(formatUnits(pool.spotPrice, decimals));
      setFeeInput((Number(pool.feeBps) / 100).toString());
    }
  };

  const disabledReason =
    balanceError ??
    planResult.error ??
    (account.chainId !== base.id ? "Switch to Base to continue" : null);

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0f1012] shadow-2xl shadow-black/30">
      <div className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_42%)] px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300">
              <CircleDot className="size-3.5" aria-hidden />
              AlfaClub liquidity
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
              ERC-1155 / ERC-20 pools
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-400">
              Create, fund, and manage official Sudoswap v2 pairs on Base. Room
              1659 uses the source-pinned XYK market.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/[0.08] px-3 py-1.5 text-xs text-emerald-200">
            <ShieldCheck className="size-3.5" aria-hidden /> Official factory
          </div>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="p-4 sm:p-6">
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="tablist"
            aria-label="Pool action"
          >
            {(["create", "deposit", "withdraw", "configure"] as const).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={mode === item}
                  onClick={() => setModeAndDefaults(item)}
                  className={cn(
                    "min-h-10 rounded-xl px-3 text-xs font-semibold transition",
                    mode === item
                      ? "bg-sky-500 text-white shadow-lg shadow-sky-500/15"
                      : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200",
                  )}
                >
                  {modeLabel(item)}
                </button>
              ),
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                ERC-1155
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-zinc-100">
                    AlfaClub FriendKey
                  </div>
                  <div className="mt-1 font-mono text-xs text-zinc-500">
                    Token ID 1659
                  </div>
                </div>
                <span className="rounded-full bg-fuchsia-500/10 px-2.5 py-1 text-xs text-fuchsia-200">
                  Key
                </span>
              </div>
              <div className="mt-3 truncate font-mono text-[11px] text-zinc-600">
                {ALFACLUB.friendKey}
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                ERC-20
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-zinc-100">
                    {pool?.creatorCoinSymbol ?? "AKITA"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">Creator Coin</div>
                </div>
                <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-xs text-sky-200">
                  Token
                </span>
              </div>
              <div className="mt-3 truncate font-mono text-[11px] text-zinc-600">
                {ROOM_1659_CREATOR_COIN}
              </div>
            </div>
          </div>

          {mode === "create" ? (
            <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
              Room 1659’s official pair is already live at{" "}
              {pool ? shortAddress(pool.pool) : "the configured address"}. The
              creation builder remains approval-clean for a future registry
              entry, but duplicate creation is blocked.
            </div>
          ) : null}

          {mode !== "configure" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                  FriendKeys
                  <span className="text-zinc-600">
                    {mode === "withdraw"
                      ? `Pool ${pool?.keyBalance.toLocaleString() ?? "—"}`
                      : `Wallet ${balances.data?.keys.toLocaleString() ?? "—"}`}
                  </span>
                </span>
                <input
                  value={keyAmountInput}
                  onChange={(event) =>
                    setKeyAmountInput(event.target.value.replace(/[^\d]/g, ""))
                  }
                  inputMode="numeric"
                  placeholder="0"
                  className="min-h-14 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-xl text-white outline-none transition placeholder:text-zinc-700 focus:border-sky-400/40"
                />
              </label>
              <label className="block">
                <span className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                  {pool?.creatorCoinSymbol ?? "AKITA"}
                  <span className="text-zinc-600">
                    {mode === "withdraw"
                      ? `Pool ${pool ? amount(pool.creatorCoinBalance, decimals) : "—"}`
                      : `Wallet ${balances.data ? amount(balances.data.coin, decimals) : "—"}`}
                  </span>
                </span>
                <input
                  value={coinAmountInput}
                  onChange={(event) => setCoinAmountInput(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.0"
                  className="min-h-14 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-xl text-white outline-none transition placeholder:text-zinc-700 focus:border-sky-400/40"
                />
              </label>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-xs text-zinc-400">
                  Virtual keys (delta)
                </span>
                <input
                  value={virtualKeysInput}
                  onChange={(event) =>
                    setVirtualKeysInput(
                      event.target.value.replace(/[^\d]/g, ""),
                    )
                  }
                  inputMode="numeric"
                  className="min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-sky-400/40"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs text-zinc-400">
                  Virtual AKITA reserve
                </span>
                <input
                  value={virtualCoinInput}
                  onChange={(event) => setVirtualCoinInput(event.target.value)}
                  inputMode="decimal"
                  className="min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-sky-400/40"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs text-zinc-400">LP fee</span>
                <div className="flex min-h-12 rounded-xl border border-white/10 bg-black/30 px-3">
                  <input
                    value={feeInput}
                    onChange={(event) => setFeeInput(event.target.value)}
                    inputMode="decimal"
                    className="min-w-0 flex-1 bg-transparent text-white outline-none"
                  />
                  <span className="self-center text-zinc-600">%</span>
                </div>
              </label>
            </div>
          )}

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20">
            <button
              type="button"
              onClick={() => setExpandedPreview((value) => !value)}
              className="flex min-h-12 w-full items-center justify-between px-4 text-left"
              aria-expanded={expandedPreview}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <Settings2 className="size-4 text-zinc-500" aria-hidden />{" "}
                Transaction preview
              </span>
              <ChevronDown
                className={cn(
                  "size-4 text-zinc-600 transition",
                  expandedPreview && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            {expandedPreview ? (
              <div className="border-t border-white/[0.06] px-4 py-3">
                {planResult.plan ? (
                  <ol className="space-y-3">
                    {planResult.plan.steps.map((step, index) => (
                      <li
                        key={step}
                        className="flex gap-3 text-xs text-zinc-400"
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-mono text-[10px] text-zinc-300">
                          {index + 1}
                        </span>
                        <span className="pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs leading-relaxed text-zinc-500">
                    Enter valid amounts to build the exact call sequence.
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3 text-[11px] text-zinc-500">
                  <WalletCards className="size-3.5" aria-hidden />
                  {executionMode === "canonical"
                    ? "Canonical CSW · atomic sponsored UserOperation required"
                    : `${planResult.plan?.calls.length ?? 0} direct EOA transaction${planResult.plan?.calls.length === 1 ? "" : "s"} · submitted sequentially`}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={Boolean(disabledReason) || submitting || switchingChain}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 text-sm font-semibold text-white shadow-lg shadow-sky-500/15 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-zinc-600 disabled:shadow-none"
          >
            {submitting || switchingChain ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ArrowRight className="size-4" aria-hidden />
            )}
            {switchingChain
              ? "Switching to Base"
              : submitting
                ? executionMode === "canonical"
                  ? "Submitting sponsored UserOperation"
                  : "Confirm transactions in wallet"
                : (disabledReason ?? modeLabel(mode))}
          </button>
          {disabledReason ? (
            <div
              className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-amber-300"
              role="status"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />{" "}
              {disabledReason}
            </div>
          ) : null}
          {submitError ? (
            <div
              className="mt-3 rounded-xl border border-red-400/20 bg-red-500/[0.08] p-3 text-xs text-red-200"
              role="alert"
            >
              {submitError}
            </div>
          ) : null}
          {submission ? (
            <div
              className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.08] p-3 text-xs text-emerald-200"
              role="status"
            >
              <div className="flex items-center gap-2">
                <Check className="size-3.5" aria-hidden /> {submission.label}
              </div>
              {submission.hash?.startsWith("0x") &&
              submission.hash.length === 66 ? (
                <a
                  className="mt-2 inline-flex items-center gap-1 text-emerald-300 underline decoration-emerald-400/30 underline-offset-4"
                  href={`https://basescan.org/tx/${submission.hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on BaseScan{" "}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="border-t border-white/[0.07] bg-black/20 p-4 sm:p-6 xl:border-l xl:border-t-0">
          <h3 className="text-sm font-semibold text-white">Pool status</h3>
          {directory.isLoading ? (
            <div className="mt-4 space-y-3" aria-label="Loading pool status">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-12 animate-pulse rounded-xl bg-white/[0.05]"
                />
              ))}
            </div>
          ) : pool ? (
            <dl className="mt-4 space-y-3 text-xs">
              {[
                ["Pool", shortAddress(pool.pool)],
                ["Owner", shortAddress(pool.owner)],
                ["Curve", "XYK · virtual reserves"],
                ["LP fee", `${(Number(pool.feeBps) / 100).toLocaleString()}%`],
                ["Key inventory", pool.keyBalance.toLocaleString()],
                [
                  pool.creatorCoinSymbol,
                  amount(pool.creatorCoinBalance, decimals),
                ],
                ["Virtual keys", pool.delta.toLocaleString()],
                ["Virtual token reserve", amount(pool.spotPrice, decimals)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 border-b border-white/[0.05] pb-3 last:border-0"
                >
                  <dt className="text-zinc-600">{label}</dt>
                  <dd className="max-w-[170px] truncate text-right font-medium text-zinc-300">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="mt-4 rounded-xl border border-amber-400/15 bg-amber-500/[0.06] p-3 text-xs leading-relaxed text-amber-200">
              {directory.error instanceof Error
                ? directory.error.message
                : "No verified market is configured."}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
              Readiness
            </div>
            <ul className="mt-3 space-y-2.5 text-xs">
              {[
                ["Wallet connected", Boolean(executionAddress)],
                ["Base network", account.chainId === base.id],
                ["Official factory verified", Boolean(pool?.factoryValid)],
                [
                  "Adapter market authorized",
                  Boolean(pool?.adapterMarketAllowed),
                ],
                [
                  "Execution configuration valid",
                  Boolean(pool?.configurationReady),
                ],
              ].map(([label, ready]) => (
                <li
                  key={String(label)}
                  className="flex items-center gap-2 text-zinc-400"
                >
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full",
                      ready
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/[0.05] text-zinc-700",
                    )}
                  >
                    {ready ? (
                      <Check className="size-2.5" aria-hidden />
                    ) : (
                      <span className="size-1 rounded-full bg-current" />
                    )}
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
            The pair contract is the LP position; Sudoswap does not mint
            fungible LP tokens. Withdrawals and curve changes require the live
            pair owner.
          </p>
        </aside>
      </div>
    </section>
  );
}
