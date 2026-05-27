[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/xmtp/xmtpConnectOrchestrator

# src/lib/xmtp/xmtpConnectOrchestrator

## Type Aliases

### FinishRestoredXmtpClientResult

> **FinishRestoredXmtpClientResult** = \{ `ok`: `true`; `registerCalls`: `number`; `setupCalls`: `number`; \} \| \{ `kind`: `"invalid_local"`; `message`: `string`; `ok`: `false`; `registerCalls`: `number`; `setupCalls`: `number`; \} \| \{ `kind`: `"register_failed"`; `message`: `string`; `ok`: `false`; `registerCalls`: `number`; `setupCalls`: `number`; `stillUninitialized`: `boolean`; \} \| \{ `kind`: `"transient_failed"`; `message`: `string`; `ok`: `false`; `registerCalls`: `number`; `setupCalls`: `number`; \}

Defined in: [src/lib/xmtp/xmtpConnectOrchestrator.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectOrchestrator.ts#L16)

***

### RestoreAttemptResult

> **RestoreAttemptResult** = \{ `kind`: `"skipped"`; \} \| \{ `client`: `unknown`; `kind`: `"success"`; \} \| \{ `kind`: `"installation_limit"`; \} \| \{ `kind`: `"opfs_lock"`; \} \| \{ `kind`: `"failed"`; \}

Defined in: [src/lib/xmtp/xmtpConnectOrchestrator.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectOrchestrator.ts#L9)

***

### XmtpConnectOrchestrationResult

> **XmtpConnectOrchestrationResult** = [`ConnectFlowTrace`](xmtpConnectFlow.md#connectflowtrace) & `object`

Defined in: [src/lib/xmtp/xmtpConnectOrchestrator.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectOrchestrator.ts#L41)

#### Type Declaration

##### client

> **client**: `unknown` \| `null`

##### errorMessage

> **errorMessage**: `string` \| `null`

***

### XmtpConnectOrchestratorDeps

> **XmtpConnectOrchestratorDeps** = `object`

Defined in: [src/lib/xmtp/xmtpConnectOrchestrator.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectOrchestrator.ts#L35)

#### Properties

##### createClient()

> **createClient**: () => `Promise`\<`unknown`\>

Defined in: [src/lib/xmtp/xmtpConnectOrchestrator.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectOrchestrator.ts#L38)

###### Returns

`Promise`\<`unknown`\>

##### finishRestoredClient()

> **finishRestoredClient**: (`client`) => `Promise`\<[`FinishRestoredXmtpClientResult`](#finishrestoredxmtpclientresult)\>

Defined in: [src/lib/xmtp/xmtpConnectOrchestrator.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectOrchestrator.ts#L37)

###### Parameters

###### client

`unknown`

###### Returns

`Promise`\<[`FinishRestoredXmtpClientResult`](#finishrestoredxmtpclientresult)\>

##### restoreClient()

> **restoreClient**: () => `Promise`\<[`RestoreAttemptResult`](#restoreattemptresult)\>

Defined in: [src/lib/xmtp/xmtpConnectOrchestrator.ts:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectOrchestrator.ts#L36)

###### Returns

`Promise`\<[`RestoreAttemptResult`](#restoreattemptresult)\>

***

### XmtpConnectOrchestratorInput

> **XmtpConnectOrchestratorInput** = `object`

Defined in: [src/lib/xmtp/xmtpConnectOrchestrator.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectOrchestrator.ts#L29)

#### Properties

##### hasKnownInstallation

> **hasKnownInstallation**: `boolean`

Defined in: [src/lib/xmtp/xmtpConnectOrchestrator.ts:32](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectOrchestrator.ts#L32)

##### intent

> **intent**: [`XmtpConnectIntent`](xmtpConnectPolicy.md#xmtpconnectintent)

Defined in: [src/lib/xmtp/xmtpConnectOrchestrator.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectOrchestrator.ts#L30)

##### opfsDatabaseExists

> **opfsDatabaseExists**: `boolean`

Defined in: [src/lib/xmtp/xmtpConnectOrchestrator.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectOrchestrator.ts#L31)

## Functions

### executeXmtpConnectOrchestration()

> **executeXmtpConnectOrchestration**(`input`, `deps`): `Promise`\<[`XmtpConnectOrchestrationResult`](#xmtpconnectorchestrationresult)\>

Defined in: [src/lib/xmtp/xmtpConnectOrchestrator.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectOrchestrator.ts#L63)

Mirrors provider.tsx restore → setup → in-place register → create fallthrough.
Injectable deps let integration tests mock @xmtp/browser-sdk without mounting React.

#### Parameters

##### input

[`XmtpConnectOrchestratorInput`](#xmtpconnectorchestratorinput)

##### deps

[`XmtpConnectOrchestratorDeps`](#xmtpconnectorchestratordeps)

#### Returns

`Promise`\<[`XmtpConnectOrchestrationResult`](#xmtpconnectorchestrationresult)\>

***

### finishRestoredXmtpClient()

> **finishRestoredXmtpClient**(`input`): `Promise`\<[`FinishRestoredXmtpClientResult`](#finishrestoredxmtpclientresult)\>

Defined in: [src/lib/xmtp/xmtpConnectOrchestrator.ts:183](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectOrchestrator.ts#L183)

Shared restore finish path: setup → in-place register on uninitialized → one retry on transient errors.

#### Parameters

##### input

###### isLocalStateInvalidError

(`message`) => `boolean`

###### registerWithFallback

() => `Promise`\<`void`\>

###### setupConversations

() => `Promise`\<`void`\>

#### Returns

`Promise`\<[`FinishRestoredXmtpClientResult`](#finishrestoredxmtpclientresult)\>

***

### toConnectFlowTrace()

> **toConnectFlowTrace**(`result`): [`ConnectFlowTrace`](xmtpConnectFlow.md#connectflowtrace)

Defined in: [src/lib/xmtp/xmtpConnectOrchestrator.ts:236](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpConnectOrchestrator.ts#L236)

#### Parameters

##### result

[`XmtpConnectOrchestrationResult`](#xmtpconnectorchestrationresult)

#### Returns

[`ConnectFlowTrace`](xmtpConnectFlow.md#connectflowtrace)
