[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/commands/families/keepr

# server/commands/families/keepr

## Functions

### executeKeeprCommandFamily()

> **executeKeeprCommandFamily**(`params`): `Promise`\<[`KeeprCommandResult`](../types.md#keeprcommandresult)\>

Defined in: [server/commands/families/keepr.ts:771](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/commands/families/keepr.ts#L771)

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

[`KeeprVaultRow`](../../_lib/keeprRegistry.md#keeprvaultrow) \| `null`

#### Returns

`Promise`\<[`KeeprCommandResult`](../types.md#keeprcommandresult)\>

***

### formatAssistantOnlyBlocked()

> **formatAssistantOnlyBlocked**(`command`): `string`

Defined in: [server/commands/families/keepr.ts:672](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/commands/families/keepr.ts#L672)

#### Parameters

##### command

`string`

#### Returns

`string`

***

### formatGroupConnectGuidance()

> **formatGroupConnectGuidance**(`groupId`): `string`

Defined in: [server/commands/families/keepr.ts:656](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/commands/families/keepr.ts#L656)

#### Parameters

##### groupId

`string`

#### Returns

`string`

***

### formatKeeprHelp()

> **formatKeeprHelp**(`rawTopic`, `options?`): `string`

Defined in: [server/commands/families/keepr.ts:628](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/commands/families/keepr.ts#L628)

#### Parameters

##### rawTopic

`string` | `null`

##### options?

###### role?

[`KeeprRole`](../types.md#keeprrole)

###### scope?

`CommandScope`

###### vault?

[`KeeprVaultRow`](../../_lib/keeprRegistry.md#keeprvaultrow) \| `null`

#### Returns

`string`

***

### formatVaultStatus()

> **formatVaultStatus**(`v`): `string`

Defined in: [server/commands/families/keepr.ts:682](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/commands/families/keepr.ts#L682)

#### Parameters

##### v

[`KeeprVaultRow`](../../_lib/keeprRegistry.md#keeprvaultrow) | `null`

#### Returns

`string`

***

### looksLikeGroupConnectIntent()

> **looksLikeGroupConnectIntent**(`raw`): `boolean`

Defined in: [server/commands/families/keepr.ts:646](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/commands/families/keepr.ts#L646)

#### Parameters

##### raw

`string`

#### Returns

`boolean`
