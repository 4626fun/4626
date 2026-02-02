# Keepr

**Keepr** is a vault-bound operator agent designed for crypto-native communities.

It lives inside **Base Chat (XMTP)** group conversations and enforces **deterministic, onchain-backed rules** for a single **Creator Vault**.

Keepr is **not** a chatbot.
Keepr is **not** a wallet.
Keepr is **not** a custodian.

Keepr is **infrastructure**.

---

## Why Keepr Exists

Most social-token communities fail because:

- rules are unclear or implicit
- enforcement is manual or subjective
- identity and authority are fragmented
- communities decay once the initial hype fades

Keepr solves this by acting as a **predictable operator** that:

- reflects onchain truth
- enforces explicit membership rules
- automates repetitive community workflows
- operates transparently and without discretion

If a smart contract governs funds, Keepr governs **access and coordination**.

---

## What Keepr Is

Keepr is a **deterministic, stateful agent** that:

- is instantiated **per vault**
- is bound to a specific onchain configuration
- operates inside a single XMTP group chat
- responds only to explicit commands
- enforces rules derived from onchain state

Keepr treats the vault as its universe.

---

## What Keepr Is Not

Keepr does **not**:

- act like a human
- improvise policy
- moderate subjectively
- move funds or sign transactions
- decide identity
- rely on unverified social context

Any workflow that requires signing, deployment, or complex UI must be completed in the **main app**, not in chat.

---

## System Context

Keepr is designed to operate inside a system that combines:

- **Zora** — Creator Coins and content economies  
- **Farcaster** — social identity and distribution (Mini App)  
- **Base** — execution environment (chain `8453`)  
- **Base Chat (XMTP)** — end-to-end encrypted group chats  

Each **Creator Vault**:

- is deployed on Base
- is tied to a Zora Creator Coin
- has a canonical owner (often a smart wallet)
- has a dedicated XMTP group chat
- spawns exactly one Keepr instance

---

## Core Responsibilities (MVP)

Takopi’s MVP responsibilities are intentionally narrow:

### 1. Token-Gated Membership

- Verify wallet ↔ XMTP inbox mappings
- Check onchain balances
- Allow or deny chat access
- Periodically re-check eligibility
- Explain decisions clearly

### 2. Vault-Scoped Administration

- Expose a small, explicit command set
- Enforce role-based permissions
- Log and explain all actions

### 3. Factual Community Signals

- Membership changes
- Vault milestones
- Configured onchain events

No hype. No persuasion. No speculation.

---

## Design Principles

Takopi is built on these principles:

- **Determinism over intelligence**  
  Rules matter more than “smart” behavior.

- **Transparency over convenience**  
  Every decision must be explainable.

- **Minimal authority**  
  Takopi only has powers explicitly granted.

- **Walkaway safety**  
  Vaults and communities must survive without Takopi.

---

## Repository Structure

```
takopi/
├── README.md # This file
├── PROMPT.md # Full system prompt and invariants
├── COMMANDS.md # Deterministic command interface
├── CONFIG.md # (planned) Agent configuration schema
└── ARCHITECTURE.md # (planned) System architecture & flows
```
---

## Where to Start

- Read **`PROMPT.md`** to understand Takopi’s constraints and guarantees.
- Read **`COMMANDS.md`** to see the full command surface and response rules.
- Treat Takopi as infrastructure, not a product surface.

---

## Mental Model

> Takopi is to a vault community what a smart contract is to funds:
> a predictable, rule-enforcing system with minimal discretion.

If Takopi feels “boring,” it’s doing its job.

---

## Contributing

When extending Takopi:

- prefer explicit rules over inferred intent
- avoid adding subjective behavior
- keep authority narrow and auditable
- respect MVP constraints unless explicitly expanding scope

If a feature requires trust, signing, or UI — it probably does **not** belong in Takopi.