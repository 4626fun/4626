# ODA Job 461 — Low / Info remediations

Source report: `docs/audits/security-scan-2026-07-22/oda-reports/461-report.md`  
Branch: `fix/oda-461-low-info`

## FIXED

| ID | Item | Remediation |
|----|------|-------------|
| L6 | `setOracleMaxStaleness(0)` disables checks | Reject `0` in AdminModule setter (`ODA-461-6`). Per-lane config deferred. |
| L7 | Unbounded price aggregation can overflow / strand relay | Cap/skip outliers before summing in `getAggregatedAssetPrice` (`ODA-461-7`). |
| L8 | Short TWAP + overstated freshness | Min/default `twapPeriod` 1800s; TWAP fallback stamps `block.timestamp - twapPeriod` (`ODA-461-8`). |
| L9 | Integrator accepts non-hub peers | Already fixed (`ODA-461-9`). |
| L10 | `_payNative` exact-match dead refund path | Override `_payNative` for `>=` fee; LZ refund to `msg.sender` (`ODA-461-10`). |
| L11 | Manager `_lzReceive` reverts on bad input | Already fixed. |
| L12 | One-step AMOE `setOwner` | Two-step `pendingOwner` / `acceptOwnership` (`ODA-461-12`). |
| L13 | Instant trust-anchor rewires | Timelock `setPriceOracle` (hub+spoke) and `setConsumer` (`ODA-461-13`). |
| L14 | `renounceOwnership` can strand recovery | Override to revert on hub VRF + spoke integrator (`ODA-461-14`); manager already done. |
| L15 | Hot-path un-try/caught registry/ShareOFT | Already fixed. |
| L16 | Multi-vault `payJackpot` OOG risk | Cap gas per `payJackpot` call (`ODA-461-16`); default `singleVaultJackpotOnly=true` unchanged. |
| L17 | Pause + grace-period discard ordering | Already fixed. |
| L18 | Legacy ECDSA path unused signature | Already fixed (disabled; ZK live path). |
| L20 | Boost overflow in try success-block | Already fixed. |
| L22 | Unbounded payload amount / mulDiv | Already fixed. |
| I23 | Buyer bind truncates to uint160 | Full-width compare (`ODA-461-23`). |
| I24 | `randomWords[0]` without length check | Already fixed. |
| I34 | Local VRF nonzero `msg.value` foot-gun | Already fixed. |
| I35 | AMOE ignores `usdMultiplierBps` | Apply same multiplier on AMOE win-chance USD input (`ODA-461-35`). |
| F1 | Critical | Already fixed. |
| M2/M4/M5 | Mediums | Already fixed. |

## ACCEPTED

| ID | Item | Rationale |
|----|------|-----------|
| M3 | Medium window tradeoff | Accepted operational tradeoff; left alone. |
| L19 | Coverage / flash-borrow trust on swap integrations | Documented integration responsibility; manager caps via caller-supplied block-start + `maxWinChance`. |
| L21 | Exactly-once consume on transient Solana dispatch failure | **Accepted: prefer exactly-once over retry.** Nullifier/source-event consume stays one-shot; transient failures are ops-recoverable rather than double-spend risk. |
| I25 | Spoke PUSH0 / `^0.8.20` on non-Shanghai | Target spokes (Base/OP/Arbitrum) support PUSH0. |
| I26 | `calculateWinChance` truncates fractional PPM | Protocol-favoring round-down; `minSwapAmount` floor guarantees nonzero for dispatched entries. |
| I27 | Oracle abstraction omits round/liveness metadata | Out-of-slice oracle implementation concern; in-scope fail-closed guards remain. |
| I28 | Cross-chain VRF key by sequence only | Mitigated by `msg.sender==vrfIntegrator` + rewire timelock. |
| I29 | Legacy nonce omits `chainid`/`address(this)` | Single-hub design; multi-deploy replay not in scope. |
| I30 | ZK pub inputs omit `chainid`/verifying contract | Same single-hub caveat as I29. |
| I31 | `MIN_DEADLINE_BUFFER` is floor not ceiling | Legacy ECDSA path disabled; publisher gate remains. |
| I32 | Spot-manipulation resistance is oracle-impl dependent | Out-of-slice; deviation breaker optional by config. |
| I33 | Payout can round to zero while win recorded | Dust/owner-config bounded; reserve emptiness edge. |

## Tests

- `test/oda/ODA461_LowInfoRemediations.t.sol` — L6, L8, L12, L13, L14, I23
- `test/LotteryManager4626.AmoeLinearParity.t.sol` — I35 (`test_ProcessAmoeEntry_AppliesUsdMultiplierBps`)
