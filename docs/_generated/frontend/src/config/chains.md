[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/config/chains

# src/config/chains

## Interfaces

### ChainMeta

Defined in: [src/config/chains.ts:7](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/config/chains.ts#L7)

#### Properties

##### chain

> **chain**: `Chain`

Defined in: [src/config/chains.ts:11](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/config/chains.ts#L11)

##### color

> **color**: `string`

Defined in: [src/config/chains.ts:17](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/config/chains.ts#L17)

##### explorerUrl

> **explorerUrl**: `string`

Defined in: [src/config/chains.ts:14](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/config/chains.ts#L14)

##### id

> **id**: [`SupportedChainId`](#supportedchainid)

Defined in: [src/config/chains.ts:8](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/config/chains.ts#L8)

##### logoUrl

> **logoUrl**: `string`

Defined in: [src/config/chains.ts:13](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/config/chains.ts#L13)

##### name

> **name**: `string`

Defined in: [src/config/chains.ts:9](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/config/chains.ts#L9)

##### nativeCurrency

> **nativeCurrency**: `object`

Defined in: [src/config/chains.ts:12](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/config/chains.ts#L12)

###### decimals

> **decimals**: `number`

###### name

> **name**: `string`

###### symbol

> **symbol**: `string`

##### shortName

> **shortName**: `string`

Defined in: [src/config/chains.ts:10](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/config/chains.ts#L10)

##### usdc

> **usdc**: `` `0x${string}` ``

Defined in: [src/config/chains.ts:16](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/config/chains.ts#L16)

##### weth

> **weth**: `` `0x${string}` ``

Defined in: [src/config/chains.ts:15](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/config/chains.ts#L15)

## Type Aliases

### SupportedChainId

> **SupportedChainId** = `1` \| `8453` \| `42161` \| `10` \| `137`

Defined in: [src/config/chains.ts:4](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/config/chains.ts#L4)

## Variables

### CHAIN\_MAP

> `const` **CHAIN\_MAP**: `Map`\<[`SupportedChainId`](#supportedchainid), [`ChainMeta`](#chainmeta)\>

Defined in: [src/config/chains.ts:83](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/config/chains.ts#L83)

***

### DEFAULT\_CHAIN\_ID

> `const` **DEFAULT\_CHAIN\_ID**: [`SupportedChainId`](#supportedchainid) = `8453`

Defined in: [src/config/chains.ts:89](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/config/chains.ts#L89)

***

### SUPPORTED\_CHAINS

> `const` **SUPPORTED\_CHAINS**: [`ChainMeta`](#chainmeta)[]

Defined in: [src/config/chains.ts:20](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/config/chains.ts#L20)

## Functions

### getChainMeta()

> **getChainMeta**(`chainId`): [`ChainMeta`](#chainmeta) \| `undefined`

Defined in: [src/config/chains.ts:85](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/config/chains.ts#L85)

#### Parameters

##### chainId

`number`

#### Returns

[`ChainMeta`](#chainmeta) \| `undefined`
