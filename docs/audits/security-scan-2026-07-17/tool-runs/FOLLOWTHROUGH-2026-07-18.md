# Audit followthrough tool runs (2026-07-18)

Branch tip at write time: `cursor/oda-audit-followthrough-26cd` (includes ODA-423 M-08/M-10).  
Raw `*.log` artifacts are gitignored under this directory; summaries below.

## Code patches (this pass)

| ID | Status | Change |
|----|--------|--------|
| ODA-423-M08 | **Fixed** | `AjnaVaultAuth` 24h toll/tax timelock after bootstrap |
| ODA-423-M10 | **Fixed** | Charm `withdraw` caps to `_realizableTotalAssets` / min(oracle, TWAP) |
| ODA-423-M09 | Residual | Spot Charm composition still feeds oracle NAV; needs calibrated TWAP mocks |
| ODA-431 | In progress | Still `audit-pass-0-context` at last poll |

Forge validation:

- `forge test --match-contract AjnaVaultAuthTest` → **exit 0** (7 passed)
- `forge test --match-contract CharmStrategy4626OracleTest` → **exit 0** (31 passed)
- `forge test --match-contract AjnaERC4626VaultTest` → **exit 0** (12 passed)

## Halmos — `CreatorOVaultMath`

Command: `halmos --contract CreatorOVaultMath --function check_ --solver-timeout-assertion 30000`  
Result line: `Symbolic test result: 4 passed; 8 failed; time: 400.38s` (**process exit: non-zero / incomplete green**)

| Result | Check |
|--------|-------|
| PASS | `check_feeFromNet_matches_grossUp` |
| PASS | `check_live_previewRedeem_cap` |
| PASS | `check_live_totalAssets_matches_deposits` |
| PASS | `check_previewRedeem_cap_respects_queued_withdrawals` |
| TIMEOUT | `check_convertToShares_monotonic`, `check_convertTo_roundtrip_assets_to_shares`, `check_feeFromTotal_never_exceeds_input` |
| ERROR | `check_grossUp_netFromGross_roundtrip`, `check_live_convertTo_roundtrip` (solver `returncode=-9`, likely OOM/kill) |
| FAIL | `check_pricePerShare_model` (cex `totalS = 2^255`) |
| FAIL | `check_zeroState_convertToShares_matches_vault_offset` (cex `assets ≈ 2^255-1`) |
| FAIL | `check_zero_bps_is_identity` (cex `x = 2^255`) |

Interpretation: fee helpers + live previewRedeem/totalAssets checks are green. Failures/timeouts cluster on unbounded `uint256` / solver resource limits in the pure model — tighten `vm.assume` bounds before treating as production defects.

## CI scanners (local delta)

| Tool | Scope | Exit | Notes |
|------|-------|------|-------|
| gitleaks 8.24.3 | `origin/main..HEAD` (11 commits) | **0** | no leaks |
| Semgrep 1.128.1 `--config=auto` | `AjnaVaultAuth.sol`, `CharmStrategy4626.sol` | **0** | 0 findings (68 rules) |
| Slither | `AjnaVaultAuth.sol` | **0** | only `timestamp` on intentional timelock compares |
| Slither | `CharmStrategy4626.sol` | **0** | mostly naming/solc-version noise; no new critical path |

`security-scanning.yml` full manual dispatch (Docker Semgrep image + full Slither job matrix) still recommended on GitHub Actions for parity with CI.

## Pashov `skills/solidity-auditor`

Report: [pashov-lottery-impairment-2026-07-18.md](./pashov-lottery-impairment-2026-07-18.md)

- Scope: lottery manager + AMOE/VRF paths + impairment claims/admin hooks
- Surviving findings: **0** (Critical/High/Medium/Low)
- LEADs: 4 (non-blocking)
- Residuals called out: 426-F3 timelock cluster, 427-F5 valuation gate, set `impairmentChallengeBond > 0` in prod

## Mythril 0.24.8

| Target | Mode | Exit / result |
|--------|------|----------------|
| `LotteryAmoeRouter.sol` | source + remappings | **0** — no issues detected |
| `OVaultImpairmentClaims.sol` | source + remappings | **0** — no issues detected |
| Full `LotteryManager4626` / `_processWin` bytecode | not run | forge artifacts missing after Slither `forge clean`; source too large for short mythril solc path |

Follow-up: re-`forge build` then `myth analyze -c <deployedBytecode>` on `LotteryManager4626` with `--execution-timeout 300` for jackpot/`_processWin` depth.

## Human audit

Still the bar before meaningful TVL: Spearbit/C4-class after ODA + these static/symbolic passes (`docs/_internal/security/index.md`).
