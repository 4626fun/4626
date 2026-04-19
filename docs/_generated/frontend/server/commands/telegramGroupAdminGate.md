[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/commands/telegramGroupAdminGate

# server/commands/telegramGroupAdminGate

## Type Aliases

### GroupAdminGateDecision

> **GroupAdminGateDecision** = \{ `allowed`: `true`; \} \| \{ `allowed`: `false`; `response`: `string`; \}

Defined in: [server/commands/telegramGroupAdminGate.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/commands/telegramGroupAdminGate.ts#L17)

Result of evaluating whether a caller should be allowed to run a setup
command in a group chat. `allowed: true` means proceed normally.

## Functions

### evaluateGroupAdminGate()

> **evaluateGroupAdminGate**(`params`): `Promise`\<[`GroupAdminGateDecision`](#groupadmingatedecision)\>

Defined in: [server/commands/telegramGroupAdminGate.ts:53](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/commands/telegramGroupAdminGate.ts#L53)

Central decision point for the Telegram group-admin gate. Both the
deterministic execute pipeline and the native Telegram command handler
must route through this so the two paths can never disagree.

Fail-open (returns `allowed: true` without network calls):
  - feature flag TELEGRAM_SETUP_ROLE_GATE is off
  - command family is not in GROUP_ADMIN_REQUIRED_FAMILIES
  - chatId or userId missing (non-Telegram caller)
  - chatId is a private DM

Fail-closed (returns `allowed: false` with refusal copy):
  - role is 'member' (non-admin in group)   \u2192 formatAdminOnlyRefusal
  - role is 'unknown' (lookup failed/errored) \u2192 formatAdminCheckUnavailable

#### Parameters

##### params

###### chatId

`string` \| `undefined`

###### text

`string`

###### userId

`string` \| `undefined`

#### Returns

`Promise`\<[`GroupAdminGateDecision`](#groupadmingatedecision)\>

***

### formatCommandForDisplay()

> **formatCommandForDisplay**(`rawText`): `string`

Defined in: [server/commands/telegramGroupAdminGate.ts:27](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/commands/telegramGroupAdminGate.ts#L27)

Format the user's raw command text for display in a refusal message.
Preserves the leading slash and subcommand arg so "/keepr status" stays
"/keepr status" rather than collapsing to the normalized head "keepr".
Strips

#### Parameters

##### rawText

`string`

#### Returns

`string`

#### Botname

suffix and limits length defensively.
