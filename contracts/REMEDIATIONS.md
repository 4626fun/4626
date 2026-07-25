# Remediations included in this pin

This pin carries forward post-#757 / ODA-480/481 remediations from `wenakita/4626`
main (CreatorOVault cooldown/bond, ShareOFT lottery-entry classifier, Batcher/Registry/LM
hardenings) for a v1.20.0 greenfield candidate review.

## Closed at private `a16096d1e` (synced into this pin)

- **ODA-494-H01** (`DeploymentBatcher`): nonzero `shareOftSaltOverride` must equal derived
  `deriveShareOftSalt(...)`; free-form CREATE2 salt squats revert `InvalidShareOftSaltOverride`.
- **ODA-495-H01** (`Registry4626.setCanonicalWallet`): owner may set/override; otherwise creator
  self-bind only (`msg.sender == creator == _wallet`); replace of a different non-zero wallet
  requires `liveRebindEnabled` + owner. Reverse-map uniqueness retained.

Historical July 22 pin (`423e0e3`) and July 23 remediated pin (`413f060`) remain immutable.

## Closed at private `500bab3e8` (synced into this pin)

ODA job 461 Low/Info lottery hardenings (partial; see private
`docs/audits/security-scan-2026-07-22/461-low-info-remediations.md`):

- **L6** reject `setOracleMaxStaleness(0)`
- **L7/L8/L10** VRFConsumer aggregation bound, TWAP min/freshness, `_payNative` overpay refund
- **L12/L13/L14** AMOE two-step owner, price-oracle/consumer timelocks, renounce disabled
- **L16** multi-vault `payJackpot` gas stipend
- **I23/I35** full-width buyer bind; AMOE applies `usdMultiplierBps`
