[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/tx/txRouter

# src/lib/tx/txRouter

## Type Aliases

### TxMethod

> **TxMethod** = `"wallet_sendCalls"` \| `"eth_sendUserOperation"` \| `"walletClient.sendTransaction"` \| `"eth_sendTransaction"`

Defined in: [src/lib/tx/txRouter.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L38)

***

### TxRouterContext

> **TxRouterContext** = `object`

Defined in: [src/lib/tx/txRouter.ts:49](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L49)

#### Properties

##### canonicalAddress

> **canonicalAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/tx/txRouter.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L55)

##### capabilities?

> `optional` **capabilities**: [`AccountCapabilities`](../../wallet/accountContext/types.md#accountcapabilities) \| `null`

Defined in: [src/lib/tx/txRouter.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L61)

##### chainId

> **chainId**: `number`

Defined in: [src/lib/tx/txRouter.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L50)

##### connectorId?

> `optional` **connectorId**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:59](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L59)

##### connectorName?

> `optional` **connectorName**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L60)

##### debug()?

> `optional` **debug**: (`event`) => `void`

Defined in: [src/lib/tx/txRouter.ts:62](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L62)

###### Parameters

###### event

[`TxRouterDebugEvent`](#txrouterdebugevent)

###### Returns

`void`

##### executionAddress

> **executionAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/tx/txRouter.ts:57](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L57)

##### executionMode

> **executionMode**: `"canonical"` \| `"eoa"`

Defined in: [src/lib/tx/txRouter.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L51)

##### executionTrack?

> `optional` **executionTrack**: [`UserExecutionTrack`](#userexecutiontrack) \| `null`

Defined in: [src/lib/tx/txRouter.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L52)

##### onSubmissionStatus()?

> `optional` **onSubmissionStatus**: (`message`) => `void`

Defined in: [src/lib/tx/txRouter.ts:63](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L63)

###### Parameters

###### message

`string`

###### Returns

`void`

##### preferEphemeralNonceLane?

> `optional` **preferEphemeralNonceLane**: `boolean`

Defined in: [src/lib/tx/txRouter.ts:67](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L67)

Canonical4337 only: start on a fresh EntryPoint nonce key (swap AA25 avoidance).

##### publicClient

> **publicClient**: `unknown`

Defined in: [src/lib/tx/txRouter.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L54)

##### signerAddress

> **signerAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/tx/txRouter.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L56)

##### signerType?

> `optional` **signerType**: [`SignerType`](../../wallet/accountContext/types.md#signertype-1)

Defined in: [src/lib/tx/txRouter.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L58)

##### waitForOnChainReceipt?

> `optional` **waitForOnChainReceipt**: `boolean`

Defined in: [src/lib/tx/txRouter.ts:65](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L65)

Canonical4337 only: return after bundler accept; poll receipt separately when false.

##### walletClient

> **walletClient**: `unknown`

Defined in: [src/lib/tx/txRouter.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L53)

***

### TxRouterDebugEvent

> **TxRouterDebugEvent** = `object`

Defined in: [src/lib/tx/txRouter.ts:78](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L78)

#### Properties

##### callsId?

> `optional` **callsId**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:97](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L97)

##### callTargets

> **callTargets**: `string`[]

Defined in: [src/lib/tx/txRouter.ts:85](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L85)

##### chainId

> **chainId**: `number`

Defined in: [src/lib/tx/txRouter.ts:83](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L83)

##### confirmingOnChain?

> `optional` **confirmingOnChain**: `boolean`

Defined in: [src/lib/tx/txRouter.ts:96](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L96)

True when submit succeeded but on-chain bundle tx is not resolved yet (canonical fast return).

##### connectorId?

> `optional` **connectorId**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:87](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L87)

##### connectorName?

> `optional` **connectorName**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:88](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L88)

##### durationMs?

> `optional` **durationMs**: `number`

Defined in: [src/lib/tx/txRouter.ts:94](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L94)

Wall time from `send_attempt` to `send_success` / `send_error` for this send leg.

##### error?

> `optional` **error**: `string`

Defined in: [src/lib/tx/txRouter.ts:98](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L98)

##### event

> **event**: `"route_selected"` \| `"send_attempt"` \| `"send_success"` \| `"send_error"` \| `"send_fallback"`

