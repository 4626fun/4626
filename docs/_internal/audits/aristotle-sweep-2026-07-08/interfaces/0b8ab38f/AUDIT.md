# Creator interfaces — ABI-consistency & dangerous-assumption audit

Scope: `ICreatorGaugeController.sol`, `ICreatorOVault.sol`.

The machine-checked results live in `RequestProject/Keccak.lean` (a verified
EVM `keccak-256` + Solidity selector engine) and `RequestProject/Audit.lean`
(the collision-freedom theorems). Every computational claim below is proved in
Lean and depends only on the standard axioms (`propext`, `Quot.sound`,
`Classical.choice`) plus `Lean.ofReduceBool` / `Lean.trustCompiler` (used by
`native_decide`).

## Method

Solidity dispatches an external call on `bytes4(keccak256(canonical_signature))`.
Two *distinct* signatures sharing a selector are indistinguishable to the ABI
dispatcher — the canonical "ABI consistency" bug. We:

1. Implemented `keccak-256` exactly as the EVM uses it (Keccak `pad10*1`
   padding with domain byte `0x01`, rate 1088 bits).
2. **Validated** it against published digests (`keccak256("")`,
   `keccak256("abc")`) and against three canonical selectors
   (`transferOwnership(address)=0xf2fde38b`, `deposit(uint256,address)=0x6e553f65`,
   `convertToAssets(uint256)=0x07a2d13a`). See `ABIKeccak.keccak_empty`,
   `keccak_abc`, `sel_transferOwnership`, `sel_deposit`, `sel_convertToAssets`.
3. Computed and recorded every selector, then proved collision-freedom.

## Computed selectors

`ICreatorGaugeController`:

| function | selector |
|---|---|
| `setVault(address)` | `0x6817031b` |
| `setWrapper(address)` | `0xc2167d93` |
| `setCreatorCoin(address)` | `0x62ca8bb3` |
| `setLotteryManager(address)` | `0xb98346f2` |
| `setOracle(address)` | `0x7adbf973` |
| `transferOwnership(address)` | `0xf2fde38b` |
| `receiveFees(uint256)` | `0x0420592e` |

`ICreatorOVault`:

| function | selector |
|---|---|
| `deposit(uint256,address)` | `0x6e553f65` |
| `setModulesOnce(address,address,address)` | `0x402e1c9c` |
| `setGaugeController(address)` | `0x0091d2b8` |
| `setCcaLaunchArm(address)` | `0xc98e26d9` |
| `setWhitelist(address,bool)` | `0x53d6fd59` |
| `setProtocolRescue(address)` | `0xa6bb16c6` |
| `transferOwnership(address)` | `0xf2fde38b` |
| `convertToAssets(uint256)` | `0x07a2d13a` |

## ABI-consistency findings (formally proved — all clear)

- **No intra-interface selector collisions**: `gauge_selectors_nodup`,
  `vault_selectors_nodup`.
- **Selector is injective on each interface** (distinct signatures ⇒ distinct
  selectors): `gauge_selector_injective`, `vault_selector_injective`.
- **Cross-interface**: the *only* shared selector is the identical signature
  `transferOwnership(address)` — an intentional, consistent overlap, never an
  accidental clash between two different functions: `cross_selector_injective`,
  `all_selector_injective`.
- **Composition-safe**: after de-duplicating signatures, the union of both
  interfaces still has pairwise-distinct selectors, so a single contract / proxy
  / diamond implementing both has a well-defined ABI: `combined_selectors_nodup`.
- **Standard-tooling compatibility**: `deposit` and `convertToAssets` carry the
  exact canonical ERC-4626 selectors, and `transferOwnership` the exact OZ
  `Ownable` selector: `deposit_is_erc4626`, `convertToAssets_is_erc4626`,
  `transferOwnership_is_canonical`.

Conclusion: **no selector-collision ABI bug exists** in or between these two
interfaces.

## Dangerous-assumption findings (semantic — not enforceable at the ABI level)

These cannot be discharged as Lean theorems because they concern runtime
semantics an interface cannot express; they are recorded as review notes.

1. **`ICreatorOVault.setModulesOnce(...)`** — the `Once` in the name asserts
   one-time / immutable module wiring, but the interface cannot enforce it.
   Callers that assume module addresses are frozen after the first call are
   relying on the *implementation* to guard re-entry. Verify the implementation
   reverts on a second call.

2. **`ICreatorGaugeController.receiveFees(uint256 amount)`** — the fee amount is
   supplied as a parameter rather than derived from an actual measured token
   transfer. This trusts the caller to pass a truthful `amount` consistent with
   tokens really received; a mismatched value can desynchronise fee accounting.

3. **Partial ERC-4626 surface (`ICreatorOVault`)** — `deposit` /
   `convertToAssets` are selector-compatible with ERC-4626, but the interface
   omits the rest of the standard (`asset()`, `totalAssets()`, `previewDeposit`,
   `maxDeposit`, `withdraw`, `redeem`, and the standard events). Integrators that
   assume a *full* ERC-4626 vault from these two selectors will break. Treat this
   as a partial/minimal interface, not a conformant ERC-4626 vault.

4. **Single-step ownership** — both interfaces expose the canonical OZ
   `transferOwnership(address)` (0xf2fde38b) with no two-step handover and no
   zero-address guard expressed at the interface level; an incorrect argument
   can irrecoverably transfer (or, if the implementation permits `address(0)`,
   renounce) ownership. Confirm the implementation's guards / consider
   `Ownable2Step`.

5. **Write-only privileged setters, no getters/events at the interface** — all
   `set*` functions and `setWhitelist` / `setProtocolRescue` are privileged
   configuration writes with no accompanying getters or events in the interface.
   Off-chain consumers cannot read back configuration through this ABI and must
   rely on implementation-side events. Access control is likewise an
   implementation concern the interface cannot state.

None of items 1–5 is an ABI-consistency defect; they are assumptions to confirm
against the contract implementations.
