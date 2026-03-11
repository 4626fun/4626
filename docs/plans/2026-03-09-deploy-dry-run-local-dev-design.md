# Deploy Dry-Run Local Dev Design

**Date:** 2026-03-09

**Goal:** Make the new `/deploy` dry-run flow easy to use locally by adding a single command that starts a Base fork and the frontend dev server with the correct fork-safe env overrides.

## Problem

The dry-run endpoint now expects a local fork RPC that supports impersonation. That is correct for safety, but today the operator still has to assemble the local setup manually:

- start Anvil with the right fork URL
- point `BASE_RPC_URL` and `VITE_BASE_RPC` at localhost
- make sure local contract override flags do not drift away from repo defaults
- start `pnpm dev`

That is easy to get wrong, especially if a local `.env` already contains contract overrides or a non-fork Base RPC.

## Decision

Add a checked-in local dry-run preset plus a single shell entrypoint that:

1. loads the preset into process env
2. starts an Anvil Base fork from a separate upstream RPC variable
3. exports localhost RPC values for both server and browser paths
4. runs the frontend dev server in the foreground

## Recommended Workflow

Command:

`pnpm -C frontend dev:deploy-dry-run`

Inputs:

- `BASE_FORK_UPSTREAM_RPC_URL` points at a real Base mainnet RPC
- shell-exported localhost values override any conflicting `.env` entries

Outputs:

- local Anvil fork on `127.0.0.1:8545`
- frontend dev server on the normal Vite port
- `/deploy` uses the fork for both dry-run RPC reads and browser-side reads

## Why This Approach

This is the best default because it matches the operator’s real goal:

- run one command
- open `/deploy`
- click `Run dry-run`

It also avoids committing local-only override drift into `.env`, since the script exports the fork-safe values only for that process tree.

## Files Likely To Change

- `frontend/package.json`
- `frontend/.env.example`
- `frontend/.env.deploy-dry-run.example`
- `frontend/scripts/dev-deploy-dry-run.sh`
- `frontend/README.md`
- a new small Vitest config test for the workflow wiring

## Recommendation

Implement the full fork-plus-app workflow with a checked-in example preset and a shell runner. Keep it boring: no new dependencies, no process manager, just one script with clear validation and cleanup.
