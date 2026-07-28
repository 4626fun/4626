# Security Audit — OVault Recovery / Impairment Claims subsystem

**Scope (this subsystem only):**
- `OVaultRecoveryEscrow.sol`
- `OVaultImpairmentClaims.sol`

**Focus areas requested:** recovery accounting, claims correctness, authorization, replay / DoS surfaces.

**Trust model assumed:** `vault` is a trusted contract set by `owner`; `owner` is trusted.
Findings below note where the code relies on that trust *more than its comments claim*, and where
the on-chain logic fails to enforce an invariant it appears to promise.

Severity legend: **Critical** (funds directly stealable by an untrusted party) /
**High** (funds loss / insolvency under realistic conditions or a single trusted-component fault) /
**Medium** (accounting corruption, meaningful loss under specific-but-plausible conditions) /
**Low** / **Informational**.

---

## H-1 (High) — Recovery accounting is decoupled from token custody; per-epoch caps do **not** prevent cross-epoch draining

**Where:** `OVaultRecoveryEscrow.notifyRecovery`, `OVaultRecoveryEscrow.claimRecovery`.

**Issue.** `notifyRecovery` credits liabilities without ever escrowing tokens:

```solidity
function notifyRecovery(address asset, uint256 epochId, uint256 amount) external {
    if (msg.sender != vault) revert Unauthorized();
    recoveredByEpochAsset[epochId][asset] += amount;   // <-- no token pull
}
```

There is **no `transferFrom`/deposit anywhere in the contract** (verified: the escrow never
moves tokens *in*, only *out* via `claimRecovery`). Claims, however, are paid out of the
contract's *single commingled per-asset balance*:

```solidity
IERC20(asset).safeTransfer(receiver, amount);
```

The `FIX C-2` comment states the per-epoch cap prevents "a single epoch's claims [from draining]
recoveries notified for other epochs." **That protection is only enforced on the accounting
numbers, not on the actual tokens.** The cap guarantees
`claimed[epoch][asset] <= recovered[epoch][asset]` per epoch, but it does *not* guarantee the
solvency invariant that actually matters:

```
sum over all epochs of (recovered[e][asset] - claimed[e][asset])  <=  IERC20(asset).balanceOf(escrow)
```

Because funding is out-of-band and per-epoch balances are not segregated, any epoch that is
over-credited relative to the tokens actually deposited for it will be paid from tokens that
belong to *other* epochs — exactly the failure C-2 claims to fix.

**Exploit path (cross-epoch insolvency / drain).**
1. Vault notifies epoch 1: `recovered[1][X] = 100`, and 100 `X` are deposited into the escrow.
2. Vault notifies epoch 2: `recovered[2][X] = 100`, but the matching 100 `X` are **not yet**
   (or never) deposited — e.g. notify-before-fund ordering, a failed/omitted transfer, a
   fee-on-transfer asset delivering < 100, or a rebasing asset that later shrinks.
3. A claim for epoch 2 of 100 passes the accounting check (`claimed=100 <= recovered=100`) and
   `safeTransfer`s 100 `X` — draining the tokens earmarked for epoch 1.
4. Epoch 1 claimants now revert on `safeTransfer` (insolvent). Loss is realized by honest
   epoch-1 holders.

The same primitive turns any over-credit (see H-2) into real cross-epoch loss.

**Remediation.**
- Make funding atomic with notification: `notifyRecovery` should
  `IERC20(asset).safeTransferFrom(msg.sender, address(this), amount)` and credit the
  **measured balance delta** (`balanceAfter - balanceBefore`) to correctly support
  fee-on-transfer / non-standard tokens.
- Alternatively, maintain an explicit `totalLiabilities[asset]` and, in `claimRecovery`,
  require `IERC20(asset).balanceOf(address(this)) >= totalLiabilities[asset]` (or decrement a
  funded-balance counter), so the global solvency invariant is enforced on-chain rather than
  assumed.
- Document explicitly that per-epoch caps are an accounting control only, unless custody is
  segregated.

---

## M-1 (Medium) — `notifyRecovery` is replayable / non-idempotent (double-count)

**Where:** `OVaultRecoveryEscrow.notifyRecovery`.

**Issue.** Notifications are purely additive with no unique recovery identifier and no dedup:

```solidity
recoveredByEpochAsset[epochId][asset] += amount;
```

If the vault forwards recovery events originating from an external source (bridge message,
oracle, keeper, off-chain relay) — or if the vault's own path that calls `notifyRecovery` can
fire more than once for the same underlying recovery — the same economic recovery is credited
multiple times. Over-credited `recovered` then exceeds the tokens actually held, which via **H-1**
becomes a cross-epoch drain / insolvency, not just a cosmetic overstatement.

**Exploit path.** A retried/duplicated recovery notification inflates `recovered[e][X]` to 2×.
Claimants (or the vault paying claimants) withdraw against the inflated figure and drain tokens
belonging to other epochs.

