[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/onchain/solanaWrappedMintPda

# server/\_lib/onchain/solanaWrappedMintPda

## Type Aliases

### BridgeDeployEnv

> **BridgeDeployEnv** = keyof *typeof* [`BRIDGE_PROGRAM_BY_ENV`](#bridge_program_by_env)

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L32)

***

### DeriveWrappedMintInput

> **DeriveWrappedMintInput** = `object`

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L34)

#### Properties

##### decimals

> **decimals**: `number`

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L40)

Solana mint decimals (Token-2022 mint header).

##### deployEnv

> **deployEnv**: [`BridgeDeployEnv`](#bridgedeployenv)

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L46)

Which deploy environment's bridge program to target.

##### name

> **name**: `string`

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L36)

Must match `wrap-token`'s `--name` verbatim (case and all).

##### remoteToken

> **remoteToken**: `Address`

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L42)

Base ERC-20 address the mint bridges to. Checksummed or lowercase both work.

##### scalerExponent

> **scalerExponent**: `number`

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L44)

Bridge scaler exponent (amount conversion factor between Base and Solana).

##### symbol

> **symbol**: `string`

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L38)

Must match `wrap-token`'s `--symbol` verbatim.

***

### DeriveWrappedMintOutput

> **DeriveWrappedMintOutput** = `object`

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L49)

#### Properties

##### bridgeProgram

> **bridgeProgram**: `string`

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L52)

##### metadataHash

> **metadataHash**: `Hex`

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L53)

##### mintBytes32

> **mintBytes32**: `Hex`

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L51)

##### mintPubkey

> **mintPubkey**: `string`

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L50)

## Variables

### BRIDGE\_PROGRAM\_BY\_ENV

> `const` **BRIDGE\_PROGRAM\_BY\_ENV**: `object`

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L26)

#### Type Declaration

##### mainnet

> `readonly` **mainnet**: `"HNCne2FkVaNghhjKXapxJzPaBvAKDG1Ge3gqhZyfVWLM"` = `'HNCne2FkVaNghhjKXapxJzPaBvAKDG1Ge3gqhZyfVWLM'`

##### testnet-alpha

> `readonly` **testnet-alpha**: `"6YpL1h2a9u6LuNVi55vAes36xNszt2UDm3Zk1kj4WSBm"` = `'6YpL1h2a9u6LuNVi55vAes36xNszt2UDm3Zk1kj4WSBm'`

##### testnet-prod

> `readonly` **testnet-prod**: `"7c6mteAcTXaQ1MFBCrnuzoZVTTAEfZwa6wgy4bqX3KXC"` = `'7c6mteAcTXaQ1MFBCrnuzoZVTTAEfZwa6wgy4bqX3KXC'`

***

### WRAPPED\_TOKEN\_SEED

> `const` **WRAPPED\_TOKEN\_SEED**: `Buffer`\<`ArrayBuffer`\>

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L24)

## Functions

### deriveWrappedMintPda()

> **deriveWrappedMintPda**(`input`): [`DeriveWrappedMintOutput`](#derivewrappedmintoutput)

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:77](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L77)

Deterministically compute the Solana mint PDA for a base/bridge
wrapped token. Pure function: does NOT require a Solana RPC.

This is the authoritative derivation -- any code path that needs to
know a wrapped mint's address MUST call this. The `mine-solana-mint-vanity`
script and the external bridge CLI use the same algorithm.

#### Parameters

##### input

[`DeriveWrappedMintInput`](#derivewrappedmintinput)

#### Returns

[`DeriveWrappedMintOutput`](#derivewrappedmintoutput)

***

### solanaPubkeyToBytes32()

> **solanaPubkeyToBytes32**(`pubkey`): `` `0x${string}` ``

Defined in: [server/\_lib/onchain/solanaWrappedMintPda.ts:132](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaWrappedMintPda.ts#L132)

Convert a Solana pubkey (base58) to the 32-byte hex form the Base
`SolanaBridgeAdapter` stores in `tokenToSolanaMint`. Useful when
comparing a derived PDA to what's registered onchain.

#### Parameters

##### pubkey

`string`

#### Returns

`` `0x${string}` ``
