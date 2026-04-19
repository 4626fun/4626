[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/useSwapState

# src/hooks/useSwapState

## Functions

### useSwapState()

> **useSwapState**(`params`): `object`

Defined in: [src/hooks/useSwapState.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSwapState.ts#L5)

#### Parameters

##### params

###### initialTokenIn

`string`

###### initialTokenOut

`string`

#### Returns

`object`

##### activePanel

> **activePanel**: `"swap"` \| `"liquidity"`

##### amountInUnits

> **amountInUnits**: `string`

##### deadlineMinutes

> **deadlineMinutes**: `string`

##### parsedDeadlineMinutes

> **parsedDeadlineMinutes**: `number`

##### parsedSlippage

> **parsedSlippage**: `number`

##### setActivePanel

> **setActivePanel**: `Dispatch`\<`SetStateAction`\<`"swap"` \| `"liquidity"`\>\>

##### setAmountInUnits()

> **setAmountInUnits**: (`value`) => `void`

###### Parameters

###### value

`string`

###### Returns

`void`

##### setDeadlineMinutes()

> **setDeadlineMinutes**: (`value`) => `void`

###### Parameters

###### value

`string`

###### Returns

`void`

##### setShowAdvanced

> **setShowAdvanced**: `Dispatch`\<`SetStateAction`\<`boolean`\>\>

##### setSlippagePct()

> **setSlippagePct**: (`value`) => `void`

###### Parameters

###### value

`string`

###### Returns

`void`

##### setTokenIn

> **setTokenIn**: `Dispatch`\<`SetStateAction`\<`string`\>\>

##### setTokenOut

> **setTokenOut**: `Dispatch`\<`SetStateAction`\<`string`\>\>

##### showAdvanced

> **showAdvanced**: `boolean`

##### slippagePct

> **slippagePct**: `string`

##### switchTokens()

> **switchTokens**: () => `void`

###### Returns

`void`

##### tokenIn

> **tokenIn**: `string`

##### tokenOut

> **tokenOut**: `string`
