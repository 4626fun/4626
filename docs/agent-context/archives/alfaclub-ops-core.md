# alfaclub-ops core

Cross-cutting operator prefs: [preferences-active.md](../preferences-active.md).
Parent index: [alfaclub-ops.md](./alfaclub-ops.md). **Read one sub-archive only**.

## Learned Workspace Facts

- **`/alfaclub/trading-rooms` redirects to `alfaclub.4626.fun/rooms`**: left sidebar lists all AlfaClub trading rooms from the snapshot ingest (searchable, volume-sorted) with a main panel for the selected room and links to AlfaClub / key-safety; data via `GET /api/v1/alfaclub/trading-rooms`.

- **AlfaClub Creator Coin/FriendKey trading uses one official Sudoswap v2 ERC-1155/ERC-20 lane.** The custom `AlfaCreatorKeyLPFactory` / `AlfaCreatorKeyPool` deployment is retired and must not be used as a fallback. The supported path is the source-pinned official `LSSVMPairFactory` + XYK `TRADE` pair, `AlfaClubSudoswapAdapter`, and custom Uniswap Universal Router commands `0x41`/`0x42`; it transfers existing keys/coins only and never writes to the FriendKey primary curve. Room 1659 is a Trading room and its pair fee is exactly 690 bps (6.9%, encoded as `0.069e18`). The pair contract is the LP position—there are no ERC-20 LP shares. Runbook: `docs/_internal/operations/alfaclub/creator-key-liquidity-pools.md`.

- **AlfaClub counter-trade runner enforces one executor and one active strategy actor per room.** The reserved executor is Railway **`4626-hermit-chat`** / service **`4626-hermit-agent`** (image from `frontend/Dockerfile.hermit`, `/data` volume with `ARENA_ACP_HOME=/data/acp-home`). Keep `ALFACLUB_COUNTER_TRADE_RUNNER_ENABLED=0` until canary; with the flag on, room 1659 uses `split_by_action` (chat-reaction owns OPEN/`entry`; ticker may run add/reduce/close/defense). Chat-reaction still owns durable OPEN fades while the runner stays off. The retired **`4626-inverseakita`** split project is not live — do not spin up a second executor. Duplicated/triplicated room posts mean a stale container or a second executor, not a message bug; verify the live image carries the latest code (posts include `Signal <fillAction>`). Shadow InverseAKITA entry advisory posts when `INV_AKITA_ENTRY_ADVISORY_ENABLED=1` (surfacing only). Health probe: `pnpm -C frontend ops:inverse-akita:shadow-health`. An optional **Eliza LLM risk-review gate** (`counterTradeLlmAdvisor.ts`) sits between the deterministic decision and execution — `ALFACLUB_COUNTER_TRADE_LLM_MODE=gate` makes vetoes/downsizing live; runbook `docs/_internal/operations/alfaclub/alfaclub-counter-trade-production-runbook.md`. Room 1659 allows a single active opt-in; extra active opt-ins are auto-paused, normalize via `pnpm -C frontend ops:counter-trade:normalize-optins -- --room 1659 --apply`. Fill classification in `counterTradeEngine.ts` is action-aware (**open / add / reduce / close** — no synthetic `flip`). **Per-room tuning:** `alfaclub.counter_trade_room_strategy.config_overrides` (JSONB; migration `20260714180000_alfaclub_counter_trade_room_config_overrides.sql`) stores rebalance/harvest/defend/limit knobs; `counterTradeRoomConfig.ts` merges overrides over env defaults at runtime; Hermit `/s` commands write via `setCounterTradeRoomConfigOverride` / `resetCounterTradeRoomConfigGroup`. DGCLAW lane: `DGCLAW_API_KEY` gates only `dgclaw.sh` leaderboard/forum commands (trading signs directly via the ACP agent wallet) and must be a Railway service variable — the container's `/app/dgclaw-skill/.env` is wiped on redeploy; dgclaw-skill v2 uses flag-style `trade.ts` args run with `tsx`, and ACP session state must live on the persistent volume `HOME`. **ACP refresh tokens are single-use:** running `acp configure` (e.g. during `/arena agent create` session rotation) from a previously captured `ACP_ACCESS_TOKEN`/`ACP_REFRESH_TOKEN` env triplet overwrites the working volume session with consumed tokens — subsequent boots then fail `whoami: Session expired` / `NOT_AUTHENTICATED` until a fresh browser `acp configure` is run as the owning wallet, the Railway `ACP_*` vars are updated, and the stale triplet is cleared so reboot cannot re-poison the session. This is now guarded in code: `acpAuthBootstrap.ts` persists a fingerprint of the consumed triplet (`consumed-seed.json` on the ACP volume HOME) and refuses re-seeding (`seed_already_consumed`); the `/arena` agent-create rotation skips configure with an `acp_session_rotation_skipped_consumed_seed` audit event — only a genuinely fresh token pair re-seeds. `acp agent create` takes `--signer`, not `--owner`.

