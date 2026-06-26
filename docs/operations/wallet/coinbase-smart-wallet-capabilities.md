---
title: Coinbase Smart Wallet Capabilities
sidebar_position: 21
---

# Coinbase Smart Wallet Capabilities

> **Canonical reference:** [docs/ACCOUNT_MODEL.md](../ACCOUNT_MODEL.md). Capability inventory below is observational; the product-level decisions about which capabilities we expose to which population are in ACCOUNT_MODEL.md §3 and §5.

Reference snapshot for the Coinbase Smart Wallet / Base App provider behavior observed from the 4626 wallet probe.

This is a capability inventory, not a product architecture change. The canonical 4626 wallet rules still apply: the user's Zora/Base Coinbase Smart Wallet remains the asset-holding account, and signer/sub-account behavior must be interpreted through the execution track in `.cursor/rules/ERC-4337-Wallet-Invariants.mdc`.

## Observed Account

- Account: `0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF`
- Active chain: `0x2105` / Base mainnet (`8453`)
- Observed provider context: Coinbase Smart Wallet / Base App style provider

## Account SDK 2.5.1 E2E Snapshot

Automated E2E run:

- SDK version: `2.5.1`
- SDK source: NPM latest
- Timestamp: `2026-05-05T14:32:47.783Z`
- Total tests: `44`
- Passed: `24`
- Failed: `7`
- Skipped: `13`

The E2E run validated the SDK exports and basic connection path, but several interactive capabilities were rejected or became unauthorized after the provider disconnected. Treat this snapshot as observed runtime behavior, not a definitive unsupported-method list.

### SDK Exports Confirmed

| Export | Status |
| --- | --- |
| `createBaseAccountSDK` | Present |
| `base.pay` | Present |
| `base.subscribe` | Present |
| `base.subscription.getStatus` | Present |
| `base.subscription.prepareCharge` | Present |
| `getPaymentStatus` | Present |
| `TOKENS` | Present |
| `CHAIN_IDS` | Present |
| `VERSION` | Present |
| `encodeProlink` | Present |
| `decodeProlink` | Present |
| `createProlinkUrl` | Present |
| `spendPermission.requestSpendPermission` | Present |
| `spendPermission.fetchPermissions` | Present |

### SDK E2E Connection Results

| Check | Observed result | Notes |
| --- | --- | --- |
| SDK initialization | Passed | Initialized in `8ms`. |
| Connect wallet | Passed | Connected as `0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF`. |
| Get accounts | Passed | Returned `0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF` and `0x888D9755804F68CbC546Ff7b7EaC7bbC93BA914F`. |
| Get chain ID | Passed | Returned `84532` / Base Sepolia. |
| `personal_sign` | Failed with `4100` | Provider reported the requested account and/or method was not authorized by the user. |

### SDK E2E Interactive Results

| Feature | Observed result | Interpretation |
| --- | --- | --- |
| `base.pay()` | Failed with `4001` / request rejected | User/modal rejection, not an export failure. No payment ID was available afterward, so `getPaymentStatus()` was skipped. |
| `base.subscribe()` | Failed with `4001` / request rejected | User/modal rejection, not an export failure. Subscription status and charge-preparation checks were skipped because no subscription ID existed. |
| `encodeProlink()` | Passed | Encoding took `390ms` in the observed run. |
| `decodeProlink()` | Passed | Decoding took `2ms` in the observed run. |
| `createProlinkUrl()` | Passed | URL construction is available. |
| Provider event listeners | Passed | `accountsChanged`, `chainChanged`, and `disconnect` listeners fired/registered successfully. |

### SDK E2E Spend Permissions

The spend-permission export surface was present, but runtime checks were skipped after the test state was no longer connected:

- `spendPermission.requestSpendPermission()`
- `spendPermission.getPermissionStatus()`
- `spendPermission.fetchPermission()`
- `spendPermission.fetchPermissions()`
- `spendPermission.prepareSpendCallData()`
- `spendPermission.prepareRevokeCallData()`

Do not read these skips as capability absence. They indicate the test did not have a connected permission hash state after the earlier interactive failures.

### SDK E2E Sub-account Results

| Method | Observed result | Interpretation |
| --- | --- | --- |
| `wallet_addSubAccount` | Failed with `4100`: must call `eth_requestAccounts` before other methods | Authorization/session ordering issue in the E2E state. |
| `wallet_getSubAccounts` | Failed: no sub-account found in accounts list | No discoverable sub-account was available in the returned accounts. |
| `personal_sign` for sub-account | Failed with `4100`: must call `eth_requestAccounts` before other methods | Authorization/session ordering issue in the E2E state. |
| `wallet_sendCalls` for sub-account | Failed with `4001` / request rejected | User/modal rejection. |

