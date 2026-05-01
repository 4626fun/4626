[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/alfaclub/userPreferenceStore

# server/\_lib/alfaclub/userPreferenceStore

## Type Aliases

### AlfaClubUserPreferenceRecord

> **AlfaClubUserPreferenceRecord** = `object`

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L37)

#### Properties

##### preferenceKey

> **preferenceKey**: `string`

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L40)

##### preferenceValue

> **preferenceValue**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L41)

##### roomId

> **roomId**: `string`

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L38)

##### senderAddress

> **senderAddress**: `string`

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L39)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L43)

##### updatedBy

> **updatedBy**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L42)

## Variables

### \_userPreferenceInternals

> `const` **\_userPreferenceInternals**: `object`

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:255](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L255)

#### Type Declaration

##### normalizePreferenceKey()

> **normalizePreferenceKey**: (`value`) => `string` \| `null`

###### Parameters

###### value

`string` | `null` | `undefined`

###### Returns

`string` \| `null`

##### normalizePreferenceValue()

> **normalizePreferenceValue**: (`value`) => `string` \| `null`

###### Parameters

###### value

`string` | `null` | `undefined`

###### Returns

`string` \| `null`

##### normalizeRoomId()

> **normalizeRoomId**: (`value`) => `string` \| `null`

###### Parameters

###### value

`string` | `null` | `undefined`

###### Returns

`string` \| `null`

##### normalizeSenderAddress()

> **normalizeSenderAddress**: (`value`) => `string` \| `null`

###### Parameters

###### value

`string` | `null` | `undefined`

###### Returns

`string` \| `null`

##### normalizeUpdatedBy()

> **normalizeUpdatedBy**: (`value`) => `string` \| `null`

###### Parameters

###### value

`string` | `null` | `undefined`

###### Returns

`string` \| `null`

## Functions

### deleteUserPreference()

> **deleteUserPreference**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:224](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L224)

Delete a preference. Idempotent. Returns `true` on success
(regardless of whether a row existed) and `false` on DB error.

#### Parameters

##### params

###### preferenceKey

`string`

###### roomId

`string`

###### senderAddress

`string`

#### Returns

`Promise`\<`boolean`\>

***

### readUserPreference()

> **readUserPreference**(`params`): `Promise`\<[`AlfaClubUserPreferenceRecord`](#alfaclubuserpreferencerecord) \| `null`\>

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:124](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L124)

Read a single preference. Returns `null` on any failure mode (DB
unavailable, query error, value missing) so callers can fall back
to their default behavior.

#### Parameters

##### params

###### preferenceKey

`string`

###### roomId

`string`

###### senderAddress

`string`

#### Returns

`Promise`\<[`AlfaClubUserPreferenceRecord`](#alfaclubuserpreferencerecord) \| `null`\>

***

### upsertUserPreference()

> **upsertUserPreference**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:168](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L168)

Upsert a preference. Returns `true` if the row landed, `false`
otherwise (DB unavailable, validation failure, query error). Callers
should not throw on a `false` — the chat reply must still go out.

#### Parameters

##### params

###### preferenceKey

`string`

###### preferenceValue

`string` \| `null`

###### roomId

`string`

###### senderAddress

`string`

###### updatedBy?

`string` \| `null`

#### Returns

`Promise`\<`boolean`\>
