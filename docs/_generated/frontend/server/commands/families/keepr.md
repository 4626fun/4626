[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/commands/families/keepr

# server/commands/families/keepr

## Functions

### executeKeeprCommandFamily()

> **executeKeeprCommandFamily**(`params`): `Promise`\<[`KeeprCommandResult`](../types.md#keeprcommandresult)\>

Defined in: [server/commands/families/keepr.ts:802](https://github.com/wenakita/4626/blob/main/frontend/server/commands/families/keepr.ts#L802)

#### Parameters

##### params

###### groupId

`string`

###### role

[`KeeprRole`](../types.md#keeprrole)

###### senderWallet

`` `0x${string}` ``

###### text

`string`

###### vault

[`KeeprVaultRow`](../../_lib/keepr/keeprRegistry.md#keeprvaultrow) \| `null`

#### Returns

`Promise`\<[`KeeprCommandResult`](../types.md#keeprcommandresult)\>

***

### formatAdminCheckUnavailable()

> **formatAdminCheckUnavailable**(`command`): `string`

Defined in: [server/commands/families/keepr.ts:703](https://github.com/wenakita/4626/blob/main/frontend/server/commands/families/keepr.ts#L703)

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

Defined in: [server/commands/families/keepr.ts:687](https://github.com/wenakita/4626/blob/main/frontend/server/commands/families/keepr.ts#L687)

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

Defined in: [server/commands/families/keepr.ts:672](https://github.com/wenakita/4626/blob/main/frontend/server/commands/families/keepr.ts#L672)

#### Parameters

##### command

`string`

#### Returns

`string`

***

### formatGroupConnectGuidance()

> **formatGroupConnectGuidance**(`groupId`): `string`

Defined in: [server/commands/families/keepr.ts:656](https://github.com/wenakita/4626/blob/main/frontend/server/commands/families/keepr.ts#L656)

#### Parameters

##### groupId

`string`

#### Returns

`string`

***

### formatKeeprHelp()

> **formatKeeprHelp**(`rawTopic`, `options?`): `string`

Defined in: [server/commands/families/keepr.ts:628](https://github.com/wenakita/4626/blob/main/frontend/server/commands/families/keepr.ts#L628)

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

Defined in: [server/commands/families/keepr.ts:713](https://github.com/wenakita/4626/blob/main/frontend/server/commands/families/keepr.ts#L713)

#### Parameters

##### v

[`KeeprVaultRow`](../../_lib/keepr/keeprRegistry.md#keeprvaultrow) | `null`

#### Returns

`string`

***

### looksLikeGroupConnectIntent()

> **looksLikeGroupConnectIntent**(`raw`): `boolean`

Defined in: [server/commands/families/keepr.ts:646](https://github.com/wenakita/4626/blob/main/frontend/server/commands/families/keepr.ts#L646)

#### Parameters

##### raw

`string`

#### Returns

`boolean`
