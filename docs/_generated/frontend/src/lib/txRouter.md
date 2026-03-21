[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/txRouter

# src/lib/txRouter

## Type Aliases

### TxMethod

> **TxMethod** = `"wallet_sendCalls"` \| `"eth_sendUserOperation"` \| `"walletClient.sendTransaction"` \| `"eth_sendTransaction"`

Defined in: [src/lib/txRouter.ts:36](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L36)

***

### TxRouterContext

> **TxRouterContext** = `object`

Defined in: [src/lib/txRouter.ts:42](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L42)

#### Properties

##### canonicalAddress

> **canonicalAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/txRouter.ts:47](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L47)

##### capabilities?

> `optional` **capabilities**: [`AccountCapabilities`](../wallet/accountContext/types.md#accountcapabilities) \| `null`

Defined in: [src/lib/txRouter.ts:53](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L53)

##### chainId

> **chainId**: `number`

Defined in: [src/lib/txRouter.ts:43](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L43)

##### connectorId?

> `optional` **connectorId**: `string` \| `null`

Defined in: [src/lib/txRouter.ts:51](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L51)

##### connectorName?

> `optional` **connectorName**: `string` \| `null`

Defined in: [src/lib/txRouter.ts:52](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L52)

##### debug()?

> `optional` **debug**: (`event`) => `void`

Defined in: [src/lib/txRouter.ts:54](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L54)

###### Parameters

###### event

[`TxRouterDebugEvent`](#txrouterdebugevent)

###### Returns

`void`

##### executionAddress

> **executionAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/txRouter.ts:49](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L49)

##### executionMode

> **executionMode**: `"canonical"` \| `"eoa"`

Defined in: [src/lib/txRouter.ts:44](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L44)

##### publicClient

> **publicClient**: `unknown`

Defined in: [src/lib/txRouter.ts:46](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L46)

##### signerAddress

> **signerAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/txRouter.ts:48](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L48)

##### signerType?

> `optional` **signerType**: [`SignerType`](../wallet/accountContext/types.md#signertype-1)

Defined in: [src/lib/txRouter.ts:50](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L50)

##### walletClient

> **walletClient**: `unknown`

Defined in: [src/lib/txRouter.ts:45](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L45)

***

### TxRouterDebugEvent

> **TxRouterDebugEvent** = `object`

Defined in: [src/lib/txRouter.ts:65](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L65)

#### Properties

##### callsId?

> `optional` **callsId**: `string` \| `null`

Defined in: [src/lib/txRouter.ts:79](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L79)

##### callTargets

> **callTargets**: `string`[]

Defined in: [src/lib/txRouter.ts:72](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L72)

##### chainId

> **chainId**: `number`

Defined in: [src/lib/txRouter.ts:70](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L70)

##### connectorId?

> `optional` **connectorId**: `string` \| `null`

Defined in: [src/lib/txRouter.ts:74](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L74)

##### connectorName?

> `optional` **connectorName**: `string` \| `null`

Defined in: [src/lib/txRouter.ts:75](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L75)

##### error?

> `optional` **error**: `string`

Defined in: [src/lib/txRouter.ts:80](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L80)

##### event

> **event**: `"route_selected"` \| `"send_attempt"` \| `"send_success"` \| `"send_error"` \| `"send_fallback"`

Defined in: [src/lib/txRouter.ts:66](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L66)

##### fallbackMode?

> `optional` **fallbackMode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/txRouter.ts:68](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L68)

##### method?

> `optional` **method**: [`TxMethod`](#txmethod)

Defined in: [src/lib/txRouter.ts:69](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L69)

##### mode

> **mode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/txRouter.ts:67](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L67)

##### reason?

> `optional` **reason**: `string`

Defined in: [src/lib/txRouter.ts:73](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L73)

##### sender

> **sender**: `string` \| `null`

Defined in: [src/lib/txRouter.ts:71](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L71)

##### smartWalletDetected?

> `optional` **smartWalletDetected**: `boolean`

Defined in: [src/lib/txRouter.ts:76](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L76)

##### supportsSendCallsHint?

> `optional` **supportsSendCallsHint**: `boolean`

Defined in: [src/lib/txRouter.ts:77](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L77)

##### txHash?

> `optional` **txHash**: `string` \| `null`

Defined in: [src/lib/txRouter.ts:78](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L78)

***

