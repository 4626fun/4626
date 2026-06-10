---
title: Sponsored Canonical Swap Pattern
sidebar_position: 6
---

# Sponsored Canonical Swap Pattern

> **Canonical reference:** [docs/ACCOUNT_MODEL.md](../ACCOUNT_MODEL.md). This pattern is one execution lane; the canonical doc covers the full population/track matrix.

This is the known-good path for gas-sponsored canonical swaps when the browser signer is the Privy embedded EOA and the user's canonical Coinbase Smart Wallet (CSW) is the asset-holding account.

This path is first-class, not merely a fallback from sub-accounts. The sub-account is not involved unless a route explicitly opts into the sub-account provider and shows that sender in diagnostics.

## Preflight

Before executing a sponsored canonical swap, confirm:

1. `executionMode` is canonical and `selectedSendMode` resolves to `canonical4337`.
2. The Privy embedded EOA is an owner on the canonical CSW.
3. Sell-token balance is present on the canonical CSW (not an external EOA snapshot).
4. Route shape is wrap/approve/swap for native ETH sells (router native value remains `0`).
5. Paymaster lane is available and not returning trust/policy denials.

## Working Shape

The successful submit path is:

```text
selectedSendMode: canonical4337
method: eth_sendUserOperation
sender / execution: canonical CSW
signer: Privy embedded EOA that is an owner on the CSW
paymaster: CDP paymaster through the 4626 paymaster proxy
direct fallback: disabled
sub-account: not involved
```

The transaction calls are batched into one UserOperation:

1. `WETH.deposit()` with the native ETH amount.
2. `WETH.approve(Uniswap swap proxy, amount or max)`.
3. Uniswap swap proxy `execute(address,address,uint256,bytes,bytes[],uint256)`.

The Uniswap swap proxy selector is `0x2894adf9`, and the Base swap proxy address used by the Uniswap SDK is:

```text
0x02E5be68D46DAc0B524905bfF209cf47EE6dB2a9
```

The paymaster validator must allow this exact proxy shape, while still rejecting arbitrary native-value router calls. Native ETH enters only through `WETH.deposit()`; the router/proxy call itself must have zero native value.

## Example

Known-good example:

- AA/UserOperation hash: `0x1fec8c44d2bbfc332df5eaf4a44a4ea0afa88a75b3c898e0324702e2a4b0a96e`
- Bundle transaction hash: `0x26863d2e0451ea23b0c9a515cfadabb51b37ca53d75efd517b98a224e83581a2`
- EntryPoint: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`

In that operation:

- The canonical CSW is the ERC-4337 `sender`, the WETH depositor, the approval owner, the WETH source, and the USDC recipient.
- The Privy embedded EOA signs the UserOperation off-chain as a CSW owner. It is not the on-chain token owner.
- The connected external EOA is only the selected/fallback UI identity. It does not sign or execute this canonical path.
- The CDP paymaster sponsors gas through EntryPoint.
- Uniswap's swap proxy is approved to move WETH and routes into Universal Router / V4 Pool Manager.

## Execute

Submit exactly one `eth_sendUserOperation` containing:

1. `WETH.deposit()`
2. `WETH.approve(...)`
3. Swap proxy `execute(...)`

Do not switch to direct gas-send fallback for canonical sponsorship-denied flows.

## Debug Checklist

A healthy debug panel should show:

```text
mode=canonical4337
method=eth_sendUserOperation
canonicalSignerReady=yes
canonicalSignerGate=ok
allowanceWallet=<canonical CSW>
approval sender=<canonical CSW>
swap sender=<canonical CSW>
sender match=yes
last error=--
```

If sponsorship fails with `missing_primary_call`, check that the paymaster allowlist recognizes the actual swap target and selector. For Uniswap Trading API routes, the target can be the swap proxy (`0x02E5...B2a9`) rather than the Universal Router directly.

If sponsorship fails with a native-value router error, keep the route as WETH-backed: wrap with `WETH.deposit()` inside the UserOperation and send zero native value to the swap proxy/router.

## Verify

Post-submit verification:

1. UserOperation hash resolves to a bundled transaction hash.
2. Bundle tx shows canonical CSW as sender and token owner transitions.
3. Swap completion notice includes a working Basescan link.
4. Debug panel remains consistent with canonical sender/allowance wallet identity.

Known-good output pattern:

```text
mode=canonical4337
method=eth_sendUserOperation
sender match=yes
last error=--
```

## Rollback / Safe Abort

If preflight or execute checks fail:

1. Abort before submit (do not submit unsponsored canonical direct fallback).
2. Keep user on canonical lane and surface explicit remediation (owner install, balance, paymaster availability).
3. Retry only after preflight state changes (ownership, balance, or policy).
