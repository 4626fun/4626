---
name: oft-chain-config
description: LayerZero ShareOFT peers, EIDs, ULN confirmations, and cross-chain wiring for 4626.
paths: contracts/**/ShareOFT**, contracts/**/Registry4626**, frontend/**/oft**, frontend/**/layerzero**, frontend/scripts/ops/**share-mesh**, frontend/scripts/ops/**lz**
---

# OFT chain config (4626)

**Archive:** `docs/agent-context/archives/oft-chain-config.md`  
**Runbook:** `docs/_internal/operations/operations/solana/solana-share-mesh-creator-provisioning.md`  
**Template:** `docs/_internal/operations/templates/layerzero-share-mesh.config.ts`

Per-creator Solana peer required before finalize — no global `solanaShareOftPeer` fallback.

## Hard gate before Pipe A / share bridge (B2 incident)

Outbound ULN **confirmations must be ≥** destination inbound on **both** directions, and must match the template:

- Pathway tuple: **`[15, 32]`** = Base→Solana / Solana→Base
- DVN: mainnet Base ↔ Solana **3-of-5** optional (never single-DVN `1/1`)
- Do **not** leave Base→Solana on library default **10** while Solana inbound is **15** (LZ **BLOCKED** → Base burn, Solana mint supply stays 0)

```bash
pnpm -C frontend ops:verify-share-mesh-lz \
  --share-oft 0xBaseShareOFT \
  --oft-store <OFT_STORE> \
  --mint <TOKEN2022_MINT> \
  --dest <SOLANA_DEST> \
  # pass --mint and --dest together (no defaults); ATA fail-closed unless --skip-dest-ata
```

Exit **0** required before finalize / Pipe A. Compatible-but-wrong values (e.g. both sides at 10) still fail — restore `[15, 32]`.
