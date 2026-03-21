[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/uniswap/canonicalSignerGate

# src/lib/uniswap/canonicalSignerGate

## Type Aliases

### CanonicalAuthStatus

> **CanonicalAuthStatus** = `"authenticated"` \| `"unauthenticated"` \| `"unknown"`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:6](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L6)

***

### CanonicalOwnerCheckStatus

> **CanonicalOwnerCheckStatus** = `"owner"` \| `"not-owner"` \| `"pending"` \| `"unknown"`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:5](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L5)

***

### CanonicalPrivyClientStatus

> **CanonicalPrivyClientStatus** = `"disabled"` \| `"loading"` \| `"ready"`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:7](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L7)

***

### CanonicalSignerGateInput

> **CanonicalSignerGateInput** = `object`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:9](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L9)

#### Properties

##### authStatus?

> `optional` **authStatus**: [`CanonicalAuthStatus`](#canonicalauthstatus)

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:13](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L13)

##### canonicalAddress

> **canonicalAddress**: `string` \| `null`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:11](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L11)

##### clientStatus?

> `optional` **clientStatus**: [`CanonicalPrivyClientStatus`](#canonicalprivyclientstatus)

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:12](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L12)

##### embeddedWalletAddress

> **embeddedWalletAddress**: `string` \| `null`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:15](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L15)

##### embeddedWalletCanSign

> **embeddedWalletCanSign**: `boolean`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:16](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L16)

##### embeddedWalletDetected

> **embeddedWalletDetected**: `boolean`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:14](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L14)

##### executionMode

> **executionMode**: [`WalletMode`](walletMode.md#walletmode)

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:10](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L10)

##### ownerCheckStatus

> **ownerCheckStatus**: [`CanonicalOwnerCheckStatus`](#canonicalownercheckstatus)

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:17](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L17)

***

### CanonicalSignerGateResult

> **CanonicalSignerGateResult** = `object`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:20](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L20)

#### Properties

##### code

> **code**: `"not-required"` \| `"privy-client-disabled"` \| `"privy-auth-loading"` \| `"privy-auth-required"` \| `"missing-canonical-address"` \| `"embedded-wallet-missing"` \| `"embedded-wallet-address-invalid"` \| `"embedded-wallet-cannot-sign"` \| `"owner-check-pending"` \| `"embedded-wallet-not-owner"` \| `"ok"`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:23](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L23)

##### ready

> **ready**: `boolean`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:22](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L22)

##### reason

> **reason**: `string` \| `null`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:35](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L35)

##### required

> **required**: `boolean`

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:21](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L21)

## Functions

### evaluateCanonicalSignerGate()

> **evaluateCanonicalSignerGate**(`input`): [`CanonicalSignerGateResult`](#canonicalsignergateresult)

Defined in: [src/lib/uniswap/canonicalSignerGate.ts:50](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/uniswap/canonicalSignerGate.ts#L50)

#### Parameters

##### input

[`CanonicalSignerGateInput`](#canonicalsignergateinput)

#### Returns

[`CanonicalSignerGateResult`](#canonicalsignergateresult)
