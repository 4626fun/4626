[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/userPreferenceStore

# server/\_lib/alfaclub/userPreferenceStore

## Type Aliases

### AlfaClubUserPreferenceRecord

> **AlfaClubUserPreferenceRecord** = `object`

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L37)

#### Properties

##### preferenceKey

> **preferenceKey**: `string`

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L40)

##### preferenceValue

> **preferenceValue**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L41)

##### roomId

> **roomId**: `string`

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L38)

##### senderAddress

> **senderAddress**: `string`

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L39)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L43)

##### updatedBy

> **updatedBy**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L42)

## Variables

### \_userPreferenceInternals

> `const` **\_userPreferenceInternals**: `object`

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:383](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L383)

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

### clearUserPreferences()

> **clearUserPreferences**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:299](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L299)

Bulk-delete preferences for a (room, sender) under an optional key
prefix (e.g. `'hermit.'` clears all Hermit personalization but
leaves any future Keepr preferences alone). Returns `true` on
success regardless of how many rows existed.

#### Parameters

##### params

###### keyPrefix?

`string` \| `null`

###### roomId

`string`

###### senderAddress

`string`

#### Returns

`Promise`\<`boolean`\>

***

### deleteUserPreference()

> **deleteUserPreference**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:352](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L352)

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

### listUserPreferences()

> **listUserPreferences**(`params`): `Promise`\<[`AlfaClubUserPreferenceRecord`](#alfaclubuserpreferencerecord)[]\>

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:226](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L226)

List preferences for a (room, sender). Optional `keyPrefix` filter
(e.g. `'hermit.'`) — when present, only keys matching the prefix
are returned. Returns an empty array on any failure mode (DB
unavailable, query error, persistence disabled).

#### Parameters

##### params

###### keyPrefix?

`string` \| `null`

###### roomId

`string`

###### senderAddress

`string`

#### Returns

`Promise`\<[`AlfaClubUserPreferenceRecord`](#alfaclubuserpreferencerecord)[]\>

***

### readUserPreference()

> **readUserPreference**(`params`): `Promise`\<[`AlfaClubUserPreferenceRecord`](#alfaclubuserpreferencerecord) \| `null`\>

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:124](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L124)

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

Defined in: [server/\_lib/alfaclub/userPreferenceStore.ts:168](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/userPreferenceStore.ts#L168)

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
