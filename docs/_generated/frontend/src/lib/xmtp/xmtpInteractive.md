[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/xmtp/xmtpInteractive

# src/lib/xmtp/xmtpInteractive

## Type Aliases

### NormalizedXmtpAgentReply

> **NormalizedXmtpAgentReply** = [`XmtpAgentReply`](#xmtpagentreply)

Defined in: [src/lib/xmtp/xmtpInteractive.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L25)

***

### XmtpActionButton

> **XmtpActionButton** = `object`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L4)

#### Properties

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L5)

##### label

> **label**: `string`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L6)

##### style?

> `optional` **style**: `"primary"` \| `"secondary"` \| `"danger"`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L7)

***

### XmtpActionsPayload

> **XmtpActionsPayload** = `object`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L10)

#### Properties

##### actions

> **actions**: [`XmtpActionButton`](#xmtpactionbutton)[]

Defined in: [src/lib/xmtp/xmtpInteractive.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L13)

##### description

> **description**: `string`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L12)

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L11)

***

### XmtpAgentReply

> **XmtpAgentReply** = `object`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L18)

#### Properties

##### followUp?

> `optional` **followUp**: [`XmtpInteractiveFollowUp`](#xmtpinteractivefollowup)

Defined in: [src/lib/xmtp/xmtpInteractive.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L20)

##### reactToInbound?

> `optional` **reactToInbound**: `boolean`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L22)

Agent adds ✅ on the inbound message (e.g. after /keepr status).

##### text

> **text**: `string`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L19)

***

### XmtpInteractiveFollowUp

> **XmtpInteractiveFollowUp** = `"welcome-actions"` \| `"keepr-status-followup"`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L16)

***

### XmtpWalletSendCallsScaffold

> **XmtpWalletSendCallsScaffold** = `object`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:106](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L106)

Wallet send calls are intentionally out of scope here — see docs/operations/xmtp-interactive-roadmap.md

#### Properties

##### note

> **note**: `"Use conversation.sendWalletSendCalls() for in-chat swap/approval confirmation."`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:107](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L107)

## Variables

### XMTP\_ACTION\_IDS

> `const` **XMTP\_ACTION\_IDS**: `object`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L27)

#### Type Declaration

##### KEEPR\_BACK

> `readonly` **KEEPR\_BACK**: `"keepr:back"` = `'keepr:back'`

##### KEEPR\_HEALTH

> `readonly` **KEEPR\_HEALTH**: `"keepr:health"` = `'keepr:health'`

##### KEEPR\_REFRESH

> `readonly` **KEEPR\_REFRESH**: `"keepr:refresh"` = `'keepr:refresh'`

##### WELCOME\_AI

> `readonly` **WELCOME\_AI**: `"welcome:ai"` = `'welcome:ai'`

##### WELCOME\_HELP

> `readonly` **WELCOME\_HELP**: `"welcome:help"` = `'welcome:help'`

##### WELCOME\_KEEPR\_HEALTH

> `readonly` **WELCOME\_KEEPR\_HEALTH**: `"welcome:keepr-health"` = `'welcome:keepr-health'`

##### WELCOME\_KEEPR\_STATUS

> `readonly` **WELCOME\_KEEPR\_STATUS**: `"welcome:keepr-status"` = `'welcome:keepr-status'`

##### WELCOME\_WALLET

> `readonly` **WELCOME\_WALLET**: `"welcome:wallet"` = `'welcome:wallet'`

## Functions

### buildKeeprStatusFollowUpActions()

> **buildKeeprStatusFollowUpActions**(): [`XmtpActionsPayload`](#xmtpactionspayload)

Defined in: [src/lib/xmtp/xmtpInteractive.ts:69](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L69)

#### Returns

[`XmtpActionsPayload`](#xmtpactionspayload)

***

### buildWelcomeActions()

> **buildWelcomeActions**(): [`XmtpActionsPayload`](#xmtpactionspayload)

Defined in: [src/lib/xmtp/xmtpInteractive.ts:55](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L55)

#### Returns

[`XmtpActionsPayload`](#xmtpactionspayload)

***

### isWelcomeMessageText()

> **isWelcomeMessageText**(`text`): `boolean`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:81](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L81)

#### Parameters

##### text

`string`

#### Returns

`boolean`

***

### normalizeAgentReply()

> **normalizeAgentReply**(`reply`): [`XmtpAgentReply`](#xmtpagentreply) \| `null`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:85](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L85)

#### Parameters

##### reply

`string` | [`XmtpAgentReply`](#xmtpagentreply) | `null` | `undefined`

#### Returns

[`XmtpAgentReply`](#xmtpagentreply) \| `null`

***

### resolveIntentActionId()

> **resolveIntentActionId**(`actionId`): `string` \| `null`

Defined in: [src/lib/xmtp/xmtpInteractive.ts:49](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpInteractive.ts#L49)

#### Parameters

##### actionId

`string`

#### Returns

`string` \| `null`