- **Hermit token and reaction durability ownership:** Vercel `/api/v1/alfaclub/chat-token-refresh` is the canonical Privy/JWT writer; Railway Hermit only reads DB-backed token state and reports `tokenRefresherReason=vercel_cron_owner`. Railway 401 recovery never refreshes Privy directly. InverseAKITA reaction execution must claim durable storage before trading: full capture uses the `20260717000000`–`20260717080000` inverse-opinion lifecycle/outbox migration chain with `ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED=1`; Railway fails closed with `capture_required` when that flag is off, and the legacy command-ledger fallback uses `failureMode: 'closed'` so DB loss skips rather than duplicates a live trade. Hermit health reports `counterTradeEffective` and `counterTradeEffectiveReason`; when the runner flag is enabled, `/readyz` returns 503 until effective work is observed. A started ticker that only skips room-1659 `entry` with `chat_reaction_owns_open` is expected; successful non-entry ticks count as effective work. Blanket `staker_pilot_mode` early-return is retired.

- **InverseAKITA ACP identity and signer provisioning.** The counter-trade ACP agent is **InverseAKITA** (`019e90fa-3c8c-7ba0-8547-bf6f81698c3d`, agent wallet `0x74ab91cd845ff0d2006404440af49c3bc8c1df96`), owned by the user's **personal** Virtuals account `0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9` by explicit user choice — not the hermit4626 identity. Fresh-volume signer setup: run `acp agent add-signer --agent-id <id> --policy restricted --no-wait --json` inside the container with `HOME` set to the ACP state dir, have the owner wallet approve the returned `signerUrl` within ~5 minutes, then finalize with `acp agent signer-status`; bootstrap reads signer readiness from the `publicKey` in the volume `config.json`, and on fresh volumes auto-pins the keyring file backend. Railway gotcha: GraphQL `variableUpsert` does not reliably restart the running process — a redeploy can snapshot env **before** the upsert lands, leaving a live process on stale values (`railway ssh` shows the new value while the process keeps the old one); force `serviceInstanceRedeploy` after variable changes and verify runtime behavior, not just stored vars.

- **The AlfaClub ERC-8004 self-feedback lane is intentionally disabled in production.** `ALFACLUB_VIGILANTE_FEEDBACK_ENABLED` is removed from Vercel env, so the daily `/api/v1/alfaclub/run` cron keeps indexing/ranking and publishing Lens scorecards but no longer calls `giveFeedback` on agent 2205. When it was on, feedback txs were signed by the dedicated sidekick EOA (`ALFACLUB_VIGILANTE_SIGNER_PRIVATE_KEY`), not the canonical CSW agent identity. Do not re-enable without a product decision. The 67 historical self-feedback entries on agent 2205 were revoked on-chain (June 2026) via `frontend/scripts/ops/revoke-alfaclub-self-feedback.ts` (dry-run by default; execute requires `--confirm=REVOKE-SELF-FEEDBACK`; `revokeFeedback` is reviewer-scoped, so the original sidekick EOA must sign).

