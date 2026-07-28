# creator-share-hook

Token-2022 Transfer Hook for 4626 Solana share-mesh mints.

| | |
| --- | --- |
| Program ID | `EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU` |
| Interface | SPL Transfer Hook (Token-2022) |
| Role | Buy detection, lottery entry recording, fee harvest hooks |

## Scope

This directory is the reviewable Anchor/Rust source for the on-chain program. Deploy scripts, keypairs, and ops tooling are intentionally omitted from the public tree.

## Build

Requires Solana platform-tools compatible with the pinned SBF toolchain (see `.cargo/config.toml`). From this directory:

```bash
cargo build-sbf
```

Or with Anchor tooling that targets the declared program id in `src/lib.rs`.

## Review notes (Meteora / partners)

- Hook fires on Token-2022 transfers for creator share mints that register this program.
- AMM allowlisting and creator config are on-chain admin surfaces (`update_config`, allowlist instructions).
- Transfer fee on reviewed share mints is expected to be **0**; lottery / fee logic is product-side, not a Meteora pool fee.
