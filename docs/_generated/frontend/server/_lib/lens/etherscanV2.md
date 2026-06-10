[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lens/etherscanV2

# server/\_lib/lens/etherscanV2

## Variables

### ETHERSCAN\_V2\_BASE

> `const` **ETHERSCAN\_V2\_BASE**: `"https://api.etherscan.io/v2/api"` = `'https://api.etherscan.io/v2/api'`

Defined in: [server/\_lib/lens/etherscanV2.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/etherscanV2.ts#L6)

Etherscan API v2 (unified multichain) — Base via chainid=8453.

#### See

https://docs.etherscan.io/etherscan-v2

***

### ETHERSCAN\_V2\_BASE\_CHAIN\_ID

> `const` **ETHERSCAN\_V2\_BASE\_CHAIN\_ID**: `8453` = `8453`

Defined in: [server/\_lib/lens/etherscanV2.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/etherscanV2.ts#L7)

## Functions

### fetchEtherscanV2Json()

> **fetchEtherscanV2Json**\<`T`\>(`params`, `options?`): `Promise`\<`T` \| `null`\>

Defined in: [server/\_lib/lens/etherscanV2.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/etherscanV2.ts#L26)

#### Type Parameters

##### T

`T`

#### Parameters

##### params

`Record`\<`string`, `string`\>

##### options?

###### chainId?

`number`

###### timeoutMs?

`number`

#### Returns

`Promise`\<`T` \| `null`\>

***

### getEtherscanApiKey()

> **getEtherscanApiKey**(): `string`

Defined in: [server/\_lib/lens/etherscanV2.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/etherscanV2.ts#L9)

#### Returns

`string`

***

### hasDebankAccessKey()

> **hasDebankAccessKey**(): `boolean`

Defined in: [server/\_lib/lens/etherscanV2.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/etherscanV2.ts#L17)

#### Returns

`boolean`

***

### hasEtherscanApiKey()

> **hasEtherscanApiKey**(): `boolean`

Defined in: [server/\_lib/lens/etherscanV2.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/etherscanV2.ts#L13)

#### Returns

`boolean`

***

### preferTrayPortfolioEtherscan()

> **preferTrayPortfolioEtherscan**(): `boolean`

Defined in: [server/\_lib/lens/etherscanV2.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/etherscanV2.ts#L21)

#### Returns

`boolean`