### TxRouterSendResult

> **TxRouterSendResult** = `object`

Defined in: [src/lib/txRouter.ts:83](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L83)

#### Properties

##### callsId

> **callsId**: `string` \| `null`

Defined in: [src/lib/txRouter.ts:88](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L88)

##### method

> **method**: [`TxMethod`](#txmethod)

Defined in: [src/lib/txRouter.ts:85](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L85)

##### mode

> **mode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/txRouter.ts:84](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L84)

##### sender

> **sender**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/txRouter.ts:86](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L86)

##### transactionHash

> **transactionHash**: `string` \| `null`

Defined in: [src/lib/txRouter.ts:87](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L87)

##### txHashes

> **txHashes**: `string`[]

Defined in: [src/lib/txRouter.ts:89](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L89)

***

### TxRoutingDecision

> **TxRoutingDecision** = `object`

Defined in: [src/lib/txRouter.ts:57](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L57)

#### Properties

##### fallbackMode

> **fallbackMode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/txRouter.ts:59](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L59)

##### mode

> **mode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/txRouter.ts:58](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L58)

##### reason

> **reason**: `string`

Defined in: [src/lib/txRouter.ts:62](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L62)

##### smartWalletDetected

> **smartWalletDetected**: `boolean`

Defined in: [src/lib/txRouter.ts:60](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L60)

##### supportsSendCallsHint

> **supportsSendCallsHint**: `boolean`

Defined in: [src/lib/txRouter.ts:61](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L61)

***

### TxSendMode

> **TxSendMode** = `"sendCalls"` \| `"canonical4337"` \| `"canonicalDirect"` \| `"eoaDirect"`

Defined in: [src/lib/txRouter.ts:35](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L35)

## Functions

### buildAndSendApproval()

> **buildAndSendApproval**(`params`): `Promise`\<\{ `routing`: [`TxRoutingDecision`](#txroutingdecision); `send`: [`TxRouterSendResult`](#txroutersendresult); \}\>

Defined in: [src/lib/txRouter.ts:886](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L886)

#### Parameters

##### params

###### approvalTx

\{ `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `data`: `string`; `from`: `string`; `gasLimit?`: `string`; `gasPrice?`: `string`; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `to`: `string`; `value`: `string`; \}

###### approvalTx.chainId

`1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### approvalTx.data

`string`

**Description**

The calldata for the transaction.

###### approvalTx.from

`string`

###### approvalTx.gasLimit?

`string`

###### approvalTx.gasPrice?

`string`

###### approvalTx.maxFeePerGas?

`string`

###### approvalTx.maxPriorityFeePerGas?

`string`

###### approvalTx.to

`string`

###### approvalTx.value

`string`

**Description**

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### context

[`TxRouterContext`](#txroutercontext)

#### Returns

`Promise`\<\{ `routing`: [`TxRoutingDecision`](#txroutingdecision); `send`: [`TxRouterSendResult`](#txroutersendresult); \}\>

***

### buildAndSendSwap()

> **buildAndSendSwap**(`params`): `Promise`\<\{ `routing`: [`TxRoutingDecision`](#txroutingdecision); `send`: [`TxRouterSendResult`](#txroutersendresult); \}\>

Defined in: [src/lib/txRouter.ts:900](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L900)

#### Parameters

##### params

###### approvalTx?

\{ `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `data`: `string`; `from`: `string`; `gasLimit?`: `string`; `gasPrice?`: `string`; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `to`: `string`; `value`: `string`; \} \| `null`

###### context

[`TxRouterContext`](#txroutercontext)

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

#### Returns

`Promise`\<\{ `routing`: [`TxRoutingDecision`](#txroutingdecision); `send`: [`TxRouterSendResult`](#txroutersendresult); \}\>

***

### detectTxSendMode()

> **detectTxSendMode**(`context`): [`TxRoutingDecision`](#txroutingdecision)

Defined in: [src/lib/txRouter.ts:318](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L318)

#### Parameters

##### context

[`TxRouterContext`](#txroutercontext)

#### Returns

[`TxRoutingDecision`](#txroutingdecision)

***

### normalizeCanonicalSendError()

> **normalizeCanonicalSendError**(`error`): `Error`

Defined in: [src/lib/txRouter.ts:215](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/txRouter.ts#L215)

#### Parameters

##### error

`unknown`

#### Returns

`Error`
