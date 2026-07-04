# OVault Ecosystem Flavors — Adding a New One

Status: authoritative for the vault accounting seam introduced 2026-07 (AgentOVault slice).
Scope: `contracts/vault/CreatorOVault.sol`, `contracts/vault/AgentOVault.sol`,
`contracts/vault/modules/CreatorOVaultCoreModule.sol`, `contracts/vault/modules/AgentOVaultCoreModule.sol`.

## The pattern

One vault subclass + one core-module subclass per ecosystem. Everything else is shared.

| Flavor | Vault | Core module | `moduleKind()` | Accounting mode |
| --- | --- | --- | --- | --- |
| Creator | `CreatorOVault` | `CreatorOVaultCoreModule` | `keccak256("CreatorOVaultModule.core")` | Exact-transfer (reverts on FoT mismatch) |
| Agent | `AgentOVault` | `AgentOVaultCoreModule` | `keccak256("AgentOVaultModule.core")` | Measured-transfer on deposit |

Wiring safety: `setModulesOnce` validates the core module's `moduleKind()` against the
vault's `_expectedCoreModuleKind()`. Each flavor can only load its own accounting mode;
cross-wiring reverts with `InvalidModuleAddress` (tested in both directions in
`test/AgentOVault.TransferAccounting.t.sol`).

## Recipe for ecosystem N

1. New vault (~10 lines): subclass `CreatorOVault`, override `_expectedCoreModuleKind()`
   to return a NEW unique kind (`keccak256("<Flavor>OVaultModule.core")`).
2. New core module: subclass `CreatorOVaultCoreModule` (or `AgentOVaultCoreModule` if the
   token is AgentTokenV4-like), override `moduleKind()` and whichever flow functions need
   a different accounting policy. If a function you need is not `virtual` yet, add the
   keyword to the base — keyword-only edits, no logic changes to the base implementation.
3. Reuse `CreatorOVaultStrategiesModule` and `CreatorOVaultAdminModule` unchanged.
4. Mirror the test shape of `test/AgentOVault.TransferAccounting.t.sol`: cross-wiring
   rejection both directions, inflow accounting from measured/actual amounts, first-deposit
   minimum semantics, explicit outflow policy tests.

## Hard constraints (violating these is a P0)

1. **Module storage is shared and append-only.** All modules delegatecall against
   `CreatorOVaultModuleStorage` (v3). A flavor module must NOT declare storage variables.
   New per-flavor state goes in the vault subclass (slots append after `CreatorOVault`'s),
   or waits for the namespacing RFC (`docs/research/ovault-storage-namespacing-rfc.md`).
2. **Module kinds must be globally unique per flavor.** The kind string is the only thing
   preventing an exact-transfer vault from silently running measured-transfer accounting.
3. **The base `CreatorOVaultCoreModule` stays exact-transfer.** Do not relax
   `_pullCreatorCoinExact` / `_pushCreatorCoinExact`. Measured behavior belongs in
   subclass overrides only.
4. **Rebasing tokens are out of scope for this seam.** The tracked-`coinBalance` model
   (donation-attack fix L-06) assumes balances only move on vault-initiated transfers.
   A balance that drifts at rest breaks `totalAssets()` in every flavor. Supporting
   rebasing is a new accounting model, not a new flavor.

## Known limitations to revisit per flavor

- `MINIMUM_FIRST_DEPOSIT` (50M e18) and the virtual-offset math (decimals offset = 3,
  duplicated as `1000`/`1` in vault + modules) assume 18-decimal, ~1B-supply tokens.
  Different token economics → make these virtual at that point, not before.
- On `AgentOVault`, `mint()` intentionally reverts for taxed tokens, and
  `previewDeposit`/`maxDeposit` quote nominal amounts (actual shares come from post-tax
  receipt). If preview parity is ever needed, it is a deliberate ERC-4626 spec decision,
  not a bug fix.
- Outflow policy: vault-side debit is exact; receiver bears any outbound tax outside
  vault custody; sender-side-tax tokens fail closed with `TransferAmountMismatch`.

## When to refactor (rule of three)

At the third flavor, extract the deposit body into a shared internal template in the base
module with a virtual `_pullAssets(...) returns (uint256 credited)` hook, then shrink each
flavor to its hook + kind. Do not build that abstraction (or a runtime accounting-mode
flag) earlier — subclassing keeps the accounting mode a compile-time guarantee.
