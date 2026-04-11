[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/solanaBridgeCliRunner

# server/\_lib/solanaBridgeCliRunner

## Type Aliases

### WrapRunner

> **WrapRunner** = `object`

Defined in: [server/\_lib/solanaBridgeCliRunner.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/solanaBridgeCliRunner.ts#L7)

#### Properties

##### args

> **args**: `string`[]

Defined in: [server/\_lib/solanaBridgeCliRunner.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/solanaBridgeCliRunner.ts#L9)

##### bin

> **bin**: `string`

Defined in: [server/\_lib/solanaBridgeCliRunner.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/solanaBridgeCliRunner.ts#L8)

##### label

> **label**: `string`

Defined in: [server/\_lib/solanaBridgeCliRunner.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/solanaBridgeCliRunner.ts#L10)

## Functions

### buildWrapRunnerList()

> **buildWrapRunnerList**(`cliBinRaw`, `wrapArgs`, `cliDir`): [`WrapRunner`](#wraprunner)[]

Defined in: [server/\_lib/solanaBridgeCliRunner.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/solanaBridgeCliRunner.ts#L13)

#### Parameters

##### cliBinRaw

`string`

##### wrapArgs

`string`[]

##### cliDir

`string`

#### Returns

[`WrapRunner`](#wraprunner)[]

***

### isRunnerUnavailable()

> **isRunnerUnavailable**(`error`): `boolean`

Defined in: [server/\_lib/solanaBridgeCliRunner.ts:78](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/solanaBridgeCliRunner.ts#L78)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### runWrapToken()

> **runWrapToken**(`cliDir`, `cliBinRaw`, `wrapArgs`): `Promise`\<\{ `output`: `string`; `runner`: `string`; \}\>

Defined in: [server/\_lib/solanaBridgeCliRunner.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/solanaBridgeCliRunner.ts#L92)

#### Parameters

##### cliDir

`string`

##### cliBinRaw

`string`

##### wrapArgs

`string`[]

#### Returns

`Promise`\<\{ `output`: `string`; `runner`: `string`; \}\>

***

### toExecErrorText()

> **toExecErrorText**(`error`): `string`

Defined in: [server/\_lib/solanaBridgeCliRunner.ts:72](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/solanaBridgeCliRunner.ts#L72)

#### Parameters

##### error

`unknown`

#### Returns

`string`
