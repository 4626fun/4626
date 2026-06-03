# Virtuals Arena Runbook (Railway-First)

This runbook covers the 4626 `Arena` control lane exposed through Hermit command rooms (default: room `1659`) and backed by `frontend/server/_lib/arena/*`.

## Scope

- Railway-first operations for:
  - Arena onboarding (`join`)
  - unified account activation
  - API wallet setup
  - Base USDC deposit
  - Hyperliquid/Arena trade commands
- Safety defaults:
  - `ARENA_ENABLED=0` unless intentionally turned on
  - `ARENA_TRADING_ENABLED=0` unless execution is approved
  - `ARENA_DRY_RUN=1` by default

## Prerequisites

- For manual/owned creation: Existing Virtuals/ACP agent created via app.virtuals.io/acp/new (or `acp agent create` under an ACP session whose ownerWallet is your Alfa EOA). Connect the *alfaclub sender wallet* during that web flow if you want the agent's ACP userId/dashboard ownership to match your chat identity. The no-args `/arena register` create path creates under the *bot runtime's* ACP session (see ACP_OWNER_WALLET).
- `dgclaw-skill` (or equivalent scripts + `acp` CLI) available on the Railway runtime host. `ARENA_ACP_BIN` (usually "acp") must resolve.
- `ARENA_CREATION_ENABLED=1` (default) to allow the create path of `/arena register`.
- Env configured in `frontend/.env.example` Arena section:
  - `ARENA_ENABLED`
  - `ARENA_TRADING_ENABLED`
  - `ARENA_DRY_RUN`
  - `ARENA_AGENT_ID`
  - `ARENA_AGENT_WALLET_ADDRESS`
  - `ARENA_HL_API_WALLET_ADDRESS` (optional)
  - `ARENA_DGCLAW_DIR`
  - optional `ARENA_ALLOWED_ROOM_IDS`
  - optional `ARENA_ASSET_ALLOWLIST`

## Active 4626 Arena identity (akitai)

- Control room: `1659`
- Arena Agent ID: `019e82af-2e66-7645-af23-69e9f14351f4`
- Arena V2 wallet: `0x30068c6bccf43e9eb5cdb68fb978f32f744d870c`

## Migration (Legacy Agent -> V2 wallet)

If agent is still on legacy wallet:

1. Open `app.virtuals.io/acp/agents` and link a new agent wallet to the same Agent ID.
2. Open `degen.virtuals.io/dashboard` and use **Migrate** on the agent.
3. Confirm balances moved to the new wallet before re-enabling trading.

## Command Surface (from room 1659)

- `/arena status`
- `/arena assets`
- `/arena join`
- `/arena activate`
- `/arena add-api-wallet`
- `/arena deposit <usdc>`
- `/arena trade open <pair> <long|short> <sizeUsd> <leverage>`
- `/arena trade close <pair>`
- `/arena register [agentId agentWallet [hlApiWallet]]` — programmatic bind + onboard (drives `acp agent create` if ids omitted). Binds the *current sender* (alfaclub wallet) as 'mine'. See "Programmatic registration" below.

## HIP-3 Pair Policy

Enforced in code (`arenaPairPolicy.ts`):

- Crypto perps: plain symbol (`BTC`, `ETH`, `SOL`)
- HIP-3 assets: must use `xyz:` prefix (`xyz:GOLD`, `xyz:NVDA`)
- Any colon pair not starting with `xyz:` is rejected

Policy rationale aligns with Arena council recognition filter.

## Programmatic registration (`/arena register`)

`/arena register` (and aliases `create` / `create-agent`) supports create-driven and supplied-ids paths. It reuses the existing arena client + identity mapping + activeConfig override so the bound agent is used for subsequent join/activate/deposit/trade/status without env restarts.

From inspection of the official sources (Virtual-Protocol/acp-cli, dgclaw-skill, openclaw-acp):

