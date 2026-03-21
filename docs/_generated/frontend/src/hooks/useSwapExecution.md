[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/useSwapExecution

# src/hooks/useSwapExecution

## Functions

### evaluateCanonicalSubmitSession()

> **evaluateCanonicalSubmitSession**(`input`): `CanonicalSubmitSessionResult`

Defined in: [src/hooks/useSwapExecution.ts:149](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useSwapExecution.ts#L149)

#### Parameters

##### input

`CanonicalSubmitSessionInput`

#### Returns

`CanonicalSubmitSessionResult`

***

### resolveCanonicalSubmitSession()

> **resolveCanonicalSubmitSession**(`input`, `ensureCanonicalSession?`): `Promise`\<`CanonicalSubmitSessionResult`\>

Defined in: [src/hooks/useSwapExecution.ts:101](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useSwapExecution.ts#L101)

#### Parameters

##### input

`CanonicalSubmitSessionInput`

##### ensureCanonicalSession?

() => `Promise`\<`boolean`\> | `null`

#### Returns

`Promise`\<`CanonicalSubmitSessionResult`\>

***

### useSwapExecution()

> **useSwapExecution**(`params`): `object`

Defined in: [src/hooks/useSwapExecution.ts:234](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useSwapExecution.ts#L234)

#### Parameters

##### params

###### address

`string` \| `undefined`

###### amountInUnits

`string`

###### canonicalAddress

`` `0x${string}` `` \| `null`

###### canonicalSignerDebug?

`CanonicalSignerDebugState` \| `null`

###### capabilities?

[`AccountCapabilities`](../wallet/accountContext/types.md#accountcapabilities) \| `null`

###### chainId?

`number`

###### connectorId?

`string` \| `null`

###### connectorName?

`string` \| `null`

###### ensureCanonicalSession?

() => `Promise`\<`boolean`\> \| `null`

###### executionAddress

`` `0x${string}` `` \| `null`

###### executionMode

`"canonical"` \| `"eoa"`

###### executionReady

`boolean`

###### hasSession?

`boolean`

###### parsedDeadlineMinutes

`number`

###### parsedSlippage

`number`

###### privyDebug?

`PrivyDebugState` \| `null`

###### publicClient

`any`

###### sessionAddress?

`string` \| `null`

###### sessionHydrated?

`boolean`

###### signerAddress

`` `0x${string}` `` \| `null`

###### signerType?

[`SignerType`](../wallet/accountContext/types.md#signertype-1)

###### tokenIn

`string`

###### tokenOut

`string`

###### walletClient

`unknown`

#### Returns

`object`

##### approvalData

> **approvalData**: `Record`\<`string`, `unknown`\> \| `null`

##### approvalRequired

> **approvalRequired**: `boolean`

##### busy

> **busy**: `string` \| `null`

##### canary7702Eligible

> **canary7702Eligible**: `boolean`

##### canonicalSubmitSession

> **canonicalSubmitSession**: `CanonicalSubmitSessionResult`

##### closeConfirm()

> **closeConfirm**: () => `void`

###### Returns

`void`

##### confirmAndExecute()

> **confirmAndExecute**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### confirmIntent

> **confirmIntent**: `"approval"` \| `"swap"` \| `"order"` \| `null`

##### diagnosticsBusy

> **diagnosticsBusy**: `boolean`

##### diagnosticsEnabled

> **diagnosticsEnabled**: `boolean`

##### diagnosticsResult

> **diagnosticsResult**: `Swap7702Diagnostics` \| `null`

##### error

> **error**: `string`

##### estimatedOut

> **estimatedOut**: `string`

##### handleBuildSwap()

> **handleBuildSwap**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### handleCheckApproval()

> **handleCheckApproval**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### handleQuote()

> **handleQuote**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### handleReviewTrade()

> **handleReviewTrade**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### isReady

> **isReady**: `boolean`

##### openConfirm()

> **openConfirm**: (`intent`) => `void`

###### Parameters

###### intent

`"approval"` | `"swap"` | `"order"`

###### Returns

`void`

##### permitSignaturePending

> **permitSignaturePending**: `boolean`

##### permitSignatureReady

> **permitSignatureReady**: `boolean`

##### permitSignatureRequired

> **permitSignatureRequired**: `boolean`

##### quote

> **quote**: [`TradeQuoteResponse`](../lib/uniswap/tradingApi.md#tradequoteresponse) \| `null`

##### quoteIsStale

> **quoteIsStale**: `boolean`

##### quoteUpdatedAt

> **quoteUpdatedAt**: `number` \| `null`

##### resetTradeState()

> **resetTradeState**: () => `void`

###### Returns

`void`

##### run7702DryRun()

> **run7702DryRun**: (`options?`) => `Promise`\<`Swap7702Diagnostics` \| `null`\>

###### Parameters

###### options?

###### silent?

`boolean`

###### Returns

`Promise`\<`Swap7702Diagnostics` \| `null`\>

##### setError

> **setError**: `Dispatch`\<`SetStateAction`\<`string`\>\>

##### setStatus

> **setStatus**: `Dispatch`\<`SetStateAction`\<`string`\>\>

##### setTxState

> **setTxState**: `Dispatch`\<`SetStateAction`\<`TxLifecycleState`\>\>

##### status

> **status**: `string`

##### swapTx

> **swapTx**: \{ `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `data`: `string`; `from`: `string`; `gasLimit?`: `string`; `gasPrice?`: `string`; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `to`: `string`; `value`: `string`; \} \| `null`

###### Type Declaration

\{ `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `data`: `string`; `from`: `string`; `gasLimit?`: `string`; `gasPrice?`: `string`; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `to`: `string`; `value`: `string`; \}

`null`

##### tokensEquivalent

> **tokensEquivalent**: `boolean`

##### txDebug

> **txDebug**: `SwapTxDebugState`

##### txHash

> **txHash**: `string` \| `null`

##### txState

> **txState**: `TxLifecycleState`
