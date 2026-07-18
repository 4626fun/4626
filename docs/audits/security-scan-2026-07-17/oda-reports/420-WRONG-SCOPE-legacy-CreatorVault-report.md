# 🔐 Security Review — CreatorShareOFT + CreatorOVaultWrapper (wenakita/CreatorVault)

---

## Scope

|                                  |                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------- |
| **Target**                       | `wenakita/CreatorVault` (client-supplied description named repo "4626", which is not the actual repo slug — resolved via GitHub search on the file paths given) |
| **Commit**                       | `971da642861b070067aefa5f70aa82546aae5af6`                                        |
| **Mode**                         | Named files                                                                        |
| **Files reviewed**               | `contracts/services/messaging/CreatorShareOFT.sol` (556 lines) · `contracts/vault/CreatorOVaultWrapper.sol` (603 lines) |
| **Context-only (not in scope)**  | `contracts/vault/CreatorOVault.sol`, `contracts/core/CreatorRegistry.sol`, `contracts/governance/CreatorGaugeController.sol`, `contracts/interfaces/core/*.sol` — read to resolve call targets and vault guarantees only; no findings taken from these files |
| **Methodology**                  | Three-phase: (0) context map + access-control inventory + threat catalog (3 opus agents) → (1) ethskills breadth, 6 domain checklists (general, precision-math, erc20, erc4626, bridges, access-control; opus) → (2) pashov depth, 12 attacker-mindset agents, run blind to phase-1 findings (opus) → (3) hybrid reconciliation + coverage gate |
| **Confidence threshold**         | Findings reported at confidence ≥ 50; below 50 listed as Leads                    |

