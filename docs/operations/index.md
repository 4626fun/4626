---
title: Operations
sidebar_position: 8
---

# Operations

Deployment and maintenance guides for operators.

For XMTP agent operations, use the **[Eliza Runtime](/operations/deployment/eliza-runtime)** deployment runbook.

## Sections

| Section | Description |
|---------|-------------|
| **[Deployment](/operations/deployment)** | Deployment guides and checklists |
| **[Automation](/operations/automation)** | Automated operations setup |
| **[AlfaClub /gmeow Outage Post-Mortem](/operations/alfaclub-gmeow-outage-postmortem-2026-05-02)** | SEV-2 incident record for the AlfaClub Cloudflare challenge and token bootstrap outage |
| **[Coinbase Smart Wallet Capabilities](/operations/coinbase-smart-wallet-capabilities)** | Observed CSW/Base App provider methods, event payloads, signing behavior, and 4626 usage notes |
| **[Owner-Install Reference Methods](/operations/owner-install-reference-methods)** | Method A/B/C index — primary embedded-EOA Relay path vs passkey-first Base App reference vs recovery |
| **[CSW Recovery Playbook](/operations/csw-recovery-playbook)** | Recovery path and known-good owner-install execution lanes for CSW owner setup |
| **[Base App Session-Key Relay Part 1 Recipe](/operations/base-app-session-key-relay-part1-recipe)** | Reference Method B — session-key Part 1 + passkey Part 2 for passkey-first Base App CSWs |
| **[Relay-Sponsored Owner Mutation Flow](/operations/relay-sponsored-owner-mutation-flow)** | Two-session signer/funder architecture for Relay-backed owner mutations |
| **[Relay Kit — Owner Mutation Guide](/operations/relay-owner-mutation-kit-guide)** | relay-kit + Privy example mapping for add-owner / remove-owner on Base CSWs |
| **[Coinbase In-App SignatureWrapper Bug](/operations/coinbase-inapp-signaturewrapper-bug)** | Incident note for in-app owner-index/signature mismatch and mitigations |
| **[Sponsored Canonical Swap Pattern](/operations/sponsored-canonical-swap-pattern)** | Known-good ERC-4337/paymaster path for canonical WETH-backed swaps |
| **[Oracle Post-Deploy QA](/operations/oracle-post-deploy-qa)** | Read-only post-deploy oracle verification runbook and triage guide |
| **[Ethos Canonical Score Cache](/operations/ethos-canonical-score-cache)** | Rollout and operations runbook for canonical Ethos identity-key caching, sync, and read cutover |
| **[XMTP Browser Connect Canary](/operations/xmtp-browser-connect-canary)** | Layer 3 manual canary — real wallet connect, reload restore, Smart Wallet path, and recovery checklist |
| **[Greenfield Launch Readiness](/operations/greenfield-launch-readiness)** | Repeatable gate before opening vault deploy to creators (Pipe A batcher, Solana infra, keeper defaults) |
| **[Batcher Pipe A Cutover](/operations/deployment/batcher-pipe-a-cutover)** | Payable finalize + ShareOFT auto-bridge batcher deploy, Safe config, and readiness verification |
| **[Solana Share Mesh + Lottery Policy](/operations/solana-share-mesh-lottery-policy)** | Locked Pipe A/B policy — 30% finalize bridge, pool-buy lottery, keeper relay gating |
| **[Solana Share Mesh Budget Paths](/operations/solana-share-mesh-budget-paths)** | Greenfield cost buckets and ordered checklists — Path 1 (platform peer) vs Path 2 (full mesh + lottery) |
| **[Domain Setup](/operations/domain-setup)** | Custom domain configuration |
| **[Supabase Setup](/operations/supabase-setup)** | Database configuration |
