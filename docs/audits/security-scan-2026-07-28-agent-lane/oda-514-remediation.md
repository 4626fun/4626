# ODA-514 remediation — CreatorOracle

**Track:** https://onedollaraudit.com/audit/514  
**Report:** [oda-reports/514-report.md](./oda-reports/514-report.md)  
**Pin:** `audit/oda-2026-07-28-oracles` @ `c19bc8e`

## Fixed

| ID | Sev | Fix |
|----|-----|-----|
| 1 | High | `updateAssetPrice` enforces `priceUpdateCooldown` |
| 2 | Medium | `updateAssetPrice` enforces sequencer uptime |
| 3 | Medium | `setV4Pool` resets observation history on pool-identity change |
| 4 | Medium | TWAP window validation uses `block.timestamp - duration` anchor |
| 5 | Medium | `renounceOwnership` disabled |
| 6 | Medium | Post-bootstrap queue/execute delay for feeds, V3/V4 pools, price updaters |
| 7 | Medium | `_sequencerIsUp` try/catch + invalid-round guards |
| 8 | Medium | `setV4Pool` orientation/decimals/existence checks |
| 9 | Medium | Public TWAP views enforce `MIN_TWAP_DURATION` |
| 10 | Medium | `_lzReceive` always clamps (no stale bypass) |
| — | Low/Info | Cooldown floor 30s, `startedAt` validation, V3 `observe` try/catch, clamped-vs-skipped events, NatSpec |

## Tests

- `test/CreatorOracle.ODA514.t.sol`
- `test/CreatorOracle.TwapSafety.t.sol`
- `test/CreatorOracle.RingBuffer.t.sol`
- `test/Oracle.ReferenceQuoteTokenGuards.t.sol`

## Deferred

- Full Ownable2Step (renounce disabled; transfer still single-step)
- Timelock on every admin setter (highest-impact subset only)
- Global pause / circuit breaker redesign

## EIP-170

ODA-514 remediations grew CreatorOracle past the bounded allowlist. Quote/tick/feed helpers
were extracted to `CreatorOracleQuoteLib` (external CALL, CREATE2 salt 0 @ EIP-2470) so the
main runtime stays within `maxRuntimeBytes` (~24.7 KB under `FOUNDRY_PROFILE=ci`).

## Deploy cutover (required before remediations hit new vaults)

`frontend/src/deploy/bytecode.generated.ts` still carries pre-#877 CreatorOracle initcode until regen.

Before the next CreatorOracle cutover:

1. `forge script script/DeployCreatorOracleQuoteLib.s.sol:DeployCreatorOracleQuoteLib --rpc-url $BASE_RPC_URL --broadcast`
2. `./script/generate_frontend_deploy_bytecode.sh` (links CreatorOracle → QuoteLib @ EIP-2470 salt 0)
3. Re-seed `UniversalBytecodeStore` (`SeedUniversalBytecodeStore` now includes `CreatorOracleQuoteLib`)
4. Confirm `CreatorOracleQuoteLib` is in `deployments/base/<release>-bytecode-manifest.json`

