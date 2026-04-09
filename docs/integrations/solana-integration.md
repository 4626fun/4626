---
title: Solana Integration
sidebar_position: 2
---

# Solana Integration

4626 runs a hub-and-spoke model: Base is the canonical control plane, and Solana is an active spoke for liquidity, fee capture, and lottery-entry relay.

## Status

✅ **Live (mainnet architecture active)**

## Current Architecture

- **Base remains canonical** for deployment ownership, settlement, and strategy coordination.
- **Solana handles spoke execution** for trading-side activity and selected strategy allocation.
- **Bridge + relay path** forwards Solana-side entries/fees to Base through keeper-managed workflows and adapter auth.

## Active Components

- Solana program (`creator_share_hook`) is deployed on mainnet with the current program ID in repo runbooks.
- Solana bridge adapter + deterministic twin auth model on Base.
- Solana provisioner flow for per-creator setup, including bridge route setup and Meteora pool/vault orchestration.
- CRE workflows for relay/settlement/monitoring between Solana and Base.

## Important Integration Notes

- Trading and Meteora execution currently use the bridge-wrapped SPL token path.
- Token-2022 Transfer Hook support remains a separate concern from the Meteora trading token path.
- Deploy preflight/status flows must stay read-only; Solana mutation/setup flows must stay machine-auth protected.

## Related Docs

- `AGENTS.md` (authoritative operational invariants and trust boundaries)
- `/integrations/solana-spoke-article` (architecture narrative)
- `frontend/server/solana-provisioner/README.md` (provisioner behavior and endpoints)
