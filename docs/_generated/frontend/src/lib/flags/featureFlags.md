[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/flags/featureFlags

# src/lib/flags/featureFlags

## Interfaces

### FeatureFlag()

Defined in: [src/lib/flags/featureFlags.ts:69](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L69)

#### Type Parameters

##### T

`T`

> **FeatureFlag**(): `T`

Defined in: [src/lib/flags/featureFlags.ts:70](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L70)

#### Returns

`T`

#### Properties

##### definition

> **definition**: [`FlagDefinition`](#flagdefinition)\<`T`\>

Defined in: [src/lib/flags/featureFlags.ts:71](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L71)

***

### FlagDefinition

Defined in: [src/lib/flags/featureFlags.ts:59](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L59)

#### Type Parameters

##### T

`T`

#### Properties

##### category

> **category**: [`FlagCategory`](#flagcategory)

Defined in: [src/lib/flags/featureFlags.ts:62](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L62)

##### decide()

> **decide**: () => `T`

Defined in: [src/lib/flags/featureFlags.ts:66](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L66)

Resolve the current flag value.

###### Returns

`T`

##### defaultValue

> **defaultValue**: `T`

Defined in: [src/lib/flags/featureFlags.ts:63](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L63)

##### description

> **description**: `string`

Defined in: [src/lib/flags/featureFlags.ts:61](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L61)

##### key

> **key**: `string`

Defined in: [src/lib/flags/featureFlags.ts:60](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L60)

##### options?

> `optional` **options**: `object`[]

Defined in: [src/lib/flags/featureFlags.ts:64](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L64)

###### label?

> `optional` **label**: `string`

###### value

> **value**: `T`

## Type Aliases

### FlagCategory

> **FlagCategory** = `"security"` \| `"operational"` \| `"ui"` \| `"debug"`

Defined in: [src/lib/flags/featureFlags.ts:57](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L57)

## Variables

### allFlags

> `const` **allFlags**: [`FeatureFlag`](#featureflag)\<`unknown`\>[]

Defined in: [src/lib/flags/featureFlags.ts:306](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L306)

***

### debugLogsFlag

> `const` **debugLogsFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:242](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L242)

***

### hostModeFlag

> `const` **hostModeFlag**: [`FeatureFlag`](#featureflag)\<[`HostMode`](../env/host.md#hostmode)\>

Defined in: [src/lib/flags/featureFlags.ts:174](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L174)

***

### injectedConnectorFlag

> `const` **injectedConnectorFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:207](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L207)

***

### lensGroveFlag

> `const` **lensGroveFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:222](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L222)

***

### privyAnalyticsFlag

> `const` **privyAnalyticsFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:275](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L275)

***

### privyEnabledFlag

> `const` **privyEnabledFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:142](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L142)

***

### publicSiteModeFlag

> `const` **publicSiteModeFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:185](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L185)

***

### swapProviderFlag

> `const` **swapProviderFlag**: [`FeatureFlag`](#featureflag)\<`string`\>

Defined in: [src/lib/flags/featureFlags.ts:196](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L196)

***

### useropTelemetryFlag

> `const` **useropTelemetryFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:264](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L264)

***

### xmtpDebugFlag

> `const` **xmtpDebugFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:253](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L253)

***

### zoraMigrationVerifyImplFlag

> `const` **zoraMigrationVerifyImplFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:157](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L157)

## Functions

### buildFlagDefinitions()

> **buildFlagDefinitions**(): `Record`\<`string`, \{ `description`: `string`; `options`: `object`[]; \}\>

Defined in: [src/lib/flags/featureFlags.ts:330](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L330)

Build the FlagDefinitionsType shape expected by flags/react FlagDefinitions.

#### Returns

`Record`\<`string`, \{ `description`: `string`; `options`: `object`[]; \}\>

***

### isPrivyHostModeAllowed()

> **isPrivyHostModeAllowed**(`mode`): `boolean`

Defined in: [src/lib/flags/featureFlags.ts:134](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L134)

#### Parameters

##### mode

[`HostMode`](../env/host.md#hostmode)

#### Returns

`boolean`

***

### resolveAllFlagValues()

> **resolveAllFlagValues**(): `Record`\<`string`, `unknown`\>

Defined in: [src/lib/flags/featureFlags.ts:321](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L321)

Snapshot every flag's current value, keyed by flag key.

#### Returns

`Record`\<`string`, `unknown`\>

***

### resolvePrivyAppId()

> **resolvePrivyAppId**(): `string` \| `null`

Defined in: [src/lib/flags/featureFlags.ts:291](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L291)

#### Returns

`string` \| `null`

***

### resolvePrivyClientId()

> **resolvePrivyClientId**(): `string` \| `null`

Defined in: [src/lib/flags/featureFlags.ts:297](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/flags/featureFlags.ts#L297)

#### Returns

`string` \| `null`

## References

### HostMode

Re-exports [HostMode](../env/host.md#hostmode)