**Client focus areas** (per job description): mint authority, vault-backing checks, LayerZero credit path, fee flush, lottery coverage snapshots — all four are covered below (Findings #1, #2, #3, #13 respectively; fee flush analyzed and found not exploitable, see "Checked, no issue").

---

## Reconciliation Summary

`Overlap (both phases): 9 · Phase-1-only: 8 · Phase-2-only: 5 · Re-examined leads kept: 14, demoted: 0 · Coverage holes closed: 0`

The single most important finding (#1, cross-chain/cross-minter collateral drain) was independently reached by **11 of 12** Phase-2 attack agents from different angles (invariant analysis, first-principles, asymmetry, trust boundaries, execution flow, numerical seams) plus **3 of 6** Phase-1 breadth agents (bridges, erc4626, general) — the highest convergence of any item in this audit. Findings #2–#4 (mint/burn/emergencyWithdraw authority) were each independently reached by 3–5 agents across both phases with concrete numeric proofs, not vague "admin can rug" claims — each names the specific advertised guarantee (the contract's own NatSpec: "*Represents proportional ownership of assets in a Creator Coin Omnichain Vault*") that the mechanism bypasses, per this engagement's Gate 3 discipline for admin-triggered findings.

**Coverage gate**: 24 external/public state-changing entrypoints in the two files (12 in `CreatorShareOFT.sol`, 12 in `CreatorOVaultWrapper.sol`) — all 24 examined; every one maps to a finding below or an explicit "examined, no issue" note. All 9 threat-catalog rows from the Phase-0 map are answered (6 by a finding, 1 invariant-holds after direct testing by the execution-trace agent, 2 as design/config-trust limitations noted in context). Zero coverage holes required a fresh re-read in this reconciliation pass — both phases already covered the full inventory.

---

## Findings

[90] **1. Cross-chain (and single-chain, via mint authority) collateral drain: `unwrap`/`withdraw` never verify the redeemed ■AKITA was backed by *this* wrapper**

`CreatorOVaultWrapper._unwrapInternal` · Confidence: 90

**Description**
`_unwrapInternal` (`CreatorOVaultWrapper.sol:400-429`) gates redemption solely on the chain-local aggregate `if (totalLocked < vaultSharesBeforeFee) revert InsufficientLocked()` (L414) — it never checks that the ■AKITA being burned was minted by *this* wrapper against shares it actually locked. ■AKITA is a LayerZero OFT (`CreatorShareOFT.sol` inherits `OFT` with no `_credit`/`_debit`/`_lzReceive` override anywhere in its 556 lines — confirmed by full-file read across three independent agents), so it is freely bridgeable cross-chain, and it is also mintable outside any wrapper via `mint()` (`CreatorShareOFT.sol:215-218`, see Finding #2). Either path creates ■AKITA on a chain (or in a holder's hands) with zero contribution to that chain's `totalLocked`/`totalMinted`. A holder of such ■AKITA can `unwrap()`/`withdraw()` against the local pool and drain vault shares that were locked by *other, honest* local depositors — who then hit `InsufficientLocked` or a `totalMinted` underflow revert when they try to exit. The invariant agent's formal statement: `verify()`/`isBalanced()` (L509-511, L576-579) only prove the wrapper's *own ledger* is self-consistent — they say nothing about system-wide solvency, because 4 of the 6 ways ■AKITA's supply changes (direct mint, direct burn, LayerZero credit, LayerZero debit) never touch `totalLocked`/`totalMinted` at all.

**Proof of Concept** (cross-chain variant, fully unprivileged — bridging is a permissionless action any OFT holder can take on their own tokens):
Alice deposits 1000 AKITA on chain B → `wrapper_B.totalLocked = 1_000_000`, `totalMinted = 1000`, Alice holds 1000 ■AKITA. Bob deposits 1000 AKITA on chain A (`wrapper_A.totalLocked = 1_000_000`), receives 1000 ■AKITA, then bridges them A→B via the standard LayerZero `send()` (burns on A via base `_debit`, mints on B via base `_credit` — neither wrapper's ledger is touched by the bridge). Chain B's ■AKITA supply is now 2000, but `wrapper_B.totalMinted` is still 1000. Bob calls `wrapper_B.withdraw(1000)`: `vaultSharesBeforeFee = 1_000_000`; the guard `1_000_000 >= 1_000_000` passes; Bob's 1000 ■AKITA is burned; `totalLocked → 0`; `vault.redeem(1_000_000, Bob, wrapper_B)` pays Bob ~1000 AKITA — Alice's deposit. Alice's subsequent `withdraw(1000)` reverts `InsufficientLocked`. Meanwhile `wrapper_A` still holds 1_000_000 vault shares that no ■AKITA on chain A can ever redeem — permanently stranded. If chain B's vault price-per-share exceeds chain A's at the time of the bridge, Bob additionally nets a direct arbitrage profit on top of the drain (noted independently by the asymmetry agent).

**Same mechanism, no bridging required**: any address the owner has flagged `isMinter`, or the owner directly, can call `mint()` (Finding #2) with zero wrapper interaction and then `unwrap`/`withdraw` it against the local pool — identical drain, single chain, no cross-chain setup needed.

**Fix**

```diff
-        if (totalLocked < vaultSharesBeforeFee) revert InsufficientLocked();
+        // Redemption must be capped by what THIS wrapper minted, not merely
+        // by the aggregate pool, so ■AKITA that entered circulation via a
+        // bridge or a non-wrapper mint cannot draw down other depositors' backing.
+        if (shareOFTIn > totalMinted) revert InsufficientLocked();
+        if (totalLocked < vaultSharesBeforeFee) revert InsufficientLocked();
```
This alone is a partial mitigation (it does not fully solve the problem — see below). The structural fix requires one of: (a) make `CreatorShareOFT` the wrapper's exclusive minter (remove `owner()`/`isMinter` from `onlyVaultOrMinter`, Finding #2) **and** make ■AKITA non-bridgeable, so all supply is provably wrapper-originated; or (b) if omnichain redemption is a required feature, redesign cross-chain transfer so the destination wrapper's `totalLocked` is credited via the LayerZero message payload (compose) in lockstep with the `_credit` mint, rather than decoupled from it entirely.

---

[85] **2. `mint()` is callable by the owner or any `isMinter`-flagged address with zero collateral check, bypassing the advertised backing guarantee**

`CreatorShareOFT.mint` · Confidence: 85

**Description**
`mint(_to,_amount)` (L215-218) is gated by `onlyVaultOrMinter` (L138-143): `msg.sender==vault || isMinter[msg.sender] || msg.sender==owner()`. The `vault`/`isMinter` principals are meant to route through backing checks, but the modifier makes the raw `owner()` key (and any address the owner flags `isMinter` via `setMinter`, L204-208) a permanent, unconditional minter with **no reference anywhere in `mint()` to `CreatorOVaultWrapper.totalLocked`** — the only place collateral is actually tracked. This directly contradicts the contract's own NatSpec (`CreatorShareOFT.sol:528`): *"Represents proportional ownership of assets in a Creator Coin Omnichain Vault."* This is the access-mechanism itself that is the bug (the modifier admits principals that were never meant to bypass backing accounting), not a generic "owner has privileges" observation — flagged per this engagement's Gate 3 discipline requiring a concrete, named amplifier for admin-triggered findings; here the amplifier is that any unprivileged recipient of a mint can independently call the fully-permissionless `withdraw()`/`unwrap()` to convert the unbacked mint into real assets drained from other depositors (Finding #1).

**Proof of Concept**: legitimate state `totalMinted = 1_000_000` ■AKITA (wrapper), `totalLocked = 1e9` vault shares. Owner (or a flagged minter) calls `mint(attacker, 500_000)` — wrapper's `totalLocked`/`totalMinted` are unchanged. Attacker calls `wrapper.withdraw(500_000)`: `_unwrapInternal` computes `vaultSharesBeforeFee = 5e8`, passes `totalLocked(1e9) >= 5e8`, burns attacker's own 500k ■AKITA, `totalMinted → 500_000` (no underflow, since it was never incremented for this mint), `totalLocked → 5e8`, `vault.redeem(5e8, attacker, wrapper)` pays the attacker real creator coins for shares that backed *other* depositors. Roughly half of the legitimate holders subsequently hit `InsufficientLocked` on their own withdraw.

**Fix**

```diff
-    modifier onlyVaultOrMinter() {
-        if (msg.sender != vault && !isMinter[msg.sender] && msg.sender != owner()) {
-            revert OnlyVaultOrMinter();
-        }
-        _;
-    }
+    modifier onlyVaultOrMinter() {
+        if (msg.sender != vault && !isMinter[msg.sender]) {
+            revert OnlyVaultOrMinter();
+        }
+        _;
+    }
```
Remove `owner()` from the mint/burn authority entirely; restrict minting to the wrapper's own backed `_wrapInternal` path (and to `vault`/explicitly-audited minters only, each of which should itself enforce a collateral check).

---

[85] **3. `burn()` destroys any holder's balance with no allowance or consent**

`CreatorShareOFT.burn` · Confidence: 85

**Description**
`burn(_from,_amount)` (L225-228) calls base `_burn(_from,_amount)` directly under the same `onlyVaultOrMinter` gate, with **no `_spendAllowance` check** — contrast the same contract's `transferFrom` (L244-247), which *does* call `_spendAllowance(from, _msgSender(), amount)` before moving a third party's tokens. Any `vault`/`isMinter`/`owner` principal can unilaterally destroy any holder's ■AKITA with zero consent. Beyond the intended wrapper-driven unwrap path (which only ever burns `msg.sender`'s own balance via `_unwrapInternal`), this primitive is broader than any legitimate caller needs.

**Proof of Concept**: owner (or any flagged minter) calls `burn(victim, victimBalance)`. `_burn` succeeds via `onlyVaultOrMinter`; victim's ■AKITA is destroyed with no approval. Victim's underlying claim on locked vault shares (still counted in `totalLocked`) becomes unclaimable via the normal unwrap path — a second-order fund-loss on top of the direct token destruction.

**Fix**

```diff
     function burn(address _from, uint256 _amount) external onlyVaultOrMinter {
+        if (_from != msg.sender) {
+            revert OnlyVaultOrMinter(); // or a dedicated error; burn must be self-burn only
+        }
         _burn(_from, _amount);
         emit SharesBurned(_from, _amount);
     }
```
Restrict `burn`'s `_from` to `msg.sender` — the wrapper's own unwrap flow only ever needs to burn the caller's own tokens (`_unwrapInternal` already burns `user`, which is always the transaction's own `msg.sender` per `withdraw`/`unwrap`'s call sites).

---

[85] **4. `emergencyWithdraw` can drain the vault-share collateral backing all outstanding ■AKITA**

`CreatorOVaultWrapper.emergencyWithdraw` · Confidence: 85

**Description**
`emergencyWithdraw(token,to,amount)` (L588-595) is `onlyOwner` with no restriction on `token`, no exclusion for `address(vault)` (the vault-share balance that `totalLocked` and `verify()` both assume is present), and no post-transfer check that the wrapper's remaining balance still covers `totalLocked`. This is the exact collateral the contract's own `verify()` (L576-579) checks for. As with Findings #2–#3, this is reported because it is a *named, concrete mechanism* violating the advertised backing guarantee — not a generic "the owner could theoretically misuse an admin function" observation. A further subtlety independently identified: because `emergencyWithdraw` never updates `totalLocked`, even a *partial* drain leaves `totalLocked` overstating the real balance — subsequent `unwrap`/`withdraw` calls then pass their `totalLocked` guard but fail on the final transfer against the now-depleted actual balance, turning what should be an orderly redemption into an ordering-dependent, first-come-first-served scramble among the remaining honest holders.

**Proof of Concept**: state `IERC20(vault).balanceOf(wrapper) == totalLocked == 1e9`. Owner calls `emergencyWithdraw(address(vault), attacker, 1e9)` — a single transaction. Wrapper's vault-share balance goes to 0; `totalLocked` remains stale at 1e9. Every subsequent `withdraw`/`unwrap` call's `vault.redeem`/`safeTransfer` reverts against the empty balance. All outstanding ■AKITA becomes permanently unredeemable; the attacker holds the vault shares and can redeem them elsewhere (or directly, since they now personally hold them) for the underlying creator coin.

**Fix**

```diff
     function emergencyWithdraw(
         address token,
         address to,
         uint256 amount
     ) external onlyOwner {
         if (to == address(0)) revert ZeroAddress();
+        if (token == address(vault)) {
+            uint256 excess = IERC20(vault).balanceOf(address(this)) - totalLocked;
+            require(amount <= excess, "cannot withdraw locked backing");
+        }
         IERC20(token).safeTransfer(to, amount);
     }
```

---

[90] **5. Shared `lastDepositBlock[wrapper]` lets any user's deposit block every other user's same-block withdrawal (griefing DoS)**

`CreatorOVaultWrapper.deposit` / `withdraw` · Confidence: 90

**Description**
The wrapper is always the vault-level `receiver` (`vault.deposit(amount, address(this))`, L233/L252) and `owner_` (`vault.redeem(vaultShares, msg.sender, address(this))`, L284/L300), so every wrapper deposit sets the *same* `lastDepositBlock[wrapper]` slot in the vault (per the vault's flash-loan guard), shared across **every end user of the wrapper**. The vault's `redeem` reverts `WithdrawTooSoon` whenever called before `lastDepositBlock[owner_] + withdrawDelayBlocks` (default 1). This is a fully unprivileged, permissionless griefing vector — no admin action, no special preconditions beyond calling `deposit()`, which anyone can do at dust scale (only needs to yield ≥1000 vault shares, a few wei of underlying given the vault's 1000x share-decimals offset, fully reclaimable by the griefer).

**Proof of Concept**: attacker calls `wrapper.deposit(dust)` in block N — sets `lastDepositBlock[wrapper] = N`. Any honest user's `wrapper.withdraw(...)` mined in block N calls `vault.redeem(..., wrapper)`, which checks `block.number(N) < lastDepositBlock[wrapper](N) + withdrawDelayBlocks(1)` → reverts `WithdrawTooSoon`. Repeating the dust deposit every block perpetually freezes every wrapper withdrawal; a targeted variant simply front-runs one specific victim's `withdraw` transaction with a same-block deposit.

**Fix**
Do not route all users' vault-level identity through the wrapper's own address for a per-owner timing guard. Either track and enforce the delay per end-user inside the wrapper itself (independent of the vault's per-owner slot), or have the vault's flash-loan guard key on the true beneficiary rather than the immediate caller/owner. At minimum, document prominently that deposits and withdrawals through the wrapper cannot safely co-occur within the same block.

---

[85] **6. `CreatorShareOFT.convertToAssets()` under-reports asset value by exactly 1000x**

`CreatorShareOFT.convertToAssets` · Confidence: 85

**Description**
`convertToAssets(shares)` (L471-474) forwards ■AKITA-denominated `shares` directly to `ICreatorOVault(vault).convertToAssets(shares)`, which expects **vault-share** (▢AKITA)-denominated input. Since 1 ■AKITA = 1000 ▢AKITA (the wrapper's own `NORMALIZATION_FACTOR`), this view answers as though the caller held 1000x fewer tokens than they actually do. The wrapper's own `_unwrapInternal` (L403: `vaultSharesBeforeFee = shareOFTIn * NORMALIZATION_FACTOR`) proves the correct relationship is a ×1000 multiply before querying the vault — this function omits exactly that step. Independently confirmed by three separate Phase-2 agents (math-precision, economic-security, periphery) plus a Phase-1 agent (erc4626), each verifying the exact arithmetic against the vault's `_decimalsOffset()==3` OZ-standard `convertToAssets` formula.

**Proof of Concept**: querying `convertToAssets(1e18)` (1 whole ■AKITA, true backing ≈ 1e18 of the underlying creator coin at a mature vault) returns ≈1e15 — a factor of exactly 1000 too low. No in-scope function moves funds on this value, but any external integrator, price oracle, or tax hook (the contract explicitly documents external tax-hook integration) that consumes it for pricing/collateral purposes will misprice ■AKITA by three orders of magnitude.

**Fix**

```diff
     function convertToAssets(uint256 shares) public view returns (uint256) {
         if (vault == address(0)) return shares;
-        return ICreatorOVault(vault).convertToAssets(shares);
+        return ICreatorOVault(vault).convertToAssets(shares * 1000); // NORMALIZATION_FACTOR, mirror wrapper._unwrapInternal
     }
```

---

[80] **7. `CreatorOVaultWrapper.pricePerShare()`/`getVaultStats()` report the raw vault-share price, not the ■AKITA price — same 1000x unit mismatch, different function**

`CreatorOVaultWrapper.pricePerShare` / `getVaultStats` · Confidence: 80

**Description**
`pricePerShare()` (L491-496) computes `vault.totalAssets() * 1e18 / vault.totalSupply()` — the price of one raw ▢AKITA vault share. But the wrapper's entire documented purpose is to hide the 1000x offset so users interact in ■AKITA terms; `vault.totalSupply()` is ~1000x the ■AKITA supply the wrapper actually issues. A consumer computing "my ■AKITA holdings' value = balance × pricePerShare()" is off by 1000x. `getVaultStats()` (L533-541) leaks the identical raw figures. This is a distinct function/call site from Finding #6 (same root cause — a missing `×1000`/`÷1000` normalization — but a different location, so listed separately per this engagement's function-isolation rule).

**Fix**

```diff
     function pricePerShare() external view returns (uint256) {
         uint256 totalAssets = vault.totalAssets();
-        uint256 totalSupply = vault.totalSupply();
+        uint256 totalSupply = vault.totalSupply() / NORMALIZATION_FACTOR; // convert to ■AKITA-equivalent supply
         if (totalSupply == 0) return 1e18;
         return (totalAssets * 1e18) / totalSupply;
     }
```
(Apply the equivalent adjustment to `getVaultStats()`.)

---

[75] **8. `wrap()`/`deposit()` can mint zero ■AKITA while still taking the user's full vault-share input, once `wrapFee > 0`**

`CreatorOVaultWrapper._wrapInternal` · Confidence: 75

**Description**
The `AmountTooSmallToNormalize` guard (L360: `if (vaultSharesIn < NORMALIZATION_FACTOR) revert`) checks the **pre-fee** input, but the floor-division that actually determines mint output (`shareOFTOut = vaultSharesAfterFee / NORMALIZATION_FACTOR`, L381) runs on the **post-fee** amount. With `wrapFee` set to its maximum (1000 bps = 10%, the ceiling enforced by `setFees`, L178-183), any `vaultSharesIn` in `[1000, 1112)` passes the guard yet floors to `shareOFTOut = 0` after the fee is deducted — `shareOFT.mint(user, 0)` succeeds without reverting, and the default `deposit(amount)` overload has no slippage protection to catch it. Currently **not live** — `wrapFee`/`unwrapFee` both default to 0 and only the owner can change them — but a silent, no-revert value-loss footgun the moment fees are enabled.

**Proof of Concept**: `wrapFee = 1000` (10%). `wrap(1000)`: guard `1000 >= 1000` passes; `fee = (1000*1000)/10000 = 100` (sent to `feeRecipient`); `vaultSharesAfterFee = 900`; `shareOFTOut = 900/1000 = 0`; `totalLocked += 900`; `totalMinted += 0`; mint call succeeds with amount 0. User surrenders 1000 vault shares and receives nothing.

**Fix**

```diff
         shareOFTOut = vaultSharesAfterFee / NORMALIZATION_FACTOR;
+        if (shareOFTOut == 0) revert AmountTooSmallToNormalize();
```

---

[70] **9. `setShareOFT()` can be re-pointed after minting has begun, orphaning `totalMinted` accounting**

`CreatorOVaultWrapper.setShareOFT` · Confidence: 70

**Description**
`setShareOFT` (L172-176) is `onlyOwner` with only a zero-address check — no guard against changing it while `totalMinted > 0`. After a repoint, `_unwrapInternal` calls `burn()` on the *new* token against holders who only ever received the *old* token, reverting their exit and stranding their locked collateral until the owner restores the original address (if they still can — the old token contract's minter/owner state is independent).

**Fix**: `require(totalMinted == 0)` before allowing a change, or make the field set-once.

---

[60] **10. Large withdrawals (≥ the vault's `largeWithdrawalThreshold`) revert with no wrapper-level queue path**

`CreatorOVaultWrapper.withdraw` · Confidence: 60

**Description**
The underlying vault (context-only, but its behavior directly affects the in-scope `withdraw`) reverts any `redeem` whose assets exceed a threshold (documented as 100_000e18 in the vault) with `LargeWithdrawalMustBeQueued`, requiring a separate queue flow the wrapper never calls or exposes. Because the vault shares are wrapper-owned, the end user cannot queue directly either — the only workaround is `unwrap()` to raw vault shares followed by manual interaction with the vault. Not a fund-loss path; a broken advertised UX ("one-tx withdraw") for large holders.

---

[55] **11. Wrap-time floor division permanently breaks the `totalLocked == totalMinted * 1000` invariant and strands sub-1000 dust**

`CreatorOVaultWrapper._wrapInternal` · Confidence: 55 (nine independent agents across both phases converged on this; kept at moderate confidence because impact is confined to dust-level value and the two view functions, per this engagement's "dust-level, no compounding" demotion criterion)

**Description**
`totalLocked += vaultSharesAfterFee` (full amount, L377) but `totalMinted += vaultSharesAfterFee / NORMALIZATION_FACTOR` (floored, L381/385). Any wrap whose post-fee share amount isn't an exact multiple of 1000 leaves the remainder (0–999 vault-share units) permanently counted in `totalLocked` with no corresponding ■AKITA (unwrap only ever moves exact multiples of 1000). Confirmed **not** exploitable for over-withdrawal — the rounding direction strictly favors the protocol (`totalLocked` only ever exceeds `totalMinted*1000`, never falls short) — but it permanently falsifies `isBalanced()`/`verify()`, the two client-facing health-check views, the moment any non-round wrap occurs. Dust is recoverable only by the owner via `emergencyWithdraw` (Finding #4).

---

[55] **12. `chainEid` stores `block.chainid`, not a real LayerZero EID; registry lookups truncate to `uint16`**

`CreatorShareOFT` constructor / `_triggerLottery` · Confidence: 55

**Description**
`chainEid` (L83, documented as "Chain EID") is assigned `uint32(block.chainid)` (L170) — the EVM chain id, not a LayerZero Endpoint ID; it is never used for messaging within these two files (peers are configured via inherited `setPeer` with real EIDs), so this specific naming mismatch is cosmetic. However, `getLayerZeroEndpoint(uint16(block.chainid))` (L166) and `getLotteryManager(uint16(block.chainid))` (L358) both truncate the full chain id to 16 bits. Any chain with id > 65535 — including Zora mainnet (7777777 → truncates to 44529), the very ecosystem this protocol is documented to build on — has its registry lookups keyed on a truncated, potentially colliding value.

---

[55] **13. Lottery attribution uses `tx.origin` and discards the actual transfer recipient**

`CreatorShareOFT._triggerLottery` · Confidence: 55

**Description**
`_triggerLottery(address, uint256 amount)` (L348-367) ignores its first (recipient) parameter entirely and instead credits `buyer = tx.origin` (L353), gated to EOAs only (`buyer.code.length == 0`, L356). This breaks for any smart-contract-wallet/account-abstraction user (their `tx.origin` is a bundler/relayer, not them), and more generally decouples lottery eligibility from who actually received the purchased tokens.

---

[50] **14. Fee-on-transfer `creatorCoin` would permanently brick `deposit()` (no balance-delta measurement)**

`CreatorOVaultWrapper.deposit` · Confidence: 50

**Description**
`deposit()` (L222-256) pulls `creatorCoin.safeTransferFrom(msg.sender, address(this), amount)` (L230/251) then immediately reuses the same `amount` for `vault.deposit(amount, address(this))` (L233/252), with no balance-delta re-measurement. If `creatorCoin` (the underlying Zora creator coin, an immutable set at construction with no recovery path) were ever fee-on-transfer or rebasing, the wrapper would attempt to hand the vault more than it actually holds, and `vault.deposit` would revert on insufficient balance — permanently DoS'ing the primary deposit entrypoint for that deployment. Currently contingent on creatorCoin's token behavior (standard Zora creator coins are not documented as fee-on-transfer), hence the moderate confidence.

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path could not be completed in one analysis pass, confidence fell below the 50 reporting floor, or the mechanism is fundamentally an admin-trust question without a further unprivileged amplifier. Not scored._

- **Registry-admin confused-deputy over the lottery manager target** — `CreatorShareOFT._triggerLottery`/`setRegistry` — Code smells: `getLotteryManager()` is re-resolved fresh from the owner-set `registry` on every buy, but the *registry's own admin* — potentially a separate party from the OFT owner — controls what that call returns; the OFT owner cannot "lock in" a lottery manager via `setRegistry` alone. Analyzed and bounded (try/catch, no value forwarded, `nonReentrant`) — griefing/redirection risk only, no direct fund-theft path found.
- **Gauge fee-burn desyncs `shareOFT.totalSupply()` from the wrapper's `totalMinted` (benign direction)** — `CreatorShareOFT._processBuy` / `CreatorGaugeController` (out of scope) — Code smells: when the gauge controller burns collected fee ■AKITA (per its own out-of-scope logic), the wrapper's `totalMinted`/`totalLocked` are untouched, so `totalLocked` ends up *over*-collateralized relative to true circulating supply — the opposite direction from Finding #1/#2, not itself exploitable, but another source of `verify()` never reflecting true system state. Confirming the gauge's exact burn semantics is out of this job's scope.
- **`taxConfigDelegate` is a dead permission surface** — `CreatorShareOFT.setTaxConfigDelegate` — Code smells: the variable is written (L436) and read nowhere in the contract (confirmed by grep); the NatSpec-named `configureTaxHook` function it references does not exist. An operator calling this reasonably believes they've delegated authority that in fact grants nothing.
- **Preview functions are caller-dependent via `msg.sender` whitelist check** — `CreatorOVaultWrapper.previewDeposit`/`previewWithdraw` — Code smells: fee-exemption is evaluated against the *caller's* `msg.sender`, not an explicit beneficiary parameter, so an integrating router contract's quotes diverge from what the actual end user would receive. Matches execution for the querying caller (no over-estimation), just not composable for a proxying integrator.
- **Raw (non-Safe) `approve()` on `creatorCoin`** — `CreatorOVaultWrapper` constructor (L161) / `refreshApproval()` (L600-601) — Code smells: no return-value handling, no zero-first reset — would revert on deploy for a USDT-style no-return-value token, or on `refreshApproval()` for a token requiring allowance-reset-to-zero. Contingent on creatorCoin's token type.
- **`wrap()` reuses vault-share `amount` without balance-delta measurement** — `CreatorOVaultWrapper.wrap` (L316-325) — Code smells: same pattern as Finding #14 but for the vault-share token; not exploitable against the current OZ-standard vault-share token.
- **Fee transfer to `feeRecipient` not try/catch-wrapped** — `CreatorOVaultWrapper._wrapInternal`/`_unwrapInternal` (L372, L425) — Code smells: could DoS wrap/unwrap if the vault-share token ever became pausable/blocklist-capable and `feeRecipient` got blocklisted; not exploitable against the current token.
- **`previewFee()` diverges from `_processBuy()`'s actual short-circuit conditions** — `CreatorShareOFT.previewFee` (L479-487) vs `_processBuy` (L294-297) — Code smells: `previewFee` doesn't account for `gaugeController == address(0)`, so it can report a fee that won't actually be charged. Quote-accuracy only, no fund impact.
- **Cross-chain bridge path bypasses buy-fee and lottery entirely** — informational design note: base OFT mint/burn (send/receive) never routes through `_transferWithFees`, so bridging is fee-exempt by design. Confirm this is the intended fee model.
- **Single-step `Ownable`, no timelock, no role separation, on both contracts** — contextual: neither contract uses `Ownable2Step` or any timelock; the blast radius of a single compromised owner key spans Findings #2–#4, #9 simultaneously, and `setMinter` (L204-208) has no cap on how many additional minters the owner can flag. `renounceOwnership()` (inherited, unmodified) would permanently brick all configuration and recovery paths if ever called. Recommended alongside the fixes above: adopt `Ownable2Step`, a multisig, and a timelock on `setVault`/`setMinter`/`setShareOFT`/`emergencyWithdraw`.
- **No emergency pause on any user-facing path** — contextual: neither contract implements a `Pausable` circuit breaker; the only "stop" mechanism is the destructive `emergencyWithdraw` (Finding #4), which itself rugs collateral rather than safely freezing operations during an incident.

## Checked, no issue (negative findings worth recording)

- **Reentrancy via `_sendFeesToGauge`/`_triggerLottery` callbacks** (`CreatorShareOFT._processBuy`, L288-316): `nonReentrant` doesn't cover `mint`/`burn`/`transfer`, but at the reentry point all token-ledger effects are already applied and the only live allowance is the fee amount the gauge is meant to consume itself. Traced concretely by the execution-trace agent — no exploit found. Would need re-examination if the gauge or lottery manager ever became attacker-settable rather than owner-configured.
- **Wrap-then-unwrap round-trip profitability**: traced across all fee configurations (0%, whitelisted, 5%, 10% max) by the numerical-gap agent — monotonically loss-making for the round-tripper in every case; no profitable combination exists.
- **Integer overflow in `_unwrapInternal`'s `shareOFTIn * NORMALIZATION_FACTOR`** (L403): requires `shareOFTIn > ~1.157e74`, unreachable given realistic supply and Solidity 0.8.20's checked arithmetic.
- **Fee-setter boundary checks** (`MAX_FEE_BPS`, `MAX_FEE` in `setBuyFee`/`setFees`): both correctly use `>` (not `>=`), so the documented 10% maximum is itself includable with no off-by-one.
- **Zero-amount buys/transfers**: `_processBuy` with `amount==0` only emits zero-value events and returns early in `_sendFeesToGauge`; no division-by-zero or unguarded external-call risk.

---

## Access-Control Inventory (from Phase 0)

**CreatorShareOFT** — single custom modifier `onlyVaultOrMinter` (L138-143: `vault` OR `isMinter[msg.sender]` OR `owner()`). One-step OpenZeppelin `Ownable`.

| Function | Guard | Caller | Ties to finding |
|---|---|---|---|
| `mint`/`burn` | `onlyVaultOrMinter` | vault, any isMinter, or owner | #1, #2, #3 |
| `setVault`/`setRegistry`/`setMinter`/`setGaugeController`/`setBuyFee`/`setFeesEnabled`/`setLotteryEnabled`/`setTaxConfigDelegate` | `onlyOwner` | owner | context/leads |
| `setAddressType(s)` | `onlyOwner` | owner | config-trust, no finding |
| `transfer`/`transferFrom` | none (public) | anyone | fee mechanics — checked, no issue |
| views (`convertToAssets`, `previewFee`, `checkMinter`, etc.) | none | anyone | #6, lead (previewFee) |

**CreatorOVaultWrapper** — `onlyOwner` + `nonReentrant` only, no custom modifiers.

| Function | Guard | Caller | Ties to finding |
|---|---|---|---|
| `setShareOFT`/`setFees`/`setFeeRecipient`/`setWhitelist`/`batchWhitelist` | `onlyOwner` | owner | #9 (setShareOFT) |
| `deposit`(×2)/`withdraw`(×2)/`wrap`/`unwrap` | `nonReentrant`, no access guard | anyone | #1, #5, #8, #10, #11, #14 |
| `emergencyWithdraw` | `onlyOwner` | owner | #4 |
| `refreshApproval` | `onlyOwner` | owner | no issue |
| views (`pricePerShare`, `isBalanced`, `verify`, previews, etc.) | none | anyone | #7, #11, lead (previews) |

---

## Threat Model (from Phase 0, each row resolved)

| Actor | Reaches | Could gain | Resolution |
|---|---|---|---|
| owner / isMinter | `mint()`/`burn()` directly | Unbacked mint / arbitrary confiscation | **Finding #2, #3** |
| owner | `emergencyWithdraw` | Drain all backing collateral | **Finding #4** |
| owner | re-point `setVault`/`setRegistry`/`setGaugeController`/`setShareOFT` | Redirect fee/mint/backing target | **Finding #9** (setShareOFT); others config-trust, no distinct exploit found |
| attacker via helper contract | `tx.origin` lottery attribution vs. discarded recipient | Misattributed lottery entries | **Finding #13** |
| malicious/compromised gauge or lottery manager | reentrant callback mid-`_processBuy` | Reach non-guarded OFT functions | **invariant holds** — traced concretely, not exploitable (see "Checked, no issue") |
| any user bridging ■AKITA cross-chain | base OFT `_credit`/`_debit` independent of wrapper `totalLocked`/`totalMinted` | Per-chain backing/redeemability mismatch | **Finding #1** — the headline finding |
| any depositor/withdrawer | floor-division dust vs. static `NORMALIZATION_FACTOR` | Accumulating dust / normalization drift | **Finding #11** |
| any user | vault's flash-loan delay & large-withdrawal threshold keyed to the shared wrapper address | Cross-user DoS | **Finding #5** (delay), **Finding #10** (large withdrawal) |
| DEX pool operator / owner (address classification) | `setAddressType(s)` timing | Buys through unclassified pools evade fee | Config-trust design limitation, not a code-level exploit — noted in Leads |

---

> ⚠️ This review was performed by an autonomous AI audit pipeline (context-building → breadth checklist agents → depth attacker-mindset agents → hybrid reconciliation). AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. A team security review, bug bounty program, and on-chain monitoring are strongly recommended before mainnet deployment or before increasing TVL, particularly given Finding #1's dependence on the intended multi-chain deployment topology — confirm with the team whether `CreatorOVault`+`CreatorOVaultWrapper` are deployed on more than one chain, as this materially affects Finding #1's real-world reachability.
