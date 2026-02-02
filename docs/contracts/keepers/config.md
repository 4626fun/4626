---
title: Config
---

# Keepr Configuration Schema (MVP)

This document defines the **MVP configuration schema** for Keepr, the vault-bound operator agent.

Keepr must operate deterministically using **explicit configuration + onchain state**.
Configuration must be **exportable** and **walkaway-safe**.

---

## Goals

Keepr config must:

- bind the agent to exactly **one vault**
- define explicit **gating rules**
- define explicit **roles / permissions**
- support safe defaults (fail closed for access)
- avoid secrets (no private keys, no tokens in config)

---

## Config Object (Top-Level)

### Example

```json
{
  "version": 1,
  "chainId": 8453,
  "vault": {
    "vaultAddress": "0xVault...",
    "creatorCoinAddress": "0xCreatorCoin...",
    "canonicalOwnerAddress": "0xOwner...",
    "shareTokenAddress": "0xShares..."
  },
  "xmtp": {
    "groupId": "xmtp-group-id",
    "agentInboxId": "xmtp-agent-inbox-id"
  },
  "gating": {
    "enabled": true,
    "joinLocked": false,
    "mode": "shares",
    "thresholds": {
      "minShares": "1000000000000000000"
    },
    "failClosed": true
  },
  "roles": {
    "owner": "0xOwner...",
    "admins": ["0xAdmin1...", "0xAdmin2..."],
    "operators": []
  },
  "behavior": {
    "dmDenials": true,
    "dmRemovals": true,
    "emitJoinSignals": true,
    "emitMilestones": true
  },
  "rateLimits": {
    "commandCooldownMs": 1500,
    "syncMaxMembersPerBatch": 25,
    "syncCooldownSeconds": 600
  }
}
Fields
version (required)
Type: number

Purpose: schema versioning

chainId (required)
Type: number

Expected: 8453 (Base)

Keepr must refuse to operate if chainId is unsupported or mismatched.

Vault Bindings
vault (required)
Vault bindings are immutable unless updated via authorized admin actions.

vault.vaultAddress (required)
Type: 0x address

Vault contract address

vault.creatorCoinAddress (required)
Type: 0x address

Zora Creator Coin address (identity signal)

vault.canonicalOwnerAddress (required)
Type: 0x address

Canonical identity wallet and vault owner

vault.shareTokenAddress (optional)
Type: 0x address

Vault share token address (if the vault issues shares)

If omitted, Keepr must not enforce share-based gating.

XMTP Bindings
xmtp (required)
xmtp.groupId (required)
Type: string

XMTP group identifier for this vault community

xmtp.agentInboxId (optional but recommended)
Type: string

Inbox ID for Keepr instance

Gating Rules
gating (required)
gating.enabled (required)
Type: boolean

Enables/disables gating enforcement

gating.joinLocked (required)
Type: boolean

If true, new joins are blocked regardless of eligibility

gating.mode (required)
Type: string

Allowed values:

"shares" (MVP)

"deposit" (future)

"allowlist" (future)

"none"

MVP should support at minimum: "shares" and "none".

gating.thresholds (required if enabled)
Object containing thresholds for the selected mode

gating.thresholds.minShares (shares mode)
Type: string (uint256 in wei)

Minimum share balance required to join

Example: 1e18 for "1.0 share" if shares use 18 decimals.

gating.failClosed (required)
Type: boolean

If true: failure to verify means deny access

MVP default: true

Roles and Permissions
roles (required)
roles.owner (required)
Type: 0x address

Must match vault.canonicalOwnerAddress

If mismatch: Keepr must refuse to execute privileged commands.

roles.admins (optional)
Type: array of 0x addresses

Admin permissions for operational commands

roles.operators (optional)
Type: array of 0x addresses

Scoped permissions for specific actions (optional)

Behavior Flags
behavior (optional)
All behavior flags default to safe values.

behavior.dmDenials
Default: true

Denials should be DM’d to avoid group chat noise

behavior.dmRemovals
Default: true

Removals should be DM’d with reason and next steps

behavior.emitJoinSignals
Default: true

Post factual updates when new eligible members join

behavior.emitMilestones
Default: true

Allow factual milestone updates (rate-limited)

Rate Limits
rateLimits (required)
rateLimits.commandCooldownMs
Default: 1500

Prevent command spam per-user and/or globally

rateLimits.syncMaxMembersPerBatch
Default: 25

Batch size for /keepr sync

rateLimits.syncCooldownSeconds
Default: 600

Cooldown window for running full sync again

Storage Guidance (Walkaway Safe)
Keepr config should be stored in one or more of:

pinned XMTP message in the group

exportable server datastore keyed by vault

future onchain registry (optional)

Keepr must never require secrets to boot.

Validation Rules (MVP)
Keepr must refuse operation if:

required fields are missing

chainId mismatched

invalid addresses

roles.owner != vault.canonicalOwnerAddress

gating enabled but mode/thresholds incomplete

Upgrade Path
Future versions may add:

multiple gating modes (deposit, allowlist)

per-command role permissions

onchain config registry integration

event subscriptions (Transfers, deposits)

yaml
Copy code

---

# `ARCHITECTURE.md`

```md
# Keepr Architecture (MVP)

