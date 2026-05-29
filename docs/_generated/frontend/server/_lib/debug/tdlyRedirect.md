[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/debug/tdlyRedirect

# server/\_lib/debug/tdlyRedirect

## Type Aliases

### TdlyRedirectParams

> **TdlyRedirectParams** = `object`

Defined in: [server/\_lib/debug/tdlyRedirect.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/debug/tdlyRedirect.ts#L3)

#### Properties

##### block

> **block**: `string`

Defined in: [server/\_lib/debug/tdlyRedirect.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/debug/tdlyRedirect.ts#L4)

##### contractAddress

> **contractAddress**: `string`

Defined in: [server/\_lib/debug/tdlyRedirect.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/debug/tdlyRedirect.ts#L5)

##### from

> **from**: `string`

Defined in: [server/\_lib/debug/tdlyRedirect.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/debug/tdlyRedirect.ts#L6)

##### gas

> **gas**: `string`

Defined in: [server/\_lib/debug/tdlyRedirect.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/debug/tdlyRedirect.ts#L7)

##### network

> **network**: `string`

Defined in: [server/\_lib/debug/tdlyRedirect.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/debug/tdlyRedirect.ts#L8)

##### rawFunctionInput

> **rawFunctionInput**: `string`

Defined in: [server/\_lib/debug/tdlyRedirect.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/debug/tdlyRedirect.ts#L9)

## Functions

### buildTenderlyDashboardUrl()

> **buildTenderlyDashboardUrl**(`account`, `project`, `simulationId`): `string`

Defined in: [server/\_lib/debug/tdlyRedirect.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/debug/tdlyRedirect.ts#L58)

#### Parameters

##### account

`string`

##### project

`string`

##### simulationId

`string`

#### Returns

`string`

***

### decodeTdlyRedirectQuery()

> **decodeTdlyRedirectQuery**(`q`): [`TdlyRedirectParams`](#tdlyredirectparams)

Defined in: [server/\_lib/debug/tdlyRedirect.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/debug/tdlyRedirect.ts#L18)

#### Parameters

##### q

`string`

#### Returns

[`TdlyRedirectParams`](#tdlyredirectparams)

***

### extractTdlyRedirectQueryFromUrl()

> **extractTdlyRedirectQueryFromUrl**(`url`): `string`

Defined in: [server/\_lib/debug/tdlyRedirect.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/debug/tdlyRedirect.ts#L31)

#### Parameters

##### url

`string`

#### Returns

`string`

***

### parseTenderlyApiUrl()

> **parseTenderlyApiUrl**(`apiUrl`): `object`

Defined in: [server/\_lib/debug/tdlyRedirect.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/debug/tdlyRedirect.ts#L43)

#### Parameters

##### apiUrl

`string`

#### Returns

`object`

##### account

> **account**: `string`

##### project

> **project**: `string`

##### simulateEndpoint

> **simulateEndpoint**: `string`
