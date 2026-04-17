[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/onchain/solanaBridgePolicy

# server/\_lib/onchain/solanaBridgePolicy

## Type Aliases

### CanonicalBridgeTokenPolicyDecision

> **CanonicalBridgeTokenPolicyDecision** = `object`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L7)

#### Properties

##### allowed

> **allowed**: `boolean`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L11)

##### allowlistConfigured

> **allowlistConfigured**: `boolean`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L8)

##### allowlistRequired

> **allowlistRequired**: `boolean`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L10)

##### allowlistSize

> **allowlistSize**: `number`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L9)

##### code

> **code**: `"ok"` \| `"allowlist_missing"` \| `"token_not_allowlisted"`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L12)

##### message

> **message**: `string` \| `null`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L13)

***

### RemoteProvisionerHealthProbe

> **RemoteProvisionerHealthProbe** = `object`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L16)

#### Properties

##### healthOk

> **healthOk**: `boolean` \| `null`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L19)

##### payerBalanceSol

> **payerBalanceSol**: `string` \| `null`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L24)

##### payerConfigured

> **payerConfigured**: `boolean` \| `null`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L20)

##### payerError

> **payerError**: `string` \| `null`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L22)

##### payerHealthy

> **payerHealthy**: `boolean` \| `null`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L21)

##### payerMinSol

> **payerMinSol**: `string` \| `null`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L25)

##### payerPubkey

> **payerPubkey**: `string` \| `null`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L23)

##### reachable

> **reachable**: `boolean`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L17)

##### reportedAtIso

> **reportedAtIso**: `string` \| `null`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L26)

##### reportedAtMs

> **reportedAtMs**: `number` \| `null`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L27)

##### statusCode

> **statusCode**: `number` \| `null`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L18)

***

### RemoteProvisionerLivenessDecision

> **RemoteProvisionerLivenessDecision** = `object`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L30)

#### Properties

##### blockers

> **blockers**: `string`[]

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L32)

##### healthAgeSeconds

> **healthAgeSeconds**: `number` \| `null`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L33)

##### healthy

> **healthy**: `boolean`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L31)

## Functions

### evaluateCanonicalBridgeTokenPolicy()

> **evaluateCanonicalBridgeTokenPolicy**(`params`): [`CanonicalBridgeTokenPolicyDecision`](#canonicalbridgetokenpolicydecision)

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L91)

#### Parameters

##### params

###### bridgeToken

`string`

###### env?

`EnvLike`

#### Returns

[`CanonicalBridgeTokenPolicyDecision`](#canonicalbridgetokenpolicydecision)

***

### evaluateRemoteProvisionerLiveness()

> **evaluateRemoteProvisionerLiveness**(`params`): [`RemoteProvisionerLivenessDecision`](#remoteprovisionerlivenessdecision)

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:232](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L232)

#### Parameters

##### params

###### enforced

`boolean`

###### maxHealthAgeSeconds

`number` \| `null`

###### nowMs?

`number`

###### probe

[`RemoteProvisionerHealthProbe`](#remoteprovisionerhealthprobe) \| `null`

#### Returns

[`RemoteProvisionerLivenessDecision`](#remoteprovisionerlivenessdecision)

***

### probeRemoteProvisionerHealth()

> **probeRemoteProvisionerHealth**(`params`): `Promise`\<[`RemoteProvisionerHealthProbe`](#remoteprovisionerhealthprobe)\>

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:158](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L158)

#### Parameters

##### params

###### secret

`string`

###### timeoutMs?

`number`

###### url

`string`

#### Returns

`Promise`\<[`RemoteProvisionerHealthProbe`](#remoteprovisionerhealthprobe)\>

***

### readCanonicalBridgeTokenAllowlist()

> **readCanonicalBridgeTokenAllowlist**(`env`): `Set`\<`string`\>

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:79](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L79)

#### Parameters

##### env

`EnvLike` = `process.env`

#### Returns

`Set`\<`string`\>

***

### readCanonicalBridgeTokenAllowlistRequired()

> **readCanonicalBridgeTokenAllowlistRequired**(`env`): `boolean`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L87)

#### Parameters

##### env

`EnvLike` = `process.env`

#### Returns

`boolean`

***

### readSolanaBridgeLivenessPolicy()

> **readSolanaBridgeLivenessPolicy**(`env`): `object`

Defined in: [server/\_lib/onchain/solanaBridgePolicy.ts:146](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaBridgePolicy.ts#L146)

#### Parameters

##### env

`EnvLike` = `process.env`

#### Returns

`object`

##### enforced

> **enforced**: `boolean`

##### maxHealthAgeSeconds

> **maxHealthAgeSeconds**: `number` \| `null`
