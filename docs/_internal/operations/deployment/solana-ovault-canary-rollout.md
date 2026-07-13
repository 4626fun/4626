---
title: Solana OVault Canary Rollout
sidebar_position: 4
---

# Solana OVault Canary Rollout

The Twin adapter canary described by earlier revisions of this page is retired.
The registration endpoint, route-mode aliases, and write/rollback switches were
removed with that surface.

## LayerZero-only canary sequence

1. Provision a distinct Solana SPL mint and OFT Store for each canary creator.
2. Wire the Base `CreatorShareOFT` and Solana OFT Store through the approved
   LayerZero DVN configuration.
3. Before finalize, seed the creator-specific peer:
   `Registry4626.setRemoteOFTPeerBytes32(creatorToken, 30168, oftStorePeer)`.
4. Verify the registry peer is non-zero and the batcher has a non-zero Solana
   destination plus enabled OVault runtime.
5. Run the deploy for one creator and confirm `finalizePhase2` bridges the
   expected ShareOFT allocation to the distinct Solana mint.
6. Expand only after Base and Solana supply accounting, peer identity, and
   post-finalize reads agree.

## Go / no-go

No-go when the creator peer is missing, the OFT Store peer is confused with the
mint pubkey, LayerZero wiring is incomplete, or the finalize fee quote fails.
Do not fall back to a Twin adapter, global peer, creator-SPL registration, or
status-route side effect.

Canonical procedure:
[Solana share-mesh per-creator provisioning](../operations/solana/solana-share-mesh-creator-provisioning.md).
