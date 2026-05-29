[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/hooks/useCanonicalIdentity

# src/hooks/useCanonicalIdentity

## Type Aliases

### CanonicalIdentity

> **CanonicalIdentity** = `object`

Defined in: [src/hooks/useCanonicalIdentity.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCanonicalIdentity.ts#L44)

Consolidated identity snapshot for the signed-in user. Composes:
  - Privy user state (the human login)
  - wagmi connection (optional external EOA)
  - `/api/accounts/me` → `accountSignals.canonicalCswAddress` (the
    authoritative parent Coinbase Smart Wallet for this profile)
  - SIWE session (confirms auth + as a fallback when `/accounts/me`
    hasn't loaded yet)
  - On-chain read: CreatorRegistry.getTokenForVault(csw) → creator coin addr

Design notes:
  - `cswAddress` is the PARENT CSW — what owns the creator's vault,
    coin, lottery entries, and settles balances. For Privy-native
    flows the SIWE authAddress is the embedded EOA that signed the
    challenge, NOT the CSW; relying on authAddress alone would show
    the wrong address in the identity card (bug seen 2026-04-19).
    We read `profile.accountSignals.canonicalCswAddress` from the
    authoritative server-resolved source instead.
  - `externalEoaAddress` is populated only when wagmi reports a
    non-Privy external wallet as connected. Privy's embedded wallet
    shows up through the Privy SDK, not wagmi.
  - `creatorCoinAddress` is resolved lazily once per CSW via a single
    `getTokenForVault` read against the live `CreatorRegistry`. Cached
    in-memory for the session to avoid re-reading on every render.

#### Properties

##### accountChrome

> **accountChrome**: [`AccountChromeExecution`](../lib/wallet/userExecutionTrack.md#accountchromeexecution)

Defined in: [src/hooks/useCanonicalIdentity.ts:103](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCanonicalIdentity.ts#L103)

Tray / accounts / swap chrome derived from the effective execution lane.

##### activeSigner

> **activeSigner**: `"external"` \| `"embedded"` \| `null`

Defined in: [src/hooks/useCanonicalIdentity.ts:87](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCanonicalIdentity.ts#L87)

Which signer is currently active. Priority:
  - 'external' when an external wagmi connection exists
  - 'embedded' when only Privy is signing
  - null when no session / wallet is active

##### creatorCoinAddress

> **creatorCoinAddress**: `Address` \| `null`

Defined in: [src/hooks/useCanonicalIdentity.ts:93](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCanonicalIdentity.ts#L93)

Creator coin ERC-20 address owned by this CSW's vault, or null if
the CSW has no registered vault yet. Always normalized to checksum
form.

##### cswAddress

> **cswAddress**: `Address` \| `null`

Defined in: [src/hooks/useCanonicalIdentity.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCanonicalIdentity.ts#L46)

The user's Coinbase Smart Wallet — primary identity.

##### cswMissing

> **cswMissing**: `boolean`

Defined in: [src/hooks/useCanonicalIdentity.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCanonicalIdentity.ts#L60)

True when the server confirms the profile is authed but no
`canonicalCswAddress` is linked yet (user signed in but hasn't
completed Zora / Base App setup). The card uses this to prompt
setup instead of leaving an empty CSW row.

##### effectiveExecutionTrack

> **effectiveExecutionTrack**: [`UserFrontendExecutionTrack`](../lib/wallet/userExecutionTrack.md#userfrontendexecutiontrack)

Defined in: [src/hooks/useCanonicalIdentity.ts:101](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCanonicalIdentity.ts#L101)

Effective track after parent-owner promotion over stale sub-account state.

##### embeddedSignerAuthorizedOnCsw

> **embeddedSignerAuthorizedOnCsw**: `boolean` \| `null`

Defined in: [src/hooks/useCanonicalIdentity.ts:80](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCanonicalIdentity.ts#L80)

Whether the embedded signer is already an owner on the canonical CSW.
- true  => embedded signer is authorized for canonical owner actions
- false => embedded signer exists but is not yet authorized
- null  => unknown / not yet resolved from account signals

##### executionSubAccountAddress

> **executionSubAccountAddress**: `Address` \| `null`

Defined in: [src/hooks/useCanonicalIdentity.ts:97](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCanonicalIdentity.ts#L97)

Optional app-scoped execution sub-account when the effective track uses it.

##### executionTrack

> **executionTrack**: [`UserFrontendExecutionTrack`](../lib/wallet/userExecutionTrack.md#userfrontendexecutiontrack) \| `null`

Defined in: [src/hooks/useCanonicalIdentity.ts:99](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCanonicalIdentity.ts#L99)

Server-derived execution track classification (raw from `/api/accounts/me`).

##### externalEoaAddress

> **externalEoaAddress**: `Address` \| `null`

Defined in: [src/hooks/useCanonicalIdentity.ts:71](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCanonicalIdentity.ts#L71)

External EOA (Rabby / MetaMask / injected) if one is actively
connected via wagmi. Null when only the Privy embedded EOA is
signing.

##### hasSession

> **hasSession**: `boolean`

Defined in: [src/hooks/useCanonicalIdentity.ts:65](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCanonicalIdentity.ts#L65)

Whether a SIWE session exists at all. When false the card
should not render.

##### loadingCoin

> **loadingCoin**: `boolean`

Defined in: [src/hooks/useCanonicalIdentity.ts:95](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCanonicalIdentity.ts#L95)

Loading state for async CSW → coin lookup.

##### loadingCsw

> **loadingCsw**: `boolean`

Defined in: [src/hooks/useCanonicalIdentity.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCanonicalIdentity.ts#L53)

True while `/api/accounts/me` is still fetching the profile's
canonical CSW. Useful for rendering a "Linking…" placeholder in
the card instead of falsely showing "not signed in" when the user
is in fact signed in and the CSW just hasn't arrived yet.

##### privyEmbeddedAddress

> **privyEmbeddedAddress**: `Address` \| `null`

Defined in: [src/hooks/useCanonicalIdentity.ts:73](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCanonicalIdentity.ts#L73)

Privy-provisioned embedded EOA, if Privy is authed.

## Functions

### useCanonicalIdentity()

> **useCanonicalIdentity**(): [`CanonicalIdentity`](#canonicalidentity)

Defined in: [src/hooks/useCanonicalIdentity.ts:181](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCanonicalIdentity.ts#L181)

#### Returns

[`CanonicalIdentity`](#canonicalidentity)
