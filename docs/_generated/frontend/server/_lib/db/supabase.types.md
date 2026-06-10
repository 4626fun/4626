[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/db/supabase.types

# server/\_lib/db/supabase.types

## Type Aliases

### CompositeTypes

> **CompositeTypes**\<`PublicCompositeTypeNameOrOptions`, `CompositeTypeName`\> = `PublicCompositeTypeNameOrOptions` *extends* `object` ? `DatabaseWithoutInternals`\[`PublicCompositeTypeNameOrOptions`\[`"schema"`\]\]\[`"CompositeTypes"`\]\[`CompositeTypeName`\] : `PublicCompositeTypeNameOrOptions` *extends* keyof `DefaultSchema`\[`"CompositeTypes"`\] ? `DefaultSchema`\[`"CompositeTypes"`\]\[`PublicCompositeTypeNameOrOptions`\] : `never`

Defined in: [server/\_lib/db/supabase.types.ts:4716](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/supabase.types.ts#L4716)

#### Type Parameters

##### PublicCompositeTypeNameOrOptions

`PublicCompositeTypeNameOrOptions` *extends* keyof `DefaultSchema`\[`"CompositeTypes"`\] \| \{ `schema`: keyof `DatabaseWithoutInternals`; \}

##### CompositeTypeName

`CompositeTypeName` *extends* `PublicCompositeTypeNameOrOptions` *extends* `object` ? keyof `DatabaseWithoutInternals`\[`PublicCompositeTypeNameOrOptions`\[`"schema"`\]\]\[`"CompositeTypes"`\] : `never` = `never`

***

### Database

> **Database** = `object`

Defined in: [server/\_lib/db/supabase.types.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/supabase.types.ts#L9)

#### Properties

##### \_\_InternalSupabase

> **\_\_InternalSupabase**: `object`

Defined in: [server/\_lib/db/supabase.types.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/supabase.types.ts#L12)

###### PostgrestVersion

> **PostgrestVersion**: `"14.5"`

##### public

> **public**: `object`

Defined in: [server/\_lib/db/supabase.types.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/supabase.types.ts#L15)

###### CompositeTypes

> **CompositeTypes**: `{ [_ in never]: never }`

###### Enums

> **Enums**: `{ [_ in never]: never }`

###### Functions

> **Functions**: `object`

###### Functions.capture\_index\_usage\_snapshot

> **capture\_index\_usage\_snapshot**: `object`

###### Functions.capture\_index\_usage\_snapshot.Args

> **Args**: `never`

###### Functions.capture\_index\_usage\_snapshot.Returns

> **Returns**: `number`

###### Functions.cleanup\_expired\_rows

> **cleanup\_expired\_rows**: `object`

###### Functions.cleanup\_expired\_rows.Args

> **Args**: `never`

###### Functions.cleanup\_expired\_rows.Returns

> **Returns**: [`Json`](#json)

###### Functions.cleanup\_legacy\_backups

> **cleanup\_legacy\_backups**: `object`

###### Functions.cleanup\_legacy\_backups.Args

> **Args**: `object`

###### Functions.cleanup\_legacy\_backups.Args.p\_arena\_backup\_days?

> `optional` **p\_arena\_backup\_days**: `number`

###### Functions.cleanup\_legacy\_backups.Returns

> **Returns**: [`Json`](#json)

###### Functions.cleanup\_log\_retention

> **cleanup\_log\_retention**: `object`

###### Functions.cleanup\_log\_retention.Args

> **Args**: `object`

###### Functions.cleanup\_log\_retention.Args.p\_agent\_api\_log\_days?

> `optional` **p\_agent\_api\_log\_days**: `number`

###### Functions.cleanup\_log\_retention.Args.p\_chat\_command\_days?

> `optional` **p\_chat\_command\_days**: `number`

###### Functions.cleanup\_log\_retention.Args.p\_farcaster\_rollout\_days?

> `optional` **p\_farcaster\_rollout\_days**: `number`

###### Functions.cleanup\_log\_retention.Args.p\_telegram\_funnel\_days?

> `optional` **p\_telegram\_funnel\_days**: `number`

###### Functions.cleanup\_log\_retention.Args.p\_telegram\_link\_days?

> `optional` **p\_telegram\_link\_days**: `number`

###### Functions.cleanup\_log\_retention.Returns

> **Returns**: [`Json`](#json)

###### Functions.current\_privy\_user\_id

> **current\_privy\_user\_id**: `object`

###### Functions.current\_privy\_user\_id.Args

> **Args**: `never`

###### Functions.current\_privy\_user\_id.Returns

> **Returns**: `string`

###### Functions.index\_drop\_candidates

> **index\_drop\_candidates**: `object`

###### Functions.index\_drop\_candidates.Args

> **Args**: `object`

###### Functions.index\_drop\_candidates.Args.min\_days?

> `optional` **min\_days**: `number`

###### Functions.index\_drop\_candidates.Args.min\_samples?

> `optional` **min\_samples**: `number`

###### Functions.index\_drop\_candidates.Args.min\_table\_writes?

> `optional` **min\_table\_writes**: `number`

###### Functions.index\_drop\_candidates.Returns

> **Returns**: `object`[]

###### Functions.index\_drop\_migration\_draft

> **index\_drop\_migration\_draft**: `object`

###### Functions.index\_drop\_migration\_draft.Args

> **Args**: `object`

###### Functions.index\_drop\_migration\_draft.Args.min\_days?

> `optional` **min\_days**: `number`

###### Functions.index\_drop\_migration\_draft.Args.min\_samples?

> `optional` **min\_samples**: `number`

###### Functions.index\_drop\_migration\_draft.Args.min\_table\_writes?

> `optional` **min\_table\_writes**: `number`

###### Functions.index\_drop\_migration\_draft.Returns

> **Returns**: `string`

###### Functions.insert\_creator\_access\_request\_audit

> **insert\_creator\_access\_request\_audit**: `object`

###### Functions.insert\_creator\_access\_request\_audit.Args

> **Args**: `object`

###### Functions.insert\_creator\_access\_request\_audit.Args.p\_changed\_by

> **p\_changed\_by**: `string`

###### Functions.insert\_creator\_access\_request\_audit.Args.p\_new\_status

> **p\_new\_status**: `string`

###### Functions.insert\_creator\_access\_request\_audit.Args.p\_old\_status

> **p\_old\_status**: `string`

###### Functions.insert\_creator\_access\_request\_audit.Args.p\_request\_id

> **p\_request\_id**: `string`

###### Functions.insert\_creator\_access\_request\_audit.Returns

> **Returns**: `undefined`

###### Tables

> **Tables**: `object`

###### Tables.access\_requests

> **access\_requests**: `object`

###### Tables.access\_requests.Insert

> **Insert**: `object`

###### Tables.access\_requests.Insert.coin\_address?

> `optional` **coin\_address**: `string` \| `null`

###### Tables.access\_requests.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.access\_requests.Insert.decision\_note?

> `optional` **decision\_note**: `string` \| `null`

###### Tables.access\_requests.Insert.id?

> `optional` **id**: `number`

###### Tables.access\_requests.Insert.reviewed\_at?

> `optional` **reviewed\_at**: `string` \| `null`

###### Tables.access\_requests.Insert.reviewed\_by?

> `optional` **reviewed\_by**: `string` \| `null`

###### Tables.access\_requests.Insert.status?

> `optional` **status**: `string`

###### Tables.access\_requests.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.access\_requests.Insert.wallet\_address

> **wallet\_address**: `string`

###### Tables.access\_requests.Relationships

> **Relationships**: \[\]

###### Tables.access\_requests.Row

> **Row**: `object`

###### Tables.access\_requests.Row.coin\_address

> **coin\_address**: `string` \| `null`

###### Tables.access\_requests.Row.created\_at

> **created\_at**: `string`

###### Tables.access\_requests.Row.decision\_note

> **decision\_note**: `string` \| `null`

###### Tables.access\_requests.Row.id

> **id**: `number`

###### Tables.access\_requests.Row.reviewed\_at

> **reviewed\_at**: `string` \| `null`

###### Tables.access\_requests.Row.reviewed\_by

> **reviewed\_by**: `string` \| `null`

###### Tables.access\_requests.Row.status

> **status**: `string`

###### Tables.access\_requests.Row.updated\_at

> **updated\_at**: `string`

###### Tables.access\_requests.Row.wallet\_address

> **wallet\_address**: `string`

###### Tables.access\_requests.Update

> **Update**: `object`

###### Tables.access\_requests.Update.coin\_address?

> `optional` **coin\_address**: `string` \| `null`

###### Tables.access\_requests.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.access\_requests.Update.decision\_note?

> `optional` **decision\_note**: `string` \| `null`

###### Tables.access\_requests.Update.id?

> `optional` **id**: `number`

###### Tables.access\_requests.Update.reviewed\_at?

> `optional` **reviewed\_at**: `string` \| `null`

###### Tables.access\_requests.Update.reviewed\_by?

> `optional` **reviewed\_by**: `string` \| `null`

###### Tables.access\_requests.Update.status?

> `optional` **status**: `string`

###### Tables.access\_requests.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.access\_requests.Update.wallet\_address?

> `optional` **wallet\_address**: `string`

###### Tables.account\_linked\_methods

> **account\_linked\_methods**: `object`

###### Tables.account\_linked\_methods.Insert

> **Insert**: `object`

###### Tables.account\_linked\_methods.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.account\_linked\_methods.Insert.id?

> `optional` **id**: `string`

###### Tables.account\_linked\_methods.Insert.privy\_user\_id

> **privy\_user\_id**: `string`

###### Tables.account\_linked\_methods.Insert.type

> **type**: `string`

###### Tables.account\_linked\_methods.Insert.value

> **value**: `string`

###### Tables.account\_linked\_methods.Insert.verified?

> `optional` **verified**: `boolean`

###### Tables.account\_linked\_methods.Relationships

> **Relationships**: \[\{ `columns`: \[`"privy_user_id"`\]; `foreignKeyName`: `"account_linked_methods_privy_user_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"privy_user_id"`\]; `referencedRelation`: `"accounts"`; \}\]

###### Tables.account\_linked\_methods.Row

> **Row**: `object`

###### Tables.account\_linked\_methods.Row.created\_at

> **created\_at**: `string`

###### Tables.account\_linked\_methods.Row.id

> **id**: `string`

###### Tables.account\_linked\_methods.Row.privy\_user\_id

> **privy\_user\_id**: `string`

###### Tables.account\_linked\_methods.Row.type

> **type**: `string`

###### Tables.account\_linked\_methods.Row.value

> **value**: `string`

###### Tables.account\_linked\_methods.Row.verified

> **verified**: `boolean`

###### Tables.account\_linked\_methods.Update

> **Update**: `object`

###### Tables.account\_linked\_methods.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.account\_linked\_methods.Update.id?

> `optional` **id**: `string`

###### Tables.account\_linked\_methods.Update.privy\_user\_id?

> `optional` **privy\_user\_id**: `string`

###### Tables.account\_linked\_methods.Update.type?

> `optional` **type**: `string`

###### Tables.account\_linked\_methods.Update.value?

> `optional` **value**: `string`

###### Tables.account\_linked\_methods.Update.verified?

> `optional` **verified**: `boolean`

###### Tables.account\_zora\_signals

> **account\_zora\_signals**: `object`

###### Tables.account\_zora\_signals.Insert

> **Insert**: `object`

###### Tables.account\_zora\_signals.Insert.canonical\_csw\_address?

> `optional` **canonical\_csw\_address**: `string` \| `null`

###### Tables.account\_zora\_signals.Insert.creator\_coin\_address?

> `optional` **creator\_coin\_address**: `string` \| `null`

###### Tables.account\_zora\_signals.Insert.last\_resolved\_at?

> `optional` **last\_resolved\_at**: `string` \| `null`

###### Tables.account\_zora\_signals.Insert.privy\_user\_id

> **privy\_user\_id**: `string`

###### Tables.account\_zora\_signals.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.account\_zora\_signals.Insert.zora\_handle?

> `optional` **zora\_handle**: `string` \| `null`

###### Tables.account\_zora\_signals.Insert.zora\_linked?

> `optional` **zora\_linked**: `boolean`

###### Tables.account\_zora\_signals.Relationships

> **Relationships**: \[\{ `columns`: \[`"privy_user_id"`\]; `foreignKeyName`: `"account_zora_signals_privy_user_id_fkey"`; `isOneToOne`: `true`; `referencedColumns`: \[`"privy_user_id"`\]; `referencedRelation`: `"accounts"`; \}\]

###### Tables.account\_zora\_signals.Row

> **Row**: `object`

###### Tables.account\_zora\_signals.Row.canonical\_csw\_address

> **canonical\_csw\_address**: `string` \| `null`

###### Tables.account\_zora\_signals.Row.creator\_coin\_address

> **creator\_coin\_address**: `string` \| `null`

###### Tables.account\_zora\_signals.Row.last\_resolved\_at

> **last\_resolved\_at**: `string` \| `null`

###### Tables.account\_zora\_signals.Row.privy\_user\_id

> **privy\_user\_id**: `string`

###### Tables.account\_zora\_signals.Row.updated\_at

> **updated\_at**: `string`

###### Tables.account\_zora\_signals.Row.zora\_handle

> **zora\_handle**: `string` \| `null`

###### Tables.account\_zora\_signals.Row.zora\_linked

> **zora\_linked**: `boolean`

###### Tables.account\_zora\_signals.Update

> **Update**: `object`

###### Tables.account\_zora\_signals.Update.canonical\_csw\_address?

> `optional` **canonical\_csw\_address**: `string` \| `null`

###### Tables.account\_zora\_signals.Update.creator\_coin\_address?

> `optional` **creator\_coin\_address**: `string` \| `null`

###### Tables.account\_zora\_signals.Update.last\_resolved\_at?

> `optional` **last\_resolved\_at**: `string` \| `null`

###### Tables.account\_zora\_signals.Update.privy\_user\_id?

> `optional` **privy\_user\_id**: `string`

###### Tables.account\_zora\_signals.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.account\_zora\_signals.Update.zora\_handle?

> `optional` **zora\_handle**: `string` \| `null`

###### Tables.account\_zora\_signals.Update.zora\_linked?

> `optional` **zora\_linked**: `boolean`

###### Tables.accounts

> **accounts**: `object`

###### Tables.accounts.Insert

> **Insert**: `object`

###### Tables.accounts.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.accounts.Insert.email?

> `optional` **email**: `string` \| `null`

###### Tables.accounts.Insert.email\_verified?

> `optional` **email\_verified**: `boolean`

###### Tables.accounts.Insert.privy\_user\_id

> **privy\_user\_id**: `string`

###### Tables.accounts.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.accounts.Relationships

> **Relationships**: \[\]

###### Tables.accounts.Row

> **Row**: `object`

###### Tables.accounts.Row.created\_at

> **created\_at**: `string`

###### Tables.accounts.Row.email

> **email**: `string` \| `null`

###### Tables.accounts.Row.email\_verified

> **email\_verified**: `boolean`

###### Tables.accounts.Row.privy\_user\_id

> **privy\_user\_id**: `string`

###### Tables.accounts.Row.updated\_at

> **updated\_at**: `string`

###### Tables.accounts.Update

> **Update**: `object`

###### Tables.accounts.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.accounts.Update.email?

> `optional` **email**: `string` \| `null`

###### Tables.accounts.Update.email\_verified?

> `optional` **email\_verified**: `boolean`

###### Tables.accounts.Update.privy\_user\_id?

> `optional` **privy\_user\_id**: `string`

###### Tables.accounts.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.admin\_logs

> **admin\_logs**: `object`

###### Tables.admin\_logs.Insert

> **Insert**: `object`

###### Tables.admin\_logs.Insert.action

> **action**: `string`

###### Tables.admin\_logs.Insert.admin\_address

> **admin\_address**: `string`

###### Tables.admin\_logs.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.admin\_logs.Insert.details?

> `optional` **details**: [`Json`](#json) \| `null`

###### Tables.admin\_logs.Insert.id?

> `optional` **id**: `number`

###### Tables.admin\_logs.Insert.ip\_address?

> `optional` **ip\_address**: `string` \| `null`

###### Tables.admin\_logs.Insert.ip\_hash?

> `optional` **ip\_hash**: `string` \| `null`

###### Tables.admin\_logs.Insert.target\_id

> **target\_id**: `string`

###### Tables.admin\_logs.Insert.target\_type

> **target\_type**: `string`

###### Tables.admin\_logs.Relationships

> **Relationships**: \[\]

###### Tables.admin\_logs.Row

> **Row**: `object`

###### Tables.admin\_logs.Row.action

> **action**: `string`

###### Tables.admin\_logs.Row.admin\_address

> **admin\_address**: `string`

###### Tables.admin\_logs.Row.created\_at

> **created\_at**: `string`

###### Tables.admin\_logs.Row.details

> **details**: [`Json`](#json) \| `null`

###### Tables.admin\_logs.Row.id

> **id**: `number`

###### Tables.admin\_logs.Row.ip\_address

> **ip\_address**: `string` \| `null`

###### Tables.admin\_logs.Row.ip\_hash

> **ip\_hash**: `string` \| `null`

###### Tables.admin\_logs.Row.target\_id

> **target\_id**: `string`

###### Tables.admin\_logs.Row.target\_type

> **target\_type**: `string`

###### Tables.admin\_logs.Update

> **Update**: `object`

###### Tables.admin\_logs.Update.action?

> `optional` **action**: `string`

###### Tables.admin\_logs.Update.admin\_address?

> `optional` **admin\_address**: `string`

###### Tables.admin\_logs.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.admin\_logs.Update.details?

> `optional` **details**: [`Json`](#json) \| `null`

###### Tables.admin\_logs.Update.id?

> `optional` **id**: `number`

###### Tables.admin\_logs.Update.ip\_address?

> `optional` **ip\_address**: `string` \| `null`

###### Tables.admin\_logs.Update.ip\_hash?

> `optional` **ip\_hash**: `string` \| `null`

###### Tables.admin\_logs.Update.target\_id?

> `optional` **target\_id**: `string`

###### Tables.admin\_logs.Update.target\_type?

> `optional` **target\_type**: `string`

###### Tables.agent\_api\_logs

> **agent\_api\_logs**: `object`

###### Tables.agent\_api\_logs.Insert

> **Insert**: `object`

###### Tables.agent\_api\_logs.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.agent\_api\_logs.Insert.endpoint

> **endpoint**: `string`

###### Tables.agent\_api\_logs.Insert.id?

> `optional` **id**: `number`

###### Tables.agent\_api\_logs.Insert.ip\_hash?

> `optional` **ip\_hash**: `string` \| `null`

###### Tables.agent\_api\_logs.Insert.method

> **method**: `string`

###### Tables.agent\_api\_logs.Insert.user\_agent?

> `optional` **user\_agent**: `string` \| `null`

###### Tables.agent\_api\_logs.Relationships

> **Relationships**: \[\]

###### Tables.agent\_api\_logs.Row

> **Row**: `object`

###### Tables.agent\_api\_logs.Row.created\_at

> **created\_at**: `string`

###### Tables.agent\_api\_logs.Row.endpoint

> **endpoint**: `string`

###### Tables.agent\_api\_logs.Row.id

> **id**: `number`

###### Tables.agent\_api\_logs.Row.ip\_hash

> **ip\_hash**: `string` \| `null`

###### Tables.agent\_api\_logs.Row.method

> **method**: `string`

###### Tables.agent\_api\_logs.Row.user\_agent

> **user\_agent**: `string` \| `null`

###### Tables.agent\_api\_logs.Update

> **Update**: `object`

###### Tables.agent\_api\_logs.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.agent\_api\_logs.Update.endpoint?

> `optional` **endpoint**: `string`

###### Tables.agent\_api\_logs.Update.id?

> `optional` **id**: `number`

###### Tables.agent\_api\_logs.Update.ip\_hash?

> `optional` **ip\_hash**: `string` \| `null`

###### Tables.agent\_api\_logs.Update.method?

> `optional` **method**: `string`

###### Tables.agent\_api\_logs.Update.user\_agent?

> `optional` **user\_agent**: `string` \| `null`

###### Tables.agent\_background\_tasks

> **agent\_background\_tasks**: `object`

###### Tables.agent\_background\_tasks.Insert

> **Insert**: `object`

###### Tables.agent\_background\_tasks.Insert.attempts?

> `optional` **attempts**: `number`

###### Tables.agent\_background\_tasks.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.agent\_background\_tasks.Insert.id?

> `optional` **id**: `number`

###### Tables.agent\_background\_tasks.Insert.last\_error?

> `optional` **last\_error**: `string` \| `null`

###### Tables.agent\_background\_tasks.Insert.leased\_at?

> `optional` **leased\_at**: `string` \| `null`

###### Tables.agent\_background\_tasks.Insert.leased\_by?

> `optional` **leased\_by**: `string` \| `null`

###### Tables.agent\_background\_tasks.Insert.max\_attempts?

> `optional` **max\_attempts**: `number`

###### Tables.agent\_background\_tasks.Insert.payload\_json?

> `optional` **payload\_json**: [`Json`](#json)

###### Tables.agent\_background\_tasks.Insert.priority?

> `optional` **priority**: `number`

###### Tables.agent\_background\_tasks.Insert.run\_after?

> `optional` **run\_after**: `string`

###### Tables.agent\_background\_tasks.Insert.status?

> `optional` **status**: `string`

###### Tables.agent\_background\_tasks.Insert.task\_type

> **task\_type**: `string`

###### Tables.agent\_background\_tasks.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.agent\_background\_tasks.Relationships

> **Relationships**: \[\]

###### Tables.agent\_background\_tasks.Row

> **Row**: `object`

###### Tables.agent\_background\_tasks.Row.attempts

> **attempts**: `number`

###### Tables.agent\_background\_tasks.Row.created\_at

> **created\_at**: `string`

###### Tables.agent\_background\_tasks.Row.id

> **id**: `number`

###### Tables.agent\_background\_tasks.Row.last\_error

> **last\_error**: `string` \| `null`

###### Tables.agent\_background\_tasks.Row.leased\_at

> **leased\_at**: `string` \| `null`

###### Tables.agent\_background\_tasks.Row.leased\_by

> **leased\_by**: `string` \| `null`

###### Tables.agent\_background\_tasks.Row.max\_attempts

> **max\_attempts**: `number`

###### Tables.agent\_background\_tasks.Row.payload\_json

> **payload\_json**: [`Json`](#json)

###### Tables.agent\_background\_tasks.Row.priority

> **priority**: `number`

###### Tables.agent\_background\_tasks.Row.run\_after

> **run\_after**: `string`

###### Tables.agent\_background\_tasks.Row.status

> **status**: `string`

###### Tables.agent\_background\_tasks.Row.task\_type

> **task\_type**: `string`

###### Tables.agent\_background\_tasks.Row.updated\_at

> **updated\_at**: `string`

###### Tables.agent\_background\_tasks.Update

> **Update**: `object`

###### Tables.agent\_background\_tasks.Update.attempts?

> `optional` **attempts**: `number`

###### Tables.agent\_background\_tasks.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.agent\_background\_tasks.Update.id?

> `optional` **id**: `number`

###### Tables.agent\_background\_tasks.Update.last\_error?

> `optional` **last\_error**: `string` \| `null`

###### Tables.agent\_background\_tasks.Update.leased\_at?

> `optional` **leased\_at**: `string` \| `null`

###### Tables.agent\_background\_tasks.Update.leased\_by?

> `optional` **leased\_by**: `string` \| `null`

###### Tables.agent\_background\_tasks.Update.max\_attempts?

> `optional` **max\_attempts**: `number`

###### Tables.agent\_background\_tasks.Update.payload\_json?

> `optional` **payload\_json**: [`Json`](#json)

###### Tables.agent\_background\_tasks.Update.priority?

> `optional` **priority**: `number`

###### Tables.agent\_background\_tasks.Update.run\_after?

> `optional` **run\_after**: `string`

###### Tables.agent\_background\_tasks.Update.status?

> `optional` **status**: `string`

###### Tables.agent\_background\_tasks.Update.task\_type?

> `optional` **task\_type**: `string`

###### Tables.agent\_background\_tasks.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.agent\_control\_audit\_events

> **agent\_control\_audit\_events**: `object`

###### Tables.agent\_control\_audit\_events.Insert

> **Insert**: `object`

###### Tables.agent\_control\_audit\_events.Insert.action

> **action**: `string`

###### Tables.agent\_control\_audit\_events.Insert.actor\_id

> **actor\_id**: `string`

###### Tables.agent\_control\_audit\_events.Insert.actor\_type

> **actor\_type**: `string`

###### Tables.agent\_control\_audit\_events.Insert.capability\_id

> **capability\_id**: `string`

###### Tables.agent\_control\_audit\_events.Insert.correlation\_id

> **correlation\_id**: `string`

###### Tables.agent\_control\_audit\_events.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.agent\_control\_audit\_events.Insert.error\_code?

> `optional` **error\_code**: `string` \| `null`

###### Tables.agent\_control\_audit\_events.Insert.error\_message?

> `optional` **error\_message**: `string` \| `null`

###### Tables.agent\_control\_audit\_events.Insert.event\_id

> **event\_id**: `string`

###### Tables.agent\_control\_audit\_events.Insert.event\_type

> **event\_type**: `string`

###### Tables.agent\_control\_audit\_events.Insert.metadata\_json?

> `optional` **metadata\_json**: [`Json`](#json)

###### Tables.agent\_control\_audit\_events.Insert.proposal\_id

> **proposal\_id**: `string`

###### Tables.agent\_control\_audit\_events.Insert.reason?

> `optional` **reason**: `string` \| `null`

###### Tables.agent\_control\_audit\_events.Insert.status

> **status**: `string`

###### Tables.agent\_control\_audit\_events.Insert.subsystem

> **subsystem**: `string`

###### Tables.agent\_control\_audit\_events.Relationships

> **Relationships**: \[\]

###### Tables.agent\_control\_audit\_events.Row

> **Row**: `object`

###### Tables.agent\_control\_audit\_events.Row.action

> **action**: `string`

###### Tables.agent\_control\_audit\_events.Row.actor\_id

> **actor\_id**: `string`

###### Tables.agent\_control\_audit\_events.Row.actor\_type

> **actor\_type**: `string`

###### Tables.agent\_control\_audit\_events.Row.capability\_id

> **capability\_id**: `string`

###### Tables.agent\_control\_audit\_events.Row.correlation\_id

> **correlation\_id**: `string`

###### Tables.agent\_control\_audit\_events.Row.created\_at

> **created\_at**: `string`

###### Tables.agent\_control\_audit\_events.Row.error\_code

> **error\_code**: `string` \| `null`

###### Tables.agent\_control\_audit\_events.Row.error\_message

> **error\_message**: `string` \| `null`

###### Tables.agent\_control\_audit\_events.Row.event\_id

> **event\_id**: `string`

###### Tables.agent\_control\_audit\_events.Row.event\_type

> **event\_type**: `string`

###### Tables.agent\_control\_audit\_events.Row.metadata\_json

> **metadata\_json**: [`Json`](#json)

###### Tables.agent\_control\_audit\_events.Row.proposal\_id

> **proposal\_id**: `string`

###### Tables.agent\_control\_audit\_events.Row.reason

> **reason**: `string` \| `null`

###### Tables.agent\_control\_audit\_events.Row.status

> **status**: `string`

###### Tables.agent\_control\_audit\_events.Row.subsystem

> **subsystem**: `string`

###### Tables.agent\_control\_audit\_events.Update

> **Update**: `object`

###### Tables.agent\_control\_audit\_events.Update.action?

> `optional` **action**: `string`

###### Tables.agent\_control\_audit\_events.Update.actor\_id?

> `optional` **actor\_id**: `string`

###### Tables.agent\_control\_audit\_events.Update.actor\_type?

> `optional` **actor\_type**: `string`

###### Tables.agent\_control\_audit\_events.Update.capability\_id?

> `optional` **capability\_id**: `string`

###### Tables.agent\_control\_audit\_events.Update.correlation\_id?

> `optional` **correlation\_id**: `string`

###### Tables.agent\_control\_audit\_events.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.agent\_control\_audit\_events.Update.error\_code?

> `optional` **error\_code**: `string` \| `null`

###### Tables.agent\_control\_audit\_events.Update.error\_message?

> `optional` **error\_message**: `string` \| `null`

###### Tables.agent\_control\_audit\_events.Update.event\_id?

> `optional` **event\_id**: `string`

###### Tables.agent\_control\_audit\_events.Update.event\_type?

> `optional` **event\_type**: `string`

###### Tables.agent\_control\_audit\_events.Update.metadata\_json?

> `optional` **metadata\_json**: [`Json`](#json)

###### Tables.agent\_control\_audit\_events.Update.proposal\_id?

> `optional` **proposal\_id**: `string`

###### Tables.agent\_control\_audit\_events.Update.reason?

> `optional` **reason**: `string` \| `null`

###### Tables.agent\_control\_audit\_events.Update.status?

> `optional` **status**: `string`

###### Tables.agent\_control\_audit\_events.Update.subsystem?

> `optional` **subsystem**: `string`

###### Tables.agent\_message\_memory

> **agent\_message\_memory**: `object`

###### Tables.agent\_message\_memory.Insert

> **Insert**: `object`

###### Tables.agent\_message\_memory.Insert.agent\_id

> **agent\_id**: `string`

###### Tables.agent\_message\_memory.Insert.content

> **content**: `string`

###### Tables.agent\_message\_memory.Insert.conversation\_id

> **conversation\_id**: `string`

###### Tables.agent\_message\_memory.Insert.conversation\_type?

> `optional` **conversation\_type**: `string` \| `null`

###### Tables.agent\_message\_memory.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.agent\_message\_memory.Insert.embedding?

> `optional` **embedding**: `string` \| `null`

###### Tables.agent\_message\_memory.Insert.entity\_id?

> `optional` **entity\_id**: `string` \| `null`

###### Tables.agent\_message\_memory.Insert.id

> **id**: `string`

###### Tables.agent\_message\_memory.Insert.metadata\_json?

> `optional` **metadata\_json**: [`Json`](#json) \| `null`

###### Tables.agent\_message\_memory.Insert.role

> **role**: `string`

###### Tables.agent\_message\_memory.Insert.room\_id

> **room\_id**: `string`

###### Tables.agent\_message\_memory.Insert.sender\_address?

> `optional` **sender\_address**: `string` \| `null`

###### Tables.agent\_message\_memory.Relationships

> **Relationships**: \[\]

###### Tables.agent\_message\_memory.Row

> **Row**: `object`

###### Tables.agent\_message\_memory.Row.agent\_id

> **agent\_id**: `string`

###### Tables.agent\_message\_memory.Row.content

> **content**: `string`

###### Tables.agent\_message\_memory.Row.conversation\_id

> **conversation\_id**: `string`

###### Tables.agent\_message\_memory.Row.conversation\_type

> **conversation\_type**: `string` \| `null`

###### Tables.agent\_message\_memory.Row.created\_at

> **created\_at**: `string`

###### Tables.agent\_message\_memory.Row.embedding

> **embedding**: `string` \| `null`

###### Tables.agent\_message\_memory.Row.entity\_id

> **entity\_id**: `string` \| `null`

###### Tables.agent\_message\_memory.Row.id

> **id**: `string`

###### Tables.agent\_message\_memory.Row.metadata\_json

> **metadata\_json**: [`Json`](#json) \| `null`

###### Tables.agent\_message\_memory.Row.role

> **role**: `string`

###### Tables.agent\_message\_memory.Row.room\_id

> **room\_id**: `string`

###### Tables.agent\_message\_memory.Row.sender\_address

> **sender\_address**: `string` \| `null`

###### Tables.agent\_message\_memory.Update

> **Update**: `object`

###### Tables.agent\_message\_memory.Update.agent\_id?

> `optional` **agent\_id**: `string`

###### Tables.agent\_message\_memory.Update.content?

> `optional` **content**: `string`

###### Tables.agent\_message\_memory.Update.conversation\_id?

> `optional` **conversation\_id**: `string`

###### Tables.agent\_message\_memory.Update.conversation\_type?

> `optional` **conversation\_type**: `string` \| `null`

###### Tables.agent\_message\_memory.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.agent\_message\_memory.Update.embedding?

> `optional` **embedding**: `string` \| `null`

###### Tables.agent\_message\_memory.Update.entity\_id?

> `optional` **entity\_id**: `string` \| `null`

###### Tables.agent\_message\_memory.Update.id?

> `optional` **id**: `string`

###### Tables.agent\_message\_memory.Update.metadata\_json?

> `optional` **metadata\_json**: [`Json`](#json) \| `null`

###### Tables.agent\_message\_memory.Update.role?

> `optional` **role**: `string`

###### Tables.agent\_message\_memory.Update.room\_id?

> `optional` **room\_id**: `string`

###### Tables.agent\_message\_memory.Update.sender\_address?

> `optional` **sender\_address**: `string` \| `null`

###### Tables.agent\_rate\_limits

> **agent\_rate\_limits**: `object`

###### Tables.agent\_rate\_limits.Insert

> **Insert**: `object`

###### Tables.agent\_rate\_limits.Insert.count?

> `optional` **count**: `number`

###### Tables.agent\_rate\_limits.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.agent\_rate\_limits.Insert.key

> **key**: `string`

###### Tables.agent\_rate\_limits.Insert.window\_id

> **window\_id**: `number`

###### Tables.agent\_rate\_limits.Relationships

> **Relationships**: \[\]

###### Tables.agent\_rate\_limits.Row

> **Row**: `object`

###### Tables.agent\_rate\_limits.Row.count

> **count**: `number`

###### Tables.agent\_rate\_limits.Row.created\_at

> **created\_at**: `string`

###### Tables.agent\_rate\_limits.Row.key

> **key**: `string`

###### Tables.agent\_rate\_limits.Row.window\_id

> **window\_id**: `number`

###### Tables.agent\_rate\_limits.Update

> **Update**: `object`

###### Tables.agent\_rate\_limits.Update.count?

> `optional` **count**: `number`

###### Tables.agent\_rate\_limits.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.agent\_rate\_limits.Update.key?

> `optional` **key**: `string`

###### Tables.agent\_rate\_limits.Update.window\_id?

> `optional` **window\_id**: `number`

###### Tables.agent\_registration\_state

> **agent\_registration\_state**: `object`

###### Tables.agent\_registration\_state.Insert

> **Insert**: `object`

###### Tables.agent\_registration\_state.Insert.agent\_key

> **agent\_key**: `string`

###### Tables.agent\_registration\_state.Insert.gateway\_url?

> `optional` **gateway\_url**: `string` \| `null`

###### Tables.agent\_registration\_state.Insert.lens\_uri

> **lens\_uri**: `string`

###### Tables.agent\_registration\_state.Insert.payload\_hash

> **payload\_hash**: `string`

###### Tables.agent\_registration\_state.Insert.storage\_key?

> `optional` **storage\_key**: `string` \| `null`

###### Tables.agent\_registration\_state.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.agent\_registration\_state.Relationships

> **Relationships**: \[\]

###### Tables.agent\_registration\_state.Row

> **Row**: `object`

###### Tables.agent\_registration\_state.Row.agent\_key

> **agent\_key**: `string`

###### Tables.agent\_registration\_state.Row.gateway\_url

> **gateway\_url**: `string` \| `null`

###### Tables.agent\_registration\_state.Row.lens\_uri

> **lens\_uri**: `string`

###### Tables.agent\_registration\_state.Row.payload\_hash

> **payload\_hash**: `string`

###### Tables.agent\_registration\_state.Row.storage\_key

> **storage\_key**: `string` \| `null`

###### Tables.agent\_registration\_state.Row.updated\_at

> **updated\_at**: `string`

###### Tables.agent\_registration\_state.Update

> **Update**: `object`

###### Tables.agent\_registration\_state.Update.agent\_key?

> `optional` **agent\_key**: `string`

###### Tables.agent\_registration\_state.Update.gateway\_url?

> `optional` **gateway\_url**: `string` \| `null`

###### Tables.agent\_registration\_state.Update.lens\_uri?

> `optional` **lens\_uri**: `string`

###### Tables.agent\_registration\_state.Update.payload\_hash?

> `optional` **payload\_hash**: `string`

###### Tables.agent\_registration\_state.Update.storage\_key?

> `optional` **storage\_key**: `string` \| `null`

###### Tables.agent\_registration\_state.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.agent\_runtime\_leases

> **agent\_runtime\_leases**: `object`

###### Tables.agent\_runtime\_leases.Insert

> **Insert**: `object`

###### Tables.agent\_runtime\_leases.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.agent\_runtime\_leases.Insert.heartbeat\_at?

> `optional` **heartbeat\_at**: `string`

###### Tables.agent\_runtime\_leases.Insert.lease\_key

> **lease\_key**: `string`

###### Tables.agent\_runtime\_leases.Insert.owner\_id

> **owner\_id**: `string`

###### Tables.agent\_runtime\_leases.Insert.runtime\_role

> **runtime\_role**: `string`

###### Tables.agent\_runtime\_leases.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.agent\_runtime\_leases.Relationships

> **Relationships**: \[\]

###### Tables.agent\_runtime\_leases.Row

> **Row**: `object`

###### Tables.agent\_runtime\_leases.Row.created\_at

> **created\_at**: `string`

###### Tables.agent\_runtime\_leases.Row.heartbeat\_at

> **heartbeat\_at**: `string`

###### Tables.agent\_runtime\_leases.Row.lease\_key

> **lease\_key**: `string`

###### Tables.agent\_runtime\_leases.Row.owner\_id

> **owner\_id**: `string`

###### Tables.agent\_runtime\_leases.Row.runtime\_role

> **runtime\_role**: `string`

###### Tables.agent\_runtime\_leases.Row.updated\_at

> **updated\_at**: `string`

###### Tables.agent\_runtime\_leases.Update

> **Update**: `object`

###### Tables.agent\_runtime\_leases.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.agent\_runtime\_leases.Update.heartbeat\_at?

> `optional` **heartbeat\_at**: `string`

###### Tables.agent\_runtime\_leases.Update.lease\_key?

> `optional` **lease\_key**: `string`

###### Tables.agent\_runtime\_leases.Update.owner\_id?

> `optional` **owner\_id**: `string`

###### Tables.agent\_runtime\_leases.Update.runtime\_role?

> `optional` **runtime\_role**: `string`

###### Tables.agent\_runtime\_leases.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.alfaclub\_chat\_ingest

> **alfaclub\_chat\_ingest**: `object`

###### Tables.alfaclub\_chat\_ingest.Insert

> **Insert**: `object`

###### Tables.alfaclub\_chat\_ingest.Insert.ingested\_at?

> `optional` **ingested\_at**: `string`

###### Tables.alfaclub\_chat\_ingest.Insert.message\_date?

> `optional` **message\_date**: `string` \| `null`

###### Tables.alfaclub\_chat\_ingest.Insert.message\_id

> **message\_id**: `string`

###### Tables.alfaclub\_chat\_ingest.Insert.message\_text?

> `optional` **message\_text**: `string`

###### Tables.alfaclub\_chat\_ingest.Insert.raw\_payload\_text?

> `optional` **raw\_payload\_text**: `string` \| `null`

###### Tables.alfaclub\_chat\_ingest.Insert.room\_id

> **room\_id**: `string`

###### Tables.alfaclub\_chat\_ingest.Insert.sender\_address

> **sender\_address**: `string`

###### Tables.alfaclub\_chat\_ingest.Insert.source?

> `optional` **source**: `string`

###### Tables.alfaclub\_chat\_ingest.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.alfaclub\_chat\_ingest.Relationships

> **Relationships**: \[\]

###### Tables.alfaclub\_chat\_ingest.Row

> **Row**: `object`

###### Tables.alfaclub\_chat\_ingest.Row.ingested\_at

> **ingested\_at**: `string`

###### Tables.alfaclub\_chat\_ingest.Row.message\_date

> **message\_date**: `string` \| `null`

###### Tables.alfaclub\_chat\_ingest.Row.message\_id

> **message\_id**: `string`

###### Tables.alfaclub\_chat\_ingest.Row.message\_text

> **message\_text**: `string`

###### Tables.alfaclub\_chat\_ingest.Row.raw\_payload\_text

> **raw\_payload\_text**: `string` \| `null`

###### Tables.alfaclub\_chat\_ingest.Row.room\_id

> **room\_id**: `string`

###### Tables.alfaclub\_chat\_ingest.Row.sender\_address

> **sender\_address**: `string`

###### Tables.alfaclub\_chat\_ingest.Row.source

> **source**: `string`

###### Tables.alfaclub\_chat\_ingest.Row.updated\_at

> **updated\_at**: `string`

###### Tables.alfaclub\_chat\_ingest.Update

> **Update**: `object`

###### Tables.alfaclub\_chat\_ingest.Update.ingested\_at?

> `optional` **ingested\_at**: `string`

###### Tables.alfaclub\_chat\_ingest.Update.message\_date?

> `optional` **message\_date**: `string` \| `null`

###### Tables.alfaclub\_chat\_ingest.Update.message\_id?

> `optional` **message\_id**: `string`

###### Tables.alfaclub\_chat\_ingest.Update.message\_text?

> `optional` **message\_text**: `string`

###### Tables.alfaclub\_chat\_ingest.Update.raw\_payload\_text?

> `optional` **raw\_payload\_text**: `string` \| `null`

###### Tables.alfaclub\_chat\_ingest.Update.room\_id?

> `optional` **room\_id**: `string`

###### Tables.alfaclub\_chat\_ingest.Update.sender\_address?

> `optional` **sender\_address**: `string`

###### Tables.alfaclub\_chat\_ingest.Update.source?

> `optional` **source**: `string`

###### Tables.alfaclub\_chat\_ingest.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.alfaclub\_creators

> **alfaclub\_creators**: `object`

###### Tables.alfaclub\_creators.Insert

> **Insert**: `object`

###### Tables.alfaclub\_creators.Insert.creator\_address

> **creator\_address**: `string`

###### Tables.alfaclub\_creators.Insert.minted\_at?

> `optional` **minted\_at**: `string`

###### Tables.alfaclub\_creators.Insert.minted\_at\_block

> **minted\_at\_block**: `number`

###### Tables.alfaclub\_creators.Insert.staking\_pool?

> `optional` **staking\_pool**: `string` \| `null`

###### Tables.alfaclub\_creators.Insert.token\_id

> **token\_id**: `string`

###### Tables.alfaclub\_creators.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.alfaclub\_creators.Relationships

> **Relationships**: \[\]

###### Tables.alfaclub\_creators.Row

> **Row**: `object`

###### Tables.alfaclub\_creators.Row.creator\_address

> **creator\_address**: `string`

###### Tables.alfaclub\_creators.Row.minted\_at

> **minted\_at**: `string`

###### Tables.alfaclub\_creators.Row.minted\_at\_block

> **minted\_at\_block**: `number`

###### Tables.alfaclub\_creators.Row.staking\_pool

> **staking\_pool**: `string` \| `null`

###### Tables.alfaclub\_creators.Row.token\_id

> **token\_id**: `string`

###### Tables.alfaclub\_creators.Row.updated\_at

> **updated\_at**: `string`

###### Tables.alfaclub\_creators.Update

> **Update**: `object`

###### Tables.alfaclub\_creators.Update.creator\_address?

> `optional` **creator\_address**: `string`

###### Tables.alfaclub\_creators.Update.minted\_at?

> `optional` **minted\_at**: `string`

###### Tables.alfaclub\_creators.Update.minted\_at\_block?

> `optional` **minted\_at\_block**: `number`

###### Tables.alfaclub\_creators.Update.staking\_pool?

> `optional` **staking\_pool**: `string` \| `null`

###### Tables.alfaclub\_creators.Update.token\_id?

> `optional` **token\_id**: `string`

###### Tables.alfaclub\_creators.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.alfaclub\_indexer\_cursor

> **alfaclub\_indexer\_cursor**: `object`

###### Tables.alfaclub\_indexer\_cursor.Insert

> **Insert**: `object`

###### Tables.alfaclub\_indexer\_cursor.Insert.cursor\_key

> **cursor\_key**: `string`

###### Tables.alfaclub\_indexer\_cursor.Insert.last\_block

> **last\_block**: `number`

###### Tables.alfaclub\_indexer\_cursor.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.alfaclub\_indexer\_cursor.Relationships

> **Relationships**: \[\]

###### Tables.alfaclub\_indexer\_cursor.Row

> **Row**: `object`

###### Tables.alfaclub\_indexer\_cursor.Row.cursor\_key

> **cursor\_key**: `string`

###### Tables.alfaclub\_indexer\_cursor.Row.last\_block

> **last\_block**: `number`

###### Tables.alfaclub\_indexer\_cursor.Row.updated\_at

> **updated\_at**: `string`

###### Tables.alfaclub\_indexer\_cursor.Update

> **Update**: `object`

###### Tables.alfaclub\_indexer\_cursor.Update.cursor\_key?

> `optional` **cursor\_key**: `string`

###### Tables.alfaclub\_indexer\_cursor.Update.last\_block?

> `optional` **last\_block**: `number`

###### Tables.alfaclub\_indexer\_cursor.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.alfaclub\_metrics\_snapshot

> **alfaclub\_metrics\_snapshot**: `object`

###### Tables.alfaclub\_metrics\_snapshot.Insert

> **Insert**: `object`

###### Tables.alfaclub\_metrics\_snapshot.Insert.creator\_address

> **creator\_address**: `string`

###### Tables.alfaclub\_metrics\_snapshot.Insert.hl\_account\_value?

> `optional` **hl\_account\_value**: `number` \| `null`

###### Tables.alfaclub\_metrics\_snapshot.Insert.pnl\_30d\_usd?

> `optional` **pnl\_30d\_usd**: `number` \| `null`

###### Tables.alfaclub\_metrics\_snapshot.Insert.rank?

> `optional` **rank**: `number`

###### Tables.alfaclub\_metrics\_snapshot.Insert.score?

> `optional` **score**: `number`

###### Tables.alfaclub\_metrics\_snapshot.Insert.snapshot\_ts

> **snapshot\_ts**: `string`

###### Tables.alfaclub\_metrics\_snapshot.Insert.staked\_supply?

> `optional` **staked\_supply**: `number`

###### Tables.alfaclub\_metrics\_snapshot.Insert.token\_id

> **token\_id**: `string`

###### Tables.alfaclub\_metrics\_snapshot.Insert.total\_supply?

> `optional` **total\_supply**: `number`

###### Tables.alfaclub\_metrics\_snapshot.Relationships

> **Relationships**: \[\]

###### Tables.alfaclub\_metrics\_snapshot.Row

> **Row**: `object`

###### Tables.alfaclub\_metrics\_snapshot.Row.creator\_address

> **creator\_address**: `string`

###### Tables.alfaclub\_metrics\_snapshot.Row.hl\_account\_value

> **hl\_account\_value**: `number` \| `null`

###### Tables.alfaclub\_metrics\_snapshot.Row.pnl\_30d\_usd

> **pnl\_30d\_usd**: `number` \| `null`

###### Tables.alfaclub\_metrics\_snapshot.Row.rank

> **rank**: `number`

###### Tables.alfaclub\_metrics\_snapshot.Row.score

> **score**: `number`

###### Tables.alfaclub\_metrics\_snapshot.Row.snapshot\_ts

> **snapshot\_ts**: `string`

###### Tables.alfaclub\_metrics\_snapshot.Row.staked\_supply

> **staked\_supply**: `number`

###### Tables.alfaclub\_metrics\_snapshot.Row.token\_id

> **token\_id**: `string`

###### Tables.alfaclub\_metrics\_snapshot.Row.total\_supply

> **total\_supply**: `number`

###### Tables.alfaclub\_metrics\_snapshot.Update

> **Update**: `object`

###### Tables.alfaclub\_metrics\_snapshot.Update.creator\_address?

> `optional` **creator\_address**: `string`

###### Tables.alfaclub\_metrics\_snapshot.Update.hl\_account\_value?

> `optional` **hl\_account\_value**: `number` \| `null`

###### Tables.alfaclub\_metrics\_snapshot.Update.pnl\_30d\_usd?

> `optional` **pnl\_30d\_usd**: `number` \| `null`

###### Tables.alfaclub\_metrics\_snapshot.Update.rank?

> `optional` **rank**: `number`

###### Tables.alfaclub\_metrics\_snapshot.Update.score?

> `optional` **score**: `number`

###### Tables.alfaclub\_metrics\_snapshot.Update.snapshot\_ts?

> `optional` **snapshot\_ts**: `string`

###### Tables.alfaclub\_metrics\_snapshot.Update.staked\_supply?

> `optional` **staked\_supply**: `number`

###### Tables.alfaclub\_metrics\_snapshot.Update.token\_id?

> `optional` **token\_id**: `string`

###### Tables.alfaclub\_metrics\_snapshot.Update.total\_supply?

> `optional` **total\_supply**: `number`

###### Tables.alfaclub\_publications

> **alfaclub\_publications**: `object`

###### Tables.alfaclub\_publications.Insert

> **Insert**: `object`

###### Tables.alfaclub\_publications.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.alfaclub\_publications.Insert.creator\_address

> **creator\_address**: `string`

###### Tables.alfaclub\_publications.Insert.erc8004\_calldata?

> `optional` **erc8004\_calldata**: `string` \| `null`

###### Tables.alfaclub\_publications.Insert.erc8004\_tx\_hash?

> `optional` **erc8004\_tx\_hash**: `string` \| `null`

###### Tables.alfaclub\_publications.Insert.kind

> **kind**: `string`

###### Tables.alfaclub\_publications.Insert.last\_submission\_at?

> `optional` **last\_submission\_at**: `string` \| `null`

###### Tables.alfaclub\_publications.Insert.last\_submission\_error?

> `optional` **last\_submission\_error**: `string` \| `null`

###### Tables.alfaclub\_publications.Insert.lens\_post\_id?

> `optional` **lens\_post\_id**: `string` \| `null`

###### Tables.alfaclub\_publications.Insert.publication\_key

> **publication\_key**: `string`

###### Tables.alfaclub\_publications.Insert.rank?

> `optional` **rank**: `number` \| `null`

###### Tables.alfaclub\_publications.Insert.score?

> `optional` **score**: `number` \| `null`

###### Tables.alfaclub\_publications.Insert.scorecard\_cid?

> `optional` **scorecard\_cid**: `string` \| `null`

###### Tables.alfaclub\_publications.Insert.scorecard\_hash?

> `optional` **scorecard\_hash**: `string` \| `null`

###### Tables.alfaclub\_publications.Insert.scorecard\_uri?

> `optional` **scorecard\_uri**: `string` \| `null`

###### Tables.alfaclub\_publications.Insert.submission\_attempts?

> `optional` **submission\_attempts**: `number`

###### Tables.alfaclub\_publications.Insert.token\_id?

> `optional` **token\_id**: `string` \| `null`

###### Tables.alfaclub\_publications.Relationships

> **Relationships**: \[\]

###### Tables.alfaclub\_publications.Row

> **Row**: `object`

###### Tables.alfaclub\_publications.Row.created\_at

> **created\_at**: `string`

###### Tables.alfaclub\_publications.Row.creator\_address

> **creator\_address**: `string`

###### Tables.alfaclub\_publications.Row.erc8004\_calldata

> **erc8004\_calldata**: `string` \| `null`

###### Tables.alfaclub\_publications.Row.erc8004\_tx\_hash

> **erc8004\_tx\_hash**: `string` \| `null`

###### Tables.alfaclub\_publications.Row.kind

> **kind**: `string`

###### Tables.alfaclub\_publications.Row.last\_submission\_at

> **last\_submission\_at**: `string` \| `null`

###### Tables.alfaclub\_publications.Row.last\_submission\_error

> **last\_submission\_error**: `string` \| `null`

###### Tables.alfaclub\_publications.Row.lens\_post\_id

> **lens\_post\_id**: `string` \| `null`

###### Tables.alfaclub\_publications.Row.publication\_key

> **publication\_key**: `string`

###### Tables.alfaclub\_publications.Row.rank

> **rank**: `number` \| `null`

###### Tables.alfaclub\_publications.Row.score

> **score**: `number` \| `null`

###### Tables.alfaclub\_publications.Row.scorecard\_cid

> **scorecard\_cid**: `string` \| `null`

###### Tables.alfaclub\_publications.Row.scorecard\_hash

> **scorecard\_hash**: `string` \| `null`

###### Tables.alfaclub\_publications.Row.scorecard\_uri

> **scorecard\_uri**: `string` \| `null`

###### Tables.alfaclub\_publications.Row.submission\_attempts

> **submission\_attempts**: `number`

###### Tables.alfaclub\_publications.Row.token\_id

> **token\_id**: `string` \| `null`

###### Tables.alfaclub\_publications.Update

> **Update**: `object`

###### Tables.alfaclub\_publications.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.alfaclub\_publications.Update.creator\_address?

> `optional` **creator\_address**: `string`

###### Tables.alfaclub\_publications.Update.erc8004\_calldata?

> `optional` **erc8004\_calldata**: `string` \| `null`

###### Tables.alfaclub\_publications.Update.erc8004\_tx\_hash?

> `optional` **erc8004\_tx\_hash**: `string` \| `null`

###### Tables.alfaclub\_publications.Update.kind?

> `optional` **kind**: `string`

###### Tables.alfaclub\_publications.Update.last\_submission\_at?

> `optional` **last\_submission\_at**: `string` \| `null`

###### Tables.alfaclub\_publications.Update.last\_submission\_error?

> `optional` **last\_submission\_error**: `string` \| `null`

###### Tables.alfaclub\_publications.Update.lens\_post\_id?

> `optional` **lens\_post\_id**: `string` \| `null`

###### Tables.alfaclub\_publications.Update.publication\_key?

> `optional` **publication\_key**: `string`

###### Tables.alfaclub\_publications.Update.rank?

> `optional` **rank**: `number` \| `null`

###### Tables.alfaclub\_publications.Update.score?

> `optional` **score**: `number` \| `null`

###### Tables.alfaclub\_publications.Update.scorecard\_cid?

> `optional` **scorecard\_cid**: `string` \| `null`

###### Tables.alfaclub\_publications.Update.scorecard\_hash?

> `optional` **scorecard\_hash**: `string` \| `null`

###### Tables.alfaclub\_publications.Update.scorecard\_uri?

> `optional` **scorecard\_uri**: `string` \| `null`

###### Tables.alfaclub\_publications.Update.submission\_attempts?

> `optional` **submission\_attempts**: `number`

###### Tables.alfaclub\_publications.Update.token\_id?

> `optional` **token\_id**: `string` \| `null`

###### Tables.alfaclub\_runtime\_secret

> **alfaclub\_runtime\_secret**: `object`

###### Tables.alfaclub\_runtime\_secret.Insert

> **Insert**: `object`

###### Tables.alfaclub\_runtime\_secret.Insert.expires\_at?

> `optional` **expires\_at**: `string` \| `null`

###### Tables.alfaclub\_runtime\_secret.Insert.secret\_key

> **secret\_key**: `string`

###### Tables.alfaclub\_runtime\_secret.Insert.secret\_value

> **secret\_value**: `string`

###### Tables.alfaclub\_runtime\_secret.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.alfaclub\_runtime\_secret.Insert.updated\_by?

> `optional` **updated\_by**: `string` \| `null`

###### Tables.alfaclub\_runtime\_secret.Relationships

> **Relationships**: \[\]

###### Tables.alfaclub\_runtime\_secret.Row

> **Row**: `object`

###### Tables.alfaclub\_runtime\_secret.Row.expires\_at

> **expires\_at**: `string` \| `null`

###### Tables.alfaclub\_runtime\_secret.Row.secret\_key

> **secret\_key**: `string`

###### Tables.alfaclub\_runtime\_secret.Row.secret\_value

> **secret\_value**: `string`

###### Tables.alfaclub\_runtime\_secret.Row.updated\_at

> **updated\_at**: `string`

###### Tables.alfaclub\_runtime\_secret.Row.updated\_by

> **updated\_by**: `string` \| `null`

###### Tables.alfaclub\_runtime\_secret.Update

> **Update**: `object`

###### Tables.alfaclub\_runtime\_secret.Update.expires\_at?

> `optional` **expires\_at**: `string` \| `null`

###### Tables.alfaclub\_runtime\_secret.Update.secret\_key?

> `optional` **secret\_key**: `string`

###### Tables.alfaclub\_runtime\_secret.Update.secret\_value?

> `optional` **secret\_value**: `string`

###### Tables.alfaclub\_runtime\_secret.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.alfaclub\_runtime\_secret.Update.updated\_by?

> `optional` **updated\_by**: `string` \| `null`

###### Tables.allowlist

> **allowlist**: `object`

###### Tables.allowlist.Insert

> **Insert**: `object`

###### Tables.allowlist.Insert.address

> **address**: `string`

###### Tables.allowlist.Insert.approved\_at?

> `optional` **approved\_at**: `string`

###### Tables.allowlist.Insert.approved\_by?

> `optional` **approved\_by**: `string` \| `null`

###### Tables.allowlist.Insert.csw\_address?

> `optional` **csw\_address**: `string` \| `null`

###### Tables.allowlist.Insert.note?

> `optional` **note**: `string` \| `null`

###### Tables.allowlist.Insert.revoked\_at?

> `optional` **revoked\_at**: `string` \| `null`

###### Tables.allowlist.Relationships

> **Relationships**: \[\]

###### Tables.allowlist.Row

> **Row**: `object`

###### Tables.allowlist.Row.address

> **address**: `string`

###### Tables.allowlist.Row.approved\_at

> **approved\_at**: `string`

###### Tables.allowlist.Row.approved\_by

> **approved\_by**: `string` \| `null`

###### Tables.allowlist.Row.csw\_address

> **csw\_address**: `string` \| `null`

###### Tables.allowlist.Row.note

> **note**: `string` \| `null`

###### Tables.allowlist.Row.revoked\_at

> **revoked\_at**: `string` \| `null`

###### Tables.allowlist.Update

> **Update**: `object`

###### Tables.allowlist.Update.address?

> `optional` **address**: `string`

###### Tables.allowlist.Update.approved\_at?

> `optional` **approved\_at**: `string`

###### Tables.allowlist.Update.approved\_by?

> `optional` **approved\_by**: `string` \| `null`

###### Tables.allowlist.Update.csw\_address?

> `optional` **csw\_address**: `string` \| `null`

###### Tables.allowlist.Update.note?

> `optional` **note**: `string` \| `null`

###### Tables.allowlist.Update.revoked\_at?

> `optional` **revoked\_at**: `string` \| `null`

###### Tables.amoe\_burn\_credits\_intents

> **amoe\_burn\_credits\_intents**: `object`

###### Tables.amoe\_burn\_credits\_intents.Insert

> **Insert**: `object`

###### Tables.amoe\_burn\_credits\_intents.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.amoe\_burn\_credits\_intents.Insert.signup\_id

> **signup\_id**: `number`

###### Tables.amoe\_burn\_credits\_intents.Insert.spend\_ref\_id

> **spend\_ref\_id**: `string`

###### Tables.amoe\_burn\_credits\_intents.Relationships

> **Relationships**: \[\]

###### Tables.amoe\_burn\_credits\_intents.Row

> **Row**: `object`

###### Tables.amoe\_burn\_credits\_intents.Row.created\_at

> **created\_at**: `string`

###### Tables.amoe\_burn\_credits\_intents.Row.signup\_id

> **signup\_id**: `number`

###### Tables.amoe\_burn\_credits\_intents.Row.spend\_ref\_id

> **spend\_ref\_id**: `string`

###### Tables.amoe\_burn\_credits\_intents.Update

> **Update**: `object`

###### Tables.amoe\_burn\_credits\_intents.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.amoe\_burn\_credits\_intents.Update.signup\_id?

> `optional` **signup\_id**: `number`

###### Tables.amoe\_burn\_credits\_intents.Update.spend\_ref\_id?

> `optional` **spend\_ref\_id**: `string`

###### Tables.amoe\_points\_burn\_ledger

> **amoe\_points\_burn\_ledger**: `object`

###### Tables.amoe\_points\_burn\_ledger.Insert

> **Insert**: `object`

###### Tables.amoe\_points\_burn\_ledger.Insert.epoch

> **epoch**: `number`

###### Tables.amoe\_points\_burn\_ledger.Insert.leaf\_hash\_hex

> **leaf\_hash\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger.Insert.points\_burned

> **points\_burned**: `number`

###### Tables.amoe\_points\_burn\_ledger.Insert.points\_burned\_as\_usd

> **points\_burned\_as\_usd**: `number`

###### Tables.amoe\_points\_burn\_ledger.Insert.projected\_at?

> `optional` **projected\_at**: `string`

###### Tables.amoe\_points\_burn\_ledger.Insert.publisher\_run\_id

> **publisher\_run\_id**: `string`

###### Tables.amoe\_points\_burn\_ledger.Insert.signup\_id

> **signup\_id**: `number`

###### Tables.amoe\_points\_burn\_ledger.Insert.signup\_id\_hash\_hex

> **signup\_id\_hash\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger.Insert.source\_points\_id

> **source\_points\_id**: `number`

###### Tables.amoe\_points\_burn\_ledger.Insert.spend\_ref\_id

> **spend\_ref\_id**: `string`

###### Tables.amoe\_points\_burn\_ledger.Insert.spend\_ref\_id\_hash\_hex

> **spend\_ref\_id\_hash\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger.Insert.twitter\_credit\_nullifier\_hex

> **twitter\_credit\_nullifier\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger.Insert.wallet\_addr\_commit\_hex

> **wallet\_addr\_commit\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger.Insert.wallet\_address

> **wallet\_address**: `string`

###### Tables.amoe\_points\_burn\_ledger.Relationships

> **Relationships**: \[\]

###### Tables.amoe\_points\_burn\_ledger.Row

> **Row**: `object`

###### Tables.amoe\_points\_burn\_ledger.Row.epoch

> **epoch**: `number`

###### Tables.amoe\_points\_burn\_ledger.Row.leaf\_hash\_hex

> **leaf\_hash\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger.Row.points\_burned

> **points\_burned**: `number`

###### Tables.amoe\_points\_burn\_ledger.Row.points\_burned\_as\_usd

> **points\_burned\_as\_usd**: `number`

###### Tables.amoe\_points\_burn\_ledger.Row.projected\_at

> **projected\_at**: `string`

###### Tables.amoe\_points\_burn\_ledger.Row.publisher\_run\_id

> **publisher\_run\_id**: `string`

###### Tables.amoe\_points\_burn\_ledger.Row.signup\_id

> **signup\_id**: `number`

###### Tables.amoe\_points\_burn\_ledger.Row.signup\_id\_hash\_hex

> **signup\_id\_hash\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger.Row.source\_points\_id

> **source\_points\_id**: `number`

###### Tables.amoe\_points\_burn\_ledger.Row.spend\_ref\_id

> **spend\_ref\_id**: `string`

###### Tables.amoe\_points\_burn\_ledger.Row.spend\_ref\_id\_hash\_hex

> **spend\_ref\_id\_hash\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger.Row.twitter\_credit\_nullifier\_hex

> **twitter\_credit\_nullifier\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger.Row.wallet\_addr\_commit\_hex

> **wallet\_addr\_commit\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger.Row.wallet\_address

> **wallet\_address**: `string`

###### Tables.amoe\_points\_burn\_ledger.Update

> **Update**: `object`

###### Tables.amoe\_points\_burn\_ledger.Update.epoch?

> `optional` **epoch**: `number`

###### Tables.amoe\_points\_burn\_ledger.Update.leaf\_hash\_hex?

> `optional` **leaf\_hash\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger.Update.points\_burned?

> `optional` **points\_burned**: `number`

###### Tables.amoe\_points\_burn\_ledger.Update.points\_burned\_as\_usd?

> `optional` **points\_burned\_as\_usd**: `number`

###### Tables.amoe\_points\_burn\_ledger.Update.projected\_at?

> `optional` **projected\_at**: `string`

###### Tables.amoe\_points\_burn\_ledger.Update.publisher\_run\_id?

> `optional` **publisher\_run\_id**: `string`

###### Tables.amoe\_points\_burn\_ledger.Update.signup\_id?

> `optional` **signup\_id**: `number`

###### Tables.amoe\_points\_burn\_ledger.Update.signup\_id\_hash\_hex?

> `optional` **signup\_id\_hash\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger.Update.source\_points\_id?

> `optional` **source\_points\_id**: `number`

###### Tables.amoe\_points\_burn\_ledger.Update.spend\_ref\_id?

> `optional` **spend\_ref\_id**: `string`

###### Tables.amoe\_points\_burn\_ledger.Update.spend\_ref\_id\_hash\_hex?

> `optional` **spend\_ref\_id\_hash\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger.Update.twitter\_credit\_nullifier\_hex?

> `optional` **twitter\_credit\_nullifier\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger.Update.wallet\_addr\_commit\_hex?

> `optional` **wallet\_addr\_commit\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger.Update.wallet\_address?

> `optional` **wallet\_address**: `string`

###### Tables.amoe\_points\_burn\_ledger\_snapshots

> **amoe\_points\_burn\_ledger\_snapshots**: `object`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Insert

> **Insert**: `object`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Insert.built\_at?

> `optional` **built\_at**: `string`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Insert.epoch

> **epoch**: `number`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Insert.leaf\_count

> **leaf\_count**: `number`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Insert.publish\_block\_number?

> `optional` **publish\_block\_number**: `number` \| `null`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Insert.publish\_confirmed\_at?

> `optional` **publish\_confirmed\_at**: `string` \| `null`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Insert.publish\_tx\_hash?

> `optional` **publish\_tx\_hash**: `string` \| `null`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Insert.publisher\_run\_id

> **publisher\_run\_id**: `string`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Insert.publisher\_version

> **publisher\_version**: `string`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Insert.root\_hex

> **root\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Insert.tree\_blob

> **tree\_blob**: [`Json`](#json)

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Insert.tree\_depth?

> `optional` **tree\_depth**: `number`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Relationships

> **Relationships**: \[\]

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Row

> **Row**: `object`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Row.built\_at

> **built\_at**: `string`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Row.epoch

> **epoch**: `number`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Row.leaf\_count

> **leaf\_count**: `number`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Row.publish\_block\_number

> **publish\_block\_number**: `number` \| `null`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Row.publish\_confirmed\_at

> **publish\_confirmed\_at**: `string` \| `null`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Row.publish\_tx\_hash

> **publish\_tx\_hash**: `string` \| `null`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Row.publisher\_run\_id

> **publisher\_run\_id**: `string`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Row.publisher\_version

> **publisher\_version**: `string`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Row.root\_hex

> **root\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Row.tree\_blob

> **tree\_blob**: [`Json`](#json)

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Row.tree\_depth

> **tree\_depth**: `number`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Update

> **Update**: `object`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Update.built\_at?

> `optional` **built\_at**: `string`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Update.epoch?

> `optional` **epoch**: `number`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Update.leaf\_count?

> `optional` **leaf\_count**: `number`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Update.publish\_block\_number?

> `optional` **publish\_block\_number**: `number` \| `null`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Update.publish\_confirmed\_at?

> `optional` **publish\_confirmed\_at**: `string` \| `null`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Update.publish\_tx\_hash?

> `optional` **publish\_tx\_hash**: `string` \| `null`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Update.publisher\_run\_id?

> `optional` **publisher\_run\_id**: `string`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Update.publisher\_version?

> `optional` **publisher\_version**: `string`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Update.root\_hex?

> `optional` **root\_hex**: `string`

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Update.tree\_blob?

> `optional` **tree\_blob**: [`Json`](#json)

###### Tables.amoe\_points\_burn\_ledger\_snapshots.Update.tree\_depth?

> `optional` **tree\_depth**: `number`

###### Tables.amoe\_publisher\_runs

> **amoe\_publisher\_runs**: `object`

###### Tables.amoe\_publisher\_runs.Insert

> **Insert**: `object`

###### Tables.amoe\_publisher\_runs.Insert.claimed\_at?

> `optional` **claimed\_at**: `string`

###### Tables.amoe\_publisher\_runs.Insert.claimed\_by

> **claimed\_by**: `string`

###### Tables.amoe\_publisher\_runs.Insert.epoch

> **epoch**: `number`

###### Tables.amoe\_publisher\_runs.Insert.finished\_at?

> `optional` **finished\_at**: `string` \| `null`

###### Tables.amoe\_publisher\_runs.Insert.id?

> `optional` **id**: `string`

###### Tables.amoe\_publisher\_runs.Insert.last\_error?

> `optional` **last\_error**: `string` \| `null`

###### Tables.amoe\_publisher\_runs.Insert.phase

> **phase**: `string`

###### Tables.amoe\_publisher\_runs.Insert.snapshot\_epoch?

> `optional` **snapshot\_epoch**: `number` \| `null`

###### Tables.amoe\_publisher\_runs.Insert.started\_at?

> `optional` **started\_at**: `string`

###### Tables.amoe\_publisher\_runs.Relationships

> **Relationships**: \[\]

###### Tables.amoe\_publisher\_runs.Row

> **Row**: `object`

###### Tables.amoe\_publisher\_runs.Row.claimed\_at

> **claimed\_at**: `string`

###### Tables.amoe\_publisher\_runs.Row.claimed\_by

> **claimed\_by**: `string`

###### Tables.amoe\_publisher\_runs.Row.epoch

> **epoch**: `number`

###### Tables.amoe\_publisher\_runs.Row.finished\_at

> **finished\_at**: `string` \| `null`

###### Tables.amoe\_publisher\_runs.Row.id

> **id**: `string`

###### Tables.amoe\_publisher\_runs.Row.last\_error

> **last\_error**: `string` \| `null`

###### Tables.amoe\_publisher\_runs.Row.phase

> **phase**: `string`

###### Tables.amoe\_publisher\_runs.Row.snapshot\_epoch

> **snapshot\_epoch**: `number` \| `null`

###### Tables.amoe\_publisher\_runs.Row.started\_at

> **started\_at**: `string`

###### Tables.amoe\_publisher\_runs.Update

> **Update**: `object`

###### Tables.amoe\_publisher\_runs.Update.claimed\_at?

> `optional` **claimed\_at**: `string`

###### Tables.amoe\_publisher\_runs.Update.claimed\_by?

> `optional` **claimed\_by**: `string`

###### Tables.amoe\_publisher\_runs.Update.epoch?

> `optional` **epoch**: `number`

###### Tables.amoe\_publisher\_runs.Update.finished\_at?

> `optional` **finished\_at**: `string` \| `null`

###### Tables.amoe\_publisher\_runs.Update.id?

> `optional` **id**: `string`

###### Tables.amoe\_publisher\_runs.Update.last\_error?

> `optional` **last\_error**: `string` \| `null`

###### Tables.amoe\_publisher\_runs.Update.phase?

> `optional` **phase**: `string`

###### Tables.amoe\_publisher\_runs.Update.snapshot\_epoch?

> `optional` **snapshot\_epoch**: `number` \| `null`

###### Tables.amoe\_publisher\_runs.Update.started\_at?

> `optional` **started\_at**: `string`

###### Tables.amoe\_zk\_submissions

> **amoe\_zk\_submissions**: `object`

###### Tables.amoe\_zk\_submissions.Insert

> **Insert**: `object`

###### Tables.amoe\_zk\_submissions.Insert.block\_number?

> `optional` **block\_number**: `number` \| `null`

###### Tables.amoe\_zk\_submissions.Insert.broadcast\_at?

> `optional` **broadcast\_at**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.amoe\_zk\_submissions.Insert.creator\_coin

> **creator\_coin**: `string`

###### Tables.amoe\_zk\_submissions.Insert.epoch

> **epoch**: `number`

###### Tables.amoe\_zk\_submissions.Insert.id?

> `optional` **id**: `string`

###### Tables.amoe\_zk\_submissions.Insert.last\_retry\_error?

> `optional` **last\_retry\_error**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Insert.manager\_entry\_id?

> `optional` **manager\_entry\_id**: `number` \| `null`

###### Tables.amoe\_zk\_submissions.Insert.next\_retry\_at?

> `optional` **next\_retry\_at**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Insert.nonce\_commit\_hex?

> `optional` **nonce\_commit\_hex**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Insert.points\_burn\_nullifier\_hex?

> `optional` **points\_burn\_nullifier\_hex**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Insert.points\_burned

> **points\_burned**: `number`

###### Tables.amoe\_zk\_submissions.Insert.proof\_blob?

> `optional` **proof\_blob**: [`Json`](#json) \| `null`

###### Tables.amoe\_zk\_submissions.Insert.proof\_kept\_until?

> `optional` **proof\_kept\_until**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Insert.proven\_at?

> `optional` **proven\_at**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Insert.retry\_count?

> `optional` **retry\_count**: `number`

###### Tables.amoe\_zk\_submissions.Insert.retry\_started\_at?

> `optional` **retry\_started\_at**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Insert.settled\_at?

> `optional` **settled\_at**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Insert.signup\_id

> **signup\_id**: `number`

###### Tables.amoe\_zk\_submissions.Insert.spend\_ref\_id

> **spend\_ref\_id**: `string`

###### Tables.amoe\_zk\_submissions.Insert.state

> **state**: `string`

###### Tables.amoe\_zk\_submissions.Insert.state\_reason?

> `optional` **state\_reason**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Insert.twitter\_credit\_nullifier\_hex?

> `optional` **twitter\_credit\_nullifier\_hex**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Insert.tx\_hash?

> `optional` **tx\_hash**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Insert.wallet\_address

> **wallet\_address**: `string`

###### Tables.amoe\_zk\_submissions.Insert.wallet\_commit\_hex?

> `optional` **wallet\_commit\_hex**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Relationships

> **Relationships**: \[\]

###### Tables.amoe\_zk\_submissions.Row

> **Row**: `object`

###### Tables.amoe\_zk\_submissions.Row.block\_number

> **block\_number**: `number` \| `null`

###### Tables.amoe\_zk\_submissions.Row.broadcast\_at

> **broadcast\_at**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Row.created\_at

> **created\_at**: `string`

###### Tables.amoe\_zk\_submissions.Row.creator\_coin

> **creator\_coin**: `string`

###### Tables.amoe\_zk\_submissions.Row.epoch

> **epoch**: `number`

###### Tables.amoe\_zk\_submissions.Row.id

> **id**: `string`

###### Tables.amoe\_zk\_submissions.Row.last\_retry\_error

> **last\_retry\_error**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Row.manager\_entry\_id

> **manager\_entry\_id**: `number` \| `null`

###### Tables.amoe\_zk\_submissions.Row.next\_retry\_at

> **next\_retry\_at**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Row.nonce\_commit\_hex

> **nonce\_commit\_hex**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Row.points\_burn\_nullifier\_hex

> **points\_burn\_nullifier\_hex**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Row.points\_burned

> **points\_burned**: `number`

###### Tables.amoe\_zk\_submissions.Row.proof\_blob

> **proof\_blob**: [`Json`](#json) \| `null`

###### Tables.amoe\_zk\_submissions.Row.proof\_kept\_until

> **proof\_kept\_until**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Row.proven\_at

> **proven\_at**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Row.retry\_count

> **retry\_count**: `number`

###### Tables.amoe\_zk\_submissions.Row.retry\_started\_at

> **retry\_started\_at**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Row.settled\_at

> **settled\_at**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Row.signup\_id

> **signup\_id**: `number`

###### Tables.amoe\_zk\_submissions.Row.spend\_ref\_id

> **spend\_ref\_id**: `string`

###### Tables.amoe\_zk\_submissions.Row.state

> **state**: `string`

###### Tables.amoe\_zk\_submissions.Row.state\_reason

> **state\_reason**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Row.twitter\_credit\_nullifier\_hex

> **twitter\_credit\_nullifier\_hex**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Row.tx\_hash

> **tx\_hash**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Row.wallet\_address

> **wallet\_address**: `string`

###### Tables.amoe\_zk\_submissions.Row.wallet\_commit\_hex

> **wallet\_commit\_hex**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Update

> **Update**: `object`

###### Tables.amoe\_zk\_submissions.Update.block\_number?

> `optional` **block\_number**: `number` \| `null`

###### Tables.amoe\_zk\_submissions.Update.broadcast\_at?

> `optional` **broadcast\_at**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.amoe\_zk\_submissions.Update.creator\_coin?

> `optional` **creator\_coin**: `string`

###### Tables.amoe\_zk\_submissions.Update.epoch?

> `optional` **epoch**: `number`

###### Tables.amoe\_zk\_submissions.Update.id?

> `optional` **id**: `string`

###### Tables.amoe\_zk\_submissions.Update.last\_retry\_error?

> `optional` **last\_retry\_error**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Update.manager\_entry\_id?

> `optional` **manager\_entry\_id**: `number` \| `null`

###### Tables.amoe\_zk\_submissions.Update.next\_retry\_at?

> `optional` **next\_retry\_at**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Update.nonce\_commit\_hex?

> `optional` **nonce\_commit\_hex**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Update.points\_burn\_nullifier\_hex?

> `optional` **points\_burn\_nullifier\_hex**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Update.points\_burned?

> `optional` **points\_burned**: `number`

###### Tables.amoe\_zk\_submissions.Update.proof\_blob?

> `optional` **proof\_blob**: [`Json`](#json) \| `null`

###### Tables.amoe\_zk\_submissions.Update.proof\_kept\_until?

> `optional` **proof\_kept\_until**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Update.proven\_at?

> `optional` **proven\_at**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Update.retry\_count?

> `optional` **retry\_count**: `number`

###### Tables.amoe\_zk\_submissions.Update.retry\_started\_at?

> `optional` **retry\_started\_at**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Update.settled\_at?

> `optional` **settled\_at**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Update.signup\_id?

> `optional` **signup\_id**: `number`

###### Tables.amoe\_zk\_submissions.Update.spend\_ref\_id?

> `optional` **spend\_ref\_id**: `string`

###### Tables.amoe\_zk\_submissions.Update.state?

> `optional` **state**: `string`

###### Tables.amoe\_zk\_submissions.Update.state\_reason?

> `optional` **state\_reason**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Update.twitter\_credit\_nullifier\_hex?

> `optional` **twitter\_credit\_nullifier\_hex**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Update.tx\_hash?

> `optional` **tx\_hash**: `string` \| `null`

###### Tables.amoe\_zk\_submissions.Update.wallet\_address?

> `optional` **wallet\_address**: `string`

###### Tables.amoe\_zk\_submissions.Update.wallet\_commit\_hex?

> `optional` **wallet\_commit\_hex**: `string` \| `null`

###### Tables.auth\_agent\_nonces

> **auth\_agent\_nonces**: `object`

###### Tables.auth\_agent\_nonces.Insert

> **Insert**: `object`

###### Tables.auth\_agent\_nonces.Insert.agent\_id

> **agent\_id**: `number`

###### Tables.auth\_agent\_nonces.Insert.agent\_registry

> **agent\_registry**: `string`

###### Tables.auth\_agent\_nonces.Insert.consumed\_at?

> `optional` **consumed\_at**: `string` \| `null`

###### Tables.auth\_agent\_nonces.Insert.created\_by\_address?

> `optional` **created\_by\_address**: `string` \| `null`

###### Tables.auth\_agent\_nonces.Insert.expires\_at

> **expires\_at**: `string`

###### Tables.auth\_agent\_nonces.Insert.issued\_at?

> `optional` **issued\_at**: `string`

###### Tables.auth\_agent\_nonces.Insert.nonce

> **nonce**: `string`

###### Tables.auth\_agent\_nonces.Insert.owner\_address

> **owner\_address**: `string`

###### Tables.auth\_agent\_nonces.Relationships

> **Relationships**: \[\]

###### Tables.auth\_agent\_nonces.Row

> **Row**: `object`

###### Tables.auth\_agent\_nonces.Row.agent\_id

> **agent\_id**: `number`

###### Tables.auth\_agent\_nonces.Row.agent\_registry

> **agent\_registry**: `string`

###### Tables.auth\_agent\_nonces.Row.consumed\_at

> **consumed\_at**: `string` \| `null`

###### Tables.auth\_agent\_nonces.Row.created\_by\_address

> **created\_by\_address**: `string` \| `null`

###### Tables.auth\_agent\_nonces.Row.expires\_at

> **expires\_at**: `string`

###### Tables.auth\_agent\_nonces.Row.issued\_at

> **issued\_at**: `string`

###### Tables.auth\_agent\_nonces.Row.nonce

> **nonce**: `string`

###### Tables.auth\_agent\_nonces.Row.owner\_address

> **owner\_address**: `string`

###### Tables.auth\_agent\_nonces.Update

> **Update**: `object`

###### Tables.auth\_agent\_nonces.Update.agent\_id?

> `optional` **agent\_id**: `number`

###### Tables.auth\_agent\_nonces.Update.agent\_registry?

> `optional` **agent\_registry**: `string`

###### Tables.auth\_agent\_nonces.Update.consumed\_at?

> `optional` **consumed\_at**: `string` \| `null`

###### Tables.auth\_agent\_nonces.Update.created\_by\_address?

> `optional` **created\_by\_address**: `string` \| `null`

###### Tables.auth\_agent\_nonces.Update.expires\_at?

> `optional` **expires\_at**: `string`

###### Tables.auth\_agent\_nonces.Update.issued\_at?

> `optional` **issued\_at**: `string`

###### Tables.auth\_agent\_nonces.Update.nonce?

> `optional` **nonce**: `string`

###### Tables.auth\_agent\_nonces.Update.owner\_address?

> `optional` **owner\_address**: `string`

###### Tables.auth\_handoffs

> **auth\_handoffs**: `object`

###### Tables.auth\_handoffs.Insert

> **Insert**: `object`

###### Tables.auth\_handoffs.Insert.address

> **address**: `string`

###### Tables.auth\_handoffs.Insert.code\_hash

> **code\_hash**: `string`

###### Tables.auth\_handoffs.Insert.consumed\_at?

> `optional` **consumed\_at**: `string` \| `null`

###### Tables.auth\_handoffs.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.auth\_handoffs.Insert.expires\_at

> **expires\_at**: `string`

###### Tables.auth\_handoffs.Insert.privy\_token?

> `optional` **privy\_token**: `string` \| `null`

###### Tables.auth\_handoffs.Relationships

> **Relationships**: \[\]

###### Tables.auth\_handoffs.Row

> **Row**: `object`

###### Tables.auth\_handoffs.Row.address

> **address**: `string`

###### Tables.auth\_handoffs.Row.code\_hash

> **code\_hash**: `string`

###### Tables.auth\_handoffs.Row.consumed\_at

> **consumed\_at**: `string` \| `null`

###### Tables.auth\_handoffs.Row.created\_at

> **created\_at**: `string`

###### Tables.auth\_handoffs.Row.expires\_at

> **expires\_at**: `string`

###### Tables.auth\_handoffs.Row.privy\_token

> **privy\_token**: `string` \| `null`

###### Tables.auth\_handoffs.Update

> **Update**: `object`

###### Tables.auth\_handoffs.Update.address?

> `optional` **address**: `string`

###### Tables.auth\_handoffs.Update.code\_hash?

> `optional` **code\_hash**: `string`

###### Tables.auth\_handoffs.Update.consumed\_at?

> `optional` **consumed\_at**: `string` \| `null`

###### Tables.auth\_handoffs.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.auth\_handoffs.Update.expires\_at?

> `optional` **expires\_at**: `string`

###### Tables.auth\_handoffs.Update.privy\_token?

> `optional` **privy\_token**: `string` \| `null`

###### Tables.auth\_nonces

> **auth\_nonces**: `object`

###### Tables.auth\_nonces.Insert

> **Insert**: `object`

###### Tables.auth\_nonces.Insert.consumed\_at?

> `optional` **consumed\_at**: `string` \| `null`

###### Tables.auth\_nonces.Insert.expires\_at

> **expires\_at**: `string`

###### Tables.auth\_nonces.Insert.issued\_at?

> `optional` **issued\_at**: `string`

###### Tables.auth\_nonces.Insert.nonce

> **nonce**: `string`

###### Tables.auth\_nonces.Relationships

> **Relationships**: \[\]

###### Tables.auth\_nonces.Row

> **Row**: `object`

###### Tables.auth\_nonces.Row.consumed\_at

> **consumed\_at**: `string` \| `null`

###### Tables.auth\_nonces.Row.expires\_at

> **expires\_at**: `string`

###### Tables.auth\_nonces.Row.issued\_at

> **issued\_at**: `string`

###### Tables.auth\_nonces.Row.nonce

> **nonce**: `string`

###### Tables.auth\_nonces.Update

> **Update**: `object`

###### Tables.auth\_nonces.Update.consumed\_at?

> `optional` **consumed\_at**: `string` \| `null`

###### Tables.auth\_nonces.Update.expires\_at?

> `optional` **expires\_at**: `string`

###### Tables.auth\_nonces.Update.issued\_at?

> `optional` **issued\_at**: `string`

###### Tables.auth\_nonces.Update.nonce?

> `optional` **nonce**: `string`

###### Tables.chat\_command\_center\_events

> **chat\_command\_center\_events**: `object`

###### Tables.chat\_command\_center\_events.Insert

> **Insert**: `object`

###### Tables.chat\_command\_center\_events.Insert.command\_id?

> `optional` **command\_id**: `string` \| `null`

###### Tables.chat\_command\_center\_events.Insert.conversation\_id?

> `optional` **conversation\_id**: `string` \| `null`

###### Tables.chat\_command\_center\_events.Insert.conversation\_type?

> `optional` **conversation\_type**: `string` \| `null`

###### Tables.chat\_command\_center\_events.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.chat\_command\_center\_events.Insert.event

> **event**: `string`

###### Tables.chat\_command\_center\_events.Insert.id?

> `optional` **id**: `number`

###### Tables.chat\_command\_center\_events.Insert.payload?

> `optional` **payload**: [`Json`](#json) \| `null`

###### Tables.chat\_command\_center\_events.Insert.source?

> `optional` **source**: `string` \| `null`

###### Tables.chat\_command\_center\_events.Relationships

> **Relationships**: \[\]

###### Tables.chat\_command\_center\_events.Row

> **Row**: `object`

###### Tables.chat\_command\_center\_events.Row.command\_id

> **command\_id**: `string` \| `null`

###### Tables.chat\_command\_center\_events.Row.conversation\_id

> **conversation\_id**: `string` \| `null`

###### Tables.chat\_command\_center\_events.Row.conversation\_type

> **conversation\_type**: `string` \| `null`

###### Tables.chat\_command\_center\_events.Row.created\_at

> **created\_at**: `string`

###### Tables.chat\_command\_center\_events.Row.event

> **event**: `string`

###### Tables.chat\_command\_center\_events.Row.id

> **id**: `number`

###### Tables.chat\_command\_center\_events.Row.payload

> **payload**: [`Json`](#json) \| `null`

###### Tables.chat\_command\_center\_events.Row.source

> **source**: `string` \| `null`

###### Tables.chat\_command\_center\_events.Update

> **Update**: `object`

###### Tables.chat\_command\_center\_events.Update.command\_id?

> `optional` **command\_id**: `string` \| `null`

###### Tables.chat\_command\_center\_events.Update.conversation\_id?

> `optional` **conversation\_id**: `string` \| `null`

###### Tables.chat\_command\_center\_events.Update.conversation\_type?

> `optional` **conversation\_type**: `string` \| `null`

###### Tables.chat\_command\_center\_events.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.chat\_command\_center\_events.Update.event?

> `optional` **event**: `string`

###### Tables.chat\_command\_center\_events.Update.id?

> `optional` **id**: `number`

###### Tables.chat\_command\_center\_events.Update.payload?

> `optional` **payload**: [`Json`](#json) \| `null`

###### Tables.chat\_command\_center\_events.Update.source?

> `optional` **source**: `string` \| `null`

###### Tables.chat\_directory\_profiles

> **chat\_directory\_profiles**: `object`

###### Tables.chat\_directory\_profiles.Insert

> **Insert**: `object`

###### Tables.chat\_directory\_profiles.Insert.avatar\_url?

> `optional` **avatar\_url**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Insert.canonical\_wallet

> **canonical\_wallet**: `string`

###### Tables.chat\_directory\_profiles.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.chat\_directory\_profiles.Insert.display\_name?

> `optional` **display\_name**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Insert.ethos\_level?

> `optional` **ethos\_level**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Insert.ethos\_profile\_id?

> `optional` **ethos\_profile\_id**: `number` \| `null`

###### Tables.chat\_directory\_profiles.Insert.ethos\_score?

> `optional` **ethos\_score**: `number` \| `null`

###### Tables.chat\_directory\_profiles.Insert.ethos\_score\_updated\_at?

> `optional` **ethos\_score\_updated\_at**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Insert.ethos\_userkey?

> `optional` **ethos\_userkey**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Insert.last\_seen\_at?

> `optional` **last\_seen\_at**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.chat\_directory\_profiles.Insert.xmtp\_address?

> `optional` **xmtp\_address**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Insert.xmtp\_inbox\_id?

> `optional` **xmtp\_inbox\_id**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Relationships

> **Relationships**: \[\]

###### Tables.chat\_directory\_profiles.Row

> **Row**: `object`

###### Tables.chat\_directory\_profiles.Row.avatar\_url

> **avatar\_url**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Row.canonical\_wallet

> **canonical\_wallet**: `string`

###### Tables.chat\_directory\_profiles.Row.created\_at

> **created\_at**: `string`

###### Tables.chat\_directory\_profiles.Row.display\_name

> **display\_name**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Row.ethos\_level

> **ethos\_level**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Row.ethos\_profile\_id

> **ethos\_profile\_id**: `number` \| `null`

###### Tables.chat\_directory\_profiles.Row.ethos\_score

> **ethos\_score**: `number` \| `null`

###### Tables.chat\_directory\_profiles.Row.ethos\_score\_updated\_at

> **ethos\_score\_updated\_at**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Row.ethos\_userkey

> **ethos\_userkey**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Row.last\_seen\_at

> **last\_seen\_at**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Row.updated\_at

> **updated\_at**: `string`

###### Tables.chat\_directory\_profiles.Row.xmtp\_address

> **xmtp\_address**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Row.xmtp\_inbox\_id

> **xmtp\_inbox\_id**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Update

> **Update**: `object`

###### Tables.chat\_directory\_profiles.Update.avatar\_url?

> `optional` **avatar\_url**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Update.canonical\_wallet?

> `optional` **canonical\_wallet**: `string`

###### Tables.chat\_directory\_profiles.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.chat\_directory\_profiles.Update.display\_name?

> `optional` **display\_name**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Update.ethos\_level?

> `optional` **ethos\_level**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Update.ethos\_profile\_id?

> `optional` **ethos\_profile\_id**: `number` \| `null`

###### Tables.chat\_directory\_profiles.Update.ethos\_score?

> `optional` **ethos\_score**: `number` \| `null`

###### Tables.chat\_directory\_profiles.Update.ethos\_score\_updated\_at?

> `optional` **ethos\_score\_updated\_at**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Update.ethos\_userkey?

> `optional` **ethos\_userkey**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Update.last\_seen\_at?

> `optional` **last\_seen\_at**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.chat\_directory\_profiles.Update.xmtp\_address?

> `optional` **xmtp\_address**: `string` \| `null`

###### Tables.chat\_directory\_profiles.Update.xmtp\_inbox\_id?

> `optional` **xmtp\_inbox\_id**: `string` \| `null`

###### Tables.chat\_presence\_sessions

> **chat\_presence\_sessions**: `object`

###### Tables.chat\_presence\_sessions.Insert

> **Insert**: `object`

###### Tables.chat\_presence\_sessions.Insert.available\_until?

> `optional` **available\_until**: `string`

###### Tables.chat\_presence\_sessions.Insert.canonical\_wallet

> **canonical\_wallet**: `string`

###### Tables.chat\_presence\_sessions.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.chat\_presence\_sessions.Insert.last\_seen\_at?

> `optional` **last\_seen\_at**: `string`

###### Tables.chat\_presence\_sessions.Insert.privacy\_visible?

> `optional` **privacy\_visible**: `boolean`

###### Tables.chat\_presence\_sessions.Insert.profile\_id?

> `optional` **profile\_id**: `number` \| `null`

###### Tables.chat\_presence\_sessions.Insert.session\_id\_hash

> **session\_id\_hash**: `string`

###### Tables.chat\_presence\_sessions.Insert.status?

> `optional` **status**: `string`

###### Tables.chat\_presence\_sessions.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.chat\_presence\_sessions.Insert.user\_agent\_hash?

> `optional` **user\_agent\_hash**: `string` \| `null`

###### Tables.chat\_presence\_sessions.Insert.xmtp\_address?

> `optional` **xmtp\_address**: `string` \| `null`

###### Tables.chat\_presence\_sessions.Relationships

> **Relationships**: \[\]

###### Tables.chat\_presence\_sessions.Row

> **Row**: `object`

###### Tables.chat\_presence\_sessions.Row.available\_until

> **available\_until**: `string`

###### Tables.chat\_presence\_sessions.Row.canonical\_wallet

> **canonical\_wallet**: `string`

###### Tables.chat\_presence\_sessions.Row.created\_at

> **created\_at**: `string`

###### Tables.chat\_presence\_sessions.Row.last\_seen\_at

> **last\_seen\_at**: `string`

###### Tables.chat\_presence\_sessions.Row.privacy\_visible

> **privacy\_visible**: `boolean`

###### Tables.chat\_presence\_sessions.Row.profile\_id

> **profile\_id**: `number` \| `null`

###### Tables.chat\_presence\_sessions.Row.session\_id\_hash

> **session\_id\_hash**: `string`

###### Tables.chat\_presence\_sessions.Row.status

> **status**: `string`

###### Tables.chat\_presence\_sessions.Row.updated\_at

> **updated\_at**: `string`

###### Tables.chat\_presence\_sessions.Row.user\_agent\_hash

> **user\_agent\_hash**: `string` \| `null`

###### Tables.chat\_presence\_sessions.Row.xmtp\_address

> **xmtp\_address**: `string` \| `null`

###### Tables.chat\_presence\_sessions.Update

> **Update**: `object`

###### Tables.chat\_presence\_sessions.Update.available\_until?

> `optional` **available\_until**: `string`

###### Tables.chat\_presence\_sessions.Update.canonical\_wallet?

> `optional` **canonical\_wallet**: `string`

###### Tables.chat\_presence\_sessions.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.chat\_presence\_sessions.Update.last\_seen\_at?

> `optional` **last\_seen\_at**: `string`

###### Tables.chat\_presence\_sessions.Update.privacy\_visible?

> `optional` **privacy\_visible**: `boolean`

###### Tables.chat\_presence\_sessions.Update.profile\_id?

> `optional` **profile\_id**: `number` \| `null`

###### Tables.chat\_presence\_sessions.Update.session\_id\_hash?

> `optional` **session\_id\_hash**: `string`

###### Tables.chat\_presence\_sessions.Update.status?

> `optional` **status**: `string`

###### Tables.chat\_presence\_sessions.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.chat\_presence\_sessions.Update.user\_agent\_hash?

> `optional` **user\_agent\_hash**: `string` \| `null`

###### Tables.chat\_presence\_sessions.Update.xmtp\_address?

> `optional` **xmtp\_address**: `string` \| `null`

###### Tables.command\_issuer\_daily\_spend

> **command\_issuer\_daily\_spend**: `object`

###### Tables.command\_issuer\_daily\_spend.Insert

> **Insert**: `object`

###### Tables.command\_issuer\_daily\_spend.Insert.profile\_id

> **profile\_id**: `number`

###### Tables.command\_issuer\_daily\_spend.Insert.spent\_wei?

> `optional` **spent\_wei**: `number`

###### Tables.command\_issuer\_daily\_spend.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.command\_issuer\_daily\_spend.Insert.ymd

> **ymd**: `string`

###### Tables.command\_issuer\_daily\_spend.Relationships

> **Relationships**: \[\{ `columns`: \[`"profile_id"`\]; `foreignKeyName`: `"command_issuer_daily_spend_profile_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"profiles"`; \}\]

###### Tables.command\_issuer\_daily\_spend.Row

> **Row**: `object`

###### Tables.command\_issuer\_daily\_spend.Row.profile\_id

> **profile\_id**: `number`

###### Tables.command\_issuer\_daily\_spend.Row.spent\_wei

> **spent\_wei**: `number`

###### Tables.command\_issuer\_daily\_spend.Row.updated\_at

> **updated\_at**: `string`

###### Tables.command\_issuer\_daily\_spend.Row.ymd

> **ymd**: `string`

###### Tables.command\_issuer\_daily\_spend.Update

> **Update**: `object`

###### Tables.command\_issuer\_daily\_spend.Update.profile\_id?

> `optional` **profile\_id**: `number`

###### Tables.command\_issuer\_daily\_spend.Update.spent\_wei?

> `optional` **spent\_wei**: `number`

###### Tables.command\_issuer\_daily\_spend.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.command\_issuer\_daily\_spend.Update.ymd?

> `optional` **ymd**: `string`

###### Tables.command\_issuer\_execution\_context

> **command\_issuer\_execution\_context**: `object`

###### Tables.command\_issuer\_execution\_context.Insert

> **Insert**: `object`

###### Tables.command\_issuer\_execution\_context.Insert.caps\_version?

> `optional` **caps\_version**: `number`

###### Tables.command\_issuer\_execution\_context.Insert.daily\_cap\_wei

> **daily\_cap\_wei**: `number`

###### Tables.command\_issuer\_execution\_context.Insert.owner\_eoa\_address

> **owner\_eoa\_address**: `string`

###### Tables.command\_issuer\_execution\_context.Insert.owner\_index?

> `optional` **owner\_index**: `number`

###### Tables.command\_issuer\_execution\_context.Insert.parent\_csw\_address?

> `optional` **parent\_csw\_address**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Insert.paymaster\_policy?

> `optional` **paymaster\_policy**: `string`

###### Tables.command\_issuer\_execution\_context.Insert.per\_tx\_cap\_wei

> **per\_tx\_cap\_wei**: `number`

###### Tables.command\_issuer\_execution\_context.Insert.privy\_owner\_wallet\_id

> **privy\_owner\_wallet\_id**: `string`

###### Tables.command\_issuer\_execution\_context.Insert.profile\_id

> **profile\_id**: `number`

###### Tables.command\_issuer\_execution\_context.Insert.provisioned\_at?

> `optional` **provisioned\_at**: `string`

###### Tables.command\_issuer\_execution\_context.Insert.provisioned\_by?

> `optional` **provisioned\_by**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Insert.revoked\_at?

> `optional` **revoked\_at**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Insert.revoked\_reason?

> `optional` **revoked\_reason**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Insert.smart\_wallet\_address

> **smart\_wallet\_address**: `string`

###### Tables.command\_issuer\_execution\_context.Insert.spend\_allowance\_wei?

> `optional` **spend\_allowance\_wei**: `number` \| `null`

###### Tables.command\_issuer\_execution\_context.Insert.spend\_period\_seconds?

> `optional` **spend\_period\_seconds**: `number` \| `null`

###### Tables.command\_issuer\_execution\_context.Insert.spend\_permission\_end\_at?

> `optional` **spend\_permission\_end\_at**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Insert.spend\_permission\_hash?

> `optional` **spend\_permission\_hash**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Insert.spend\_permission\_payload?

> `optional` **spend\_permission\_payload**: [`Json`](#json) \| `null`

###### Tables.command\_issuer\_execution\_context.Insert.spend\_permission\_revoked\_at?

> `optional` **spend\_permission\_revoked\_at**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Insert.spend\_permission\_signature?

> `optional` **spend\_permission\_signature**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Insert.sub\_account\_address?

> `optional` **sub\_account\_address**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.command\_issuer\_execution\_context.Relationships

> **Relationships**: \[\{ `columns`: \[`"profile_id"`\]; `foreignKeyName`: `"command_issuer_execution_context_profile_id_fkey"`; `isOneToOne`: `true`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"profiles"`; \}\]

###### Tables.command\_issuer\_execution\_context.Row

> **Row**: `object`

###### Tables.command\_issuer\_execution\_context.Row.caps\_version

> **caps\_version**: `number`

###### Tables.command\_issuer\_execution\_context.Row.daily\_cap\_wei

> **daily\_cap\_wei**: `number`

###### Tables.command\_issuer\_execution\_context.Row.owner\_eoa\_address

> **owner\_eoa\_address**: `string`

###### Tables.command\_issuer\_execution\_context.Row.owner\_index

> **owner\_index**: `number`

###### Tables.command\_issuer\_execution\_context.Row.parent\_csw\_address

> **parent\_csw\_address**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Row.paymaster\_policy

> **paymaster\_policy**: `string`

###### Tables.command\_issuer\_execution\_context.Row.per\_tx\_cap\_wei

> **per\_tx\_cap\_wei**: `number`

###### Tables.command\_issuer\_execution\_context.Row.privy\_owner\_wallet\_id

> **privy\_owner\_wallet\_id**: `string`

###### Tables.command\_issuer\_execution\_context.Row.profile\_id

> **profile\_id**: `number`

###### Tables.command\_issuer\_execution\_context.Row.provisioned\_at

> **provisioned\_at**: `string`

###### Tables.command\_issuer\_execution\_context.Row.provisioned\_by

> **provisioned\_by**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Row.revoked\_at

> **revoked\_at**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Row.revoked\_reason

> **revoked\_reason**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Row.smart\_wallet\_address

> **smart\_wallet\_address**: `string`

###### Tables.command\_issuer\_execution\_context.Row.spend\_allowance\_wei

> **spend\_allowance\_wei**: `number` \| `null`

###### Tables.command\_issuer\_execution\_context.Row.spend\_period\_seconds

> **spend\_period\_seconds**: `number` \| `null`

###### Tables.command\_issuer\_execution\_context.Row.spend\_permission\_end\_at

> **spend\_permission\_end\_at**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Row.spend\_permission\_hash

> **spend\_permission\_hash**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Row.spend\_permission\_payload

> **spend\_permission\_payload**: [`Json`](#json) \| `null`

###### Tables.command\_issuer\_execution\_context.Row.spend\_permission\_revoked\_at

> **spend\_permission\_revoked\_at**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Row.spend\_permission\_signature

> **spend\_permission\_signature**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Row.sub\_account\_address

> **sub\_account\_address**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Row.updated\_at

> **updated\_at**: `string`

###### Tables.command\_issuer\_execution\_context.Update

> **Update**: `object`

###### Tables.command\_issuer\_execution\_context.Update.caps\_version?

> `optional` **caps\_version**: `number`

###### Tables.command\_issuer\_execution\_context.Update.daily\_cap\_wei?

> `optional` **daily\_cap\_wei**: `number`

###### Tables.command\_issuer\_execution\_context.Update.owner\_eoa\_address?

> `optional` **owner\_eoa\_address**: `string`

###### Tables.command\_issuer\_execution\_context.Update.owner\_index?

> `optional` **owner\_index**: `number`

###### Tables.command\_issuer\_execution\_context.Update.parent\_csw\_address?

> `optional` **parent\_csw\_address**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Update.paymaster\_policy?

> `optional` **paymaster\_policy**: `string`

###### Tables.command\_issuer\_execution\_context.Update.per\_tx\_cap\_wei?

> `optional` **per\_tx\_cap\_wei**: `number`

###### Tables.command\_issuer\_execution\_context.Update.privy\_owner\_wallet\_id?

> `optional` **privy\_owner\_wallet\_id**: `string`

###### Tables.command\_issuer\_execution\_context.Update.profile\_id?

> `optional` **profile\_id**: `number`

###### Tables.command\_issuer\_execution\_context.Update.provisioned\_at?

> `optional` **provisioned\_at**: `string`

###### Tables.command\_issuer\_execution\_context.Update.provisioned\_by?

> `optional` **provisioned\_by**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Update.revoked\_at?

> `optional` **revoked\_at**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Update.revoked\_reason?

> `optional` **revoked\_reason**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Update.smart\_wallet\_address?

> `optional` **smart\_wallet\_address**: `string`

###### Tables.command\_issuer\_execution\_context.Update.spend\_allowance\_wei?

> `optional` **spend\_allowance\_wei**: `number` \| `null`

###### Tables.command\_issuer\_execution\_context.Update.spend\_period\_seconds?

> `optional` **spend\_period\_seconds**: `number` \| `null`

###### Tables.command\_issuer\_execution\_context.Update.spend\_permission\_end\_at?

> `optional` **spend\_permission\_end\_at**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Update.spend\_permission\_hash?

> `optional` **spend\_permission\_hash**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Update.spend\_permission\_payload?

> `optional` **spend\_permission\_payload**: [`Json`](#json) \| `null`

###### Tables.command\_issuer\_execution\_context.Update.spend\_permission\_revoked\_at?

> `optional` **spend\_permission\_revoked\_at**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Update.spend\_permission\_signature?

> `optional` **spend\_permission\_signature**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Update.sub\_account\_address?

> `optional` **sub\_account\_address**: `string` \| `null`

###### Tables.command\_issuer\_execution\_context.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.creator\_agent\_wallets

> **creator\_agent\_wallets**: `object`

###### Tables.creator\_agent\_wallets.Insert

> **Insert**: `object`

###### Tables.creator\_agent\_wallets.Insert.agent\_wallet\_address

> **agent\_wallet\_address**: `string`

###### Tables.creator\_agent\_wallets.Insert.agent\_wallet\_id

> **agent\_wallet\_id**: `string`

###### Tables.creator\_agent\_wallets.Insert.coin\_address

> **coin\_address**: `string`

###### Tables.creator\_agent\_wallets.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.creator\_agent\_wallets.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.creator\_agent\_wallets.Relationships

> **Relationships**: \[\]

###### Tables.creator\_agent\_wallets.Row

> **Row**: `object`

###### Tables.creator\_agent\_wallets.Row.agent\_wallet\_address

> **agent\_wallet\_address**: `string`

###### Tables.creator\_agent\_wallets.Row.agent\_wallet\_id

> **agent\_wallet\_id**: `string`

###### Tables.creator\_agent\_wallets.Row.coin\_address

> **coin\_address**: `string`

###### Tables.creator\_agent\_wallets.Row.created\_at

> **created\_at**: `string`

###### Tables.creator\_agent\_wallets.Row.updated\_at

> **updated\_at**: `string`

###### Tables.creator\_agent\_wallets.Update

> **Update**: `object`

###### Tables.creator\_agent\_wallets.Update.agent\_wallet\_address?

> `optional` **agent\_wallet\_address**: `string`

###### Tables.creator\_agent\_wallets.Update.agent\_wallet\_id?

> `optional` **agent\_wallet\_id**: `string`

###### Tables.creator\_agent\_wallets.Update.coin\_address?

> `optional` **coin\_address**: `string`

###### Tables.creator\_agent\_wallets.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.creator\_agent\_wallets.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.creator\_coins

> **creator\_coins**: `object`

###### Tables.creator\_coins.Insert

> **Insert**: `object`

###### Tables.creator\_coins.Insert.chain\_id?

> `optional` **chain\_id**: `number`

###### Tables.creator\_coins.Insert.coin\_address

> **coin\_address**: `string`

###### Tables.creator\_coins.Insert.created\_at?

> `optional` **created\_at**: `string` \| `null`

###### Tables.creator\_coins.Insert.creator\_address

> **creator\_address**: `string`

###### Tables.creator\_coins.Insert.fee\_model?

> `optional` **fee\_model**: `string`

###### Tables.creator\_coins.Insert.fees\_24h\_usd?

> `optional` **fees\_24h\_usd**: `number` \| `null`

###### Tables.creator\_coins.Insert.last\_seen\_at?

> `optional` **last\_seen\_at**: `string`

###### Tables.creator\_coins.Insert.market\_cap\_usd?

> `optional` **market\_cap\_usd**: `number` \| `null`

###### Tables.creator\_coins.Insert.volume\_24h\_usd?

> `optional` **volume\_24h\_usd**: `number` \| `null`

###### Tables.creator\_coins.Relationships

> **Relationships**: \[\]

###### Tables.creator\_coins.Row

> **Row**: `object`

###### Tables.creator\_coins.Row.chain\_id

> **chain\_id**: `number`

###### Tables.creator\_coins.Row.coin\_address

> **coin\_address**: `string`

###### Tables.creator\_coins.Row.created\_at

> **created\_at**: `string` \| `null`

###### Tables.creator\_coins.Row.creator\_address

> **creator\_address**: `string`

###### Tables.creator\_coins.Row.fee\_model

> **fee\_model**: `string`

###### Tables.creator\_coins.Row.fees\_24h\_usd

> **fees\_24h\_usd**: `number` \| `null`

###### Tables.creator\_coins.Row.last\_seen\_at

> **last\_seen\_at**: `string`

###### Tables.creator\_coins.Row.market\_cap\_usd

> **market\_cap\_usd**: `number` \| `null`

###### Tables.creator\_coins.Row.volume\_24h\_usd

> **volume\_24h\_usd**: `number` \| `null`

###### Tables.creator\_coins.Update

> **Update**: `object`

###### Tables.creator\_coins.Update.chain\_id?

> `optional` **chain\_id**: `number`

###### Tables.creator\_coins.Update.coin\_address?

> `optional` **coin\_address**: `string`

###### Tables.creator\_coins.Update.created\_at?

> `optional` **created\_at**: `string` \| `null`

###### Tables.creator\_coins.Update.creator\_address?

> `optional` **creator\_address**: `string`

###### Tables.creator\_coins.Update.fee\_model?

> `optional` **fee\_model**: `string`

###### Tables.creator\_coins.Update.fees\_24h\_usd?

> `optional` **fees\_24h\_usd**: `number` \| `null`

###### Tables.creator\_coins.Update.last\_seen\_at?

> `optional` **last\_seen\_at**: `string`

###### Tables.creator\_coins.Update.market\_cap\_usd?

> `optional` **market\_cap\_usd**: `number` \| `null`

###### Tables.creator\_coins.Update.volume\_24h\_usd?

> `optional` **volume\_24h\_usd**: `number` \| `null`

###### Tables.creator\_meteora\_alpha\_vaults

> **creator\_meteora\_alpha\_vaults**: `object`

###### Tables.creator\_meteora\_alpha\_vaults.Insert

> **Insert**: `object`

###### Tables.creator\_meteora\_alpha\_vaults.Insert.alpha\_vault\_program\_id

> **alpha\_vault\_program\_id**: `string`

###### Tables.creator\_meteora\_alpha\_vaults.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.creator\_meteora\_alpha\_vaults.Insert.creator\_token

> **creator\_token**: `string`

###### Tables.creator\_meteora\_alpha\_vaults.Insert.deposit\_accounts

> **deposit\_accounts**: [`Json`](#json)

###### Tables.creator\_meteora\_alpha\_vaults.Insert.enabled?

> `optional` **enabled**: `boolean`

###### Tables.creator\_meteora\_alpha\_vaults.Insert.metadata?

> `optional` **metadata**: [`Json`](#json) \| `null`

###### Tables.creator\_meteora\_alpha\_vaults.Insert.meteora\_alpha\_vault

> **meteora\_alpha\_vault**: `string`

###### Tables.creator\_meteora\_alpha\_vaults.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.creator\_meteora\_alpha\_vaults.Relationships

> **Relationships**: \[\]

###### Tables.creator\_meteora\_alpha\_vaults.Row

> **Row**: `object`

###### Tables.creator\_meteora\_alpha\_vaults.Row.alpha\_vault\_program\_id

> **alpha\_vault\_program\_id**: `string`

###### Tables.creator\_meteora\_alpha\_vaults.Row.created\_at

> **created\_at**: `string`

###### Tables.creator\_meteora\_alpha\_vaults.Row.creator\_token

> **creator\_token**: `string`

###### Tables.creator\_meteora\_alpha\_vaults.Row.deposit\_accounts

> **deposit\_accounts**: [`Json`](#json)

###### Tables.creator\_meteora\_alpha\_vaults.Row.enabled

> **enabled**: `boolean`

###### Tables.creator\_meteora\_alpha\_vaults.Row.metadata

> **metadata**: [`Json`](#json) \| `null`

###### Tables.creator\_meteora\_alpha\_vaults.Row.meteora\_alpha\_vault

> **meteora\_alpha\_vault**: `string`

###### Tables.creator\_meteora\_alpha\_vaults.Row.updated\_at

> **updated\_at**: `string`

###### Tables.creator\_meteora\_alpha\_vaults.Update

> **Update**: `object`

###### Tables.creator\_meteora\_alpha\_vaults.Update.alpha\_vault\_program\_id?

> `optional` **alpha\_vault\_program\_id**: `string`

###### Tables.creator\_meteora\_alpha\_vaults.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.creator\_meteora\_alpha\_vaults.Update.creator\_token?

> `optional` **creator\_token**: `string`

###### Tables.creator\_meteora\_alpha\_vaults.Update.deposit\_accounts?

> `optional` **deposit\_accounts**: [`Json`](#json)

###### Tables.creator\_meteora\_alpha\_vaults.Update.enabled?

> `optional` **enabled**: `boolean`

###### Tables.creator\_meteora\_alpha\_vaults.Update.metadata?

> `optional` **metadata**: [`Json`](#json) \| `null`

###### Tables.creator\_meteora\_alpha\_vaults.Update.meteora\_alpha\_vault?

> `optional` **meteora\_alpha\_vault**: `string`

###### Tables.creator\_meteora\_alpha\_vaults.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.creator\_metrics\_daily\_snapshots

> **creator\_metrics\_daily\_snapshots**: `object`

###### Tables.creator\_metrics\_daily\_snapshots.Insert

> **Insert**: `object`

###### Tables.creator\_metrics\_daily\_snapshots.Insert.creator\_coins\_fees\_24h\_usd?

> `optional` **creator\_coins\_fees\_24h\_usd**: `number` \| `null`

###### Tables.creator\_metrics\_daily\_snapshots.Insert.creator\_coins\_market\_cap\_usd?

> `optional` **creator\_coins\_market\_cap\_usd**: `number` \| `null`

###### Tables.creator\_metrics\_daily\_snapshots.Insert.creator\_coins\_volume\_24h\_usd?

> `optional` **creator\_coins\_volume\_24h\_usd**: `number` \| `null`

###### Tables.creator\_metrics\_daily\_snapshots.Insert.creators\_total?

> `optional` **creators\_total**: `number` \| `null`

###### Tables.creator\_metrics\_daily\_snapshots.Insert.day

> **day**: `string`

###### Tables.creator\_metrics\_daily\_snapshots.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.creator\_metrics\_daily\_snapshots.Relationships

> **Relationships**: \[\]

###### Tables.creator\_metrics\_daily\_snapshots.Row

> **Row**: `object`

###### Tables.creator\_metrics\_daily\_snapshots.Row.creator\_coins\_fees\_24h\_usd

> **creator\_coins\_fees\_24h\_usd**: `number` \| `null`

###### Tables.creator\_metrics\_daily\_snapshots.Row.creator\_coins\_market\_cap\_usd

> **creator\_coins\_market\_cap\_usd**: `number` \| `null`

###### Tables.creator\_metrics\_daily\_snapshots.Row.creator\_coins\_volume\_24h\_usd

> **creator\_coins\_volume\_24h\_usd**: `number` \| `null`

###### Tables.creator\_metrics\_daily\_snapshots.Row.creators\_total

> **creators\_total**: `number` \| `null`

###### Tables.creator\_metrics\_daily\_snapshots.Row.day

> **day**: `string`

###### Tables.creator\_metrics\_daily\_snapshots.Row.updated\_at

> **updated\_at**: `string`

###### Tables.creator\_metrics\_daily\_snapshots.Update

> **Update**: `object`

###### Tables.creator\_metrics\_daily\_snapshots.Update.creator\_coins\_fees\_24h\_usd?

> `optional` **creator\_coins\_fees\_24h\_usd**: `number` \| `null`

###### Tables.creator\_metrics\_daily\_snapshots.Update.creator\_coins\_market\_cap\_usd?

> `optional` **creator\_coins\_market\_cap\_usd**: `number` \| `null`

###### Tables.creator\_metrics\_daily\_snapshots.Update.creator\_coins\_volume\_24h\_usd?

> `optional` **creator\_coins\_volume\_24h\_usd**: `number` \| `null`

###### Tables.creator\_metrics\_daily\_snapshots.Update.creators\_total?

> `optional` **creators\_total**: `number` \| `null`

###### Tables.creator\_metrics\_daily\_snapshots.Update.day?

> `optional` **day**: `string`

###### Tables.creator\_metrics\_daily\_snapshots.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.creator\_metrics\_state

> **creator\_metrics\_state**: `object`

###### Tables.creator\_metrics\_state.Insert

> **Insert**: `object`

###### Tables.creator\_metrics\_state.Insert.backfill\_complete?

> `optional` **backfill\_complete**: `boolean`

###### Tables.creator\_metrics\_state.Insert.checkpoint\_block?

> `optional` **checkpoint\_block**: `number` \| `null`

###### Tables.creator\_metrics\_state.Insert.checkpoint\_cursor?

> `optional` **checkpoint\_cursor**: `string` \| `null`

###### Tables.creator\_metrics\_state.Insert.checkpoint\_log\_index?

> `optional` **checkpoint\_log\_index**: `number` \| `null`

###### Tables.creator\_metrics\_state.Insert.checkpoint\_updated\_at?

> `optional` **checkpoint\_updated\_at**: `string` \| `null`

###### Tables.creator\_metrics\_state.Insert.drift\_estimate\_total?

> `optional` **drift\_estimate\_total**: `number` \| `null`

###### Tables.creator\_metrics\_state.Insert.drift\_pct?

> `optional` **drift\_pct**: `number` \| `null`

###### Tables.creator\_metrics\_state.Insert.id

> **id**: `number`

###### Tables.creator\_metrics\_state.Insert.last\_drift\_checked\_at?

> `optional` **last\_drift\_checked\_at**: `string` \| `null`

###### Tables.creator\_metrics\_state.Insert.last\_full\_sync\_at?

> `optional` **last\_full\_sync\_at**: `string` \| `null`

###### Tables.creator\_metrics\_state.Insert.last\_run\_id?

> `optional` **last\_run\_id**: `string` \| `null`

###### Tables.creator\_metrics\_state.Insert.last\_sync\_finished\_at?

> `optional` **last\_sync\_finished\_at**: `string` \| `null`

###### Tables.creator\_metrics\_state.Insert.last\_sync\_started\_at?

> `optional` **last\_sync\_started\_at**: `string` \| `null`

###### Tables.creator\_metrics\_state.Insert.sampled\_creators?

> `optional` **sampled\_creators**: `number`

###### Tables.creator\_metrics\_state.Insert.sync\_error?

> `optional` **sync\_error**: `string` \| `null`

###### Tables.creator\_metrics\_state.Insert.sync\_error\_count?

> `optional` **sync\_error\_count**: `number`

###### Tables.creator\_metrics\_state.Insert.sync\_status?

> `optional` **sync\_status**: `string`

###### Tables.creator\_metrics\_state.Relationships

> **Relationships**: \[\]

###### Tables.creator\_metrics\_state.Row

> **Row**: `object`

###### Tables.creator\_metrics\_state.Row.backfill\_complete

> **backfill\_complete**: `boolean`

###### Tables.creator\_metrics\_state.Row.checkpoint\_block

> **checkpoint\_block**: `number` \| `null`

###### Tables.creator\_metrics\_state.Row.checkpoint\_cursor

> **checkpoint\_cursor**: `string` \| `null`

###### Tables.creator\_metrics\_state.Row.checkpoint\_log\_index

> **checkpoint\_log\_index**: `number` \| `null`

###### Tables.creator\_metrics\_state.Row.checkpoint\_updated\_at

> **checkpoint\_updated\_at**: `string` \| `null`

###### Tables.creator\_metrics\_state.Row.drift\_estimate\_total

> **drift\_estimate\_total**: `number` \| `null`

###### Tables.creator\_metrics\_state.Row.drift\_pct

> **drift\_pct**: `number` \| `null`

###### Tables.creator\_metrics\_state.Row.id

> **id**: `number`

###### Tables.creator\_metrics\_state.Row.last\_drift\_checked\_at

> **last\_drift\_checked\_at**: `string` \| `null`

###### Tables.creator\_metrics\_state.Row.last\_full\_sync\_at

> **last\_full\_sync\_at**: `string` \| `null`

###### Tables.creator\_metrics\_state.Row.last\_run\_id

> **last\_run\_id**: `string` \| `null`

###### Tables.creator\_metrics\_state.Row.last\_sync\_finished\_at

> **last\_sync\_finished\_at**: `string` \| `null`

###### Tables.creator\_metrics\_state.Row.last\_sync\_started\_at

> **last\_sync\_started\_at**: `string` \| `null`

###### Tables.creator\_metrics\_state.Row.sampled\_creators

> **sampled\_creators**: `number`

###### Tables.creator\_metrics\_state.Row.sync\_error

> **sync\_error**: `string` \| `null`

###### Tables.creator\_metrics\_state.Row.sync\_error\_count

> **sync\_error\_count**: `number`

###### Tables.creator\_metrics\_state.Row.sync\_status

> **sync\_status**: `string`

###### Tables.creator\_metrics\_state.Update

> **Update**: `object`

###### Tables.creator\_metrics\_state.Update.backfill\_complete?

> `optional` **backfill\_complete**: `boolean`

###### Tables.creator\_metrics\_state.Update.checkpoint\_block?

> `optional` **checkpoint\_block**: `number` \| `null`

###### Tables.creator\_metrics\_state.Update.checkpoint\_cursor?

> `optional` **checkpoint\_cursor**: `string` \| `null`

###### Tables.creator\_metrics\_state.Update.checkpoint\_log\_index?

> `optional` **checkpoint\_log\_index**: `number` \| `null`

###### Tables.creator\_metrics\_state.Update.checkpoint\_updated\_at?

> `optional` **checkpoint\_updated\_at**: `string` \| `null`

###### Tables.creator\_metrics\_state.Update.drift\_estimate\_total?

> `optional` **drift\_estimate\_total**: `number` \| `null`

###### Tables.creator\_metrics\_state.Update.drift\_pct?

> `optional` **drift\_pct**: `number` \| `null`

###### Tables.creator\_metrics\_state.Update.id?

> `optional` **id**: `number`

###### Tables.creator\_metrics\_state.Update.last\_drift\_checked\_at?

> `optional` **last\_drift\_checked\_at**: `string` \| `null`

###### Tables.creator\_metrics\_state.Update.last\_full\_sync\_at?

> `optional` **last\_full\_sync\_at**: `string` \| `null`

###### Tables.creator\_metrics\_state.Update.last\_run\_id?

> `optional` **last\_run\_id**: `string` \| `null`

###### Tables.creator\_metrics\_state.Update.last\_sync\_finished\_at?

> `optional` **last\_sync\_finished\_at**: `string` \| `null`

###### Tables.creator\_metrics\_state.Update.last\_sync\_started\_at?

> `optional` **last\_sync\_started\_at**: `string` \| `null`

###### Tables.creator\_metrics\_state.Update.sampled\_creators?

> `optional` **sampled\_creators**: `number`

###### Tables.creator\_metrics\_state.Update.sync\_error?

> `optional` **sync\_error**: `string` \| `null`

###### Tables.creator\_metrics\_state.Update.sync\_error\_count?

> `optional` **sync\_error\_count**: `number`

###### Tables.creator\_metrics\_state.Update.sync\_status?

> `optional` **sync\_status**: `string`

###### Tables.creator\_strategy\_features

> **creator\_strategy\_features**: `object`

###### Tables.creator\_strategy\_features.Insert

> **Insert**: `object`

###### Tables.creator\_strategy\_features.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.creator\_strategy\_features.Insert.creator\_token

> **creator\_token**: `string`

###### Tables.creator\_strategy\_features.Insert.failed\_at?

> `optional` **failed\_at**: `string` \| `null`

###### Tables.creator\_strategy\_features.Insert.failure\_reason?

> `optional` **failure\_reason**: `string` \| `null`

###### Tables.creator\_strategy\_features.Insert.feature\_key

> **feature\_key**: `string`

###### Tables.creator\_strategy\_features.Insert.id?

> `optional` **id**: `number`

###### Tables.creator\_strategy\_features.Insert.metadata?

> `optional` **metadata**: [`Json`](#json)

###### Tables.creator\_strategy\_features.Insert.payment\_from?

> `optional` **payment\_from**: `string` \| `null`

###### Tables.creator\_strategy\_features.Insert.payment\_source?

> `optional` **payment\_source**: `string`

###### Tables.creator\_strategy\_features.Insert.payment\_to?

> `optional` **payment\_to**: `string` \| `null`

###### Tables.creator\_strategy\_features.Insert.payment\_tx\_hash?

> `optional` **payment\_tx\_hash**: `string` \| `null`

###### Tables.creator\_strategy\_features.Insert.payment\_verified\_at?

> `optional` **payment\_verified\_at**: `string` \| `null`

###### Tables.creator\_strategy\_features.Insert.price\_usdc\_paid

> **price\_usdc\_paid**: `number`

###### Tables.creator\_strategy\_features.Insert.provisioned\_at?

> `optional` **provisioned\_at**: `string` \| `null`

###### Tables.creator\_strategy\_features.Insert.provisioner\_ref?

> `optional` **provisioner\_ref**: `string` \| `null`

###### Tables.creator\_strategy\_features.Insert.refunded\_at?

> `optional` **refunded\_at**: `string` \| `null`

###### Tables.creator\_strategy\_features.Insert.status?

> `optional` **status**: `string`

###### Tables.creator\_strategy\_features.Insert.stripe\_charge\_id?

> `optional` **stripe\_charge\_id**: `string` \| `null`

###### Tables.creator\_strategy\_features.Insert.stripe\_checkout\_session\_id?

> `optional` **stripe\_checkout\_session\_id**: `string` \| `null`

###### Tables.creator\_strategy\_features.Insert.stripe\_payment\_intent\_id?

> `optional` **stripe\_payment\_intent\_id**: `string` \| `null`

###### Tables.creator\_strategy\_features.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.creator\_strategy\_features.Insert.x402\_authorization\_nonce?

> `optional` **x402\_authorization\_nonce**: `string` \| `null`

###### Tables.creator\_strategy\_features.Relationships

> **Relationships**: \[\]

###### Tables.creator\_strategy\_features.Row

> **Row**: `object`

###### Tables.creator\_strategy\_features.Row.created\_at

> **created\_at**: `string`

###### Tables.creator\_strategy\_features.Row.creator\_token

> **creator\_token**: `string`

###### Tables.creator\_strategy\_features.Row.failed\_at

> **failed\_at**: `string` \| `null`

###### Tables.creator\_strategy\_features.Row.failure\_reason

> **failure\_reason**: `string` \| `null`

###### Tables.creator\_strategy\_features.Row.feature\_key

> **feature\_key**: `string`

###### Tables.creator\_strategy\_features.Row.id

> **id**: `number`

###### Tables.creator\_strategy\_features.Row.metadata

> **metadata**: [`Json`](#json)

###### Tables.creator\_strategy\_features.Row.payment\_from

> **payment\_from**: `string` \| `null`

###### Tables.creator\_strategy\_features.Row.payment\_source

> **payment\_source**: `string`

###### Tables.creator\_strategy\_features.Row.payment\_to

> **payment\_to**: `string` \| `null`

###### Tables.creator\_strategy\_features.Row.payment\_tx\_hash

> **payment\_tx\_hash**: `string` \| `null`

###### Tables.creator\_strategy\_features.Row.payment\_verified\_at

> **payment\_verified\_at**: `string` \| `null`

###### Tables.creator\_strategy\_features.Row.price\_usdc\_paid

> **price\_usdc\_paid**: `number`

###### Tables.creator\_strategy\_features.Row.provisioned\_at

> **provisioned\_at**: `string` \| `null`

###### Tables.creator\_strategy\_features.Row.provisioner\_ref

> **provisioner\_ref**: `string` \| `null`

###### Tables.creator\_strategy\_features.Row.refunded\_at

> **refunded\_at**: `string` \| `null`

###### Tables.creator\_strategy\_features.Row.status

> **status**: `string`

###### Tables.creator\_strategy\_features.Row.stripe\_charge\_id

> **stripe\_charge\_id**: `string` \| `null`

###### Tables.creator\_strategy\_features.Row.stripe\_checkout\_session\_id

> **stripe\_checkout\_session\_id**: `string` \| `null`

###### Tables.creator\_strategy\_features.Row.stripe\_payment\_intent\_id

> **stripe\_payment\_intent\_id**: `string` \| `null`

###### Tables.creator\_strategy\_features.Row.updated\_at

> **updated\_at**: `string`

###### Tables.creator\_strategy\_features.Row.x402\_authorization\_nonce

> **x402\_authorization\_nonce**: `string` \| `null`

###### Tables.creator\_strategy\_features.Update

> **Update**: `object`

###### Tables.creator\_strategy\_features.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.creator\_strategy\_features.Update.creator\_token?

> `optional` **creator\_token**: `string`

###### Tables.creator\_strategy\_features.Update.failed\_at?

> `optional` **failed\_at**: `string` \| `null`

###### Tables.creator\_strategy\_features.Update.failure\_reason?

> `optional` **failure\_reason**: `string` \| `null`

###### Tables.creator\_strategy\_features.Update.feature\_key?

> `optional` **feature\_key**: `string`

###### Tables.creator\_strategy\_features.Update.id?

> `optional` **id**: `number`

###### Tables.creator\_strategy\_features.Update.metadata?

> `optional` **metadata**: [`Json`](#json)

###### Tables.creator\_strategy\_features.Update.payment\_from?

> `optional` **payment\_from**: `string` \| `null`

###### Tables.creator\_strategy\_features.Update.payment\_source?

> `optional` **payment\_source**: `string`

###### Tables.creator\_strategy\_features.Update.payment\_to?

> `optional` **payment\_to**: `string` \| `null`

###### Tables.creator\_strategy\_features.Update.payment\_tx\_hash?

> `optional` **payment\_tx\_hash**: `string` \| `null`

###### Tables.creator\_strategy\_features.Update.payment\_verified\_at?

> `optional` **payment\_verified\_at**: `string` \| `null`

###### Tables.creator\_strategy\_features.Update.price\_usdc\_paid?

> `optional` **price\_usdc\_paid**: `number`

###### Tables.creator\_strategy\_features.Update.provisioned\_at?

> `optional` **provisioned\_at**: `string` \| `null`

###### Tables.creator\_strategy\_features.Update.provisioner\_ref?

> `optional` **provisioner\_ref**: `string` \| `null`

###### Tables.creator\_strategy\_features.Update.refunded\_at?

> `optional` **refunded\_at**: `string` \| `null`

###### Tables.creator\_strategy\_features.Update.status?

> `optional` **status**: `string`

###### Tables.creator\_strategy\_features.Update.stripe\_charge\_id?

> `optional` **stripe\_charge\_id**: `string` \| `null`

###### Tables.creator\_strategy\_features.Update.stripe\_checkout\_session\_id?

> `optional` **stripe\_checkout\_session\_id**: `string` \| `null`

###### Tables.creator\_strategy\_features.Update.stripe\_payment\_intent\_id?

> `optional` **stripe\_payment\_intent\_id**: `string` \| `null`

###### Tables.creator\_strategy\_features.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.creator\_strategy\_features.Update.x402\_authorization\_nonce?

> `optional` **x402\_authorization\_nonce**: `string` \| `null`

###### Tables.creator\_strategy\_price\_overrides

> **creator\_strategy\_price\_overrides**: `object`

###### Tables.creator\_strategy\_price\_overrides.Insert

> **Insert**: `object`

###### Tables.creator\_strategy\_price\_overrides.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.creator\_strategy\_price\_overrides.Insert.creator\_token?

> `optional` **creator\_token**: `string` \| `null`

###### Tables.creator\_strategy\_price\_overrides.Insert.expires\_at?

> `optional` **expires\_at**: `string` \| `null`

###### Tables.creator\_strategy\_price\_overrides.Insert.feature\_key

> **feature\_key**: `string`

###### Tables.creator\_strategy\_price\_overrides.Insert.granted\_by?

> `optional` **granted\_by**: `string` \| `null`

###### Tables.creator\_strategy\_price\_overrides.Insert.id?

> `optional` **id**: `number`

###### Tables.creator\_strategy\_price\_overrides.Insert.price\_usdc\_override

> **price\_usdc\_override**: `number`

###### Tables.creator\_strategy\_price\_overrides.Insert.reason

> **reason**: `string`

###### Tables.creator\_strategy\_price\_overrides.Insert.revoked\_at?

> `optional` **revoked\_at**: `string` \| `null`

###### Tables.creator\_strategy\_price\_overrides.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.creator\_strategy\_price\_overrides.Insert.wallet\_address?

> `optional` **wallet\_address**: `string` \| `null`

###### Tables.creator\_strategy\_price\_overrides.Relationships

> **Relationships**: \[\]

###### Tables.creator\_strategy\_price\_overrides.Row

> **Row**: `object`

###### Tables.creator\_strategy\_price\_overrides.Row.created\_at

> **created\_at**: `string`

###### Tables.creator\_strategy\_price\_overrides.Row.creator\_token

> **creator\_token**: `string` \| `null`

###### Tables.creator\_strategy\_price\_overrides.Row.expires\_at

> **expires\_at**: `string` \| `null`

###### Tables.creator\_strategy\_price\_overrides.Row.feature\_key

> **feature\_key**: `string`

###### Tables.creator\_strategy\_price\_overrides.Row.granted\_by

> **granted\_by**: `string` \| `null`

###### Tables.creator\_strategy\_price\_overrides.Row.id

> **id**: `number`

###### Tables.creator\_strategy\_price\_overrides.Row.price\_usdc\_override

> **price\_usdc\_override**: `number`

###### Tables.creator\_strategy\_price\_overrides.Row.reason

> **reason**: `string`

###### Tables.creator\_strategy\_price\_overrides.Row.revoked\_at

> **revoked\_at**: `string` \| `null`

###### Tables.creator\_strategy\_price\_overrides.Row.updated\_at

> **updated\_at**: `string`

###### Tables.creator\_strategy\_price\_overrides.Row.wallet\_address

> **wallet\_address**: `string` \| `null`

###### Tables.creator\_strategy\_price\_overrides.Update

> **Update**: `object`

###### Tables.creator\_strategy\_price\_overrides.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.creator\_strategy\_price\_overrides.Update.creator\_token?

> `optional` **creator\_token**: `string` \| `null`

###### Tables.creator\_strategy\_price\_overrides.Update.expires\_at?

> `optional` **expires\_at**: `string` \| `null`

###### Tables.creator\_strategy\_price\_overrides.Update.feature\_key?

> `optional` **feature\_key**: `string`

###### Tables.creator\_strategy\_price\_overrides.Update.granted\_by?

> `optional` **granted\_by**: `string` \| `null`

###### Tables.creator\_strategy\_price\_overrides.Update.id?

> `optional` **id**: `number`

###### Tables.creator\_strategy\_price\_overrides.Update.price\_usdc\_override?

> `optional` **price\_usdc\_override**: `number`

###### Tables.creator\_strategy\_price\_overrides.Update.reason?

> `optional` **reason**: `string`

###### Tables.creator\_strategy\_price\_overrides.Update.revoked\_at?

> `optional` **revoked\_at**: `string` \| `null`

###### Tables.creator\_strategy\_price\_overrides.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.creator\_strategy\_price\_overrides.Update.wallet\_address?

> `optional` **wallet\_address**: `string` \| `null`

###### Tables.creator\_wallets

> **creator\_wallets**: `object`

###### Tables.creator\_wallets.Insert

> **Insert**: `object`

###### Tables.creator\_wallets.Insert.coin\_address

> **coin\_address**: `string`

###### Tables.creator\_wallets.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.creator\_wallets.Insert.id?

> `optional` **id**: `number`

###### Tables.creator\_wallets.Insert.privy\_user\_id?

> `optional` **privy\_user\_id**: `string` \| `null`

###### Tables.creator\_wallets.Insert.verified\_at?

> `optional` **verified\_at**: `string`

###### Tables.creator\_wallets.Insert.verified\_via?

> `optional` **verified\_via**: `string`

###### Tables.creator\_wallets.Insert.wallet\_address

> **wallet\_address**: `string`

###### Tables.creator\_wallets.Insert.wallet\_role

> **wallet\_role**: `string`

###### Tables.creator\_wallets.Relationships

> **Relationships**: \[\]

###### Tables.creator\_wallets.Row

> **Row**: `object`

###### Tables.creator\_wallets.Row.coin\_address

> **coin\_address**: `string`

###### Tables.creator\_wallets.Row.created\_at

> **created\_at**: `string`

###### Tables.creator\_wallets.Row.id

> **id**: `number`

###### Tables.creator\_wallets.Row.privy\_user\_id

> **privy\_user\_id**: `string` \| `null`

###### Tables.creator\_wallets.Row.verified\_at

> **verified\_at**: `string`

###### Tables.creator\_wallets.Row.verified\_via

> **verified\_via**: `string`

###### Tables.creator\_wallets.Row.wallet\_address

> **wallet\_address**: `string`

###### Tables.creator\_wallets.Row.wallet\_role

> **wallet\_role**: `string`

###### Tables.creator\_wallets.Update

> **Update**: `object`

###### Tables.creator\_wallets.Update.coin\_address?

> `optional` **coin\_address**: `string`

###### Tables.creator\_wallets.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.creator\_wallets.Update.id?

> `optional` **id**: `number`

###### Tables.creator\_wallets.Update.privy\_user\_id?

> `optional` **privy\_user\_id**: `string` \| `null`

###### Tables.creator\_wallets.Update.verified\_at?

> `optional` **verified\_at**: `string`

###### Tables.creator\_wallets.Update.verified\_via?

> `optional` **verified\_via**: `string`

###### Tables.creator\_wallets.Update.wallet\_address?

> `optional` **wallet\_address**: `string`

###### Tables.creator\_wallets.Update.wallet\_role?

> `optional` **wallet\_role**: `string`

###### Tables.creator\_xmtp\_agents

> **creator\_xmtp\_agents**: `object`

###### Tables.creator\_xmtp\_agents.Insert

> **Insert**: `object`

###### Tables.creator\_xmtp\_agents.Insert.agent\_type?

> `optional` **agent\_type**: `string`

###### Tables.creator\_xmtp\_agents.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.creator\_xmtp\_agents.Insert.creator\_address

> **creator\_address**: `string`

###### Tables.creator\_xmtp\_agents.Insert.csw\_address?

> `optional` **csw\_address**: `string` \| `null`

###### Tables.creator\_xmtp\_agents.Insert.encrypted\_private\_key\_b64

> **encrypted\_private\_key\_b64**: `string`

###### Tables.creator\_xmtp\_agents.Insert.encrypted\_private\_key\_iv\_b64

> **encrypted\_private\_key\_iv\_b64**: `string`

###### Tables.creator\_xmtp\_agents.Insert.encrypted\_private\_key\_tag\_b64

> **encrypted\_private\_key\_tag\_b64**: `string`

###### Tables.creator\_xmtp\_agents.Insert.last\_processed\_message\_at?

> `optional` **last\_processed\_message\_at**: `string` \| `null`

###### Tables.creator\_xmtp\_agents.Insert.listed\_publicly?

> `optional` **listed\_publicly**: `boolean`

###### Tables.creator\_xmtp\_agents.Insert.privy\_wallet\_id?

> `optional` **privy\_wallet\_id**: `string` \| `null`

###### Tables.creator\_xmtp\_agents.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.creator\_xmtp\_agents.Insert.xmtp\_agent\_address

> **xmtp\_agent\_address**: `string`

###### Tables.creator\_xmtp\_agents.Relationships

> **Relationships**: \[\]

###### Tables.creator\_xmtp\_agents.Row

> **Row**: `object`

###### Tables.creator\_xmtp\_agents.Row.agent\_type

> **agent\_type**: `string`

###### Tables.creator\_xmtp\_agents.Row.created\_at

> **created\_at**: `string`

###### Tables.creator\_xmtp\_agents.Row.creator\_address

> **creator\_address**: `string`

###### Tables.creator\_xmtp\_agents.Row.csw\_address

> **csw\_address**: `string` \| `null`

###### Tables.creator\_xmtp\_agents.Row.encrypted\_private\_key\_b64

> **encrypted\_private\_key\_b64**: `string`

###### Tables.creator\_xmtp\_agents.Row.encrypted\_private\_key\_iv\_b64

> **encrypted\_private\_key\_iv\_b64**: `string`

###### Tables.creator\_xmtp\_agents.Row.encrypted\_private\_key\_tag\_b64

> **encrypted\_private\_key\_tag\_b64**: `string`

###### Tables.creator\_xmtp\_agents.Row.last\_processed\_message\_at

> **last\_processed\_message\_at**: `string` \| `null`

###### Tables.creator\_xmtp\_agents.Row.listed\_publicly

> **listed\_publicly**: `boolean`

###### Tables.creator\_xmtp\_agents.Row.privy\_wallet\_id

> **privy\_wallet\_id**: `string` \| `null`

###### Tables.creator\_xmtp\_agents.Row.updated\_at

> **updated\_at**: `string`

###### Tables.creator\_xmtp\_agents.Row.xmtp\_agent\_address

> **xmtp\_agent\_address**: `string`

###### Tables.creator\_xmtp\_agents.Update

> **Update**: `object`

###### Tables.creator\_xmtp\_agents.Update.agent\_type?

> `optional` **agent\_type**: `string`

###### Tables.creator\_xmtp\_agents.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.creator\_xmtp\_agents.Update.creator\_address?

> `optional` **creator\_address**: `string`

###### Tables.creator\_xmtp\_agents.Update.csw\_address?

> `optional` **csw\_address**: `string` \| `null`

###### Tables.creator\_xmtp\_agents.Update.encrypted\_private\_key\_b64?

> `optional` **encrypted\_private\_key\_b64**: `string`

###### Tables.creator\_xmtp\_agents.Update.encrypted\_private\_key\_iv\_b64?

> `optional` **encrypted\_private\_key\_iv\_b64**: `string`

###### Tables.creator\_xmtp\_agents.Update.encrypted\_private\_key\_tag\_b64?

> `optional` **encrypted\_private\_key\_tag\_b64**: `string`

###### Tables.creator\_xmtp\_agents.Update.last\_processed\_message\_at?

> `optional` **last\_processed\_message\_at**: `string` \| `null`

###### Tables.creator\_xmtp\_agents.Update.listed\_publicly?

> `optional` **listed\_publicly**: `boolean`

###### Tables.creator\_xmtp\_agents.Update.privy\_wallet\_id?

> `optional` **privy\_wallet\_id**: `string` \| `null`

###### Tables.creator\_xmtp\_agents.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.creator\_xmtp\_agents.Update.xmtp\_agent\_address?

> `optional` **xmtp\_agent\_address**: `string`

###### Tables.creators

> **creators**: `object`

###### Tables.creators.Insert

> **Insert**: `object`

###### Tables.creators.Insert.coin\_count?

> `optional` **coin\_count**: `number`

###### Tables.creators.Insert.creator\_address

> **creator\_address**: `string`

###### Tables.creators.Insert.first\_seen\_at?

> `optional` **first\_seen\_at**: `string` \| `null`

###### Tables.creators.Insert.last\_seen\_at?

> `optional` **last\_seen\_at**: `string`

###### Tables.creators.Relationships

> **Relationships**: \[\]

###### Tables.creators.Row

> **Row**: `object`

###### Tables.creators.Row.coin\_count

> **coin\_count**: `number`

###### Tables.creators.Row.creator\_address

> **creator\_address**: `string`

###### Tables.creators.Row.first\_seen\_at

> **first\_seen\_at**: `string` \| `null`

###### Tables.creators.Row.last\_seen\_at

> **last\_seen\_at**: `string`

###### Tables.creators.Update

> **Update**: `object`

###### Tables.creators.Update.coin\_count?

> `optional` **coin\_count**: `number`

###### Tables.creators.Update.creator\_address?

> `optional` **creator\_address**: `string`

###### Tables.creators.Update.first\_seen\_at?

> `optional` **first\_seen\_at**: `string` \| `null`

###### Tables.creators.Update.last\_seen\_at?

> `optional` **last\_seen\_at**: `string`

###### Tables.csw\_owner\_link\_status

> **csw\_owner\_link\_status**: `object`

###### Tables.csw\_owner\_link\_status.Insert

> **Insert**: `object`

###### Tables.csw\_owner\_link\_status.Insert.canonical\_smart\_wallet?

> `optional` **canonical\_smart\_wallet**: `string` \| `null`

###### Tables.csw\_owner\_link\_status.Insert.checked\_at?

> `optional` **checked\_at**: `string`

###### Tables.csw\_owner\_link\_status.Insert.embedded\_eoa?

> `optional` **embedded\_eoa**: `string` \| `null`

###### Tables.csw\_owner\_link\_status.Insert.metadata?

> `optional` **metadata**: [`Json`](#json) \| `null`

###### Tables.csw\_owner\_link\_status.Insert.owner\_linked?

> `optional` **owner\_linked**: `boolean`

###### Tables.csw\_owner\_link\_status.Insert.privy\_user\_id?

> `optional` **privy\_user\_id**: `string` \| `null`

###### Tables.csw\_owner\_link\_status.Insert.profile\_id

> **profile\_id**: `number`

###### Tables.csw\_owner\_link\_status.Insert.reason?

> `optional` **reason**: `string` \| `null`

###### Tables.csw\_owner\_link\_status.Insert.status

> **status**: `string`

###### Tables.csw\_owner\_link\_status.Insert.suggested\_canonical\_smart\_wallet?

> `optional` **suggested\_canonical\_smart\_wallet**: `string` \| `null`

###### Tables.csw\_owner\_link\_status.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.csw\_owner\_link\_status.Relationships

> **Relationships**: \[\{ `columns`: \[`"profile_id"`\]; `foreignKeyName`: `"csw_owner_link_status_profile_id_fkey"`; `isOneToOne`: `true`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"profiles"`; \}\]

###### Tables.csw\_owner\_link\_status.Row

> **Row**: `object`

###### Tables.csw\_owner\_link\_status.Row.canonical\_smart\_wallet

> **canonical\_smart\_wallet**: `string` \| `null`

###### Tables.csw\_owner\_link\_status.Row.checked\_at

> **checked\_at**: `string`

###### Tables.csw\_owner\_link\_status.Row.embedded\_eoa

> **embedded\_eoa**: `string` \| `null`

###### Tables.csw\_owner\_link\_status.Row.metadata

> **metadata**: [`Json`](#json) \| `null`

###### Tables.csw\_owner\_link\_status.Row.owner\_linked

> **owner\_linked**: `boolean`

###### Tables.csw\_owner\_link\_status.Row.privy\_user\_id

> **privy\_user\_id**: `string` \| `null`

###### Tables.csw\_owner\_link\_status.Row.profile\_id

> **profile\_id**: `number`

###### Tables.csw\_owner\_link\_status.Row.reason

> **reason**: `string` \| `null`

###### Tables.csw\_owner\_link\_status.Row.status

> **status**: `string`

###### Tables.csw\_owner\_link\_status.Row.suggested\_canonical\_smart\_wallet

> **suggested\_canonical\_smart\_wallet**: `string` \| `null`

###### Tables.csw\_owner\_link\_status.Row.updated\_at

> **updated\_at**: `string`

###### Tables.csw\_owner\_link\_status.Update

> **Update**: `object`

###### Tables.csw\_owner\_link\_status.Update.canonical\_smart\_wallet?

> `optional` **canonical\_smart\_wallet**: `string` \| `null`

###### Tables.csw\_owner\_link\_status.Update.checked\_at?

> `optional` **checked\_at**: `string`

###### Tables.csw\_owner\_link\_status.Update.embedded\_eoa?

> `optional` **embedded\_eoa**: `string` \| `null`

###### Tables.csw\_owner\_link\_status.Update.metadata?

> `optional` **metadata**: [`Json`](#json) \| `null`

###### Tables.csw\_owner\_link\_status.Update.owner\_linked?

> `optional` **owner\_linked**: `boolean`

###### Tables.csw\_owner\_link\_status.Update.privy\_user\_id?

> `optional` **privy\_user\_id**: `string` \| `null`

###### Tables.csw\_owner\_link\_status.Update.profile\_id?

> `optional` **profile\_id**: `number`

###### Tables.csw\_owner\_link\_status.Update.reason?

> `optional` **reason**: `string` \| `null`

###### Tables.csw\_owner\_link\_status.Update.status?

> `optional` **status**: `string`

###### Tables.csw\_owner\_link\_status.Update.suggested\_canonical\_smart\_wallet?

> `optional` **suggested\_canonical\_smart\_wallet**: `string` \| `null`

###### Tables.csw\_owner\_link\_status.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.deploys

> **deploys**: `object`

###### Tables.deploys.Insert

> **Insert**: `object`

###### Tables.deploys.Insert.artifacts?

> `optional` **artifacts**: [`Json`](#json)

###### Tables.deploys.Insert.attempt\_count?

> `optional` **attempt\_count**: `number`

###### Tables.deploys.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.deploys.Insert.current\_stage?

> `optional` **current\_stage**: `string` \| `null`

###### Tables.deploys.Insert.deploy\_token

> **deploy\_token**: `string`

###### Tables.deploys.Insert.expires\_at

> **expires\_at**: `string`

###### Tables.deploys.Insert.id

> **id**: `string`

###### Tables.deploys.Insert.last\_error?

> `optional` **last\_error**: `string` \| `null`

###### Tables.deploys.Insert.last\_failure\_code?

> `optional` **last\_failure\_code**: `string` \| `null`

###### Tables.deploys.Insert.last\_failure\_stage?

> `optional` **last\_failure\_stage**: `string` \| `null`

###### Tables.deploys.Insert.last\_tx\_hash?

> `optional` **last\_tx\_hash**: `string` \| `null`

###### Tables.deploys.Insert.last\_userop\_hash?

> `optional` **last\_userop\_hash**: `string` \| `null`

###### Tables.deploys.Insert.lock\_expires\_at?

> `optional` **lock\_expires\_at**: `string` \| `null`

###### Tables.deploys.Insert.lock\_owner?

> `optional` **lock\_owner**: `string` \| `null`

###### Tables.deploys.Insert.next\_run\_after?

> `optional` **next\_run\_after**: `string` \| `null`

###### Tables.deploys.Insert.payload

> **payload**: [`Json`](#json)

###### Tables.deploys.Insert.session\_address

> **session\_address**: `string`

###### Tables.deploys.Insert.session\_owner

> **session\_owner**: `string`

###### Tables.deploys.Insert.session\_owner\_key\_enc?

> `optional` **session\_owner\_key\_enc**: `string` \| `null`

###### Tables.deploys.Insert.session\_signer?

> `optional` **session\_signer**: `string` \| `null`

###### Tables.deploys.Insert.session\_signer\_key\_enc?

> `optional` **session\_signer\_key\_enc**: `string` \| `null`

###### Tables.deploys.Insert.smart\_wallet

> **smart\_wallet**: `string`

###### Tables.deploys.Insert.state?

> `optional` **state**: `string` \| `null`

###### Tables.deploys.Insert.step?

> `optional` **step**: `string`

###### Tables.deploys.Insert.token\_hash

> **token\_hash**: `string`

###### Tables.deploys.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.deploys.Relationships

> **Relationships**: \[\]

###### Tables.deploys.Row

> **Row**: `object`

###### Tables.deploys.Row.artifacts

> **artifacts**: [`Json`](#json)

###### Tables.deploys.Row.attempt\_count

> **attempt\_count**: `number`

###### Tables.deploys.Row.created\_at

> **created\_at**: `string`

###### Tables.deploys.Row.current\_stage

> **current\_stage**: `string` \| `null`

###### Tables.deploys.Row.deploy\_token

> **deploy\_token**: `string`

###### Tables.deploys.Row.expires\_at

> **expires\_at**: `string`

###### Tables.deploys.Row.id

> **id**: `string`

###### Tables.deploys.Row.last\_error

> **last\_error**: `string` \| `null`

###### Tables.deploys.Row.last\_failure\_code

> **last\_failure\_code**: `string` \| `null`

###### Tables.deploys.Row.last\_failure\_stage

> **last\_failure\_stage**: `string` \| `null`

###### Tables.deploys.Row.last\_tx\_hash

> **last\_tx\_hash**: `string` \| `null`

###### Tables.deploys.Row.last\_userop\_hash

> **last\_userop\_hash**: `string` \| `null`

###### Tables.deploys.Row.lock\_expires\_at

> **lock\_expires\_at**: `string` \| `null`

###### Tables.deploys.Row.lock\_owner

> **lock\_owner**: `string` \| `null`

###### Tables.deploys.Row.next\_run\_after

> **next\_run\_after**: `string` \| `null`

###### Tables.deploys.Row.payload

> **payload**: [`Json`](#json)

###### Tables.deploys.Row.session\_address

> **session\_address**: `string`

###### Tables.deploys.Row.session\_owner

> **session\_owner**: `string`

###### Tables.deploys.Row.session\_owner\_key\_enc

> **session\_owner\_key\_enc**: `string` \| `null`

###### Tables.deploys.Row.session\_signer

> **session\_signer**: `string` \| `null`

###### Tables.deploys.Row.session\_signer\_key\_enc

> **session\_signer\_key\_enc**: `string` \| `null`

###### Tables.deploys.Row.smart\_wallet

> **smart\_wallet**: `string`

###### Tables.deploys.Row.state

> **state**: `string` \| `null`

###### Tables.deploys.Row.step

> **step**: `string`

###### Tables.deploys.Row.token\_hash

> **token\_hash**: `string`

###### Tables.deploys.Row.updated\_at

> **updated\_at**: `string`

###### Tables.deploys.Update

> **Update**: `object`

###### Tables.deploys.Update.artifacts?

> `optional` **artifacts**: [`Json`](#json)

###### Tables.deploys.Update.attempt\_count?

> `optional` **attempt\_count**: `number`

###### Tables.deploys.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.deploys.Update.current\_stage?

> `optional` **current\_stage**: `string` \| `null`

###### Tables.deploys.Update.deploy\_token?

> `optional` **deploy\_token**: `string`

###### Tables.deploys.Update.expires\_at?

> `optional` **expires\_at**: `string`

###### Tables.deploys.Update.id?

> `optional` **id**: `string`

###### Tables.deploys.Update.last\_error?

> `optional` **last\_error**: `string` \| `null`

###### Tables.deploys.Update.last\_failure\_code?

> `optional` **last\_failure\_code**: `string` \| `null`

###### Tables.deploys.Update.last\_failure\_stage?

> `optional` **last\_failure\_stage**: `string` \| `null`

###### Tables.deploys.Update.last\_tx\_hash?

> `optional` **last\_tx\_hash**: `string` \| `null`

###### Tables.deploys.Update.last\_userop\_hash?

> `optional` **last\_userop\_hash**: `string` \| `null`

###### Tables.deploys.Update.lock\_expires\_at?

> `optional` **lock\_expires\_at**: `string` \| `null`

###### Tables.deploys.Update.lock\_owner?

> `optional` **lock\_owner**: `string` \| `null`

###### Tables.deploys.Update.next\_run\_after?

> `optional` **next\_run\_after**: `string` \| `null`

###### Tables.deploys.Update.payload?

> `optional` **payload**: [`Json`](#json)

###### Tables.deploys.Update.session\_address?

> `optional` **session\_address**: `string`

###### Tables.deploys.Update.session\_owner?

> `optional` **session\_owner**: `string`

###### Tables.deploys.Update.session\_owner\_key\_enc?

> `optional` **session\_owner\_key\_enc**: `string` \| `null`

###### Tables.deploys.Update.session\_signer?

> `optional` **session\_signer**: `string` \| `null`

###### Tables.deploys.Update.session\_signer\_key\_enc?

> `optional` **session\_signer\_key\_enc**: `string` \| `null`

###### Tables.deploys.Update.smart\_wallet?

> `optional` **smart\_wallet**: `string`

###### Tables.deploys.Update.state?

> `optional` **state**: `string` \| `null`

###### Tables.deploys.Update.step?

> `optional` **step**: `string`

###### Tables.deploys.Update.token\_hash?

> `optional` **token\_hash**: `string`

###### Tables.deploys.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.entity\_labels\_cache

> **entity\_labels\_cache**: `object`

###### Tables.entity\_labels\_cache.Insert

> **Insert**: `object`

###### Tables.entity\_labels\_cache.Insert.address

> **address**: `string`

###### Tables.entity\_labels\_cache.Insert.chain\_id?

> `optional` **chain\_id**: `number`

###### Tables.entity\_labels\_cache.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.entity\_labels\_cache.Insert.expires\_at?

> `optional` **expires\_at**: `string`

###### Tables.entity\_labels\_cache.Insert.is\_known?

> `optional` **is\_known**: `boolean`

###### Tables.entity\_labels\_cache.Insert.labels?

> `optional` **labels**: [`Json`](#json)

###### Tables.entity\_labels\_cache.Insert.source?

> `optional` **source**: `string`

###### Tables.entity\_labels\_cache.Relationships

> **Relationships**: \[\]

###### Tables.entity\_labels\_cache.Row

> **Row**: `object`

###### Tables.entity\_labels\_cache.Row.address

> **address**: `string`

###### Tables.entity\_labels\_cache.Row.chain\_id

> **chain\_id**: `number`

###### Tables.entity\_labels\_cache.Row.created\_at

> **created\_at**: `string`

###### Tables.entity\_labels\_cache.Row.expires\_at

> **expires\_at**: `string`

###### Tables.entity\_labels\_cache.Row.is\_known

> **is\_known**: `boolean`

###### Tables.entity\_labels\_cache.Row.labels

> **labels**: [`Json`](#json)

###### Tables.entity\_labels\_cache.Row.source

> **source**: `string`

###### Tables.entity\_labels\_cache.Update

> **Update**: `object`

###### Tables.entity\_labels\_cache.Update.address?

> `optional` **address**: `string`

###### Tables.entity\_labels\_cache.Update.chain\_id?

> `optional` **chain\_id**: `number`

###### Tables.entity\_labels\_cache.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.entity\_labels\_cache.Update.expires\_at?

> `optional` **expires\_at**: `string`

###### Tables.entity\_labels\_cache.Update.is\_known?

> `optional` **is\_known**: `boolean`

###### Tables.entity\_labels\_cache.Update.labels?

> `optional` **labels**: [`Json`](#json)

###### Tables.entity\_labels\_cache.Update.source?

> `optional` **source**: `string`

###### Tables.episodic\_summaries

> **episodic\_summaries**: `object`

###### Tables.episodic\_summaries.Insert

> **Insert**: `object`

###### Tables.episodic\_summaries.Insert.conversation\_id

> **conversation\_id**: `string`

###### Tables.episodic\_summaries.Insert.last\_updated?

> `optional` **last\_updated**: `string`

###### Tables.episodic\_summaries.Insert.summary

> **summary**: `string`

###### Tables.episodic\_summaries.Insert.version?

> `optional` **version**: `number`

###### Tables.episodic\_summaries.Relationships

> **Relationships**: \[\]

###### Tables.episodic\_summaries.Row

> **Row**: `object`

###### Tables.episodic\_summaries.Row.conversation\_id

> **conversation\_id**: `string`

###### Tables.episodic\_summaries.Row.last\_updated

> **last\_updated**: `string`

###### Tables.episodic\_summaries.Row.summary

> **summary**: `string`

###### Tables.episodic\_summaries.Row.version

> **version**: `number`

###### Tables.episodic\_summaries.Update

> **Update**: `object`

###### Tables.episodic\_summaries.Update.conversation\_id?

> `optional` **conversation\_id**: `string`

###### Tables.episodic\_summaries.Update.last\_updated?

> `optional` **last\_updated**: `string`

###### Tables.episodic\_summaries.Update.summary?

> `optional` **summary**: `string`

###### Tables.episodic\_summaries.Update.version?

> `optional` **version**: `number`

###### Tables.fact\_cards

> **fact\_cards**: `object`

###### Tables.fact\_cards.Insert

> **Insert**: `object`

###### Tables.fact\_cards.Insert.confidence?

> `optional` **confidence**: `number` \| `null`

###### Tables.fact\_cards.Insert.conversation\_id?

> `optional` **conversation\_id**: `string` \| `null`

###### Tables.fact\_cards.Insert.entity?

> `optional` **entity**: `string` \| `null`

###### Tables.fact\_cards.Insert.fact

> **fact**: `string`

###### Tables.fact\_cards.Insert.id?

> `optional` **id**: `number`

###### Tables.fact\_cards.Insert.source\_turn\_id?

> `optional` **source\_turn\_id**: `number` \| `null`

###### Tables.fact\_cards.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.fact\_cards.Relationships

> **Relationships**: \[\]

###### Tables.fact\_cards.Row

> **Row**: `object`

###### Tables.fact\_cards.Row.confidence

> **confidence**: `number` \| `null`

###### Tables.fact\_cards.Row.conversation\_id

> **conversation\_id**: `string` \| `null`

###### Tables.fact\_cards.Row.entity

> **entity**: `string` \| `null`

###### Tables.fact\_cards.Row.fact

> **fact**: `string`

###### Tables.fact\_cards.Row.id

> **id**: `number`

###### Tables.fact\_cards.Row.source\_turn\_id

> **source\_turn\_id**: `number` \| `null`

###### Tables.fact\_cards.Row.updated\_at

> **updated\_at**: `string`

###### Tables.fact\_cards.Update

> **Update**: `object`

###### Tables.fact\_cards.Update.confidence?

> `optional` **confidence**: `number` \| `null`

###### Tables.fact\_cards.Update.conversation\_id?

> `optional` **conversation\_id**: `string` \| `null`

###### Tables.fact\_cards.Update.entity?

> `optional` **entity**: `string` \| `null`

###### Tables.fact\_cards.Update.fact?

> `optional` **fact**: `string`

###### Tables.fact\_cards.Update.id?

> `optional` **id**: `number`

###### Tables.fact\_cards.Update.source\_turn\_id?

> `optional` **source\_turn\_id**: `number` \| `null`

###### Tables.fact\_cards.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.farcaster\_rollout\_events

> **farcaster\_rollout\_events**: `object`

###### Tables.farcaster\_rollout\_events.Insert

> **Insert**: `object`

###### Tables.farcaster\_rollout\_events.Insert.category

> **category**: `string`

###### Tables.farcaster\_rollout\_events.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.farcaster\_rollout\_events.Insert.endpoint

> **endpoint**: `string`

###### Tables.farcaster\_rollout\_events.Insert.id?

> `optional` **id**: `number`

###### Tables.farcaster\_rollout\_events.Insert.metadata?

> `optional` **metadata**: [`Json`](#json) \| `null`

###### Tables.farcaster\_rollout\_events.Insert.mode?

> `optional` **mode**: `string` \| `null`

###### Tables.farcaster\_rollout\_events.Insert.source?

> `optional` **source**: `string` \| `null`

###### Tables.farcaster\_rollout\_events.Insert.status\_code?

> `optional` **status\_code**: `number` \| `null`

###### Tables.farcaster\_rollout\_events.Relationships

> **Relationships**: \[\]

###### Tables.farcaster\_rollout\_events.Row

> **Row**: `object`

###### Tables.farcaster\_rollout\_events.Row.category

> **category**: `string`

###### Tables.farcaster\_rollout\_events.Row.created\_at

> **created\_at**: `string`

###### Tables.farcaster\_rollout\_events.Row.endpoint

> **endpoint**: `string`

###### Tables.farcaster\_rollout\_events.Row.id

> **id**: `number`

###### Tables.farcaster\_rollout\_events.Row.metadata

> **metadata**: [`Json`](#json) \| `null`

###### Tables.farcaster\_rollout\_events.Row.mode

> **mode**: `string` \| `null`

###### Tables.farcaster\_rollout\_events.Row.source

> **source**: `string` \| `null`

###### Tables.farcaster\_rollout\_events.Row.status\_code

> **status\_code**: `number` \| `null`

###### Tables.farcaster\_rollout\_events.Update

> **Update**: `object`

###### Tables.farcaster\_rollout\_events.Update.category?

> `optional` **category**: `string`

###### Tables.farcaster\_rollout\_events.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.farcaster\_rollout\_events.Update.endpoint?

> `optional` **endpoint**: `string`

###### Tables.farcaster\_rollout\_events.Update.id?

> `optional` **id**: `number`

###### Tables.farcaster\_rollout\_events.Update.metadata?

> `optional` **metadata**: [`Json`](#json) \| `null`

###### Tables.farcaster\_rollout\_events.Update.mode?

> `optional` **mode**: `string` \| `null`

###### Tables.farcaster\_rollout\_events.Update.source?

> `optional` **source**: `string` \| `null`

###### Tables.farcaster\_rollout\_events.Update.status\_code?

> `optional` **status\_code**: `number` \| `null`

###### Tables.feedback\_index

> **feedback\_index**: `object`

###### Tables.feedback\_index.Insert

> **Insert**: `object`

###### Tables.feedback\_index.Insert.agent\_id

> **agent\_id**: `number`

###### Tables.feedback\_index.Insert.client\_address

> **client\_address**: `string`

###### Tables.feedback\_index.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.feedback\_index.Insert.endpoint?

> `optional` **endpoint**: `string` \| `null`

###### Tables.feedback\_index.Insert.feedback\_hash?

> `optional` **feedback\_hash**: `string` \| `null`

###### Tables.feedback\_index.Insert.feedback\_index

> **feedback\_index**: `number`

###### Tables.feedback\_index.Insert.feedback\_uri?

> `optional` **feedback\_uri**: `string` \| `null`

###### Tables.feedback\_index.Insert.grove\_uri?

> `optional` **grove\_uri**: `string` \| `null`

###### Tables.feedback\_index.Insert.id?

> `optional` **id**: `number`

###### Tables.feedback\_index.Insert.is\_revoked?

> `optional` **is\_revoked**: `boolean`

###### Tables.feedback\_index.Insert.reasoning?

> `optional` **reasoning**: `string` \| `null`

###### Tables.feedback\_index.Insert.tag1?

> `optional` **tag1**: `string`

###### Tables.feedback\_index.Insert.tag2?

> `optional` **tag2**: `string`

###### Tables.feedback\_index.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.feedback\_index.Insert.value

> **value**: `number`

###### Tables.feedback\_index.Insert.value\_decimals?

> `optional` **value\_decimals**: `number`

###### Tables.feedback\_index.Relationships

> **Relationships**: \[\]

###### Tables.feedback\_index.Row

> **Row**: `object`

###### Tables.feedback\_index.Row.agent\_id

> **agent\_id**: `number`

###### Tables.feedback\_index.Row.client\_address

> **client\_address**: `string`

###### Tables.feedback\_index.Row.created\_at

> **created\_at**: `string`

###### Tables.feedback\_index.Row.endpoint

> **endpoint**: `string` \| `null`

###### Tables.feedback\_index.Row.feedback\_hash

> **feedback\_hash**: `string` \| `null`

###### Tables.feedback\_index.Row.feedback\_index

> **feedback\_index**: `number`

###### Tables.feedback\_index.Row.feedback\_uri

> **feedback\_uri**: `string` \| `null`

###### Tables.feedback\_index.Row.grove\_uri

> **grove\_uri**: `string` \| `null`

###### Tables.feedback\_index.Row.id

> **id**: `number`

###### Tables.feedback\_index.Row.is\_revoked

> **is\_revoked**: `boolean`

###### Tables.feedback\_index.Row.reasoning

> **reasoning**: `string` \| `null`

###### Tables.feedback\_index.Row.tag1

> **tag1**: `string`

###### Tables.feedback\_index.Row.tag2

> **tag2**: `string`

###### Tables.feedback\_index.Row.updated\_at

> **updated\_at**: `string`

###### Tables.feedback\_index.Row.value

> **value**: `number`

###### Tables.feedback\_index.Row.value\_decimals

> **value\_decimals**: `number`

###### Tables.feedback\_index.Update

> **Update**: `object`

###### Tables.feedback\_index.Update.agent\_id?

> `optional` **agent\_id**: `number`

###### Tables.feedback\_index.Update.client\_address?

> `optional` **client\_address**: `string`

###### Tables.feedback\_index.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.feedback\_index.Update.endpoint?

> `optional` **endpoint**: `string` \| `null`

###### Tables.feedback\_index.Update.feedback\_hash?

> `optional` **feedback\_hash**: `string` \| `null`

###### Tables.feedback\_index.Update.feedback\_index?

> `optional` **feedback\_index**: `number`

###### Tables.feedback\_index.Update.feedback\_uri?

> `optional` **feedback\_uri**: `string` \| `null`

###### Tables.feedback\_index.Update.grove\_uri?

> `optional` **grove\_uri**: `string` \| `null`

###### Tables.feedback\_index.Update.id?

> `optional` **id**: `number`

###### Tables.feedback\_index.Update.is\_revoked?

> `optional` **is\_revoked**: `boolean`

###### Tables.feedback\_index.Update.reasoning?

> `optional` **reasoning**: `string` \| `null`

###### Tables.feedback\_index.Update.tag1?

> `optional` **tag1**: `string`

###### Tables.feedback\_index.Update.tag2?

> `optional` **tag2**: `string`

###### Tables.feedback\_index.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.feedback\_index.Update.value?

> `optional` **value**: `number`

###### Tables.feedback\_index.Update.value\_decimals?

> `optional` **value\_decimals**: `number`

###### Tables.grove\_chat\_manifests

> **grove\_chat\_manifests**: `object`

###### Tables.grove\_chat\_manifests.Insert

> **Insert**: `object`

###### Tables.grove\_chat\_manifests.Insert.chunk\_list

> **chunk\_list**: [`Json`](#json)

###### Tables.grove\_chat\_manifests.Insert.conversation\_id

> **conversation\_id**: `string`

###### Tables.grove\_chat\_manifests.Insert.encryption\_pubkey?

> `optional` **encryption\_pubkey**: `string` \| `null`

###### Tables.grove\_chat\_manifests.Insert.last\_archived\_at?

> `optional` **last\_archived\_at**: `string` \| `null`

###### Tables.grove\_chat\_manifests.Insert.lens\_profile\_id?

> `optional` **lens\_profile\_id**: `string` \| `null`

###### Tables.grove\_chat\_manifests.Insert.root\_hash

> **root\_hash**: `string`

###### Tables.grove\_chat\_manifests.Relationships

> **Relationships**: \[\]

###### Tables.grove\_chat\_manifests.Row

> **Row**: `object`

###### Tables.grove\_chat\_manifests.Row.chunk\_list

> **chunk\_list**: [`Json`](#json)

###### Tables.grove\_chat\_manifests.Row.conversation\_id

> **conversation\_id**: `string`

###### Tables.grove\_chat\_manifests.Row.encryption\_pubkey

> **encryption\_pubkey**: `string` \| `null`

###### Tables.grove\_chat\_manifests.Row.last\_archived\_at

> **last\_archived\_at**: `string` \| `null`

###### Tables.grove\_chat\_manifests.Row.lens\_profile\_id

> **lens\_profile\_id**: `string` \| `null`

###### Tables.grove\_chat\_manifests.Row.root\_hash

> **root\_hash**: `string`

###### Tables.grove\_chat\_manifests.Update

> **Update**: `object`

###### Tables.grove\_chat\_manifests.Update.chunk\_list?

> `optional` **chunk\_list**: [`Json`](#json)

###### Tables.grove\_chat\_manifests.Update.conversation\_id?

> `optional` **conversation\_id**: `string`

###### Tables.grove\_chat\_manifests.Update.encryption\_pubkey?

> `optional` **encryption\_pubkey**: `string` \| `null`

###### Tables.grove\_chat\_manifests.Update.last\_archived\_at?

> `optional` **last\_archived\_at**: `string` \| `null`

###### Tables.grove\_chat\_manifests.Update.lens\_profile\_id?

> `optional` **lens\_profile\_id**: `string` \| `null`

###### Tables.grove\_chat\_manifests.Update.root\_hash?

> `optional` **root\_hash**: `string`

###### Tables.image\_generation\_assets

> **image\_generation\_assets**: `object`

###### Tables.image\_generation\_assets.Insert

> **Insert**: `object`

###### Tables.image\_generation\_assets.Insert.blob\_pathname

> **blob\_pathname**: `string`

###### Tables.image\_generation\_assets.Insert.blob\_url

> **blob\_url**: `string`

###### Tables.image\_generation\_assets.Insert.byte\_size?

> `optional` **byte\_size**: `number`

###### Tables.image\_generation\_assets.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.image\_generation\_assets.Insert.filename?

> `optional` **filename**: `string` \| `null`

###### Tables.image\_generation\_assets.Insert.id

> **id**: `string`

###### Tables.image\_generation\_assets.Insert.mime\_type

> **mime\_type**: `string`

###### Tables.image\_generation\_assets.Insert.project\_id

> **project\_id**: `string`

###### Tables.image\_generation\_assets.Insert.role

> **role**: `string`

###### Tables.image\_generation\_assets.Relationships

> **Relationships**: \[\{ `columns`: \[`"project_id"`\]; `foreignKeyName`: `"image_generation_assets_project_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"image_generation_projects"`; \}\]

###### Tables.image\_generation\_assets.Row

> **Row**: `object`

###### Tables.image\_generation\_assets.Row.blob\_pathname

> **blob\_pathname**: `string`

###### Tables.image\_generation\_assets.Row.blob\_url

> **blob\_url**: `string`

###### Tables.image\_generation\_assets.Row.byte\_size

> **byte\_size**: `number`

###### Tables.image\_generation\_assets.Row.created\_at

> **created\_at**: `string`

###### Tables.image\_generation\_assets.Row.filename

> **filename**: `string` \| `null`

###### Tables.image\_generation\_assets.Row.id

> **id**: `string`

###### Tables.image\_generation\_assets.Row.mime\_type

> **mime\_type**: `string`

###### Tables.image\_generation\_assets.Row.project\_id

> **project\_id**: `string`

###### Tables.image\_generation\_assets.Row.role

> **role**: `string`

###### Tables.image\_generation\_assets.Update

> **Update**: `object`

###### Tables.image\_generation\_assets.Update.blob\_pathname?

> `optional` **blob\_pathname**: `string`

###### Tables.image\_generation\_assets.Update.blob\_url?

> `optional` **blob\_url**: `string`

###### Tables.image\_generation\_assets.Update.byte\_size?

> `optional` **byte\_size**: `number`

###### Tables.image\_generation\_assets.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.image\_generation\_assets.Update.filename?

> `optional` **filename**: `string` \| `null`

###### Tables.image\_generation\_assets.Update.id?

> `optional` **id**: `string`

###### Tables.image\_generation\_assets.Update.mime\_type?

> `optional` **mime\_type**: `string`

###### Tables.image\_generation\_assets.Update.project\_id?

> `optional` **project\_id**: `string`

###### Tables.image\_generation\_assets.Update.role?

> `optional` **role**: `string`

###### Tables.image\_generation\_attempts

> **image\_generation\_attempts**: `object`

###### Tables.image\_generation\_attempts.Insert

> **Insert**: `object`

###### Tables.image\_generation\_attempts.Insert.attempt\_number?

> `optional` **attempt\_number**: `number`

###### Tables.image\_generation\_attempts.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.image\_generation\_attempts.Insert.evaluation\_json?

> `optional` **evaluation\_json**: [`Json`](#json) \| `null`

###### Tables.image\_generation\_attempts.Insert.id

> **id**: `string`

###### Tables.image\_generation\_attempts.Insert.job\_id?

> `optional` **job\_id**: `string` \| `null`

###### Tables.image\_generation\_attempts.Insert.kind?

> `optional` **kind**: `string`

###### Tables.image\_generation\_attempts.Insert.output\_asset\_id?

> `optional` **output\_asset\_id**: `string` \| `null`

###### Tables.image\_generation\_attempts.Insert.passed?

> `optional` **passed**: `boolean` \| `null`

###### Tables.image\_generation\_attempts.Insert.project\_id

> **project\_id**: `string`

###### Tables.image\_generation\_attempts.Insert.prompt

> **prompt**: `string`

###### Tables.image\_generation\_attempts.Insert.response\_id?

> `optional` **response\_id**: `string` \| `null`

###### Tables.image\_generation\_attempts.Insert.revised\_prompt?

> `optional` **revised\_prompt**: `string` \| `null`

###### Tables.image\_generation\_attempts.Insert.score?

> `optional` **score**: `number` \| `null`

###### Tables.image\_generation\_attempts.Relationships

> **Relationships**: \[\{ `columns`: \[`"project_id"`\]; `foreignKeyName`: `"image_generation_attempts_project_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"image_generation_projects"`; \}\]

###### Tables.image\_generation\_attempts.Row

> **Row**: `object`

###### Tables.image\_generation\_attempts.Row.attempt\_number

> **attempt\_number**: `number`

###### Tables.image\_generation\_attempts.Row.created\_at

> **created\_at**: `string`

###### Tables.image\_generation\_attempts.Row.evaluation\_json

> **evaluation\_json**: [`Json`](#json) \| `null`

###### Tables.image\_generation\_attempts.Row.id

> **id**: `string`

###### Tables.image\_generation\_attempts.Row.job\_id

> **job\_id**: `string` \| `null`

###### Tables.image\_generation\_attempts.Row.kind

> **kind**: `string`

###### Tables.image\_generation\_attempts.Row.output\_asset\_id

> **output\_asset\_id**: `string` \| `null`

###### Tables.image\_generation\_attempts.Row.passed

> **passed**: `boolean` \| `null`

###### Tables.image\_generation\_attempts.Row.project\_id

> **project\_id**: `string`

###### Tables.image\_generation\_attempts.Row.prompt

> **prompt**: `string`

###### Tables.image\_generation\_attempts.Row.response\_id

> **response\_id**: `string` \| `null`

###### Tables.image\_generation\_attempts.Row.revised\_prompt

> **revised\_prompt**: `string` \| `null`

###### Tables.image\_generation\_attempts.Row.score

> **score**: `number` \| `null`

###### Tables.image\_generation\_attempts.Update

> **Update**: `object`

###### Tables.image\_generation\_attempts.Update.attempt\_number?

> `optional` **attempt\_number**: `number`

###### Tables.image\_generation\_attempts.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.image\_generation\_attempts.Update.evaluation\_json?

> `optional` **evaluation\_json**: [`Json`](#json) \| `null`

###### Tables.image\_generation\_attempts.Update.id?

> `optional` **id**: `string`

###### Tables.image\_generation\_attempts.Update.job\_id?

> `optional` **job\_id**: `string` \| `null`

###### Tables.image\_generation\_attempts.Update.kind?

> `optional` **kind**: `string`

###### Tables.image\_generation\_attempts.Update.output\_asset\_id?

> `optional` **output\_asset\_id**: `string` \| `null`

###### Tables.image\_generation\_attempts.Update.passed?

> `optional` **passed**: `boolean` \| `null`

###### Tables.image\_generation\_attempts.Update.project\_id?

> `optional` **project\_id**: `string`

###### Tables.image\_generation\_attempts.Update.prompt?

> `optional` **prompt**: `string`

###### Tables.image\_generation\_attempts.Update.response\_id?

> `optional` **response\_id**: `string` \| `null`

###### Tables.image\_generation\_attempts.Update.revised\_prompt?

> `optional` **revised\_prompt**: `string` \| `null`

###### Tables.image\_generation\_attempts.Update.score?

> `optional` **score**: `number` \| `null`

###### Tables.image\_generation\_jobs

> **image\_generation\_jobs**: `object`

###### Tables.image\_generation\_jobs.Insert

> **Insert**: `object`

###### Tables.image\_generation\_jobs.Insert.attempts?

> `optional` **attempts**: `number`

###### Tables.image\_generation\_jobs.Insert.completed\_at?

> `optional` **completed\_at**: `string` \| `null`

###### Tables.image\_generation\_jobs.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.image\_generation\_jobs.Insert.id

> **id**: `string`

###### Tables.image\_generation\_jobs.Insert.kind?

> `optional` **kind**: `string`

###### Tables.image\_generation\_jobs.Insert.latest\_error?

> `optional` **latest\_error**: `string` \| `null`

###### Tables.image\_generation\_jobs.Insert.leased\_at?

> `optional` **leased\_at**: `string` \| `null`

###### Tables.image\_generation\_jobs.Insert.leased\_by?

> `optional` **leased\_by**: `string` \| `null`

###### Tables.image\_generation\_jobs.Insert.max\_attempts?

> `optional` **max\_attempts**: `number`

###### Tables.image\_generation\_jobs.Insert.project\_id

> **project\_id**: `string`

###### Tables.image\_generation\_jobs.Insert.refine\_instruction?

> `optional` **refine\_instruction**: `string` \| `null`

###### Tables.image\_generation\_jobs.Insert.result\_json?

> `optional` **result\_json**: [`Json`](#json) \| `null`

###### Tables.image\_generation\_jobs.Insert.run\_after?

> `optional` **run\_after**: `string`

###### Tables.image\_generation\_jobs.Insert.status?

> `optional` **status**: `string`

###### Tables.image\_generation\_jobs.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.image\_generation\_jobs.Relationships

> **Relationships**: \[\{ `columns`: \[`"project_id"`\]; `foreignKeyName`: `"image_generation_jobs_project_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"image_generation_projects"`; \}\]

###### Tables.image\_generation\_jobs.Row

> **Row**: `object`

###### Tables.image\_generation\_jobs.Row.attempts

> **attempts**: `number`

###### Tables.image\_generation\_jobs.Row.completed\_at

> **completed\_at**: `string` \| `null`

###### Tables.image\_generation\_jobs.Row.created\_at

> **created\_at**: `string`

###### Tables.image\_generation\_jobs.Row.id

> **id**: `string`

###### Tables.image\_generation\_jobs.Row.kind

> **kind**: `string`

###### Tables.image\_generation\_jobs.Row.latest\_error

> **latest\_error**: `string` \| `null`

###### Tables.image\_generation\_jobs.Row.leased\_at

> **leased\_at**: `string` \| `null`

###### Tables.image\_generation\_jobs.Row.leased\_by

> **leased\_by**: `string` \| `null`

###### Tables.image\_generation\_jobs.Row.max\_attempts

> **max\_attempts**: `number`

###### Tables.image\_generation\_jobs.Row.project\_id

> **project\_id**: `string`

###### Tables.image\_generation\_jobs.Row.refine\_instruction

> **refine\_instruction**: `string` \| `null`

###### Tables.image\_generation\_jobs.Row.result\_json

> **result\_json**: [`Json`](#json) \| `null`

###### Tables.image\_generation\_jobs.Row.run\_after

> **run\_after**: `string`

###### Tables.image\_generation\_jobs.Row.status

> **status**: `string`

###### Tables.image\_generation\_jobs.Row.updated\_at

> **updated\_at**: `string`

###### Tables.image\_generation\_jobs.Update

> **Update**: `object`

###### Tables.image\_generation\_jobs.Update.attempts?

> `optional` **attempts**: `number`

###### Tables.image\_generation\_jobs.Update.completed\_at?

> `optional` **completed\_at**: `string` \| `null`

###### Tables.image\_generation\_jobs.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.image\_generation\_jobs.Update.id?

> `optional` **id**: `string`

###### Tables.image\_generation\_jobs.Update.kind?

> `optional` **kind**: `string`

###### Tables.image\_generation\_jobs.Update.latest\_error?

> `optional` **latest\_error**: `string` \| `null`

###### Tables.image\_generation\_jobs.Update.leased\_at?

> `optional` **leased\_at**: `string` \| `null`

###### Tables.image\_generation\_jobs.Update.leased\_by?

> `optional` **leased\_by**: `string` \| `null`

###### Tables.image\_generation\_jobs.Update.max\_attempts?

> `optional` **max\_attempts**: `number`

###### Tables.image\_generation\_jobs.Update.project\_id?

> `optional` **project\_id**: `string`

###### Tables.image\_generation\_jobs.Update.refine\_instruction?

> `optional` **refine\_instruction**: `string` \| `null`

###### Tables.image\_generation\_jobs.Update.result\_json?

> `optional` **result\_json**: [`Json`](#json) \| `null`

###### Tables.image\_generation\_jobs.Update.run\_after?

> `optional` **run\_after**: `string`

###### Tables.image\_generation\_jobs.Update.status?

> `optional` **status**: `string`

###### Tables.image\_generation\_jobs.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.image\_generation\_projects

> **image\_generation\_projects**: `object`

###### Tables.image\_generation\_projects.Insert

> **Insert**: `object`

###### Tables.image\_generation\_projects.Insert.brand\_context\_json?

> `optional` **brand\_context\_json**: [`Json`](#json)

###### Tables.image\_generation\_projects.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.image\_generation\_projects.Insert.creator\_address?

> `optional` **creator\_address**: `string` \| `null`

###### Tables.image\_generation\_projects.Insert.id

> **id**: `string`

###### Tables.image\_generation\_projects.Insert.instruction?

> `optional` **instruction**: `string`

###### Tables.image\_generation\_projects.Insert.last\_response\_id?

> `optional` **last\_response\_id**: `string` \| `null`

###### Tables.image\_generation\_projects.Insert.latest\_error?

> `optional` **latest\_error**: `string` \| `null`

###### Tables.image\_generation\_projects.Insert.owner\_address?

> `optional` **owner\_address**: `string` \| `null`

###### Tables.image\_generation\_projects.Insert.status?

> `optional` **status**: `string`

###### Tables.image\_generation\_projects.Insert.style\_preset?

> `optional` **style\_preset**: `string` \| `null`

###### Tables.image\_generation\_projects.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.image\_generation\_projects.Insert.vault\_address?

> `optional` **vault\_address**: `string` \| `null`

###### Tables.image\_generation\_projects.Relationships

> **Relationships**: \[\]

###### Tables.image\_generation\_projects.Row

> **Row**: `object`

###### Tables.image\_generation\_projects.Row.brand\_context\_json

> **brand\_context\_json**: [`Json`](#json)

###### Tables.image\_generation\_projects.Row.created\_at

> **created\_at**: `string`

###### Tables.image\_generation\_projects.Row.creator\_address

> **creator\_address**: `string` \| `null`

###### Tables.image\_generation\_projects.Row.id

> **id**: `string`

###### Tables.image\_generation\_projects.Row.instruction

> **instruction**: `string`

###### Tables.image\_generation\_projects.Row.last\_response\_id

> **last\_response\_id**: `string` \| `null`

###### Tables.image\_generation\_projects.Row.latest\_error

> **latest\_error**: `string` \| `null`

###### Tables.image\_generation\_projects.Row.owner\_address

> **owner\_address**: `string` \| `null`

###### Tables.image\_generation\_projects.Row.status

> **status**: `string`

###### Tables.image\_generation\_projects.Row.style\_preset

> **style\_preset**: `string` \| `null`

###### Tables.image\_generation\_projects.Row.updated\_at

> **updated\_at**: `string`

###### Tables.image\_generation\_projects.Row.vault\_address

> **vault\_address**: `string` \| `null`

###### Tables.image\_generation\_projects.Update

> **Update**: `object`

###### Tables.image\_generation\_projects.Update.brand\_context\_json?

> `optional` **brand\_context\_json**: [`Json`](#json)

###### Tables.image\_generation\_projects.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.image\_generation\_projects.Update.creator\_address?

> `optional` **creator\_address**: `string` \| `null`

###### Tables.image\_generation\_projects.Update.id?

> `optional` **id**: `string`

###### Tables.image\_generation\_projects.Update.instruction?

> `optional` **instruction**: `string`

###### Tables.image\_generation\_projects.Update.last\_response\_id?

> `optional` **last\_response\_id**: `string` \| `null`

###### Tables.image\_generation\_projects.Update.latest\_error?

> `optional` **latest\_error**: `string` \| `null`

###### Tables.image\_generation\_projects.Update.owner\_address?

> `optional` **owner\_address**: `string` \| `null`

###### Tables.image\_generation\_projects.Update.status?

> `optional` **status**: `string`

###### Tables.image\_generation\_projects.Update.style\_preset?

> `optional` **style\_preset**: `string` \| `null`

###### Tables.image\_generation\_projects.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.image\_generation\_projects.Update.vault\_address?

> `optional` **vault\_address**: `string` \| `null`

###### Tables.index\_usage\_snapshots

> **index\_usage\_snapshots**: `object`

###### Tables.index\_usage\_snapshots.Insert

> **Insert**: `object`

###### Tables.index\_usage\_snapshots.Insert.id?

> `optional` **id**: `number`

###### Tables.index\_usage\_snapshots.Insert.idx\_scan?

> `optional` **idx\_scan**: `number`

###### Tables.index\_usage\_snapshots.Insert.idx\_tup\_fetch?

> `optional` **idx\_tup\_fetch**: `number`

###### Tables.index\_usage\_snapshots.Insert.idx\_tup\_read?

> `optional` **idx\_tup\_read**: `number`

###### Tables.index\_usage\_snapshots.Insert.index\_size\_bytes?

> `optional` **index\_size\_bytes**: `number`

###### Tables.index\_usage\_snapshots.Insert.indexname

> **indexname**: `string`

###### Tables.index\_usage\_snapshots.Insert.is\_primary?

> `optional` **is\_primary**: `boolean`

###### Tables.index\_usage\_snapshots.Insert.is\_unique?

> `optional` **is\_unique**: `boolean`

###### Tables.index\_usage\_snapshots.Insert.n\_live\_tup?

> `optional` **n\_live\_tup**: `number`

###### Tables.index\_usage\_snapshots.Insert.n\_tup\_del?

> `optional` **n\_tup\_del**: `number`

###### Tables.index\_usage\_snapshots.Insert.n\_tup\_ins?

> `optional` **n\_tup\_ins**: `number`

###### Tables.index\_usage\_snapshots.Insert.n\_tup\_upd?

> `optional` **n\_tup\_upd**: `number`

###### Tables.index\_usage\_snapshots.Insert.schemaname

> **schemaname**: `string`

###### Tables.index\_usage\_snapshots.Insert.snapshot\_at?

> `optional` **snapshot\_at**: `string`

###### Tables.index\_usage\_snapshots.Insert.stats\_reset?

> `optional` **stats\_reset**: `string` \| `null`

###### Tables.index\_usage\_snapshots.Insert.tablename

> **tablename**: `string`

###### Tables.index\_usage\_snapshots.Relationships

> **Relationships**: \[\]

###### Tables.index\_usage\_snapshots.Row

> **Row**: `object`

###### Tables.index\_usage\_snapshots.Row.id

> **id**: `number`

###### Tables.index\_usage\_snapshots.Row.idx\_scan

> **idx\_scan**: `number`

###### Tables.index\_usage\_snapshots.Row.idx\_tup\_fetch

> **idx\_tup\_fetch**: `number`

###### Tables.index\_usage\_snapshots.Row.idx\_tup\_read

> **idx\_tup\_read**: `number`

###### Tables.index\_usage\_snapshots.Row.index\_size\_bytes

> **index\_size\_bytes**: `number`

###### Tables.index\_usage\_snapshots.Row.indexname

> **indexname**: `string`

###### Tables.index\_usage\_snapshots.Row.is\_primary

> **is\_primary**: `boolean`

###### Tables.index\_usage\_snapshots.Row.is\_unique

> **is\_unique**: `boolean`

###### Tables.index\_usage\_snapshots.Row.n\_live\_tup

> **n\_live\_tup**: `number`

###### Tables.index\_usage\_snapshots.Row.n\_tup\_del

> **n\_tup\_del**: `number`

###### Tables.index\_usage\_snapshots.Row.n\_tup\_ins

> **n\_tup\_ins**: `number`

###### Tables.index\_usage\_snapshots.Row.n\_tup\_upd

> **n\_tup\_upd**: `number`

###### Tables.index\_usage\_snapshots.Row.schemaname

> **schemaname**: `string`

###### Tables.index\_usage\_snapshots.Row.snapshot\_at

> **snapshot\_at**: `string`

###### Tables.index\_usage\_snapshots.Row.stats\_reset

> **stats\_reset**: `string` \| `null`

###### Tables.index\_usage\_snapshots.Row.tablename

> **tablename**: `string`

###### Tables.index\_usage\_snapshots.Update

> **Update**: `object`

###### Tables.index\_usage\_snapshots.Update.id?

> `optional` **id**: `number`

###### Tables.index\_usage\_snapshots.Update.idx\_scan?

> `optional` **idx\_scan**: `number`

###### Tables.index\_usage\_snapshots.Update.idx\_tup\_fetch?

> `optional` **idx\_tup\_fetch**: `number`

###### Tables.index\_usage\_snapshots.Update.idx\_tup\_read?

> `optional` **idx\_tup\_read**: `number`

###### Tables.index\_usage\_snapshots.Update.index\_size\_bytes?

> `optional` **index\_size\_bytes**: `number`

###### Tables.index\_usage\_snapshots.Update.indexname?

> `optional` **indexname**: `string`

###### Tables.index\_usage\_snapshots.Update.is\_primary?

> `optional` **is\_primary**: `boolean`

###### Tables.index\_usage\_snapshots.Update.is\_unique?

> `optional` **is\_unique**: `boolean`

###### Tables.index\_usage\_snapshots.Update.n\_live\_tup?

> `optional` **n\_live\_tup**: `number`

###### Tables.index\_usage\_snapshots.Update.n\_tup\_del?

> `optional` **n\_tup\_del**: `number`

###### Tables.index\_usage\_snapshots.Update.n\_tup\_ins?

> `optional` **n\_tup\_ins**: `number`

###### Tables.index\_usage\_snapshots.Update.n\_tup\_upd?

> `optional` **n\_tup\_upd**: `number`

###### Tables.index\_usage\_snapshots.Update.schemaname?

> `optional` **schemaname**: `string`

###### Tables.index\_usage\_snapshots.Update.snapshot\_at?

> `optional` **snapshot\_at**: `string`

###### Tables.index\_usage\_snapshots.Update.stats\_reset?

> `optional` **stats\_reset**: `string` \| `null`

###### Tables.index\_usage\_snapshots.Update.tablename?

> `optional` **tablename**: `string`

###### Tables.keepr\_actions

> **keepr\_actions**: `object`

###### Tables.keepr\_actions.Insert

> **Insert**: `object`

###### Tables.keepr\_actions.Insert.action

> **action**: [`Json`](#json)

###### Tables.keepr\_actions.Insert.action\_type?

> `optional` **action\_type**: `string` \| `null`

###### Tables.keepr\_actions.Insert.attempt\_count?

> `optional` **attempt\_count**: `number`

###### Tables.keepr\_actions.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.keepr\_actions.Insert.dedupe\_key?

> `optional` **dedupe\_key**: `string` \| `null`

###### Tables.keepr\_actions.Insert.executed\_at?

> `optional` **executed\_at**: `string` \| `null`

###### Tables.keepr\_actions.Insert.group\_id

> **group\_id**: `string`

###### Tables.keepr\_actions.Insert.id?

> `optional` **id**: `number`

###### Tables.keepr\_actions.Insert.last\_error?

> `optional` **last\_error**: `string` \| `null`

###### Tables.keepr\_actions.Insert.next\_attempt\_at?

> `optional` **next\_attempt\_at**: `string` \| `null`

###### Tables.keepr\_actions.Insert.status?

> `optional` **status**: `string`

###### Tables.keepr\_actions.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.keepr\_actions.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.keepr\_actions.Relationships

> **Relationships**: \[\]

###### Tables.keepr\_actions.Row

> **Row**: `object`

###### Tables.keepr\_actions.Row.action

> **action**: [`Json`](#json)

###### Tables.keepr\_actions.Row.action\_type

> **action\_type**: `string` \| `null`

###### Tables.keepr\_actions.Row.attempt\_count

> **attempt\_count**: `number`

###### Tables.keepr\_actions.Row.created\_at

> **created\_at**: `string`

###### Tables.keepr\_actions.Row.dedupe\_key

> **dedupe\_key**: `string` \| `null`

###### Tables.keepr\_actions.Row.executed\_at

> **executed\_at**: `string` \| `null`

###### Tables.keepr\_actions.Row.group\_id

> **group\_id**: `string`

###### Tables.keepr\_actions.Row.id

> **id**: `number`

###### Tables.keepr\_actions.Row.last\_error

> **last\_error**: `string` \| `null`

###### Tables.keepr\_actions.Row.next\_attempt\_at

> **next\_attempt\_at**: `string` \| `null`

###### Tables.keepr\_actions.Row.status

> **status**: `string`

###### Tables.keepr\_actions.Row.updated\_at

> **updated\_at**: `string`

###### Tables.keepr\_actions.Row.vault\_address

> **vault\_address**: `string`

###### Tables.keepr\_actions.Update

> **Update**: `object`

###### Tables.keepr\_actions.Update.action?

> `optional` **action**: [`Json`](#json)

###### Tables.keepr\_actions.Update.action\_type?

> `optional` **action\_type**: `string` \| `null`

###### Tables.keepr\_actions.Update.attempt\_count?

> `optional` **attempt\_count**: `number`

###### Tables.keepr\_actions.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.keepr\_actions.Update.dedupe\_key?

> `optional` **dedupe\_key**: `string` \| `null`

###### Tables.keepr\_actions.Update.executed\_at?

> `optional` **executed\_at**: `string` \| `null`

###### Tables.keepr\_actions.Update.group\_id?

> `optional` **group\_id**: `string`

###### Tables.keepr\_actions.Update.id?

> `optional` **id**: `number`

###### Tables.keepr\_actions.Update.last\_error?

> `optional` **last\_error**: `string` \| `null`

###### Tables.keepr\_actions.Update.next\_attempt\_at?

> `optional` **next\_attempt\_at**: `string` \| `null`

###### Tables.keepr\_actions.Update.status?

> `optional` **status**: `string`

###### Tables.keepr\_actions.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.keepr\_actions.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.keepr\_join\_requests

> **keepr\_join\_requests**: `object`

###### Tables.keepr\_join\_requests.Insert

> **Insert**: `object`

###### Tables.keepr\_join\_requests.Insert.action\_id?

> `optional` **action\_id**: `number` \| `null`

###### Tables.keepr\_join\_requests.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.keepr\_join\_requests.Insert.group\_id

> **group\_id**: `string`

###### Tables.keepr\_join\_requests.Insert.id?

> `optional` **id**: `number`

###### Tables.keepr\_join\_requests.Insert.last\_checked\_at?

> `optional` **last\_checked\_at**: `string` \| `null`

###### Tables.keepr\_join\_requests.Insert.last\_reason?

> `optional` **last\_reason**: `string` \| `null`

###### Tables.keepr\_join\_requests.Insert.next\_check\_at?

> `optional` **next\_check\_at**: `string` \| `null`

###### Tables.keepr\_join\_requests.Insert.status?

> `optional` **status**: `string`

###### Tables.keepr\_join\_requests.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.keepr\_join\_requests.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.keepr\_join\_requests.Insert.wallet\_address

> **wallet\_address**: `string`

###### Tables.keepr\_join\_requests.Relationships

> **Relationships**: \[\]

###### Tables.keepr\_join\_requests.Row

> **Row**: `object`

###### Tables.keepr\_join\_requests.Row.action\_id

> **action\_id**: `number` \| `null`

###### Tables.keepr\_join\_requests.Row.created\_at

> **created\_at**: `string`

###### Tables.keepr\_join\_requests.Row.group\_id

> **group\_id**: `string`

###### Tables.keepr\_join\_requests.Row.id

> **id**: `number`

###### Tables.keepr\_join\_requests.Row.last\_checked\_at

> **last\_checked\_at**: `string` \| `null`

###### Tables.keepr\_join\_requests.Row.last\_reason

> **last\_reason**: `string` \| `null`

###### Tables.keepr\_join\_requests.Row.next\_check\_at

> **next\_check\_at**: `string` \| `null`

###### Tables.keepr\_join\_requests.Row.status

> **status**: `string`

###### Tables.keepr\_join\_requests.Row.updated\_at

> **updated\_at**: `string`

###### Tables.keepr\_join\_requests.Row.vault\_address

> **vault\_address**: `string`

###### Tables.keepr\_join\_requests.Row.wallet\_address

> **wallet\_address**: `string`

###### Tables.keepr\_join\_requests.Update

> **Update**: `object`

###### Tables.keepr\_join\_requests.Update.action\_id?

> `optional` **action\_id**: `number` \| `null`

###### Tables.keepr\_join\_requests.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.keepr\_join\_requests.Update.group\_id?

> `optional` **group\_id**: `string`

###### Tables.keepr\_join\_requests.Update.id?

> `optional` **id**: `number`

###### Tables.keepr\_join\_requests.Update.last\_checked\_at?

> `optional` **last\_checked\_at**: `string` \| `null`

###### Tables.keepr\_join\_requests.Update.last\_reason?

> `optional` **last\_reason**: `string` \| `null`

###### Tables.keepr\_join\_requests.Update.next\_check\_at?

> `optional` **next\_check\_at**: `string` \| `null`

###### Tables.keepr\_join\_requests.Update.status?

> `optional` **status**: `string`

###### Tables.keepr\_join\_requests.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.keepr\_join\_requests.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.keepr\_join\_requests.Update.wallet\_address?

> `optional` **wallet\_address**: `string`

###### Tables.keepr\_logs

> **keepr\_logs**: `object`

###### Tables.keepr\_logs.Insert

> **Insert**: `object`

###### Tables.keepr\_logs.Insert.actor\_wallet?

> `optional` **actor\_wallet**: `string` \| `null`

###### Tables.keepr\_logs.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.keepr\_logs.Insert.details?

> `optional` **details**: [`Json`](#json)

###### Tables.keepr\_logs.Insert.event\_type

> **event\_type**: `string`

###### Tables.keepr\_logs.Insert.id?

> `optional` **id**: `number`

###### Tables.keepr\_logs.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.keepr\_logs.Relationships

> **Relationships**: \[\]

###### Tables.keepr\_logs.Row

> **Row**: `object`

###### Tables.keepr\_logs.Row.actor\_wallet

> **actor\_wallet**: `string` \| `null`

###### Tables.keepr\_logs.Row.created\_at

> **created\_at**: `string`

###### Tables.keepr\_logs.Row.details

> **details**: [`Json`](#json)

###### Tables.keepr\_logs.Row.event\_type

> **event\_type**: `string`

###### Tables.keepr\_logs.Row.id

> **id**: `number`

###### Tables.keepr\_logs.Row.vault\_address

> **vault\_address**: `string`

###### Tables.keepr\_logs.Update

> **Update**: `object`

###### Tables.keepr\_logs.Update.actor\_wallet?

> `optional` **actor\_wallet**: `string` \| `null`

###### Tables.keepr\_logs.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.keepr\_logs.Update.details?

> `optional` **details**: [`Json`](#json)

###### Tables.keepr\_logs.Update.event\_type?

> `optional` **event\_type**: `string`

###### Tables.keepr\_logs.Update.id?

> `optional` **id**: `number`

###### Tables.keepr\_logs.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.keepr\_nonces

> **keepr\_nonces**: `object`

###### Tables.keepr\_nonces.Insert

> **Insert**: `object`

###### Tables.keepr\_nonces.Insert.expires\_at

> **expires\_at**: `string`

###### Tables.keepr\_nonces.Insert.issued\_at?

> `optional` **issued\_at**: `string`

###### Tables.keepr\_nonces.Insert.nonce

> **nonce**: `string`

###### Tables.keepr\_nonces.Insert.purpose

> **purpose**: `string`

###### Tables.keepr\_nonces.Insert.used\_at?

> `optional` **used\_at**: `string` \| `null`

###### Tables.keepr\_nonces.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.keepr\_nonces.Insert.wallet\_address

> **wallet\_address**: `string`

###### Tables.keepr\_nonces.Relationships

> **Relationships**: \[\]

###### Tables.keepr\_nonces.Row

> **Row**: `object`

###### Tables.keepr\_nonces.Row.expires\_at

> **expires\_at**: `string`

###### Tables.keepr\_nonces.Row.issued\_at

> **issued\_at**: `string`

###### Tables.keepr\_nonces.Row.nonce

> **nonce**: `string`

###### Tables.keepr\_nonces.Row.purpose

> **purpose**: `string`

###### Tables.keepr\_nonces.Row.used\_at

> **used\_at**: `string` \| `null`

###### Tables.keepr\_nonces.Row.vault\_address

> **vault\_address**: `string`

###### Tables.keepr\_nonces.Row.wallet\_address

> **wallet\_address**: `string`

###### Tables.keepr\_nonces.Update

> **Update**: `object`

###### Tables.keepr\_nonces.Update.expires\_at?

> `optional` **expires\_at**: `string`

###### Tables.keepr\_nonces.Update.issued\_at?

> `optional` **issued\_at**: `string`

###### Tables.keepr\_nonces.Update.nonce?

> `optional` **nonce**: `string`

###### Tables.keepr\_nonces.Update.purpose?

> `optional` **purpose**: `string`

###### Tables.keepr\_nonces.Update.used\_at?

> `optional` **used\_at**: `string` \| `null`

###### Tables.keepr\_nonces.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.keepr\_nonces.Update.wallet\_address?

> `optional` **wallet\_address**: `string`

###### Tables.keepr\_vault\_automation

> **keepr\_vault\_automation**: `object`

###### Tables.keepr\_vault\_automation.Insert

> **Insert**: `object`

###### Tables.keepr\_vault\_automation.Insert.authorization\_source

> **authorization\_source**: `string`

###### Tables.keepr\_vault\_automation.Insert.automation\_enabled?

> `optional` **automation\_enabled**: `boolean`

###### Tables.keepr\_vault\_automation.Insert.automation\_scope

> **automation\_scope**: `string`

###### Tables.keepr\_vault\_automation.Insert.canonical\_csw\_address

> **canonical\_csw\_address**: `string`

###### Tables.keepr\_vault\_automation.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.keepr\_vault\_automation.Insert.embedded\_eoa\_address?

> `optional` **embedded\_eoa\_address**: `string` \| `null`

###### Tables.keepr\_vault\_automation.Insert.last\_owner\_check\_at?

> `optional` **last\_owner\_check\_at**: `string` \| `null`

###### Tables.keepr\_vault\_automation.Insert.metadata?

> `optional` **metadata**: [`Json`](#json)

###### Tables.keepr\_vault\_automation.Insert.privy\_wallet\_id?

> `optional` **privy\_wallet\_id**: `string` \| `null`

###### Tables.keepr\_vault\_automation.Insert.profile\_id

> **profile\_id**: `number`

###### Tables.keepr\_vault\_automation.Insert.revoked\_at?

> `optional` **revoked\_at**: `string` \| `null`

###### Tables.keepr\_vault\_automation.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.keepr\_vault\_automation.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.keepr\_vault\_automation.Relationships

> **Relationships**: \[\]

###### Tables.keepr\_vault\_automation.Row

> **Row**: `object`

###### Tables.keepr\_vault\_automation.Row.authorization\_source

> **authorization\_source**: `string`

###### Tables.keepr\_vault\_automation.Row.automation\_enabled

> **automation\_enabled**: `boolean`

###### Tables.keepr\_vault\_automation.Row.automation\_scope

> **automation\_scope**: `string`

###### Tables.keepr\_vault\_automation.Row.canonical\_csw\_address

> **canonical\_csw\_address**: `string`

###### Tables.keepr\_vault\_automation.Row.created\_at

> **created\_at**: `string`

###### Tables.keepr\_vault\_automation.Row.embedded\_eoa\_address

> **embedded\_eoa\_address**: `string` \| `null`

###### Tables.keepr\_vault\_automation.Row.last\_owner\_check\_at

> **last\_owner\_check\_at**: `string` \| `null`

###### Tables.keepr\_vault\_automation.Row.metadata

> **metadata**: [`Json`](#json)

###### Tables.keepr\_vault\_automation.Row.privy\_wallet\_id

> **privy\_wallet\_id**: `string` \| `null`

###### Tables.keepr\_vault\_automation.Row.profile\_id

> **profile\_id**: `number`

###### Tables.keepr\_vault\_automation.Row.revoked\_at

> **revoked\_at**: `string` \| `null`

###### Tables.keepr\_vault\_automation.Row.updated\_at

> **updated\_at**: `string`

###### Tables.keepr\_vault\_automation.Row.vault\_address

> **vault\_address**: `string`

###### Tables.keepr\_vault\_automation.Update

> **Update**: `object`

###### Tables.keepr\_vault\_automation.Update.authorization\_source?

> `optional` **authorization\_source**: `string`

###### Tables.keepr\_vault\_automation.Update.automation\_enabled?

> `optional` **automation\_enabled**: `boolean`

###### Tables.keepr\_vault\_automation.Update.automation\_scope?

> `optional` **automation\_scope**: `string`

###### Tables.keepr\_vault\_automation.Update.canonical\_csw\_address?

> `optional` **canonical\_csw\_address**: `string`

###### Tables.keepr\_vault\_automation.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.keepr\_vault\_automation.Update.embedded\_eoa\_address?

> `optional` **embedded\_eoa\_address**: `string` \| `null`

###### Tables.keepr\_vault\_automation.Update.last\_owner\_check\_at?

> `optional` **last\_owner\_check\_at**: `string` \| `null`

###### Tables.keepr\_vault\_automation.Update.metadata?

> `optional` **metadata**: [`Json`](#json)

###### Tables.keepr\_vault\_automation.Update.privy\_wallet\_id?

> `optional` **privy\_wallet\_id**: `string` \| `null`

###### Tables.keepr\_vault\_automation.Update.profile\_id?

> `optional` **profile\_id**: `number`

###### Tables.keepr\_vault\_automation.Update.revoked\_at?

> `optional` **revoked\_at**: `string` \| `null`

###### Tables.keepr\_vault\_automation.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.keepr\_vault\_automation.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.keepr\_vaults

> **keepr\_vaults**: `object`

###### Tables.keepr\_vaults.Insert

> **Insert**: `object`

###### Tables.keepr\_vaults.Insert.canonical\_owner\_address

> **canonical\_owner\_address**: `string`

###### Tables.keepr\_vaults.Insert.chain\_id

> **chain\_id**: `number`

###### Tables.keepr\_vaults.Insert.config\_hash

> **config\_hash**: `string`

###### Tables.keepr\_vaults.Insert.config\_json

> **config\_json**: [`Json`](#json)

###### Tables.keepr\_vaults.Insert.config\_version?

> `optional` **config\_version**: `number`

###### Tables.keepr\_vaults.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.keepr\_vaults.Insert.creator\_coin\_address

> **creator\_coin\_address**: `string`

###### Tables.keepr\_vaults.Insert.fail\_closed?

> `optional` **fail\_closed**: `boolean`

###### Tables.keepr\_vaults.Insert.gating\_enabled?

> `optional` **gating\_enabled**: `boolean`

###### Tables.keepr\_vaults.Insert.gating\_mode?

> `optional` **gating\_mode**: `string`

###### Tables.keepr\_vaults.Insert.graduated\_at?

> `optional` **graduated\_at**: `string` \| `null`

###### Tables.keepr\_vaults.Insert.group\_id

> **group\_id**: `string`

###### Tables.keepr\_vaults.Insert.join\_locked?

> `optional` **join\_locked**: `boolean`

###### Tables.keepr\_vaults.Insert.last\_sync\_at?

> `optional` **last\_sync\_at**: `string` \| `null`

###### Tables.keepr\_vaults.Insert.lens\_group\_address?

> `optional` **lens\_group\_address**: `string` \| `null`

###### Tables.keepr\_vaults.Insert.min\_shares?

> `optional` **min\_shares**: `string` \| `null`

###### Tables.keepr\_vaults.Insert.settled\_at?

> `optional` **settled\_at**: `string` \| `null`

###### Tables.keepr\_vaults.Insert.settlement\_stage?

> `optional` **settlement\_stage**: `string` \| `null`

###### Tables.keepr\_vaults.Insert.settlement\_stage\_updated\_at?

> `optional` **settlement\_stage\_updated\_at**: `string` \| `null`

###### Tables.keepr\_vaults.Insert.share\_token\_address?

> `optional` **share\_token\_address**: `string` \| `null`

###### Tables.keepr\_vaults.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.keepr\_vaults.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.keepr\_vaults.Relationships

> **Relationships**: \[\]

###### Tables.keepr\_vaults.Row

> **Row**: `object`

###### Tables.keepr\_vaults.Row.canonical\_owner\_address

> **canonical\_owner\_address**: `string`

###### Tables.keepr\_vaults.Row.chain\_id

> **chain\_id**: `number`

###### Tables.keepr\_vaults.Row.config\_hash

> **config\_hash**: `string`

###### Tables.keepr\_vaults.Row.config\_json

> **config\_json**: [`Json`](#json)

###### Tables.keepr\_vaults.Row.config\_version

> **config\_version**: `number`

###### Tables.keepr\_vaults.Row.created\_at

> **created\_at**: `string`

###### Tables.keepr\_vaults.Row.creator\_coin\_address

> **creator\_coin\_address**: `string`

###### Tables.keepr\_vaults.Row.fail\_closed

> **fail\_closed**: `boolean`

###### Tables.keepr\_vaults.Row.gating\_enabled

> **gating\_enabled**: `boolean`

###### Tables.keepr\_vaults.Row.gating\_mode

> **gating\_mode**: `string`

###### Tables.keepr\_vaults.Row.graduated\_at

> **graduated\_at**: `string` \| `null`

###### Tables.keepr\_vaults.Row.group\_id

> **group\_id**: `string`

###### Tables.keepr\_vaults.Row.join\_locked

> **join\_locked**: `boolean`

###### Tables.keepr\_vaults.Row.last\_sync\_at

> **last\_sync\_at**: `string` \| `null`

###### Tables.keepr\_vaults.Row.lens\_group\_address

> **lens\_group\_address**: `string` \| `null`

###### Tables.keepr\_vaults.Row.min\_shares

> **min\_shares**: `string` \| `null`

###### Tables.keepr\_vaults.Row.settled\_at

> **settled\_at**: `string` \| `null`

###### Tables.keepr\_vaults.Row.settlement\_stage

> **settlement\_stage**: `string` \| `null`

###### Tables.keepr\_vaults.Row.settlement\_stage\_updated\_at

> **settlement\_stage\_updated\_at**: `string` \| `null`

###### Tables.keepr\_vaults.Row.share\_token\_address

> **share\_token\_address**: `string` \| `null`

###### Tables.keepr\_vaults.Row.updated\_at

> **updated\_at**: `string`

###### Tables.keepr\_vaults.Row.vault\_address

> **vault\_address**: `string`

###### Tables.keepr\_vaults.Update

> **Update**: `object`

###### Tables.keepr\_vaults.Update.canonical\_owner\_address?

> `optional` **canonical\_owner\_address**: `string`

###### Tables.keepr\_vaults.Update.chain\_id?

> `optional` **chain\_id**: `number`

###### Tables.keepr\_vaults.Update.config\_hash?

> `optional` **config\_hash**: `string`

###### Tables.keepr\_vaults.Update.config\_json?

> `optional` **config\_json**: [`Json`](#json)

###### Tables.keepr\_vaults.Update.config\_version?

> `optional` **config\_version**: `number`

###### Tables.keepr\_vaults.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.keepr\_vaults.Update.creator\_coin\_address?

> `optional` **creator\_coin\_address**: `string`

###### Tables.keepr\_vaults.Update.fail\_closed?

> `optional` **fail\_closed**: `boolean`

###### Tables.keepr\_vaults.Update.gating\_enabled?

> `optional` **gating\_enabled**: `boolean`

###### Tables.keepr\_vaults.Update.gating\_mode?

> `optional` **gating\_mode**: `string`

###### Tables.keepr\_vaults.Update.graduated\_at?

> `optional` **graduated\_at**: `string` \| `null`

###### Tables.keepr\_vaults.Update.group\_id?

> `optional` **group\_id**: `string`

###### Tables.keepr\_vaults.Update.join\_locked?

> `optional` **join\_locked**: `boolean`

###### Tables.keepr\_vaults.Update.last\_sync\_at?

> `optional` **last\_sync\_at**: `string` \| `null`

###### Tables.keepr\_vaults.Update.lens\_group\_address?

> `optional` **lens\_group\_address**: `string` \| `null`

###### Tables.keepr\_vaults.Update.min\_shares?

> `optional` **min\_shares**: `string` \| `null`

###### Tables.keepr\_vaults.Update.settled\_at?

> `optional` **settled\_at**: `string` \| `null`

###### Tables.keepr\_vaults.Update.settlement\_stage?

> `optional` **settlement\_stage**: `string` \| `null`

###### Tables.keepr\_vaults.Update.settlement\_stage\_updated\_at?

> `optional` **settlement\_stage\_updated\_at**: `string` \| `null`

###### Tables.keepr\_vaults.Update.share\_token\_address?

> `optional` **share\_token\_address**: `string` \| `null`

###### Tables.keepr\_vaults.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.keepr\_vaults.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.keepr\_workflow\_checkpoints

> **keepr\_workflow\_checkpoints**: `object`

###### Tables.keepr\_workflow\_checkpoints.Insert

> **Insert**: `object`

###### Tables.keepr\_workflow\_checkpoints.Insert.action

> **action**: `string`

###### Tables.keepr\_workflow\_checkpoints.Insert.checkpoint\_key

> **checkpoint\_key**: `string`

###### Tables.keepr\_workflow\_checkpoints.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.keepr\_workflow\_checkpoints.Insert.payload\_json?

> `optional` **payload\_json**: [`Json`](#json) \| `null`

###### Tables.keepr\_workflow\_checkpoints.Insert.response\_json?

> `optional` **response\_json**: [`Json`](#json) \| `null`

###### Tables.keepr\_workflow\_checkpoints.Insert.status

> **status**: `string`

###### Tables.keepr\_workflow\_checkpoints.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.keepr\_workflow\_checkpoints.Insert.workflow

> **workflow**: `string`

###### Tables.keepr\_workflow\_checkpoints.Relationships

> **Relationships**: \[\]

###### Tables.keepr\_workflow\_checkpoints.Row

> **Row**: `object`

###### Tables.keepr\_workflow\_checkpoints.Row.action

> **action**: `string`

###### Tables.keepr\_workflow\_checkpoints.Row.checkpoint\_key

> **checkpoint\_key**: `string`

###### Tables.keepr\_workflow\_checkpoints.Row.created\_at

> **created\_at**: `string`

###### Tables.keepr\_workflow\_checkpoints.Row.payload\_json

> **payload\_json**: [`Json`](#json) \| `null`

###### Tables.keepr\_workflow\_checkpoints.Row.response\_json

> **response\_json**: [`Json`](#json) \| `null`

###### Tables.keepr\_workflow\_checkpoints.Row.status

> **status**: `string`

###### Tables.keepr\_workflow\_checkpoints.Row.updated\_at

> **updated\_at**: `string`

###### Tables.keepr\_workflow\_checkpoints.Row.workflow

> **workflow**: `string`

###### Tables.keepr\_workflow\_checkpoints.Update

> **Update**: `object`

###### Tables.keepr\_workflow\_checkpoints.Update.action?

> `optional` **action**: `string`

###### Tables.keepr\_workflow\_checkpoints.Update.checkpoint\_key?

> `optional` **checkpoint\_key**: `string`

###### Tables.keepr\_workflow\_checkpoints.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.keepr\_workflow\_checkpoints.Update.payload\_json?

> `optional` **payload\_json**: [`Json`](#json) \| `null`

###### Tables.keepr\_workflow\_checkpoints.Update.response\_json?

> `optional` **response\_json**: [`Json`](#json) \| `null`

###### Tables.keepr\_workflow\_checkpoints.Update.status?

> `optional` **status**: `string`

###### Tables.keepr\_workflow\_checkpoints.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.keepr\_workflow\_checkpoints.Update.workflow?

> `optional` **workflow**: `string`

###### Tables.lottery\_amoe\_daily\_twitter\_checkins

> **lottery\_amoe\_daily\_twitter\_checkins**: `object`

###### Tables.lottery\_amoe\_daily\_twitter\_checkins.Insert

> **Insert**: `object`

###### Tables.lottery\_amoe\_daily\_twitter\_checkins.Insert.checkin\_date

> **checkin\_date**: `string`

###### Tables.lottery\_amoe\_daily\_twitter\_checkins.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.lottery\_amoe\_daily\_twitter\_checkins.Insert.wallet\_address

> **wallet\_address**: `string`

###### Tables.lottery\_amoe\_daily\_twitter\_checkins.Relationships

> **Relationships**: \[\]

###### Tables.lottery\_amoe\_daily\_twitter\_checkins.Row

> **Row**: `object`

###### Tables.lottery\_amoe\_daily\_twitter\_checkins.Row.checkin\_date

> **checkin\_date**: `string`

###### Tables.lottery\_amoe\_daily\_twitter\_checkins.Row.created\_at

> **created\_at**: `string`

###### Tables.lottery\_amoe\_daily\_twitter\_checkins.Row.wallet\_address

> **wallet\_address**: `string`

###### Tables.lottery\_amoe\_daily\_twitter\_checkins.Update

> **Update**: `object`

###### Tables.lottery\_amoe\_daily\_twitter\_checkins.Update.checkin\_date?

> `optional` **checkin\_date**: `string`

###### Tables.lottery\_amoe\_daily\_twitter\_checkins.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.lottery\_amoe\_daily\_twitter\_checkins.Update.wallet\_address?

> `optional` **wallet\_address**: `string`

###### Tables.lottery\_amoe\_entries

> **lottery\_amoe\_entries**: `object`

###### Tables.lottery\_amoe\_entries.Insert

> **Insert**: `object`

###### Tables.lottery\_amoe\_entries.Insert.attestation\_deadline

> **attestation\_deadline**: `number`

###### Tables.lottery\_amoe\_entries.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.lottery\_amoe\_entries.Insert.creator\_coin

> **creator\_coin**: `string`

###### Tables.lottery\_amoe\_entries.Insert.id?

> `optional` **id**: `number`

###### Tables.lottery\_amoe\_entries.Insert.nonce

> **nonce**: `string`

###### Tables.lottery\_amoe\_entries.Insert.nonce\_hash

> **nonce\_hash**: `string`

###### Tables.lottery\_amoe\_entries.Insert.status?

> `optional` **status**: `string`

###### Tables.lottery\_amoe\_entries.Insert.wallet\_address

> **wallet\_address**: `string`

###### Tables.lottery\_amoe\_entries.Relationships

> **Relationships**: \[\]

###### Tables.lottery\_amoe\_entries.Row

> **Row**: `object`

###### Tables.lottery\_amoe\_entries.Row.attestation\_deadline

> **attestation\_deadline**: `number`

###### Tables.lottery\_amoe\_entries.Row.created\_at

> **created\_at**: `string`

###### Tables.lottery\_amoe\_entries.Row.creator\_coin

> **creator\_coin**: `string`

###### Tables.lottery\_amoe\_entries.Row.id

> **id**: `number`

###### Tables.lottery\_amoe\_entries.Row.nonce

> **nonce**: `string`

###### Tables.lottery\_amoe\_entries.Row.nonce\_hash

> **nonce\_hash**: `string`

###### Tables.lottery\_amoe\_entries.Row.status

> **status**: `string`

###### Tables.lottery\_amoe\_entries.Row.wallet\_address

> **wallet\_address**: `string`

###### Tables.lottery\_amoe\_entries.Update

> **Update**: `object`

###### Tables.lottery\_amoe\_entries.Update.attestation\_deadline?

> `optional` **attestation\_deadline**: `number`

###### Tables.lottery\_amoe\_entries.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.lottery\_amoe\_entries.Update.creator\_coin?

> `optional` **creator\_coin**: `string`

###### Tables.lottery\_amoe\_entries.Update.id?

> `optional` **id**: `number`

###### Tables.lottery\_amoe\_entries.Update.nonce?

> `optional` **nonce**: `string`

###### Tables.lottery\_amoe\_entries.Update.nonce\_hash?

> `optional` **nonce\_hash**: `string`

###### Tables.lottery\_amoe\_entries.Update.status?

> `optional` **status**: `string`

###### Tables.lottery\_amoe\_entries.Update.wallet\_address?

> `optional` **wallet\_address**: `string`

###### Tables.lottery\_amoe\_nonces

> **lottery\_amoe\_nonces**: `object`

###### Tables.lottery\_amoe\_nonces.Insert

> **Insert**: `object`

###### Tables.lottery\_amoe\_nonces.Insert.consumed\_at?

> `optional` **consumed\_at**: `string` \| `null`

###### Tables.lottery\_amoe\_nonces.Insert.creator\_coin

> **creator\_coin**: `string`

###### Tables.lottery\_amoe\_nonces.Insert.expires\_at

> **expires\_at**: `string`

###### Tables.lottery\_amoe\_nonces.Insert.issued\_at?

> `optional` **issued\_at**: `string`

###### Tables.lottery\_amoe\_nonces.Insert.nonce

> **nonce**: `string`

###### Tables.lottery\_amoe\_nonces.Insert.wallet\_address

> **wallet\_address**: `string`

###### Tables.lottery\_amoe\_nonces.Relationships

> **Relationships**: \[\]

###### Tables.lottery\_amoe\_nonces.Row

> **Row**: `object`

###### Tables.lottery\_amoe\_nonces.Row.consumed\_at

> **consumed\_at**: `string` \| `null`

###### Tables.lottery\_amoe\_nonces.Row.creator\_coin

> **creator\_coin**: `string`

###### Tables.lottery\_amoe\_nonces.Row.expires\_at

> **expires\_at**: `string`

###### Tables.lottery\_amoe\_nonces.Row.issued\_at

> **issued\_at**: `string`

###### Tables.lottery\_amoe\_nonces.Row.nonce

> **nonce**: `string`

###### Tables.lottery\_amoe\_nonces.Row.wallet\_address

> **wallet\_address**: `string`

###### Tables.lottery\_amoe\_nonces.Update

> **Update**: `object`

###### Tables.lottery\_amoe\_nonces.Update.consumed\_at?

> `optional` **consumed\_at**: `string` \| `null`

###### Tables.lottery\_amoe\_nonces.Update.creator\_coin?

> `optional` **creator\_coin**: `string`

###### Tables.lottery\_amoe\_nonces.Update.expires\_at?

> `optional` **expires\_at**: `string`

###### Tables.lottery\_amoe\_nonces.Update.issued\_at?

> `optional` **issued\_at**: `string`

###### Tables.lottery\_amoe\_nonces.Update.nonce?

> `optional` **nonce**: `string`

###### Tables.lottery\_amoe\_nonces.Update.wallet\_address?

> `optional` **wallet\_address**: `string`

###### Tables.memory\_snapshots

> **memory\_snapshots**: `object`

###### Tables.memory\_snapshots.Insert

> **Insert**: `object`

###### Tables.memory\_snapshots.Insert.conversation\_id

> **conversation\_id**: `string`

###### Tables.memory\_snapshots.Insert.snapshot\_json

> **snapshot\_json**: [`Json`](#json)

###### Tables.memory\_snapshots.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.memory\_snapshots.Relationships

> **Relationships**: \[\]

###### Tables.memory\_snapshots.Row

> **Row**: `object`

###### Tables.memory\_snapshots.Row.conversation\_id

> **conversation\_id**: `string`

###### Tables.memory\_snapshots.Row.snapshot\_json

> **snapshot\_json**: [`Json`](#json)

###### Tables.memory\_snapshots.Row.updated\_at

> **updated\_at**: `string`

###### Tables.memory\_snapshots.Update

> **Update**: `object`

###### Tables.memory\_snapshots.Update.conversation\_id?

> `optional` **conversation\_id**: `string`

###### Tables.memory\_snapshots.Update.snapshot\_json?

> `optional` **snapshot\_json**: [`Json`](#json)

###### Tables.memory\_snapshots.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.points

> **points**: `object`

###### Tables.points.Insert

> **Insert**: `object`

###### Tables.points.Insert.amount

> **amount**: `number`

###### Tables.points.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.points.Insert.id?

> `optional` **id**: `number`

###### Tables.points.Insert.signup\_id

> **signup\_id**: `number`

###### Tables.points.Insert.source

> **source**: `string`

###### Tables.points.Insert.source\_id?

> `optional` **source\_id**: `string` \| `null`

###### Tables.points.Relationships

> **Relationships**: \[\]

###### Tables.points.Row

> **Row**: `object`

###### Tables.points.Row.amount

> **amount**: `number`

###### Tables.points.Row.created\_at

> **created\_at**: `string`

###### Tables.points.Row.id

> **id**: `number`

###### Tables.points.Row.signup\_id

> **signup\_id**: `number`

###### Tables.points.Row.source

> **source**: `string`

###### Tables.points.Row.source\_id

> **source\_id**: `string` \| `null`

###### Tables.points.Update

> **Update**: `object`

###### Tables.points.Update.amount?

> `optional` **amount**: `number`

###### Tables.points.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.points.Update.id?

> `optional` **id**: `number`

###### Tables.points.Update.signup\_id?

> `optional` **signup\_id**: `number`

###### Tables.points.Update.source?

> `optional` **source**: `string`

###### Tables.points.Update.source\_id?

> `optional` **source\_id**: `string` \| `null`

###### Tables.privy\_user\_aliases

> **privy\_user\_aliases**: `object`

###### Tables.privy\_user\_aliases.Insert

> **Insert**: `object`

###### Tables.privy\_user\_aliases.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.privy\_user\_aliases.Insert.privy\_user\_id

> **privy\_user\_id**: `string`

###### Tables.privy\_user\_aliases.Insert.profile\_id

> **profile\_id**: `number`

###### Tables.privy\_user\_aliases.Insert.source?

> `optional` **source**: `string`

###### Tables.privy\_user\_aliases.Relationships

> **Relationships**: \[\{ `columns`: \[`"profile_id"`\]; `foreignKeyName`: `"privy_user_aliases_profile_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"profiles"`; \}\]

###### Tables.privy\_user\_aliases.Row

> **Row**: `object`

###### Tables.privy\_user\_aliases.Row.created\_at

> **created\_at**: `string`

###### Tables.privy\_user\_aliases.Row.privy\_user\_id

> **privy\_user\_id**: `string`

###### Tables.privy\_user\_aliases.Row.profile\_id

> **profile\_id**: `number`

###### Tables.privy\_user\_aliases.Row.source

> **source**: `string`

###### Tables.privy\_user\_aliases.Update

> **Update**: `object`

###### Tables.privy\_user\_aliases.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.privy\_user\_aliases.Update.privy\_user\_id?

> `optional` **privy\_user\_id**: `string`

###### Tables.privy\_user\_aliases.Update.profile\_id?

> `optional` **profile\_id**: `number`

###### Tables.privy\_user\_aliases.Update.source?

> `optional` **source**: `string`

###### Tables.profile\_wallets

> **profile\_wallets**: `object`

###### Tables.profile\_wallets.Insert

> **Insert**: `object`

###### Tables.profile\_wallets.Insert.address

> **address**: `string`

###### Tables.profile\_wallets.Insert.canonical\_csw\_address?

> `optional` **canonical\_csw\_address**: `string` \| `null`

###### Tables.profile\_wallets.Insert.canonical\_source?

> `optional` **canonical\_source**: `string`

###### Tables.profile\_wallets.Insert.canonical\_zora\_csw\_address?

> `optional` **canonical\_zora\_csw\_address**: `string` \| `null`

###### Tables.profile\_wallets.Insert.chain\_id?

> `optional` **chain\_id**: `number`

###### Tables.profile\_wallets.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.profile\_wallets.Insert.is\_canonical\_smart\_wallet?

> `optional` **is\_canonical\_smart\_wallet**: `boolean`

###### Tables.profile\_wallets.Insert.is\_canonical\_solana\_wallet?

> `optional` **is\_canonical\_solana\_wallet**: `boolean`

###### Tables.profile\_wallets.Insert.is\_embedded\_eoa?

> `optional` **is\_embedded\_eoa**: `boolean`

###### Tables.profile\_wallets.Insert.is\_operational\_solana\_wallet?

> `optional` **is\_operational\_solana\_wallet**: `boolean`

###### Tables.profile\_wallets.Insert.is\_primary?

> `optional` **is\_primary**: `boolean`

###### Tables.profile\_wallets.Insert.last\_checked\_at?

> `optional` **last\_checked\_at**: `string` \| `null`

###### Tables.profile\_wallets.Insert.metadata?

> `optional` **metadata**: [`Json`](#json) \| `null`

###### Tables.profile\_wallets.Insert.privy\_embedded\_eoa\_address?

> `optional` **privy\_embedded\_eoa\_address**: `string` \| `null`

###### Tables.profile\_wallets.Insert.privy\_is\_owner?

> `optional` **privy\_is\_owner**: `boolean`

###### Tables.profile\_wallets.Insert.profile\_id

> **profile\_id**: `number`

###### Tables.profile\_wallets.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.profile\_wallets.Insert.verified\_at?

> `optional` **verified\_at**: `string` \| `null`

###### Tables.profile\_wallets.Relationships

> **Relationships**: \[\{ `columns`: \[`"address"`\]; `foreignKeyName`: `"profile_wallets_address_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"address"`\]; `referencedRelation`: `"wallets"`; \}, \{ `columns`: \[`"profile_id"`\]; `foreignKeyName`: `"profile_wallets_profile_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"profiles"`; \}\]

###### Tables.profile\_wallets.Row

> **Row**: `object`

###### Tables.profile\_wallets.Row.address

> **address**: `string`

###### Tables.profile\_wallets.Row.canonical\_csw\_address

> **canonical\_csw\_address**: `string` \| `null`

###### Tables.profile\_wallets.Row.canonical\_source

> **canonical\_source**: `string`

###### Tables.profile\_wallets.Row.canonical\_zora\_csw\_address

> **canonical\_zora\_csw\_address**: `string` \| `null`

###### Tables.profile\_wallets.Row.chain\_id

> **chain\_id**: `number`

###### Tables.profile\_wallets.Row.created\_at

> **created\_at**: `string`

###### Tables.profile\_wallets.Row.is\_canonical\_smart\_wallet

> **is\_canonical\_smart\_wallet**: `boolean`

###### Tables.profile\_wallets.Row.is\_canonical\_solana\_wallet

> **is\_canonical\_solana\_wallet**: `boolean`

###### Tables.profile\_wallets.Row.is\_embedded\_eoa

> **is\_embedded\_eoa**: `boolean`

###### Tables.profile\_wallets.Row.is\_operational\_solana\_wallet

> **is\_operational\_solana\_wallet**: `boolean`

###### Tables.profile\_wallets.Row.is\_primary

> **is\_primary**: `boolean`

###### Tables.profile\_wallets.Row.last\_checked\_at

> **last\_checked\_at**: `string` \| `null`

###### Tables.profile\_wallets.Row.metadata

> **metadata**: [`Json`](#json) \| `null`

###### Tables.profile\_wallets.Row.privy\_embedded\_eoa\_address

> **privy\_embedded\_eoa\_address**: `string` \| `null`

###### Tables.profile\_wallets.Row.privy\_is\_owner

> **privy\_is\_owner**: `boolean`

###### Tables.profile\_wallets.Row.profile\_id

> **profile\_id**: `number`

###### Tables.profile\_wallets.Row.updated\_at

> **updated\_at**: `string`

###### Tables.profile\_wallets.Row.verified\_at

> **verified\_at**: `string` \| `null`

###### Tables.profile\_wallets.Update

> **Update**: `object`

###### Tables.profile\_wallets.Update.address?

> `optional` **address**: `string`

###### Tables.profile\_wallets.Update.canonical\_csw\_address?

> `optional` **canonical\_csw\_address**: `string` \| `null`

###### Tables.profile\_wallets.Update.canonical\_source?

> `optional` **canonical\_source**: `string`

###### Tables.profile\_wallets.Update.canonical\_zora\_csw\_address?

> `optional` **canonical\_zora\_csw\_address**: `string` \| `null`

###### Tables.profile\_wallets.Update.chain\_id?

> `optional` **chain\_id**: `number`

###### Tables.profile\_wallets.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.profile\_wallets.Update.is\_canonical\_smart\_wallet?

> `optional` **is\_canonical\_smart\_wallet**: `boolean`

###### Tables.profile\_wallets.Update.is\_canonical\_solana\_wallet?

> `optional` **is\_canonical\_solana\_wallet**: `boolean`

###### Tables.profile\_wallets.Update.is\_embedded\_eoa?

> `optional` **is\_embedded\_eoa**: `boolean`

###### Tables.profile\_wallets.Update.is\_operational\_solana\_wallet?

> `optional` **is\_operational\_solana\_wallet**: `boolean`

###### Tables.profile\_wallets.Update.is\_primary?

> `optional` **is\_primary**: `boolean`

###### Tables.profile\_wallets.Update.last\_checked\_at?

> `optional` **last\_checked\_at**: `string` \| `null`

###### Tables.profile\_wallets.Update.metadata?

> `optional` **metadata**: [`Json`](#json) \| `null`

###### Tables.profile\_wallets.Update.privy\_embedded\_eoa\_address?

> `optional` **privy\_embedded\_eoa\_address**: `string` \| `null`

###### Tables.profile\_wallets.Update.privy\_is\_owner?

> `optional` **privy\_is\_owner**: `boolean`

###### Tables.profile\_wallets.Update.profile\_id?

> `optional` **profile\_id**: `number`

###### Tables.profile\_wallets.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.profile\_wallets.Update.verified\_at?

> `optional` **verified\_at**: `string` \| `null`

###### Tables.profiles

> **profiles**: `object`

###### Tables.profiles.Insert

> **Insert**: `object`

###### Tables.profiles.Insert.app\_access\_decided\_at?

> `optional` **app\_access\_decided\_at**: `string` \| `null`

###### Tables.profiles.Insert.app\_access\_decided\_by?

> `optional` **app\_access\_decided\_by**: `string` \| `null`

###### Tables.profiles.Insert.app\_access\_decision\_note?

> `optional` **app\_access\_decision\_note**: `string` \| `null`

###### Tables.profiles.Insert.app\_access\_status?

> `optional` **app\_access\_status**: `string`

###### Tables.profiles.Insert.avatar\_url?

> `optional` **avatar\_url**: `string` \| `null`

###### Tables.profiles.Insert.banner\_url?

> `optional` **banner\_url**: `string` \| `null`

###### Tables.profiles.Insert.base\_sub\_account?

> `optional` **base\_sub\_account**: `string` \| `null`

###### Tables.profiles.Insert.bio?

> `optional` **bio**: `string` \| `null`

###### Tables.profiles.Insert.border\_tier?

> `optional` **border\_tier**: `number`

###### Tables.profiles.Insert.canonical\_solana\_wallet?

> `optional` **canonical\_solana\_wallet**: `string` \| `null`

###### Tables.profiles.Insert.contact\_preference?

> `optional` **contact\_preference**: `string` \| `null`

###### Tables.profiles.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.profiles.Insert.csw\_address?

> `optional` **csw\_address**: `string` \| `null`

###### Tables.profiles.Insert.display\_name?

> `optional` **display\_name**: `string` \| `null`

###### Tables.profiles.Insert.email?

> `optional` **email**: `string` \| `null`

###### Tables.profiles.Insert.embedded\_wallet?

> `optional` **embedded\_wallet**: `string` \| `null`

###### Tables.profiles.Insert.embedded\_wallet\_chain?

> `optional` **embedded\_wallet\_chain**: `string` \| `null`

###### Tables.profiles.Insert.embedded\_wallet\_client\_type?

> `optional` **embedded\_wallet\_client\_type**: `string` \| `null`

###### Tables.profiles.Insert.erc8004\_agent\_id?

> `optional` **erc8004\_agent\_id**: `number` \| `null`

###### Tables.profiles.Insert.erc8128\_agent\_id?

> `optional` **erc8128\_agent\_id**: `string` \| `null`

###### Tables.profiles.Insert.farcaster\_fid?

> `optional` **farcaster\_fid**: `number` \| `null`

###### Tables.profiles.Insert.has\_creator\_coin?

> `optional` **has\_creator\_coin**: `boolean` \| `null`

###### Tables.profiles.Insert.id?

> `optional` **id**: `number`

###### Tables.profiles.Insert.lens\_account\_address?

> `optional` **lens\_account\_address**: `string` \| `null`

###### Tables.profiles.Insert.lens\_grove\_uri?

> `optional` **lens\_grove\_uri**: `string` \| `null`

###### Tables.profiles.Insert.lens\_handle?

> `optional` **lens\_handle**: `string` \| `null`

###### Tables.profiles.Insert.lens\_owner\_address?

> `optional` **lens\_owner\_address**: `string` \| `null`

###### Tables.profiles.Insert.merged\_into\_profile\_id?

> `optional` **merged\_into\_profile\_id**: `number` \| `null`

###### Tables.profiles.Insert.operational\_solana\_wallet?

> `optional` **operational\_solana\_wallet**: `string` \| `null`

###### Tables.profiles.Insert.persona?

> `optional` **persona**: `string` \| `null`

###### Tables.profiles.Insert.preprov\_coin\_address?

> `optional` **preprov\_coin\_address**: `string` \| `null`

###### Tables.profiles.Insert.preprov\_coin\_symbol?

> `optional` **preprov\_coin\_symbol**: `string` \| `null`

###### Tables.profiles.Insert.preprov\_farcaster\_pfp?

> `optional` **preprov\_farcaster\_pfp**: `string` \| `null`

###### Tables.profiles.Insert.preprov\_farcaster\_username?

> `optional` **preprov\_farcaster\_username**: `string` \| `null`

###### Tables.profiles.Insert.preprov\_server\_wallet\_address?

> `optional` **preprov\_server\_wallet\_address**: `string` \| `null`

###### Tables.profiles.Insert.preprov\_server\_wallet\_id?

> `optional` **preprov\_server\_wallet\_id**: `string` \| `null`

###### Tables.profiles.Insert.preprov\_zora\_handle?

> `optional` **preprov\_zora\_handle**: `string` \| `null`

###### Tables.profiles.Insert.preprovisioned\_at?

> `optional` **preprovisioned\_at**: `string` \| `null`

###### Tables.profiles.Insert.primary\_embedded\_eoa?

> `optional` **primary\_embedded\_eoa**: `string` \| `null`

###### Tables.profiles.Insert.primary\_smart\_wallet?

> `optional` **primary\_smart\_wallet**: `string` \| `null`

###### Tables.profiles.Insert.primary\_wallet?

> `optional` **primary\_wallet**: `string` \| `null`

###### Tables.profiles.Insert.privy\_user\_id?

> `optional` **privy\_user\_id**: `string` \| `null`

###### Tables.profiles.Insert.profile\_completed\_at?

> `optional` **profile\_completed\_at**: `string` \| `null`

###### Tables.profiles.Insert.profile\_fields?

> `optional` **profile\_fields**: [`Json`](#json) \| `null`

###### Tables.profiles.Insert.referral\_claimed\_at?

> `optional` **referral\_claimed\_at**: `string` \| `null`

###### Tables.profiles.Insert.referral\_code?

> `optional` **referral\_code**: `string` \| `null`

###### Tables.profiles.Insert.referred\_by\_code?

> `optional` **referred\_by\_code**: `string` \| `null`

###### Tables.profiles.Insert.referred\_by\_signup\_id?

> `optional` **referred\_by\_signup\_id**: `number` \| `null`

###### Tables.profiles.Insert.solana\_wallet?

> `optional` **solana\_wallet**: `string` \| `null`

###### Tables.profiles.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.profiles.Insert.verifications?

> `optional` **verifications**: [`Json`](#json) \| `null`

###### Tables.profiles.Insert.website?

> `optional` **website**: `string` \| `null`

###### Tables.profiles.Insert.x\_follow\_verified\_at?

> `optional` **x\_follow\_verified\_at**: `string` \| `null`

###### Tables.profiles.Relationships

> **Relationships**: \[\{ `columns`: \[`"merged_into_profile_id"`\]; `foreignKeyName`: `"profiles_merged_into_profile_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"profiles"`; \}\]

###### Tables.profiles.Row

> **Row**: `object`

###### Tables.profiles.Row.app\_access\_decided\_at

> **app\_access\_decided\_at**: `string` \| `null`

###### Tables.profiles.Row.app\_access\_decided\_by

> **app\_access\_decided\_by**: `string` \| `null`

###### Tables.profiles.Row.app\_access\_decision\_note

> **app\_access\_decision\_note**: `string` \| `null`

###### Tables.profiles.Row.app\_access\_status

> **app\_access\_status**: `string`

###### Tables.profiles.Row.avatar\_url

> **avatar\_url**: `string` \| `null`

###### Tables.profiles.Row.banner\_url

> **banner\_url**: `string` \| `null`

###### Tables.profiles.Row.base\_sub\_account

> **base\_sub\_account**: `string` \| `null`

###### Tables.profiles.Row.bio

> **bio**: `string` \| `null`

###### Tables.profiles.Row.border\_tier

> **border\_tier**: `number`

###### Tables.profiles.Row.canonical\_solana\_wallet

> **canonical\_solana\_wallet**: `string` \| `null`

###### Tables.profiles.Row.contact\_preference

> **contact\_preference**: `string` \| `null`

###### Tables.profiles.Row.created\_at

> **created\_at**: `string`

###### Tables.profiles.Row.csw\_address

> **csw\_address**: `string` \| `null`

###### Tables.profiles.Row.display\_name

> **display\_name**: `string` \| `null`

###### Tables.profiles.Row.email

> **email**: `string` \| `null`

###### Tables.profiles.Row.embedded\_wallet

> **embedded\_wallet**: `string` \| `null`

###### Tables.profiles.Row.embedded\_wallet\_chain

> **embedded\_wallet\_chain**: `string` \| `null`

###### Tables.profiles.Row.embedded\_wallet\_client\_type

> **embedded\_wallet\_client\_type**: `string` \| `null`

###### Tables.profiles.Row.erc8004\_agent\_id

> **erc8004\_agent\_id**: `number` \| `null`

###### Tables.profiles.Row.erc8128\_agent\_id

> **erc8128\_agent\_id**: `string` \| `null`

###### Tables.profiles.Row.farcaster\_fid

> **farcaster\_fid**: `number` \| `null`

###### Tables.profiles.Row.has\_creator\_coin

> **has\_creator\_coin**: `boolean` \| `null`

###### Tables.profiles.Row.id

> **id**: `number`

###### Tables.profiles.Row.lens\_account\_address

> **lens\_account\_address**: `string` \| `null`

###### Tables.profiles.Row.lens\_grove\_uri

> **lens\_grove\_uri**: `string` \| `null`

###### Tables.profiles.Row.lens\_handle

> **lens\_handle**: `string` \| `null`

###### Tables.profiles.Row.lens\_owner\_address

> **lens\_owner\_address**: `string` \| `null`

###### Tables.profiles.Row.merged\_into\_profile\_id

> **merged\_into\_profile\_id**: `number` \| `null`

###### Tables.profiles.Row.operational\_solana\_wallet

> **operational\_solana\_wallet**: `string` \| `null`

###### Tables.profiles.Row.persona

> **persona**: `string` \| `null`

###### Tables.profiles.Row.preprov\_coin\_address

> **preprov\_coin\_address**: `string` \| `null`

###### Tables.profiles.Row.preprov\_coin\_symbol

> **preprov\_coin\_symbol**: `string` \| `null`

###### Tables.profiles.Row.preprov\_farcaster\_pfp

> **preprov\_farcaster\_pfp**: `string` \| `null`

###### Tables.profiles.Row.preprov\_farcaster\_username

> **preprov\_farcaster\_username**: `string` \| `null`

###### Tables.profiles.Row.preprov\_server\_wallet\_address

> **preprov\_server\_wallet\_address**: `string` \| `null`

###### Tables.profiles.Row.preprov\_server\_wallet\_id

> **preprov\_server\_wallet\_id**: `string` \| `null`

###### Tables.profiles.Row.preprov\_zora\_handle

> **preprov\_zora\_handle**: `string` \| `null`

###### Tables.profiles.Row.preprovisioned\_at

> **preprovisioned\_at**: `string` \| `null`

###### Tables.profiles.Row.primary\_embedded\_eoa

> **primary\_embedded\_eoa**: `string` \| `null`

###### Tables.profiles.Row.primary\_smart\_wallet

> **primary\_smart\_wallet**: `string` \| `null`

###### Tables.profiles.Row.primary\_wallet

> **primary\_wallet**: `string` \| `null`

###### Tables.profiles.Row.privy\_user\_id

> **privy\_user\_id**: `string` \| `null`

###### Tables.profiles.Row.profile\_completed\_at

> **profile\_completed\_at**: `string` \| `null`

###### Tables.profiles.Row.profile\_fields

> **profile\_fields**: [`Json`](#json) \| `null`

###### Tables.profiles.Row.referral\_claimed\_at

> **referral\_claimed\_at**: `string` \| `null`

###### Tables.profiles.Row.referral\_code

> **referral\_code**: `string` \| `null`

###### Tables.profiles.Row.referred\_by\_code

> **referred\_by\_code**: `string` \| `null`

###### Tables.profiles.Row.referred\_by\_signup\_id

> **referred\_by\_signup\_id**: `number` \| `null`

###### Tables.profiles.Row.solana\_wallet

> **solana\_wallet**: `string` \| `null`

###### Tables.profiles.Row.updated\_at

> **updated\_at**: `string`

###### Tables.profiles.Row.verifications

> **verifications**: [`Json`](#json) \| `null`

###### Tables.profiles.Row.website

> **website**: `string` \| `null`

###### Tables.profiles.Row.x\_follow\_verified\_at

> **x\_follow\_verified\_at**: `string` \| `null`

###### Tables.profiles.Update

> **Update**: `object`

###### Tables.profiles.Update.app\_access\_decided\_at?

> `optional` **app\_access\_decided\_at**: `string` \| `null`

###### Tables.profiles.Update.app\_access\_decided\_by?

> `optional` **app\_access\_decided\_by**: `string` \| `null`

###### Tables.profiles.Update.app\_access\_decision\_note?

> `optional` **app\_access\_decision\_note**: `string` \| `null`

###### Tables.profiles.Update.app\_access\_status?

> `optional` **app\_access\_status**: `string`

###### Tables.profiles.Update.avatar\_url?

> `optional` **avatar\_url**: `string` \| `null`

###### Tables.profiles.Update.banner\_url?

> `optional` **banner\_url**: `string` \| `null`

###### Tables.profiles.Update.base\_sub\_account?

> `optional` **base\_sub\_account**: `string` \| `null`

###### Tables.profiles.Update.bio?

> `optional` **bio**: `string` \| `null`

###### Tables.profiles.Update.border\_tier?

> `optional` **border\_tier**: `number`

###### Tables.profiles.Update.canonical\_solana\_wallet?

> `optional` **canonical\_solana\_wallet**: `string` \| `null`

###### Tables.profiles.Update.contact\_preference?

> `optional` **contact\_preference**: `string` \| `null`

###### Tables.profiles.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.profiles.Update.csw\_address?

> `optional` **csw\_address**: `string` \| `null`

###### Tables.profiles.Update.display\_name?

> `optional` **display\_name**: `string` \| `null`

###### Tables.profiles.Update.email?

> `optional` **email**: `string` \| `null`

###### Tables.profiles.Update.embedded\_wallet?

> `optional` **embedded\_wallet**: `string` \| `null`

###### Tables.profiles.Update.embedded\_wallet\_chain?

> `optional` **embedded\_wallet\_chain**: `string` \| `null`

###### Tables.profiles.Update.embedded\_wallet\_client\_type?

> `optional` **embedded\_wallet\_client\_type**: `string` \| `null`

###### Tables.profiles.Update.erc8004\_agent\_id?

> `optional` **erc8004\_agent\_id**: `number` \| `null`

###### Tables.profiles.Update.erc8128\_agent\_id?

> `optional` **erc8128\_agent\_id**: `string` \| `null`

###### Tables.profiles.Update.farcaster\_fid?

> `optional` **farcaster\_fid**: `number` \| `null`

###### Tables.profiles.Update.has\_creator\_coin?

> `optional` **has\_creator\_coin**: `boolean` \| `null`

###### Tables.profiles.Update.id?

> `optional` **id**: `number`

###### Tables.profiles.Update.lens\_account\_address?

> `optional` **lens\_account\_address**: `string` \| `null`

###### Tables.profiles.Update.lens\_grove\_uri?

> `optional` **lens\_grove\_uri**: `string` \| `null`

###### Tables.profiles.Update.lens\_handle?

> `optional` **lens\_handle**: `string` \| `null`

###### Tables.profiles.Update.lens\_owner\_address?

> `optional` **lens\_owner\_address**: `string` \| `null`

###### Tables.profiles.Update.merged\_into\_profile\_id?

> `optional` **merged\_into\_profile\_id**: `number` \| `null`

###### Tables.profiles.Update.operational\_solana\_wallet?

> `optional` **operational\_solana\_wallet**: `string` \| `null`

###### Tables.profiles.Update.persona?

> `optional` **persona**: `string` \| `null`

###### Tables.profiles.Update.preprov\_coin\_address?

> `optional` **preprov\_coin\_address**: `string` \| `null`

###### Tables.profiles.Update.preprov\_coin\_symbol?

> `optional` **preprov\_coin\_symbol**: `string` \| `null`

###### Tables.profiles.Update.preprov\_farcaster\_pfp?

> `optional` **preprov\_farcaster\_pfp**: `string` \| `null`

###### Tables.profiles.Update.preprov\_farcaster\_username?

> `optional` **preprov\_farcaster\_username**: `string` \| `null`

###### Tables.profiles.Update.preprov\_server\_wallet\_address?

> `optional` **preprov\_server\_wallet\_address**: `string` \| `null`

###### Tables.profiles.Update.preprov\_server\_wallet\_id?

> `optional` **preprov\_server\_wallet\_id**: `string` \| `null`

###### Tables.profiles.Update.preprov\_zora\_handle?

> `optional` **preprov\_zora\_handle**: `string` \| `null`

###### Tables.profiles.Update.preprovisioned\_at?

> `optional` **preprovisioned\_at**: `string` \| `null`

###### Tables.profiles.Update.primary\_embedded\_eoa?

> `optional` **primary\_embedded\_eoa**: `string` \| `null`

###### Tables.profiles.Update.primary\_smart\_wallet?

> `optional` **primary\_smart\_wallet**: `string` \| `null`

###### Tables.profiles.Update.primary\_wallet?

> `optional` **primary\_wallet**: `string` \| `null`

###### Tables.profiles.Update.privy\_user\_id?

> `optional` **privy\_user\_id**: `string` \| `null`

###### Tables.profiles.Update.profile\_completed\_at?

> `optional` **profile\_completed\_at**: `string` \| `null`

###### Tables.profiles.Update.profile\_fields?

> `optional` **profile\_fields**: [`Json`](#json) \| `null`

###### Tables.profiles.Update.referral\_claimed\_at?

> `optional` **referral\_claimed\_at**: `string` \| `null`

###### Tables.profiles.Update.referral\_code?

> `optional` **referral\_code**: `string` \| `null`

###### Tables.profiles.Update.referred\_by\_code?

> `optional` **referred\_by\_code**: `string` \| `null`

###### Tables.profiles.Update.referred\_by\_signup\_id?

> `optional` **referred\_by\_signup\_id**: `number` \| `null`

###### Tables.profiles.Update.solana\_wallet?

> `optional` **solana\_wallet**: `string` \| `null`

###### Tables.profiles.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.profiles.Update.verifications?

> `optional` **verifications**: [`Json`](#json) \| `null`

###### Tables.profiles.Update.website?

> `optional` **website**: `string` \| `null`

###### Tables.profiles.Update.x\_follow\_verified\_at?

> `optional` **x\_follow\_verified\_at**: `string` \| `null`

###### Tables.referral\_clicks

> **referral\_clicks**: `object`

###### Tables.referral\_clicks.Insert

> **Insert**: `object`

###### Tables.referral\_clicks.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.referral\_clicks.Insert.id?

> `optional` **id**: `number`

###### Tables.referral\_clicks.Insert.ip\_hash?

> `optional` **ip\_hash**: `string` \| `null`

###### Tables.referral\_clicks.Insert.is\_bot\_suspected?

> `optional` **is\_bot\_suspected**: `boolean`

###### Tables.referral\_clicks.Insert.landing\_url?

> `optional` **landing\_url**: `string` \| `null`

###### Tables.referral\_clicks.Insert.referral\_code

> **referral\_code**: `string`

###### Tables.referral\_clicks.Insert.referrer\_signup\_id

> **referrer\_signup\_id**: `number`

###### Tables.referral\_clicks.Insert.session\_id?

> `optional` **session\_id**: `string` \| `null`

###### Tables.referral\_clicks.Insert.ua\_hash?

> `optional` **ua\_hash**: `string` \| `null`

###### Tables.referral\_clicks.Relationships

> **Relationships**: \[\]

###### Tables.referral\_clicks.Row

> **Row**: `object`

###### Tables.referral\_clicks.Row.created\_at

> **created\_at**: `string`

###### Tables.referral\_clicks.Row.id

> **id**: `number`

###### Tables.referral\_clicks.Row.ip\_hash

> **ip\_hash**: `string` \| `null`

###### Tables.referral\_clicks.Row.is\_bot\_suspected

> **is\_bot\_suspected**: `boolean`

###### Tables.referral\_clicks.Row.landing\_url

> **landing\_url**: `string` \| `null`

###### Tables.referral\_clicks.Row.referral\_code

> **referral\_code**: `string`

###### Tables.referral\_clicks.Row.referrer\_signup\_id

> **referrer\_signup\_id**: `number`

###### Tables.referral\_clicks.Row.session\_id

> **session\_id**: `string` \| `null`

###### Tables.referral\_clicks.Row.ua\_hash

> **ua\_hash**: `string` \| `null`

###### Tables.referral\_clicks.Update

> **Update**: `object`

###### Tables.referral\_clicks.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.referral\_clicks.Update.id?

> `optional` **id**: `number`

###### Tables.referral\_clicks.Update.ip\_hash?

> `optional` **ip\_hash**: `string` \| `null`

###### Tables.referral\_clicks.Update.is\_bot\_suspected?

> `optional` **is\_bot\_suspected**: `boolean`

###### Tables.referral\_clicks.Update.landing\_url?

> `optional` **landing\_url**: `string` \| `null`

###### Tables.referral\_clicks.Update.referral\_code?

> `optional` **referral\_code**: `string`

###### Tables.referral\_clicks.Update.referrer\_signup\_id?

> `optional` **referrer\_signup\_id**: `number`

###### Tables.referral\_clicks.Update.session\_id?

> `optional` **session\_id**: `string` \| `null`

###### Tables.referral\_clicks.Update.ua\_hash?

> `optional` **ua\_hash**: `string` \| `null`

###### Tables.referral\_conversions

> **referral\_conversions**: `object`

###### Tables.referral\_conversions.Insert

> **Insert**: `object`

###### Tables.referral\_conversions.Insert.attribution?

> `optional` **attribution**: `string`

###### Tables.referral\_conversions.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.referral\_conversions.Insert.id?

> `optional` **id**: `number`

###### Tables.referral\_conversions.Insert.invalid\_reason?

> `optional` **invalid\_reason**: `string` \| `null`

###### Tables.referral\_conversions.Insert.invitee\_signup\_id

> **invitee\_signup\_id**: `number`

###### Tables.referral\_conversions.Insert.ip\_hash?

> `optional` **ip\_hash**: `string` \| `null`

###### Tables.referral\_conversions.Insert.is\_valid?

> `optional` **is\_valid**: `boolean`

###### Tables.referral\_conversions.Insert.qualified\_at?

> `optional` **qualified\_at**: `string` \| `null`

###### Tables.referral\_conversions.Insert.referral\_code

> **referral\_code**: `string`

###### Tables.referral\_conversions.Insert.referrer\_signup\_id

> **referrer\_signup\_id**: `number`

###### Tables.referral\_conversions.Insert.session\_id?

> `optional` **session\_id**: `string` \| `null`

###### Tables.referral\_conversions.Insert.status?

> `optional` **status**: `string` \| `null`

###### Tables.referral\_conversions.Insert.ua\_hash?

> `optional` **ua\_hash**: `string` \| `null`

###### Tables.referral\_conversions.Relationships

> **Relationships**: \[\]

###### Tables.referral\_conversions.Row

> **Row**: `object`

###### Tables.referral\_conversions.Row.attribution

> **attribution**: `string`

###### Tables.referral\_conversions.Row.created\_at

> **created\_at**: `string`

###### Tables.referral\_conversions.Row.id

> **id**: `number`

###### Tables.referral\_conversions.Row.invalid\_reason

> **invalid\_reason**: `string` \| `null`

###### Tables.referral\_conversions.Row.invitee\_signup\_id

> **invitee\_signup\_id**: `number`

###### Tables.referral\_conversions.Row.ip\_hash

> **ip\_hash**: `string` \| `null`

###### Tables.referral\_conversions.Row.is\_valid

> **is\_valid**: `boolean`

###### Tables.referral\_conversions.Row.qualified\_at

> **qualified\_at**: `string` \| `null`

###### Tables.referral\_conversions.Row.referral\_code

> **referral\_code**: `string`

###### Tables.referral\_conversions.Row.referrer\_signup\_id

> **referrer\_signup\_id**: `number`

###### Tables.referral\_conversions.Row.session\_id

> **session\_id**: `string` \| `null`

###### Tables.referral\_conversions.Row.status

> **status**: `string` \| `null`

###### Tables.referral\_conversions.Row.ua\_hash

> **ua\_hash**: `string` \| `null`

###### Tables.referral\_conversions.Update

> **Update**: `object`

###### Tables.referral\_conversions.Update.attribution?

> `optional` **attribution**: `string`

###### Tables.referral\_conversions.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.referral\_conversions.Update.id?

> `optional` **id**: `number`

###### Tables.referral\_conversions.Update.invalid\_reason?

> `optional` **invalid\_reason**: `string` \| `null`

###### Tables.referral\_conversions.Update.invitee\_signup\_id?

> `optional` **invitee\_signup\_id**: `number`

###### Tables.referral\_conversions.Update.ip\_hash?

> `optional` **ip\_hash**: `string` \| `null`

###### Tables.referral\_conversions.Update.is\_valid?

> `optional` **is\_valid**: `boolean`

###### Tables.referral\_conversions.Update.qualified\_at?

> `optional` **qualified\_at**: `string` \| `null`

###### Tables.referral\_conversions.Update.referral\_code?

> `optional` **referral\_code**: `string`

###### Tables.referral\_conversions.Update.referrer\_signup\_id?

> `optional` **referrer\_signup\_id**: `number`

###### Tables.referral\_conversions.Update.session\_id?

> `optional` **session\_id**: `string` \| `null`

###### Tables.referral\_conversions.Update.status?

> `optional` **status**: `string` \| `null`

###### Tables.referral\_conversions.Update.ua\_hash?

> `optional` **ua\_hash**: `string` \| `null`

###### Tables.sankey\_lookerstudio\_full\_dataset

> **sankey\_lookerstudio\_full\_dataset**: `object`

###### Tables.sankey\_lookerstudio\_full\_dataset.Insert

> **Insert**: `object`

###### Tables.sankey\_lookerstudio\_full\_dataset.Insert.action\_group

> **action\_group**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Insert.bucket

> **bucket**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Insert.from\_node

> **from\_node**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Insert.generated\_at

> **generated\_at**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Insert.pct\_of\_from\_count

> **pct\_of\_from\_count**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Insert.pct\_of\_from\_usd

> **pct\_of\_from\_usd**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Insert.pct\_of\_total\_count

> **pct\_of\_total\_count**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Insert.pct\_of\_total\_usd

> **pct\_of\_total\_usd**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Insert.scope

> **scope**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Insert.to\_node

> **to\_node**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Insert.weight\_count

> **weight\_count**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Insert.weight\_usd

> **weight\_usd**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Relationships

> **Relationships**: \[\]

###### Tables.sankey\_lookerstudio\_full\_dataset.Row

> **Row**: `object`

###### Tables.sankey\_lookerstudio\_full\_dataset.Row.action\_group

> **action\_group**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Row.bucket

> **bucket**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Row.from\_node

> **from\_node**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Row.generated\_at

> **generated\_at**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Row.pct\_of\_from\_count

> **pct\_of\_from\_count**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Row.pct\_of\_from\_usd

> **pct\_of\_from\_usd**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Row.pct\_of\_total\_count

> **pct\_of\_total\_count**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Row.pct\_of\_total\_usd

> **pct\_of\_total\_usd**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Row.scope

> **scope**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Row.to\_node

> **to\_node**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Row.weight\_count

> **weight\_count**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Row.weight\_usd

> **weight\_usd**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Update

> **Update**: `object`

###### Tables.sankey\_lookerstudio\_full\_dataset.Update.action\_group?

> `optional` **action\_group**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Update.bucket?

> `optional` **bucket**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Update.from\_node?

> `optional` **from\_node**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Update.generated\_at?

> `optional` **generated\_at**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Update.pct\_of\_from\_count?

> `optional` **pct\_of\_from\_count**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Update.pct\_of\_from\_usd?

> `optional` **pct\_of\_from\_usd**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Update.pct\_of\_total\_count?

> `optional` **pct\_of\_total\_count**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Update.pct\_of\_total\_usd?

> `optional` **pct\_of\_total\_usd**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Update.scope?

> `optional` **scope**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Update.to\_node?

> `optional` **to\_node**: `string`

###### Tables.sankey\_lookerstudio\_full\_dataset.Update.weight\_count?

> `optional` **weight\_count**: `number`

###### Tables.sankey\_lookerstudio\_full\_dataset.Update.weight\_usd?

> `optional` **weight\_usd**: `number`

###### Tables.task\_loops

> **task\_loops**: `object`

###### Tables.task\_loops.Insert

> **Insert**: `object`

###### Tables.task\_loops.Insert.conversation\_id?

> `optional` **conversation\_id**: `string` \| `null`

###### Tables.task\_loops.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.task\_loops.Insert.id?

> `optional` **id**: `number`

###### Tables.task\_loops.Insert.status?

> `optional` **status**: `string` \| `null`

###### Tables.task\_loops.Insert.task

> **task**: `string`

###### Tables.task\_loops.Relationships

> **Relationships**: \[\]

###### Tables.task\_loops.Row

> **Row**: `object`

###### Tables.task\_loops.Row.conversation\_id

> **conversation\_id**: `string` \| `null`

###### Tables.task\_loops.Row.created\_at

> **created\_at**: `string`

###### Tables.task\_loops.Row.id

> **id**: `number`

###### Tables.task\_loops.Row.status

> **status**: `string` \| `null`

###### Tables.task\_loops.Row.task

> **task**: `string`

###### Tables.task\_loops.Update

> **Update**: `object`

###### Tables.task\_loops.Update.conversation\_id?

> `optional` **conversation\_id**: `string` \| `null`

###### Tables.task\_loops.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.task\_loops.Update.id?

> `optional` **id**: `number`

###### Tables.task\_loops.Update.status?

> `optional` **status**: `string` \| `null`

###### Tables.task\_loops.Update.task?

> `optional` **task**: `string`

###### Tables.telegram\_action\_audit

> **telegram\_action\_audit**: `object`

###### Tables.telegram\_action\_audit.Insert

> **Insert**: `object`

###### Tables.telegram\_action\_audit.Insert.action\_type

> **action\_type**: `string`

###### Tables.telegram\_action\_audit.Insert.canonical\_csw\_address

> **canonical\_csw\_address**: `string`

###### Tables.telegram\_action\_audit.Insert.chat\_id

> **chat\_id**: `string`

###### Tables.telegram\_action\_audit.Insert.correlation\_id?

> `optional` **correlation\_id**: `string` \| `null`

###### Tables.telegram\_action\_audit.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_action\_audit.Insert.error\_code?

> `optional` **error\_code**: `string` \| `null`

###### Tables.telegram\_action\_audit.Insert.error\_message?

> `optional` **error\_message**: `string` \| `null`

###### Tables.telegram\_action\_audit.Insert.execution\_json?

> `optional` **execution\_json**: [`Json`](#json) \| `null`

###### Tables.telegram\_action\_audit.Insert.id?

> `optional` **id**: `string`

###### Tables.telegram\_action\_audit.Insert.intent\_json

> **intent\_json**: [`Json`](#json)

###### Tables.telegram\_action\_audit.Insert.message\_id?

> `optional` **message\_id**: `number` \| `null`

###### Tables.telegram\_action\_audit.Insert.profile\_id

> **profile\_id**: `number`

###### Tables.telegram\_action\_audit.Insert.quote\_json?

> `optional` **quote\_json**: [`Json`](#json) \| `null`

###### Tables.telegram\_action\_audit.Insert.status

> **status**: `string`

###### Tables.telegram\_action\_audit.Insert.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_action\_audit.Insert.tx\_hash?

> `optional` **tx\_hash**: `string` \| `null`

###### Tables.telegram\_action\_audit.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.telegram\_action\_audit.Relationships

> **Relationships**: \[\]

###### Tables.telegram\_action\_audit.Row

> **Row**: `object`

###### Tables.telegram\_action\_audit.Row.action\_type

> **action\_type**: `string`

###### Tables.telegram\_action\_audit.Row.canonical\_csw\_address

> **canonical\_csw\_address**: `string`

###### Tables.telegram\_action\_audit.Row.chat\_id

> **chat\_id**: `string`

###### Tables.telegram\_action\_audit.Row.correlation\_id

> **correlation\_id**: `string` \| `null`

###### Tables.telegram\_action\_audit.Row.created\_at

> **created\_at**: `string`

###### Tables.telegram\_action\_audit.Row.error\_code

> **error\_code**: `string` \| `null`

###### Tables.telegram\_action\_audit.Row.error\_message

> **error\_message**: `string` \| `null`

###### Tables.telegram\_action\_audit.Row.execution\_json

> **execution\_json**: [`Json`](#json) \| `null`

###### Tables.telegram\_action\_audit.Row.id

> **id**: `string`

###### Tables.telegram\_action\_audit.Row.intent\_json

> **intent\_json**: [`Json`](#json)

###### Tables.telegram\_action\_audit.Row.message\_id

> **message\_id**: `number` \| `null`

###### Tables.telegram\_action\_audit.Row.profile\_id

> **profile\_id**: `number`

###### Tables.telegram\_action\_audit.Row.quote\_json

> **quote\_json**: [`Json`](#json) \| `null`

###### Tables.telegram\_action\_audit.Row.status

> **status**: `string`

###### Tables.telegram\_action\_audit.Row.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_action\_audit.Row.tx\_hash

> **tx\_hash**: `string` \| `null`

###### Tables.telegram\_action\_audit.Row.updated\_at

> **updated\_at**: `string`

###### Tables.telegram\_action\_audit.Update

> **Update**: `object`

###### Tables.telegram\_action\_audit.Update.action\_type?

> `optional` **action\_type**: `string`

###### Tables.telegram\_action\_audit.Update.canonical\_csw\_address?

> `optional` **canonical\_csw\_address**: `string`

###### Tables.telegram\_action\_audit.Update.chat\_id?

> `optional` **chat\_id**: `string`

###### Tables.telegram\_action\_audit.Update.correlation\_id?

> `optional` **correlation\_id**: `string` \| `null`

###### Tables.telegram\_action\_audit.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_action\_audit.Update.error\_code?

> `optional` **error\_code**: `string` \| `null`

###### Tables.telegram\_action\_audit.Update.error\_message?

> `optional` **error\_message**: `string` \| `null`

###### Tables.telegram\_action\_audit.Update.execution\_json?

> `optional` **execution\_json**: [`Json`](#json) \| `null`

###### Tables.telegram\_action\_audit.Update.id?

> `optional` **id**: `string`

###### Tables.telegram\_action\_audit.Update.intent\_json?

> `optional` **intent\_json**: [`Json`](#json)

###### Tables.telegram\_action\_audit.Update.message\_id?

> `optional` **message\_id**: `number` \| `null`

###### Tables.telegram\_action\_audit.Update.profile\_id?

> `optional` **profile\_id**: `number`

###### Tables.telegram\_action\_audit.Update.quote\_json?

> `optional` **quote\_json**: [`Json`](#json) \| `null`

###### Tables.telegram\_action\_audit.Update.status?

> `optional` **status**: `string`

###### Tables.telegram\_action\_audit.Update.telegram\_user\_id?

> `optional` **telegram\_user\_id**: `number`

###### Tables.telegram\_action\_audit.Update.tx\_hash?

> `optional` **tx\_hash**: `string` \| `null`

###### Tables.telegram\_action\_audit.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.telegram\_action\_tokens

> **telegram\_action\_tokens**: `object`

###### Tables.telegram\_action\_tokens.Insert

> **Insert**: `object`

###### Tables.telegram\_action\_tokens.Insert.action\_type

> **action\_type**: `string`

###### Tables.telegram\_action\_tokens.Insert.chat\_id

> **chat\_id**: `string`

###### Tables.telegram\_action\_tokens.Insert.consumed\_at?

> `optional` **consumed\_at**: `string` \| `null`

###### Tables.telegram\_action\_tokens.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_action\_tokens.Insert.expires\_at

> **expires\_at**: `string`

###### Tables.telegram\_action\_tokens.Insert.intent\_payload\_json

> **intent\_payload\_json**: [`Json`](#json)

###### Tables.telegram\_action\_tokens.Insert.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_action\_tokens.Insert.token\_hash

> **token\_hash**: `string`

###### Tables.telegram\_action\_tokens.Relationships

> **Relationships**: \[\]

###### Tables.telegram\_action\_tokens.Row

> **Row**: `object`

###### Tables.telegram\_action\_tokens.Row.action\_type

> **action\_type**: `string`

###### Tables.telegram\_action\_tokens.Row.chat\_id

> **chat\_id**: `string`

###### Tables.telegram\_action\_tokens.Row.consumed\_at

> **consumed\_at**: `string` \| `null`

###### Tables.telegram\_action\_tokens.Row.created\_at

> **created\_at**: `string`

###### Tables.telegram\_action\_tokens.Row.expires\_at

> **expires\_at**: `string`

###### Tables.telegram\_action\_tokens.Row.intent\_payload\_json

> **intent\_payload\_json**: [`Json`](#json)

###### Tables.telegram\_action\_tokens.Row.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_action\_tokens.Row.token\_hash

> **token\_hash**: `string`

###### Tables.telegram\_action\_tokens.Update

> **Update**: `object`

###### Tables.telegram\_action\_tokens.Update.action\_type?

> `optional` **action\_type**: `string`

###### Tables.telegram\_action\_tokens.Update.chat\_id?

> `optional` **chat\_id**: `string`

###### Tables.telegram\_action\_tokens.Update.consumed\_at?

> `optional` **consumed\_at**: `string` \| `null`

###### Tables.telegram\_action\_tokens.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_action\_tokens.Update.expires\_at?

> `optional` **expires\_at**: `string`

###### Tables.telegram\_action\_tokens.Update.intent\_payload\_json?

> `optional` **intent\_payload\_json**: [`Json`](#json)

###### Tables.telegram\_action\_tokens.Update.telegram\_user\_id?

> `optional` **telegram\_user\_id**: `number`

###### Tables.telegram\_action\_tokens.Update.token\_hash?

> `optional` **token\_hash**: `string`

###### Tables.telegram\_active\_messages

> **telegram\_active\_messages**: `object`

###### Tables.telegram\_active\_messages.Insert

> **Insert**: `object`

###### Tables.telegram\_active\_messages.Insert.chat\_id

> **chat\_id**: `string`

###### Tables.telegram\_active\_messages.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_active\_messages.Insert.message\_id

> **message\_id**: `number`

###### Tables.telegram\_active\_messages.Insert.owner\_telegram\_user\_id

> **owner\_telegram\_user\_id**: `number`

###### Tables.telegram\_active\_messages.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.telegram\_active\_messages.Relationships

> **Relationships**: \[\]

###### Tables.telegram\_active\_messages.Row

> **Row**: `object`

###### Tables.telegram\_active\_messages.Row.chat\_id

> **chat\_id**: `string`

###### Tables.telegram\_active\_messages.Row.created\_at

> **created\_at**: `string`

###### Tables.telegram\_active\_messages.Row.message\_id

> **message\_id**: `number`

###### Tables.telegram\_active\_messages.Row.owner\_telegram\_user\_id

> **owner\_telegram\_user\_id**: `number`

###### Tables.telegram\_active\_messages.Row.updated\_at

> **updated\_at**: `string`

###### Tables.telegram\_active\_messages.Update

> **Update**: `object`

###### Tables.telegram\_active\_messages.Update.chat\_id?

> `optional` **chat\_id**: `string`

###### Tables.telegram\_active\_messages.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_active\_messages.Update.message\_id?

> `optional` **message\_id**: `number`

###### Tables.telegram\_active\_messages.Update.owner\_telegram\_user\_id?

> `optional` **owner\_telegram\_user\_id**: `number`

###### Tables.telegram\_active\_messages.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.telegram\_chat\_vault\_scope

> **telegram\_chat\_vault\_scope**: `object`

###### Tables.telegram\_chat\_vault\_scope.Insert

> **Insert**: `object`

###### Tables.telegram\_chat\_vault\_scope.Insert.allowed\_vault\_ids?

> `optional` **allowed\_vault\_ids**: [`Json`](#json)

###### Tables.telegram\_chat\_vault\_scope.Insert.bid\_enabled?

> `optional` **bid\_enabled**: `boolean`

###### Tables.telegram\_chat\_vault\_scope.Insert.buy\_sell\_enabled?

> `optional` **buy\_sell\_enabled**: `boolean`

###### Tables.telegram\_chat\_vault\_scope.Insert.chat\_id

> **chat\_id**: `string`

###### Tables.telegram\_chat\_vault\_scope.Relationships

> **Relationships**: \[\]

###### Tables.telegram\_chat\_vault\_scope.Row

> **Row**: `object`

###### Tables.telegram\_chat\_vault\_scope.Row.allowed\_vault\_ids

> **allowed\_vault\_ids**: [`Json`](#json)

###### Tables.telegram\_chat\_vault\_scope.Row.bid\_enabled

> **bid\_enabled**: `boolean`

###### Tables.telegram\_chat\_vault\_scope.Row.buy\_sell\_enabled

> **buy\_sell\_enabled**: `boolean`

###### Tables.telegram\_chat\_vault\_scope.Row.chat\_id

> **chat\_id**: `string`

###### Tables.telegram\_chat\_vault\_scope.Update

> **Update**: `object`

###### Tables.telegram\_chat\_vault\_scope.Update.allowed\_vault\_ids?

> `optional` **allowed\_vault\_ids**: [`Json`](#json)

###### Tables.telegram\_chat\_vault\_scope.Update.bid\_enabled?

> `optional` **bid\_enabled**: `boolean`

###### Tables.telegram\_chat\_vault\_scope.Update.buy\_sell\_enabled?

> `optional` **buy\_sell\_enabled**: `boolean`

###### Tables.telegram\_chat\_vault\_scope.Update.chat\_id?

> `optional` **chat\_id**: `string`

###### Tables.telegram\_funnel\_events

> **telegram\_funnel\_events**: `object`

###### Tables.telegram\_funnel\_events.Insert

> **Insert**: `object`

###### Tables.telegram\_funnel\_events.Insert.action\_type?

> `optional` **action\_type**: `string` \| `null`

###### Tables.telegram\_funnel\_events.Insert.chat\_id?

> `optional` **chat\_id**: `string` \| `null`

###### Tables.telegram\_funnel\_events.Insert.context\_json?

> `optional` **context\_json**: [`Json`](#json)

###### Tables.telegram\_funnel\_events.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_funnel\_events.Insert.event\_name

> **event\_name**: `string`

###### Tables.telegram\_funnel\_events.Insert.id?

> `optional` **id**: `string`

###### Tables.telegram\_funnel\_events.Insert.telegram\_user\_id?

> `optional` **telegram\_user\_id**: `number` \| `null`

###### Tables.telegram\_funnel\_events.Relationships

> **Relationships**: \[\]

###### Tables.telegram\_funnel\_events.Row

> **Row**: `object`

###### Tables.telegram\_funnel\_events.Row.action\_type

> **action\_type**: `string` \| `null`

###### Tables.telegram\_funnel\_events.Row.chat\_id

> **chat\_id**: `string` \| `null`

###### Tables.telegram\_funnel\_events.Row.context\_json

> **context\_json**: [`Json`](#json)

###### Tables.telegram\_funnel\_events.Row.created\_at

> **created\_at**: `string`

###### Tables.telegram\_funnel\_events.Row.event\_name

> **event\_name**: `string`

###### Tables.telegram\_funnel\_events.Row.id

> **id**: `string`

###### Tables.telegram\_funnel\_events.Row.telegram\_user\_id

> **telegram\_user\_id**: `number` \| `null`

###### Tables.telegram\_funnel\_events.Update

> **Update**: `object`

###### Tables.telegram\_funnel\_events.Update.action\_type?

> `optional` **action\_type**: `string` \| `null`

###### Tables.telegram\_funnel\_events.Update.chat\_id?

> `optional` **chat\_id**: `string` \| `null`

###### Tables.telegram\_funnel\_events.Update.context\_json?

> `optional` **context\_json**: [`Json`](#json)

###### Tables.telegram\_funnel\_events.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_funnel\_events.Update.event\_name?

> `optional` **event\_name**: `string`

###### Tables.telegram\_funnel\_events.Update.id?

> `optional` **id**: `string`

###### Tables.telegram\_funnel\_events.Update.telegram\_user\_id?

> `optional` **telegram\_user\_id**: `number` \| `null`

###### Tables.telegram\_holder\_room\_members

> **telegram\_holder\_room\_members**: `object`

###### Tables.telegram\_holder\_room\_members.Insert

> **Insert**: `object`

###### Tables.telegram\_holder\_room\_members.Insert.canonical\_csw\_address

> **canonical\_csw\_address**: `string`

###### Tables.telegram\_holder\_room\_members.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_holder\_room\_members.Insert.grace\_until?

> `optional` **grace\_until**: `string` \| `null`

###### Tables.telegram\_holder\_room\_members.Insert.last\_checked\_at?

> `optional` **last\_checked\_at**: `string` \| `null`

###### Tables.telegram\_holder\_room\_members.Insert.last\_eligible\_at?

> `optional` **last\_eligible\_at**: `string` \| `null`

###### Tables.telegram\_holder\_room\_members.Insert.removed\_at?

> `optional` **removed\_at**: `string` \| `null`

###### Tables.telegram\_holder\_room\_members.Insert.room\_chat\_id

> **room\_chat\_id**: `string`

###### Tables.telegram\_holder\_room\_members.Insert.status?

> `optional` **status**: `string`

###### Tables.telegram\_holder\_room\_members.Insert.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_holder\_room\_members.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.telegram\_holder\_room\_members.Relationships

> **Relationships**: \[\]

###### Tables.telegram\_holder\_room\_members.Row

> **Row**: `object`

###### Tables.telegram\_holder\_room\_members.Row.canonical\_csw\_address

> **canonical\_csw\_address**: `string`

###### Tables.telegram\_holder\_room\_members.Row.created\_at

> **created\_at**: `string`

###### Tables.telegram\_holder\_room\_members.Row.grace\_until

> **grace\_until**: `string` \| `null`

###### Tables.telegram\_holder\_room\_members.Row.last\_checked\_at

> **last\_checked\_at**: `string` \| `null`

###### Tables.telegram\_holder\_room\_members.Row.last\_eligible\_at

> **last\_eligible\_at**: `string` \| `null`

###### Tables.telegram\_holder\_room\_members.Row.removed\_at

> **removed\_at**: `string` \| `null`

###### Tables.telegram\_holder\_room\_members.Row.room\_chat\_id

> **room\_chat\_id**: `string`

###### Tables.telegram\_holder\_room\_members.Row.status

> **status**: `string`

###### Tables.telegram\_holder\_room\_members.Row.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_holder\_room\_members.Row.updated\_at

> **updated\_at**: `string`

###### Tables.telegram\_holder\_room\_members.Update

> **Update**: `object`

###### Tables.telegram\_holder\_room\_members.Update.canonical\_csw\_address?

> `optional` **canonical\_csw\_address**: `string`

###### Tables.telegram\_holder\_room\_members.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_holder\_room\_members.Update.grace\_until?

> `optional` **grace\_until**: `string` \| `null`

###### Tables.telegram\_holder\_room\_members.Update.last\_checked\_at?

> `optional` **last\_checked\_at**: `string` \| `null`

###### Tables.telegram\_holder\_room\_members.Update.last\_eligible\_at?

> `optional` **last\_eligible\_at**: `string` \| `null`

###### Tables.telegram\_holder\_room\_members.Update.removed\_at?

> `optional` **removed\_at**: `string` \| `null`

###### Tables.telegram\_holder\_room\_members.Update.room\_chat\_id?

> `optional` **room\_chat\_id**: `string`

###### Tables.telegram\_holder\_room\_members.Update.status?

> `optional` **status**: `string`

###### Tables.telegram\_holder\_room\_members.Update.telegram\_user\_id?

> `optional` **telegram\_user\_id**: `number`

###### Tables.telegram\_holder\_room\_members.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.telegram\_holder\_room\_policies

> **telegram\_holder\_room\_policies**: `object`

###### Tables.telegram\_holder\_room\_policies.Insert

> **Insert**: `object`

###### Tables.telegram\_holder\_room\_policies.Insert.chat\_id

> **chat\_id**: `string`

###### Tables.telegram\_holder\_room\_policies.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_holder\_room\_policies.Insert.enabled?

> `optional` **enabled**: `boolean`

###### Tables.telegram\_holder\_room\_policies.Insert.grace\_hours?

> `optional` **grace\_hours**: `number`

###### Tables.telegram\_holder\_room\_policies.Insert.min\_shares\_raw

> **min\_shares\_raw**: `string`

###### Tables.telegram\_holder\_room\_policies.Insert.room\_chat\_id

> **room\_chat\_id**: `string`

###### Tables.telegram\_holder\_room\_policies.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.telegram\_holder\_room\_policies.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.telegram\_holder\_room\_policies.Relationships

> **Relationships**: \[\]

###### Tables.telegram\_holder\_room\_policies.Row

> **Row**: `object`

###### Tables.telegram\_holder\_room\_policies.Row.chat\_id

> **chat\_id**: `string`

###### Tables.telegram\_holder\_room\_policies.Row.created\_at

> **created\_at**: `string`

###### Tables.telegram\_holder\_room\_policies.Row.enabled

> **enabled**: `boolean`

###### Tables.telegram\_holder\_room\_policies.Row.grace\_hours

> **grace\_hours**: `number`

###### Tables.telegram\_holder\_room\_policies.Row.min\_shares\_raw

> **min\_shares\_raw**: `string`

###### Tables.telegram\_holder\_room\_policies.Row.room\_chat\_id

> **room\_chat\_id**: `string`

###### Tables.telegram\_holder\_room\_policies.Row.updated\_at

> **updated\_at**: `string`

###### Tables.telegram\_holder\_room\_policies.Row.vault\_address

> **vault\_address**: `string`

###### Tables.telegram\_holder\_room\_policies.Update

> **Update**: `object`

###### Tables.telegram\_holder\_room\_policies.Update.chat\_id?

> `optional` **chat\_id**: `string`

###### Tables.telegram\_holder\_room\_policies.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_holder\_room\_policies.Update.enabled?

> `optional` **enabled**: `boolean`

###### Tables.telegram\_holder\_room\_policies.Update.grace\_hours?

> `optional` **grace\_hours**: `number`

###### Tables.telegram\_holder\_room\_policies.Update.min\_shares\_raw?

> `optional` **min\_shares\_raw**: `string`

###### Tables.telegram\_holder\_room\_policies.Update.room\_chat\_id?

> `optional` **room\_chat\_id**: `string`

###### Tables.telegram\_holder\_room\_policies.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.telegram\_holder\_room\_policies.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.telegram\_inline\_signal\_feeds

> **telegram\_inline\_signal\_feeds**: `object`

###### Tables.telegram\_inline\_signal\_feeds.Insert

> **Insert**: `object`

###### Tables.telegram\_inline\_signal\_feeds.Insert.closed\_at?

> `optional` **closed\_at**: `string` \| `null`

###### Tables.telegram\_inline\_signal\_feeds.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_inline\_signal\_feeds.Insert.inline\_message\_id

> **inline\_message\_id**: `string`

###### Tables.telegram\_inline\_signal\_feeds.Insert.last\_pushed\_at?

> `optional` **last\_pushed\_at**: `string` \| `null`

###### Tables.telegram\_inline\_signal\_feeds.Insert.last\_render\_hash?

> `optional` **last\_render\_hash**: `string` \| `null`

###### Tables.telegram\_inline\_signal\_feeds.Insert.owner\_telegram\_user\_id

> **owner\_telegram\_user\_id**: `number`

###### Tables.telegram\_inline\_signal\_feeds.Insert.paused?

> `optional` **paused**: `boolean`

###### Tables.telegram\_inline\_signal\_feeds.Insert.source\_chat\_id

> **source\_chat\_id**: `string`

###### Tables.telegram\_inline\_signal\_feeds.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.telegram\_inline\_signal\_feeds.Relationships

> **Relationships**: \[\]

###### Tables.telegram\_inline\_signal\_feeds.Row

> **Row**: `object`

###### Tables.telegram\_inline\_signal\_feeds.Row.closed\_at

> **closed\_at**: `string` \| `null`

###### Tables.telegram\_inline\_signal\_feeds.Row.created\_at

> **created\_at**: `string`

###### Tables.telegram\_inline\_signal\_feeds.Row.inline\_message\_id

> **inline\_message\_id**: `string`

###### Tables.telegram\_inline\_signal\_feeds.Row.last\_pushed\_at

> **last\_pushed\_at**: `string` \| `null`

###### Tables.telegram\_inline\_signal\_feeds.Row.last\_render\_hash

> **last\_render\_hash**: `string` \| `null`

###### Tables.telegram\_inline\_signal\_feeds.Row.owner\_telegram\_user\_id

> **owner\_telegram\_user\_id**: `number`

###### Tables.telegram\_inline\_signal\_feeds.Row.paused

> **paused**: `boolean`

###### Tables.telegram\_inline\_signal\_feeds.Row.source\_chat\_id

> **source\_chat\_id**: `string`

###### Tables.telegram\_inline\_signal\_feeds.Row.updated\_at

> **updated\_at**: `string`

###### Tables.telegram\_inline\_signal\_feeds.Update

> **Update**: `object`

###### Tables.telegram\_inline\_signal\_feeds.Update.closed\_at?

> `optional` **closed\_at**: `string` \| `null`

###### Tables.telegram\_inline\_signal\_feeds.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_inline\_signal\_feeds.Update.inline\_message\_id?

> `optional` **inline\_message\_id**: `string`

###### Tables.telegram\_inline\_signal\_feeds.Update.last\_pushed\_at?

> `optional` **last\_pushed\_at**: `string` \| `null`

###### Tables.telegram\_inline\_signal\_feeds.Update.last\_render\_hash?

> `optional` **last\_render\_hash**: `string` \| `null`

###### Tables.telegram\_inline\_signal\_feeds.Update.owner\_telegram\_user\_id?

> `optional` **owner\_telegram\_user\_id**: `number`

###### Tables.telegram\_inline\_signal\_feeds.Update.paused?

> `optional` **paused**: `boolean`

###### Tables.telegram\_inline\_signal\_feeds.Update.source\_chat\_id?

> `optional` **source\_chat\_id**: `string`

###### Tables.telegram\_inline\_signal\_feeds.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.telegram\_link\_start\_token\_claims

> **telegram\_link\_start\_token\_claims**: `object`

###### Tables.telegram\_link\_start\_token\_claims.Insert

> **Insert**: `object`

###### Tables.telegram\_link\_start\_token\_claims.Insert.chat\_id

> **chat\_id**: `string`

###### Tables.telegram\_link\_start\_token\_claims.Insert.consumed\_at?

> `optional` **consumed\_at**: `string` \| `null`

###### Tables.telegram\_link\_start\_token\_claims.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_link\_start\_token\_claims.Insert.expires\_at

> **expires\_at**: `string`

###### Tables.telegram\_link\_start\_token\_claims.Insert.privy\_user\_id

> **privy\_user\_id**: `string`

###### Tables.telegram\_link\_start\_token\_claims.Insert.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_link\_start\_token\_claims.Insert.token\_hash

> **token\_hash**: `string`

###### Tables.telegram\_link\_start\_token\_claims.Relationships

> **Relationships**: \[\]

###### Tables.telegram\_link\_start\_token\_claims.Row

> **Row**: `object`

###### Tables.telegram\_link\_start\_token\_claims.Row.chat\_id

> **chat\_id**: `string`

###### Tables.telegram\_link\_start\_token\_claims.Row.consumed\_at

> **consumed\_at**: `string` \| `null`

###### Tables.telegram\_link\_start\_token\_claims.Row.created\_at

> **created\_at**: `string`

###### Tables.telegram\_link\_start\_token\_claims.Row.expires\_at

> **expires\_at**: `string`

###### Tables.telegram\_link\_start\_token\_claims.Row.privy\_user\_id

> **privy\_user\_id**: `string`

###### Tables.telegram\_link\_start\_token\_claims.Row.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_link\_start\_token\_claims.Row.token\_hash

> **token\_hash**: `string`

###### Tables.telegram\_link\_start\_token\_claims.Update

> **Update**: `object`

###### Tables.telegram\_link\_start\_token\_claims.Update.chat\_id?

> `optional` **chat\_id**: `string`

###### Tables.telegram\_link\_start\_token\_claims.Update.consumed\_at?

> `optional` **consumed\_at**: `string` \| `null`

###### Tables.telegram\_link\_start\_token\_claims.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_link\_start\_token\_claims.Update.expires\_at?

> `optional` **expires\_at**: `string`

###### Tables.telegram\_link\_start\_token\_claims.Update.privy\_user\_id?

> `optional` **privy\_user\_id**: `string`

###### Tables.telegram\_link\_start\_token\_claims.Update.telegram\_user\_id?

> `optional` **telegram\_user\_id**: `number`

###### Tables.telegram\_link\_start\_token\_claims.Update.token\_hash?

> `optional` **token\_hash**: `string`

###### Tables.telegram\_link\_telemetry\_events

> **telegram\_link\_telemetry\_events**: `object`

###### Tables.telegram\_link\_telemetry\_events.Insert

> **Insert**: `object`

###### Tables.telegram\_link\_telemetry\_events.Insert.chat\_id?

> `optional` **chat\_id**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_link\_telemetry\_events.Insert.event

> **event**: `string`

###### Tables.telegram\_link\_telemetry\_events.Insert.flow\_id?

> `optional` **flow\_id**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Insert.id?

> `optional` **id**: `number`

###### Tables.telegram\_link\_telemetry\_events.Insert.payload?

> `optional` **payload**: [`Json`](#json) \| `null`

###### Tables.telegram\_link\_telemetry\_events.Insert.phase?

> `optional` **phase**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Insert.privy\_user\_id?

> `optional` **privy\_user\_id**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Insert.source?

> `optional` **source**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Insert.status?

> `optional` **status**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Insert.telegram\_user\_id?

> `optional` **telegram\_user\_id**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Relationships

> **Relationships**: \[\]

###### Tables.telegram\_link\_telemetry\_events.Row

> **Row**: `object`

###### Tables.telegram\_link\_telemetry\_events.Row.chat\_id

> **chat\_id**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Row.created\_at

> **created\_at**: `string`

###### Tables.telegram\_link\_telemetry\_events.Row.event

> **event**: `string`

###### Tables.telegram\_link\_telemetry\_events.Row.flow\_id

> **flow\_id**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Row.id

> **id**: `number`

###### Tables.telegram\_link\_telemetry\_events.Row.payload

> **payload**: [`Json`](#json) \| `null`

###### Tables.telegram\_link\_telemetry\_events.Row.phase

> **phase**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Row.privy\_user\_id

> **privy\_user\_id**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Row.source

> **source**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Row.status

> **status**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Row.telegram\_user\_id

> **telegram\_user\_id**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Update

> **Update**: `object`

###### Tables.telegram\_link\_telemetry\_events.Update.chat\_id?

> `optional` **chat\_id**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_link\_telemetry\_events.Update.event?

> `optional` **event**: `string`

###### Tables.telegram\_link\_telemetry\_events.Update.flow\_id?

> `optional` **flow\_id**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Update.id?

> `optional` **id**: `number`

###### Tables.telegram\_link\_telemetry\_events.Update.payload?

> `optional` **payload**: [`Json`](#json) \| `null`

###### Tables.telegram\_link\_telemetry\_events.Update.phase?

> `optional` **phase**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Update.privy\_user\_id?

> `optional` **privy\_user\_id**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Update.source?

> `optional` **source**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Update.status?

> `optional` **status**: `string` \| `null`

###### Tables.telegram\_link\_telemetry\_events.Update.telegram\_user\_id?

> `optional` **telegram\_user\_id**: `string` \| `null`

###### Tables.telegram\_miniapp\_replay\_nonces

> **telegram\_miniapp\_replay\_nonces**: `object`

###### Tables.telegram\_miniapp\_replay\_nonces.Insert

> **Insert**: `object`

###### Tables.telegram\_miniapp\_replay\_nonces.Insert.auth\_date

> **auth\_date**: `number`

###### Tables.telegram\_miniapp\_replay\_nonces.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_miniapp\_replay\_nonces.Insert.expires\_at

> **expires\_at**: `string`

###### Tables.telegram\_miniapp\_replay\_nonces.Insert.init\_data\_hash

> **init\_data\_hash**: `string`

###### Tables.telegram\_miniapp\_replay\_nonces.Insert.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_miniapp\_replay\_nonces.Relationships

> **Relationships**: \[\]

###### Tables.telegram\_miniapp\_replay\_nonces.Row

> **Row**: `object`

###### Tables.telegram\_miniapp\_replay\_nonces.Row.auth\_date

> **auth\_date**: `number`

###### Tables.telegram\_miniapp\_replay\_nonces.Row.created\_at

> **created\_at**: `string`

###### Tables.telegram\_miniapp\_replay\_nonces.Row.expires\_at

> **expires\_at**: `string`

###### Tables.telegram\_miniapp\_replay\_nonces.Row.init\_data\_hash

> **init\_data\_hash**: `string`

###### Tables.telegram\_miniapp\_replay\_nonces.Row.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_miniapp\_replay\_nonces.Update

> **Update**: `object`

###### Tables.telegram\_miniapp\_replay\_nonces.Update.auth\_date?

> `optional` **auth\_date**: `number`

###### Tables.telegram\_miniapp\_replay\_nonces.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_miniapp\_replay\_nonces.Update.expires\_at?

> `optional` **expires\_at**: `string`

###### Tables.telegram\_miniapp\_replay\_nonces.Update.init\_data\_hash?

> `optional` **init\_data\_hash**: `string`

###### Tables.telegram\_miniapp\_replay\_nonces.Update.telegram\_user\_id?

> `optional` **telegram\_user\_id**: `number`

###### Tables.telegram\_miniapp\_sessions

> **telegram\_miniapp\_sessions**: `object`

###### Tables.telegram\_miniapp\_sessions.Insert

> **Insert**: `object`

###### Tables.telegram\_miniapp\_sessions.Insert.auth\_date

> **auth\_date**: `number`

###### Tables.telegram\_miniapp\_sessions.Insert.chat\_id?

> `optional` **chat\_id**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Insert.chat\_instance?

> `optional` **chat\_instance**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Insert.chat\_type?

> `optional` **chat\_type**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_miniapp\_sessions.Insert.expires\_at

> **expires\_at**: `string`

###### Tables.telegram\_miniapp\_sessions.Insert.init\_data\_hash

> **init\_data\_hash**: `string`

###### Tables.telegram\_miniapp\_sessions.Insert.last\_used\_at?

> `optional` **last\_used\_at**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Insert.revoked\_at?

> `optional` **revoked\_at**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Insert.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_miniapp\_sessions.Insert.telegram\_username?

> `optional` **telegram\_username**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Insert.token\_hash

> **token\_hash**: `string`

###### Tables.telegram\_miniapp\_sessions.Relationships

> **Relationships**: \[\]

###### Tables.telegram\_miniapp\_sessions.Row

> **Row**: `object`

###### Tables.telegram\_miniapp\_sessions.Row.auth\_date

> **auth\_date**: `number`

###### Tables.telegram\_miniapp\_sessions.Row.chat\_id

> **chat\_id**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Row.chat\_instance

> **chat\_instance**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Row.chat\_type

> **chat\_type**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Row.created\_at

> **created\_at**: `string`

###### Tables.telegram\_miniapp\_sessions.Row.expires\_at

> **expires\_at**: `string`

###### Tables.telegram\_miniapp\_sessions.Row.init\_data\_hash

> **init\_data\_hash**: `string`

###### Tables.telegram\_miniapp\_sessions.Row.last\_used\_at

> **last\_used\_at**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Row.revoked\_at

> **revoked\_at**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Row.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_miniapp\_sessions.Row.telegram\_username

> **telegram\_username**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Row.token\_hash

> **token\_hash**: `string`

###### Tables.telegram\_miniapp\_sessions.Update

> **Update**: `object`

###### Tables.telegram\_miniapp\_sessions.Update.auth\_date?

> `optional` **auth\_date**: `number`

###### Tables.telegram\_miniapp\_sessions.Update.chat\_id?

> `optional` **chat\_id**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Update.chat\_instance?

> `optional` **chat\_instance**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Update.chat\_type?

> `optional` **chat\_type**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_miniapp\_sessions.Update.expires\_at?

> `optional` **expires\_at**: `string`

###### Tables.telegram\_miniapp\_sessions.Update.init\_data\_hash?

> `optional` **init\_data\_hash**: `string`

###### Tables.telegram\_miniapp\_sessions.Update.last\_used\_at?

> `optional` **last\_used\_at**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Update.revoked\_at?

> `optional` **revoked\_at**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Update.telegram\_user\_id?

> `optional` **telegram\_user\_id**: `number`

###### Tables.telegram\_miniapp\_sessions.Update.telegram\_username?

> `optional` **telegram\_username**: `string` \| `null`

###### Tables.telegram\_miniapp\_sessions.Update.token\_hash?

> `optional` **token\_hash**: `string`

###### Tables.telegram\_onboarding\_sessions

> **telegram\_onboarding\_sessions**: `object`

###### Tables.telegram\_onboarding\_sessions.Insert

> **Insert**: `object`

###### Tables.telegram\_onboarding\_sessions.Insert.expires\_at

> **expires\_at**: `string`

###### Tables.telegram\_onboarding\_sessions.Insert.step

> **step**: `string`

###### Tables.telegram\_onboarding\_sessions.Insert.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_onboarding\_sessions.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.telegram\_onboarding\_sessions.Relationships

> **Relationships**: \[\]

###### Tables.telegram\_onboarding\_sessions.Row

> **Row**: `object`

###### Tables.telegram\_onboarding\_sessions.Row.expires\_at

> **expires\_at**: `string`

###### Tables.telegram\_onboarding\_sessions.Row.step

> **step**: `string`

###### Tables.telegram\_onboarding\_sessions.Row.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_onboarding\_sessions.Row.updated\_at

> **updated\_at**: `string`

###### Tables.telegram\_onboarding\_sessions.Update

> **Update**: `object`

###### Tables.telegram\_onboarding\_sessions.Update.expires\_at?

> `optional` **expires\_at**: `string`

###### Tables.telegram\_onboarding\_sessions.Update.step?

> `optional` **step**: `string`

###### Tables.telegram\_onboarding\_sessions.Update.telegram\_user\_id?

> `optional` **telegram\_user\_id**: `number`

###### Tables.telegram\_onboarding\_sessions.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.telegram\_private\_dm\_welcome\_sent

> **telegram\_private\_dm\_welcome\_sent**: `object`

###### Tables.telegram\_private\_dm\_welcome\_sent.Insert

> **Insert**: `object`

###### Tables.telegram\_private\_dm\_welcome\_sent.Insert.sent\_at?

> `optional` **sent\_at**: `string`

###### Tables.telegram\_private\_dm\_welcome\_sent.Insert.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_private\_dm\_welcome\_sent.Relationships

> **Relationships**: \[\]

###### Tables.telegram\_private\_dm\_welcome\_sent.Row

> **Row**: `object`

###### Tables.telegram\_private\_dm\_welcome\_sent.Row.sent\_at

> **sent\_at**: `string`

###### Tables.telegram\_private\_dm\_welcome\_sent.Row.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_private\_dm\_welcome\_sent.Update

> **Update**: `object`

###### Tables.telegram\_private\_dm\_welcome\_sent.Update.sent\_at?

> `optional` **sent\_at**: `string`

###### Tables.telegram\_private\_dm\_welcome\_sent.Update.telegram\_user\_id?

> `optional` **telegram\_user\_id**: `number`

###### Tables.telegram\_trade\_percent\_prompts

> **telegram\_trade\_percent\_prompts**: `object`

###### Tables.telegram\_trade\_percent\_prompts.Insert

> **Insert**: `object`

###### Tables.telegram\_trade\_percent\_prompts.Insert.action\_type

> **action\_type**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Insert.chat\_id

> **chat\_id**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Insert.consumed\_at?

> `optional` **consumed\_at**: `string` \| `null`

###### Tables.telegram\_trade\_percent\_prompts.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Insert.expires\_at

> **expires\_at**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Insert.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_trade\_percent\_prompts.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Relationships

> **Relationships**: \[\]

###### Tables.telegram\_trade\_percent\_prompts.Row

> **Row**: `object`

###### Tables.telegram\_trade\_percent\_prompts.Row.action\_type

> **action\_type**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Row.chat\_id

> **chat\_id**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Row.consumed\_at

> **consumed\_at**: `string` \| `null`

###### Tables.telegram\_trade\_percent\_prompts.Row.created\_at

> **created\_at**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Row.expires\_at

> **expires\_at**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Row.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_trade\_percent\_prompts.Row.updated\_at

> **updated\_at**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Row.vault\_address

> **vault\_address**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Update

> **Update**: `object`

###### Tables.telegram\_trade\_percent\_prompts.Update.action\_type?

> `optional` **action\_type**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Update.chat\_id?

> `optional` **chat\_id**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Update.consumed\_at?

> `optional` **consumed\_at**: `string` \| `null`

###### Tables.telegram\_trade\_percent\_prompts.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Update.expires\_at?

> `optional` **expires\_at**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Update.telegram\_user\_id?

> `optional` **telegram\_user\_id**: `number`

###### Tables.telegram\_trade\_percent\_prompts.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.telegram\_trade\_percent\_prompts.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.telegram\_user\_links

> **telegram\_user\_links**: `object`

###### Tables.telegram\_user\_links.Insert

> **Insert**: `object`

###### Tables.telegram\_user\_links.Insert.canonical\_csw\_address?

> `optional` **canonical\_csw\_address**: `string` \| `null`

###### Tables.telegram\_user\_links.Insert.failure\_count?

> `optional` **failure\_count**: `number`

###### Tables.telegram\_user\_links.Insert.last\_failure\_reason?

> `optional` **last\_failure\_reason**: `string` \| `null`

###### Tables.telegram\_user\_links.Insert.last\_used\_at?

> `optional` **last\_used\_at**: `string` \| `null`

###### Tables.telegram\_user\_links.Insert.last\_verified\_at?

> `optional` **last\_verified\_at**: `string` \| `null`

###### Tables.telegram\_user\_links.Insert.link\_status?

> `optional` **link\_status**: `string`

###### Tables.telegram\_user\_links.Insert.linked\_at?

> `optional` **linked\_at**: `string`

###### Tables.telegram\_user\_links.Insert.owner\_verified?

> `optional` **owner\_verified**: `boolean`

###### Tables.telegram\_user\_links.Insert.privy\_user\_id

> **privy\_user\_id**: `string`

###### Tables.telegram\_user\_links.Insert.profile\_id

> **profile\_id**: `number`

###### Tables.telegram\_user\_links.Insert.revoked\_at?

> `optional` **revoked\_at**: `string` \| `null`

###### Tables.telegram\_user\_links.Insert.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_user\_links.Insert.telegram\_username?

> `optional` **telegram\_username**: `string` \| `null`

###### Tables.telegram\_user\_links.Insert.unlink\_requested\_at?

> `optional` **unlink\_requested\_at**: `string` \| `null`

###### Tables.telegram\_user\_links.Relationships

> **Relationships**: \[\]

###### Tables.telegram\_user\_links.Row

> **Row**: `object`

###### Tables.telegram\_user\_links.Row.canonical\_csw\_address

> **canonical\_csw\_address**: `string` \| `null`

###### Tables.telegram\_user\_links.Row.failure\_count

> **failure\_count**: `number`

###### Tables.telegram\_user\_links.Row.last\_failure\_reason

> **last\_failure\_reason**: `string` \| `null`

###### Tables.telegram\_user\_links.Row.last\_used\_at

> **last\_used\_at**: `string` \| `null`

###### Tables.telegram\_user\_links.Row.last\_verified\_at

> **last\_verified\_at**: `string` \| `null`

###### Tables.telegram\_user\_links.Row.link\_status

> **link\_status**: `string`

###### Tables.telegram\_user\_links.Row.linked\_at

> **linked\_at**: `string`

###### Tables.telegram\_user\_links.Row.owner\_verified

> **owner\_verified**: `boolean`

###### Tables.telegram\_user\_links.Row.privy\_user\_id

> **privy\_user\_id**: `string`

###### Tables.telegram\_user\_links.Row.profile\_id

> **profile\_id**: `number`

###### Tables.telegram\_user\_links.Row.revoked\_at

> **revoked\_at**: `string` \| `null`

###### Tables.telegram\_user\_links.Row.telegram\_user\_id

> **telegram\_user\_id**: `number`

###### Tables.telegram\_user\_links.Row.telegram\_username

> **telegram\_username**: `string` \| `null`

###### Tables.telegram\_user\_links.Row.unlink\_requested\_at

> **unlink\_requested\_at**: `string` \| `null`

###### Tables.telegram\_user\_links.Update

> **Update**: `object`

###### Tables.telegram\_user\_links.Update.canonical\_csw\_address?

> `optional` **canonical\_csw\_address**: `string` \| `null`

###### Tables.telegram\_user\_links.Update.failure\_count?

> `optional` **failure\_count**: `number`

###### Tables.telegram\_user\_links.Update.last\_failure\_reason?

> `optional` **last\_failure\_reason**: `string` \| `null`

###### Tables.telegram\_user\_links.Update.last\_used\_at?

> `optional` **last\_used\_at**: `string` \| `null`

###### Tables.telegram\_user\_links.Update.last\_verified\_at?

> `optional` **last\_verified\_at**: `string` \| `null`

###### Tables.telegram\_user\_links.Update.link\_status?

> `optional` **link\_status**: `string`

###### Tables.telegram\_user\_links.Update.linked\_at?

> `optional` **linked\_at**: `string`

###### Tables.telegram\_user\_links.Update.owner\_verified?

> `optional` **owner\_verified**: `boolean`

###### Tables.telegram\_user\_links.Update.privy\_user\_id?

> `optional` **privy\_user\_id**: `string`

###### Tables.telegram\_user\_links.Update.profile\_id?

> `optional` **profile\_id**: `number`

###### Tables.telegram\_user\_links.Update.revoked\_at?

> `optional` **revoked\_at**: `string` \| `null`

###### Tables.telegram\_user\_links.Update.telegram\_user\_id?

> `optional` **telegram\_user\_id**: `number`

###### Tables.telegram\_user\_links.Update.telegram\_username?

> `optional` **telegram\_username**: `string` \| `null`

###### Tables.telegram\_user\_links.Update.unlink\_requested\_at?

> `optional` **unlink\_requested\_at**: `string` \| `null`

###### Tables.vault\_chat\_memberships

> **vault\_chat\_memberships**: `object`

###### Tables.vault\_chat\_memberships.Insert

> **Insert**: `object`

###### Tables.vault\_chat\_memberships.Insert.add\_action\_id?

> `optional` **add\_action\_id**: `number` \| `null`

###### Tables.vault\_chat\_memberships.Insert.balance\_raw?

> `optional` **balance\_raw**: `number` \| `null`

###### Tables.vault\_chat\_memberships.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.vault\_chat\_memberships.Insert.failure\_reason?

> `optional` **failure\_reason**: `string` \| `null`

###### Tables.vault\_chat\_memberships.Insert.grace\_started\_at?

> `optional` **grace\_started\_at**: `string` \| `null`

###### Tables.vault\_chat\_memberships.Insert.last\_checked\_at?

> `optional` **last\_checked\_at**: `string` \| `null`

###### Tables.vault\_chat\_memberships.Insert.last\_eligible\_at?

> `optional` **last\_eligible\_at**: `string` \| `null`

###### Tables.vault\_chat\_memberships.Insert.metadata?

> `optional` **metadata**: [`Json`](#json)

###### Tables.vault\_chat\_memberships.Insert.profile\_id?

> `optional` **profile\_id**: `number` \| `null`

###### Tables.vault\_chat\_memberships.Insert.remove\_action\_id?

> `optional` **remove\_action\_id**: `number` \| `null`

###### Tables.vault\_chat\_memberships.Insert.status?

> `optional` **status**: `string`

###### Tables.vault\_chat\_memberships.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.vault\_chat\_memberships.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.vault\_chat\_memberships.Insert.wallet\_address

> **wallet\_address**: `string`

###### Tables.vault\_chat\_memberships.Insert.xmtp\_inbox\_id?

> `optional` **xmtp\_inbox\_id**: `string` \| `null`

###### Tables.vault\_chat\_memberships.Relationships

> **Relationships**: \[\]

###### Tables.vault\_chat\_memberships.Row

> **Row**: `object`

###### Tables.vault\_chat\_memberships.Row.add\_action\_id

> **add\_action\_id**: `number` \| `null`

###### Tables.vault\_chat\_memberships.Row.balance\_raw

> **balance\_raw**: `number` \| `null`

###### Tables.vault\_chat\_memberships.Row.created\_at

> **created\_at**: `string`

###### Tables.vault\_chat\_memberships.Row.failure\_reason

> **failure\_reason**: `string` \| `null`

###### Tables.vault\_chat\_memberships.Row.grace\_started\_at

> **grace\_started\_at**: `string` \| `null`

###### Tables.vault\_chat\_memberships.Row.last\_checked\_at

> **last\_checked\_at**: `string` \| `null`

###### Tables.vault\_chat\_memberships.Row.last\_eligible\_at

> **last\_eligible\_at**: `string` \| `null`

###### Tables.vault\_chat\_memberships.Row.metadata

> **metadata**: [`Json`](#json)

###### Tables.vault\_chat\_memberships.Row.profile\_id

> **profile\_id**: `number` \| `null`

###### Tables.vault\_chat\_memberships.Row.remove\_action\_id

> **remove\_action\_id**: `number` \| `null`

###### Tables.vault\_chat\_memberships.Row.status

> **status**: `string`

###### Tables.vault\_chat\_memberships.Row.updated\_at

> **updated\_at**: `string`

###### Tables.vault\_chat\_memberships.Row.vault\_address

> **vault\_address**: `string`

###### Tables.vault\_chat\_memberships.Row.wallet\_address

> **wallet\_address**: `string`

###### Tables.vault\_chat\_memberships.Row.xmtp\_inbox\_id

> **xmtp\_inbox\_id**: `string` \| `null`

###### Tables.vault\_chat\_memberships.Update

> **Update**: `object`

###### Tables.vault\_chat\_memberships.Update.add\_action\_id?

> `optional` **add\_action\_id**: `number` \| `null`

###### Tables.vault\_chat\_memberships.Update.balance\_raw?

> `optional` **balance\_raw**: `number` \| `null`

###### Tables.vault\_chat\_memberships.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.vault\_chat\_memberships.Update.failure\_reason?

> `optional` **failure\_reason**: `string` \| `null`

###### Tables.vault\_chat\_memberships.Update.grace\_started\_at?

> `optional` **grace\_started\_at**: `string` \| `null`

###### Tables.vault\_chat\_memberships.Update.last\_checked\_at?

> `optional` **last\_checked\_at**: `string` \| `null`

###### Tables.vault\_chat\_memberships.Update.last\_eligible\_at?

> `optional` **last\_eligible\_at**: `string` \| `null`

###### Tables.vault\_chat\_memberships.Update.metadata?

> `optional` **metadata**: [`Json`](#json)

###### Tables.vault\_chat\_memberships.Update.profile\_id?

> `optional` **profile\_id**: `number` \| `null`

###### Tables.vault\_chat\_memberships.Update.remove\_action\_id?

> `optional` **remove\_action\_id**: `number` \| `null`

###### Tables.vault\_chat\_memberships.Update.status?

> `optional` **status**: `string`

###### Tables.vault\_chat\_memberships.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.vault\_chat\_memberships.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.vault\_chat\_memberships.Update.wallet\_address?

> `optional` **wallet\_address**: `string`

###### Tables.vault\_chat\_memberships.Update.xmtp\_inbox\_id?

> `optional` **xmtp\_inbox\_id**: `string` \| `null`

###### Tables.vault\_chat\_policies

> **vault\_chat\_policies**: `object`

###### Tables.vault\_chat\_policies.Insert

> **Insert**: `object`

###### Tables.vault\_chat\_policies.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.vault\_chat\_policies.Insert.created\_by?

> `optional` **created\_by**: `string` \| `null`

###### Tables.vault\_chat\_policies.Insert.creator\_address?

> `optional` **creator\_address**: `string` \| `null`

###### Tables.vault\_chat\_policies.Insert.enabled?

> `optional` **enabled**: `boolean`

###### Tables.vault\_chat\_policies.Insert.grace\_hours?

> `optional` **grace\_hours**: `number`

###### Tables.vault\_chat\_policies.Insert.group\_id?

> `optional` **group\_id**: `string` \| `null`

###### Tables.vault\_chat\_policies.Insert.metadata?

> `optional` **metadata**: [`Json`](#json)

###### Tables.vault\_chat\_policies.Insert.min\_holding\_raw?

> `optional` **min\_holding\_raw**: `number`

###### Tables.vault\_chat\_policies.Insert.share\_token\_address?

> `optional` **share\_token\_address**: `string` \| `null`

###### Tables.vault\_chat\_policies.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.vault\_chat\_policies.Insert.updated\_by?

> `optional` **updated\_by**: `string` \| `null`

###### Tables.vault\_chat\_policies.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.vault\_chat\_policies.Relationships

> **Relationships**: \[\]

###### Tables.vault\_chat\_policies.Row

> **Row**: `object`

###### Tables.vault\_chat\_policies.Row.created\_at

> **created\_at**: `string`

###### Tables.vault\_chat\_policies.Row.created\_by

> **created\_by**: `string` \| `null`

###### Tables.vault\_chat\_policies.Row.creator\_address

> **creator\_address**: `string` \| `null`

###### Tables.vault\_chat\_policies.Row.enabled

> **enabled**: `boolean`

###### Tables.vault\_chat\_policies.Row.grace\_hours

> **grace\_hours**: `number`

###### Tables.vault\_chat\_policies.Row.group\_id

> **group\_id**: `string` \| `null`

###### Tables.vault\_chat\_policies.Row.metadata

> **metadata**: [`Json`](#json)

###### Tables.vault\_chat\_policies.Row.min\_holding\_raw

> **min\_holding\_raw**: `number`

###### Tables.vault\_chat\_policies.Row.share\_token\_address

> **share\_token\_address**: `string` \| `null`

###### Tables.vault\_chat\_policies.Row.updated\_at

> **updated\_at**: `string`

###### Tables.vault\_chat\_policies.Row.updated\_by

> **updated\_by**: `string` \| `null`

###### Tables.vault\_chat\_policies.Row.vault\_address

> **vault\_address**: `string`

###### Tables.vault\_chat\_policies.Update

> **Update**: `object`

###### Tables.vault\_chat\_policies.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.vault\_chat\_policies.Update.created\_by?

> `optional` **created\_by**: `string` \| `null`

###### Tables.vault\_chat\_policies.Update.creator\_address?

> `optional` **creator\_address**: `string` \| `null`

###### Tables.vault\_chat\_policies.Update.enabled?

> `optional` **enabled**: `boolean`

###### Tables.vault\_chat\_policies.Update.grace\_hours?

> `optional` **grace\_hours**: `number`

###### Tables.vault\_chat\_policies.Update.group\_id?

> `optional` **group\_id**: `string` \| `null`

###### Tables.vault\_chat\_policies.Update.metadata?

> `optional` **metadata**: [`Json`](#json)

###### Tables.vault\_chat\_policies.Update.min\_holding\_raw?

> `optional` **min\_holding\_raw**: `number`

###### Tables.vault\_chat\_policies.Update.share\_token\_address?

> `optional` **share\_token\_address**: `string` \| `null`

###### Tables.vault\_chat\_policies.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.vault\_chat\_policies.Update.updated\_by?

> `optional` **updated\_by**: `string` \| `null`

###### Tables.vault\_chat\_policies.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.wallet\_intelligence\_cache

> **wallet\_intelligence\_cache**: `object`

###### Tables.wallet\_intelligence\_cache.Insert

> **Insert**: `object`

###### Tables.wallet\_intelligence\_cache.Insert.address

> **address**: `string`

###### Tables.wallet\_intelligence\_cache.Insert.chain\_ids?

> `optional` **chain\_ids**: `string`

###### Tables.wallet\_intelligence\_cache.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.wallet\_intelligence\_cache.Insert.expires\_at?

> `optional` **expires\_at**: `string`

###### Tables.wallet\_intelligence\_cache.Insert.graph

> **graph**: [`Json`](#json)

###### Tables.wallet\_intelligence\_cache.Insert.grove\_uri?

> `optional` **grove\_uri**: `string` \| `null`

###### Tables.wallet\_intelligence\_cache.Insert.hops?

> `optional` **hops**: `number`

###### Tables.wallet\_intelligence\_cache.Relationships

> **Relationships**: \[\]

###### Tables.wallet\_intelligence\_cache.Row

> **Row**: `object`

###### Tables.wallet\_intelligence\_cache.Row.address

> **address**: `string`

###### Tables.wallet\_intelligence\_cache.Row.chain\_ids

> **chain\_ids**: `string`

###### Tables.wallet\_intelligence\_cache.Row.created\_at

> **created\_at**: `string`

###### Tables.wallet\_intelligence\_cache.Row.expires\_at

> **expires\_at**: `string`

###### Tables.wallet\_intelligence\_cache.Row.graph

> **graph**: [`Json`](#json)

###### Tables.wallet\_intelligence\_cache.Row.grove\_uri

> **grove\_uri**: `string` \| `null`

###### Tables.wallet\_intelligence\_cache.Row.hops

> **hops**: `number`

###### Tables.wallet\_intelligence\_cache.Update

> **Update**: `object`

###### Tables.wallet\_intelligence\_cache.Update.address?

> `optional` **address**: `string`

###### Tables.wallet\_intelligence\_cache.Update.chain\_ids?

> `optional` **chain\_ids**: `string`

###### Tables.wallet\_intelligence\_cache.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.wallet\_intelligence\_cache.Update.expires\_at?

> `optional` **expires\_at**: `string`

###### Tables.wallet\_intelligence\_cache.Update.graph?

> `optional` **graph**: [`Json`](#json)

###### Tables.wallet\_intelligence\_cache.Update.grove\_uri?

> `optional` **grove\_uri**: `string` \| `null`

###### Tables.wallet\_intelligence\_cache.Update.hops?

> `optional` **hops**: `number`

###### Tables.wallets

> **wallets**: `object`

###### Tables.wallets.Insert

> **Insert**: `object`

###### Tables.wallets.Insert.address

> **address**: `string`

###### Tables.wallets.Insert.chain?

> `optional` **chain**: `string`

###### Tables.wallets.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.wallets.Insert.provider?

> `optional` **provider**: `string`

###### Tables.wallets.Insert.wallet\_type

> **wallet\_type**: `string`

###### Tables.wallets.Relationships

> **Relationships**: \[\]

###### Tables.wallets.Row

> **Row**: `object`

###### Tables.wallets.Row.address

> **address**: `string`

###### Tables.wallets.Row.chain

> **chain**: `string`

###### Tables.wallets.Row.created\_at

> **created\_at**: `string`

###### Tables.wallets.Row.provider

> **provider**: `string`

###### Tables.wallets.Row.wallet\_type

> **wallet\_type**: `string`

###### Tables.wallets.Update

> **Update**: `object`

###### Tables.wallets.Update.address?

> `optional` **address**: `string`

###### Tables.wallets.Update.chain?

> `optional` **chain**: `string`

###### Tables.wallets.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.wallets.Update.provider?

> `optional` **provider**: `string`

###### Tables.wallets.Update.wallet\_type?

> `optional` **wallet\_type**: `string`

###### Tables.workspace\_activity\_events

> **workspace\_activity\_events**: `object`

###### Tables.workspace\_activity\_events.Insert

> **Insert**: `object`

###### Tables.workspace\_activity\_events.Insert.actor\_address?

> `optional` **actor\_address**: `string` \| `null`

###### Tables.workspace\_activity\_events.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.workspace\_activity\_events.Insert.description?

> `optional` **description**: `string` \| `null`

###### Tables.workspace\_activity\_events.Insert.event\_type

> **event\_type**: `string`

###### Tables.workspace\_activity\_events.Insert.id?

> `optional` **id**: `number`

###### Tables.workspace\_activity\_events.Insert.payload\_json?

> `optional` **payload\_json**: [`Json`](#json)

###### Tables.workspace\_activity\_events.Insert.related\_alert\_id?

> `optional` **related\_alert\_id**: `number` \| `null`

###### Tables.workspace\_activity\_events.Insert.related\_approval\_id?

> `optional` **related\_approval\_id**: `number` \| `null`

###### Tables.workspace\_activity\_events.Insert.related\_task\_id?

> `optional` **related\_task\_id**: `number` \| `null`

###### Tables.workspace\_activity\_events.Insert.severity?

> `optional` **severity**: `string`

###### Tables.workspace\_activity\_events.Insert.source?

> `optional` **source**: `string`

###### Tables.workspace\_activity\_events.Insert.title

> **title**: `string`

###### Tables.workspace\_activity\_events.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.workspace\_activity\_events.Relationships

> **Relationships**: \[\]

###### Tables.workspace\_activity\_events.Row

> **Row**: `object`

###### Tables.workspace\_activity\_events.Row.actor\_address

> **actor\_address**: `string` \| `null`

###### Tables.workspace\_activity\_events.Row.created\_at

> **created\_at**: `string`

###### Tables.workspace\_activity\_events.Row.description

> **description**: `string` \| `null`

###### Tables.workspace\_activity\_events.Row.event\_type

> **event\_type**: `string`

###### Tables.workspace\_activity\_events.Row.id

> **id**: `number`

###### Tables.workspace\_activity\_events.Row.payload\_json

> **payload\_json**: [`Json`](#json)

###### Tables.workspace\_activity\_events.Row.related\_alert\_id

> **related\_alert\_id**: `number` \| `null`

###### Tables.workspace\_activity\_events.Row.related\_approval\_id

> **related\_approval\_id**: `number` \| `null`

###### Tables.workspace\_activity\_events.Row.related\_task\_id

> **related\_task\_id**: `number` \| `null`

###### Tables.workspace\_activity\_events.Row.severity

> **severity**: `string`

###### Tables.workspace\_activity\_events.Row.source

> **source**: `string`

###### Tables.workspace\_activity\_events.Row.title

> **title**: `string`

###### Tables.workspace\_activity\_events.Row.vault\_address

> **vault\_address**: `string`

###### Tables.workspace\_activity\_events.Update

> **Update**: `object`

###### Tables.workspace\_activity\_events.Update.actor\_address?

> `optional` **actor\_address**: `string` \| `null`

###### Tables.workspace\_activity\_events.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.workspace\_activity\_events.Update.description?

> `optional` **description**: `string` \| `null`

###### Tables.workspace\_activity\_events.Update.event\_type?

> `optional` **event\_type**: `string`

###### Tables.workspace\_activity\_events.Update.id?

> `optional` **id**: `number`

###### Tables.workspace\_activity\_events.Update.payload\_json?

> `optional` **payload\_json**: [`Json`](#json)

###### Tables.workspace\_activity\_events.Update.related\_alert\_id?

> `optional` **related\_alert\_id**: `number` \| `null`

###### Tables.workspace\_activity\_events.Update.related\_approval\_id?

> `optional` **related\_approval\_id**: `number` \| `null`

###### Tables.workspace\_activity\_events.Update.related\_task\_id?

> `optional` **related\_task\_id**: `number` \| `null`

###### Tables.workspace\_activity\_events.Update.severity?

> `optional` **severity**: `string`

###### Tables.workspace\_activity\_events.Update.source?

> `optional` **source**: `string`

###### Tables.workspace\_activity\_events.Update.title?

> `optional` **title**: `string`

###### Tables.workspace\_activity\_events.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.workspace\_alert\_events

> **workspace\_alert\_events**: `object`

###### Tables.workspace\_alert\_events.Insert

> **Insert**: `object`

###### Tables.workspace\_alert\_events.Insert.acknowledged\_at?

> `optional` **acknowledged\_at**: `string` \| `null`

###### Tables.workspace\_alert\_events.Insert.acknowledged\_by?

> `optional` **acknowledged\_by**: `string` \| `null`

###### Tables.workspace\_alert\_events.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.workspace\_alert\_events.Insert.created\_by?

> `optional` **created\_by**: `string` \| `null`

###### Tables.workspace\_alert\_events.Insert.dedupe\_key?

> `optional` **dedupe\_key**: `string` \| `null`

###### Tables.workspace\_alert\_events.Insert.details\_json?

> `optional` **details\_json**: [`Json`](#json)

###### Tables.workspace\_alert\_events.Insert.id?

> `optional` **id**: `number`

###### Tables.workspace\_alert\_events.Insert.kind

> **kind**: `string`

###### Tables.workspace\_alert\_events.Insert.message?

> `optional` **message**: `string` \| `null`

###### Tables.workspace\_alert\_events.Insert.related\_task\_id?

> `optional` **related\_task\_id**: `number` \| `null`

###### Tables.workspace\_alert\_events.Insert.resolved\_at?

> `optional` **resolved\_at**: `string` \| `null`

###### Tables.workspace\_alert\_events.Insert.resolved\_by?

> `optional` **resolved\_by**: `string` \| `null`

###### Tables.workspace\_alert\_events.Insert.severity?

> `optional` **severity**: `string`

###### Tables.workspace\_alert\_events.Insert.source

> **source**: `string`

###### Tables.workspace\_alert\_events.Insert.status?

> `optional` **status**: `string`

###### Tables.workspace\_alert\_events.Insert.title

> **title**: `string`

###### Tables.workspace\_alert\_events.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.workspace\_alert\_events.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.workspace\_alert\_events.Relationships

> **Relationships**: \[\]

###### Tables.workspace\_alert\_events.Row

> **Row**: `object`

###### Tables.workspace\_alert\_events.Row.acknowledged\_at

> **acknowledged\_at**: `string` \| `null`

###### Tables.workspace\_alert\_events.Row.acknowledged\_by

> **acknowledged\_by**: `string` \| `null`

###### Tables.workspace\_alert\_events.Row.created\_at

> **created\_at**: `string`

###### Tables.workspace\_alert\_events.Row.created\_by

> **created\_by**: `string` \| `null`

###### Tables.workspace\_alert\_events.Row.dedupe\_key

> **dedupe\_key**: `string` \| `null`

###### Tables.workspace\_alert\_events.Row.details\_json

> **details\_json**: [`Json`](#json)

###### Tables.workspace\_alert\_events.Row.id

> **id**: `number`

###### Tables.workspace\_alert\_events.Row.kind

> **kind**: `string`

###### Tables.workspace\_alert\_events.Row.message

> **message**: `string` \| `null`

###### Tables.workspace\_alert\_events.Row.related\_task\_id

> **related\_task\_id**: `number` \| `null`

###### Tables.workspace\_alert\_events.Row.resolved\_at

> **resolved\_at**: `string` \| `null`

###### Tables.workspace\_alert\_events.Row.resolved\_by

> **resolved\_by**: `string` \| `null`

###### Tables.workspace\_alert\_events.Row.severity

> **severity**: `string`

###### Tables.workspace\_alert\_events.Row.source

> **source**: `string`

###### Tables.workspace\_alert\_events.Row.status

> **status**: `string`

###### Tables.workspace\_alert\_events.Row.title

> **title**: `string`

###### Tables.workspace\_alert\_events.Row.updated\_at

> **updated\_at**: `string`

###### Tables.workspace\_alert\_events.Row.vault\_address

> **vault\_address**: `string`

###### Tables.workspace\_alert\_events.Update

> **Update**: `object`

###### Tables.workspace\_alert\_events.Update.acknowledged\_at?

> `optional` **acknowledged\_at**: `string` \| `null`

###### Tables.workspace\_alert\_events.Update.acknowledged\_by?

> `optional` **acknowledged\_by**: `string` \| `null`

###### Tables.workspace\_alert\_events.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.workspace\_alert\_events.Update.created\_by?

> `optional` **created\_by**: `string` \| `null`

###### Tables.workspace\_alert\_events.Update.dedupe\_key?

> `optional` **dedupe\_key**: `string` \| `null`

###### Tables.workspace\_alert\_events.Update.details\_json?

> `optional` **details\_json**: [`Json`](#json)

###### Tables.workspace\_alert\_events.Update.id?

> `optional` **id**: `number`

###### Tables.workspace\_alert\_events.Update.kind?

> `optional` **kind**: `string`

###### Tables.workspace\_alert\_events.Update.message?

> `optional` **message**: `string` \| `null`

###### Tables.workspace\_alert\_events.Update.related\_task\_id?

> `optional` **related\_task\_id**: `number` \| `null`

###### Tables.workspace\_alert\_events.Update.resolved\_at?

> `optional` **resolved\_at**: `string` \| `null`

###### Tables.workspace\_alert\_events.Update.resolved\_by?

> `optional` **resolved\_by**: `string` \| `null`

###### Tables.workspace\_alert\_events.Update.severity?

> `optional` **severity**: `string`

###### Tables.workspace\_alert\_events.Update.source?

> `optional` **source**: `string`

###### Tables.workspace\_alert\_events.Update.status?

> `optional` **status**: `string`

###### Tables.workspace\_alert\_events.Update.title?

> `optional` **title**: `string`

###### Tables.workspace\_alert\_events.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.workspace\_alert\_events.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.workspace\_approvals

> **workspace\_approvals**: `object`

###### Tables.workspace\_approvals.Insert

> **Insert**: `object`

###### Tables.workspace\_approvals.Insert.action\_type

> **action\_type**: `string`

###### Tables.workspace\_approvals.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.workspace\_approvals.Insert.deadline\_at?

> `optional` **deadline\_at**: `string` \| `null`

###### Tables.workspace\_approvals.Insert.decided\_at?

> `optional` **decided\_at**: `string` \| `null`

###### Tables.workspace\_approvals.Insert.decided\_by?

> `optional` **decided\_by**: `string` \| `null`

###### Tables.workspace\_approvals.Insert.decision\_reason?

> `optional` **decision\_reason**: `string` \| `null`

###### Tables.workspace\_approvals.Insert.id?

> `optional` **id**: `number`

###### Tables.workspace\_approvals.Insert.linked\_task\_id?

> `optional` **linked\_task\_id**: `number` \| `null`

###### Tables.workspace\_approvals.Insert.payload\_json?

> `optional` **payload\_json**: [`Json`](#json)

###### Tables.workspace\_approvals.Insert.requested\_by?

> `optional` **requested\_by**: `string` \| `null`

###### Tables.workspace\_approvals.Insert.severity?

> `optional` **severity**: `string`

###### Tables.workspace\_approvals.Insert.signer\_address?

> `optional` **signer\_address**: `string` \| `null`

###### Tables.workspace\_approvals.Insert.source?

> `optional` **source**: `string`

###### Tables.workspace\_approvals.Insert.status?

> `optional` **status**: `string`

###### Tables.workspace\_approvals.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.workspace\_approvals.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.workspace\_approvals.Relationships

> **Relationships**: \[\]

###### Tables.workspace\_approvals.Row

> **Row**: `object`

###### Tables.workspace\_approvals.Row.action\_type

> **action\_type**: `string`

###### Tables.workspace\_approvals.Row.created\_at

> **created\_at**: `string`

###### Tables.workspace\_approvals.Row.deadline\_at

> **deadline\_at**: `string` \| `null`

###### Tables.workspace\_approvals.Row.decided\_at

> **decided\_at**: `string` \| `null`

###### Tables.workspace\_approvals.Row.decided\_by

> **decided\_by**: `string` \| `null`

###### Tables.workspace\_approvals.Row.decision\_reason

> **decision\_reason**: `string` \| `null`

###### Tables.workspace\_approvals.Row.id

> **id**: `number`

###### Tables.workspace\_approvals.Row.linked\_task\_id

> **linked\_task\_id**: `number` \| `null`

###### Tables.workspace\_approvals.Row.payload\_json

> **payload\_json**: [`Json`](#json)

###### Tables.workspace\_approvals.Row.requested\_by

> **requested\_by**: `string` \| `null`

###### Tables.workspace\_approvals.Row.severity

> **severity**: `string`

###### Tables.workspace\_approvals.Row.signer\_address

> **signer\_address**: `string` \| `null`

###### Tables.workspace\_approvals.Row.source

> **source**: `string`

###### Tables.workspace\_approvals.Row.status

> **status**: `string`

###### Tables.workspace\_approvals.Row.updated\_at

> **updated\_at**: `string`

###### Tables.workspace\_approvals.Row.vault\_address

> **vault\_address**: `string`

###### Tables.workspace\_approvals.Update

> **Update**: `object`

###### Tables.workspace\_approvals.Update.action\_type?

> `optional` **action\_type**: `string`

###### Tables.workspace\_approvals.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.workspace\_approvals.Update.deadline\_at?

> `optional` **deadline\_at**: `string` \| `null`

###### Tables.workspace\_approvals.Update.decided\_at?

> `optional` **decided\_at**: `string` \| `null`

###### Tables.workspace\_approvals.Update.decided\_by?

> `optional` **decided\_by**: `string` \| `null`

###### Tables.workspace\_approvals.Update.decision\_reason?

> `optional` **decision\_reason**: `string` \| `null`

###### Tables.workspace\_approvals.Update.id?

> `optional` **id**: `number`

###### Tables.workspace\_approvals.Update.linked\_task\_id?

> `optional` **linked\_task\_id**: `number` \| `null`

###### Tables.workspace\_approvals.Update.payload\_json?

> `optional` **payload\_json**: [`Json`](#json)

###### Tables.workspace\_approvals.Update.requested\_by?

> `optional` **requested\_by**: `string` \| `null`

###### Tables.workspace\_approvals.Update.severity?

> `optional` **severity**: `string`

###### Tables.workspace\_approvals.Update.signer\_address?

> `optional` **signer\_address**: `string` \| `null`

###### Tables.workspace\_approvals.Update.source?

> `optional` **source**: `string`

###### Tables.workspace\_approvals.Update.status?

> `optional` **status**: `string`

###### Tables.workspace\_approvals.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.workspace\_approvals.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.workspace\_audit\_logs

> **workspace\_audit\_logs**: `object`

###### Tables.workspace\_audit\_logs.Insert

> **Insert**: `object`

###### Tables.workspace\_audit\_logs.Insert.action

> **action**: `string`

###### Tables.workspace\_audit\_logs.Insert.actor\_address?

> `optional` **actor\_address**: `string` \| `null`

###### Tables.workspace\_audit\_logs.Insert.actor\_role?

> `optional` **actor\_role**: `string` \| `null`

###### Tables.workspace\_audit\_logs.Insert.after\_json?

> `optional` **after\_json**: [`Json`](#json) \| `null`

###### Tables.workspace\_audit\_logs.Insert.before\_json?

> `optional` **before\_json**: [`Json`](#json) \| `null`

###### Tables.workspace\_audit\_logs.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.workspace\_audit\_logs.Insert.details\_json?

> `optional` **details\_json**: [`Json`](#json)

###### Tables.workspace\_audit\_logs.Insert.id?

> `optional` **id**: `number`

###### Tables.workspace\_audit\_logs.Insert.source

> **source**: `string`

###### Tables.workspace\_audit\_logs.Insert.target\_id?

> `optional` **target\_id**: `string` \| `null`

###### Tables.workspace\_audit\_logs.Insert.target\_type?

> `optional` **target\_type**: `string` \| `null`

###### Tables.workspace\_audit\_logs.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.workspace\_audit\_logs.Relationships

> **Relationships**: \[\]

###### Tables.workspace\_audit\_logs.Row

> **Row**: `object`

###### Tables.workspace\_audit\_logs.Row.action

> **action**: `string`

###### Tables.workspace\_audit\_logs.Row.actor\_address

> **actor\_address**: `string` \| `null`

###### Tables.workspace\_audit\_logs.Row.actor\_role

> **actor\_role**: `string` \| `null`

###### Tables.workspace\_audit\_logs.Row.after\_json

> **after\_json**: [`Json`](#json) \| `null`

###### Tables.workspace\_audit\_logs.Row.before\_json

> **before\_json**: [`Json`](#json) \| `null`

###### Tables.workspace\_audit\_logs.Row.created\_at

> **created\_at**: `string`

###### Tables.workspace\_audit\_logs.Row.details\_json

> **details\_json**: [`Json`](#json)

###### Tables.workspace\_audit\_logs.Row.id

> **id**: `number`

###### Tables.workspace\_audit\_logs.Row.source

> **source**: `string`

###### Tables.workspace\_audit\_logs.Row.target\_id

> **target\_id**: `string` \| `null`

###### Tables.workspace\_audit\_logs.Row.target\_type

> **target\_type**: `string` \| `null`

###### Tables.workspace\_audit\_logs.Row.vault\_address

> **vault\_address**: `string`

###### Tables.workspace\_audit\_logs.Update

> **Update**: `object`

###### Tables.workspace\_audit\_logs.Update.action?

> `optional` **action**: `string`

###### Tables.workspace\_audit\_logs.Update.actor\_address?

> `optional` **actor\_address**: `string` \| `null`

###### Tables.workspace\_audit\_logs.Update.actor\_role?

> `optional` **actor\_role**: `string` \| `null`

###### Tables.workspace\_audit\_logs.Update.after\_json?

> `optional` **after\_json**: [`Json`](#json) \| `null`

###### Tables.workspace\_audit\_logs.Update.before\_json?

> `optional` **before\_json**: [`Json`](#json) \| `null`

###### Tables.workspace\_audit\_logs.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.workspace\_audit\_logs.Update.details\_json?

> `optional` **details\_json**: [`Json`](#json)

###### Tables.workspace\_audit\_logs.Update.id?

> `optional` **id**: `number`

###### Tables.workspace\_audit\_logs.Update.source?

> `optional` **source**: `string`

###### Tables.workspace\_audit\_logs.Update.target\_id?

> `optional` **target\_id**: `string` \| `null`

###### Tables.workspace\_audit\_logs.Update.target\_type?

> `optional` **target\_type**: `string` \| `null`

###### Tables.workspace\_audit\_logs.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.workspace\_monitoring\_snapshots

> **workspace\_monitoring\_snapshots**: `object`

###### Tables.workspace\_monitoring\_snapshots.Insert

> **Insert**: `object`

###### Tables.workspace\_monitoring\_snapshots.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.workspace\_monitoring\_snapshots.Insert.id?

> `optional` **id**: `number`

###### Tables.workspace\_monitoring\_snapshots.Insert.payload\_json

> **payload\_json**: [`Json`](#json)

###### Tables.workspace\_monitoring\_snapshots.Insert.snapshot\_kind?

> `optional` **snapshot\_kind**: `string`

###### Tables.workspace\_monitoring\_snapshots.Insert.source?

> `optional` **source**: `string`

###### Tables.workspace\_monitoring\_snapshots.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.workspace\_monitoring\_snapshots.Relationships

> **Relationships**: \[\]

###### Tables.workspace\_monitoring\_snapshots.Row

> **Row**: `object`

###### Tables.workspace\_monitoring\_snapshots.Row.created\_at

> **created\_at**: `string`

###### Tables.workspace\_monitoring\_snapshots.Row.id

> **id**: `number`

###### Tables.workspace\_monitoring\_snapshots.Row.payload\_json

> **payload\_json**: [`Json`](#json)

###### Tables.workspace\_monitoring\_snapshots.Row.snapshot\_kind

> **snapshot\_kind**: `string`

###### Tables.workspace\_monitoring\_snapshots.Row.source

> **source**: `string`

###### Tables.workspace\_monitoring\_snapshots.Row.vault\_address

> **vault\_address**: `string`

###### Tables.workspace\_monitoring\_snapshots.Update

> **Update**: `object`

###### Tables.workspace\_monitoring\_snapshots.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.workspace\_monitoring\_snapshots.Update.id?

> `optional` **id**: `number`

###### Tables.workspace\_monitoring\_snapshots.Update.payload\_json?

> `optional` **payload\_json**: [`Json`](#json)

###### Tables.workspace\_monitoring\_snapshots.Update.snapshot\_kind?

> `optional` **snapshot\_kind**: `string`

###### Tables.workspace\_monitoring\_snapshots.Update.source?

> `optional` **source**: `string`

###### Tables.workspace\_monitoring\_snapshots.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.workspace\_notification\_preferences

> **workspace\_notification\_preferences**: `object`

###### Tables.workspace\_notification\_preferences.Insert

> **Insert**: `object`

###### Tables.workspace\_notification\_preferences.Insert.channels\_json?

> `optional` **channels\_json**: [`Json`](#json)

###### Tables.workspace\_notification\_preferences.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.workspace\_notification\_preferences.Insert.email\_enabled?

> `optional` **email\_enabled**: `boolean`

###### Tables.workspace\_notification\_preferences.Insert.min\_severity?

> `optional` **min\_severity**: `string`

###### Tables.workspace\_notification\_preferences.Insert.principal\_address

> **principal\_address**: `string`

###### Tables.workspace\_notification\_preferences.Insert.telegram\_enabled?

> `optional` **telegram\_enabled**: `boolean`

###### Tables.workspace\_notification\_preferences.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.workspace\_notification\_preferences.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.workspace\_notification\_preferences.Insert.xmtp\_enabled?

> `optional` **xmtp\_enabled**: `boolean`

###### Tables.workspace\_notification\_preferences.Relationships

> **Relationships**: \[\]

###### Tables.workspace\_notification\_preferences.Row

> **Row**: `object`

###### Tables.workspace\_notification\_preferences.Row.channels\_json

> **channels\_json**: [`Json`](#json)

###### Tables.workspace\_notification\_preferences.Row.created\_at

> **created\_at**: `string`

###### Tables.workspace\_notification\_preferences.Row.email\_enabled

> **email\_enabled**: `boolean`

###### Tables.workspace\_notification\_preferences.Row.min\_severity

> **min\_severity**: `string`

###### Tables.workspace\_notification\_preferences.Row.principal\_address

> **principal\_address**: `string`

###### Tables.workspace\_notification\_preferences.Row.telegram\_enabled

> **telegram\_enabled**: `boolean`

###### Tables.workspace\_notification\_preferences.Row.updated\_at

> **updated\_at**: `string`

###### Tables.workspace\_notification\_preferences.Row.vault\_address

> **vault\_address**: `string`

###### Tables.workspace\_notification\_preferences.Row.xmtp\_enabled

> **xmtp\_enabled**: `boolean`

###### Tables.workspace\_notification\_preferences.Update

> **Update**: `object`

###### Tables.workspace\_notification\_preferences.Update.channels\_json?

> `optional` **channels\_json**: [`Json`](#json)

###### Tables.workspace\_notification\_preferences.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.workspace\_notification\_preferences.Update.email\_enabled?

> `optional` **email\_enabled**: `boolean`

###### Tables.workspace\_notification\_preferences.Update.min\_severity?

> `optional` **min\_severity**: `string`

###### Tables.workspace\_notification\_preferences.Update.principal\_address?

> `optional` **principal\_address**: `string`

###### Tables.workspace\_notification\_preferences.Update.telegram\_enabled?

> `optional` **telegram\_enabled**: `boolean`

###### Tables.workspace\_notification\_preferences.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.workspace\_notification\_preferences.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.workspace\_notification\_preferences.Update.xmtp\_enabled?

> `optional` **xmtp\_enabled**: `boolean`

###### Tables.workspace\_strategy\_targets

> **workspace\_strategy\_targets**: `object`

###### Tables.workspace\_strategy\_targets.Insert

> **Insert**: `object`

###### Tables.workspace\_strategy\_targets.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.workspace\_strategy\_targets.Insert.max\_assets\_cap?

> `optional` **max\_assets\_cap**: `number` \| `null`

###### Tables.workspace\_strategy\_targets.Insert.notes?

> `optional` **notes**: `string` \| `null`

###### Tables.workspace\_strategy\_targets.Insert.status?

> `optional` **status**: `string`

###### Tables.workspace\_strategy\_targets.Insert.strategy\_address

> **strategy\_address**: `string`

###### Tables.workspace\_strategy\_targets.Insert.target\_weight\_bps?

> `optional` **target\_weight\_bps**: `number`

###### Tables.workspace\_strategy\_targets.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.workspace\_strategy\_targets.Insert.updated\_by?

> `optional` **updated\_by**: `string` \| `null`

###### Tables.workspace\_strategy\_targets.Insert.updated\_source?

> `optional` **updated\_source**: `string` \| `null`

###### Tables.workspace\_strategy\_targets.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.workspace\_strategy\_targets.Relationships

> **Relationships**: \[\]

###### Tables.workspace\_strategy\_targets.Row

> **Row**: `object`

###### Tables.workspace\_strategy\_targets.Row.created\_at

> **created\_at**: `string`

###### Tables.workspace\_strategy\_targets.Row.max\_assets\_cap

> **max\_assets\_cap**: `number` \| `null`

###### Tables.workspace\_strategy\_targets.Row.notes

> **notes**: `string` \| `null`

###### Tables.workspace\_strategy\_targets.Row.status

> **status**: `string`

###### Tables.workspace\_strategy\_targets.Row.strategy\_address

> **strategy\_address**: `string`

###### Tables.workspace\_strategy\_targets.Row.target\_weight\_bps

> **target\_weight\_bps**: `number`

###### Tables.workspace\_strategy\_targets.Row.updated\_at

> **updated\_at**: `string`

###### Tables.workspace\_strategy\_targets.Row.updated\_by

> **updated\_by**: `string` \| `null`

###### Tables.workspace\_strategy\_targets.Row.updated\_source

> **updated\_source**: `string` \| `null`

###### Tables.workspace\_strategy\_targets.Row.vault\_address

> **vault\_address**: `string`

###### Tables.workspace\_strategy\_targets.Update

> **Update**: `object`

###### Tables.workspace\_strategy\_targets.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.workspace\_strategy\_targets.Update.max\_assets\_cap?

> `optional` **max\_assets\_cap**: `number` \| `null`

###### Tables.workspace\_strategy\_targets.Update.notes?

> `optional` **notes**: `string` \| `null`

###### Tables.workspace\_strategy\_targets.Update.status?

> `optional` **status**: `string`

###### Tables.workspace\_strategy\_targets.Update.strategy\_address?

> `optional` **strategy\_address**: `string`

###### Tables.workspace\_strategy\_targets.Update.target\_weight\_bps?

> `optional` **target\_weight\_bps**: `number`

###### Tables.workspace\_strategy\_targets.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.workspace\_strategy\_targets.Update.updated\_by?

> `optional` **updated\_by**: `string` \| `null`

###### Tables.workspace\_strategy\_targets.Update.updated\_source?

> `optional` **updated\_source**: `string` \| `null`

###### Tables.workspace\_strategy\_targets.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.workspace\_task\_state

> **workspace\_task\_state**: `object`

###### Tables.workspace\_task\_state.Insert

> **Insert**: `object`

###### Tables.workspace\_task\_state.Insert.action\_payload\_json?

> `optional` **action\_payload\_json**: [`Json`](#json)

###### Tables.workspace\_task\_state.Insert.action\_type?

> `optional` **action\_type**: `string` \| `null`

###### Tables.workspace\_task\_state.Insert.assignee\_wallet?

> `optional` **assignee\_wallet**: `string` \| `null`

###### Tables.workspace\_task\_state.Insert.created\_at?

> `optional` **created\_at**: `string`

###### Tables.workspace\_task\_state.Insert.created\_by?

> `optional` **created\_by**: `string` \| `null`

###### Tables.workspace\_task\_state.Insert.description?

> `optional` **description**: `string` \| `null`

###### Tables.workspace\_task\_state.Insert.due\_at?

> `optional` **due\_at**: `string` \| `null`

###### Tables.workspace\_task\_state.Insert.id?

> `optional` **id**: `number`

###### Tables.workspace\_task\_state.Insert.related\_alert\_id?

> `optional` **related\_alert\_id**: `number` \| `null`

###### Tables.workspace\_task\_state.Insert.related\_approval\_id?

> `optional` **related\_approval\_id**: `number` \| `null`

###### Tables.workspace\_task\_state.Insert.room\_ref?

> `optional` **room\_ref**: `string` \| `null`

###### Tables.workspace\_task\_state.Insert.severity?

> `optional` **severity**: `string`

###### Tables.workspace\_task\_state.Insert.snoozed\_until?

> `optional` **snoozed\_until**: `string` \| `null`

###### Tables.workspace\_task\_state.Insert.source?

> `optional` **source**: `string`

###### Tables.workspace\_task\_state.Insert.status?

> `optional` **status**: `string`

###### Tables.workspace\_task\_state.Insert.thread\_ref?

> `optional` **thread\_ref**: `string` \| `null`

###### Tables.workspace\_task\_state.Insert.title

> **title**: `string`

###### Tables.workspace\_task\_state.Insert.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.workspace\_task\_state.Insert.updated\_by?

> `optional` **updated\_by**: `string` \| `null`

###### Tables.workspace\_task\_state.Insert.vault\_address

> **vault\_address**: `string`

###### Tables.workspace\_task\_state.Relationships

> **Relationships**: \[\]

###### Tables.workspace\_task\_state.Row

> **Row**: `object`

###### Tables.workspace\_task\_state.Row.action\_payload\_json

> **action\_payload\_json**: [`Json`](#json)

###### Tables.workspace\_task\_state.Row.action\_type

> **action\_type**: `string` \| `null`

###### Tables.workspace\_task\_state.Row.assignee\_wallet

> **assignee\_wallet**: `string` \| `null`

###### Tables.workspace\_task\_state.Row.created\_at

> **created\_at**: `string`

###### Tables.workspace\_task\_state.Row.created\_by

> **created\_by**: `string` \| `null`

###### Tables.workspace\_task\_state.Row.description

> **description**: `string` \| `null`

###### Tables.workspace\_task\_state.Row.due\_at

> **due\_at**: `string` \| `null`

###### Tables.workspace\_task\_state.Row.id

> **id**: `number`

###### Tables.workspace\_task\_state.Row.related\_alert\_id

> **related\_alert\_id**: `number` \| `null`

###### Tables.workspace\_task\_state.Row.related\_approval\_id

> **related\_approval\_id**: `number` \| `null`

###### Tables.workspace\_task\_state.Row.room\_ref

> **room\_ref**: `string` \| `null`

###### Tables.workspace\_task\_state.Row.severity

> **severity**: `string`

###### Tables.workspace\_task\_state.Row.snoozed\_until

> **snoozed\_until**: `string` \| `null`

###### Tables.workspace\_task\_state.Row.source

> **source**: `string`

###### Tables.workspace\_task\_state.Row.status

> **status**: `string`

###### Tables.workspace\_task\_state.Row.thread\_ref

> **thread\_ref**: `string` \| `null`

###### Tables.workspace\_task\_state.Row.title

> **title**: `string`

###### Tables.workspace\_task\_state.Row.updated\_at

> **updated\_at**: `string`

###### Tables.workspace\_task\_state.Row.updated\_by

> **updated\_by**: `string` \| `null`

###### Tables.workspace\_task\_state.Row.vault\_address

> **vault\_address**: `string`

###### Tables.workspace\_task\_state.Update

> **Update**: `object`

###### Tables.workspace\_task\_state.Update.action\_payload\_json?

> `optional` **action\_payload\_json**: [`Json`](#json)

###### Tables.workspace\_task\_state.Update.action\_type?

> `optional` **action\_type**: `string` \| `null`

###### Tables.workspace\_task\_state.Update.assignee\_wallet?

> `optional` **assignee\_wallet**: `string` \| `null`

###### Tables.workspace\_task\_state.Update.created\_at?

> `optional` **created\_at**: `string`

###### Tables.workspace\_task\_state.Update.created\_by?

> `optional` **created\_by**: `string` \| `null`

###### Tables.workspace\_task\_state.Update.description?

> `optional` **description**: `string` \| `null`

###### Tables.workspace\_task\_state.Update.due\_at?

> `optional` **due\_at**: `string` \| `null`

###### Tables.workspace\_task\_state.Update.id?

> `optional` **id**: `number`

###### Tables.workspace\_task\_state.Update.related\_alert\_id?

> `optional` **related\_alert\_id**: `number` \| `null`

###### Tables.workspace\_task\_state.Update.related\_approval\_id?

> `optional` **related\_approval\_id**: `number` \| `null`

###### Tables.workspace\_task\_state.Update.room\_ref?

> `optional` **room\_ref**: `string` \| `null`

###### Tables.workspace\_task\_state.Update.severity?

> `optional` **severity**: `string`

###### Tables.workspace\_task\_state.Update.snoozed\_until?

> `optional` **snoozed\_until**: `string` \| `null`

###### Tables.workspace\_task\_state.Update.source?

> `optional` **source**: `string`

###### Tables.workspace\_task\_state.Update.status?

> `optional` **status**: `string`

###### Tables.workspace\_task\_state.Update.thread\_ref?

> `optional` **thread\_ref**: `string` \| `null`

###### Tables.workspace\_task\_state.Update.title?

> `optional` **title**: `string`

###### Tables.workspace\_task\_state.Update.updated\_at?

> `optional` **updated\_at**: `string`

###### Tables.workspace\_task\_state.Update.updated\_by?

> `optional` **updated\_by**: `string` \| `null`

###### Tables.workspace\_task\_state.Update.vault\_address?

> `optional` **vault\_address**: `string`

###### Tables.zora\_coin\_holders

> **zora\_coin\_holders**: `object`

###### Tables.zora\_coin\_holders.Insert

> **Insert**: `object`

###### Tables.zora\_coin\_holders.Insert.balance\_raw

> **balance\_raw**: `number`

###### Tables.zora\_coin\_holders.Insert.coin\_address

> **coin\_address**: `string`

###### Tables.zora\_coin\_holders.Insert.holder\_address

> **holder\_address**: `string`

###### Tables.zora\_coin\_holders.Insert.holder\_code\_size?

> `optional` **holder\_code\_size**: `number` \| `null`

###### Tables.zora\_coin\_holders.Insert.holder\_contract\_kind?

> `optional` **holder\_contract\_kind**: `string` \| `null`

###### Tables.zora\_coin\_holders.Insert.holder\_flagged\_at?

> `optional` **holder\_flagged\_at**: `string` \| `null`

###### Tables.zora\_coin\_holders.Insert.holder\_is\_contract?

> `optional` **holder\_is\_contract**: `boolean` \| `null`

###### Tables.zora\_coin\_holders.Insert.owner\_avatar\_url?

> `optional` **owner\_avatar\_url**: `string` \| `null`

###### Tables.zora\_coin\_holders.Insert.owner\_handle?

> `optional` **owner\_handle**: `string` \| `null`

###### Tables.zora\_coin\_holders.Insert.owner\_is\_profile?

> `optional` **owner\_is\_profile**: `boolean`

###### Tables.zora\_coin\_holders.Insert.rank\_in\_coin?

> `optional` **rank\_in\_coin**: `number` \| `null`

###### Tables.zora\_coin\_holders.Insert.raw\_node?

> `optional` **raw\_node**: [`Json`](#json) \| `null`

###### Tables.zora\_coin\_holders.Insert.synced\_at?

> `optional` **synced\_at**: `string`

###### Tables.zora\_coin\_holders.Relationships

> **Relationships**: \[\]

###### Tables.zora\_coin\_holders.Row

> **Row**: `object`

###### Tables.zora\_coin\_holders.Row.balance\_raw

> **balance\_raw**: `number`

###### Tables.zora\_coin\_holders.Row.coin\_address

> **coin\_address**: `string`

###### Tables.zora\_coin\_holders.Row.holder\_address

> **holder\_address**: `string`

###### Tables.zora\_coin\_holders.Row.holder\_code\_size

> **holder\_code\_size**: `number` \| `null`

###### Tables.zora\_coin\_holders.Row.holder\_contract\_kind

> **holder\_contract\_kind**: `string` \| `null`

###### Tables.zora\_coin\_holders.Row.holder\_flagged\_at

> **holder\_flagged\_at**: `string` \| `null`

###### Tables.zora\_coin\_holders.Row.holder\_is\_contract

> **holder\_is\_contract**: `boolean` \| `null`

###### Tables.zora\_coin\_holders.Row.owner\_avatar\_url

> **owner\_avatar\_url**: `string` \| `null`

###### Tables.zora\_coin\_holders.Row.owner\_handle

> **owner\_handle**: `string` \| `null`

###### Tables.zora\_coin\_holders.Row.owner\_is\_profile

> **owner\_is\_profile**: `boolean`

###### Tables.zora\_coin\_holders.Row.rank\_in\_coin

> **rank\_in\_coin**: `number` \| `null`

###### Tables.zora\_coin\_holders.Row.raw\_node

> **raw\_node**: [`Json`](#json) \| `null`

###### Tables.zora\_coin\_holders.Row.synced\_at

> **synced\_at**: `string`

###### Tables.zora\_coin\_holders.Update

> **Update**: `object`

###### Tables.zora\_coin\_holders.Update.balance\_raw?

> `optional` **balance\_raw**: `number`

###### Tables.zora\_coin\_holders.Update.coin\_address?

> `optional` **coin\_address**: `string`

###### Tables.zora\_coin\_holders.Update.holder\_address?

> `optional` **holder\_address**: `string`

###### Tables.zora\_coin\_holders.Update.holder\_code\_size?

> `optional` **holder\_code\_size**: `number` \| `null`

###### Tables.zora\_coin\_holders.Update.holder\_contract\_kind?

> `optional` **holder\_contract\_kind**: `string` \| `null`

###### Tables.zora\_coin\_holders.Update.holder\_flagged\_at?

> `optional` **holder\_flagged\_at**: `string` \| `null`

###### Tables.zora\_coin\_holders.Update.holder\_is\_contract?

> `optional` **holder\_is\_contract**: `boolean` \| `null`

###### Tables.zora\_coin\_holders.Update.owner\_avatar\_url?

> `optional` **owner\_avatar\_url**: `string` \| `null`

###### Tables.zora\_coin\_holders.Update.owner\_handle?

> `optional` **owner\_handle**: `string` \| `null`

###### Tables.zora\_coin\_holders.Update.owner\_is\_profile?

> `optional` **owner\_is\_profile**: `boolean`

###### Tables.zora\_coin\_holders.Update.rank\_in\_coin?

> `optional` **rank\_in\_coin**: `number` \| `null`

###### Tables.zora\_coin\_holders.Update.raw\_node?

> `optional` **raw\_node**: [`Json`](#json) \| `null`

###### Tables.zora\_coin\_holders.Update.synced\_at?

> `optional` **synced\_at**: `string`

###### Tables.zora\_csw\_owner\_class

> **zora\_csw\_owner\_class**: `object`

###### Tables.zora\_csw\_owner\_class.Insert

> **Insert**: `object`

###### Tables.zora\_csw\_owner\_class.Insert.base\_nonce?

> `optional` **base\_nonce**: `number` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.basename?

> `optional` **basename**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.basename\_avatar?

> `optional` **basename\_avatar**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.ens\_avatar?

> `optional` **ens\_avatar**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.ens\_name?

> `optional` **ens\_name**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.eoa

> **eoa**: `string`

###### Tables.zora\_csw\_owner\_class.Insert.ethos\_level?

> `optional` **ethos\_level**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.ethos\_score?

> `optional` **ethos\_score**: `number` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.ethos\_score\_updated\_at?

> `optional` **ethos\_score\_updated\_at**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.ethos\_userkey?

> `optional` **ethos\_userkey**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.farcaster\_display\_name?

> `optional` **farcaster\_display\_name**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.farcaster\_fid?

> `optional` **farcaster\_fid**: `number` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.farcaster\_username?

> `optional` **farcaster\_username**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.first\_classified\_at?

> `optional` **first\_classified\_at**: `string`

###### Tables.zora\_csw\_owner\_class.Insert.last\_updated\_at?

> `optional` **last\_updated\_at**: `string`

###### Tables.zora\_csw\_owner\_class.Insert.mainnet\_nonce?

> `optional` **mainnet\_nonce**: `number` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.metadata?

> `optional` **metadata**: [`Json`](#json)

###### Tables.zora\_csw\_owner\_class.Insert.names\_synced\_at?

> `optional` **names\_synced\_at**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.wallet\_class

> **wallet\_class**: `string`

###### Tables.zora\_csw\_owner\_class.Insert.zora\_creator\_coin\_address?

> `optional` **zora\_creator\_coin\_address**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.zora\_display\_name?

> `optional` **zora\_display\_name**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.zora\_handle?

> `optional` **zora\_handle**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Insert.zora\_synced\_at?

> `optional` **zora\_synced\_at**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Relationships

> **Relationships**: \[\]

###### Tables.zora\_csw\_owner\_class.Row

> **Row**: `object`

###### Tables.zora\_csw\_owner\_class.Row.base\_nonce

> **base\_nonce**: `number` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.basename

> **basename**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.basename\_avatar

> **basename\_avatar**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.ens\_avatar

> **ens\_avatar**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.ens\_name

> **ens\_name**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.eoa

> **eoa**: `string`

###### Tables.zora\_csw\_owner\_class.Row.ethos\_level

> **ethos\_level**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.ethos\_score

> **ethos\_score**: `number` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.ethos\_score\_updated\_at

> **ethos\_score\_updated\_at**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.ethos\_userkey

> **ethos\_userkey**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.farcaster\_display\_name

> **farcaster\_display\_name**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.farcaster\_fid

> **farcaster\_fid**: `number` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.farcaster\_username

> **farcaster\_username**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.first\_classified\_at

> **first\_classified\_at**: `string`

###### Tables.zora\_csw\_owner\_class.Row.last\_updated\_at

> **last\_updated\_at**: `string`

###### Tables.zora\_csw\_owner\_class.Row.mainnet\_nonce

> **mainnet\_nonce**: `number` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.metadata

> **metadata**: [`Json`](#json)

###### Tables.zora\_csw\_owner\_class.Row.names\_synced\_at

> **names\_synced\_at**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.wallet\_class

> **wallet\_class**: `string`

###### Tables.zora\_csw\_owner\_class.Row.zora\_creator\_coin\_address

> **zora\_creator\_coin\_address**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.zora\_display\_name

> **zora\_display\_name**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.zora\_handle

> **zora\_handle**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Row.zora\_synced\_at

> **zora\_synced\_at**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Update

> **Update**: `object`

###### Tables.zora\_csw\_owner\_class.Update.base\_nonce?

> `optional` **base\_nonce**: `number` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.basename?

> `optional` **basename**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.basename\_avatar?

> `optional` **basename\_avatar**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.ens\_avatar?

> `optional` **ens\_avatar**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.ens\_name?

> `optional` **ens\_name**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.eoa?

> `optional` **eoa**: `string`

###### Tables.zora\_csw\_owner\_class.Update.ethos\_level?

> `optional` **ethos\_level**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.ethos\_score?

> `optional` **ethos\_score**: `number` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.ethos\_score\_updated\_at?

> `optional` **ethos\_score\_updated\_at**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.ethos\_userkey?

> `optional` **ethos\_userkey**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.farcaster\_display\_name?

> `optional` **farcaster\_display\_name**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.farcaster\_fid?

> `optional` **farcaster\_fid**: `number` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.farcaster\_username?

> `optional` **farcaster\_username**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.first\_classified\_at?

> `optional` **first\_classified\_at**: `string`

###### Tables.zora\_csw\_owner\_class.Update.last\_updated\_at?

> `optional` **last\_updated\_at**: `string`

###### Tables.zora\_csw\_owner\_class.Update.mainnet\_nonce?

> `optional` **mainnet\_nonce**: `number` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.metadata?

> `optional` **metadata**: [`Json`](#json)

###### Tables.zora\_csw\_owner\_class.Update.names\_synced\_at?

> `optional` **names\_synced\_at**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.wallet\_class?

> `optional` **wallet\_class**: `string`

###### Tables.zora\_csw\_owner\_class.Update.zora\_creator\_coin\_address?

> `optional` **zora\_creator\_coin\_address**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.zora\_display\_name?

> `optional` **zora\_display\_name**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.zora\_handle?

> `optional` **zora\_handle**: `string` \| `null`

###### Tables.zora\_csw\_owner\_class.Update.zora\_synced\_at?

> `optional` **zora\_synced\_at**: `string` \| `null`

###### Tables.zora\_csw\_owners

> **zora\_csw\_owners**: `object`

###### Tables.zora\_csw\_owners.Insert

> **Insert**: `object`

###### Tables.zora\_csw\_owners.Insert.base\_owner?

> `optional` **base\_owner**: `string` \| `null`

###### Tables.zora\_csw\_owners.Insert.creation\_block?

> `optional` **creation\_block**: `number` \| `null`

###### Tables.zora\_csw\_owners.Insert.creation\_nonce?

> `optional` **creation\_nonce**: `number` \| `null`

###### Tables.zora\_csw\_owners.Insert.creation\_tx\_hash?

> `optional` **creation\_tx\_hash**: `string` \| `null`

###### Tables.zora\_csw\_owners.Insert.csw\_address

> **csw\_address**: `string`

###### Tables.zora\_csw\_owners.Insert.current\_owners?

> `optional` **current\_owners**: `string`[] \| `null`

###### Tables.zora\_csw\_owners.Insert.first\_indexed\_at?

> `optional` **first\_indexed\_at**: `string`

###### Tables.zora\_csw\_owners.Insert.initial\_owners?

> `optional` **initial\_owners**: `string`[]

###### Tables.zora\_csw\_owners.Insert.last\_owner\_sync\_at?

> `optional` **last\_owner\_sync\_at**: `string` \| `null`

###### Tables.zora\_csw\_owners.Insert.metadata?

> `optional` **metadata**: [`Json`](#json)

###### Tables.zora\_csw\_owners.Insert.source?

> `optional` **source**: `string`

###### Tables.zora\_csw\_owners.Relationships

> **Relationships**: \[\]

###### Tables.zora\_csw\_owners.Row

> **Row**: `object`

###### Tables.zora\_csw\_owners.Row.base\_owner

> **base\_owner**: `string` \| `null`

###### Tables.zora\_csw\_owners.Row.creation\_block

> **creation\_block**: `number` \| `null`

###### Tables.zora\_csw\_owners.Row.creation\_nonce

> **creation\_nonce**: `number` \| `null`

###### Tables.zora\_csw\_owners.Row.creation\_tx\_hash

> **creation\_tx\_hash**: `string` \| `null`

###### Tables.zora\_csw\_owners.Row.csw\_address

> **csw\_address**: `string`

###### Tables.zora\_csw\_owners.Row.current\_owners

> **current\_owners**: `string`[] \| `null`

###### Tables.zora\_csw\_owners.Row.first\_indexed\_at

> **first\_indexed\_at**: `string`

###### Tables.zora\_csw\_owners.Row.initial\_owners

> **initial\_owners**: `string`[]

###### Tables.zora\_csw\_owners.Row.last\_owner\_sync\_at

> **last\_owner\_sync\_at**: `string` \| `null`

###### Tables.zora\_csw\_owners.Row.metadata

> **metadata**: [`Json`](#json)

###### Tables.zora\_csw\_owners.Row.source

> **source**: `string`

###### Tables.zora\_csw\_owners.Update

> **Update**: `object`

###### Tables.zora\_csw\_owners.Update.base\_owner?

> `optional` **base\_owner**: `string` \| `null`

###### Tables.zora\_csw\_owners.Update.creation\_block?

> `optional` **creation\_block**: `number` \| `null`

###### Tables.zora\_csw\_owners.Update.creation\_nonce?

> `optional` **creation\_nonce**: `number` \| `null`

###### Tables.zora\_csw\_owners.Update.creation\_tx\_hash?

> `optional` **creation\_tx\_hash**: `string` \| `null`

###### Tables.zora\_csw\_owners.Update.csw\_address?

> `optional` **csw\_address**: `string`

###### Tables.zora\_csw\_owners.Update.current\_owners?

> `optional` **current\_owners**: `string`[] \| `null`

###### Tables.zora\_csw\_owners.Update.first\_indexed\_at?

> `optional` **first\_indexed\_at**: `string`

###### Tables.zora\_csw\_owners.Update.initial\_owners?

> `optional` **initial\_owners**: `string`[]

###### Tables.zora\_csw\_owners.Update.last\_owner\_sync\_at?

> `optional` **last\_owner\_sync\_at**: `string` \| `null`

###### Tables.zora\_csw\_owners.Update.metadata?

> `optional` **metadata**: [`Json`](#json)

###### Tables.zora\_csw\_owners.Update.source?

> `optional` **source**: `string`

###### Tables.zora\_profiles

> **zora\_profiles**: `object`

###### Tables.zora\_profiles.Insert

> **Insert**: `object`

###### Tables.zora\_profiles.Insert.added\_at?

> `optional` **added\_at**: `string`

###### Tables.zora\_profiles.Insert.avatar\_image\_url?

> `optional` **avatar\_image\_url**: `string` \| `null`

###### Tables.zora\_profiles.Insert.basename?

> `optional` **basename**: `string` \| `null`

###### Tables.zora\_profiles.Insert.basename\_avatar?

> `optional` **basename\_avatar**: `string` \| `null`

###### Tables.zora\_profiles.Insert.coin\_created\_at?

> `optional` **coin\_created\_at**: `string` \| `null`

###### Tables.zora\_profiles.Insert.description?

> `optional` **description**: `string` \| `null`

###### Tables.zora\_profiles.Insert.ens\_avatar?

> `optional` **ens\_avatar**: `string` \| `null`

###### Tables.zora\_profiles.Insert.ens\_name?

> `optional` **ens\_name**: `string` \| `null`

###### Tables.zora\_profiles.Insert.external\_wallets?

> `optional` **external\_wallets**: `string`[]

###### Tables.zora\_profiles.Insert.farcaster\_display\_name?

> `optional` **farcaster\_display\_name**: `string` \| `null`

###### Tables.zora\_profiles.Insert.farcaster\_fid?

> `optional` **farcaster\_fid**: `number` \| `null`

###### Tables.zora\_profiles.Insert.farcaster\_follower\_count?

> `optional` **farcaster\_follower\_count**: `number` \| `null`

###### Tables.zora\_profiles.Insert.farcaster\_synced\_at?

> `optional` **farcaster\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Insert.farcaster\_username?

> `optional` **farcaster\_username**: `string` \| `null`

###### Tables.zora\_profiles.Insert.handle

> **handle**: `string`

###### Tables.zora\_profiles.Insert.install\_plan\_synced\_at?

> `optional` **install\_plan\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Insert.is\_in\_csw\_index?

> `optional` **is\_in\_csw\_index**: `boolean` \| `null`

###### Tables.zora\_profiles.Insert.last\_refreshed\_at?

> `optional` **last\_refreshed\_at**: `string`

###### Tables.zora\_profiles.Insert.names\_synced\_at?

> `optional` **names\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Insert.payout\_is\_cbsw?

> `optional` **payout\_is\_cbsw**: `boolean` \| `null`

###### Tables.zora\_profiles.Insert.payout\_recipient?

> `optional` **payout\_recipient**: `string` \| `null`

###### Tables.zora\_profiles.Insert.payout\_recipient\_balance\_wei?

> `optional` **payout\_recipient\_balance\_wei**: `number` \| `null`

###### Tables.zora\_profiles.Insert.payout\_recipient\_is\_contract?

> `optional` **payout\_recipient\_is\_contract**: `boolean` \| `null`

###### Tables.zora\_profiles.Insert.payout\_recipient\_kind?

> `optional` **payout\_recipient\_kind**: `string` \| `null`

###### Tables.zora\_profiles.Insert.polish\_synced\_at?

> `optional` **polish\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Insert.primary\_wallet?

> `optional` **primary\_wallet**: `string` \| `null`

###### Tables.zora\_profiles.Insert.primary\_wallet\_kind?

> `optional` **primary\_wallet\_kind**: `string` \| `null`

###### Tables.zora\_profiles.Insert.privy\_wallet\_address?

> `optional` **privy\_wallet\_address**: `string` \| `null`

###### Tables.zora\_profiles.Insert.privy\_wallet\_kind?

> `optional` **privy\_wallet\_kind**: `string` \| `null`

###### Tables.zora\_profiles.Insert.raw\_profile?

> `optional` **raw\_profile**: [`Json`](#json) \| `null`

###### Tables.zora\_profiles.Insert.recommended\_install\_source?

> `optional` **recommended\_install\_source**: `string` \| `null`

###### Tables.zora\_profiles.Insert.recommended\_install\_target?

> `optional` **recommended\_install\_target**: `string` \| `null`

###### Tables.zora\_profiles.Insert.signing\_eoa?

> `optional` **signing\_eoa**: `string` \| `null`

###### Tables.zora\_profiles.Insert.signing\_eoa\_balance\_wei?

> `optional` **signing\_eoa\_balance\_wei**: `number` \| `null`

###### Tables.zora\_profiles.Insert.signing\_eoa\_source?

> `optional` **signing\_eoa\_source**: `string` \| `null`

###### Tables.zora\_profiles.Insert.smart\_wallet\_address?

> `optional` **smart\_wallet\_address**: `string` \| `null`

###### Tables.zora\_profiles.Insert.smart\_wallet\_is\_cbsw?

> `optional` **smart\_wallet\_is\_cbsw**: `boolean` \| `null`

###### Tables.zora\_profiles.Insert.smart\_wallet\_kind?

> `optional` **smart\_wallet\_kind**: `string` \| `null`

###### Tables.zora\_profiles.Insert.source

> **source**: `string`

###### Tables.zora\_profiles.Insert.twitter\_follower\_count?

> `optional` **twitter\_follower\_count**: `number` \| `null`

###### Tables.zora\_profiles.Insert.twitter\_username?

> `optional` **twitter\_username**: `string` \| `null`

###### Tables.zora\_profiles.Insert.unique\_holders?

> `optional` **unique\_holders**: `number` \| `null`

###### Tables.zora\_profiles.Insert.volume\_24h\_usd?

> `optional` **volume\_24h\_usd**: `number` \| `null`

###### Tables.zora\_profiles.Insert.wallet\_kinds\_synced\_at?

> `optional` **wallet\_kinds\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Insert.wallets\_synced\_at?

> `optional` **wallets\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Insert.website?

> `optional` **website**: `string` \| `null`

###### Tables.zora\_profiles.Insert.zora\_creator\_coin\_address?

> `optional` **zora\_creator\_coin\_address**: `string` \| `null`

###### Tables.zora\_profiles.Insert.zora\_creator\_coin\_market\_cap?

> `optional` **zora\_creator\_coin\_market\_cap**: `number` \| `null`

###### Tables.zora\_profiles.Insert.zora\_creator\_coin\_name?

> `optional` **zora\_creator\_coin\_name**: `string` \| `null`

###### Tables.zora\_profiles.Insert.zora\_creator\_coin\_symbol?

> `optional` **zora\_creator\_coin\_symbol**: `string` \| `null`

###### Tables.zora\_profiles.Insert.zora\_creator\_coin\_total\_volume?

> `optional` **zora\_creator\_coin\_total\_volume**: `number` \| `null`

###### Tables.zora\_profiles.Insert.zora\_display\_name?

> `optional` **zora\_display\_name**: `string` \| `null`

###### Tables.zora\_profiles.Insert.zora\_profile\_id?

> `optional` **zora\_profile\_id**: `string` \| `null`

###### Tables.zora\_profiles.Relationships

> **Relationships**: \[\]

###### Tables.zora\_profiles.Row

> **Row**: `object`

###### Tables.zora\_profiles.Row.added\_at

> **added\_at**: `string`

###### Tables.zora\_profiles.Row.avatar\_image\_url

> **avatar\_image\_url**: `string` \| `null`

###### Tables.zora\_profiles.Row.basename

> **basename**: `string` \| `null`

###### Tables.zora\_profiles.Row.basename\_avatar

> **basename\_avatar**: `string` \| `null`

###### Tables.zora\_profiles.Row.coin\_created\_at

> **coin\_created\_at**: `string` \| `null`

###### Tables.zora\_profiles.Row.description

> **description**: `string` \| `null`

###### Tables.zora\_profiles.Row.ens\_avatar

> **ens\_avatar**: `string` \| `null`

###### Tables.zora\_profiles.Row.ens\_name

> **ens\_name**: `string` \| `null`

###### Tables.zora\_profiles.Row.external\_wallets

> **external\_wallets**: `string`[]

###### Tables.zora\_profiles.Row.farcaster\_display\_name

> **farcaster\_display\_name**: `string` \| `null`

###### Tables.zora\_profiles.Row.farcaster\_fid

> **farcaster\_fid**: `number` \| `null`

###### Tables.zora\_profiles.Row.farcaster\_follower\_count

> **farcaster\_follower\_count**: `number` \| `null`

###### Tables.zora\_profiles.Row.farcaster\_synced\_at

> **farcaster\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Row.farcaster\_username

> **farcaster\_username**: `string` \| `null`

###### Tables.zora\_profiles.Row.handle

> **handle**: `string`

###### Tables.zora\_profiles.Row.install\_plan\_synced\_at

> **install\_plan\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Row.is\_in\_csw\_index

> **is\_in\_csw\_index**: `boolean` \| `null`

###### Tables.zora\_profiles.Row.last\_refreshed\_at

> **last\_refreshed\_at**: `string`

###### Tables.zora\_profiles.Row.names\_synced\_at

> **names\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Row.payout\_is\_cbsw

> **payout\_is\_cbsw**: `boolean` \| `null`

###### Tables.zora\_profiles.Row.payout\_recipient

> **payout\_recipient**: `string` \| `null`

###### Tables.zora\_profiles.Row.payout\_recipient\_balance\_wei

> **payout\_recipient\_balance\_wei**: `number` \| `null`

###### Tables.zora\_profiles.Row.payout\_recipient\_is\_contract

> **payout\_recipient\_is\_contract**: `boolean` \| `null`

###### Tables.zora\_profiles.Row.payout\_recipient\_kind

> **payout\_recipient\_kind**: `string` \| `null`

###### Tables.zora\_profiles.Row.polish\_synced\_at

> **polish\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Row.primary\_wallet

> **primary\_wallet**: `string` \| `null`

###### Tables.zora\_profiles.Row.primary\_wallet\_kind

> **primary\_wallet\_kind**: `string` \| `null`

###### Tables.zora\_profiles.Row.privy\_wallet\_address

> **privy\_wallet\_address**: `string` \| `null`

###### Tables.zora\_profiles.Row.privy\_wallet\_kind

> **privy\_wallet\_kind**: `string` \| `null`

###### Tables.zora\_profiles.Row.raw\_profile

> **raw\_profile**: [`Json`](#json) \| `null`

###### Tables.zora\_profiles.Row.recommended\_install\_source

> **recommended\_install\_source**: `string` \| `null`

###### Tables.zora\_profiles.Row.recommended\_install\_target

> **recommended\_install\_target**: `string` \| `null`

###### Tables.zora\_profiles.Row.signing\_eoa

> **signing\_eoa**: `string` \| `null`

###### Tables.zora\_profiles.Row.signing\_eoa\_balance\_wei

> **signing\_eoa\_balance\_wei**: `number` \| `null`

###### Tables.zora\_profiles.Row.signing\_eoa\_source

> **signing\_eoa\_source**: `string` \| `null`

###### Tables.zora\_profiles.Row.smart\_wallet\_address

> **smart\_wallet\_address**: `string` \| `null`

###### Tables.zora\_profiles.Row.smart\_wallet\_is\_cbsw

> **smart\_wallet\_is\_cbsw**: `boolean` \| `null`

###### Tables.zora\_profiles.Row.smart\_wallet\_kind

> **smart\_wallet\_kind**: `string` \| `null`

###### Tables.zora\_profiles.Row.source

> **source**: `string`

###### Tables.zora\_profiles.Row.twitter\_follower\_count

> **twitter\_follower\_count**: `number` \| `null`

###### Tables.zora\_profiles.Row.twitter\_username

> **twitter\_username**: `string` \| `null`

###### Tables.zora\_profiles.Row.unique\_holders

> **unique\_holders**: `number` \| `null`

###### Tables.zora\_profiles.Row.volume\_24h\_usd

> **volume\_24h\_usd**: `number` \| `null`

###### Tables.zora\_profiles.Row.wallet\_kinds\_synced\_at

> **wallet\_kinds\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Row.wallets\_synced\_at

> **wallets\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Row.website

> **website**: `string` \| `null`

###### Tables.zora\_profiles.Row.zora\_creator\_coin\_address

> **zora\_creator\_coin\_address**: `string` \| `null`

###### Tables.zora\_profiles.Row.zora\_creator\_coin\_market\_cap

> **zora\_creator\_coin\_market\_cap**: `number` \| `null`

###### Tables.zora\_profiles.Row.zora\_creator\_coin\_name

> **zora\_creator\_coin\_name**: `string` \| `null`

###### Tables.zora\_profiles.Row.zora\_creator\_coin\_symbol

> **zora\_creator\_coin\_symbol**: `string` \| `null`

###### Tables.zora\_profiles.Row.zora\_creator\_coin\_total\_volume

> **zora\_creator\_coin\_total\_volume**: `number` \| `null`

###### Tables.zora\_profiles.Row.zora\_display\_name

> **zora\_display\_name**: `string` \| `null`

###### Tables.zora\_profiles.Row.zora\_profile\_id

> **zora\_profile\_id**: `string` \| `null`

###### Tables.zora\_profiles.Update

> **Update**: `object`

###### Tables.zora\_profiles.Update.added\_at?

> `optional` **added\_at**: `string`

###### Tables.zora\_profiles.Update.avatar\_image\_url?

> `optional` **avatar\_image\_url**: `string` \| `null`

###### Tables.zora\_profiles.Update.basename?

> `optional` **basename**: `string` \| `null`

###### Tables.zora\_profiles.Update.basename\_avatar?

> `optional` **basename\_avatar**: `string` \| `null`

###### Tables.zora\_profiles.Update.coin\_created\_at?

> `optional` **coin\_created\_at**: `string` \| `null`

###### Tables.zora\_profiles.Update.description?

> `optional` **description**: `string` \| `null`

###### Tables.zora\_profiles.Update.ens\_avatar?

> `optional` **ens\_avatar**: `string` \| `null`

###### Tables.zora\_profiles.Update.ens\_name?

> `optional` **ens\_name**: `string` \| `null`

###### Tables.zora\_profiles.Update.external\_wallets?

> `optional` **external\_wallets**: `string`[]

###### Tables.zora\_profiles.Update.farcaster\_display\_name?

> `optional` **farcaster\_display\_name**: `string` \| `null`

###### Tables.zora\_profiles.Update.farcaster\_fid?

> `optional` **farcaster\_fid**: `number` \| `null`

###### Tables.zora\_profiles.Update.farcaster\_follower\_count?

> `optional` **farcaster\_follower\_count**: `number` \| `null`

###### Tables.zora\_profiles.Update.farcaster\_synced\_at?

> `optional` **farcaster\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Update.farcaster\_username?

> `optional` **farcaster\_username**: `string` \| `null`

###### Tables.zora\_profiles.Update.handle?

> `optional` **handle**: `string`

###### Tables.zora\_profiles.Update.install\_plan\_synced\_at?

> `optional` **install\_plan\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Update.is\_in\_csw\_index?

> `optional` **is\_in\_csw\_index**: `boolean` \| `null`

###### Tables.zora\_profiles.Update.last\_refreshed\_at?

> `optional` **last\_refreshed\_at**: `string`

###### Tables.zora\_profiles.Update.names\_synced\_at?

> `optional` **names\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Update.payout\_is\_cbsw?

> `optional` **payout\_is\_cbsw**: `boolean` \| `null`

###### Tables.zora\_profiles.Update.payout\_recipient?

> `optional` **payout\_recipient**: `string` \| `null`

###### Tables.zora\_profiles.Update.payout\_recipient\_balance\_wei?

> `optional` **payout\_recipient\_balance\_wei**: `number` \| `null`

###### Tables.zora\_profiles.Update.payout\_recipient\_is\_contract?

> `optional` **payout\_recipient\_is\_contract**: `boolean` \| `null`

###### Tables.zora\_profiles.Update.payout\_recipient\_kind?

> `optional` **payout\_recipient\_kind**: `string` \| `null`

###### Tables.zora\_profiles.Update.polish\_synced\_at?

> `optional` **polish\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Update.primary\_wallet?

> `optional` **primary\_wallet**: `string` \| `null`

###### Tables.zora\_profiles.Update.primary\_wallet\_kind?

> `optional` **primary\_wallet\_kind**: `string` \| `null`

###### Tables.zora\_profiles.Update.privy\_wallet\_address?

> `optional` **privy\_wallet\_address**: `string` \| `null`

###### Tables.zora\_profiles.Update.privy\_wallet\_kind?

> `optional` **privy\_wallet\_kind**: `string` \| `null`

###### Tables.zora\_profiles.Update.raw\_profile?

> `optional` **raw\_profile**: [`Json`](#json) \| `null`

###### Tables.zora\_profiles.Update.recommended\_install\_source?

> `optional` **recommended\_install\_source**: `string` \| `null`

###### Tables.zora\_profiles.Update.recommended\_install\_target?

> `optional` **recommended\_install\_target**: `string` \| `null`

###### Tables.zora\_profiles.Update.signing\_eoa?

> `optional` **signing\_eoa**: `string` \| `null`

###### Tables.zora\_profiles.Update.signing\_eoa\_balance\_wei?

> `optional` **signing\_eoa\_balance\_wei**: `number` \| `null`

###### Tables.zora\_profiles.Update.signing\_eoa\_source?

> `optional` **signing\_eoa\_source**: `string` \| `null`

###### Tables.zora\_profiles.Update.smart\_wallet\_address?

> `optional` **smart\_wallet\_address**: `string` \| `null`

###### Tables.zora\_profiles.Update.smart\_wallet\_is\_cbsw?

> `optional` **smart\_wallet\_is\_cbsw**: `boolean` \| `null`

###### Tables.zora\_profiles.Update.smart\_wallet\_kind?

> `optional` **smart\_wallet\_kind**: `string` \| `null`

###### Tables.zora\_profiles.Update.source?

> `optional` **source**: `string`

###### Tables.zora\_profiles.Update.twitter\_follower\_count?

> `optional` **twitter\_follower\_count**: `number` \| `null`

###### Tables.zora\_profiles.Update.twitter\_username?

> `optional` **twitter\_username**: `string` \| `null`

###### Tables.zora\_profiles.Update.unique\_holders?

> `optional` **unique\_holders**: `number` \| `null`

###### Tables.zora\_profiles.Update.volume\_24h\_usd?

> `optional` **volume\_24h\_usd**: `number` \| `null`

###### Tables.zora\_profiles.Update.wallet\_kinds\_synced\_at?

> `optional` **wallet\_kinds\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Update.wallets\_synced\_at?

> `optional` **wallets\_synced\_at**: `string` \| `null`

###### Tables.zora\_profiles.Update.website?

> `optional` **website**: `string` \| `null`

###### Tables.zora\_profiles.Update.zora\_creator\_coin\_address?

> `optional` **zora\_creator\_coin\_address**: `string` \| `null`

###### Tables.zora\_profiles.Update.zora\_creator\_coin\_market\_cap?

> `optional` **zora\_creator\_coin\_market\_cap**: `number` \| `null`

###### Tables.zora\_profiles.Update.zora\_creator\_coin\_name?

> `optional` **zora\_creator\_coin\_name**: `string` \| `null`

###### Tables.zora\_profiles.Update.zora\_creator\_coin\_symbol?

> `optional` **zora\_creator\_coin\_symbol**: `string` \| `null`

###### Tables.zora\_profiles.Update.zora\_creator\_coin\_total\_volume?

> `optional` **zora\_creator\_coin\_total\_volume**: `number` \| `null`

###### Tables.zora\_profiles.Update.zora\_display\_name?

> `optional` **zora\_display\_name**: `string` \| `null`

###### Tables.zora\_profiles.Update.zora\_profile\_id?

> `optional` **zora\_profile\_id**: `string` \| `null`

###### Views

> **Views**: `object`

###### Views.points\_amoe\_eligible\_balance

> **points\_amoe\_eligible\_balance**: `object`

###### Views.points\_amoe\_eligible\_balance.Relationships

> **Relationships**: \[\]

###### Views.points\_amoe\_eligible\_balance.Row

> **Row**: `object`

###### Views.points\_amoe\_eligible\_balance.Row.credits

> **credits**: `number` \| `null`

###### Views.points\_amoe\_eligible\_balance.Row.signup\_id

> **signup\_id**: `number` \| `null`

###### Views.v\_zora\_profiles\_enriched

> **v\_zora\_profiles\_enriched**: `object`

###### Views.v\_zora\_profiles\_enriched.Relationships

> **Relationships**: \[\]

###### Views.v\_zora\_profiles\_enriched.Row

> **Row**: `object`

###### Views.v\_zora\_profiles\_enriched.Row.added\_at

> **added\_at**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.avatar\_image\_url

> **avatar\_image\_url**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.basename

> **basename**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.basename\_avatar

> **basename\_avatar**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.cohort

> **cohort**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.coin\_created\_at

> **coin\_created\_at**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.description

> **description**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.ens\_avatar

> **ens\_avatar**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.ens\_name

> **ens\_name**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.external\_wallets

> **external\_wallets**: `string`[] \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.farcaster\_display\_name

> **farcaster\_display\_name**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.farcaster\_fid

> **farcaster\_fid**: `number` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.farcaster\_follower\_count

> **farcaster\_follower\_count**: `number` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.farcaster\_synced\_at

> **farcaster\_synced\_at**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.farcaster\_username

> **farcaster\_username**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.handle

> **handle**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.install\_plan\_synced\_at

> **install\_plan\_synced\_at**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.install\_readiness

> **install\_readiness**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.is\_in\_csw\_index

> **is\_in\_csw\_index**: `boolean` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.last\_refreshed\_at

> **last\_refreshed\_at**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.names\_synced\_at

> **names\_synced\_at**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.payout\_is\_cbsw

> **payout\_is\_cbsw**: `boolean` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.payout\_recipient

> **payout\_recipient**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.payout\_recipient\_balance\_wei

> **payout\_recipient\_balance\_wei**: `number` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.payout\_recipient\_is\_contract

> **payout\_recipient\_is\_contract**: `boolean` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.payout\_recipient\_kind

> **payout\_recipient\_kind**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.polish\_synced\_at

> **polish\_synced\_at**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.primary\_wallet

> **primary\_wallet**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.primary\_wallet\_kind

> **primary\_wallet\_kind**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.priority\_tier

> **priority\_tier**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.privy\_wallet\_address

> **privy\_wallet\_address**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.privy\_wallet\_kind

> **privy\_wallet\_kind**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.rank

> **rank**: `number` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.raw\_profile

> **raw\_profile**: [`Json`](#json) \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.recommended\_install\_source

> **recommended\_install\_source**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.recommended\_install\_target

> **recommended\_install\_target**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.signing\_eoa

> **signing\_eoa**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.signing\_eoa\_balance\_wei

> **signing\_eoa\_balance\_wei**: `number` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.signing\_eoa\_source

> **signing\_eoa\_source**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.smart\_wallet\_address

> **smart\_wallet\_address**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.smart\_wallet\_is\_cbsw

> **smart\_wallet\_is\_cbsw**: `boolean` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.smart\_wallet\_kind

> **smart\_wallet\_kind**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.source

> **source**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.twitter\_follower\_count

> **twitter\_follower\_count**: `number` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.twitter\_username

> **twitter\_username**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.unique\_holders

> **unique\_holders**: `number` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.volume\_24h\_usd

> **volume\_24h\_usd**: `number` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.wallet\_kinds\_synced\_at

> **wallet\_kinds\_synced\_at**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.wallets\_synced\_at

> **wallets\_synced\_at**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.website

> **website**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.zora\_creator\_coin\_address

> **zora\_creator\_coin\_address**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.zora\_creator\_coin\_market\_cap

> **zora\_creator\_coin\_market\_cap**: `number` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.zora\_creator\_coin\_name

> **zora\_creator\_coin\_name**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.zora\_creator\_coin\_symbol

> **zora\_creator\_coin\_symbol**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.zora\_creator\_coin\_total\_volume

> **zora\_creator\_coin\_total\_volume**: `number` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.zora\_display\_name

> **zora\_display\_name**: `string` \| `null`

###### Views.v\_zora\_profiles\_enriched.Row.zora\_profile\_id

> **zora\_profile\_id**: `string` \| `null`

***

### Enums

> **Enums**\<`DefaultSchemaEnumNameOrOptions`, `EnumName`\> = `DefaultSchemaEnumNameOrOptions` *extends* `object` ? `DatabaseWithoutInternals`\[`DefaultSchemaEnumNameOrOptions`\[`"schema"`\]\]\[`"Enums"`\]\[`EnumName`\] : `DefaultSchemaEnumNameOrOptions` *extends* keyof `DefaultSchema`\[`"Enums"`\] ? `DefaultSchema`\[`"Enums"`\]\[`DefaultSchemaEnumNameOrOptions`\] : `never`

Defined in: [server/\_lib/db/supabase.types.ts:4699](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/supabase.types.ts#L4699)

#### Type Parameters

##### DefaultSchemaEnumNameOrOptions

`DefaultSchemaEnumNameOrOptions` *extends* keyof `DefaultSchema`\[`"Enums"`\] \| \{ `schema`: keyof `DatabaseWithoutInternals`; \}

##### EnumName

`EnumName` *extends* `DefaultSchemaEnumNameOrOptions` *extends* `object` ? keyof `DatabaseWithoutInternals`\[`DefaultSchemaEnumNameOrOptions`\[`"schema"`\]\]\[`"Enums"`\] : `never` = `never`

***

### Json

> **Json** = `string` \| `number` \| `boolean` \| `null` \| \{\[`key`: `string`\]: [`Json`](#json) \| `undefined`; \} \| [`Json`](#json)[]

Defined in: [server/\_lib/db/supabase.types.ts:1](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/supabase.types.ts#L1)

***

### Tables

> **Tables**\<`DefaultSchemaTableNameOrOptions`, `TableName`\> = `DefaultSchemaTableNameOrOptions` *extends* `object` ? `DatabaseWithoutInternals`\[`DefaultSchemaTableNameOrOptions`\[`"schema"`\]\]\[`"Tables"`\] & `DatabaseWithoutInternals`\[`DefaultSchemaTableNameOrOptions`\[`"schema"`\]\]\[`"Views"`\]\[`TableName`\] *extends* `object` ? `R` : `never` : `DefaultSchemaTableNameOrOptions` *extends* keyof `DefaultSchema`\[`"Tables"`\] & `DefaultSchema`\[`"Views"`\] ? `DefaultSchema`\[`"Tables"`\] & `DefaultSchema`\[`"Views"`\]\[`DefaultSchemaTableNameOrOptions`\] *extends* `object` ? `R` : `never` : `never`

Defined in: [server/\_lib/db/supabase.types.ts:4620](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/supabase.types.ts#L4620)

#### Type Parameters

##### DefaultSchemaTableNameOrOptions

`DefaultSchemaTableNameOrOptions` *extends* keyof `DefaultSchema`\[`"Tables"`\] & `DefaultSchema`\[`"Views"`\] \| \{ `schema`: keyof `DatabaseWithoutInternals`; \}

##### TableName

`TableName` *extends* `DefaultSchemaTableNameOrOptions` *extends* `object` ? keyof `DatabaseWithoutInternals`\[`DefaultSchemaTableNameOrOptions`\[`"schema"`\]\]\[`"Tables"`\] & `DatabaseWithoutInternals`\[`DefaultSchemaTableNameOrOptions`\[`"schema"`\]\]\[`"Views"`\] : `never` = `never`

***

### TablesInsert

> **TablesInsert**\<`DefaultSchemaTableNameOrOptions`, `TableName`\> = `DefaultSchemaTableNameOrOptions` *extends* `object` ? `DatabaseWithoutInternals`\[`DefaultSchemaTableNameOrOptions`\[`"schema"`\]\]\[`"Tables"`\]\[`TableName`\] *extends* `object` ? `I` : `never` : `DefaultSchemaTableNameOrOptions` *extends* keyof `DefaultSchema`\[`"Tables"`\] ? `DefaultSchema`\[`"Tables"`\]\[`DefaultSchemaTableNameOrOptions`\] *extends* `object` ? `I` : `never` : `never`

Defined in: [server/\_lib/db/supabase.types.ts:4649](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/supabase.types.ts#L4649)

#### Type Parameters

##### DefaultSchemaTableNameOrOptions

`DefaultSchemaTableNameOrOptions` *extends* keyof `DefaultSchema`\[`"Tables"`\] \| \{ `schema`: keyof `DatabaseWithoutInternals`; \}

##### TableName

`TableName` *extends* `DefaultSchemaTableNameOrOptions` *extends* `object` ? keyof `DatabaseWithoutInternals`\[`DefaultSchemaTableNameOrOptions`\[`"schema"`\]\]\[`"Tables"`\] : `never` = `never`

***

### TablesUpdate

> **TablesUpdate**\<`DefaultSchemaTableNameOrOptions`, `TableName`\> = `DefaultSchemaTableNameOrOptions` *extends* `object` ? `DatabaseWithoutInternals`\[`DefaultSchemaTableNameOrOptions`\[`"schema"`\]\]\[`"Tables"`\]\[`TableName`\] *extends* `object` ? `U` : `never` : `DefaultSchemaTableNameOrOptions` *extends* keyof `DefaultSchema`\[`"Tables"`\] ? `DefaultSchema`\[`"Tables"`\]\[`DefaultSchemaTableNameOrOptions`\] *extends* `object` ? `U` : `never` : `never`

Defined in: [server/\_lib/db/supabase.types.ts:4674](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/supabase.types.ts#L4674)

#### Type Parameters

##### DefaultSchemaTableNameOrOptions

`DefaultSchemaTableNameOrOptions` *extends* keyof `DefaultSchema`\[`"Tables"`\] \| \{ `schema`: keyof `DatabaseWithoutInternals`; \}

##### TableName

`TableName` *extends* `DefaultSchemaTableNameOrOptions` *extends* `object` ? keyof `DatabaseWithoutInternals`\[`DefaultSchemaTableNameOrOptions`\[`"schema"`\]\]\[`"Tables"`\] : `never` = `never`

## Variables

### Constants

> `const` **Constants**: `object`

Defined in: [server/\_lib/db/supabase.types.ts:4733](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/supabase.types.ts#L4733)

#### Type Declaration

##### public

> `readonly` **public**: `object`

###### public.Enums

> `readonly` **Enums**: `object` = `{}`
