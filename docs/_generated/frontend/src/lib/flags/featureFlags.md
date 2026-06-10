[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/flags/featureFlags

# src/lib/flags/featureFlags

## Interfaces

### FeatureFlag()

Defined in: [src/lib/flags/featureFlags.ts:69](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L69)

#### Type Parameters

##### T

`T`

> **FeatureFlag**(): `T`

Defined in: [src/lib/flags/featureFlags.ts:70](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L70)

#### Returns

`T`

#### Properties

##### definition

> **definition**: [`FlagDefinition`](#flagdefinition)\<`T`\>

Defined in: [src/lib/flags/featureFlags.ts:71](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L71)

***

### FlagDefinition

Defined in: [src/lib/flags/featureFlags.ts:59](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L59)

#### Type Parameters

##### T

`T`

#### Properties

##### category

> **category**: [`FlagCategory`](#flagcategory)

Defined in: [src/lib/flags/featureFlags.ts:62](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L62)

##### decide()

> **decide**: () => `T`

Defined in: [src/lib/flags/featureFlags.ts:66](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L66)

Resolve the current flag value.

###### Returns

`T`

##### defaultValue

> **defaultValue**: `T`

Defined in: [src/lib/flags/featureFlags.ts:63](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L63)

##### description

> **description**: `string`

Defined in: [src/lib/flags/featureFlags.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L61)

##### key

> **key**: `string`

Defined in: [src/lib/flags/featureFlags.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L60)

##### options?

> `optional` **options**: `object`[]

Defined in: [src/lib/flags/featureFlags.ts:64](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L64)

###### label?

> `optional` **label**: `string`

###### value

> **value**: `T`

## Type Aliases

### FlagCategory

> **FlagCategory** = `"security"` \| `"operational"` \| `"ui"` \| `"debug"`

Defined in: [src/lib/flags/featureFlags.ts:57](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L57)

## Variables

### allFlags

> `const` **allFlags**: [`FeatureFlag`](#featureflag)\<`unknown`\>[]

Defined in: [src/lib/flags/featureFlags.ts:323](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L323)

***

### debugLogsFlag

> `const` **debugLogsFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:245](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L245)

***

### directCswAddOwnerSendCallsFlag

> `const` **directCswAddOwnerSendCallsFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:278](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L278)

***

### hostModeFlag

> `const` **hostModeFlag**: [`FeatureFlag`](#featureflag)\<[`HostMode`](../env/host.md#hostmode)\>

Defined in: [src/lib/flags/featureFlags.ts:164](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L164)

***

### injectedConnectorFlag

> `const` **injectedConnectorFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:197](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L197)

***

### lensGroveFlag

> `const` **lensGroveFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:225](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L225)

***

### privyAnalyticsFlag

> `const` **privyAnalyticsFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:292](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L292)

***

### privyEnabledFlag

> `const` **privyEnabledFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:132](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L132)

***

### publicSiteModeFlag

> `const` **publicSiteModeFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:175](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L175)

***

### swapProviderFlag

> `const` **swapProviderFlag**: [`FeatureFlag`](#featureflag)\<`string`\>

Defined in: [src/lib/flags/featureFlags.ts:186](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L186)

***

### useropTelemetryFlag

> `const` **useropTelemetryFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:267](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L267)

***

### waitlistSubAccountFlowFlag

> `const` **waitlistSubAccountFlowFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:209](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L209)

Pairs with server `WAITLIST_SUBACCOUNT_FLOW_ENABLED=1`.

***

### xmtpDebugFlag

> `const` **xmtpDebugFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:256](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L256)

***

### zoraMigrationVerifyImplFlag

> `const` **zoraMigrationVerifyImplFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:147](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L147)

## Functions

### buildFlagDefinitions()

> **buildFlagDefinitions**(): `Record`\<`string`, \{ `description`: `string`; `options`: `object`[]; \}\>

Defined in: [src/lib/flags/featureFlags.ts:349](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L349)

Build the FlagDefinitionsType shape expected by flags/react FlagDefinitions.

#### Returns

`Record`\<`string`, \{ `description`: `string`; `options`: `object`[]; \}\>

***

### isPrivyHostModeAllowed()

> **isPrivyHostModeAllowed**(`mode`): `boolean`

Defined in: [src/lib/flags/featureFlags.ts:124](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L124)

#### Parameters

##### mode

[`HostMode`](../env/host.md#hostmode)

#### Returns

`boolean`

***

### resolveAllFlagValues()

> **resolveAllFlagValues**(): `Record`\<`string`, `unknown`\>

Defined in: [src/lib/flags/featureFlags.ts:340](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L340)

Snapshot every flag's current value, keyed by flag key.

#### Returns

`Record`\<`string`, `unknown`\>

***

### resolvePrivyAppId()

> **resolvePrivyAppId**(): `string` \| `null`

Defined in: [src/lib/flags/featureFlags.ts:308](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L308)

#### Returns

`string` \| `null`

***

### resolvePrivyClientId()

> **resolvePrivyClientId**(): `string` \| `null`

Defined in: [src/lib/flags/featureFlags.ts:314](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L314)

#### Returns

`string` \| `null`

## References

### HostMode

Re-exports [HostMode](../env/host.md#hostmode)
