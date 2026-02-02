---
title: Keepr
sidebar_position: 1
---

# Keepr

Keepr is a vault-bound operator agent for Creator Vault communities.

**Who this is for:** Protocol engineers and community operators deploying Keepr instances.

---

## Overview

Keepr operates inside Base Chat (XMTP) group conversations and enforces deterministic, onchain-backed rules for a single Creator Vault.

Keepr is infrastructure, not a chatbot. It does not:
- Act like a human or improvise policy
- Move funds or sign transactions
- Moderate subjectively

---

## System context

Keepr operates within:
- **Zora** - Creator Coins and content economies
- **Farcaster** - Social identity and distribution
- **Base** - Execution environment (chain 8453)
- **Base Chat (XMTP)** - End-to-end encrypted group chats

Each Creator Vault spawns exactly one Keepr instance bound to its XMTP group.

---

## Core responsibilities

### Token-gated membership

- Verify wallet to XMTP inbox mappings
- Check onchain balances against thresholds
- Allow or deny chat access
- Periodically re-check eligibility

### Vault-scoped administration

- Expose explicit command set (`/keepr help`, `/keepr status`, etc.)
- Enforce role-based permissions (OWNER, ADMIN, MEMBER)
- Log and explain all actions

### Community signals

- Membership changes
- Vault milestones
- Configured onchain events

---

## Design principles

- **Determinism over intelligence** - Rules matter more than "smart" behavior
- **Transparency over convenience** - Every decision must be explainable
- **Minimal authority** - Only powers explicitly granted
- **Walkaway safety** - Vaults must survive without Keepr

---

## Documentation structure

| Document | Description |
|----------|-------------|
| [Commands](./commands.md) | Full command interface and response rules |
| [Prompt](./prompt.md) | System prompt and invariants |
| [Config](./config.md) | Agent configuration schema |
| [Threat Model](./threat-model.md) | Security considerations |

---

## References

- [Account abstraction activation](/overview/account-abstraction/activation)
- [Vault deployment](/operations/deployment/pre-launch)
