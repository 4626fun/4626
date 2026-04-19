[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/uniswap/walletMode

# src/lib/uniswap/walletMode

## Type Aliases

### WalletExecutionContext

> **WalletExecutionContext** = `object`

Defined in: [src/lib/uniswap/walletMode.ts:14](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L14)

#### Properties

##### address

> **address**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/uniswap/walletMode.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L17)

##### capabilities

> **capabilities**: `object`

Defined in: [src/lib/uniswap/walletMode.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L19)

###### supports5792

> **supports5792**: `boolean`

###### supports7702

> **supports7702**: `boolean`

##### mode

> **mode**: [`WalletMode`](#walletmode)

Defined in: [src/lib/uniswap/walletMode.ts:15](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L15)

##### ready

> **ready**: `boolean`

Defined in: [src/lib/uniswap/walletMode.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L18)

##### walletType

> **walletType**: `"canonical"` \| `"eoa"`

Defined in: [src/lib/uniswap/walletMode.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L16)

***

### WalletMode

> **WalletMode** = `"canonical"` \| `"eoa"`

Defined in: [src/lib/uniswap/walletMode.ts:1](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L1)

***

### WalletModeContextInput

> **WalletModeContextInput** = `object`

Defined in: [src/lib/uniswap/walletMode.ts:5](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L5)

#### Properties

##### canonicalAddress

> **canonicalAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/uniswap/walletMode.ts:6](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L6)

##### canonicalReady

> **canonicalReady**: `boolean`

Defined in: [src/lib/uniswap/walletMode.ts:8](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L8)

##### eoaReady

> **eoaReady**: `boolean`

Defined in: [src/lib/uniswap/walletMode.ts:9](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L9)

##### signerAddress

> **signerAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/uniswap/walletMode.ts:7](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L7)

##### supports5792?

> `optional` **supports5792**: `boolean`

Defined in: [src/lib/uniswap/walletMode.ts:10](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L10)

##### supports7702?

> `optional` **supports7702**: `boolean`

Defined in: [src/lib/uniswap/walletMode.ts:11](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L11)

## Functions

### getActiveSignerOrProvider()

> **getActiveSignerOrProvider**(`mode`, `input`): `object`

Defined in: [src/lib/uniswap/walletMode.ts:90](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L90)

#### Parameters

##### mode

[`WalletMode`](#walletmode)

##### input

###### publicClient

`unknown`

###### walletClient

`unknown`

#### Returns

`object`

##### publicClient

> **publicClient**: `unknown`

##### walletClient

> **walletClient**: `unknown`

##### walletType

> **walletType**: [`WalletMode`](#walletmode)

***

### getDefaultWalletMode()

> **getDefaultWalletMode**(`input`): [`WalletMode`](#walletmode)

Defined in: [src/lib/uniswap/walletMode.ts:48](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L48)

#### Parameters

##### input

###### canonicalReady

`boolean`

###### eoaReady

`boolean`

###### preferredMode?

[`WalletMode`](#walletmode) \| `null`

#### Returns

[`WalletMode`](#walletmode)

***

### getExecutionContext()

> **getExecutionContext**(`mode`, `input`): [`WalletExecutionContext`](#walletexecutioncontext)

Defined in: [src/lib/uniswap/walletMode.ts:61](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L61)

#### Parameters

##### mode

[`WalletMode`](#walletmode)

##### input

[`WalletModeContextInput`](#walletmodecontextinput)

#### Returns

[`WalletExecutionContext`](#walletexecutioncontext)

***

### isCSWAvailable()

> **isCSWAvailable**(`input`): `boolean`

Defined in: [src/lib/uniswap/walletMode.ts:44](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L44)

#### Parameters

##### input

[`WalletModeContextInput`](#walletmodecontextinput)

#### Returns

`boolean`

***

### readPreferredWalletMode()

> **readPreferredWalletMode**(): [`WalletMode`](#walletmode)

Defined in: [src/lib/uniswap/walletMode.ts:25](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L25)

#### Returns

[`WalletMode`](#walletmode)

***

### writePreferredWalletMode()

> **writePreferredWalletMode**(`mode`): `void`

Defined in: [src/lib/uniswap/walletMode.ts:35](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/walletMode.ts#L35)

#### Parameters

##### mode

[`WalletMode`](#walletmode)

#### Returns

`void`
