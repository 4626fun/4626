---
name: bankr
description: Bankr integration for 4626 agent stack with hard canonical CSW enforcement. Use for Bankr status, balances, profile eligibility, and confirmation-gated Bankr writes.
---

## Overview

This skill integrates Bankr Agent API capabilities into the 4626 Keepr/Eliza stack while preserving the canonical wallet invariant:

- Canonical wallet remains the Zora Coinbase Smart Wallet (CSW)
- Bankr writes are hard-gated unless Bankr EVM wallet identity matches canonical CSW
- Mutating operations require explicit confirmation and ADMIN/OWNER authorization

## Required Environment

- `BANKR_API_KEY` (required)
- `BANKR_API_URL` (optional, defaults to `https://api.bankr.bot`)

## Safety Model (Hard CSW)

Before any mutating Bankr operation:

1. Resolve canonical wallet
2. Fetch Bankr identity (`GET /agent/me`)
3. Verify Bankr EVM wallet equals canonical CSW
4. Require explicit confirmation for write actions
5. Require ADMIN/OWNER role

If any check fails, writes must be blocked.

## Runtime Surfaces

- API status probe: `/api/bankr/status`
- Keepr command surface: `/bankr ...`
- Eliza structured command: `/bankr <skill_name> <json_payload>`

## Suggested Commands

- `/bankr help` — command list
- `/bankr status` — CSW match probe + Bankr identity status
- `/bankr me` — account metadata
- `/bankr balances [base,solana]` — wallet balances
- `/bankr ask <question>` — read-only prompt to Bankr agent
- `/bankr exec <instruction> --confirm` — write-intent prompt (guarded)

## bankr.bot/agents Listing Path

To appear on `https://bankr.bot/agents`, account must be eligible for profile creation:

- token deployed through Bankr, or
- fee beneficiary on a Bankr-deployed token

Use profile eligibility/probe flows first. Do not auto-launch tokens without explicit operator approval.

## Implementation Notes

- Prefer server-side Bankr API calls; never expose `BANKR_API_KEY` client-side.
- Use deterministic failure messages for mismatch/confirmation/role failures.
- Keep read operations available even when wallet match fails.
