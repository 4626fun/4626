[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/identity/creatorIdentity

# src/lib/identity/creatorIdentity

## Type Aliases

### CreatorIdentityResolution

> **CreatorIdentityResolution** = `object`

Defined in: [src/lib/identity/creatorIdentity.ts:14](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/identity/creatorIdentity.ts#L14)

#### Properties

##### blockingReason

> **blockingReason**: `string` \| `null`

Defined in: [src/lib/identity/creatorIdentity.ts:27](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/identity/creatorIdentity.ts#L27)

Block irreversible actions when true; caller should present UI guidance.

##### canonicalIdentity

> **canonicalIdentity**: `object`

Defined in: [src/lib/identity/creatorIdentity.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/identity/creatorIdentity.ts#L16)

Canonical creator identity wallet (the identity that must not fragment).

###### address

> **address**: `Address` \| `null`

###### source

> **source**: [`CreatorIdentitySource`](#creatoridentitysource)

##### execution

> **execution**: `object`

Defined in: [src/lib/identity/creatorIdentity.ts:21](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/identity/creatorIdentity.ts#L21)

Currently connected wallet/account (execution context for the current session).

###### address

> **address**: `Address` \| `null`

##### hasExistingCreatorCoinIdentity

> **hasExistingCreatorCoinIdentity**: `boolean`

Defined in: [src/lib/identity/creatorIdentity.ts:25](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/identity/creatorIdentity.ts#L25)

Whether we have an existing creator coin identity we should enforce.

##### warnings

> **warnings**: [`CreatorIdentityWarningCode`](#creatoridentitywarningcode)[]

Defined in: [src/lib/identity/creatorIdentity.ts:29](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/identity/creatorIdentity.ts#L29)

Non-blocking warnings to show in UI.

***

### CreatorIdentitySource

> **CreatorIdentitySource** = `"zoraCoinCreatorAddress"` \| `"privySmartWallet"` \| `"connectedWallet"` \| `"unknown"`

Defined in: [src/lib/identity/creatorIdentity.ts:5](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/identity/creatorIdentity.ts#L5)

***

### CreatorIdentityWarningCode

> **CreatorIdentityWarningCode** = `"CONNECTED_WALLET_MISMATCH"`

Defined in: [src/lib/identity/creatorIdentity.ts:11](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/identity/creatorIdentity.ts#L11)

## Functions

### resolveCreatorIdentity()

> **resolveCreatorIdentity**(`params`): [`CreatorIdentityResolution`](#creatoridentityresolution)

Defined in: [src/lib/identity/creatorIdentity.ts:49](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/identity/creatorIdentity.ts#L49)

Resolve canonical creator identity in a way that prevents fragmentation.

Rules (creator-identity safety approach):
- Existing creator coin creator address is the canonical identity.
- Privy smart wallet can execute only when it matches creator/payout for an existing coin.
- If no creator coin exists, never auto-promote Privy/EOA as canonical identity.
- Require an explicit canonical Coinbase Smart Wallet before irreversible deploy actions.

#### Parameters

##### params

###### connectedWallet

`` `0x${string}` `` \| `null`

###### privySmartWallet?

`` `0x${string}` `` \| `null`

###### zoraCoin?

[`ZoraCoin`](../zora/types.md#zoracoin) \| `null`

#### Returns

[`CreatorIdentityResolution`](#creatoridentityresolution)
