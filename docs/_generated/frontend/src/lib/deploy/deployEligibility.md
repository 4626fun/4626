[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/deploy/deployEligibility

# src/lib/deploy/deployEligibility

## Type Aliases

### DeployEligibilityCode

> **DeployEligibilityCode** = `"ready"` \| `"no-canonical-csw"` \| `"base-app-deploy-blocked"` \| `"zora-passkey-deploy-blocked"` \| `"signing-required"` \| `"simulation-may-fail"`

Defined in: [src/lib/deploy/deployEligibility.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L18)

***

### DeployEligibilityInput

> **DeployEligibilityInput** = `object`

Defined in: [src/lib/deploy/deployEligibility.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L26)

#### Properties

##### baseAppLinked?

> `optional` **baseAppLinked**: `boolean`

Defined in: [src/lib/deploy/deployEligibility.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L30)

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [src/lib/deploy/deployEligibility.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L27)

##### canonicalIdentityType

> **canonicalIdentityType**: `"contract"` \| `"eoa"` \| `"unknown"`

Defined in: [src/lib/deploy/deployEligibility.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L28)

##### creatorCoinActionSimulationFailed?

> `optional` **creatorCoinActionSimulationFailed**: `boolean`

Defined in: [src/lib/deploy/deployEligibility.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L35)

When set, overrides generic passkey-only Zora block (simulation already failed).

##### executionTrack?

> `optional` **executionTrack**: `"sub-account"` \| `"legacy-owner-install"` \| `"migration-pending"` \| `"none-yet"` \| `null`

Defined in: [src/lib/deploy/deployEligibility.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L31)

##### onchainEoaOwnerCount?

> `optional` **onchainEoaOwnerCount**: `number`

Defined in: [src/lib/deploy/deployEligibility.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L32)

##### privyEmbeddedEoaIsOwnerOfCanonicalCsw?

> `optional` **privyEmbeddedEoaIsOwnerOfCanonicalCsw**: `boolean` \| `null`

Defined in: [src/lib/deploy/deployEligibility.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L33)

##### zoraLinked?

> `optional` **zoraLinked**: `boolean`

Defined in: [src/lib/deploy/deployEligibility.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L29)

***

### DeployEligibilityResult

> **DeployEligibilityResult** = `object`

Defined in: [src/lib/deploy/deployEligibility.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L38)

#### Properties

##### blockerMessage

> **blockerMessage**: `string` \| `null`

Defined in: [src/lib/deploy/deployEligibility.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L46)

Human-facing blocker when deploy should not proceed.

##### canProceedWithDeploySession

> **canProceedWithDeploySession**: `boolean`

Defined in: [src/lib/deploy/deployEligibility.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L42)

True when population (c) has deploy-session signing prerequisites.

##### code

> **code**: [`DeployEligibilityCode`](#deployeligibilitycode)

Defined in: [src/lib/deploy/deployEligibility.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L40)

##### population

> **population**: [`DeployUserPopulation`](#deployuserpopulation)

Defined in: [src/lib/deploy/deployEligibility.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L39)

##### showOwnerApprovalPanel

> **showOwnerApprovalPanel**: `boolean`

Defined in: [src/lib/deploy/deployEligibility.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L44)

Show Deploy one-time Privy/Base owner approval panel.

***

### DeployUserPopulation

> **DeployUserPopulation** = `"email-only"` \| `"base-app-passkey"` \| `"zora-eoa-owner"` \| `"zora-passkey-only"` \| `"unknown"`

Defined in: [src/lib/deploy/deployEligibility.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L11)

Deploy vault eligibility by account population.

Populations align with docs/ACCOUNT_MODEL.md §2:
  (a) email-only — no canonical CSW
  (b) base-app-passkey — CSW with passkey/session signing, no EOA owner path
  (c) zora-eoa-owner — CSW with at least one EOA owner (Zora / external)
  (d) zora-passkey-only — Zora CSW, no usable EOA owner for third-party dapps

## Functions

### classifyDeployPopulation()

> **classifyDeployPopulation**(`input`): [`DeployUserPopulation`](#deployuserpopulation)

Defined in: [src/lib/deploy/deployEligibility.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L53)

#### Parameters

##### input

[`DeployEligibilityInput`](#deployeligibilityinput)

#### Returns

[`DeployUserPopulation`](#deployuserpopulation)

***

### evaluateDeployEligibility()

> **evaluateDeployEligibility**(`input`): [`DeployEligibilityResult`](#deployeligibilityresult)

Defined in: [src/lib/deploy/deployEligibility.ts:75](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/deployEligibility.ts#L75)

#### Parameters

##### input

[`DeployEligibilityInput`](#deployeligibilityinput)

#### Returns

[`DeployEligibilityResult`](#deployeligibilityresult)
