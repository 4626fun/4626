[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/uniswap/canonicalSignerGate

# src/lib/uniswap/canonicalSignerGate

## Type Aliases

### CanonicalAuthStatus

> **CanonicalAuthStatus** = `"authenticated"` \| `"unauthenticated"` \| `"unknown"`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L7)

***

### CanonicalOwnerCheckStatus

> **CanonicalOwnerCheckStatus** = `"owner"` \| `"not-owner"` \| `"pending"` \| `"unknown"`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L6)

***

### CanonicalPrivyClientStatus

> **CanonicalPrivyClientStatus** = `"disabled"` \| `"loading"` \| `"ready"`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L8)

***

### CanonicalSignerGateInput

> **CanonicalSignerGateInput** = `object`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L10)

#### Properties

##### authStatus?

> `optional` **authStatus**: [`CanonicalAuthStatus`](#canonicalauthstatus)

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L17)

##### baseSubAccountAddress?

> `optional` **baseSubAccountAddress**: `string` \| `null`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L14)

##### canonicalAddress

> **canonicalAddress**: `string` \| `null`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L13)

##### clientStatus?

> `optional` **clientStatus**: [`CanonicalPrivyClientStatus`](#canonicalprivyclientstatus)

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L16)

##### embeddedWalletAddress

> **embeddedWalletAddress**: `string` \| `null`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L19)

##### embeddedWalletCanSign

> **embeddedWalletCanSign**: `boolean`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L20)

##### embeddedWalletDetected

> **embeddedWalletDetected**: `boolean`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L18)

##### executionMode

> **executionMode**: [`WalletMode`](walletMode.md#walletmode)

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L11)

##### executionTrack?

> `optional` **executionTrack**: [`UserExecutionTrack`](../tx/txRouter.md#userexecutiontrack) \| `null`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L12)

##### ownerCheckStatus

> **ownerCheckStatus**: [`CanonicalOwnerCheckStatus`](#canonicalownercheckstatus)

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L21)

##### subAccountProviderReady?

> `optional` **subAccountProviderReady**: `boolean`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L15)

***

### CanonicalSignerGateResult

> **CanonicalSignerGateResult** = `object`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L24)

#### Properties

##### code

> **code**: `"not-required"` \| `"privy-client-disabled"` \| `"privy-auth-loading"` \| `"privy-auth-required"` \| `"missing-canonical-address"` \| `"base-sub-account-missing"` \| `"base-sub-account-invalid"` \| `"base-sub-account-provider-missing"` \| `"execution-setup-required"` \| `"embedded-wallet-missing"` \| `"embedded-wallet-address-invalid"` \| `"embedded-wallet-cannot-sign"` \| `"owner-check-pending"` \| `"embedded-wallet-not-owner"` \| `"ok"`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L27)

##### ready

> **ready**: `boolean`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L26)

##### reason

> **reason**: `string` \| `null`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L43)

##### required

> **required**: `boolean`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L25)

## Functions

### evaluateCanonicalSignerGate()

> **evaluateCanonicalSignerGate**(`input`): [`CanonicalSignerGateResult`](#canonicalsignergateresult)

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:62](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/canonicalSignerGate.ts#L62)

#### Parameters

##### input

[`CanonicalSignerGateInput`](#canonicalsignergateinput)

#### Returns

[`CanonicalSignerGateResult`](#canonicalsignergateresult)
