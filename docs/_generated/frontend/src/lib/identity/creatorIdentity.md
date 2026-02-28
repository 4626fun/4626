[**4626-miniapp**](../../../index.md)

***

[4626-miniapp](../../../index.md) / src/lib/identity/creatorIdentity

# src/lib/identity/creatorIdentity

## Type Aliases

### CreatorIdentityResolution

> **CreatorIdentityResolution** = `object`

Defined in: [lib/identity/creatorIdentity.ts:18](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/identity/creatorIdentity.ts#L18)

#### Properties

##### blockingReason

> **blockingReason**: `string` \| `null`

Defined in: [lib/identity/creatorIdentity.ts:31](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/identity/creatorIdentity.ts#L31)

Block irreversible actions when true; caller should present UI guidance.

##### canonicalIdentity

> **canonicalIdentity**: `object`

Defined in: [lib/identity/creatorIdentity.ts:20](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/identity/creatorIdentity.ts#L20)

Canonical creator identity wallet (the identity that must not fragment).

###### address

> **address**: `Address` \| `null`

###### source

> **source**: [`CreatorIdentitySource`](#creatoridentitysource)

##### execution

> **execution**: `object`

Defined in: [lib/identity/creatorIdentity.ts:25](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/identity/creatorIdentity.ts#L25)

Currently connected wallet/account (execution context for the current session).

###### address

> **address**: `Address` \| `null`

##### hasExistingCreatorCoinIdentity

> **hasExistingCreatorCoinIdentity**: `boolean`

Defined in: [lib/identity/creatorIdentity.ts:29](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/identity/creatorIdentity.ts#L29)

Whether we have an existing creator coin identity we should enforce.

##### warnings

> **warnings**: [`CreatorIdentityWarningCode`](#creatoridentitywarningcode)[]

Defined in: [lib/identity/creatorIdentity.ts:33](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/identity/creatorIdentity.ts#L33)

Non-blocking warnings to show in UI.

***

### CreatorIdentitySource

> **CreatorIdentitySource** = `"zoraCoinCreatorAddress"` \| `"privySmartWallet"` \| `"farcasterCustody"` \| `"zoraProfilePublicWallet"` \| `"connectedWallet"` \| `"unknown"`

Defined in: [lib/identity/creatorIdentity.ts:5](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/identity/creatorIdentity.ts#L5)

***

### CreatorIdentityWarningCode

> **CreatorIdentityWarningCode** = `"CUSTODY_MISMATCH"` \| `"CONNECTED_WALLET_MISMATCH"` \| `"CUSTODY_UNAVAILABLE"`

Defined in: [lib/identity/creatorIdentity.ts:13](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/identity/creatorIdentity.ts#L13)

## Functions

### resolveCreatorIdentity()

> **resolveCreatorIdentity**(`params`): [`CreatorIdentityResolution`](#creatoridentityresolution)

Defined in: [lib/identity/creatorIdentity.ts:53](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/identity/creatorIdentity.ts#L53)

Resolve canonical creator identity in a way that prevents fragmentation.

Rules (Privy-first approach):
- If Privy smart wallet is available and matches the creator coin's creator address, use it (no blocking).
- If a creator coin exists and Privy smart wallet doesn't match, block (wrong account).
- If no creator coin exists, use Privy smart wallet as the canonical identity for new deployments.
- Fallback to connected wallet only if Privy is unavailable.

#### Parameters

##### params

###### connectedWallet

`` `0x${string}` `` \| `null`

###### farcasterCustodyAddress?

`` `0x${string}` `` \| `null`

###### farcasterZoraProfile?

[`ZoraProfile`](../zora/types.md#zoraprofile) \| `null`

###### privySmartWallet?

`` `0x${string}` `` \| `null`

###### zoraCoin?

[`ZoraCoin`](../zora/types.md#zoracoin) \| `null`

#### Returns

[`CreatorIdentityResolution`](#creatoridentityresolution)
