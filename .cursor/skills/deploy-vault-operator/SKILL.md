---
name: deploy-vault-operator
description: Operator runbook for CreatorVault 1-click deployment (deploy-session + temporary owner + server-continue phases). Use when asked to automate or operate deploys end-to-end with minimal manual steps.
---

# Deploy Vault Operator

This skill is the canonical long-task workflow for 1-click CreatorVault deploys in this repo.

## Goal

Run deploys as a resilient workflow:
1. Validate infra + config first.
2. Start a deploy session safely.
3. Continue phases server-side only when the temporary session owner is installed.
4. Poll and drive status until terminal.
5. Report exact failure step + next action.

## Canonical Endpoints

- `POST /api/deploy/session/start` (wrapper: create + guarded continue)
- `POST /api/deploy/session/continue`
- `POST /api/deploy/session/status`
- `POST /api/deploy/session/cancel`
- `POST /api/paymaster` (indirect via continue/status)

## Canonical Steps

Expected progression:

`created -> phase1_sent -> phase1_finalize_sent -> phase2_core_sent -> phase2_sent -> phase3_sent -> completed`

Cleanup path:

`cleanup_sent -> cancelled`

## Prereqs (Server)

- `CDP_PAYMASTER_URL`
- `AUTH_SESSION_SECRET`
- `CANONICAL_ORIGIN`
- `DATABASE_URL`
- `DEPLOY_SESSION_SECRET`
- `DEPLOY_SESSION_TOKEN_HMAC_SECRET`
- `PRIVY_APP_ID`
- `PRIVY_APP_SECRET`
- `PRIVY_WALLET_AUTHORIZATION_KEY`
- `PRIVY_WALLET_OWNER_ID`
- `PRIVY_WALLET_POLICY_ID`

Production safety:
- keep `VITE_ALLOW_CONTRACT_OVERRIDES` unset/`0`
- keep `ALLOW_API_CONTRACT_OVERRIDES` unset/`0`

## Runbook (CLI)

Use the autopilot script:

```bash
pnpm -C frontend run deploy:autopilot -- \
  --origin https://app.4626.fun \
  --plan ./deploy-plan.json \
  --auth-bearer "$CV_AUTH_SESSION_TOKEN"
```

The plan file is the same payload shape used by `deploy/session/create`:
- `smartWallet`, `creatorToken`, `ownerAddress`
- `phase1Calls`
- `phase2CoreCalls`
- `phase2FinalizeCalls` (or legacy `phase2Calls`)
- optional `phase3Calls`, `phase4Calls`, `version`

## Recovery Rules

- `nextAction=wait_for_owner_install`:
  wait for `CoinbaseSmartWallet.addOwnerAddress(sessionOwner)` to confirm, then continue.
- `step in *_confirmed` with no in-flight userOp:
  call `deploy/session/continue`.
- `failed`:
  inspect `lastError`; fix root cause; restart with a new session (or cancel old if owner still installed).
- `cleanup_sent` stuck:
  poll `status` until `cancelled`, then verify owner removed.

## Guardrails

- Never call `continue` before owner-install check passes.
- Never bypass paymaster/session headers.
- Never run prod with contract override flags enabled unless explicitly canarying.
- Always report `sessionId`, `step`, `lastUserOpHash`, `lastTxHash`, `lastError`.

