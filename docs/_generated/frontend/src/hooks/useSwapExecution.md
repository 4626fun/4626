[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/hooks/useSwapExecution

# src/hooks/useSwapExecution

## Type Aliases

### SwapCompletion

> **SwapCompletion** = `object`

Defined in: [src/hooks/useSwapExecution.ts:76](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSwapExecution.ts#L76)

#### Properties

##### amountInUnits

> **amountInUnits**: `string`

Defined in: [src/hooks/useSwapExecution.ts:79](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSwapExecution.ts#L79)

##### completedAt

> **completedAt**: `number`

Defined in: [src/hooks/useSwapExecution.ts:81](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSwapExecution.ts#L81)

##### estimatedOut

> **estimatedOut**: `string`

Defined in: [src/hooks/useSwapExecution.ts:80](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSwapExecution.ts#L80)

##### txHash

> **txHash**: `string` \| `null`

Defined in: [src/hooks/useSwapExecution.ts:77](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSwapExecution.ts#L77)

##### userOpHash?

> `optional` **userOpHash**: `string` \| `null`

Defined in: [src/hooks/useSwapExecution.ts:78](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSwapExecution.ts#L78)

## Functions

### assertSwapSpendBalancePreflight()

> **assertSwapSpendBalancePreflight**(`params`): `Promise`\<`void`\>

Defined in: [src/hooks/useSwapExecution.ts:380](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSwapExecution.ts#L380)

#### Parameters

##### params

###### amountInUnits

`string`

###### executionAddress

`` `0x${string}` `` \| `null`

###### getTokenDecimals

(`token`) => `Promise`\<`number`\>

###### publicClient

\{ `getBalance`: (`args`) => `Promise`\<`bigint`\>; `readContract?`: (`args`) => `Promise`\<`unknown`\>; \} \| `null` \| `undefined`

###### tokenIn

`string`

###### wrapNativeEthForCanonical

`boolean`

#### Returns

`Promise`\<`void`\>

***

### deriveSwapExecutionReadiness()

> **deriveSwapExecutionReadiness**(`params`): `boolean`

Defined in: [src/hooks/useSwapExecution.ts:218](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSwapExecution.ts#L218)

#### Parameters

##### params

###### canonicalAddress?

`string` \| `null`

###### canonicalPolicyApplies?

`boolean`

###### cdpCanonicalOnlyMode?

`boolean`

###### executionAddress?

`string` \| `null`

###### executionMode

`"canonical"` \| `"eoa"`

###### executionTrack?

[`UserExecutionTrack`](../lib/tx/txRouter.md#userexecutiontrack) \| `null`

###### quoteReady

`boolean`

###### signerAddress?

`string` \| `null`

#### Returns

`boolean`

***

### evaluateCanonicalSubmitSession()

> **evaluateCanonicalSubmitSession**(`input`): `CanonicalSubmitSessionResult`

Defined in: [src/hooks/useSwapExecution.ts:283](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSwapExecution.ts#L283)

#### Parameters

##### input

`CanonicalSubmitSessionInput`

#### Returns

`CanonicalSubmitSessionResult`

***

### evaluateSwapSessionGate()

> **evaluateSwapSessionGate**(`input`): `SwapSessionGateResult`

Defined in: [src/hooks/useSwapExecution.ts:194](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSwapExecution.ts#L194)

#### Parameters

##### input

`SwapSessionGateInput`

#### Returns

`SwapSessionGateResult`

***

### resolveCanonicalSubmitSession()

> **resolveCanonicalSubmitSession**(`input`, `ensureCanonicalSession?`): `Promise`\<`CanonicalSubmitSessionResult`\>

Defined in: [src/hooks/useSwapExecution.ts:161](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSwapExecution.ts#L161)

#### Parameters

##### input

`CanonicalSubmitSessionInput`

##### ensureCanonicalSession?

() => `Promise`\<`EnsureCanonicalSessionResult`\> | `null`

#### Returns

`Promise`\<`CanonicalSubmitSessionResult`\>

***

### shouldDisablePermit2ForSwap()

> **shouldDisablePermit2ForSwap**(`params`): `boolean`

Defined in: [src/hooks/useSwapExecution.ts:241](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSwapExecution.ts#L241)

#### Parameters

##### params

###### canonicalAddress?

`string` \| `null`

###### executionAddress?

`string` \| `null`

###### executionMode

`"canonical"` \| `"eoa"`

#### Returns

`boolean`

***

### shouldSimulateSwapTransaction()

> **shouldSimulateSwapTransaction**(`requiresApprovalTx`, `wrapsNativeEthForCanonical`): `boolean`

Defined in: [src/hooks/useSwapExecution.ts:371](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSwapExecution.ts#L371)

Uniswap simulateTransaction runs the swap tx alone; skip when approval or WETH wrap is batched later.

#### Parameters

##### requiresApprovalTx

`boolean`

##### wrapsNativeEthForCanonical

`boolean`

#### Returns

`boolean`

***

### useSwapExecution()

> **useSwapExecution**(`params`): `object`

Defined in: [src/hooks/useSwapExecution.ts:487](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSwapExecution.ts#L487)

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

() => `Promise`\<`EnsureCanonicalSessionResult`\> \| `null`

###### executionAddress

`` `0x${string}` `` \| `null`

###### executionMode

`"canonical"` \| `"eoa"`

###### executionReady

`boolean`

###### executionTrack?

[`UserExecutionTrack`](../lib/tx/txRouter.md#userexecutiontrack) \| `null`

###### expectedSessionAddress?

`string` \| `null`

###### hasSession?

`boolean`

###### parsedDeadlineMinutes

`number`

###### parsedSlippage

`number`

###### preferZoraTradeRoute?

`boolean`

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

##### clearSwapCompletion()

> **clearSwapCompletion**: () => `void`

###### Returns

`void`

##### closeConfirm()

> **closeConfirm**: () => `void`

###### Returns

`void`

##### confirmAndExecute()

> **confirmAndExecute**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### confirmIntent

> **confirmIntent**: `"swap"` \| `"approval"` \| `"order"` \| `null`

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

##### fallbackActive

> **fallbackActive**: `boolean`

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

`"swap"` | `"approval"` | `"order"`

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

##### quoteCooldownActive

> **quoteCooldownActive**: `boolean`

##### quoteCooldownUntil

> **quoteCooldownUntil**: `number` \| `null`

##### quoteIsStale

> **quoteIsStale**: `boolean`

##### quoteReady

> **quoteReady**: `boolean`

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

##### swapCompletion

> **swapCompletion**: [`SwapCompletion`](#swapcompletion) \| `null`

##### swapProvider

> **swapProvider**: `"uniswap"` \| `"cdp"`

##### swapProviderLabel

> **swapProviderLabel**: `"Uniswap"` \| `"CDP"`

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
