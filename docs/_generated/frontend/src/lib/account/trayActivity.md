[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/account/trayActivity

# src/lib/account/trayActivity

## Type Aliases

### AccountTrayActivityBatch

> **AccountTrayActivityBatch** = `object`

Defined in: [src/lib/account/trayActivity.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L14)

#### Properties

##### asOf

> **asOf**: `number`

Defined in: [src/lib/account/trayActivity.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L15)

##### merged

> **merged**: [`TrayOnchainActivityRow`](#trayonchainactivityrow)[]

Defined in: [src/lib/account/trayActivity.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L17)

##### results

> **results**: `Record`\<`string`, [`TrayOnchainActivityRow`](#trayonchainactivityrow)[]\>

Defined in: [src/lib/account/trayActivity.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L16)

***

### TrayActivityRow

> **TrayActivityRow** = `object`

Defined in: [src/lib/account/trayActivity.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L20)

#### Properties

##### failed

> **failed**: `boolean`

Defined in: [src/lib/account/trayActivity.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L29)

##### id

> **id**: `string`

Defined in: [src/lib/account/trayActivity.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L21)

##### source

> **source**: `"onchain"` \| `"app"`

Defined in: [src/lib/account/trayActivity.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L22)

##### subtitle

> **subtitle**: `string`

Defined in: [src/lib/account/trayActivity.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L27)

##### timestampMs

> **timestampMs**: `number`

Defined in: [src/lib/account/trayActivity.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L28)

##### title

> **title**: `string`

Defined in: [src/lib/account/trayActivity.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L26)

##### txHash

> **txHash**: `string` \| `null`

Defined in: [src/lib/account/trayActivity.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L23)

##### walletAddress

> **walletAddress**: `string`

Defined in: [src/lib/account/trayActivity.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L24)

##### walletLabel

> **walletLabel**: `string`

Defined in: [src/lib/account/trayActivity.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L25)

***

### TrayOnchainActivityRow

> **TrayOnchainActivityRow** = `object`

Defined in: [src/lib/account/trayActivity.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L4)

#### Properties

##### failed

> **failed**: `boolean`

Defined in: [src/lib/account/trayActivity.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L11)

##### kind

> **kind**: `"swap"` \| `"transfer"` \| `"contract"` \| `"unknown"`

Defined in: [src/lib/account/trayActivity.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L10)

##### subtitle

> **subtitle**: `string`

Defined in: [src/lib/account/trayActivity.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L9)

##### timestampMs

> **timestampMs**: `number`

Defined in: [src/lib/account/trayActivity.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L7)

##### title

> **title**: `string`

Defined in: [src/lib/account/trayActivity.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L8)

##### txHash

> **txHash**: `string`

Defined in: [src/lib/account/trayActivity.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L5)

##### walletAddress

> **walletAddress**: `string`

Defined in: [src/lib/account/trayActivity.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L6)

## Functions

### basescanTxUrl()

> **basescanTxUrl**(`txHash`): `string`

Defined in: [src/lib/account/trayActivity.ts:77](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L77)

#### Parameters

##### txHash

`string`

#### Returns

`string`

***

### buildMergedTrayActivityRows()

> **buildMergedTrayActivityRows**(`params`): [`TrayActivityRow`](#trayactivityrow)[]

Defined in: [src/lib/account/trayActivity.ts:81](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L81)

#### Parameters

##### params

###### appEntries

[`AppActivityEntry`](appActivityJournal.md#appactivityentry)[]

###### limit?

`number`

###### onchainMerged

[`TrayOnchainActivityRow`](#trayonchainactivityrow)[]

###### wallets

`object`[]

#### Returns

[`TrayActivityRow`](#trayactivityrow)[]

***

### fetchAccountTrayActivityBatch()

> **fetchAccountTrayActivityBatch**(`params`): `Promise`\<[`AccountTrayActivityBatch`](#accounttrayactivitybatch) \| `null`\>

Defined in: [src/lib/account/trayActivity.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L42)

#### Parameters

##### params

###### addresses

`string`[]

###### limitPerWallet?

`number`

#### Returns

`Promise`\<[`AccountTrayActivityBatch`](#accounttrayactivitybatch) \| `null`\>

***

### formatTrayActivityWhen()

> **formatTrayActivityWhen**(`timestampMs`): `string`

Defined in: [src/lib/account/trayActivity.ts:64](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/trayActivity.ts#L64)

#### Parameters

##### timestampMs

`number`

#### Returns

`string`
