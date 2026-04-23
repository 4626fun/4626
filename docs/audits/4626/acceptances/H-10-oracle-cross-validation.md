# H-10 (4626-302): Oracle cross-validation for Ajna/Charm rebalance

**Status:** Acceptance — risk-accepted with compensating controls, tracked for follow-up
**Finding:** H-10
**Linear:** 4626-302
**Severity reported:** High

## Problem

Rebalance decisions inside Charm-Alpha and AjnaERC4626 strategies are
driven by a single price source (the creator-coin TWAP or the Ajna
pool mid). The finding notes that if that source is skewed — by a
flash move, a frozen liquidity position, or an oracle freshness
regression — rebalance will mint or burn LP ticks at an incorrect
target sqrtPrice, crystallising the skew as real loss.

Recommended fix: cross-validate the primary price against a Chainlink
CREATOR/USD feed before actioning rebalance, and trip a circuit
breaker if the two diverge beyond a configurable bps threshold.

## Why we are deferring a code fix

The recommended fix requires several components that do not yet exist
in-protocol:

1. **Chainlink feed integration** — no Chainlink feed is currently
   provisioned for creator coins. Adding one requires either Data
   Streams (off-chain signed prices, callable per rebalance tx) or a
   bespoke Functions-backed feed, plus per-creator operational work.
2. **Circuit-breaker state machine** — every strategy that can
   rebalance needs a pausable path plus an admin-only rescue lever,
   with clear re-arming semantics.
3. **Divergence threshold tuning** — requires historical volatility
   analysis per creator to avoid false-positive pauses during normal
   price action.
4. **Governance** — who is authorised to override the breaker, and
   under what disclosure requirements.

None of the above is a mechanical patch. All four items must land
coherently or the fix either blocks legitimate rebalancing or leaves
the same single-source dependency in a more complicated wrapper.

## Compensating controls already in place

- Rebalance authority is restricted to the protocol-owned
  `lpManager` / strategy operator; no external party can trigger it.
- Rebalance cadence is rate-limited by the keeper (see
  `cre/cre-workflows/rebalance-cadence-guard` alerts).
- Charm Alpha vault imposes its own TWAP deviation threshold
  (`CHARM_MAX_TWAP_DEVIATION = 500` / 5%) before allowing a
  rebalance; a divergent primary price will be refused by Charm
  before our strategy even issues the tx.
- The payout-integrity CRE workflow (see Sprint 4 — H-13, L-24,
  M-16) checks post-rebalance NAV against the previous snapshot and
  pages the on-call if deviation exceeds the configured bps.

## Exit criteria (to close this finding)

1. Provision Chainlink Data Streams feeds (or equivalent) for each
   listed creator coin.
2. Land a `CreatorPriceCrossChecker` module that accepts the primary
   TWAP plus the signed feed and reverts on > configurable bps
   divergence.
3. Wire `rebalance()` in `ConcentratedStrategy`, `FullRangeStrategy`,
   `CharmAlphaStrategy`, and the Ajna bucket-move path through the
   cross-checker.
4. Add pause / rescue governance action documented in
   `docs/operations/oracle-breaker-runbook.md`.
5. Add forge fuzz tests covering normal / small-divergence /
   large-divergence / breaker-tripped-and-rescue paths.

## References

- `contracts/vault/strategies/charm/*` (rebalance entry points)
- `contracts/vault/strategies/ajna4626/AjnaERC4626Vault.sol`
- `contracts/vault/strategies/univ4/ConcentratedStrategy.sol`
- `docs/audits/4626/AUDIT_REPORT.md` — H-10 row
