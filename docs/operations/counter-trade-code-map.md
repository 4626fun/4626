# Counter-Trade Code Map

This is the current module map for the AlfaClub counter-trade runtime.

## Main runtime path

- `frontend/server/_lib/alfaclub/counterTradeTicker.ts`
  - Periodic scheduler for the loop in long-lived runtime.
- `frontend/server/_lib/alfaclub/counterTradeRunner.ts`
  - Top-level orchestration: actor scan, event loop, gating, helper invocation, counters.

## Strategy + policy

- `frontend/server/_lib/alfaclub/counterTradeConfig.ts`
  - Runtime env policy and limits.
- `frontend/server/_lib/alfaclub/counterTradeEngine.ts`
  - Fill classification and deterministic decisioning.
- `frontend/server/_lib/alfaclub/counterTradeLlmAdvisor.ts`
  - Optional LLM risk-review layer.

## Extracted flow helpers

- `frontend/server/_lib/alfaclub/counterTradeEntryFlow.ts`
  - Open-entry execution + reconciliation + action recording + room post.
- `frontend/server/_lib/alfaclub/counterTradeExitFlow.ts`
  - Mirrored exit handling + harvest telemetry + exit room post.
- `frontend/server/_lib/alfaclub/counterTradeUsageState.ts`
  - Hourly/daily usage state for cap checks and in-loop updates.
- `frontend/server/_lib/alfaclub/counterTradeRoomPosting.ts`
  - Message formatting and room posting utilities.

## State + persistence

- `frontend/server/_lib/alfaclub/counterTradeStore.ts`
  - Room strategy, user opt-ins, event dedupe ledger, action ledger, usage reads.
- `supabase/migrations/20260709000000_alfaclub_counter_trade_engine.sql`
  - Counter-trade DB tables and constraints.

## Market + execution dependencies

- `frontend/server/_lib/alfaclub/hyperliquid.ts`
  - Fills, wallet state, and market reads.
- `frontend/server/_lib/arena/arenaClient.ts`
  - Arena action execution lane (open/close/spot->perp transfer).
- `frontend/server/_lib/alfaclub/room1659Market.ts`
  - Room 1659 source-wallet resolution.
- `frontend/server/_lib/alfaclub/counterTradeDefense.ts`
  - Defense and partial reduce routines.
- `frontend/server/_lib/alfaclub/counterTradeHarvest.ts`
  - Harvest accounting utilities.

## API and UI

- `frontend/api/_handlers/v1/alfaclub/_counter-trade-status.ts`
- `frontend/api/_handlers/v1/alfaclub/_counter-trade-run.ts`
- `frontend/src/pages/Arena.tsx`
  - `/arena/counter-trade-files` inventory surface.
- `frontend/src/hooks/useCounterTradeStatus.ts`
- `frontend/src/lib/alfaclub/counterTradeStatus.ts`
