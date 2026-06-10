[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lens/baseTrayActivityEtherscan

# server/\_lib/lens/baseTrayActivityEtherscan

## Type Aliases

### TrayOnchainActivityRow

> **TrayOnchainActivityRow** = `object`

Defined in: [server/\_lib/lens/baseTrayActivityEtherscan.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/baseTrayActivityEtherscan.ts#L8)

#### Properties

##### failed

> **failed**: `boolean`

Defined in: [server/\_lib/lens/baseTrayActivityEtherscan.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/baseTrayActivityEtherscan.ts#L15)

##### kind

> **kind**: `"swap"` \| `"transfer"` \| `"contract"` \| `"unknown"`

Defined in: [server/\_lib/lens/baseTrayActivityEtherscan.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/baseTrayActivityEtherscan.ts#L14)

##### subtitle

> **subtitle**: `string`

Defined in: [server/\_lib/lens/baseTrayActivityEtherscan.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/baseTrayActivityEtherscan.ts#L13)

##### timestampMs

> **timestampMs**: `number`

Defined in: [server/\_lib/lens/baseTrayActivityEtherscan.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/baseTrayActivityEtherscan.ts#L11)

##### title

> **title**: `string`

Defined in: [server/\_lib/lens/baseTrayActivityEtherscan.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/baseTrayActivityEtherscan.ts#L12)

##### txHash

> **txHash**: `string`

Defined in: [server/\_lib/lens/baseTrayActivityEtherscan.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/baseTrayActivityEtherscan.ts#L9)

##### walletAddress

> **walletAddress**: `string`

Defined in: [server/\_lib/lens/baseTrayActivityEtherscan.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/baseTrayActivityEtherscan.ts#L10)

## Functions

### getTrayWalletActivityBaseEtherscan()

> **getTrayWalletActivityBaseEtherscan**(`address`, `options`): `Promise`\<[`TrayOnchainActivityRow`](#trayonchainactivityrow)[]\>

Defined in: [server/\_lib/lens/baseTrayActivityEtherscan.ts:106](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/baseTrayActivityEtherscan.ts#L106)

#### Parameters

##### address

`string`

##### options

###### limit?

`number`

#### Returns

`Promise`\<[`TrayOnchainActivityRow`](#trayonchainactivityrow)[]\>
