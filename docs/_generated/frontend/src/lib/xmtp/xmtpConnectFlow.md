[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/xmtp/xmtpConnectFlow

# src/lib/xmtp/xmtpConnectFlow

## Type Aliases

### ConnectFlowInput

> **ConnectFlowInput** = `object`

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L25)

#### Properties

##### hasKnownInstallation

> **hasKnownInstallation**: `boolean`

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L28)

##### intent

> **intent**: [`XmtpConnectIntent`](xmtpConnectPolicy.md#xmtpconnectintent)

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L26)

##### opfsDatabaseExists

> **opfsDatabaseExists**: `boolean`

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L27)

##### restoreOutcome

> **restoreOutcome**: [`RestorePhaseOutcome`](#restorephaseoutcome)

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L29)

##### setupOutcome

> **setupOutcome**: [`SetupPhaseOutcome`](#setupphaseoutcome)

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L30)

***

### ConnectFlowTrace

> **ConnectFlowTrace** = `object`

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L33)

#### Properties

##### clientBuildCount

> **clientBuildCount**: `number`

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L35)

##### clientCreateCount

> **clientCreateCount**: `number`

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L36)

##### installationLimitHit

> **installationLimitHit**: `boolean`

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L40)

##### localStateResetRequired

> **localStateResetRequired**: `boolean`

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L39)

##### outcome

> **outcome**: `"connected"` \| `"error"` \| `"idle"`

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L34)

##### refusedChurn

> **refusedChurn**: `boolean`

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L41)

##### registerInPlaceCount

> **registerInPlaceCount**: `number`

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L37)

##### setupConversationsCount

> **setupConversationsCount**: `number`

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L38)

***

### RestorePhaseOutcome

> **RestorePhaseOutcome** = `"not_attempted"` \| `"success"` \| `"installation_limit"` \| `"opfs_lock"` \| `"failed"`

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L8)

***

### SetupPhaseOutcome

> **SetupPhaseOutcome** = `"not_reached"` \| `"success"` \| `"invalid_local"` \| `"uninitialized_then_registered"` \| `"uninitialized_register_failed"` \| `"uninitialized_register_failed_still_uninitialized"` \| `"transient_then_success"` \| `"transient_then_failed"`

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L15)

## Functions

### buildConnectFlowScenarioMatrix()

> **buildConnectFlowScenarioMatrix**(): [`ConnectFlowInput`](#connectflowinput)[]

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:231](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L231)

#### Returns

[`ConnectFlowInput`](#connectflowinput)[]

***

### buildPseudoRandomConnectFlowScenarios()

> **buildPseudoRandomConnectFlowScenarios**(`count`, `seed`): [`ConnectFlowInput`](#connectflowinput)[]

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:276](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L276)

Deterministic pseudo-random scenarios to reach large test counts.

#### Parameters

##### count

`number`

##### seed

`number` = `4626`

#### Returns

[`ConnectFlowInput`](#connectflowinput)[]

***

### isFirstTryConnectWithoutChurn()

> **isFirstTryConnectWithoutChurn**(`input`, `trace`): `boolean`

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:186](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L186)

#### Parameters

##### input

[`ConnectFlowInput`](#connectflowinput)

##### trace

[`ConnectFlowTrace`](#connectflowtrace)

#### Returns

`boolean`

***

### normalizeScenario()

> **normalizeScenario**(`input`): [`ConnectFlowInput`](#connectflowinput)

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:207](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L207)

#### Parameters

##### input

[`ConnectFlowInput`](#connectflowinput)

#### Returns

[`ConnectFlowInput`](#connectflowinput)

***

### simulateXmtpConnectFlow()

> **simulateXmtpConnectFlow**(`input`): [`ConnectFlowTrace`](#connectflowtrace)

Defined in: [src/lib/xmtp/xmtpConnectFlow.ts:48](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpConnectFlow.ts#L48)

Pure model of the browser XMTP connect decision tree in provider.tsx.
Used for high-volume regression tests that forbid accidental Client.create churn.

#### Parameters

##### input

[`ConnectFlowInput`](#connectflowinput)

#### Returns

[`ConnectFlowTrace`](#connectflowtrace)
