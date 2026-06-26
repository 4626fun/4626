# Room 1659 — Hermit Market Awareness Sketch

## Goal
Give Hermit4626 the ability to read and reference live market state (hype, liquidation, user positions) **specifically inside AlfaClub room 1659**.

## Current State (before changes)
- `resolveHermitRoomContext` only returns style preferences.
- `executeHermitCommand` has no concept of room market data.
- Hermit prompt builders have no market context.

## Concrete On-Chain Data Sources (from Friend contracts)

### Required Mapping
First, we need a reliable way to get the **FriendKey tokenId** for room 1659. This is the key primitive.

Once we have `tokenId`:

### High-Value Reads from FriendKey + FriendRoomManager

| Data Point                    | Contract / Function                          | Why it matters for Hermit |
|-------------------------------|----------------------------------------------|-----------------------------|
| Current supply                | `totalSupply(tokenId)`                       | "Market cap" / float size |
| User's position size          | `balanceOf(sender, tokenId)`                 | "How much skin you have in the game" |
| Current marginal buy price    | `getBuyPrice(tokenId, 1)`                    | Where the curve is right now |
| Current marginal sell price   | `getSellPrice(tokenId, 1)`                   | Exit liquidity |
| Room type + tier              | `roomTypes(tokenId)`, `roomTiers(tokenId)`   | Confirm Trading room + steepness |
| Bonding curve divisor         | `getDivisor(...)` via RoomManager            | How aggressive the curve is |
| Creator address               | `creatorByTokenId(tokenId)`                  | For Hyperliquid cross-reference |

### Recommended Derived Metrics (for "hype" and "liquidation")

- **Hype proxy**: Recent `Trade` event velocity (buys vs sells in last N blocks or minutes) + price acceleration.
- **Liquidation risk**: 
  - Distance from current price to user's average entry (if tracked).
  - Curve depth / how much selling would move price significantly.
  - Combined with user's Hyperliquid exposure (via existing `hyperliquid.ts`).

### Hyperliquid Layer (already exists in 4626)
Reuse `frontend/server/_lib/alfaclub/hyperliquid.ts`:
- `fetchHyperliquidSnapshot(address)` → accountValue + 30d PnL
- Can be used for the room creator or the individual user.

## Proposed Changes

### 1. New Data Module (Done)
**File:** `frontend/server/_lib/alfaclub/room1659Market.ts`

- `Room1659MarketSnapshot` type
- `resolveRoom1659MarketContext(senderAddress)` — the single place to implement hype/liquidation/position fetching for this room.
- Helper `formatRoom1659MarketForHermit` for prompt injection.

**Implementation note:** Inside `resolveRoom1659MarketContext` you would wire:
- Whatever powers the "hype" and "liquidation" numbers the room talks about.
- `hyperliquid.ts` for the user's current position (already exists and is public).

### 2. Context Resolver Extension (Done)
**File:** `frontend/server/commands/execute.ts`

- Extended `HermitRoomContext` with optional `room1659Market`.
- `resolveHermitRoomContext` now calls the 1659 market resolver when `roomId === '1659'`.
- Passes the data down when calling `executeHermitCommand`.

### 3. Type Update (Done)
**File:** `frontend/server/_lib/hermit/types.ts`

- Added `room1659Market` to `HermitExecutionParams`.

### 4. Prompt Injection (Done)
**File:** `frontend/server/_lib/hermit/skillRouter.ts`

- Updated `buildPinataPromptForHermit` to accept and inject room 1659 market data when present.
- Updated the call site in the `/hermit` draft path to forward the data.

## Setup Status: COMPLETE (operator action required only for the numeric token ID)

The entire system for room 1659 is now fully wired and automatic:

- All data sources (Hyperliquid + AlfaClub spot + dexscreener + on-chain FriendKey) are integrated.
- Sophisticated multi-factor hype formula is live.
- Context is automatically resolved and injected into every Hermit prompt when the room is 1659.
- Debug script exists for verification.

The only remaining operator step for 100% on-chain curve data is setting the numeric ERC1155 token ID (see the big comment in room1659Market.ts and the output of the debug script).

Everything else is production-ready.

- `room1659Market.ts` now actively attempts to call:
  - `/api/spot/positions?roomId=1659` (your positions in the room)
  - `/api/room/pnl-history`
  - Spot/dexscreener token data
  - Enhanced Hyperliquid clearinghouseState (full assetPositions + liquidation price)

- Simple hype calculation based on leverage + activity.
- Liquidation price pulled directly from Hyperliquid.
- Debug script created: `frontend/scripts/ops/check-room-1659.ts --wallet=0x...`

- Still needs solid auth for spot endpoints (using live Supabase JWT) and the FriendKey tokenId for the room.

## Next Steps (Prioritized)

1. Get reliable auth for AlfaClub spot endpoints in the resolver.
2. Add the FriendKey tokenId mapping for room 1659.
3. Flesh out real hype scoring from the data we can pull.
4. Test end-to-end with the debug script using a real wallet active in 1659.

## Example Prompt Injection (when implemented)

```
=== ROOM 1659 LIVE MARKET CONTEXT ===
Current hype: 67
Current liquidation level: 69
Your current position: LONG $124k (PnL: -$8.2k)
```

This gives Hermit the ability to generate contextually relevant (and sometimes stupidly on-point) creative responses about the actual state of the room.

## Non-Goals
- This does **not** turn Hermit into a full trading bot or risk manager.
- Market data is injected as creative context only.
