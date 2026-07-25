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