Defined in: [src/lib/tx/txRouter.ts:79](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L79)

##### fallbackMode?

> `optional` **fallbackMode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/tx/txRouter.ts:81](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L81)

##### method?

> `optional` **method**: [`TxMethod`](#txmethod)

Defined in: [src/lib/tx/txRouter.ts:82](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L82)

##### mode

> **mode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/tx/txRouter.ts:80](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L80)

##### reason?

> `optional` **reason**: `string`

Defined in: [src/lib/tx/txRouter.ts:86](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L86)

##### sender

> **sender**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:84](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L84)

##### smartWalletDetected?

> `optional` **smartWalletDetected**: `boolean`

Defined in: [src/lib/tx/txRouter.ts:89](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L89)

##### supportsSendCallsHint?

> `optional` **supportsSendCallsHint**: `boolean`

Defined in: [src/lib/tx/txRouter.ts:90](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L90)

##### txHash?

> `optional` **txHash**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:91](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L91)

##### userOpHash?

> `optional` **userOpHash**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:92](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L92)

***

### TxRouterSendResult

> **TxRouterSendResult** = `object`

Defined in: [src/lib/tx/txRouter.ts:101](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L101)

#### Properties

##### callsId

> **callsId**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:107](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L107)

##### method

> **method**: [`TxMethod`](#txmethod)

Defined in: [src/lib/tx/txRouter.ts:103](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L103)

##### mode

> **mode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/tx/txRouter.ts:102](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L102)

##### sender

> **sender**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/tx/txRouter.ts:104](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L104)

##### transactionHash

> **transactionHash**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:105](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L105)

##### txHashes

> **txHashes**: `string`[]

Defined in: [src/lib/tx/txRouter.ts:108](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L108)

##### userOpHash?

> `optional` **userOpHash**: `string` \| `null`

Defined in: [src/lib/tx/txRouter.ts:106](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L106)

***

### TxRoutingDecision

> **TxRoutingDecision** = `object`

Defined in: [src/lib/tx/txRouter.ts:70](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L70)

#### Properties

##### fallbackMode

> **fallbackMode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/tx/txRouter.ts:72](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L72)

##### mode

> **mode**: [`TxSendMode`](#txsendmode)

Defined in: [src/lib/tx/txRouter.ts:71](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L71)

##### reason

> **reason**: `string`

Defined in: [src/lib/tx/txRouter.ts:75](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L75)

##### smartWalletDetected

> **smartWalletDetected**: `boolean`

Defined in: [src/lib/tx/txRouter.ts:73](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L73)

##### supportsSendCallsHint

> **supportsSendCallsHint**: `boolean`

Defined in: [src/lib/tx/txRouter.ts:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L74)

***

### TxSendMode

> **TxSendMode** = `"sendCalls"` \| `"canonical4337"` \| `"canonicalDirect"` \| `"eoaDirect"`

Defined in: [src/lib/tx/txRouter.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L37)

***

### UserExecutionTrack

> **UserExecutionTrack** = `"sub-account"` \| `"legacy-owner-install"` \| `"none-yet"` \| `"migration-pending"`

Defined in: [src/lib/tx/txRouter.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L43)

## Functions

### buildAndSendApproval()

> **buildAndSendApproval**(`params`): `Promise`\<\{ `routing`: [`TxRoutingDecision`](#txroutingdecision); `send`: [`TxRouterSendResult`](#txroutersendresult); \}\>

Defined in: [src/lib/tx/txRouter.ts:1133](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L1133)

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

Defined in: [src/lib/tx/txRouter.ts:1147](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L1147)

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

Defined in: [src/lib/tx/txRouter.ts:1168](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L1168)

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

Defined in: [src/lib/tx/txRouter.ts:408](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L408)

#### Parameters

##### context

[`TxRouterContext`](#txroutercontext)

#### Returns

[`TxRoutingDecision`](#txroutingdecision)

***

### normalizeCanonicalSendError()

> **normalizeCanonicalSendError**(`error`): `Error`

Defined in: [src/lib/tx/txRouter.ts:240](https://github.com/wenakita/4626/blob/main/frontend/src/lib/tx/txRouter.ts#L240)

#### Parameters

##### error

`unknown`

#### Returns

`Error`
