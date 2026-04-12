[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/wallet/accountContext/types

# src/wallet/accountContext/types

## Type Aliases

### AccountCapabilities

> **AccountCapabilities** = `object`

Defined in: [src/wallet/accountContext/types.ts:7](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L7)

#### Properties

##### atomicStatus

> **atomicStatus**: [`AtomicStatus`](#atomicstatus-1)

Defined in: [src/wallet/accountContext/types.ts:9](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L9)

##### paymasterService

> **paymasterService**: `boolean`

Defined in: [src/wallet/accountContext/types.ts:8](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L8)

##### supports5792

> **supports5792**: `boolean`

Defined in: [src/wallet/accountContext/types.ts:10](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L10)

***

### AccountModePreference

> **AccountModePreference** = `"EOA"` \| `"SMART_WALLET"`

Defined in: [src/wallet/accountContext/types.ts:3](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L3)

***

### AccountUiFlags

> **AccountUiFlags** = `object`

Defined in: [src/wallet/accountContext/types.ts:13](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L13)

#### Properties

##### aaAvailable

> **aaAvailable**: `boolean`

Defined in: [src/wallet/accountContext/types.ts:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L14)

##### canUseSmartWalletMode

> **canUseSmartWalletMode**: `boolean`

Defined in: [src/wallet/accountContext/types.ts:16](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L16)

##### paymasterAvailable

> **paymasterAvailable**: `boolean`

Defined in: [src/wallet/accountContext/types.ts:15](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L15)

##### shouldPromptToLinkOwner

> **shouldPromptToLinkOwner**: `boolean`

Defined in: [src/wallet/accountContext/types.ts:17](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L17)

##### shouldShowNetworkMismatch

> **shouldShowNetworkMismatch**: `boolean`

Defined in: [src/wallet/accountContext/types.ts:18](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L18)

***

### AtomicStatus

> **AtomicStatus** = `"supported"` \| `"ready"` \| `"unsupported"` \| `"unknown"`

Defined in: [src/wallet/accountContext/types.ts:5](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L5)

***

### ResolvedAccountContext

> **ResolvedAccountContext** = `object`

Defined in: [src/wallet/accountContext/types.ts:21](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L21)

#### Properties

##### activeAccount?

> `optional` **activeAccount**: `` `0x${string}` ``

Defined in: [src/wallet/accountContext/types.ts:28](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L28)

##### activeAccountType

> **activeAccountType**: `"EOA"` \| `"SMART_WALLET"` \| `"UNKNOWN"`

Defined in: [src/wallet/accountContext/types.ts:29](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L29)

##### capabilities

> **capabilities**: [`AccountCapabilities`](#accountcapabilities)

Defined in: [src/wallet/accountContext/types.ts:30](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L30)

##### chainId

> **chainId**: `number` \| `null`

Defined in: [src/wallet/accountContext/types.ts:22](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L22)

##### chainIdHex

> **chainIdHex**: `` `0x${string}` `` \| `null`

Defined in: [src/wallet/accountContext/types.ts:23](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L23)

##### cswAddress?

> `optional` **cswAddress**: `` `0x${string}` ``

Defined in: [src/wallet/accountContext/types.ts:26](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L26)

##### eoaIsOwnerOfCsw

> **eoaIsOwnerOfCsw**: `boolean` \| `null`

Defined in: [src/wallet/accountContext/types.ts:27](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L27)

##### signerAddress?

> `optional` **signerAddress**: `` `0x${string}` ``

Defined in: [src/wallet/accountContext/types.ts:24](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L24)

##### signerType

> **signerType**: [`SignerType`](#signertype-1)

Defined in: [src/wallet/accountContext/types.ts:25](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L25)

##### uiFlags

> **uiFlags**: [`AccountUiFlags`](#accountuiflags)

Defined in: [src/wallet/accountContext/types.ts:31](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L31)

***

### SignerType

> **SignerType** = `"EOA"` \| `"SMART_WALLET"` \| `"UNKNOWN"`

Defined in: [src/wallet/accountContext/types.ts:1](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/types.ts#L1)
