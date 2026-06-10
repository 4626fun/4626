[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/commands/families/keepr

# server/commands/families/keepr

## Functions

### executeKeeprCommandFamily()

> **executeKeeprCommandFamily**(`params`): `Promise`\<[`KeeprCommandResult`](../types.md#keeprcommandresult)\>

Defined in: [server/commands/families/keepr.ts:801](https://github.com/wenakita/4626/blob/main/frontend/server/commands/families/keepr.ts#L801)

#### Parameters

##### params

###### groupId

`string`

###### role

[`KeeprRole`](../types.md#keeprrole)

###### senderWallet

`string`

###### text

`string`

###### vault

[`KeeprVaultRow`](../../_lib/keepr/keeprRegistry.md#keeprvaultrow) \| `null`

#### Returns

`Promise`\<[`KeeprCommandResult`](../types.md#keeprcommandresult)\>

***

### formatAdminCheckUnavailable()

> **formatAdminCheckUnavailable**(`command`): `string`

Defined in: [server/commands/families/keepr.ts:702](https://github.com/wenakita/4626/blob/main/frontend/server/commands/families/keepr.ts#L702)

Shown when we could not determine the caller's role because getChatMember
failed (network, rate limit, bot not admin in group). This is a "fail closed"
refusal — we do not allow the action until we can verify.

#### Parameters

##### command

`string`

#### Returns

`string`

***

### formatAdminOnlyRefusal()

> **formatAdminOnlyRefusal**(`command`): `string`

Defined in: [server/commands/families/keepr.ts:686](https://github.com/wenakita/4626/blob/main/frontend/server/commands/families/keepr.ts#L686)

Shown when a non-admin group member invokes a setup command (/link, /status,
/unlink, /keepr). The command is still available to group owners and admins,
and to all users in private DMs with the bot.

#### Parameters

##### command

`string`

#### Returns

`string`

***

### formatAssistantOnlyBlocked()

> **formatAssistantOnlyBlocked**(`command`): `string`

Defined in: [server/commands/families/keepr.ts:671](https://github.com/wenakita/4626/blob/main/frontend/server/commands/families/keepr.ts#L671)

#### Parameters

##### command

`string`

#### Returns

`string`

***

### formatGroupConnectGuidance()

> **formatGroupConnectGuidance**(`groupId`): `string`

Defined in: [server/commands/families/keepr.ts:655](https://github.com/wenakita/4626/blob/main/frontend/server/commands/families/keepr.ts#L655)

#### Parameters

##### groupId

`string`

#### Returns

`string`

***

### formatKeeprHelp()

> **formatKeeprHelp**(`rawTopic`, `options?`): `string`

Defined in: [server/commands/families/keepr.ts:627](https://github.com/wenakita/4626/blob/main/frontend/server/commands/families/keepr.ts#L627)

#### Parameters

##### rawTopic

`string` | `null`

##### options?

###### role?

[`KeeprRole`](../types.md#keeprrole)

###### scope?

`CommandScope`

###### vault?

[`KeeprVaultRow`](../../_lib/keepr/keeprRegistry.md#keeprvaultrow) \| `null`

#### Returns

`string`

***

### formatVaultStatus()

> **formatVaultStatus**(`v`): `string`

Defined in: [server/commands/families/keepr.ts:712](https://github.com/wenakita/4626/blob/main/frontend/server/commands/families/keepr.ts#L712)

#### Parameters

##### v

[`KeeprVaultRow`](../../_lib/keepr/keeprRegistry.md#keeprvaultrow) | `null`

#### Returns

`string`

***

### looksLikeGroupConnectIntent()

> **looksLikeGroupConnectIntent**(`raw`): `boolean`

Defined in: [server/commands/families/keepr.ts:645](https://github.com/wenakita/4626/blob/main/frontend/server/commands/families/keepr.ts#L645)

#### Parameters

##### raw

`string`

#### Returns

`boolean`
