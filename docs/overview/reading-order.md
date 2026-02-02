---
title: Reading Order
sidebar_position: 5
---

# Reading order

Suggested paths through the documentation based on your goals.

---

## New to 4626

Start here to understand what the protocol does and why.

1. [Introduction](/overview/introduction) — What is 4626?
2. [Token Model](/overview/token-model) — The three-token system
3. [Vault Concept](/concepts/vault) — ERC-4626 basics
4. [Fee Flow](/overview/fee-flow) — Where fees go

**Time:** 15–20 minutes

---

## Integrators

Building on top of 4626? Focus on interfaces and integration points.

1. [Architecture](/overview/architecture) — System overview
2. [CreatorOVault](/contracts/core/creator-ovault) — Vault interface
3. [CreatorShareOFT](/contracts/core/creator-share-oft) — OFT mechanics
4. [OFT Integration](/integrations/oft) — Cross-chain setup
5. [API Reference](/api) — Generated interface docs

**Time:** 30–45 minutes

---

## Auditors

Reviewing security? Focus on invariants and failure modes.

1. [Architecture](/overview/architecture) — Contract relationships
2. [Token Model](/overview/token-model) — Asset vs accounting tokens
3. [CreatorOVault](/contracts/core/creator-ovault) — Core vault invariants
4. [CreatorGaugeController](/contracts/governance/gauge-controller) — Fee distribution
5. [BaseCreatorStrategy](/contracts/strategies/base-creator-strategy) — Strategy pattern
6. [CCA Launch Strategy](/contracts/strategies/cca-launch) — Auction mechanics
7. [Diagram Style Guide](/reference/diagram-style-guide) — Asset flow rules

**Time:** 1–2 hours

---

## Operators

Deploying or maintaining infrastructure? Focus on procedures.

1. [Deploy Vault Guide](/guides/deploy-vault) — End-to-end deployment
2. [Pre-launch Checklist](/operations/deployment/pre-launch) — Before going live
3. [CCA Verification](/operations/deployment/cca-verification) — Auction setup
4. [Automation](/operations/automation) — Keeper configuration
5. [Troubleshooting](/guides/troubleshooting) — Common issues

**Time:** 45–60 minutes

---

## Governance participants

Participating in ve(3,3) voting? Understand the incentive system.

1. [Governance Overview](/governance) — ve(3,3) mechanics
2. [ve4626](/contracts/governance/ve4626) — Lock mechanics
3. [VaultGaugeVoting](/contracts/governance/vault-gauge-voting) — Voting system
4. [VoterRewardsDistributor](/contracts/governance/voter-rewards-distributor) — Claiming rewards
5. [Lottery](/concepts/lottery) — Probability direction

**Time:** 30 minutes

---

## Quick reference

| Topic | Page |
|-------|------|
| Contract addresses | [Addresses](/reference/addresses) |
| Terminology | [Glossary](/reference/glossary) |
| Token notation | [Diagram Style Guide](/reference/diagram-style-guide) |
| ERC-4337 issues | [Debugging](/reference/erc4337-debugging) |
