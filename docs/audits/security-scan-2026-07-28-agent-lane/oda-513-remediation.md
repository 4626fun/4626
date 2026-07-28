# ODA-513 remediation — AgentOracle

**Track:** https://onedollaraudit.com/audit/513  
**Report:** [oda-reports/513-report.md](./oda-reports/513-report.md)  
**Pin:** `audit/oda-2026-07-28-oracles` @ `c19bc8e`

## Fixed

| Sev | Item | Fix |
|-----|------|-----|
| High | `getAssetEthTWAP` dead/unusable for agent V2/V3 | Live path for configured V2/V3 quote lanes |
| High | `_lzReceive` bypasses deviation clamp when stale | Always clamp |
| High | V2 TWAP idle-gap amplification / unbounded window | Idle-gap + realized-window bounds |
| Medium | Cooldown walk / cooldown=0 | `MIN_PRICE_UPDATE_COOLDOWN=30` |
| Medium | Quote-wei truncation in USD TWAP | Scale to 1e18 before truncate |
| Medium | Reads ignore sequencer | `_getPrice` / `isPriceFresh` fail closed |
| Medium | Global feed staleness | Per-feed `feedMaxStaleness` |
| Medium | Public TWAP getters no min window | Enforce `MIN_TWAP_DURATION` |
| Low/Info | Sequencer try/catch, renounce disabled, lock requires matching lane, V2 recorder throttle, NatSpec cleanup, broadcast hub-only, feed min/max bounds where available | Applied |

## Tests

- `test/AgentOracleODA513Remediation.t.sol`
- `test/Oracle.ReferenceQuoteTokenGuards.t.sol`
- `test/AgentOracle.V2PrimaryPath.t.sol`

## Deferred

- Full Uniswap V3 factory/cardinality genuineness (env-specific)
- Removing dead V4/tick-cap subsystem (NatSpec corrected instead)
