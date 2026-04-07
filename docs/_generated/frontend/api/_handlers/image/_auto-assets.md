[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/image/\_auto-assets

# api/\_handlers/image/\_auto-assets

## Variables

### \_\_testables

> `const` **\_\_testables**: `object`

Defined in: [api/\_handlers/image/\_auto-assets.ts:346](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/image/_auto-assets.ts#L346)

#### Type Declaration

##### isAllowedAutoAssetSourceUrl()

> **isAllowedAutoAssetSourceUrl**: (`value`) => `boolean`

###### Parameters

###### value

`string` | `null` | `undefined`

###### Returns

`boolean`

##### normalizeAutoAssetSourceUrl()

> **normalizeAutoAssetSourceUrl**: (`value`) => `string` \| `null`

###### Parameters

###### value

`string` | `null` | `undefined`

###### Returns

`string` \| `null`

##### pickSafeZoraSubjectUrl()

> **pickSafeZoraSubjectUrl**: (`coinData`) => `string` \| `null`

###### Parameters

###### coinData

`any`

###### Returns

`string` \| `null`

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/image/\_auto-assets.ts:177](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/image/_auto-assets.ts#L177)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
