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
- To have an agent whose ACP owner is specifically *your* Alfa EOA (0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9 for room 1659):
  1. (Recommended for true ownership) On a workstation, run `acp configure` while connected as 0x64c3... (or use web at app.virtuals.io/acp/new — sign in with that wallet). Then `acp agent create --name "1659-Alfa-Arena" --description "..."`. Note the new Agent ID and its walletAddress.
  2. First, authorize yourself (this is the part you asked about — the "deployment platform"):
     - This refers to **Railway** (the hosting platform for the live "4626-alfaclub-bridge" / "hermit-agent" service that processes AlfaClub chat commands, Hermit, and /arena for rooms like 1659. It is the service where you previously set ARENA_ALLOWED_ROOM_IDS, ARENA_AGENT_ID, ARENA_DGCLAW_DIR, etc.).
     - Log into https://railway.app
     - Open your 4626 project.
     - Find the service (it may be named "4626-alfaclub-bridge", "hermit-agent", "hermit", or any service that already shows ARENA_DGCLAW_DIR or HERMIT_ variables in its list — search your services for ones with ARENA_ vars).
     - Click into that service → "Variables" tab (left sidebar).
     - Click "+ New Variable".
     - Key: `HERMIT_OWNER_ADDRESS`
       Value: `0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9`
     - (Also good:) Add `HERMIT_ALLOWED_USERS` with the same value (or comma-list if you have others).
     - If you have an explicit `HERMIT_ALLOWED_ROOM_IDS` (currently perhaps only 1043), add 1659 to it: e.g. `1043,1659`. This ensures the room is explicitly allowed for Hermit commands. If left unset, it falls back to checking if the HERMIT_OWNER_ADDRESS holds the corresponding AlfaClub room key.
     - Save the variable. Railway will automatically start a new deployment for the service (watch the "Deployments" tab for it to go green).
     - If it doesn't auto-deploy, click the "Deploy" button at the top of the service page.
     - This restarts the process that enforces the /arena gate (in execute.ts). Once the new deployment succeeds, commands from your 0x64c3... wallet in room 1659 will be allowed (owner bypass + allowlist).
     - See the updated `.env.example` in the repo for the exact comments with your address.
  3. In the 1659 room, post from your 0x64c3... wallet:
     - `/arena identity clear default` (clears old 019e82af... / 0x3006... binding)
     - `/arena register default <newAgentId> <newAgentWallet>` (binds as room default + runs join/activate/add-api-wallet)
  4. Verify: `/arena identity show` and `/arena status`. (Status output now includes the active agentId/arenaWallet and hints if identitySource=env_default, meaning no DB mapping row is active yet.)

  5. Cleanup: Once the DB mapping is live for your new agent (visible in identity show), remove the old envs from the Railway service:
     - Delete `ARENA_AGENT_ID` (was 019e82af...)
     - Delete `ARENA_AGENT_WALLET_ADDRESS` (was 0x3006...)
     - (and `ARENA_HL_API_WALLET_ADDRESS` if it was tied to the old agent)
     Redeploy. These are now only ultimate fallbacks; the DB row (source=db) wins for room 1659 default. (I also removed the old hardcoded defaults from source in arenaConfig.ts.)
  5. (Advanced, for making the *chat no-args create path* also own under you) 
     - Locally: `acp configure` while connected as 0x64c3... to obtain the tokens (access/refresh for your wallet).
     - On the Railway service (same one as ARENA_DGCLAW_DIR): set 
       ACP_ACCESS_TOKEN=... 
       ACP_REFRESH_TOKEN=...
       ACP_OWNER_WALLET=0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9
     - Redeploy the service.
     - The code now auto-detects these ACP_* envs in runArenaCreateAgent and runs headless `acp configure` first (to switch the local acp storage to your session), then does the agent create under your ACP identity (so the agent is owned by you on Virtuals dashboard).
     - Then run `/arena register default` (no args) in chat.
     - After success, unset the personal ACP_* (or set operator's back) and redeploy to rotate the runtime session off your tokens.

**Do we need a continuous "refresh thing" like Alfaclub's runtime JWT + chat-token-refresh?**

No — not for basic operation.

The `acp` CLI itself has built-in refresh logic (see `resolveToken` + `refreshCliToken` in acp-cli source): once the container's ACP storage has been initialized with a valid access + refresh pair (via the initial headless configure), any future `acp` command will automatically detect an expired short-lived access token, use the refresh_token to fetch a fresh one from ACP/Privy, and update the local storage for that wallet.

This is different from Alfaclub, where we manage a custom JWT entirely on our side and must keep it fresh for every outbound call to the external AlfaClub API (hence the runtime secret + dedicated refresh cron/endpoint that updates storage without a full redeploy).

Here, auth is delegated to the acp binary, so the CLI handles access-token rotation internally on use.

You only need to re-rotate (re-auth locally with your 0x64c3... wallet, update the three ACP_* envs, redeploy) when the *refresh_token* itself expires or is invalidated.

For now this is sufficient (agent creation is infrequent). If you want fully automated long-term refresh without manual re-auth (e.g. a background job that calls the refresh and updates storage), we can add it later modeled after the Alfaclub one. Let me know.
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