This document describes how Keepr fits into the system and the minimal runtime flows required for v1.

Keepr is a vault-bound operator agent inside **Base Chat (XMTP)**.

---

## System Components

### User-Facing Surfaces

- **Farcaster Mini App**
  - creator identity verification (FID)
  - deploy + share flows
  - deep links for deposit and join chat

- **Vault App UI (your app)**
  - deploy vault
  - show vault stats + share link
  - “Join chat” and “Deposit” CTAs

- **Base Chat (XMTP)**
  - group chat per vault
  - end-to-end encrypted conversations

---

## Keepr (Agent Runtime)

Keepr is instantiated per vault and bound via config:

- vault addresses and chainId
- canonical owner identity
- gating thresholds
- XMTP group ID

Keepr responsibilities:

- enforce token-gated membership
- run deterministic admin commands
- emit factual community signals
- maintain minimal state and rate limits

---

## High-Level Flow

```text
[Mini App / UI]
  deploy vault on Base
      ↓
create XMTP group chat
      ↓
store (vault → groupId) mapping
      ↓
spawn Keepr instance with config
      ↓
Keepr enforces gating + runs commands
Core MVP Flows
Flow A — Deploy → Group Creation → Keepr Boot
Trigger: user successfully deploys a vault

App deploys vault (owner must be canonical identity)

App creates XMTP group chat

App stores:

vaultAddress

groupId

canonicalOwnerAddress

creatorCoinAddress

App boots Keepr using the config schema (see CONFIG.md)

Keepr posts a pinned “config summary” message (optional)

Invariant: The vault owner must be the canonical identity wallet.

Flow B — Join Request (Token Gating)
Trigger: user asks to join group OR uses /keepr check

Keepr maps XMTP inbox → wallet address (provided by integration layer)

Keepr reads onchain balance at a known block:

shareBalance(wallet)

Keepr compares against threshold

If eligible:

add user to XMTP group

If ineligible:

deny (DM preferred)

include next steps + deep link to deposit

Default: fail closed if mapping or chain read fails.

Flow C — Periodic / On-Demand Recheck
Trigger: /keepr sync or scheduled job

Keepr enumerates group members

For each member, check eligibility at current block

Remove ineligible members (DM preferred)

Emit a summary report in group chat

Apply rate limits and batching

Deterministic Command Handling
Keepr only reacts to explicit commands:

Prefix: /keepr

Grammar: fixed set in COMMANDS.md

Unknown or malformed commands → minimal help response

Keepr must never infer admin intent from free text.

Permissions Model (MVP)
OWNER: canonicalOwnerAddress

ADMIN: configured addresses

MEMBER/GUEST: everyone else

Permissions:

OWNER:

lock/unlock joins

manage admins

(optional) change rules

ADMIN:

status / rules / sync

MEMBER/GUEST:

check eligibility

help

Onchain Verification Sources
Preferred:

direct RPC reads on Base

Fallback:

indexers (if needed), but direct reads win on conflicts

If there is a mismatch:

onchain truth wins

fail closed for access decisions

Event Strategy (MVP)
MVP can operate without event subscriptions by using:

on-demand checks (/keepr check)

periodic checks (/keepr sync)

optional scheduled enforcement jobs

Future upgrades may subscribe to:

share token transfer events

vault deposit/withdraw events

Failure Modes and Safety Defaults
Missing State
If critical config fields are missing:

refuse sensitive actions

request exact missing fields

RPC Failure
fail closed for access control

fail safe for messaging (avoid spamming errors)

Spam / Abuse
rate-limit commands per user and globally

batch membership operations

prefer DMs for denials/removals

Action Output Contract
When Keepr requires the system to take an action, it emits:

a short explanation

a machine-readable JSON action object

Example:

json
Copy code
{
  "action": "xmtp.group.remove_member",
  "groupId": "<GROUP_ID>",
  "wallet": "0xabc...",
  "reason": "share_balance<threshold",
  "evidence": {
    "shareBalance": "0",
    "threshold": "1000000000000000000",
    "blockNumber": 12345678
  }
}
The integration layer is responsible for executing these actions.

Summary
Keepr is a vault-bound operator that:

enforces explicit membership rules

operates deterministically

avoids custody, signing, and identity mutation

stays transparent and walkaway-safe

Keepr should feel boring, predictable, and correct.