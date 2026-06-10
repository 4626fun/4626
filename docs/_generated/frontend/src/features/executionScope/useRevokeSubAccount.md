[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/executionScope/useRevokeSubAccount

# src/features/executionScope/useRevokeSubAccount

## Type Aliases

### RevokeSubAccountResult

> **RevokeSubAccountResult** = \{ `alreadyRevoked`: `boolean`; `ok`: `true`; `profileId`: `number`; `revokedAt`: `string`; \} \| \{ `code`: `string`; `message`: `string`; `ok`: `false`; \}

Defined in: [src/features/executionScope/useRevokeSubAccount.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useRevokeSubAccount.ts#L16)

Client-side hook that drives `POST /api/arch-b/sub-account/revoke`.

One-shot action: calls the endpoint, surfaces loading + error state,
returns a typed result so the card can both display success feedback
and refresh the execution scope afterwards.

DB-only in v1. See `docs/design/sub-account-lifecycle-spec.md` for
why on-chain revoke is deferred to v1.1.

***

### UseRevokeSubAccountReturn

> **UseRevokeSubAccountReturn** = `object`

Defined in: [src/features/executionScope/useRevokeSubAccount.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useRevokeSubAccount.ts#L29)

#### Properties

##### busy

> **busy**: `boolean`

Defined in: [src/features/executionScope/useRevokeSubAccount.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useRevokeSubAccount.ts#L31)

True while the revoke request is in flight.

##### error

> **error**: `string` \| `null`

Defined in: [src/features/executionScope/useRevokeSubAccount.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useRevokeSubAccount.ts#L33)

Last error shown to the user; cleared on the next `revoke()` call.

##### lastResult

> **lastResult**: [`RevokeSubAccountResult`](#revokesubaccountresult) \| `null`

Defined in: [src/features/executionScope/useRevokeSubAccount.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useRevokeSubAccount.ts#L35)

Last successful revoke, persisted until the next call.

##### revoke()

> **revoke**: (`reason?`) => `Promise`\<[`RevokeSubAccountResult`](#revokesubaccountresult)\>

Defined in: [src/features/executionScope/useRevokeSubAccount.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useRevokeSubAccount.ts#L37)

Trigger the revoke. `reason` is optional and capped to 256 chars server-side.

###### Parameters

###### reason?

`string`

###### Returns

`Promise`\<[`RevokeSubAccountResult`](#revokesubaccountresult)\>

## Functions

### useRevokeSubAccount()

> **useRevokeSubAccount**(): [`UseRevokeSubAccountReturn`](#userevokesubaccountreturn)

Defined in: [src/features/executionScope/useRevokeSubAccount.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useRevokeSubAccount.ts#L40)

#### Returns

[`UseRevokeSubAccountReturn`](#userevokesubaccountreturn)
