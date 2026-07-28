# Interface Contract Audit — Agent* Solidity Interfaces

**Scope.** ABI-only Solidity interfaces in the repository root:

- `IAgentGaugeController.sol`
- `IAgentOVault.sol`
- `IAgentTaxAccountingAdapter.sol`
- `IAgentTokenV4.sol`

**Method.** These are *interface* files: they declare an ABI and the implicit
contract that integrators and implementers must uphold. An interface cannot
enforce access control, input validation, or state invariants, so the findings
below are about (a) **consistency** across and within interfaces and (b)
**dangerous assumptions** the ABI silently bakes in and hands to integrators.
Severities are integration/design-risk severities (Critical/High/Medium/Low/
Informational), reflecting the blast radius if the encoded assumption is not
independently upheld by every implementation and caller.

Because no implementations are in scope, findings are phrased as *contracts that
are unsafe to rely on as written*, not as confirmed exploitable bugs. Each
finding lists a concrete fix. Suggested corrected interfaces are in
`suggested/` (see end of report).

---

## Severity summary

| ID | Title | File | Severity |
|----|-------|------|----------|
| C-1 | Unauthenticated trusted-amount callbacks (`onBuyTax`/`onSellTax`) | TaxAccountingAdapter | Critical |
| C-2 | `receiveFees(amount)` trusts a reported amount with no value transfer | GaugeController | Critical |
| H-1 | Single-step `transferOwnership` on all privileged interfaces | Gauge, OVault, Token | High |
| H-2 | `deposit` has no min-shares / slippage arg (ERC4626 inflation & sandwich) | OVault | High |
| H-3 | `setProtocolRescue` fund-drain escape hatch with no getter/event | OVault | High |
| M-1 | No events on any state-changing setter (except the adapter's one event) | all | Medium |
| M-2 | Setter/getter asymmetry: config can be set but not read back | Gauge, OVault, Token | Medium |
| M-3 | ERC4626 surface is asymmetric (`convertToAssets` w/o `convertToShares`, no `asset()`) | OVault | Medium |
| M-4 | `setModulesOnce` name promises an immutability the ABI cannot guarantee | OVault | Medium |
| M-5 | `distributeTaxTokens()` triggers a swap with no slippage/deadline arg | Token | Medium |
| M-6 | Adapter granularity mismatch: per-side callbacks vs combined `epoch` event; no `epoch()` getter | TaxAccountingAdapter | Medium |
| L-1 | `liquidityPools(index)` array getter with no length accessor | Token | Low |
| L-2 | Dual, possibly-conflicting pool sources of truth (`uniswapV2Pair` vs `liquidityPools`/`isLiquidityPool`) | Token | Low |
| L-3 | `uint16` tax bps admits nonsensical values (> 10000 bps) | Token | Low |
| I-1 | Hard-coded Uniswap-V2 assumption baked into the token interface | Token | Informational |
| I-2 | Floating pragma `^0.8.20`; no explicit `pragma abicoder`/version pin | all | Informational |
| I-3 | Inconsistent NatSpec (`@author` on two files, absent on two) | all | Informational |

---

## Critical

### C-1 — Unauthenticated trusted-amount callbacks (`onBuyTax` / `onSellTax`)

**File.** `IAgentTaxAccountingAdapter.sol`

```solidity
function onBuyTax(address buyer, uint256 amount) external;
function onSellTax(address seller, uint256 amount) external;
```

**Dangerous assumption.** These callbacks are accounting hooks: they report tax
`amount`s that presumably drive `AgentRevenueAccrued` and downstream revenue
distribution. The ABI encodes **no** indication that the caller must be the
paired `agentToken()`. Any integrator wiring this up naively will produce a
contract where *anyone* can call `onBuyTax`/`onSellTax` with an arbitrary
`amount`, inflating accrued revenue (and any pro-rata payout keyed off it) or
grieving epoch accounting. The `amount` is a *reported* number, not a verified
transfer — there is no `msg.value`, no `transferFrom`, and no balance-delta
check possible at the interface level.

**Impact.** Revenue-accounting manipulation / theft or denial, depending on the
implementation's downstream use.

**Fix.**
- Document the caller contract explicitly in NatSpec: *"MUST revert unless
  `msg.sender == agentToken()`"* and mark them as such.
- Prefer a *pull* design that removes the trust: instead of a reported `amount`,
  have the adapter measure a balance delta of a known token it custodies, or
  accept the tax token via `transferFrom`/`msg.value` so the amount is
  self-verifying.
- Add authenticated events so the accrual is observable and the caller is on
  record.

See `suggested/IAgentTaxAccountingAdapter.sol` for the annotated version.

### C-2 — `receiveFees(uint256 amount)` trusts a reported amount with no transfer

**File.** `IAgentGaugeController.sol`

```solidity
function receiveFees(uint256 amount) external;
```

**Dangerous assumption.** The function is not `payable` (so `amount` is not
native ETH) and takes no token address, yet accepts an `amount` parameter. This
is the same trusted-amount anti-pattern as C-1: it assumes an ERC20 transfer of
`amount` happened out-of-band and that the reported `amount` is honest. A caller
can pass any `amount`, decoupling the fee *accounting* from the actual *value
received*. If gauge weight / reward emission is keyed off `receiveFees`, this is
directly manipulable.

**Impact.** Fee/reward accounting inflation or grief.

**Fix.** Make the value self-verifying:
- If native: mark `payable` and use `msg.value` (drop the `amount` arg).
- If ERC20: pull via `transferFrom` inside the function (drop or cross-check
  `amount` against a measured balance delta), and specify *which* token.
- Restrict caller (document `msg.sender` MUST be the fee source), and emit a
  `FeesReceived(token, amount, sender)` event.

---

## High

### H-1 — Single-step `transferOwnership` on every privileged interface

**Files.** `IAgentGaugeController.sol`, `IAgentOVault.sol`, `IAgentTokenV4.sol`
(implied owner-gated setters).

```solidity
function transferOwnership(address newOwner) external;   // Gauge, OVault
```

**Dangerous assumption.** Each of these contracts concentrates far-reaching
powers (`setModulesOnce`, `setProtocolRescue`, `setOracle`, `setTaxAccounting‑
Adapter`, …). A one-shot `transferOwnership` with no `acceptOwnership`
handshake means a single mistyped/zero/contract-without-owner address
permanently bricks or hijacks administration. There is also no `owner()` /
`pendingOwner()` getter, so integrators cannot even verify who holds these
powers.

**Impact.** Irrecoverable loss of admin control or silent takeover.

**Fix.** Adopt the two-step pattern across all admin interfaces:

```solidity
function owner() external view returns (address);
function pendingOwner() external view returns (address);
function transferOwnership(address newOwner) external;   // sets pending
function acceptOwnership() external;                      // pending confirms
event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

(OpenZeppelin `Ownable2Step` is the reference shape.)

### H-2 — `deposit` has no minimum-shares / slippage argument

**File.** `IAgentOVault.sol`

```solidity
function deposit(uint256 assets, address receiver) external returns (uint256 shares);
```

**Dangerous assumption.** This is the bare ERC4626 `deposit` shape, which is
well known to expose depositors to the *share-inflation / donation* attack and
to sandwiching when share price is manipulable. The ABI provides no
`minSharesOut` and no deadline, so every integrator is silently assumed to
implement its own slippage wrapper — most will not.

**Impact.** First-depositor / inflation loss; MEV extraction from depositors.

**Fix.** Offer a slippage-guarded entry point in the interface and document the
inflation-attack mitigation expected of the implementation:

```solidity
function deposit(uint256 assets, address receiver, uint256 minShares) external returns (uint256 shares);
```

At minimum, document that callers MUST bound `shares` and that the
implementation MUST mitigate the empty-vault inflation attack (virtual
shares/assets offset or a dead-shares seed).

### H-3 — `setProtocolRescue` escape hatch with no getter and no event

**File.** `IAgentOVault.sol`

```solidity
function setProtocolRescue(address rescue) external;
```

**Dangerous assumption.** A "protocol rescue" role is, by convention, a
privileged address that can move/sweep vault funds. Exposing a setter for it
with **no** `protocolRescue()` getter and **no** event means the most dangerous
role in the system can be changed invisibly and cannot be independently audited
by integrators or monitoring. Combined with H-1 (single-step ownership) this is
a serious centralization/exfiltration surface.

**Impact.** Silent installation of a fund-draining role.

**Fix.** Add `function protocolRescue() external view returns (address);`,
require a timelock/two-step for changing it (document), and emit
`event ProtocolRescueUpdated(address indexed previous, address indexed next);`.
Consider a per-asset rescue that explicitly *cannot* touch user principal.

---

## Medium

### M-1 — No events on state-changing setters

**Files.** All. Only `IAgentTaxAccountingAdapter` declares an event
(`AgentRevenueAccrued`). Every setter in `IAgentGaugeController`,
`IAgentOVault`, and `IAgentTokenV4` is silent.

**Why it matters.** Off-chain monitoring, indexers, and incident response depend
on events for privileged configuration changes (oracle swaps, module wiring,
whitelist edits, tax-recipient changes, ownership). Silent setters make
governance changes undetectable and are internally inconsistent with the adapter
that *does* emit.

**Fix.** Declare a paired `event XUpdated(...)` for every setter and document
that implementations MUST emit it. Examples:
`OracleUpdated`, `VaultUpdated`, `WhitelistUpdated(account, status)`,
`GaugeControllerUpdated`, `TaxRecipientUpdated`, `TaxAccountingAdapterUpdated`.

### M-2 — Setter/getter asymmetry (config write-only)

**Files.** `IAgentGaugeController` (setVault/setWrapper/setAgentToken/
setLotteryManager/setOracle — **zero** getters), `IAgentOVault`
(setGaugeController/setCcaLaunchArm/setProtocolRescue/setModulesOnce — no
getters), `IAgentTokenV4` (has good getters but no `owner()`).

**Why it matters.** Integrators cannot read back what they just configured, and
cannot verify the wiring of a deployed system through the interface. This is both
a consistency defect (contrast with `IAgentTokenV4`, which pairs most reads with
its role) and an operational hazard.

**Fix.** For each setter, add the matching view (`vault()`, `wrapper()`,
`agentToken()`, `lotteryManager()`, `oracle()`, `gaugeController()`,
`ccaLaunchArm()`, `protocolRescue()`, `owner()`, module getters, whitelist
membership `isWhitelisted(address)`).

### M-3 — Asymmetric / incomplete ERC4626 surface

**File.** `IAgentOVault.sol`

```solidity
function deposit(uint256 assets, address receiver) external returns (uint256 shares);
function convertToAssets(uint256 shares) external view returns (uint256);
```

**Why it matters.** The interface advertises ERC4626-shaped functions but
exposes only one direction of conversion (`convertToAssets` without
`convertToShares`) and omits `asset()`. Without `asset()` an integrator cannot
know which token to `approve` before `deposit` — a dangerous "known out of band"
assumption. Partial ERC4626 also misleads tooling that pattern-matches on the
standard.

**Fix.** Either (a) inherit the full `IERC4626` and add
`asset()`/`totalAssets()`/`convertToShares()`/preview* as needed, or (b) rename
away from ERC4626 vocabulary to signal it is *not* a standard vault. At minimum
add `function asset() external view returns (address);` and
`function convertToShares(uint256 assets) external view returns (uint256);`.

### M-4 — `setModulesOnce` name promises immutability the ABI cannot guarantee

**File.** `IAgentOVault.sol`

```solidity
function setModulesOnce(address coreModule, address strategiesModule, address adminModule) external;
```

**Why it matters.** The `Once` suffix tells integrators the module set is
write-once/immutable — a security property they may rely on when deciding to
trust the vault. The interface cannot enforce this, so a non-conforming
implementation silently violates a promise encoded in the *name*.

**Fix.** Back the promise with observable state so it is verifiable:
add `function modulesLocked() external view returns (bool);` and
`event ModulesLocked(address core, address strategies, address admin);`, and
document that a second call MUST revert. Consider getters
`coreModule()/strategiesModule()/adminModule()`.

### M-5 — `distributeTaxTokens()` swaps with no slippage / deadline

**File.** `IAgentTokenV4.sol`

```solidity
function distributeTaxTokens() external;
```

**Why it matters.** Given `projectTaxPendingSwap()` and the Uniswap-V2 surface,
this almost certainly performs an on-chain swap of accumulated tax. With no
`minOut`/`deadline` parameters and a permissionless-looking signature, it is
sandwichable, and callers cannot bound execution.

**Fix.** Provide a guarded variant
`distributeTaxTokens(uint256 minOut, uint256 deadline)` and/or document that the
implementation enforces an internal max-slippage oracle bound and restricts the
caller (keeper/owner). Emit `TaxDistributed(amountIn, amountOut)`.

### M-6 — Adapter granularity mismatch and missing `epoch()`

**File.** `IAgentTaxAccountingAdapter.sol`

```solidity
event AgentRevenueAccrued(address indexed agentToken, address indexed vault,
    uint256 buyTaxAmount, uint256 sellTaxAmount, uint64 epoch);
function onBuyTax(address buyer, uint256 amount) external;
function onSellTax(address seller, uint256 amount) external;
```

**Why it matters.** Callbacks are **per-side** (buy *or* sell, one amount each),
but the event is **combined** (both amounts + an `epoch`). It is unspecified
when the event fires relative to the callbacks, and `epoch` is a first-class
concept in the event with **no** `epoch()` getter to read the current epoch.
Integrators cannot reconcile the two granularities or align to epoch boundaries.

**Fix.** Add `function currentEpoch() external view returns (uint64);` and
`function accruedRevenue(uint64 epoch) external view returns (uint256 buy, uint256 sell);`.
Document precisely when `AgentRevenueAccrued` is emitted (e.g., once per epoch
roll-over, aggregating the interim `onBuyTax`/`onSellTax` calls).

---

## Low

### L-1 — `liquidityPools(uint256 index)` with no length accessor

**File.** `IAgentTokenV4.sol`

```solidity
function liquidityPools(uint256 index) external view returns (address);
```

**Why it matters.** This is an auto-generated array getter. Without a
`liquidityPoolsLength()` (or a `getLiquidityPools()` that returns the whole
array), integrators cannot safely enumerate — they must probe indices and catch
reverts, which is brittle and error-prone.

**Fix.** Add
`function liquidityPoolsLength() external view returns (uint256);`
or `function getLiquidityPools() external view returns (address[] memory);`.

### L-2 — Dual, possibly-conflicting pool sources of truth

**File.** `IAgentTokenV4.sol`

`uniswapV2Pair()` vs the `liquidityPools(index)` / `isLiquidityPool(account)`
set. It is unspecified whether `uniswapV2Pair()` is always a member of the
`liquidityPools` set, or whether tax logic keys off one or the other.

**Why it matters.** Two overlapping sources of truth invite drift; an integrator
that trusts `uniswapV2Pair()` for tax classification may disagree with the
contract's own `isLiquidityPool` gate.

**Fix.** Document `isLiquidityPool` as the single authoritative predicate and
that `uniswapV2Pair()` MUST satisfy `isLiquidityPool(uniswapV2Pair()) == true`.

### L-3 — `uint16` tax bps admits values above 10000

**File.** `IAgentTokenV4.sol`

```solidity
function buyTaxBps() external view returns (uint16);
function sellTaxBps() external view returns (uint16);
```

**Why it matters.** `uint16` ranges to 65535, i.e. up to 655.35% — the type does
not encode the natural `<= 10000` (100%) invariant. Integrators computing net
amounts as `amount * (10000 - bps) / 10000` will underflow/revert (or wrap in
unchecked blocks) if bps ever exceeds 10000.

**Fix.** Document the invariant `buyTaxBps() <= 10000` (and same for sell) as
part of the contract, and have the implementation's setter enforce it. Consider
exposing a combined `maxTotalTaxBps()`.

---

## Informational

### I-1 — Hard-coded Uniswap-V2 assumption
`IAgentTokenV4` bakes `uniswapV2Pair()` / `pairToken()` into the ABI. On
deployments routing through V3/V4 or a non-Uniswap AMM this naming is misleading
and the assumption is wrong. Consider DEX-neutral naming (`primaryPair()`,
`quoteToken()`) if multi-AMM support is ever intended.

### I-2 — Floating pragma
All files use `pragma solidity ^0.8.20;`. Interfaces commonly float, but pinning
(`pragma solidity 0.8.24;`) or at least documenting the supported band avoids
ABI-encoding surprises across compiler versions.

### I-3 — Inconsistent NatSpec
`IAgentGaugeController` and `IAgentOVault` carry `@author 0xakita.eth`;
`IAgentTaxAccountingAdapter` and `IAgentTokenV4` do not. None document the
critical caller/authentication assumptions (C-1, C-2). Standardize NatSpec and,
crucially, document each privileged function's required `msg.sender`.

---

## Cross-cutting recommendations (priority order)

1. **Eliminate trusted-amount callbacks (C-1, C-2).** Make every value transfer
   self-verifying (`msg.value` or measured `transferFrom` delta) and document the
   authenticated caller. This is the highest-impact class of issue.
2. **Two-step ownership + `owner()` getters everywhere (H-1).**
3. **Add slippage guards to value-moving entry points (H-2, M-5).**
4. **Make privileged roles observable: getters + events for every setter and for
   `protocolRescue`/modules (H-3, M-1, M-2, M-4).**
5. **Tighten standard-shaped surfaces: complete/relabel the ERC4626 surface and
   the adapter epoch surface (M-3, M-6).**
6. **Add enumeration/length accessors and document invariants (L-1, L-2, L-3).**

## Suggested corrected interfaces

Annotated, backward-compatible-where-possible rewrites are provided under
`suggested/`:

- `suggested/IAgentGaugeController.sol`
- `suggested/IAgentOVault.sol`
- `suggested/IAgentTaxAccountingAdapter.sol`
- `suggested/IAgentTokenV4.sol`

The originals are left unmodified. The suggested versions add getters, events,
two-step ownership, slippage-guarded variants, and NatSpec that states each
function's required caller and invariants.
