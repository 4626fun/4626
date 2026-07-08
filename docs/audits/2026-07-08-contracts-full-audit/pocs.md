# PoCs — AUDIT-2026-07-08 P0

**File:** `test/audit/Audit20260708.P0.t.sol`

Run:

```bash
forge test --match-path 'test/audit/Audit20260708.P0.t.sol' -vv
```

## Suites

### `Audit20260708_H01_RecoveryEscrow`

| Test | Demonstrates |
|------|----------------|
| `test_notifyRecovery_afterPush_creditsWithoutAllowance` | Push-then-notify works without ERC20 approve |
| `test_notifyRecovery_revertsWhenCustodyMissing` | Cannot invent recovery without custody |
| `test_claimRecovery_fullFlow` | End-to-end claim after notify |

### `Audit20260708_C01_ShareOftSalt`

| Test | Demonstrates |
|------|----------------|
| `test_deriveShareOftSalt_differsPerCreatorToken` | Same owner/symbol/version → different salt per token |
| `test_deriveShareOftSalt_stableForSameToken` | Determinism |
| `test_legacySalt_differsFromScopedSalt` | New domain ≠ pre-C01 salt |

### `Audit20260708_H02_LotteryCoverage`

| Test | Demonstrates |
|------|----------------|
| `test_PoC_sameBlockFlashShare_doesNotInflateCoverage` | Flash-minted ShareOFT same block does not lift win PPM vs aged-only control |
| `test_PoC_justPurchasedAmount_excludedFromCoverage` | Zero eligible holdings → base PPM only |
| `test_PoC_amoeCoverage_usesShareOftNotLaneCoin` | AMOE boost requires ShareOFT, not bare lane token |

## Pre-fix reproduction (historical)

- Impairment: `forge test --match-test test_notifyRecovery_creatorCoin` failed with `ERC20InsufficientAllowance` before escrow change.
- Coverage: prior manager path used full `balanceOf(buyer)` after buy; PoC file encodes the **post-fix** anti-flash behavior.

## Related regression suites

```bash
forge test --match-contract CreatorOVaultImpairmentV1Test
forge test --match-path 'test/CreatorLotteryManager.AmoeLinearParity.t.sol'
```
