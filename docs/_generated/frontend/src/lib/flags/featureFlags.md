[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/flags/featureFlags

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

Defined in: [src/lib/flags/featureFlags.ts:326](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L326)

***

### debugLogsFlag

> `const` **debugLogsFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:262](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L262)

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

Defined in: [src/lib/flags/featureFlags.ts:242](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L242)

***

### privyAnalyticsFlag

> `const` **privyAnalyticsFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:295](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L295)

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

Defined in: [src/lib/flags/featureFlags.ts:284](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L284)

***

### xmtpDebugFlag

> `const` **xmtpDebugFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:273](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L273)

***

### zoraGlobalWalletConnectorFlag

> `const` **zoraGlobalWalletConnectorFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:226](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L226)

Diagnostic flag: registers `@privy-io/cross-app-connect` as a wagmi
connector so a tester can re-evaluate Privy Connect-mode cross-app
behavior with Zora's app at `clpgf04wn04hnkw0fv1m11mnb`.

Empirical result (recorded for future re-testing):
  - Connect step works → Zora authorizes the 4626 appId for Connect mode.
  - Sign / transact step is refused by `privy.zora.co` (read-only).
  - The address surfaced even with `smartWalletMode: true` is a Privy
    embedded EOA that is NOT one of the user's CBSW owners (those are
    P256 passkeys in Coinbase Wallet / Base Account), so this connector
    cannot be used to add owners to a Zora CBSW even if read-only is
    fixed on Zora's side.

Therefore this flag stays OFF by default. Keep it as a one-line probe
for re-testing if Privy/Zora change their cross-app config. Full
write-up in `frontend/src/lib/wallet/zoraGlobalWalletConnector.ts`.

***

### zoraMigrationVerifyImplFlag

> `const` **zoraMigrationVerifyImplFlag**: [`FeatureFlag`](#featureflag)\<`boolean`\>

Defined in: [src/lib/flags/featureFlags.ts:147](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L147)

## Functions

### buildFlagDefinitions()

> **buildFlagDefinitions**(): `Record`\<`string`, \{ `description`: `string`; `options`: `object`[]; \}\>

Defined in: [src/lib/flags/featureFlags.ts:351](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L351)

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

Defined in: [src/lib/flags/featureFlags.ts:342](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L342)

Snapshot every flag's current value, keyed by flag key.

#### Returns

`Record`\<`string`, `unknown`\>

***

### resolvePrivyAppId()

> **resolvePrivyAppId**(): `string` \| `null`

Defined in: [src/lib/flags/featureFlags.ts:311](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L311)

#### Returns

`string` \| `null`

***

### resolvePrivyClientId()

> **resolvePrivyClientId**(): `string` \| `null`

Defined in: [src/lib/flags/featureFlags.ts:317](https://github.com/wenakita/4626/blob/main/frontend/src/lib/flags/featureFlags.ts#L317)

#### Returns

`string` \| `null`

## References

### HostMode

Re-exports [HostMode](../env/host.md#hostmode)