The skipped sign-and-send checks (`eth_signTypedData_v4`, `wallet_sendCalls`, `wallet_prepareCalls`) all reported `Not connected`, which appears downstream of the earlier rejection/disconnect path.

### SDK E2E Follow-up Snapshot

Automated E2E run:

- SDK version: `2.5.1`
- SDK source: NPM latest
- Timestamp: `2026-05-05T14:34:49.708Z`
- Total tests: `14`
- Passed: `7`
- Failed: `6`
- Skipped: `1`

This narrower follow-up run kept the same connected parent account and Base Sepolia chain, but successfully exercised sub-account discovery and typed-data signing.

| Check | Observed result | Interpretation |
| --- | --- | --- |
| Connect wallet | Passed | Connected as `0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF`. |
| Get accounts | Passed | Returned parent account plus sub-account `0x888D9755804F68CbC546Ff7b7EaC7bbC93BA914F`. |
| Get chain ID | Passed | Returned `84532` / Base Sepolia. |
| `personal_sign` | Failed by timeout after `30000ms` | Treat as an unreliable modal/session path in this environment; do not classify as unsupported. |
| `base.pay()` | Failed with `4001` / request rejected | User/modal rejection. |
| `base.subscribe()` | Failed with `4001` / request rejected | User/modal rejection. |
| `spendPermission.requestSpendPermission()` | Failed with `4001` / request rejected | User/modal rejection. |
| `spendPermission.fetchPermissions()` | Passed | Returned `0` permission(s). |
| `wallet_addSubAccount` | Passed | Returned sub-account `0x888D9755804F68CbC546Ff7b7EaC7bbC93BA914F`. |
| `wallet_getSubAccounts` | Passed | Returned sub-account `0x888D9755804F68CbC546Ff7b7EaC7bbC93BA914F`. |
| `wallet_sendCalls` for sub-account | Failed with `4001` / request rejected | User/modal rejection. |
| `eth_signTypedData_v4` | Passed | Returned a Coinbase smart-wallet wrapped signature. |
| `wallet_sendCalls` | Failed with `4001` / request rejected | User/modal rejection. |

Updated read from the two E2E runs together:

- Sub-account support is present when the session ordering is healthy.
- The observed sub-account is `0x888D9755804F68CbC546Ff7b7EaC7bbC93BA914F`.
- `eth_signTypedData_v4` is usable and returns the wrapped Coinbase Smart Wallet signature shape.
- `personal_sign` is inconsistent in this environment: one run returned `4100`, and another timed out after `30s`.
- `4001` failures across pay, subscribe, spend-permission request, and send-calls surfaces are user/modal rejections, not missing exports.
- `spendPermission.fetchPermissions()` can read successfully even when request/creation is rejected; the observed account had `0` permissions.

## Event Listeners

| Event | Observed payload | Notes |
| --- | --- | --- |
| `accountsChanged` | `["0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF"]` | Use to refresh wallet-derived UI state. Do not use this alone to overwrite canonical `profiles.csw_address`. |
| `chainChanged` | `"0x2105"` | Refresh chain-dependent reads and tx builders. |
| `connect` | `{ "chainId": "0x2105" }` | Provider connected on Base mainnet. |
| `disconnect` | no stable payload captured | Treat as session loss; clear transient provider state only. |

## SDK Configuration

| Capability | Status | Notes |
| --- | --- | --- |
| `attribution.auto` | Supported by SDK config | Enables automatic Coinbase attribution when configured. |
| `attribution.dataSuffix` | Supported by SDK config | Accepts a `0x`-prefixed hex suffix used to identify onchain activity. Use only stable, intentionally chosen attribution data. |

## Wallet Connection

| Method | Observed result | 4626 usage notes |
| --- | --- | --- |
| `eth_requestAccounts` | Returns `["0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF"]` | Use for explicit connect flows. |
| `eth_accounts` | Returns `["0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF"]` | Use for passive session inspection. Do not infer execution readiness from account presence alone. |
| `wallet_connect` | Returns account capabilities and supported chain IDs | Can include `signInWithEthereum` capability data and the provider's chain allowlist. Treat SIWE capability as auth context, not wallet execution readiness. |

Observed `wallet_connect` chain IDs:

- `0x14a34` / Base Sepolia (`84532`)
- `0xaa36a7` / Sepolia (`11155111`)
- `0xaa37dc`
- `0x1` / Ethereum mainnet
- `0xa` / Optimism
- `0x38` / BNB Chain
- `0x89` / Polygon
- `0x2105` / Base mainnet
- `0xa4b1` / Arbitrum One
- `0xa86a` / Avalanche C-Chain
- `0x76adf1`
- `0x8f`
- `0x144`
- `0x82`

## Ephemeral / Smart Wallet Methods

