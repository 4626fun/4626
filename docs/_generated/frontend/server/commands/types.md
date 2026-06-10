[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / server/commands/types

# server/commands/types

## Type Aliases

### ExecuteCommandParams

> **ExecuteCommandParams** = `object`

Defined in: [server/commands/types.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/commands/types.ts#L15)

#### Properties

##### chatId?

> `optional` **chatId**: `string`

Defined in: [server/commands/types.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/commands/types.ts#L19)

##### groupId

> **groupId**: `string`

Defined in: [server/commands/types.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/commands/types.ts#L16)

##### roleOverrides?

> `optional` **roleOverrides**: [`ExecuteCommandRoleOverrides`](#executecommandroleoverrides)

Defined in: [server/commands/types.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/commands/types.ts#L21)

##### senderWallet

> **senderWallet**: `Address`

Defined in: [server/commands/types.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/commands/types.ts#L17)

##### text

> **text**: `string`

Defined in: [server/commands/types.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/commands/types.ts#L18)

##### userId?

> `optional` **userId**: `string`

Defined in: [server/commands/types.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/commands/types.ts#L20)

***

### ExecuteCommandRoleOverrides

> **ExecuteCommandRoleOverrides** = `object`

Defined in: [server/commands/types.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/commands/types.ts#L9)

#### Properties

##### coin?

> `optional` **coin**: [`KeeprRole`](#keeprrole)

Defined in: [server/commands/types.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/commands/types.ts#L11)

##### send?

> `optional` **send**: [`KeeprRole`](#keeprrole)

Defined in: [server/commands/types.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/commands/types.ts#L12)

##### twitter?

> `optional` **twitter**: [`KeeprRole`](#keeprrole)

Defined in: [server/commands/types.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/commands/types.ts#L10)

***

### KeeprCommandResult

> **KeeprCommandResult** = \{ `action?`: `any`; `ok`: `true`; `response`: `string`; \} \| \{ `action?`: `any`; `ok`: `false`; `response`: `string`; \}

Defined in: [server/commands/types.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/commands/types.ts#L5)

***

### KeeprRole

> **KeeprRole** = `"OWNER"` \| `"ADMIN"` \| `"MEMBER"`

Defined in: [server/commands/types.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/commands/types.ts#L3)
