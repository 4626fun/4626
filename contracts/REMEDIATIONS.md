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

## Closed at private `0e9474d` (synced into this pin)

- **ODA-495-M02** (`Registry4626.setAuthorizedFactory`): the factory codehash pin is now
  enforced only when granting (`_authorized == true`). Previously it ran on revoke too, so a
  factory whose live bytecode had diverged from its pin could not be de-authorized — the pin
  blocked its own revocation. Granting remains exactly as gated as before.
- **ODA-480-[3]-parity** (`AgentOVaultCoreModule.deposit`): *not present in this pin* — the
  agent lane is out of scope for the greenfield candidate. Recorded for traceability: the
  agent lane's measured-transfer `deposit()` override never wrote `lastDepositBlock`, leaving
  the withdraw cooldown entirely unarmed on that path. It now mirrors
  `CreatorOVaultCoreModule.deposit()`: stamp on self-deposit and first-time receivers, never
  refresh an existing holder targeted by a third-party `deposit(assets, victim)`.

## Closed at private `500bab3e8` (synced into this pin)

ODA job 461 Low/Info lottery hardenings (partial; see private
`docs/audits/security-scan-2026-07-22/461-low-info-remediations.md`):

- **L6** reject `setOracleMaxStaleness(0)`
- **L7/L8/L10** VRFConsumer aggregation bound, TWAP min/freshness, `_payNative` overpay refund
- **L12/L13/L14** AMOE two-step owner, price-oracle/consumer timelocks, renounce disabled
- **L16** multi-vault `payJackpot` gas stipend
- **I23/I35** full-width buyer bind; AMOE applies `usdMultiplierBps`