| Method | Observed result | 4626 usage notes |
| --- | --- | --- |
| `wallet_sendCalls` | User rejection returned `{ "code": 4001, "message": "Request rejected" }` | Supported surface, but user approval is required. For owner actions, prefer prepared-calls/prolink flows where applicable. |
| `wallet_sign` legacy shape | Can return a smart-wallet wrapped signature for typed spend permission data; can also be rejected with `4001` | This is an ephemeral Coinbase method, not a generic replacement for `personal_sign` or `eth_signTypedData_v4`. |
| `wallet_sign` current shape | Can return the same wrapped signature shape for typed spend permission data; can also be rejected with `4001` | Use only when intentionally exercising Coinbase spend-permission flows. |

The observed spend-permission signing payload used:

- Domain: `Spend Permission Manager`
- Version: `1`
- Chain ID: `8453`
- Verifying contract: `0xf85210B21cC50302F477BA56686d2019dC9b67Ad`
- Primary type: `SpendPermission`
- Account: `0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF`
- Spender: `0xd4e17478581878A967aA22d45a5158A9fE96AA08`
- Token: `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`
- Allowance: `1000000`
- Period: `86400`
- Salt: `0x1`

## Base Profile

| Method | Observed result | Notes |
| --- | --- | --- |
| `experimental_requestInfo` | Returned Base profile name and phone number fields | This is experimental and may expose personal data. Store only what the product explicitly needs. The observed phone number is intentionally omitted from this repo. |

Observed profile shape:

```json
{
  "name": {
    "firstName": "akita",
    "familyName": "4626"
  },
  "phoneNumber": {
    "number": "<redacted>",
    "country": "US"
  }
}
```

## Switch / Add Chain

| Method | Observed result | Notes |
| --- | --- | --- |
| `wallet_switchEthereumChain` | Supported surface; no stable success payload captured | Use for chain correction before transactions. |
| `wallet_addEthereumChain` | User rejection returned `{ "code": 4001, "message": "Request rejected" }` | User approval is required. |
| `wallet_watchAsset` | Supported surface; no stable success payload captured | Can be used to prompt adding assets to wallet UI. |

## Message Signing

> SDK capability snapshot (April 2026). Signer rows reference the **pre-migration** probe CSW; current 4626 canonical CSW is `CANONICAL_CSW_ADDRESS` (`0xAb6d5…967b5`).

| Method | Observed result | 4626 usage notes |
| --- | --- | --- |
| `eth_sign` | Unsupported: `{ "code": 4200, "message": "The requested method is not supported by this Ethereum provider." }` | Do not use. |
| `personal_sign` | Returns smart-wallet wrapped signature; SigUtil verified signer as `0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef` | Useful for wallet proof checks, but remember CSW signatures may be ERC-1271-style wrapped signatures rather than plain EOA signatures. |
| `eth_signTypedData_v1` | User rejection returned `{ "code": 4001, "message": "Request rejected" }` | Avoid unless a specific legacy integration requires it. |
| `eth_signTypedData_v3` | User rejection returned `{ "code": 4001, "message": "Request rejected" }` | Prefer v4 for new typed-data flows. |
| `eth_signTypedData_v4` | Returns smart-wallet wrapped signature; SigUtil verified signer as `0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef` | Preferred typed-data method when typed signing is needed. Verify with smart-wallet/contract-aware logic. |

## Sending Transactions

| Method | Observed result | 4626 usage notes |
| --- | --- | --- |
| `eth_sendTransaction` | Returned tx hash `0x93f048347c1ee5e9168ec353f55495bea717d8ba5e51605cdd6f3b94c1c4d167` | Direct send is available, but 4626 canonical sponsored flows must not silently fall back to direct gas sends when sponsorship is denied. Respect `executionMode` and send-mode routing. |

## Wallet Transaction Status / EIP-5792 Surfaces

| Method | Observed result | Notes |
| --- | --- | --- |
| `wallet_getCapabilities` | Invalid params returned `{ "code": -32602, "message": "Invalid method parameter(s)." }` | Method exists, but callers must send the correct parameter shape. |
| `wallet_getCallsStatus` | Invalid transaction ID returned `{ "code": -32602, "message": "invalid request: transactionId = a" }` | Requires a real calls transaction ID. |
| `wallet_showCallsStatus` | User rejection returned `{ "code": 4001, "message": "Request rejected" }` | User-facing status display can be rejected. |
| `wallet_sendCalls` | User rejection returned `{ "code": 4001, "message": "Request rejected" }` | Same observed behavior as the ephemeral-method section. |

## Read-only JSON-RPC

| Method | Observed result | Notes |
| --- | --- | --- |
| `eth_getBalance` | Returned `0x2226da39599de7` | Standard read. Interpret in wei. |
| `eth_getTransactionCount` | Returned `0x1` | Standard nonce read. |

## Implementation Notes for 4626