- Agent creation is `acp agent create [--name <n>] [--description <d>] [--image <u>] [--signer]`.
  - The CLI client (src/commands/agent.ts) only declares those flags; `--owner` is not a recognized option (our wrapper still appends it best-effort for audit/compatibility).
  - Internally it POSTs to the ACP backend `/agents` under the current auth session. The returned Agent has `id`, `walletAddress` (freshly provisioned EVM wallet for the agent — used as on-chain identity + for signing HL approvals), `userId` (the ACP user/account that created it), etc.
  - `acp configure` (interactive browser OAuth/SIWE or headless via `--token`/`--refresh-token`/`--wallet` or ACP_ACCESS_TOKEN/ACP_REFRESH_TOKEN/ACP_OWNER_WALLET envs) establishes the session. Tokens are stored keyed by the ownerWallet. The session determines which "user" the created agent belongs to on the Virtuals/ACP side (dashboard visibility, management, potential tokenized-agent rewards, etc.).

- The "Arena" here is Degenerate Claw (degen.virtuals.io / dgclaw-skill): a perps trading competition + public forums for ACP agents. Agents trade directly on Hyperliquid (signed by the ACP agent wallet or a delegated HL API wallet set up via acp wallet sign-typed-data + dgclaw scripts). Registration/join flows use ACP jobs (e.g. perp_deposit offering) + dgclaw.sh join + activate-unified + add-api-wallet.

Current `/arena register` behavior (code in skillRouter.ts + arenaClient.ts):

- No ids supplied (create path): if `ARENA_CREATION_ENABLED=1`, runs the acp create under the *runtime's* pre-configured ACP session (the one set up for the dgclaw/ Railway process). On success (stdout parses Agent ID + wallet via our tolerant parser looking for "Agent ID:", "Wallet: 0x...", JSON, etc.), it **auto-binds** the ids (to sender for personal or '*' for `default`) in the alfaclub arena identity mapping table, then drives the full onboarding sequence (join → activate-unified-account → add-api-wallet) using an activeConfig override. Dry-run is respected. Replies include sanitized acp output, bound ids, step results, and a note about ownership.
- With ids supplied: validates, (for personal) short-circuits if already exactly bound, binds the mapping for the target (sender or '*'), runs the onboarding steps, reports results.
- `default` keyword targets room-wide default (upsert with sender_address='*'); otherwise personal ('mine' for the Alfa sender in chat).

Ownership / "the wallet address on alfaclub becomes the agent on virtuals":

- For *bot control + arena execution in the room*: yes — the per-sender or '*' mapping + activeConfig means `/arena trade` etc. from that chat sender (or room default) will use the bound agentId/wallet/hlApi for the acp calls and dgclaw scripts. The AlfaClub sender EOA is the "user" in the chat sense.
- For *on-platform ACP/Virtuals ownership* (the agent's `userId`, appearance in the creator's ACP dashboard at app.virtuals.io/acp, management UIs, any tokenized rewards/claims that are account-scoped): this is determined by the ACP auth session at creation time (the `userId` on the Agent row). The bot's runtime session (ACP_OWNER_WALLET from its headless configure) "owns" agents created via the no-args `/arena register` path.
- To have an agent whose ACP owner is specifically *your* Alfa EOA (0x64c3... in the 1659 example):
  1. (Recommended for most users) Go to the Virtuals ACP web (app.virtuals.io/acp/new or equivalent "new agent"), authenticate/connect while using your Alfa EOA as the identity (SIWE or Virtuals login that links the wallet). Create the agent there. Note the Agent ID and its walletAddress (and optionally set up HL API wallet via their flows or acp).
  2. Then in chat: `/arena register <thatId> <thatWallet>` (personal for you) or `/arena register default <id> <wallet>` (to make it the room default).
  3. (Advanced) Run `acp configure` (or the split start/complete) on a workstation with *your* Alfa as the connected wallet to obtain ACP tokens, then provide the ACP_ACCESS_TOKEN/ACP_REFRESH_TOKEN/ACP_OWNER_WALLET=0xYourAlfa... to the operator. They can use those to (temporarily) make the bot runtime's session be you, then `/arena register default` (no args) will create under your identity. Tokens are single-session; rotate as needed. Not chat-self-service.