- **AlfaClub chat API calls may route through the optional `alfaclub/infra/cloudflare-proxy/` relay.** When the proxy is configured, `chatBridge` must keep the AlfaClub browser-fingerprint headers derived from the upstream API origin and send the proxy shared secret only to the relay.

- **`alfaclub/infra/cloudflare-proxy` must treat `GET`, `HEAD`, and `OPTIONS` as bodyless methods.** Do not forward `req.body` when constructing upstream requests for those methods; `HEAD` and CORS preflight paths can fail if they accidentally carry a body.

- **AlfaClub websocket sends may route through the optional WS proxy lane.** `chatBridge` uses `ALFACLUB_WS_PROXY_URL`, `ALFACLUB_WS_PROXY_HTTP_SEND_URL`, and the matching proxy secret only when configured; the direct AlfaClub socket path remains the default when those env vars are unset.

- **AlfaClub bridge 401s can be proxy-secret drift, not token failure.** If a browser `room_history_paginate` request succeeds but `chat-bridge-run` returns upstream `401` through the Worker relay, check that Worker `PROXY_SHARED_SECRET` and Vercel `ALFACLUB_CHAT_API_PROXY_SECRET` are aligned, then redeploy the Vercel app before rotating AlfaClub auth again.

- **AlfaClub bot replies failing with `bot_message_failed:401 invalid or revoked token` means `ALFACLUB_API_KEY` was revoked** — commands still execute; only the reply lane dies. Rotate the key on both Railway and Vercel production (force a prod rebuild with a `[force-vercel]` commit if needed). The websocket fallback send can log success without delivering when the server kicks sockets shortly after open, so don't trust WS "sent" logs as delivery proof. Quick validity probe: a bogus-room API call returning 403 = valid key, 401 = revoked.

- **AlfaClub live-room ingest now lands in `alfaclub.chat_ingest` (schema `alfaclub`, not `public`).** `chatBridge` ingests incoming WS room messages into this table via `chatIngestStore`, and schema bootstrap includes a one-time copy path from legacy `public.alfaclub_chat_ingest`.

- **Arena room identity resolution requires `alfaclub.arena_identity_mapping` in Supabase.** If that table/migration is missing or DB reads fail, `/arena identity show` falls back to `source: env_default` even after `/arena register default ...`. After applying `20260708000000_alfaclub_arena_identity_mappings.sql`, room `1659` resolves as `source: room_default`; `join` diagnostics can still fail independently without blocking mapping reads.

- **AlfaClub `/arena bridge` moves Base spot USDC to Hyperliquid perp via ACP.** Command flow: `acp client create-job … perp_deposit` then immediate `acp client fund`; on settlement posts in-room and auto-sweeps bridged spot to perp. Preflight detects stale ACP sessions and returns explicit re-auth guidance (`acp configure` in the runtime `ARENA_ACP_HOME` volume) instead of a generic bridge failure.

- **AlfaClub command intake normalizes bare `arena` commands under `/h`.** `chatBridge` rewrites `arena ...` to `/h arena ...` before routing (then internal remap to operator `/arena` where needed), so users can run `arena auth` / `arena bridge <amount>` without advertising bare `/arena` as the public CTA.

- **Independent Arena bot close command is `/h arena trade close <PAIR>` (for example `BTC`).** This command closes the bot wallet leg only; to stop automatic user-close → bot-close mirroring, set `ALFACLUB_COUNTER_TRADE_EXIT_ENABLED=0`.

- **Hermit meme assets should publish through Pinata/IPFS for production.** Do not rely on local `frontend/public` assets as the durable production source. Public Hermit URLs should use `https://4626.fun/ipfs/<cid>`; Vercel rewrites that path through the Pinata gateway origin `https://pinata.4626.fun/ipfs/<cid>`. Public gateway reads do not require gateway keys or IP allowlists.

