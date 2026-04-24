# ERC-4626 Deviation Flags Convention

**Owner:** 4626 audit remediation · **Status:** stable · **Tracking:** [4626-442 (F-19)](https://linear.app/4626fun/issue/4626-442)

## Motivation

ERC-4626 specifies strict semantics for `maxWithdraw`, `maxRedeem`, `maxDeposit`, and `maxMint`. Real-world strategies sometimes need to deviate — under-reporting available capacity is the most common pattern, usually to protect the strategy from being forced through an expensive or externally-constrained liquidation path.

Integrators (aggregators, routers, indexers, audit tooling) need a machine-readable way to learn which deviations a vault knowingly takes. Reading NatSpec is not a scalable integration pattern.

This document defines a shared bitmap convention that any 4626 vault in this repo can expose through:

```solidity
function erc4626DeviationFlags() external pure returns (uint256);
```

Plus an optional human-readable accessor:

```solidity
function hasConservativeMaxWithdraw() external pure returns (bool);
```

## Bitmap

| Bit | Name                                | Meaning                                                                 |
|-----|-------------------------------------|-------------------------------------------------------------------------|
| 0   | `MAX_WITHDRAW_UNDER_REPORTS`        | `maxWithdraw` intentionally returns less than the share-entitlement value. Typical cause: capped at idle-buffer liquidity to avoid forcing a pool exit. |
| 1   | `MAX_REDEEM_UNDER_REPORTS`          | `maxRedeem` intentionally under-reports. Typical cause: same as bit 0.   |
| 2   | `MAX_DEPOSIT_UNDER_REPORTS`         | `maxDeposit` caps below what total-assets headroom would suggest. Typical cause: per-cycle deposit cap, non-reentrant idempotence guard. |
| 3   | `MAX_MINT_UNDER_REPORTS`            | `maxMint` caps below entitlement. Typical cause: same as bit 2.         |
| 4   | `PREVIEW_DEPOSIT_LOSSY`             | `previewDeposit` applies an entry fee not reversible in `previewRedeem`. |
| 5   | `PREVIEW_REDEEM_LOSSY`              | `previewRedeem` applies an exit fee not reversible in `previewDeposit`.  |
| 6   | `WITHDRAW_MAY_REVERT_WHEN_POSITIVE` | `withdraw` may revert for `owner` even when `maxWithdraw(owner) > 0`. Typical cause: pause state, reentrancy window, or external pool failure. |
| 7   | `TOTAL_ASSETS_NON_MONOTONIC`        | `totalAssets` may decrease without a prior withdraw. Typical cause: upstream strategy loss, fee accrual. |
| 8..255 | reserved | Future use. Vaults MUST leave these bits zero until a new convention number is published here. |

Zero (`0x0`) is valid and means "vault claims full ERC-4626 conformance".

## Stability guarantees

- **Stable ABI.** A vault's bits cannot flip silently across upgrades. Any change requires a new deployed contract. Integrators may cache the value.
- **Additive only.** New bits are appended; existing bit semantics never change. If a deviation is deprecated, its bit stays defined here but falls out of use; it does not get reassigned.
- **Probe, don't guess.** Integrators SHOULD call `erc4626DeviationFlags()` at adapter construction time and surface the result in their own metadata. They SHOULD NOT infer deviations from observed behavioural edge cases.

## Current vaults

| Contract                                          | Flags | Bits set                         | Doc                                                                                          |
|---------------------------------------------------|-------|----------------------------------|----------------------------------------------------------------------------------------------|
| `AjnaERC4626Vault`                                | `0x3` | 0, 1                             | [M-22 / F-19 acceptance](./../audits/4626/acceptances/F-19-erc4626-deviation-flag.md)        |

Future 4626-style vaults that take deviations MUST (1) add themselves to this table, (2) implement `erc4626DeviationFlags()` with `pure` semantics, and (3) ship a test pinning the returned value.

## Example probe (TypeScript)

```ts
const FLAGS = await vault.erc4626DeviationFlags();
const MAX_WITHDRAW_UNDER_REPORTS = 1n << 0n;
const MAX_REDEEM_UNDER_REPORTS   = 1n << 1n;

if (FLAGS & MAX_WITHDRAW_UNDER_REPORTS) {
  // Fall back to reading bucket positions / strategy-specific accessors
  // to find the true withdrawable balance.
}
```

## Example probe (Solidity)

```solidity
interface IERC4626DeviationFlags {
    function erc4626DeviationFlags() external pure returns (uint256);
}

uint256 flags = IERC4626DeviationFlags(vault).erc4626DeviationFlags();
bool maxWithdrawUnderReports = (flags & (1 << 0)) != 0;
```

## Changelog

| Date       | Change                                                                 |
|------------|------------------------------------------------------------------------|
| 2026-04-24 | Initial publication (bits 0-7 reserved). Shipped with F-19 / 4626-442. |
