# F-19 — AjnaERC4626Vault ERC-4626 Deviation Flag

- **Linear:** [4626-442](https://linear.app/4626fun/issue/4626-442) · parent [4626-422](https://linear.app/4626fun/issue/4626-422)
- **Severity:** Low
- **File:** `contracts/vault/strategies/ajna4626/AjnaERC4626Vault.sol`

## Status: Fixed — additive, no behaviour change

### Summary

`AjnaERC4626Vault.maxWithdraw` and `maxRedeem` deliberately under-report available assets, capping at the idle buffer instead of share entitlement. This is documented design (bucket LP positions require an on-chain Ajna pool interaction to liquidate). The vault already exposed `isPartialWithdrawVault() => true` to signal this, but had no machine-readable bitmap and no shared integrator convention.

This PR adds the convention.

### What shipped

1. **`erc4626DeviationFlags() external pure returns (uint256)`** on `AjnaERC4626Vault`, returning `0x3` (bits 0 and 1).
2. **`hasConservativeMaxWithdraw() external pure returns (bool)`** — human-readable convenience returning `true`.
3. **Named constants** on the contract: `DEVIATION_MAX_WITHDRAW_UNDER_REPORTS = 1 << 0` and `DEVIATION_MAX_REDEEM_UNDER_REPORTS = 1 << 1`.
4. **`docs/contracts/ERC4626_DEVIATION_FLAGS.md`** — the shared bitmap convention (bits 0-7 reserved with stable semantics), vault registry table, and probe examples in TypeScript and Solidity. Future 4626-style vaults in this repo MUST register here.
5. **NatSpec updated** on `maxWithdraw` and `maxRedeem` to point at the bitmap getter.
6. **`test/AjnaERC4626Vault.DeviationFlag.t.sol`** — three cases pinning the returned values and the relationship with the existing `isPartialWithdrawVault` flag.

### Why not replace `isPartialWithdrawVault`?

`isPartialWithdrawVault` is an established behavioural flag and integrators may already depend on it. The two coexist by design:

- `isPartialWithdrawVault` = vault-wide semantics (there's a partial-liquidation path).
- `hasConservativeMaxWithdraw` = narrower assertion about `maxWithdraw` / `maxRedeem` return values.
- `erc4626DeviationFlags` = machine-readable bitmap across all deviations (future-proof).

All three remain. A future vault could plausibly set `hasConservativeMaxWithdraw=true` without `isPartialWithdrawVault=true` (e.g. fee-driven deviation rather than strategy-driven).

### Acceptance

- [x] `erc4626DeviationFlags()` and `hasConservativeMaxWithdraw()` live on the vault, both `pure`.
- [x] Returns `0x3` (bits 0 and 1 set).
- [x] Named constants exposed on the contract.
- [x] NatSpec on `maxWithdraw` / `maxRedeem` points at the new accessors.
- [x] `docs/contracts/ERC4626_DEVIATION_FLAGS.md` documents the bitmap convention with stability guarantees.
- [x] Test pins the flag values and their relationship with `isPartialWithdrawVault`.

### Tracking

When the PR merges, move this document to `docs/audits/4626/closed/`. `AUDIT_RECONCILIATION.md` F-19 section should reference this file.
