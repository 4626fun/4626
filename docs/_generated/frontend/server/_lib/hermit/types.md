[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/hermit/types

# server/\_lib/hermit/types

## Type Aliases

### HermitCommandKind

> **HermitCommandKind** = `"gmeow"` \| `"hermit"` \| `"meme"`

Defined in: [server/\_lib/hermit/types.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L15)

***

### HermitExecutionParams

> **HermitExecutionParams** = `object`

Defined in: [server/\_lib/hermit/types.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L43)

#### Properties

##### commandText

> **commandText**: `string`

Defined in: [server/\_lib/hermit/types.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L44)

##### persistPreference?

> `optional` **persistPreference**: [`HermitPreferenceWriter`](#hermitpreferencewriter) \| `null`

Defined in: [server/\_lib/hermit/types.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L51)

Best-effort writer for explicit signals. Optional.

##### roomId?

> `optional` **roomId**: `string`

Defined in: [server/\_lib/hermit/types.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L47)

AlfaClub room id (digits in prod). Undefined for non-room callers.

##### senderAddress

> **senderAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/hermit/types.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L45)

##### userPreferences?

> `optional` **userPreferences**: [`HermitUserPreferences`](#hermituserpreferences) \| `null`

Defined in: [server/\_lib/hermit/types.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L49)

Resolved user preferences for this (room, sender).

***

### HermitExecutionResult

> **HermitExecutionResult** = `object`

Defined in: [server/\_lib/hermit/types.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L54)

#### Properties

##### imagePrompt?

> `optional` **imagePrompt**: `string`

Defined in: [server/\_lib/hermit/types.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L58)

##### kind

> **kind**: [`HermitCommandKind`](#hermitcommandkind)

Defined in: [server/\_lib/hermit/types.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L55)

##### mediaAttachments?

> `optional` **mediaAttachments**: [`HermitMediaAttachment`](#hermitmediaattachment)[]

Defined in: [server/\_lib/hermit/types.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L59)

##### meme?

> `optional` **meme**: [`HermitMeme`](#hermitmeme)

Defined in: [server/\_lib/hermit/types.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L57)

##### provider

> **provider**: `"local"` \| `"pinata"`

Defined in: [server/\_lib/hermit/types.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L60)

##### reply

> **reply**: `string`

Defined in: [server/\_lib/hermit/types.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L56)

***

### HermitMediaAttachment

> **HermitMediaAttachment** = `object`

Defined in: [server/\_lib/hermit/types.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L8)

#### Properties

##### filename?

> `optional` **filename**: `string`

Defined in: [server/\_lib/hermit/types.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L11)

##### mime\_type?

> `optional` **mime\_type**: `string`

Defined in: [server/\_lib/hermit/types.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L12)

##### type

> **type**: `string`

Defined in: [server/\_lib/hermit/types.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L10)

##### url

> **url**: `string`

Defined in: [server/\_lib/hermit/types.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L9)

***

### HermitMeme

> **HermitMeme** = `object`

Defined in: [server/\_lib/hermit/types.ts:1](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L1)

#### Properties

##### caption

> **caption**: `string`

Defined in: [server/\_lib/hermit/types.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L4)

##### id

> **id**: `string`

Defined in: [server/\_lib/hermit/types.ts:2](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L2)

##### tags

> **tags**: `string`[]

Defined in: [server/\_lib/hermit/types.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L5)

##### url

> **url**: `string`

Defined in: [server/\_lib/hermit/types.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L3)

***

### HermitPreferenceWriter()

> **HermitPreferenceWriter** = (`params`) => `Promise`\<`void`\> \| `void`

Defined in: [server/\_lib/hermit/types.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L37)

Optional callback used by `executeHermitCommand` to persist a fresh
explicit signal (flag emoji / text hint) for the active sender.

Best-effort: returning false / throwing must not break the reply.
Implementations live in the AlfaClub lane (Vercel control plane).

#### Parameters

##### params

###### preferenceKey

`"hermit.spanish_dialect"`

###### preferenceValue

`string`

###### updatedBy

`string`

#### Returns

`Promise`\<`void`\> \| `void`

***

### HermitUserPreferences

> **HermitUserPreferences** = `object`

Defined in: [server/\_lib/hermit/types.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L25)

Per-user style preferences resolved from the AlfaClub control plane.

Hermit (creative lane) does NOT read or write this directly — it is
passed in by the chat-bridge or HTTP handler. This keeps the
boundary tests on `skillRouter` happy: nothing in the Hermit lane
imports `alfaclub/*Store` symbols.

#### Properties

##### spanishDialect?

> `optional` **spanishDialect**: `string` \| `null`

Defined in: [server/\_lib/hermit/types.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L27)

Persisted Spanish dialect, if any. Trumped by an explicit signal.
