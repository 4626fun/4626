[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/swap/zoraExecutePrep

# src/lib/swap/zoraExecutePrep

## Type Aliases

### ZoraExecutePrepMatchParams

> **ZoraExecutePrepMatchParams** = `object`

Defined in: [src/lib/swap/zoraExecutePrep.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L19)

#### Properties

##### amountIn

> **amountIn**: `string`

Defined in: [src/lib/swap/zoraExecutePrep.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L20)

##### executionAddress

> **executionAddress**: `string`

Defined in: [src/lib/swap/zoraExecutePrep.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L24)

##### now?

> `optional` **now**: `number`

Defined in: [src/lib/swap/zoraExecutePrep.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L26)

##### slippagePct

> **slippagePct**: `number`

Defined in: [src/lib/swap/zoraExecutePrep.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L21)

##### swapTx

> **swapTx**: [`TransactionRequest`](../uniswap/tradingApi.md#transactionrequest) \| `null` \| `undefined`

Defined in: [src/lib/swap/zoraExecutePrep.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L25)

##### tokenIn

> **tokenIn**: `string`

Defined in: [src/lib/swap/zoraExecutePrep.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L22)

##### tokenOut

> **tokenOut**: `string`

Defined in: [src/lib/swap/zoraExecutePrep.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L23)

***

### ZoraExecutePrepSnapshot

> **ZoraExecutePrepSnapshot** = `object`

Defined in: [src/lib/swap/zoraExecutePrep.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L6)

#### Properties

##### amountIn

> **amountIn**: `string`

Defined in: [src/lib/swap/zoraExecutePrep.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L8)

##### executionAddress

> **executionAddress**: `string`

Defined in: [src/lib/swap/zoraExecutePrep.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L12)

##### preparedAt

> **preparedAt**: `number`

Defined in: [src/lib/swap/zoraExecutePrep.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L7)

##### routerValidatedAt?

> `optional` **routerValidatedAt**: `number`

Defined in: [src/lib/swap/zoraExecutePrep.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L16)

Set when Review-time `assertZoraRouterCallExecutesFromCsw` succeeded.

##### slippagePct

> **slippagePct**: `number`

Defined in: [src/lib/swap/zoraExecutePrep.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L9)

##### swapDataPrefix

> **swapDataPrefix**: `string`

Defined in: [src/lib/swap/zoraExecutePrep.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L14)

##### swapTo

> **swapTo**: `string`

Defined in: [src/lib/swap/zoraExecutePrep.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L13)

##### tokenIn

> **tokenIn**: `string`

Defined in: [src/lib/swap/zoraExecutePrep.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L10)

##### tokenOut

> **tokenOut**: `string`

Defined in: [src/lib/swap/zoraExecutePrep.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L11)

## Variables

### ZORA\_EXECUTE\_PREP\_TTL\_MS

> `const` **ZORA\_EXECUTE\_PREP\_TTL\_MS**: `45000` = `45_000`

Defined in: [src/lib/swap/zoraExecutePrep.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L4)

How long review-time Zora execute prep remains valid for submit without re-signing.

## Functions

### buildZoraExecutePrepSnapshot()

> **buildZoraExecutePrepSnapshot**(`params`): [`ZoraExecutePrepSnapshot`](#zoraexecuteprepsnapshot)

Defined in: [src/lib/swap/zoraExecutePrep.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L35)

#### Parameters

##### params

###### amountIn

`string`

###### executionAddress

`string`

###### routerValidated?

`boolean`

###### slippagePct

`number`

###### swapTx

\{ `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `data`: `string`; `from`: `string`; `gasLimit?`: `string`; `gasPrice?`: `string`; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `to`: `string`; `value`: `string`; \}

###### swapTx.chainId

`1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### swapTx.data

`string`

**Description**

The calldata for the transaction.

###### swapTx.from

`string`

###### swapTx.gasLimit?

`string`

###### swapTx.gasPrice?

`string`

###### swapTx.maxFeePerGas?

`string`

###### swapTx.maxPriorityFeePerGas?

`string`

###### swapTx.to

`string`

###### swapTx.value

`string`

**Description**

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### tokenIn

`string`

###### tokenOut

`string`

#### Returns

[`ZoraExecutePrepSnapshot`](#zoraexecuteprepsnapshot)

***

### canFastCanonicalZoraSubmit()

> **canFastCanonicalZoraSubmit**(`params`): `boolean`

Defined in: [src/lib/swap/zoraExecutePrep.ts:113](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L113)

Review validated route + matching calldata → skip submit-time sim/gas-estimate/assert.

#### Parameters

##### params

###### executionMode

`"canonical"` \| `"eoa"`

###### matchParams

[`ZoraExecutePrepMatchParams`](#zoraexecuteprepmatchparams)

###### now?

`number`

###### prep

[`ZoraExecutePrepSnapshot`](#zoraexecuteprepsnapshot) \| `null` \| `undefined`

###### quoteIsZora

`boolean`

#### Returns

`boolean`

***

### fingerprintSwapTxData()

> **fingerprintSwapTxData**(`tx`): `string`

Defined in: [src/lib/swap/zoraExecutePrep.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L29)

#### Parameters

##### tx

\{ `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `data`: `string`; `from`: `string`; `gasLimit?`: `string`; `gasPrice?`: `string`; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `to`: `string`; `value`: `string`; \}

###### chainId

`1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### data

`string`

**Description**

The calldata for the transaction.

###### from

`string`

###### gasLimit?

`string`

###### gasPrice?

`string`

###### maxFeePerGas?

`string`

###### maxPriorityFeePerGas?

`string`

###### to

`string`

###### value

`string`

**Description**

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

| `null` | `undefined`

#### Returns

`string`

***

### isZoraExecutePrepCalldataMatch()

> **isZoraExecutePrepCalldataMatch**(`prep`, `params`): `boolean`

Defined in: [src/lib/swap/zoraExecutePrep.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L61)

#### Parameters

##### prep

[`ZoraExecutePrepSnapshot`](#zoraexecuteprepsnapshot) | `null` | `undefined`

##### params

[`ZoraExecutePrepMatchParams`](#zoraexecuteprepmatchparams)

#### Returns

`boolean`

***

### isZoraExecutePrepFresh()

> **isZoraExecutePrepFresh**(`prep`, `params`): `boolean`

Defined in: [src/lib/swap/zoraExecutePrep.ts:102](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L102)

#### Parameters

##### prep

[`ZoraExecutePrepSnapshot`](#zoraexecuteprepsnapshot) | `null` | `undefined`

##### params

[`ZoraExecutePrepMatchParams`](#zoraexecuteprepmatchparams)

#### Returns

`boolean`

***

### isZoraRouterValidationFresh()

> **isZoraRouterValidationFresh**(`prep`, `now`): `boolean`

Defined in: [src/lib/swap/zoraExecutePrep.ts:82](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L82)

#### Parameters

##### prep

[`ZoraExecutePrepSnapshot`](#zoraexecuteprepsnapshot) | `null` | `undefined`

##### now

`number` = `...`

#### Returns

`boolean`

***

### needsZoraSubmitRefresh()

> **needsZoraSubmitRefresh**(`prep`, `params`): `boolean`

Defined in: [src/lib/swap/zoraExecutePrep.ts:92](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraExecutePrep.ts#L92)

True when submit must re-run Zora prepare/build (calldata or router validation stale).

#### Parameters

##### prep

[`ZoraExecutePrepSnapshot`](#zoraexecuteprepsnapshot) | `null` | `undefined`

##### params

[`ZoraExecutePrepMatchParams`](#zoraexecuteprepmatchparams)

#### Returns

`boolean`
