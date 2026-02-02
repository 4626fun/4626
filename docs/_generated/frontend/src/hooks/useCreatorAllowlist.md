[**creatorvault-miniapp**](../../index.md)

***

[creatorvault-miniapp](../../index.md) / src/hooks/useCreatorAllowlist

# src/hooks/useCreatorAllowlist

## Type Aliases

### CreatorAllowlistMode

> **CreatorAllowlistMode** = `"disabled"` \| `"enforced"`

Defined in: [hooks/useCreatorAllowlist.ts:5](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/hooks/useCreatorAllowlist.ts#L5)

***

### CreatorAllowlistStatus

> **CreatorAllowlistStatus** = `object`

Defined in: [hooks/useCreatorAllowlist.ts:7](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/hooks/useCreatorAllowlist.ts#L7)

#### Properties

##### address

> **address**: `string` \| `null`

Defined in: [hooks/useCreatorAllowlist.ts:8](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/hooks/useCreatorAllowlist.ts#L8)

##### allowed

> **allowed**: `boolean`

Defined in: [hooks/useCreatorAllowlist.ts:13](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/hooks/useCreatorAllowlist.ts#L13)

##### coin

> **coin**: `string` \| `null`

Defined in: [hooks/useCreatorAllowlist.ts:9](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/hooks/useCreatorAllowlist.ts#L9)

##### creator

> **creator**: `string` \| `null`

Defined in: [hooks/useCreatorAllowlist.ts:10](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/hooks/useCreatorAllowlist.ts#L10)

##### mode

> **mode**: [`CreatorAllowlistMode`](#creatorallowlistmode)

Defined in: [hooks/useCreatorAllowlist.ts:12](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/hooks/useCreatorAllowlist.ts#L12)

##### payoutRecipient

> **payoutRecipient**: `string` \| `null`

Defined in: [hooks/useCreatorAllowlist.ts:11](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/hooks/useCreatorAllowlist.ts#L11)

## Functions

### useCreatorAllowlist()

#### Call Signature

> **useCreatorAllowlist**(`address?`): `UseQueryResult`\<[`CreatorAllowlistStatus`](#creatorallowliststatus)\>

Defined in: [hooks/useCreatorAllowlist.ts:34](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/hooks/useCreatorAllowlist.ts#L34)

##### Parameters

###### address?

`string` | `null`

##### Returns

`UseQueryResult`\<[`CreatorAllowlistStatus`](#creatorallowliststatus)\>

#### Call Signature

> **useCreatorAllowlist**(`params?`): `UseQueryResult`\<[`CreatorAllowlistStatus`](#creatorallowliststatus)\>

Defined in: [hooks/useCreatorAllowlist.ts:35](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/hooks/useCreatorAllowlist.ts#L35)

##### Parameters

###### params?

`CreatorAllowlistQuery`

##### Returns

`UseQueryResult`\<[`CreatorAllowlistStatus`](#creatorallowliststatus)\>
