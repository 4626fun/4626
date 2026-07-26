# Deploy vault operator (deploy-session)

Tier 2 archive. Server-side deploy-session autopilot, endpoints, recovery.

CSW delegation: [wallet-csw-lifecycle.md](./wallet-csw-lifecycle.md). Cutover prefs: [deploy-cutovers-vault.md](./deploy-cutovers-vault.md).

---

# Deploy Vault Operator

This skill is the canonical long-task workflow for 1-click 4626 deploys in this repo.

## Scope

This skill covers the **server-side deploy-session** execution track: the user approves a one-time `addOwnerAddress(sessionOwner)` on their canonical CSW, and the server continues the deploy as an ERC-4337 sender on the parent CSW. This is the direct-owner-delegation path defined in `.cursor/rules/csw-agent-lifecycle.mdc`.

It is **separate from** the user-initiated frontend execution track (swaps, vault interactions), which uses app-scoped sub-accounts per `docs/4626-connection-methods.md` Section 2. Deploy-session temporary owners must be removed after deployment; sub-accounts persist.

## Goal

Run deploys as a resilient workflow:
1. Validate infra + config first.
2. Start a deploy session safely.
3. Resume phases server-side only when the temporary session owner is installed.
4. Poll and drive status until terminal.
5. Report exact failure step + next action.

## Canonical Endpoints (v2)

- `POST /api/deploy/v2/session/start` (wrapper: create + guarded resume)
- `POST /api/deploy/v2/session/create`
- `POST /api/deploy/v2/session/resume` (workflow ticks; primary progression API)
- `POST /api/deploy/v2/session/status` (**read-only**)
- `POST /api/deploy/v2/session/cancel`
- `POST /api/deploy/v2/session/dry-run`
- `POST /api/deploy/v2/session/solana-post-deploy-status` (async Phase 5)
- `GET /api/deploy/v2/session/role-policy/resolve`
- `POST /api/paymaster` (indirect via resume/status)

Legacy `/api/deploy/session/*` + `continue` are retired; do not document them as primary.

## Canonical Steps

Expected progression (optional stages omitted when the plan has no calls):

```text
created
  → phase1_sent → phase1_confirmed
  → phase1_finalize_sent → phase1_finalize_confirmed   (when Phase 1 is split)
  → phase2_core_sent → phase2_core_confirmed
  → phase2_pre_finalize_sent → phase2_pre_finalize_confirmed  (optional)
  → phase2_finalize_sent → phase2_finalize_confirmed
     (legacy aliases: phase2_sent / phase2_confirmed)
  → phase3_sent → phase3_confirmed
  → phase4_sent → phase4_confirmed                      (when present)
  → completed
```

Async after Base complete (not an on-chain deploy-session step gate for cleanup):

- Solana share-mesh / Meteora via `solana-post-deploy-status` (UI Phase 5)
- `ovault_mesh_sent` / `ovault_mesh_confirmed` may appear in session state when mesh work is tracked

Cleanup path:

`cleanup_sent → cancelled`

## Prereqs (Server)

- `CDP_PAYMASTER_URL`
- `AUTH_SESSION_SECRET`
- `CANONICAL_ORIGIN`
- `DATABASE_URL`
- `DEPLOY_SESSION_TOKEN_HMAC_SECRET`
- `PRIVY_APP_ID`
- `PRIVY_APP_SECRET`
- `PRIVY_WALLET_AUTHORIZATION_KEY`
- `PRIVY_WALLET_OWNER_ID`
- `PRIVY_WALLET_POLICY_ID`

Production safety:
- keep `VITE_ALLOW_CONTRACT_OVERRIDES` unset/`0`
- keep `ALLOW_API_CONTRACT_OVERRIDES` unset/`0`
- `VITE_DEPLOYMENT_VERSION=v1.19.3` (CREATE2 salt; shell is v1.19.1; Phase1Module is v1.19.4 repair)

## Runbook (CLI)

Use the autopilot script:

```bash
pnpm -C frontend run deploy:autopilot -- \
  --origin https://app.4626.fun \
  --plan ./deploy-plan.json \
  --auth-bearer "$CV_AUTH_SESSION_TOKEN"
```

The plan file is the same payload shape used by `deploy/v2/session/create`:
- `smartWallet`, `creatorToken`, `ownerAddress`
- `phase1Calls`
- `phase2CoreCalls`
- optional `phase2PreFinalizeCalls`
- `phase2FinalizeCalls` (or legacy `phase2Calls`)
- optional `phase3Calls`, `phase4Calls`, `version`

## Recovery Rules

- `nextAction=wait_for_owner_install`:
  wait for `CoinbaseSmartWallet.addOwnerAddress(sessionOwner)` to confirm, then **resume**.
- `step in *_confirmed` with no in-flight userOp:
  call `deploy/v2/session/resume`.
- `failed`:
  inspect `lastError`; fix root cause; restart with a new session (or cancel old if owner still installed).
- `cleanup_sent` stuck:
  poll `status` until `cancelled`, then verify owner removed.

## Guardrails

- Never call `resume` before owner-install check passes.
- Never bypass paymaster/session headers.
- Never run prod with contract override flags enabled unless explicitly canarying.
- Always report `sessionId`, `step`, `lastUserOpHash`, `lastTxHash`, `lastError`.
