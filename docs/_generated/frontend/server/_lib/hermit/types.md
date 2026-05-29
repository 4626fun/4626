[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/hermit/types

# server/\_lib/hermit/types

## Type Aliases

### HermitCommandKind

> **HermitCommandKind** = `"gmeow"` \| `"hermit"` \| `"meme"`

Defined in: [server/\_lib/hermit/types.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L15)

***

### HermitExecutionParams

> **HermitExecutionParams** = `object`

Defined in: [server/\_lib/hermit/types.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L83)

#### Properties

##### clearPreferences?

> `optional` **clearPreferences**: [`HermitPreferenceClearer`](#hermitpreferenceclearer) \| `null`

Defined in: [server/\_lib/hermit/types.ts:100](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L100)

Best-effort bulk-clear for `/hermit reset`. Optional.

##### commandText

> **commandText**: `string`

Defined in: [server/\_lib/hermit/types.ts:84](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L84)

##### listPreferences?

> `optional` **listPreferences**: [`HermitPreferenceLister`](#hermitpreferencelister) \| `null`

Defined in: [server/\_lib/hermit/types.ts:98](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L98)

Best-effort lister for `/hermit prefs`. Optional.

##### persistPreference?

> `optional` **persistPreference**: [`HermitPreferenceWriter`](#hermitpreferencewriter) \| `null`

Defined in: [server/\_lib/hermit/types.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L96)

Best-effort writer for explicit signals. Optional.

##### roomId?

> `optional` **roomId**: `string`

Defined in: [server/\_lib/hermit/types.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L92)

AlfaClub room id (digits in prod). Undefined for non-room callers.

##### senderAddress

> **senderAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/hermit/types.ts:85](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L85)

##### sourceIdentity?

> `optional` **sourceIdentity**: `string` \| `null`

Defined in: [server/\_lib/hermit/types.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L90)

Optional caller source identity (for routing guards), e.g.
`alfaclub-bridge-runner` or `openclaw-control-ui`.

##### userPreferences?

> `optional` **userPreferences**: [`HermitUserPreferences`](#hermituserpreferences) \| `null`

Defined in: [server/\_lib/hermit/types.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L94)

Resolved user preferences for this (room, sender).

***

### HermitExecutionResult

> **HermitExecutionResult** = `object`

Defined in: [server/\_lib/hermit/types.ts:103](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L103)

#### Properties

##### imagePrompt?

> `optional` **imagePrompt**: `string`

Defined in: [server/\_lib/hermit/types.ts:107](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L107)

##### kind

> **kind**: [`HermitCommandKind`](#hermitcommandkind)

Defined in: [server/\_lib/hermit/types.ts:104](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L104)

##### mediaAttachments?

> `optional` **mediaAttachments**: [`HermitMediaAttachment`](#hermitmediaattachment)[]

Defined in: [server/\_lib/hermit/types.ts:108](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L108)

##### meme?

> `optional` **meme**: [`HermitMeme`](#hermitmeme)

Defined in: [server/\_lib/hermit/types.ts:106](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L106)

##### provider

> **provider**: `"local"` \| `"pinata"`

Defined in: [server/\_lib/hermit/types.ts:109](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L109)

##### reply

> **reply**: `string`

Defined in: [server/\_lib/hermit/types.ts:105](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L105)

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

### HermitPreferenceClearer()

> **HermitPreferenceClearer** = () => `Promise`\<`boolean`\>

Defined in: [server/\_lib/hermit/types.ts:81](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L81)

Optional bulk-clear used by `/hermit reset`. Clears every Hermit
preference (`hermit.*` prefix) for the current (room, sender).
Best-effort: returns true on success, false on DB unavailable.

#### Returns

`Promise`\<`boolean`\>

***

### HermitPreferenceKey

> **HermitPreferenceKey** = `"hermit.spanish_dialect"` \| `"hermit.tone"` \| `"hermit.onboarded"`

Defined in: [server/\_lib/hermit/types.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L44)

Persistable Hermit preference keys. The AlfaClub control-plane
store accepts any `hermit.*` namespaced key generically, but the
type union below is the source of truth for which keys the
creative lane is allowed to write through `persistPreference`.

***

### HermitPreferenceLister()

> **HermitPreferenceLister** = () => `Promise`\<`object`[]\>

Defined in: [server/\_lib/hermit/types.ts:68](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L68)

Optional read-back of every Hermit preference for the current
(room, sender). Used by `/hermit prefs` to render a snapshot.
Returns an empty array when persistence is unavailable.

#### Returns

`Promise`\<`object`[]\>

***

### HermitPreferenceWriter()

> **HermitPreferenceWriter** = (`params`) => `Promise`\<`void`\> \| `void`

Defined in: [server/\_lib/hermit/types.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L57)

Optional callback used by `executeHermitCommand` to persist a fresh
explicit signal (flag emoji / text hint), an explicit `/hermit
lang` / `/hermit tone` selection, or the one-time onboarding flag.

Best-effort: returning false / throwing must not break the reply.
Implementations live in the AlfaClub lane (Vercel control plane).

#### Parameters

##### params

###### preferenceKey

[`HermitPreferenceKey`](#hermitpreferencekey)

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

##### onboardedAt?

> `optional` **onboardedAt**: `string` \| `null`

Defined in: [server/\_lib/hermit/types.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L35)

ISO timestamp of when the per-(room, sender) onboarding nudge was
last shown. Presence (any non-empty value) means "do not nudge
again". Absence means "nudge on next valid creative reply".

##### spanishDialect?

> `optional` **spanishDialect**: `string` \| `null`

Defined in: [server/\_lib/hermit/types.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L27)

Persisted Spanish dialect, if any. Trumped by an explicit signal.

##### tone?

> `optional` **tone**: `string` \| `null`

Defined in: [server/\_lib/hermit/types.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L29)

Persisted tone preference (e.g. `clean`, `degen`, `pro`, …).
