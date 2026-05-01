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

Defined in: [src/lib/tx/txRouter.ts:48](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L48)

#### Properties

##### canonicalAddress

> **canonicalAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/tx/txRouter.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L54)

##### capabilities?

> `optional` **capabilities**: [`AccountCapabilities`](../../wallet/accountContext/types.md#accountcapabilities) \| `null`

Defined in: [src/lib/tx/txRouter.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L60)

##### chainId

> **chainId**: `number`

Defined in: [src/lib/tx/txRouter.ts:49](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L49)

##### connectorId?

> `optional` **connectorId**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L58)

##### connectorName?

> `optional` **connectorName**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:59](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L59)

##### debug()?

> `optional` **debug**: (`event`) => `void`

Defined in: [src/lib/tx/txRouter.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L61)

###### Parameters

###### event

[`TxRouterDebugEvent`](#txrouterdebugevent)

###### Returns

`void`

##### executionAddress

> **executionAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/tx/txRouter.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L56)

##### executionMode

> **executionMode**: `"canonical"` \| `"eoa"`

Defined in: [src/lib/tx/txRouter.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L50)

##### executionTrack?

> `optional` **executionTrack**: [`UserExecutionTrack`](#userexecutiontrack) \| `null`

Defined in: [src/lib/tx/txRouter.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L51)

##### publicClient

> **publicClient**: `unknown`

Defined in: [src/lib/tx/txRouter.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L53)

##### signerAddress

> **signerAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/tx/txRouter.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L55)

##### signerType?

> `optional` **signerType**: [`SignerType`](../../wallet/accountContext/types.md#signertype-1)

Defined in: [src/lib/tx/txRouter.ts:57](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L57)

##### walletClient

> **walletClient**: `unknown`

Defined in: [src/lib/tx/txRouter.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L52)

***

### TxRouterDebugEvent

> **TxRouterDebugEvent** = `object`

Defined in: [src/lib/tx/txRouter.ts:72](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L72)

#### Properties

##### callsId?

> `optional` **callsId**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:86](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L86)

##### callTargets

> **callTargets**: `string`[]

Defined in: [src/lib/tx/txRouter.ts:79](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L79)

##### chainId

> **chainId**: `number`

Defined in: [src/lib/tx/txRouter.ts:77](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L77)

##### connectorId?

> `optional` **connectorId**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:81](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L81)

##### connectorName?

> `optional` **connectorName**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:82](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L82)

##### error?

> `optional` **error**: `string`

Defined in: [src/lib/tx/txRouter.ts:87](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L87)

##### event

> **event**: `"route_selected"` \| `"send_attempt"` \| `"send_success"` \| `"send_error"` \| `"send_fallback"`

Defined in: [src/lib/tx/txRouter.ts:73](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L73)

##### fallbackMode?

> `optional` **fallbackMode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/tx/txRouter.ts:75](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L75)

##### method?

> `optional` **method**: [`TxMethod`](#txmethod)

Defined in: [src/lib/tx/txRouter.ts:76](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L76)

##### mode

> **mode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/tx/txRouter.ts:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L74)

##### reason?

> `optional` **reason**: `string`

Defined in: [src/lib/tx/txRouter.ts:80](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L80)

##### sender

> **sender**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:78](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L78)

##### smartWalletDetected?

> `optional` **smartWalletDetected**: `boolean`

Defined in: [src/lib/tx/txRouter.ts:83](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L83)

##### supportsSendCallsHint?

> `optional` **supportsSendCallsHint**: `boolean`

Defined in: [src/lib/tx/txRouter.ts:84](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L84)

##### txHash?

> `optional` **txHash**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:85](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L85)

***

### TxRouterSendResult

> **TxRouterSendResult** = `object`

Defined in: [src/lib/tx/txRouter.ts:90](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L90)

#### Properties

##### callsId

> **callsId**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:95](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L95)

##### method

> **method**: [`TxMethod`](#txmethod)

Defined in: [src/lib/tx/txRouter.ts:92](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L92)

##### mode

> **mode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/tx/txRouter.ts:91](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L91)

##### sender

> **sender**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/tx/txRouter.ts:93](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L93)

##### transactionHash

> **transactionHash**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:94](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L94)

##### txHashes

> **txHashes**: `string`[]

Defined in: [src/lib/tx/txRouter.ts:96](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L96)

***

### TxRoutingDecision

> **TxRoutingDecision** = `object`

Defined in: [src/lib/tx/txRouter.ts:64](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L64)

#### Properties

##### fallbackMode

> **fallbackMode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/tx/txRouter.ts:66](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L66)

##### mode

> **mode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/tx/txRouter.ts:65](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L65)

##### reason

> **reason**: `string`

Defined in: [src/lib/tx/txRouter.ts:69](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L69)

##### smartWalletDetected

> **smartWalletDetected**: `boolean`

Defined in: [src/lib/tx/txRouter.ts:67](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L67)

##### supportsSendCallsHint

> **supportsSendCallsHint**: `boolean`

Defined in: [src/lib/tx/txRouter.ts:68](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L68)

***

### TxSendMode

> **TxSendMode** = `"sendCalls"` \| `"canonical4337"` \| `"canonicalDirect"` \| `"eoaDirect"`

Defined in: [src/lib/tx/txRouter.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L36)

***

### UserExecutionTrack

> **UserExecutionTrack** = `"sub-account"` \| `"legacy-owner-install"` \| `"none-yet"` \| `"migration-pending"`

Defined in: [src/lib/tx/txRouter.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L42)

## Functions

### buildAndSendApproval()

> **buildAndSendApproval**(`params`): `Promise`\<\{ `routing`: [`TxRoutingDecision`](#txroutingdecision); `send`: [`TxRouterSendResult`](#txroutersendresult); \}\>

Defined in: [src/lib/tx/txRouter.ts:1114](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L1114)

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

### buildAndSendCalls()

> **buildAndSendCalls**(`params`): `Promise`\<\{ `routing`: [`TxRoutingDecision`](#txroutingdecision); `send`: [`TxRouterSendResult`](#txroutersendresult); \}\>

Defined in: [src/lib/tx/txRouter.ts:1128](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L1128)

#### Parameters

##### params

###### calls

`object`[]

###### context

[`TxRouterContext`](#txroutercontext)

#### Returns

`Promise`\<\{ `routing`: [`TxRoutingDecision`](#txroutingdecision); `send`: [`TxRouterSendResult`](#txroutersendresult); \}\>

***

### buildAndSendSwap()

> **buildAndSendSwap**(`params`): `Promise`\<\{ `routing`: [`TxRoutingDecision`](#txroutingdecision); `send`: [`TxRouterSendResult`](#txroutersendresult); \}\>

Defined in: [src/lib/tx/txRouter.ts:1149](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L1149)

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

Defined in: [src/lib/tx/txRouter.ts:400](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L400)

#### Parameters

##### context

[`TxRouterContext`](#txroutercontext)

#### Returns

[`TxRoutingDecision`](#txroutingdecision)

***

### normalizeCanonicalSendError()

> **normalizeCanonicalSendError**(`error`): `Error`

Defined in: [src/lib/tx/txRouter.ts:232](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L232)

#### Parameters

##### error

`unknown`

#### Returns

`Error`
