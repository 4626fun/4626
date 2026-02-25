---
title: Cursor Cloud Agent Onboarding
sidebar_position: 5
---

# Cursor Cloud Agent Onboarding

Use this runbook to set up `cursor.com/agents` for this repository with the committed `.cursor` configuration.

## Recommended setup mode

Use the **Agent-driven UI flow** unless you have a strict base-image/toolchain requirement.

1. Run `Cursor: Start Cloud Agent Setup` from the command palette (or go to `cursor.com/onboard`).
2. Apply repository settings and secrets.
3. Create a snapshot after setup succeeds.

Prefer Dockerfile-based setup only when you need image-level control that snapshotting cannot provide.

## Repo defaults in this project

- Config file: `.cursor/environment.json`
- Install script: `.cursor/install.sh`
- Start script: `.cursor/start.sh`
- Network policy (optional hardening): `.cursor/sandbox.json`

### Default terminals

- **Frontend Dev Server**: `cd frontend && pnpm dev` (port `5173`)
- **CRE Unified Runner**: `cd cre && npm run start`

Optional docs server (not in default terminals): `cd apps/docs-site && pnpm start` (port `3000`)

## Install and start model

- `install` is **idempotent** and only installs dependencies.
- Do not start long-running app processes in `install`.
- `start` is for required services only (for example Docker daemon if needed).
- App servers and workers belong in `terminals` (tmux-managed by Cloud Agent).

## Secrets and environment policy

- Put API keys and DB credentials in Cursor **Secrets** (dashboard), not in git.
- Keep `.env` files local-only.
- Use redacted secrets for high-risk credentials.

## Network hardening (optional)

`.cursor/sandbox.json` uses `default: deny` plus allowlisted domains for package registries and required external APIs.

If Cloud Agent logs show blocked outbound requests, add only the minimum required domains.

## Validation checklist

- [ ] Run UI onboarding and select this repository.
- [ ] Confirm `install` and `start` execute without blockers.
- [ ] Confirm frontend starts on `5173`.
- [ ] Confirm CRE runner starts and exits cleanly when expected.
- [ ] Confirm secrets are configured in Cursor dashboard (no secret commits).
- [ ] Create and save a Cloud Agent snapshot.
