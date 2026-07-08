# Security Review — ERC-4626 Omnichain Vault ("CreatorOVault") Contracts

**Document location:** `docs/audits/CreatorOVault_aristotle/AUDIT_REPORT.md`  
**Method:** Manual source review (no live exploit execution)  
**Code refs:** Function/file references are authoritative; inline line numbers are intentionally avoided to reduce drift.

**Scope (11 Solidity files, `pragma 0.8.30` / `^0.8.20`):**

| Contract | Role |
|---|---|
| `CreatorOVault.sol` | ERC-4626 hub vault + EIP-712 permit + delegatecall dispatcher |
| `CreatorOVaultCoreModule.sol` | Deposit/mint/redeem/withdraw, queue, profit-unlock, report, impairment (delegatecall target) |
| `OVaultStrategiesModule.sol` | Strategy add/remove/deploy/withdraw/rebalance (delegatecall target) |
| `OVaultAdminModule.sol` | Roles, fees, timelock, rescue, emergency (delegatecall target) |
| `OVaultModuleStorage.sol` / `OVaultModuleBase.sol` | Shared storage layout + delegatecall helpers |
| `CreatorShareOFT.sol` | LayerZero OFT share token, buy-fee, lottery, cross-chain fee flush |
| `CreatorOVaultWrapper.sol` | CreatorCoin ↔ ShareOFT wrapper with 10³ normalization |
| `OVaultHubComposer.sol` | LayerZero `lzCompose` receiver for cross-chain deposit/redeem |
| `OVaultImpairmentClaims.sol` / `OVaultRecoveryEscrow.sol` | Side-pocket claim (ERC-1155) + recovery escrow |

**General assessment.** This is a mature codebase that has already been through several audit rounds (numerous inline `FIX:` annotations referencing prior findings C-1..C-3, H-01..H-14, M-01..M-12, L-01..L-07, I-01..I-05). The core ERC-4626 accounting is defensive: virtual-share offset (`_decimalsOffset()=3`), minimum first deposit, exact-transfer enforcement (fee-on-transfer / rebasing assets are explicitly rejected), tracked `coinBalance` instead of live `balanceOf` (donation-resistant `totalAssets`), profit-unlocking to prevent PPS jumps, per-strategy asset caps, valuation-readiness gating, and best-effort strategy withdrawal so one hostile strategy cannot brick redemptions. The cross-chain surface (`OVaultHubComposer`, `CreatorShareOFT`) enforces peer/EID/mesh invariants and strict balance-delta invariants.

The findings below are the issues that remain after that hardening. Severities use the usual likelihood×impact convention. No automated exploit was executed; this is a manual source review, and the underlying strategy contracts, the Registry4626, the GaugeController, and the LotteryManager are **out of scope** (trusted dependencies).

---

## HIGH

### H-1 — Queued (large) withdrawals are under-paid, and can be fully locked, because the claim reuses the capped `previewRedeem`

`CreatorOVault.previewRedeem` in `CreatorOVault.sol` intentionally caps the result at the vault's liquid assets **minus the assets reserved for all queued withdrawals**:

```solidity
uint256 reserved = super.previewRedeem(totalQueuedWithdrawalShares);
uint256 available = liquid > reserved ? liquid - reserved : 0;
return assets > available ? available : assets;
```

That reservation is correct for *instant* `redeem`, but `claimQueuedWithdrawal` in `CreatorOVaultCoreModule.sol` computes the claimant's payout with the **same capped** `previewRedeem`, and does so **while the claimant's own shares are still counted in `totalQueuedWithdrawalShares`** (the queued-share decrement happens *after* payout calculation):

```solidity
assets = IERC4626(address(this)).previewRedeem(shares); // capped, self still reserved
totalQueuedWithdrawalShares -= shares;                  // decremented afterward
```

Consequences:
* A holder whose queued shares represent more than ~50 % of the vault's asset value is paid `available = totalAssets − (value of all queued shares) < entitlement`; the full share amount is burned but only the capped assets are released, so the shortfall is **permanently redistributed to the remaining holders** (direct loss of user funds).
* In a bank-run where a large fraction of supply is queued simultaneously, `reserved → totalAssets`, `available → 0`, and **every** claimant is paid ≈0 while their shares are burned — queued principal is effectively lost/locked.
* Large holders are *forced* onto this path: `redeem`/`withdraw` revert with `LargeWithdrawalMustBeQueued` once `assets >= largeWithdrawalThreshold`, so the affected users cannot avoid it.
* The same capped `previewRedeem` is used in `queueWithdrawal` to test `assets < largeWithdrawalThreshold`; the understated value can also wrongly reject a legitimate large queue with `InvalidAmount` (DoS).

**Recommendation.** When settling a queued claim, exclude the shares being claimed from the reservation, e.g. compute the payout with an uncapped conversion (`super.previewRedeem(shares)` / `convertToAssets`) after the escrowed shares have been removed from `totalQueuedWithdrawalShares`, or subtract `shares` from the `reserved` term. Add an invariant test: "sum of queued claims paid == sum of their uncapped entitlements" and a bank-run scenario where 100 % of supply is queued.

