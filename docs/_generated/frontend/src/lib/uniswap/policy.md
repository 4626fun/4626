[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/uniswap/policy

# src/lib/uniswap/policy

## Type Aliases

### SwapPolicy

> **SwapPolicy** = `object`

Defined in: [src/lib/uniswap/policy.ts:3](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L3)

#### Properties

##### allowedRoutings

> **allowedRoutings**: `Set`\<`string`\> \| `null`

Defined in: [src/lib/uniswap/policy.ts:7](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L7)

##### canary7702Allowlist

> **canary7702Allowlist**: `Set`\<`string`\>

Defined in: [src/lib/uniswap/policy.ts:11](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L11)

##### canary7702Enabled

> **canary7702Enabled**: `boolean`

Defined in: [src/lib/uniswap/policy.ts:10](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L10)

##### diagnosticsEnabled

> **diagnosticsEnabled**: `boolean`

Defined in: [src/lib/uniswap/policy.ts:12](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L12)

##### enabled

> **enabled**: `boolean`

Defined in: [src/lib/uniswap/policy.ts:4](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L4)

##### maxInputBaseUnits

> **maxInputBaseUnits**: `bigint` \| `null`

Defined in: [src/lib/uniswap/policy.ts:6](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L6)

##### maxSlippageBps

> **maxSlippageBps**: `number` \| `null`

Defined in: [src/lib/uniswap/policy.ts:5](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L5)

##### tokenAllowlist

> **tokenAllowlist**: `Set`\<`string`\>

Defined in: [src/lib/uniswap/policy.ts:8](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L8)

##### tokenDenylist

> **tokenDenylist**: `Set`\<`string`\>

Defined in: [src/lib/uniswap/policy.ts:9](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L9)

***

### SwapPolicyDecision

> **SwapPolicyDecision** = `object`

Defined in: [src/lib/uniswap/policy.ts:15](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L15)

#### Properties

##### allowed

> **allowed**: `boolean`

Defined in: [src/lib/uniswap/policy.ts:16](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L16)

##### code

> **code**: `"OK"` \| `"TOKEN_DENYLIST"` \| `"TOKEN_ALLOWLIST"` \| `"MAX_SLIPPAGE"` \| `"MAX_INPUT"` \| `"ROUTING_NOT_ALLOWED"`

Defined in: [src/lib/uniswap/policy.ts:17](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L17)

##### message

> **message**: `string`

Defined in: [src/lib/uniswap/policy.ts:18](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L18)

## Functions

### evaluateSwapPolicyInput()

> **evaluateSwapPolicyInput**(`params`): [`SwapPolicyDecision`](#swappolicydecision)

Defined in: [src/lib/uniswap/policy.ts:105](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L105)

#### Parameters

##### params

###### amountBaseUnits?

`string` \| `null`

###### policy

[`SwapPolicy`](#swappolicy)

###### slippageBps?

`number` \| `null`

###### tokenIn

`string`

###### tokenOut

`string`

#### Returns

[`SwapPolicyDecision`](#swappolicydecision)

***

### evaluateSwapPolicyRouting()

> **evaluateSwapPolicyRouting**(`params`): [`SwapPolicyDecision`](#swappolicydecision)

Defined in: [src/lib/uniswap/policy.ts:151](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L151)

#### Parameters

##### params

###### policy

[`SwapPolicy`](#swappolicy)

###### routing

`unknown`

#### Returns

[`SwapPolicyDecision`](#swappolicydecision)

***

### parseSwapPolicyFromEnv()

> **parseSwapPolicyFromEnv**(`env`): [`SwapPolicy`](#swappolicy)

Defined in: [src/lib/uniswap/policy.ts:87](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L87)

#### Parameters

##### env

`EnvLike`

#### Returns

[`SwapPolicy`](#swappolicy)

***

### readClientSwapPolicy()

> **readClientSwapPolicy**(): [`SwapPolicy`](#swappolicy)

Defined in: [src/lib/uniswap/policy.ts:101](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L101)

#### Returns

[`SwapPolicy`](#swappolicy)

***

### shouldEnable7702CanaryForAddress()

> **shouldEnable7702CanaryForAddress**(`policy`, `address`): `boolean`

Defined in: [src/lib/uniswap/policy.ts:175](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/uniswap/policy.ts#L175)

#### Parameters

##### policy

[`SwapPolicy`](#swappolicy)

##### address

`string` | `null` | `undefined`

#### Returns

`boolean`
