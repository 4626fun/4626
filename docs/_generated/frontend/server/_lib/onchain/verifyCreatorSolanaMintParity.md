[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/onchain/verifyCreatorSolanaMintParity

# server/\_lib/onchain/verifyCreatorSolanaMintParity

## Type Aliases

### SolanaMintMetadataFetcher()

> **SolanaMintMetadataFetcher** = (`mintPubkey`) => `Promise`\<\{ `decimals`: `number` \| `null`; `hasTokenMetadataExtension`: `boolean`; `name`: `string` \| `null`; `supply`: `string` \| `null`; `symbol`: `string` \| `null`; \}\>

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:77](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L77)

Minimal Solana RPC interface used for the mint metadata read. Callers
inject a fetcher so the verifier stays isomorphic (no global fetch
dependency, easy to mock in tests).

#### Parameters

##### mintPubkey

`string`

#### Returns

`Promise`\<\{ `decimals`: `number` \| `null`; `hasTokenMetadataExtension`: `boolean`; `name`: `string` \| `null`; `supply`: `string` \| `null`; `symbol`: `string` \| `null`; \}\>

***

### VerifyCreatorSolanaMintParityInput

> **VerifyCreatorSolanaMintParityInput** = `object`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:88](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L88)

#### Properties

##### adapterAddress

> **adapterAddress**: `Address`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L92)

The `SolanaBridgeAdapter` address expected to hold the mapping.

##### basePublicClient

> **basePublicClient**: `BasePublicClient`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:100](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L100)

viem client for Base reads.

##### creatorToken

> **creatorToken**: `Address`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L90)

The Base creator-coin ERC-20 address to verify.

##### deployEnv

> **deployEnv**: [`BridgeDeployEnv`](solanaWrappedMintPda.md#bridgedeployenv)

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L94)

Bridge deploy environment (mainnet for production).

##### expectedDecimals

> **expectedDecimals**: `number`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L96)

Expected Solana mint decimals; must match the bridge's wrap setup.

##### expectedScalerExponent

> **expectedScalerExponent**: `number`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:98](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L98)

Expected bridge scaler exponent.

##### solanaMintMetadataFetcher

> **solanaMintMetadataFetcher**: [`SolanaMintMetadataFetcher`](#solanamintmetadatafetcher)

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:102](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L102)

Solana mint metadata fetcher (inject to avoid hardcoding an RPC).

***

### VerifyCreatorSolanaMintParityResult

> **VerifyCreatorSolanaMintParityResult** = `object`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:105](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L105)

#### Properties

##### adapterAddress

> **adapterAddress**: `Address`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:108](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L108)

##### adapterRegisteredDecimals

> **adapterRegisteredDecimals**: `number` \| `null`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:116](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L116)

##### adapterRegisteredMint

> **adapterRegisteredMint**: `Hex` \| `null`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:115](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L115)

##### baseName

> **baseName**: `string` \| `null`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:109](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L109)

##### baseSymbol

> **baseSymbol**: `string` \| `null`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:110](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L110)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:107](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L107)

##### drift

> **drift**: `string`[]

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:119](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L119)

##### expectedMintBytes32

> **expectedMintBytes32**: `Hex` \| `null`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:114](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L114)

##### expectedMintPubkey

> **expectedMintPubkey**: `string` \| `null`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:113](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L113)

##### lowercaseName

> **lowercaseName**: `string` \| `null`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:111](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L111)

##### lowercaseSymbol

> **lowercaseSymbol**: `string` \| `null`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:112](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L112)

##### matched

> **matched**: `boolean`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:106](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L106)

##### solanaOnchainName

> **solanaOnchainName**: `string` \| `null`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:117](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L117)

##### solanaOnchainSymbol

> **solanaOnchainSymbol**: `string` \| `null`

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:118](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L118)

## Variables

### SOLANA\_BRIDGE\_ADAPTER\_VIEW\_ABI

> `const` **SOLANA\_BRIDGE\_ADAPTER\_VIEW\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"token"`; `type`: `"address"`; \}\]; `name`: `"isRegistered"`; `outputs`: readonly \[\{ `type`: `"bool"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"token"`; `type`: `"address"`; \}\]; `name`: `"tokenToSolanaMint"`; `outputs`: readonly \[\{ `type`: `"bytes32"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"token"`; `type`: `"address"`; \}\]; `name`: `"tokenToSolanaDecimals"`; `outputs`: readonly \[\{ `type`: `"uint8"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L37)

## Functions

### createSolanaRpcMintMetadataFetcher()

> **createSolanaRpcMintMetadataFetcher**(`rpcUrl`): [`SolanaMintMetadataFetcher`](#solanamintmetadatafetcher)

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:286](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L286)

Convenience wrapper: build a `SolanaMintMetadataFetcher` that calls the
Solana JSON-RPC `getAccountInfo` with `jsonParsed` encoding and extracts
the Token-2022 tokenMetadata extension fields.

#### Parameters

##### rpcUrl

`string`

#### Returns

[`SolanaMintMetadataFetcher`](#solanamintmetadatafetcher)

***

### verifyCreatorSolanaMintParity()

> **verifyCreatorSolanaMintParity**(`input`): `Promise`\<[`VerifyCreatorSolanaMintParityResult`](#verifycreatorsolanamintparityresult)\>

Defined in: [server/\_lib/onchain/verifyCreatorSolanaMintParity.ts:122](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts#L122)

#### Parameters

##### input

[`VerifyCreatorSolanaMintParityInput`](#verifycreatorsolanamintparityinput)

#### Returns

`Promise`\<[`VerifyCreatorSolanaMintParityResult`](#verifycreatorsolanamintparityresult)\>
