[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / api/\_handlers/wallet/\_trayActivity

# api/\_handlers/wallet/\_trayActivity

## Type Aliases

### AccountTrayActivityBatchResponse

> **AccountTrayActivityBatchResponse** = `object`

Defined in: [api/\_handlers/wallet/\_trayActivity.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/wallet/_trayActivity.ts#L21)

#### Properties

##### asOf

> **asOf**: `number`

Defined in: [api/\_handlers/wallet/\_trayActivity.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/wallet/_trayActivity.ts#L22)

##### merged

> **merged**: [`TrayOnchainActivityRow`](../../../server/_lib/lens/baseTrayActivityEtherscan.md#trayonchainactivityrow)[]

Defined in: [api/\_handlers/wallet/\_trayActivity.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/wallet/_trayActivity.ts#L24)

##### results

> **results**: `Record`\<`string`, [`TrayOnchainActivityRow`](../../../server/_lib/lens/baseTrayActivityEtherscan.md#trayonchainactivityrow)[]\>

Defined in: [api/\_handlers/wallet/\_trayActivity.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/wallet/_trayActivity.ts#L23)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/wallet/\_trayActivity.ts:86](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/wallet/_trayActivity.ts#L86)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
