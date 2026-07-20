// @vitest-environment happy-dom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LiquidityPanel } from "./LiquidityPanel";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [],
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/components/alfaclub/AlfaClubPoolManager", () => ({
  AlfaClubPoolManager: () => (
    <div data-testid="alfaclub-pool-manager">AlfaClub pool manager</div>
  ),
}));

describe("LiquidityPanel", () => {
  it("opens the AlfaClub workflow by default and keeps Uniswap positions available", () => {
    render(
      <LiquidityPanel
        tokenInSymbol="ETH"
        tokenOutSymbol="AKITA"
        identityReady
        activePanel="liquidity"
        onSetActivePanel={vi.fn()}
        onOpenSettings={vi.fn()}
        canonicalAddress={null}
        tokenIn="0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
        tokenOut="0x5b674A9d7fEfC4240b27408515fDe18528ADe264"
      />,
    );

    expect(screen.getByTestId("alfaclub-pool-manager")).toBeTruthy();
    expect(screen.getByRole("button", { name: "AlfaClub keys" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Uniswap positions" }));

    expect(screen.queryByTestId("alfaclub-pool-manager")).toBeNull();
    expect(screen.getByText("Add position")).toBeTruthy();
  });
});
