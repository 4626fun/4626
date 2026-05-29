[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/hooks/useCreatorAllowlist

# src/hooks/useCreatorAllowlist

## Type Aliases

### CreatorAllowlistMode

> **CreatorAllowlistMode** = `"disabled"` \| `"enforced"`

Defined in: [src/hooks/useCreatorAllowlist.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorAllowlist.ts#L6)

***

### CreatorAllowlistStatus

> **CreatorAllowlistStatus** = `object`

Defined in: [src/hooks/useCreatorAllowlist.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorAllowlist.ts#L8)

#### Properties

##### address

> **address**: `string` \| `null`

Defined in: [src/hooks/useCreatorAllowlist.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorAllowlist.ts#L9)

##### allowed

> **allowed**: `boolean`

Defined in: [src/hooks/useCreatorAllowlist.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorAllowlist.ts#L14)

##### coin

> **coin**: `string` \| `null`

Defined in: [src/hooks/useCreatorAllowlist.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorAllowlist.ts#L10)

##### creator

> **creator**: `string` \| `null`

Defined in: [src/hooks/useCreatorAllowlist.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorAllowlist.ts#L11)

##### mode

> **mode**: [`CreatorAllowlistMode`](#creatorallowlistmode)

Defined in: [src/hooks/useCreatorAllowlist.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorAllowlist.ts#L13)

##### payoutRecipient

> **payoutRecipient**: `string` \| `null`

Defined in: [src/hooks/useCreatorAllowlist.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorAllowlist.ts#L12)

## Functions

### useCreatorAllowlist()

#### Call Signature

> **useCreatorAllowlist**(`address?`): `UseQueryResult`\<[`CreatorAllowlistStatus`](#creatorallowliststatus)\>

Defined in: [src/hooks/useCreatorAllowlist.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorAllowlist.ts#L35)

##### Parameters

###### address?

`string` | `null`

##### Returns

`UseQueryResult`\<[`CreatorAllowlistStatus`](#creatorallowliststatus)\>

#### Call Signature

> **useCreatorAllowlist**(`params?`): `UseQueryResult`\<[`CreatorAllowlistStatus`](#creatorallowliststatus)\>

Defined in: [src/hooks/useCreatorAllowlist.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorAllowlist.ts#L36)

##### Parameters

###### params?

`CreatorAllowlistQuery`

##### Returns

`UseQueryResult`\<[`CreatorAllowlistStatus`](#creatorallowliststatus)\>
