# H-06 (4626-438): SolanaBridgeStrategy.bridgeToSolana void return

**Status:** Acceptance — fix shipped
**Finding:** H-06
**Linear:** [4626-438](https://linear.app/4626fun/issue/4626-438) (sub-ticket of meta [4626-422](https://linear.app/4626fun/issue/4626-422))
**Severity:** High (pre-merge blocker per GitHub issue [#347](https://github.com/wenakita/4626/issues/347))
**Files:**
- `contracts/vault/strategies/SolanaBridgeStrategy.sol`
- `contracts/utilities/bridge/SolanaBridgeAdapter.sol`

**Scope affected:**
- `ISolanaBridgeAdapter.bridgeToSolana(...)` interface declaration (Strategy file L13-L22)
- `SolanaBridgeStrategy.bridgeToSolana(uint256)` call site (L140)
- `SolanaBridgeAdapter.bridgeToSolana(address,uint256,bytes32)` public entry (L286)

## Problem

The Strategy's local `ISolanaBridgeAdapter` interface declared `bridgeToSolana` with a `void` return. The strategy called the adapter and treated any non-reverting return as success. Solidity high-level calls bubble up reverts, so the *current* adapter implementation still makes this safe — the inner `IBaseSolanaBridge.bridgeToken` reverts on failure. But the interface was weaker than the contract surface it modelled, which creates two concrete risks:

1. **Future adapter variants.** A later upgrade could introduce a non-reverting failure branch (e.g. return-early on a sanity check, swallow an inner call with `try/catch`, add a soft-fail retry path). The strategy's interface gave no way to reject this, so any such adapter change would silently make the strategy emit `BridgedToSolana` without actually bridging.
2. **Defense-in-depth convergence.** H-14 already added a post-call balance check (`BridgeCallNotConsumed`) that catches the no-op case. But a failing adapter could still move tokens to the correct vault-level recipient via an attacker-controlled fallback path that drains and then emits nothing. Having an explicit `bool` from the adapter itself means the success signal comes from the adapter's own positive acknowledgement, not just the observable side-effects.

The audit fix description specified both the interface change (`returns (bool)`) and the call-site revert on `false`. Pre-merge verification on commit `5288ac1` confirmed neither was applied.

## Fix

### `SolanaBridgeAdapter.sol`

Public entry point `bridgeToSolana(address,uint256,bytes32)` now returns `bool success`:

```solidity
function bridgeToSolana(address token, uint256 amount, bytes32 solanaDestination)
    external
    payable
    nonReentrant
    returns (bool success)
{
    _bridgeToSolanaNoIxs(token, amount, solanaDestination);
    return true;
}
```

Reaching the `return` is proof of success because `_bridgeToSolanaNoIxs` eventually calls `IBaseSolanaBridge.bridgeToken`, which reverts on failure. The explicit `true` exists so callers can enforce a positive acknowledgement at the interface boundary rather than relying on revert-only semantics.

The `bridgeToSolanaWithIxs` overload and the `bridgeSOLToSolana` / `depositFromSolana` / CCA surfaces are out of scope for H-06 — they have different callers and different fix profiles (H-06 specifically addresses the path used by `SolanaBridgeStrategy`). If the pattern is valuable for the ixs variant it should land as a follow-up.

### `SolanaBridgeStrategy.sol`

1. Interface declaration updated to match: `returns (bool success)`.
2. New error `BridgeAdapterReportedFailure()`.
3. Call site captures the bool and reverts:

```solidity
bool success = ISolanaBridgeAdapter(bridgeAdapter).bridgeToSolana{value: msg.value}(
    address(ASSET),
    amount,
    solanaDestination
);
if (!success) revert BridgeAdapterReportedFailure();
```

The existing H-14 post-call balance check (`BridgeCallNotConsumed`) stays as a second, independent success signal. Together they form a two-of-two gate: the adapter must (a) self-acknowledge success **and** (b) actually have moved the approved tokens.

## Tests

New file: `test/vault/strategies/SolanaBridgeStrategy.BridgeReturn.t.sol`.

Three adapter mocks cover the cases:

| Mock | Returns | Consumes tokens | Expected strategy outcome |
|---|---|---|---|
| `HappyAdapter` | `true` | yes | success |
| `FalseReturningAdapter` | `false` | yes | revert `BridgeAdapterReportedFailure` |
| `NoopAdapter` | `true` | no | revert `BridgeCallNotConsumed(10e18, 0)` |

`FalseReturningAdapter` deliberately consumes tokens so the H-14 balance check would pass — this isolates the H-06 bool as the only remaining guard. `NoopAdapter` deliberately returns `true` but no-ops so the H-14 balance check is isolated as the only remaining guard. Together they prove both guards are load-bearing.

## Downstream impact

- No on-chain callers of `SolanaBridgeStrategy.bridgeToSolana(uint256)` outside owner tooling (owner-only via `onlyOwner`), so ABI-level consumers are the owner's ops scripts only.
- The adapter's ABI now includes a `bool` return on `bridgeToSolana`. Off-chain consumers that decoded an empty return will still decode `0x01` (32-byte ABI-encoded `true`) safely — old decoders ignore the extra bytes. Any consumer that *asserted* empty return-data must be updated; the only known caller is `SolanaBridgeStrategy` itself, which is updated in the same commit.
- The existing `test_bridgeToSolana_revertsOnDust` test continues to compile because Solidity tolerates discarded return values on external calls.

## Refs

- Linear: 4626-438 (fix), 4626-422 (meta).
- GitHub: issue [#347](https://github.com/wenakita/4626/issues/347) (pre-merge blocker rollup).
- Related on-chain defense: H-14 post-call balance check already on `main` (`BridgeCallNotConsumed`).
- PR: this PR.