- **Hermit creative draft routing is now first-party and separate from the Railway Hermit worker.** Creative `/hermit` / `/meme` / `/gmeow` drafts route through `frontend/server/_lib/hermit/skillRouter.ts`, which resolves typed per-route policy in `creativePolicy.ts` (route tier, timeout, token/retry budgets, model hints) before calling `HERMIT_AGENT_CHAT_ENDPOINT` + `HERMIT_AGENT_BEARER_TOKEN` (defaulting to Vercel `POST /api/hermit/draft`); lane ownership matrix: `docs/operations/agent-lane-policy-matrix.md`. Keep Hermit creative generation separate from Eliza auth/token-refresh control plane. Railway `frontend/server/agents/hermit/` remains a different runtime. `/api/hermit/draft` is provider-aware via `HERMIT_AGENT_PROVIDER`: `gateway` (default, `HERMIT_AGENT_MODEL` → Vercel AI Gateway) vs `openai-compatible`/`openrouter` (builds `@ai-sdk/openai-compatible` with `HERMIT_AGENT_BASE_URL` default `https://openrouter.ai/api/v1` + `HERMIT_AGENT_API_KEY` falling back to `OPENROUTER_API_KEY`; **fails closed 503** without a key). **Hermes (`nousresearch/hermes-4-70b`/`405b`) runs on OpenRouter — it is not in the Vercel AI Gateway catalog.** Because Hermes 4 is hybrid-reasoning, the compatible path strips `<think>`/`<reasoning>` blocks (`stripReasoningArtifacts`), prepends a `HERMES_OUTPUT_GUARD` system directive (gateway/GPT path unchanged), validates HTTPS base URL (503), and classifies upstream errors (timeout→504, rate-limit→429, else 502). Keep this lane isolated to creative commands and use the AlfaClub X-first toggle (`HERMIT_ALFACLUB_POST_X_FIRST`) when room rendering should be tweet-card driven.

- **AlfaClub `/help` in Hermit command rooms is room-aware Hermit catalog, not Keepr help.** `resolveAlfaClubHelpText` (`alfaclubChatHelp.ts`) routes rooms in `ALFACLUB_HERMIT_COMMAND_ROOMS` to `formatHermitCommandRoomHelp` (`hermitAlfaClubHelp.ts`); `/hermit help` in those rooms returns the same body. `chatBridge.ts` `truncateAlfaClubBotMessage` hard-caps bot posts at **2,000 chars** — keep help under `HERMIT_COMMAND_ROOM_HELP_MAX_CHARS` (tests in `help.test.ts`).

- **Hermit room welcome is one-time per (room, wallet).** `alfaclub.room_welcome_sent` (`20260602000000_alfaclub_room_welcome.sql`) dedupes welcomes in `ALFACLUB_HERMIT_COMMAND_ROOMS`; fires on a wallet’s **first ingested message** (threaded reply) or successful `POST /api/v1/alfaclub/room-access/join` (standalone post). Default on via `HERMIT_ROOM_WELCOME_ENABLED` (`0`/`false`/`off` disables). Ops: `frontend/scripts/ops/hermit-room-welcome-probe.ts` (`--claim`, `--send`, `--reset --confirm=RESET`).

- **Hermit first-time onboarding nudge** (`HERMIT_ONBOARDING_NUDGE` in `skillRouter.ts`) appends the dialect/`/hermit setup` footer on the first successful creative reply until `hermit.onboarded` is persisted for that wallet/room.

- **Hermit AlfaClub optional X cross-post** (`HERMIT_ALFACLUB_POST_X_FIRST`) posts to X first, then sends the tweet URL in-room for card rendering; when the @4626fun app lacks write permission, append `formatHermitXCrossPostSkipMessage` in-room instead of failing the creative reply.


## ETH → FriendKey (ERC-1155) composite quote (room 1659)

Buy-with-ETH is **not** ETH↔key. Price as:

**ETH → (Zora) AKITA Creator Coin → (Sudoswap) FriendKey ERC-1155**

### Invariants

