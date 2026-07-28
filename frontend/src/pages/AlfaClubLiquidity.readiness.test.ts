import { describe, expect, it } from "vitest";
import { getAddress } from "viem";

import {
  getAlfaClubLiquidityDisabledReason,
  parseSlippageBps,
  resolveAlfaClubSmartWalletClientPreference,
  type AlfaClubSudoswapSnapshot,
} from "./AlfaClubLiquidity";

const SENDER = getAddress("0x3000000000000000000000000000000000000003");

function snapshot(
  overrides: Partial<AlfaClubSudoswapSnapshot> = {},
): AlfaClubSudoswapSnapshot {
  const buyQuote = {
    errorCode: 0n,
    amount: 1_000n,
    newSpotPrice: 1_100n,
    newDelta: 99n,
    tradeFee: 60n,
    protocolFee: 10n,
    royaltyAmount: 5n,
  };
  const sellQuote = {
    errorCode: 0n,
    amount: 900n,
    newSpotPrice: 900n,
    newDelta: 101n,
    tradeFee: 60n,
    protocolFee: 10n,
    royaltyAmount: 5n,
  };
  return {
    creatorCoinName: "AKITA",
    creatorCoinSymbol: "AKITA",
    creatorCoinDecimals: 18,
    creatorCoinBalance: 10_000n,
    keyBalance: 10n,
    erc20AllowanceToPermit2: 0n,
    permit2AllowanceToAdapter: { amount: 0n, expiration: 0n },
    keyApprovedForAdapter: false,
    pairCreatorCoinBalance: 10_000n,
    pairKeyBalance: 10n,
    spotPrice: 1_000n,
    delta: 100n,
    fee: 69_000_000_000_000_000n,
    buyQuote,
    sellQuote,
    oneKeyBuyQuote: buyQuote,
    oneKeySellQuote: sellQuote,
    ...overrides,
  };
}

function ready(overrides: Record<string, unknown> = {}) {
  return {
    configReady: true,
    requestedMarketMatches: true,
    executionAddress: SENDER,
    loading: false,
    snapshot: snapshot(),
    mode: "buy" as const,
    keyAmount: 1n,
    ...overrides,
  };
}

describe("AlfaClub SMART_WALLET client preference", () => {
  it("prefers Base App CSW-direct over a hydrated Privy embedded client", () => {
    expect(
      resolveAlfaClubSmartWalletClientPreference({
        baseAppDirectReady: true,
        internalEmbeddedReady: true,
        externalEoaOwnerReady: true,
      }),
    ).toBe("base-app-direct");
  });

  it("uses Privy embedded when Base App direct is not ready", () => {
    expect(
      resolveAlfaClubSmartWalletClientPreference({
        baseAppDirectReady: false,
        internalEmbeddedReady: true,
        externalEoaOwnerReady: true,
      }),
    ).toBe("internal-embedded");
  });

  it("falls back to confirmed external EOA owner last", () => {
    expect(
      resolveAlfaClubSmartWalletClientPreference({
        baseAppDirectReady: false,
        internalEmbeddedReady: false,
        externalEoaOwnerReady: true,
      }),
    ).toBe("external-eoa");
  });
});

describe("AlfaClub official Sudoswap market readiness", () => {
  it("fails closed until every deployment pin is configured", () => {
    expect(
      getAlfaClubLiquidityDisabledReason(ready({ configReady: false })),
    ).toBe("Official Sudoswap market deployment is not configured");
  });

  it("does not route an unregistered room into the room 1659 pair", () => {
    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({ requestedMarketMatches: false }),
      ),
    ).toBe("No official Sudoswap market is configured for this key");
  });

  it("requires a live OK quote", () => {
    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({
          snapshot: snapshot({
            buyQuote: {
              ...snapshot().buyQuote,
              errorCode: 1n,
              amount: 0n,
              protocolFee: 0n,
              royaltyAmount: 0n,
            },
          }),
        }),
      ),
    ).toBe("A live Sudoswap quote is unavailable");
  });

  it("keeps key quantity and slippage inside the sponsored policy envelope", () => {
    expect(getAlfaClubLiquidityDisabledReason(ready({ keyAmount: 101n }))).toBe(
      "Key amount exceeds the supported maximum of 100",
    );
    expect(parseSlippageBps("5")).toBe(500n);
    expect(parseSlippageBps("50")).toBe(500n);
  });

  it("checks actual pair inventory before a buy", () => {
    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({
          keyAmount: 2n,
          snapshot: snapshot({ pairKeyBalance: 1n }),
        }),
      ),
    ).toBe("The pair has insufficient key inventory");
  });

  it("checks the user key balance and pair coin liabilities before a sell", () => {
    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({
          mode: "sell",
          keyAmount: 2n,
          snapshot: snapshot({ keyBalance: 1n }),
        }),
      ),
    ).toBe("FriendKey balance is too low");

    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({
          mode: "sell",
          snapshot: snapshot({ pairCreatorCoinBalance: 914n }),
        }),
      ),
    ).toBe("The pair has insufficient Creator Coin inventory");
  });

  it("enables the verified buy and sell paths", () => {
    expect(getAlfaClubLiquidityDisabledReason(ready())).toBeNull();
    expect(
      getAlfaClubLiquidityDisabledReason(ready({ mode: "sell" })),
    ).toBeNull();
  });


  it("blocks the embedded key trade while another swap is unsettled", () => {
    const settlementMessage =
      "Previous swap is still confirming. Wait for settlement before starting another swap.";
    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({ submissionBlockedReason: settlementMessage }),
      ),
    ).toBe(settlementMessage);
  });

  it("requires a signing wallet client before submit", () => {
    expect(
      getAlfaClubLiquidityDisabledReason(ready({ walletClientReady: false })),
    ).toBe("Wallet execution is not ready");
  });

  it("allows an ETH-funded buy without a pre-existing Creator Coin balance", () => {
    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({
          mode: "buyWithEth",
          ethAmount: 1_000_000_000_000_000n,
          snapshot: snapshot({ creatorCoinBalance: 0n }),
          ethFundingCoversBuy: true,
        }),
      ),
    ).toBeNull();
    expect(
      getAlfaClubLiquidityDisabledReason(ready({ mode: "buyWithEth" })),
    ).toBe("Enter a positive ETH amount");
  });

  it("waits for the ETH→AKITA funding quote before enabling submit", () => {
    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({
          mode: "buyWithEth",
          ethAmount: 1_000_000_000_000_000n,
          ethFundingQuoteLoading: true,
        }),
      ),
    ).toBe("Quoting ETH → AKITA funding");
  });

  it("blocks ETH buys that do not cover the Sudoswap AKITA requirement", () => {
    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({
          mode: "buyWithEth",
          ethAmount: 1_000_000_000_000_000n,
          ethFundingCoversBuy: false,
        }),
      ),
    ).toBe("ETH amount is too low for this key buy");
  });

  it("blocks ETH buys when the Zora funding quote fails", () => {
    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({
          mode: "buyWithEth",
          ethAmount: 1_000_000_000_000_000n,
          ethFundingQuoteFailed: true,
        }),
      ),
    ).toBe("ETH → AKITA funding quote failed");
  });
});
