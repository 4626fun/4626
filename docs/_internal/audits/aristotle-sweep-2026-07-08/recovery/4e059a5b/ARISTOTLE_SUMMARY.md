# Summary of changes for run 8cdc0edc-ef0e-4f3a-b2f5-dae1b9374bc4
Completed a focused security audit of the recovery/impairment-claims subsystem (`OVaultRecoveryEscrow.sol` and `OVaultImpairmentClaims.sol`). The full report is in `SECURITY_AUDIT.md`, with exploit paths and remediation per finding.

Key findings, prioritized:

- **H-1 (High) — Recovery accounting decoupled from token custody.** `notifyRecovery` credits `recoveredByEpochAsset` but the contract never pulls tokens in (no `transferFrom`/deposit exists), while `claimRecovery` pays out of a single commingled per-asset balance. The "FIX C-2" per-epoch cap only bounds the accounting numbers, not the actual tokens, so it does NOT deliver the cross-epoch isolation its comment claims: any epoch over-credited relative to tokens actually deposited (under-funding, notify-before-fund, fee-on-transfer/rebasing tokens) can be claimed and drain tokens earmarked for other epochs, making honest holders insolvent. Fix: make funding atomic with notification via `safeTransferFrom` crediting the measured balance delta, or track `totalLiabilities[asset]` and enforce `balanceOf >= liabilities` on claim.

- **M-1 (Medium) — `notifyRecovery` replay/non-idempotent.** Purely additive with no unique recovery id or dedup; a duplicated/retried notification double-counts `recovered`, which via H-1 becomes real cross-epoch loss. Fix: dedup by `recoveryId`, or bind notification to an actual deposit.

- **M-2 (Medium) — Broad, abruptly mutable trust.** `owner` can repoint `vault` with no zero-address check, timelock, two-step handover, or event; `vault` can then send escrowed funds to an arbitrary `receiver`. A single compromised owner key drains the escrow. Fix: two-step + timelocked vault rotation, zero-address checks, events, constrained receiver.

- **L-1/L-2 (Low)** — fee-on-transfer/rebasing assets break the solvency assumption; no events on any state-changing function (hurts monitoring/replay detection).

- **I-1 (Info)** — `OVaultImpairmentClaims.totalSupply` is incremented after `_mint`'s acceptance callback (stale reentrant reads) and would desync if a burn path is later added since it is never decremented; prefer OZ `ERC1155Supply`. Positive note: the non-transferability `_update` guard correctly covers single and batch transfers while allowing mint/burn, with no bypass found.

The report has been committed and pushed. Note: the Lean scaffolding in the project is empty and unrelated to this audit, so no Lean proofs were required.