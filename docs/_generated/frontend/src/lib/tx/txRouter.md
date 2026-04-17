[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/tx/txRouter

# src/lib/tx/txRouter

## Type Aliases

### TxMethod

> **TxMethod** = `"wallet_sendCalls"` \| `"eth_sendUserOperation"` \| `"walletClient.sendTransaction"` \| `"eth_sendTransaction"`

Defined in: [src/lib/tx/txRouter.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L37)

***

### TxRouterContext

> **TxRouterContext** = `object`

Defined in: [src/lib/tx/txRouter.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L43)

#### Properties

##### canonicalAddress

> **canonicalAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/tx/txRouter.ts:48](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L48)

##### capabilities?

> `optional` **capabilities**: [`AccountCapabilities`](../../wallet/accountContext/types.md#accountcapabilities) \| `null`

Defined in: [src/lib/tx/txRouter.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L54)

##### chainId

> **chainId**: `number`

Defined in: [src/lib/tx/txRouter.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L44)

##### connectorId?

> `optional` **connectorId**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L52)

##### connectorName?

> `optional` **connectorName**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L53)

##### debug()?

> `optional` **debug**: (`event`) => `void`

Defined in: [src/lib/tx/txRouter.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L55)

###### Parameters

###### event

[`TxRouterDebugEvent`](#txrouterdebugevent)

###### Returns

`void`

##### executionAddress

> **executionAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/tx/txRouter.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L50)

##### executionMode

> **executionMode**: `"canonical"` \| `"eoa"`

Defined in: [src/lib/tx/txRouter.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L45)

##### publicClient

> **publicClient**: `unknown`

Defined in: [src/lib/tx/txRouter.ts:47](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L47)

##### signerAddress

> **signerAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/tx/txRouter.ts:49](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L49)

##### signerType?

> `optional` **signerType**: [`SignerType`](../../wallet/accountContext/types.md#signertype-1)

Defined in: [src/lib/tx/txRouter.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L51)

##### walletClient

> **walletClient**: `unknown`

Defined in: [src/lib/tx/txRouter.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L46)

***

### TxRouterDebugEvent

> **TxRouterDebugEvent** = `object`

Defined in: [src/lib/tx/txRouter.ts:66](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L66)

#### Properties

##### callsId?

> `optional` **callsId**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:80](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L80)

##### callTargets

> **callTargets**: `string`[]

Defined in: [src/lib/tx/txRouter.ts:73](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L73)

##### chainId

> **chainId**: `number`

Defined in: [src/lib/tx/txRouter.ts:71](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L71)

##### connectorId?

> `optional` **connectorId**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:75](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L75)

##### connectorName?

> `optional` **connectorName**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:76](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L76)

##### error?

> `optional` **error**: `string`

Defined in: [src/lib/tx/txRouter.ts:81](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L81)

##### event

> **event**: `"route_selected"` \| `"send_attempt"` \| `"send_success"` \| `"send_error"` \| `"send_fallback"`

Defined in: [src/lib/tx/txRouter.ts:67](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L67)

##### fallbackMode?

> `optional` **fallbackMode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/tx/txRouter.ts:69](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L69)

##### method?

> `optional` **method**: [`TxMethod`](#txmethod)

Defined in: [src/lib/tx/txRouter.ts:70](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L70)

##### mode

> **mode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/tx/txRouter.ts:68](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L68)

##### reason?

> `optional` **reason**: `string`

Defined in: [src/lib/tx/txRouter.ts:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L74)

##### sender

> **sender**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:72](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L72)

##### smartWalletDetected?

> `optional` **smartWalletDetected**: `boolean`

Defined in: [src/lib/tx/txRouter.ts:77](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L77)

##### supportsSendCallsHint?

> `optional` **supportsSendCallsHint**: `boolean`

Defined in: [src/lib/tx/txRouter.ts:78](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L78)

##### txHash?

> `optional` **txHash**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:79](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L79)

***

### TxRouterSendResult

> **TxRouterSendResult** = `object`

Defined in: [src/lib/tx/txRouter.ts:84](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L84)

#### Properties

##### callsId

> **callsId**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:89](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L89)

##### method

> **method**: [`TxMethod`](#txmethod)

Defined in: [src/lib/tx/txRouter.ts:86](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L86)

##### mode

> **mode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/tx/txRouter.ts:85](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L85)

##### sender

> **sender**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/tx/txRouter.ts:87](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L87)

##### transactionHash

> **transactionHash**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:88](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L88)

##### txHashes

> **txHashes**: `string`[]

Defined in: [src/lib/tx/txRouter.ts:90](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L90)

***

### TxRoutingDecision

> **TxRoutingDecision** = `object`

Defined in: [src/lib/tx/txRouter.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L58)

#### Properties

##### fallbackMode

> **fallbackMode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/tx/txRouter.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L60)

##### mode

> **mode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/tx/txRouter.ts:59](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L59)

##### reason

> **reason**: `string`

Defined in: [src/lib/tx/txRouter.ts:63](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L63)

##### smartWalletDetected

> **smartWalletDetected**: `boolean`

Defined in: [src/lib/tx/txRouter.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L61)

##### supportsSendCallsHint

> **supportsSendCallsHint**: `boolean`

Defined in: [src/lib/tx/txRouter.ts:62](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L62)

***

### TxSendMode

> **TxSendMode** = `"sendCalls"` \| `"canonical4337"` \| `"canonicalDirect"` \| `"eoaDirect"`

Defined in: [src/lib/tx/txRouter.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L36)

## Functions

### buildAndSendApproval()

> **buildAndSendApproval**(`params`): `Promise`\<\{ `routing`: [`TxRoutingDecision`](#txroutingdecision); `send`: [`TxRouterSendResult`](#txroutersendresult); \}\>

Defined in: [src/lib/tx/txRouter.ts:924](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L924)

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

Defined in: [src/lib/tx/txRouter.ts:938](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L938)

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

Defined in: [src/lib/tx/txRouter.ts:319](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L319)

#### Parameters

##### context

[`TxRouterContext`](#txroutercontext)

#### Returns

[`TxRoutingDecision`](#txroutingdecision)

***

### normalizeCanonicalSendError()

> **normalizeCanonicalSendError**(`error`): `Error`

Defined in: [src/lib/tx/txRouter.ts:216](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L216)

#### Parameters

##### error

`unknown`

#### Returns

`Error`