---

## MEDIUM

### M-1 — Delegatecall module storage layout is guarded only by a manually-maintained version hash

The vault executes `deposit`, `redeem`, `report`, all strategy and admin logic via `delegatecall` into three modules that redeclare the entire storage layout in `OVaultModuleStorage`. Correctness depends on `OVaultModuleStorage` matching `CreatorOVault`'s inherited + custom layout **slot-for-slot**. I reviewed the current layout (OZ v5 `ERC20`→`Ownable`→`ReentrancyGuard`→`EIP712` fallbacks, then the custom vars) and it matches today.

The only runtime guard is `setModulesOnce` comparing `moduleStorageVersion()` — a hand-written `keccak256("OVaultModuleStorage.v3")` constant duplicated in each module. Nothing prevents a future edit that changes a slot (reordering a field, changing a type's packing, inserting a var in the vault but not the module, OZ minor-version storage changes) **without** bumping the constant. A mismatch silently corrupts balances/roles/accounting — a catastrophic, hard-to-detect class of bug. The constant is also duplicated (not shared) so the two can drift.

**Recommendation.** Add a CI storage-layout diff (`forge inspect <c> storage-layout`) asserting `CreatorOVault` and each module are identical, and fail the build if `MODULE_STORAGE_VERSION` is unchanged while the layout changes. Longer term, move to ERC-7201 namespaced storage (referenced in the code's own RFC) so modules cannot collide with base-class slots at all.

### M-2 — Impairment "Suspect" mode freezes all deposits and withdrawals with no time bound; any emergency-authorized role can trigger it

`tripImpairment` in `CreatorOVaultCoreModule` is `onlyEmergencyAuthorized` (emergencyAdmin **or** management **or** owner **or** impairmentGuardian) and may be called on **any listed strategy**. It sets `vaultMode = Suspect`, after which `deposit`, `mint`, `redeem`, `withdraw`, and `claimQueuedWithdrawal` all revert with `VaultNotNormal`, and `maxDeposit/maxWithdraw/...` return 0. There is no deadline forcing progression to `finalize`/`resolve`; the vault can remain frozen indefinitely at the discretion of the (broad) emergency role set. `clearImpairmentTrip` can undo it, but only by the same roles.

This is a liveness/centralization risk: a single compromised or malicious emergency key can freeze all user funds, and honest operators face no on-chain SLA to unfreeze.

**Recommendation.** Narrow the trip authority (e.g. impairmentGuardian only), add a maximum Suspect duration after which withdrawals re-enable (possibly at a haircut) or the trip auto-clears, and emit/track a challenge deadline. At minimum, document the trust assumption prominently.

### M-3 — Fee and risk-parameter changes are instant by default (`riskConfigDelay == 0`)

`riskConfigDelay` defaults to `0` (never set in the constructor). With `delay == 0`, `_scheduleRiskChange` (AdminModule) executes immediately, so `setPerformanceFee` (→ up to `MAX_FEE` = 20 %), `scheduleSetManagementFee` (→ up to 5 %), `setStrategyMaxAssets`, and `setManagementFeeRecipient` take effect with **no timelock**. The timelock machinery only engages if governance first calls `setRiskConfigDelay(>=1 day)`. Users therefore have no guaranteed notice window before fees are raised to the cap.

**Recommendation.** Initialize `riskConfigDelay` to a non-zero minimum (e.g. 1–2 days) in the constructor, or make a non-zero delay mandatory for fee-increasing changes.

### M-4 — `buyDebt` transfers value from the buyer to the vault but returns nothing to the buyer

`OVaultStrategiesModule.buyDebt` pulls `_amount` of the asset from the caller into the vault and reduces `strategyDebt`/`totalDebt`, but never transfers the corresponding (impaired) strategy position, shares, or any claim to the buyer. For a non-impaired strategy the caller simply donates funds and gets nothing; for an impaired strategy the funds are routed to the recovery escrow (benefiting claim holders) while the buyer still receives nothing. This diverges from the Yearn `buy_debt` model it cites (where the buyer receives the strategy's shares). Impact is limited because it is `onlyDebtPurchaser`, but the function as written has no rational caller and can only ever result in the "purchaser" losing funds.

**Recommendation.** Either transfer the strategy position/claim to the buyer to make the trade fair, or remove the function / rename it to reflect that it is a debt *donation*/write-down, and gate accordingly.

---

## LOW / INFORMATIONAL

### L-1 — Owner and vault can burn arbitrary holders' ShareOFT without allowance
`CreatorShareOFT.burn` skips `_spendAllowance` when `msg.sender == vault || msg.sender == owner()`. The vault path is expected, but the owner path lets the EOA/multisig owner burn any user's ■TOKEN balance unilaterally. This is a strong centralization/rug primitive; consider removing the owner exemption or routing owner burns through a timelocked/gauge path. (Trust disclosure at minimum.)

### L-2 — `SECONDS_PER_YEAR` inconsistency between modules
Core/vault use `31_556_952`; `OVaultAdminModule` uses `365 days = 31_536_000` for the `setProfitMaxUnlockTime` upper bound. Harmless today but the duplicated-constant pattern is error-prone; centralize shared constants.

### L-3 — Dead/duplicated ERC-4626 limit functions in the core module
`maxDeposit/maxMint/maxWithdraw/maxRedeem`, `pricePerShare`, `unlockedShares`, etc. exist in **both** `CreatorOVault` (directly implemented, and therefore what external callers hit) and `CreatorOVaultCoreModule` (only reachable via delegatecall, which the vault never does for these). The two diverge: the module's `maxWithdraw`/`maxRedeem` apply an `OVaultLiquidityLib` instant-liquidity cap that the vault's live versions do **not**. Integrators reading `maxWithdraw` therefore may receive a value the queue path won't honor. Remove the shadowed module copies or make the vault delegate to them, so there is a single source of truth (this also relates to H-1).

### L-4 — `report()` can silently skip fees when the baseline is reset
When `totalAssetsAtLastReport == 0` but `totalSupply > 0` (reachable because `_decreaseReportBaselineForPrincipalOutflow` floors the baseline at 0 on large outflows), `report()` resets the baseline to live assets and books **zero** profit — skipping performance/management fees on genuine accrued yield. This is protocol-revenue loss, not user loss, and is an intentional safety choice (`AUDIT-2026-07-01-H01`), but worth noting as an accounting edge.

### L-5 — Broad owner/rescue centralization (disclosure)
Owner controls module wiring (`setModulesOnce`), pause, whitelist, emergency withdraw (post-shutdown), fee recipients, and can configure `protocolRescue`, which — after `rescueDelay` — can transfer ownership to an arbitrary address. These are standard for this design but should be clearly disclosed to users; the safety of the whole system rests on the owner/management keys being a well-operated multisig with the timelocks actually configured (see M-3).

### I-1 — Custom messages share the OFT `_lzReceive` entrypoint
Winner-callback (128 B), remote-lottery-entry (160/192 B), and flush-command (32 B) messages are disambiguated from packed OFT token-transfer payloads by length + field-shape heuristics. Peer/EID authentication via `OAppReceiver` makes collision practically infeasible (a colliding token transfer would require a recipient address whose top 240 bits are zero and equal the msg-type), and the code documents this. Still, the safest long-term design (noted in the code's own comment) is a dedicated OApp receiver separate from the OFT so custom messages and token transfers never share a decoder.

### I-2 — Fee-on-transfer / rebasing assets are (correctly) unsupported
`_pullCreatorCoinExact`/`_pushCreatorCoinExact` revert on any balance-delta mismatch. Ensure the deployed Creator Coin is a standard, non-rebasing, non-fee ERC-20; otherwise deposits/withdrawals will revert. (Confirmation item, not a bug.)

### I-3 — `previewRedeem` cap also affects instant `redeem` accounting
Beyond H-1, an instant redeemer can be under-quoted when a large queue exists; this is by design (protecting queued reservations) but combined with `maxRedeem`/`maxWithdraw` reporting it may surprise integrators. Track alongside H-1/L-3.

---

## Positive observations (defenses verified present)

- Virtual-share offset + `MINIMUM_FIRST_DEPOSIT` + `InflationAttackDetected` guard against first-depositor / donation inflation.
- `totalAssets()` uses tracked `coinBalance`, not live `balanceOf`, defeating donation-based fee/PPS manipulation.
- Strategy valuation-readiness gating and per-strategy `strategyMaxAssets` caps limit oracle-poisoning/over-reporting impact on share price.
- Best-effort strategy withdrawal (`_tryWithdrawFromStrategyMeasured`) with negative-delta handling prevents a hostile/illiquid strategy from bricking user redemptions.
- Reentrancy: state-changing entrypoints are `nonReentrant`, the guard slot is shared across delegatecall modules, and CEI ordering is followed on the redeem path.
- Cross-chain: `OVaultHubComposer` enforces sender/EID/peer/mesh invariants plus strict input-spend / output-mint / residual-balance invariants; `CreatorShareOFT` dedupes winner callbacks by GUID and allowlists lottery-beneficiary resolvers.
- Impairment side-pocket caps cumulative minted claims at `totalClaimSupply` and epoch-scopes escrow accounting (prior C-2/C-3 fixes verified).

---

## Suggested remediation priority
1. **H-1** — fix queued-claim payout (exclude self from reservation / use uncapped conversion). Add bank-run + whale invariant tests.
2. **M-1** — add CI storage-layout equivalence check for vault vs modules.
3. **M-3** — default `riskConfigDelay` to a non-zero timelock.
4. **M-2 / M-4 / L-1** — tighten trip authority + add a Suspect deadline; fix or repurpose `buyDebt`; reconsider the owner burn exemption.
5. **L-2..L-5 / I-1..I-3** — cleanups, disclosures, and integrator-facing consistency.

*This review is a best-effort manual source audit and does not guarantee the absence of other vulnerabilities. Out-of-scope dependencies (strategies, Registry4626, GaugeController, LotteryManager, LayerZero infrastructure) are assumed to behave correctly and honestly.*
