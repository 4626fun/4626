[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/pages/deploy/deployVaultHelpers

# src/pages/deploy/deployVaultHelpers

## Variables

### DEPLOYMENT\_VERSION\_RE

> `const` **DEPLOYMENT\_VERSION\_RE**: `RegExp`

Defined in: [src/pages/deploy/deployVaultHelpers.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/deploy/deployVaultHelpers.ts#L18)

***

### MAX\_UINT256

> `const` **MAX\_UINT256**: `bigint`

Defined in: [src/pages/deploy/deployVaultHelpers.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/deploy/deployVaultHelpers.ts#L17)

***

### ZERO\_BYTES32

> `const` **ZERO\_BYTES32**: `string`

Defined in: [src/pages/deploy/deployVaultHelpers.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/deploy/deployVaultHelpers.ts#L16)

## Functions

### encodeUniswapV3Path()

> **encodeUniswapV3Path**(`tokens`, `fees`): `` `0x${string}` ``

Defined in: [src/pages/deploy/deployVaultHelpers.ts:103](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/deploy/deployVaultHelpers.ts#L103)

#### Parameters

##### tokens

`` `0x${string}` ``[]

##### fees

`number`[]

#### Returns

`` `0x${string}` ``

***

### findCreate2SaltForSuffix()

> **findCreate2SaltForSuffix**(`params`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [src/pages/deploy/deployVaultHelpers.ts:148](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/deploy/deployVaultHelpers.ts#L148)

#### Parameters

##### params

###### create2Deployer

`` `0x${string}` ``

###### initCode

`` `0x${string}` ``

###### isAddressDeployed?

(`addr`) => `Promise`\<`boolean`\>

###### maxTries

`number`

###### startAt?

`bigint`

###### suffix

`string`

###### yieldEvery?

`number`

#### Returns

`Promise`\<`` `0x${string}` `` \| `null`\>

***

### getHexByteLength()

> **getHexByteLength**(`hex`): `number` \| `null`

Defined in: [src/pages/deploy/deployVaultHelpers.ts:27](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/deploy/deployVaultHelpers.ts#L27)

#### Parameters

##### hex

`string`

#### Returns

`number` \| `null`

***

### isHexString()

> **isHexString**(`value`): `` value is `0x${string}` ``

Defined in: [src/pages/deploy/deployVaultHelpers.ts:23](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/deploy/deployVaultHelpers.ts#L23)

#### Parameters

##### value

`unknown`

#### Returns

`` value is `0x${string}` ``

***

### normalizeAddressArray()

> **normalizeAddressArray**(`value`): `` `0x${string}` ``[]

Defined in: [src/pages/deploy/deployVaultHelpers.ts:51](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/deploy/deployVaultHelpers.ts#L51)

#### Parameters

##### value

`unknown`

#### Returns

`` `0x${string}` ``[]

***

### normalizeAddressLike()

> **normalizeAddressLike**(`value`): `` `0x${string}` `` \| `null`

Defined in: [src/pages/deploy/deployVaultHelpers.ts:41](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/deploy/deployVaultHelpers.ts#L41)

#### Parameters

##### value

`unknown`

#### Returns

`` `0x${string}` `` \| `null`

***

### normalizeBytes32()

> **normalizeBytes32**(`value`): `` `0x${string}` `` \| `null`

Defined in: [src/pages/deploy/deployVaultHelpers.ts:34](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/deploy/deployVaultHelpers.ts#L34)

#### Parameters

##### value

`unknown`

#### Returns

`` `0x${string}` `` \| `null`

***

### normalizeDeploymentVersion()

> **normalizeDeploymentVersion**(`value`): `string` \| `null`

Defined in: [src/pages/deploy/deployVaultHelpers.ts:131](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/deploy/deployVaultHelpers.ts#L131)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### normalizeHexSuffix()

> **normalizeHexSuffix**(`value`): `string` \| `null`

Defined in: [src/pages/deploy/deployVaultHelpers.ts:139](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/deploy/deployVaultHelpers.ts#L139)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### parsePositiveTokenAmount()

> **parsePositiveTokenAmount**(`value`): `bigint` \| `null`

Defined in: [src/pages/deploy/deployVaultHelpers.ts:118](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/deploy/deployVaultHelpers.ts#L118)

#### Parameters

##### value

`unknown`

#### Returns

`bigint` \| `null`

***

### parseUint8()

> **parseUint8**(`value`): `number` \| `null`

Defined in: [src/pages/deploy/deployVaultHelpers.ts:73](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/deploy/deployVaultHelpers.ts#L73)

#### Parameters

##### value

`unknown`

#### Returns

`number` \| `null`

***

### parseUniswapV3Fee()

> **parseUniswapV3Fee**(`value`): `number` \| `null`

Defined in: [src/pages/deploy/deployVaultHelpers.ts:86](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/deploy/deployVaultHelpers.ts#L86)

#### Parameters

##### value

`unknown`

#### Returns

`number` \| `null`

***

### sameAddress()

> **sameAddress**(`a`, `b`): `boolean`

Defined in: [src/pages/deploy/deployVaultHelpers.ts:66](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/deploy/deployVaultHelpers.ts#L66)

#### Parameters

##### a

`unknown`

##### b

`unknown`

#### Returns

`boolean`