**Remediation.** Key notifications by a unique `recoveryId` (`mapping(bytes32 => bool) processed`)
and reject duplicates, or bind notification to an actual token deposit (H-1 remediation) so a
replay simply fails for lack of tokens.

---

## M-2 (Medium) — Full, mutable trust in `vault` and `owner`; no zero-address checks, no timelock/two-step handover, no events

**Where:** `OVaultRecoveryEscrow.setVault` / `claimRecovery`, `OVaultImpairmentClaims.setVault`.

**Issue.** `owner` can repoint `vault` to an arbitrary address at any time with no zero-address
check, no delay, and no event:

```solidity
function setVault(address vault_) external onlyOwner { vault = vault_; }
```

The `vault` is then fully authorized to move all escrowed funds to an **arbitrary `receiver`**:

```solidity
function claimRecovery(address asset, uint256 epochId, address receiver, uint256 amount) external {
    if (msg.sender != vault) revert Unauthorized();
    ...
    IERC20(asset).safeTransfer(receiver, amount);  // arbitrary receiver
}
```

So a single compromised/malicious `owner` key ⇒ set `vault` to an attacker contract ⇒ drain the
entire escrow (up to the per-epoch recovered caps, which the attacker can also inflate via
`notifyRecovery`) to any address. No timelock or monitoring window mitigates this.

**Remediation.** Two-step vault rotation (`proposeVault`/`acceptVault`) behind a timelock;
zero-address checks; emit events on `setVault`, `notifyRecovery`, `claimRecovery`, and
`mintFromVault` so off-chain monitoring can detect anomalous rotations/claims. Consider making
`receiver` constrained (e.g. must equal a registered payout address) rather than caller-chosen.

---

## L-1 (Low) — Escrow does not support fee-on-transfer / rebasing assets

**Where:** `OVaultRecoveryEscrow` accounting generally.

The accounting assumes `amount` notified == `amount` custodied == `amount` claimable. For
fee-on-transfer tokens the escrow receives less than credited, and for rebasing tokens the held
balance drifts from recorded liabilities; both surface as insolvency via H-1. Either restrict the
asset set to standard ERC-20s (documented + enforced) or credit measured deltas and track
liabilities explicitly.

---

## L-2 (Low) — Missing events across all state-changing functions

Neither contract emits events on `setVault`, `notifyRecovery`, `claimRecovery`, or
`mintFromVault`. This hampers off-chain solvency monitoring, replay detection (M-1), and incident
response. Add indexed events for each.

---

## I-1 (Informational) — `OVaultImpairmentClaims.totalSupply` bookkeeping is fragile

**Where:** `OVaultImpairmentClaims.mintFromVault`, `_update`.

- `_update` permits burns (`to == address(0)`), but there is currently no exposed burn path and
  `totalSupply` is only ever incremented. If a burn path is later added (e.g. inheriting
  `ERC1155Burnable`), `totalSupply` will silently desync because it is not decremented on burn.
- `totalSupply[epochId] += amount` runs **after** `_mint`. `_mint` performs the ERC-1155
  acceptance-check callback (`onERC1155Received`) to `account` *before* `totalSupply` is updated,
  so any reentrant read observes a stale `totalSupply`. Only `vault` can reach `mintFromVault`, so
  this is not currently exploitable, but prefer OZ's `ERC1155Supply` extension (which updates
  supply inside `_update`, before external callbacks) instead of a hand-rolled counter.

**Note (positive):** The non-transferability control in `_update`
(`if (from != address(0) && to != address(0)) revert ClaimTransferDisabled();`) correctly covers
both single and batch transfers (OZ v5 routes both through `_update`) while allowing mint/burn.
No bypass identified.

---

## Summary table

| ID  | Severity | Area                     | One-line                                                                 |
|-----|----------|--------------------------|--------------------------------------------------------------------------|
| H-1 | High     | Recovery accounting      | Custody decoupled from accounting; per-epoch caps don't stop cross-epoch drain |
| M-1 | Medium   | Replay                   | `notifyRecovery` non-idempotent → double-count → insolvency via H-1      |
| M-2 | Medium   | Authorization            | Mutable `vault`/`owner`, arbitrary `receiver`, no zero-check/timelock/events |
| L-1 | Low      | Recovery accounting      | Fee-on-transfer / rebasing assets break solvency assumption             |
| L-2 | Low      | Observability            | No events on state-changing functions                                    |
| I-1 | Info     | Claims correctness       | `totalSupply` desync-on-burn risk; updated after mint callback          |

The two central themes: (1) the escrow enforces its per-epoch caps on *numbers* but never on
*tokens*, so the "C-2" isolation guarantee is not real without atomic funding or a global
solvency check (H-1, amplified by M-1/L-1); and (2) trust in `vault`/`owner` is broader and more
abruptly mutable than the code's guarding suggests (M-2).