- The `--owner` we pass from the Alfa sender during create is best-effort/audited but not honored by the current official acp-cli for changing the creator userId.

Examples:

Create + auto-onboard as your personal (under bot session ownership):
```
/arena register
```

Create + auto as room default:
```
/arena register default
```

After you created on web with your Alfa connected (for true ownership):
```
/arena register 019e82af-2e66-7645-af23-69e9f14351f4 0x30068c6bccf43e9eb5cdb68fb978f32f744d870c
/arena register default 019e82af-... 0x3006...
```

Verify:
```
/arena identity show
/arena status
```

Safety / notes: same gates as before (CREATION_ENABLED, DRY_RUN, room allowlist, AlfaClub trusted gate for /arena head). The create path is lower-risk than live trading (no USDC movement until you `/arena deposit`). Use `ARENA_CREATION_ENABLED=0` to disable the no-ids create entirely if you only want supplied-ids binds. Repeated creates under the shared session will accumulate agents under the operator ACP account — clean up via web or acp agent commands if needed. Always dry-run first.

For full details on acp-cli flags, headless auth, and the dgclaw flow, see the GitHub sources:
- https://github.com/Virtual-Protocol/acp-cli (especially README, src/commands/{agent,configure}.ts, src/lib/api/{agent,client}.ts, config.ts)
- https://github.com/Virtual-Protocol/dgclaw-skill (SKILL.md for Arena/DegenClaw join/leaderboard/trade specifics)

Env vars (in addition to prior): ACP_* for headless if you want to rotate the runtime identity; ARENA_CREATION_ENABLED (default 1). The dgclaw clone at ARENA_DGCLAW_DIR provides the acp bin wrapper + scripts/.

This gives the best of both: quick chat-driven functional arena agents for the room/sender, with clear path for per-Alfa ownership when desired.

## Rollout Sequence

1. Enable read-only lane:
   - `ARENA_ENABLED=1`
   - `ARENA_TRADING_ENABLED=0`
   - `ARENA_DRY_RUN=1`
2. Validate command + room gating:
   - `1659` accepts `/arena status`
   - non-allowed room rejects `/arena ...`
3. Dry-run setup:
   - `/arena join`
   - `/arena activate`
   - `/arena add-api-wallet`
   - `/arena deposit 100`
   - `/arena trade open xyz:GOLD long 5000 2`
4. Controlled execute window:
   - `ARENA_TRADING_ENABLED=1`
   - keep `ARENA_DRY_RUN=1` for one pass
5. Live execution:
   - set `ARENA_DRY_RUN=0`
   - run minimal-size deposit + one minimal-size trade

## Incident Playbook

### Pair rejected

- Symptom: command replies with `xyz: prefix` guidance.
- Action: rewrite pair with `xyz:` prefix for HIP-3 assets.

### Trading disabled

- Symptom: command replies with `ARENA_TRADING_ENABLED`.
- Action: confirm change window approval, then set `ARENA_TRADING_ENABLED=1`.

### Command path misconfigured

- Symptom: status passes but join/deposit/trade fails with command/file errors.
- Action:
  - verify `ARENA_DGCLAW_DIR`
  - verify `ARENA_DGCLAW_BIN`
  - verify scripts exist (`scripts/deposit.ts`, `scripts/trade.ts`)

### API wallet/setup drift

- Symptom: trade failures after successful command dispatch.
- Action:
  - rerun `/arena add-api-wallet`
  - confirm API key in runtime env used by scripts
  - rerun `/arena status` + dry-run trade first

### Risk stop

- Immediate freeze:
  - set `ARENA_TRADING_ENABLED=0` OR
  - set `ARENA_ENABLED=0`

## Audit Expectations

Arena actions emit structured logs (`[arena.audit] ...`) including:

- event type (`join`, `activate_unified_account`, `deposit`, `trade_open`, `trade_close`)
- dry-run state
- key trade metadata (pair/side/size/leverage)

Use these logs as the source of truth for post-mortems.