- Treat account presence, profile info, and SIWE capability as identity/session signals, not `execution-ready` proof.
- Use parent-CSW asset checks against `profiles.csw_address`; do not promote provider-returned sub-account or counterfactual addresses into canonical custody state.
- For sponsored canonical swaps, keep using the `canonical4337` path where required by the routing table. Do not downgrade to `eth_sendTransaction` just because direct sends are available.
- For owner-add / co-signer actions, prefer the prepared-calls lane (`wallet_prepareCalls` -> sign prepared payload -> `wallet_sendPreparedCalls`) or the existing Base App prolink helpers where applicable.
- Verify signatures with CSW-aware logic. Coinbase Smart Wallet signatures can be contract-wrapped and may require ERC-1271 verification instead of plain `ecrecover`.
- Treat `4001` as a user rejection, not a provider capability failure.
- Treat `4100` as unauthorized account/method or session-ordering failure; reconnect with `eth_requestAccounts` and retry only when user intent is clear.
- Treat `4200` as unsupported method.
- Treat `-32602` as caller parameter error; fix the request shape before assuming the method is unavailable.
- Treat `personal_sign` timeouts separately from rejections. In SDK 2.5.1 E2E, `eth_signTypedData_v4` was more reliable than `personal_sign` for the same connected account context.

## @coinbase/wallet-sdk 4.3.7 — ownership model (2026-05)

The SDK exposes an **EIP-1193 provider** only. There is **no** dedicated `addOwner` SDK method — owner management is an **onchain CSW contract call** the connected Smart Wallet must execute and sign.

| Layer | What it does | 4626 usage |
| --- | --- | --- |
| **Connection** | `createCoinbaseWalletSDK` → `getProvider()` → `eth_requestAccounts` | Waitlist wallet connect; does **not** add owners |
| **Mutation** | Encode `addOwnerAddress(address)` or `addOwnerPublicKey(x,y)`; submit via `wallet_sendCalls` self-call (`to = from = CSW`) | **Method D** (flag-gated, external browser only today) |
| **Cross-chain replay** | Requires `executeWithoutChainIdValidation` / ERC-4337 replay lane | Relay Part 2 solver path (Method A/B) |
| **Sub Account SDK** | `subAccount.addOwner({ address, publicKey, chainId })` convenience wrapper | **Not** waitlist canonical path — parent CSW remains asset holder |

Canonical `wallet_sendCalls` payload (aligned in `frontend/src/lib/wallet/walletSendCallsPayload.ts`):

```json
{
  "version": "2.0.0",
  "from": "<cswAddress>",
  "chainId": "0x2105",
  "atomicRequired": true,
  "calls": [{ "to": "<cswAddress>", "value": "0x0", "data": "<addOwnerAddress calldata>" }]
}
```

Passkey owners use `addOwnerPublicKey(bytes32 x, bytes32 y)` with a 64-byte uncompressed P-256 key split into coordinates — not a secp256k1 EOA public key.

## Direct addOwner feasibility matrix (Phase 0 gate)

Probe CSW: `0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF` (passkey `owner[0]`, session key `owner[2]`).

| Surface | Action | Status (2026-05) | Notes |
| --- | --- | --- | --- |
| Base App WebView (waitlist) | Direct `wallet_sendCalls` → `addOwnerAddress(embeddedEoa)` v2.0.0 + `from` | **Not verified / likely blocked** | [owner-mutation-decision-2026-05.md](../owner-mutation-decision-2026-05.md): third-party dapps hit “Error generating transaction / not enough funds” for owner-mutating selectors. Relay remains **primary** (Method A/B). |
| Base App prolink deep link | Same calldata via `encodeSingleCallSendCallsProlink` | **Reference / manual** | Advanced waitlist recovery; user opens Base App from external browser. |
| External browser + `@coinbase/wallet-sdk@4.3.7` | SDK snippet (`smartWalletOnly`) | **Candidate for Method D** | Gated by `VITE_DIRECT_CSW_ADD_OWNER_SEND_CALLS=1`; falls back to Relay on `direct_add_owner_blocked`. |
| XMTP `walletSendCalls` tx card | `indexer/src/sendAddOwnerTxToSelf.ts` | **Observed working** | Base App approves addOwner when framed as an XMTP tx card; not the waitlist hot path. |
| Relay Part 1 deposit | `wallet_sendCalls` / prepared-calls → `depositNative` | **Verified (golden tx)** | May 2026 block 45600637 — Method A. |
| Relay Part 2 | Solver → `addOwnerAddress` via `executeWithoutChainIdValidation` | **Verified (golden tx)** | Bypasses dapp-initiated privileged selector gate. |

**Go/no-go (2026-05):** Relay replacement on waitlist is **not approved** until Base App WebView direct addOwner is manually verified on the probe CSW. Method D ships behind a flag for external-browser evaluation only.