- **Composite quote only.** Never treat ETH amount and key quantity as a direct exchange rate in `AlfaClubLiquidity` buyWithEth mode.
- **Sudoswap sets AKITA need; Zora sets ETH need.** `getBuyNFTQuote` → required AKITA (use slipperized buyLimit = `addSlippageBps(quote.amount)`). Live Zora ETH→AKITA probe/refine derives ETH to cover that buyLimit (`ethFriendKeyQuote.ts` + `ethFundingQuoteQuery`).
- **Native ETH sentinel is full 20 bytes:** `ZORA_NATIVE_ETH_TOKEN` / server `NATIVE_TOKEN_ADDRESS` = `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`. Truncated `0xeee…` (36 nibbles) fails `isAddress` and breaks Zora currency mapping.
- **Funding preview must not require SIWE.** Connected CSW can load Sudoswap on-chain without a session cookie. `/api/zora/tradeQuote` must allow IP-rate-limited anonymous pricing quotes (`anon` rate-limit key). Client sends `withCredentials: true` when a session exists.
- **Preview may be amountOut-only.** Funding estimate uses `allowAmountOutOnly` / `preview: true` — do not require executable calldata for the auto-fill quote. Submit path still needs a full executable Zora quote + permits as today.
- **Gate submit on coverage.** Disable when funding AKITA out < required buyLimit, while quoting, or when the funding quote errors. Surface the real Zora/API error string in the UI hard error.

### Touch points

- UI: `frontend/src/pages/AlfaClubLiquidity.tsx` (`buyWithEth`, `ethFundingQuoteQuery`)
- Helpers: `frontend/src/lib/alfaclub/ethFriendKeyQuote.ts`, `ethFundingRouter.ts`
- Client API: `frontend/src/lib/zora/zoraTradeApi.ts` (`fetchZoraTradeQuoteFromApi`)
- Server: `frontend/api/_handlers/zora/_tradeQuote.ts`, `frontend/server/_lib/zora/zoraTradeQuote.ts`

### Regression checks

- `pnpm -C frontend exec vitest run src/lib/alfaclub/ethFriendKeyQuote.test.ts src/lib/alfaclub/ethFundingRouter.test.ts src/lib/zora/zoraTradeAmountOut.test.ts api/__tests__/zoraTradeQuoteAuth.test.ts src/pages/AlfaClubLiquidity.readiness.test.ts`
- Unauthenticated `POST /api/zora/tradeQuote` with native ETH → AKITA + `preview: true` must return `200` with `quote.amountOut` (not `401 Authentication required`).

### Planned live cutover: ShareOFT ↔ FriendKey

Target buy-with-ETH path when vaults are live:

**ETH → (Uniswap) ShareOFT → (Sudoswap) FriendKey ERC-1155**

Prep (do not enable in production until checklist is green):

1. Deploy + register an official Sudoswap ERC-1155/ERC-20 TRADE pair with **ShareOFT** as the ERC-20 (same 690 bps fee / XYK rules as room 1659).
2. Point `VITE_ALFACLUB_ROOM_1659_SUDOSWAP_PAIR` / `ALFACLUB_ROOM_1659_SUDOSWAP_PAIR` at that pair.
3. Set `VITE_ALFACLUB_FRIENDKEY_PAIR_ERC20_KIND=shareOft` (and align paymaster `ALFACLUB_LP_CREATOR_COIN` / access-policy pair ERC-20 to ShareOFT — the on-chain `markets()` field is still named `creatorCoin` but holds the pair ERC-20).
4. Verify ETH→ShareOFT Uniswap depth; funding quotes use `ethFundingProvider: 'uniswap'`.
5. Wire Uniswap **execute** for ETH funding (quote path is ready; submit still gates ShareOFT until execute cutover).
6. Keep creator-coin lane as rollback: unset/ `creatorCoin` kind.

Code: `friendKeyFundingLane.ts`, `ethPairErc20FundingQuote.ts`, `AlfaClubLiquidity` (`fundingLane`).

