/**
 * Verify that a creator coin's Solana bridge-wrapped mint matches the
 * strict-parity / lowercase-coerced policy enforced by this repo.
 *
 * This is the programmatic check that answers: "is this creator's Solana
 * identity in the right state, or did something drift?" It's intended to
 * be called by operator scripts pre-deploy, by CI, and potentially by a
 * status endpoint. Pure in the sense that it makes no state changes;
 * only reads Base + Solana.
 *
 * Policy (see `docs/operations/solana-bridge-naming-invariant.md`):
 *   1. Solana mint name/symbol MUST equal the creator coin's Base ERC-20
 *      `name()` / `symbol()` with `.toLowerCase()` applied.
 *   2. The adapter at `CONTRACTS.solanaBridgeAdapter` MUST map the
 *      creator coin to the PDA derived from those lowercased values.
 *   3. The on-chain Token-2022 tokenMetadata extension on that mint MUST
 *      report the same lowercased name and symbol.
 *
 * Returns a structured report with a `matched` boolean and a list of
 * `drift` entries naming each invariant that failed. Callers should
 * surface `drift` verbatim to operators / logs.
 */

import { getAddress, type Abi, type Address, type Hex } from 'viem'

import {
  ERC20_METADATA_ABI,
  normalizeWrapTokenName,
  normalizeWrapTokenSymbol,
} from './solanaBridgeTokenMetadata.js'
import {
  deriveWrappedMintPda,
  solanaPubkeyToBytes32,
  type BridgeDeployEnv,
} from './solanaWrappedMintPda.js'

export const SOLANA_BRIDGE_ADAPTER_VIEW_ABI = [
  {
    type: 'function',
    name: 'isRegistered',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'tokenToSolanaMint',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'tokenToSolanaDecimals',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'uint8' }],
  },
] as const

const ZERO_BYTES32: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000'

type BasePublicClient = {
  readContract: (params: {
    address: Address
    abi: Abi | readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
}

/**
 * Minimal Solana RPC interface used for the mint metadata read. Callers
 * inject a fetcher so the verifier stays isomorphic (no global fetch
 * dependency, easy to mock in tests).
 */
export type SolanaMintMetadataFetcher = (
  mintPubkey: string,
) => Promise<{
  name: string | null
  symbol: string | null
  decimals: number | null
  supply: string | null
  /** Present if the mint has the Token-2022 tokenMetadata extension at all. */
  hasTokenMetadataExtension: boolean
}>

export type VerifyCreatorSolanaMintParityInput = {
  /** The Base creator-coin ERC-20 address to verify. */
  creatorToken: Address
  /** The `SolanaBridgeAdapter` address expected to hold the mapping. */
  adapterAddress: Address
  /** Bridge deploy environment (mainnet for production). */
  deployEnv: BridgeDeployEnv
  /** Expected Solana mint decimals; must match the bridge's wrap setup. */
  expectedDecimals: number
  /** Expected bridge scaler exponent. */
  expectedScalerExponent: number
  /** viem client for Base reads. */
  basePublicClient: BasePublicClient
  /** Solana mint metadata fetcher (inject to avoid hardcoding an RPC). */
  solanaMintMetadataFetcher: SolanaMintMetadataFetcher
}

export type VerifyCreatorSolanaMintParityResult = {
  matched: boolean
  creatorToken: Address
  adapterAddress: Address
  baseName: string | null
  baseSymbol: string | null
  lowercaseName: string | null
  lowercaseSymbol: string | null
  expectedMintPubkey: string | null
  expectedMintBytes32: Hex | null
  adapterRegisteredMint: Hex | null
  adapterRegisteredDecimals: number | null
  solanaOnchainName: string | null
  solanaOnchainSymbol: string | null
  drift: string[]
}

export async function verifyCreatorSolanaMintParity(
  input: VerifyCreatorSolanaMintParityInput,
): Promise<VerifyCreatorSolanaMintParityResult> {
  const creatorToken = getAddress(input.creatorToken)
  const adapterAddress = getAddress(input.adapterAddress)
  const drift: string[] = []

  // 1. Read Base ERC-20 name/symbol.
  let baseName: string | null = null
  let baseSymbol: string | null = null
  try {
    const [nameRaw, symbolRaw] = await Promise.all([
      input.basePublicClient.readContract({
        address: creatorToken,
        abi: ERC20_METADATA_ABI,
        functionName: 'name',
      }),
      input.basePublicClient.readContract({
        address: creatorToken,
        abi: ERC20_METADATA_ABI,
        functionName: 'symbol',
      }),
    ])
    baseName = typeof nameRaw === 'string' ? nameRaw : null
    baseSymbol = typeof symbolRaw === 'string' ? symbolRaw : null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    drift.push(`base_erc20_read_failed: ${message}`)
  }

  const lowercaseName = normalizeWrapTokenName(baseName ?? '')
  const lowercaseSymbol = normalizeWrapTokenSymbol(baseSymbol ?? '')
  if (!lowercaseName) drift.push('base_name_fails_normalization (empty / null-byte / overflow)')
  if (!lowercaseSymbol) drift.push('base_symbol_fails_normalization (empty / null-byte / overflow)')

  let expectedMintPubkey: string | null = null
  let expectedMintBytes32: Hex | null = null
  if (lowercaseName && lowercaseSymbol) {
    const derived = deriveWrappedMintPda({
      name: lowercaseName,
      symbol: lowercaseSymbol,
      decimals: input.expectedDecimals,
      remoteToken: creatorToken,
      scalerExponent: input.expectedScalerExponent,
      deployEnv: input.deployEnv,
    })
    expectedMintPubkey = derived.mintPubkey
    expectedMintBytes32 = derived.mintBytes32
  }

  // 2. Read adapter's registered mint + decimals for this token.
  let adapterRegisteredMint: Hex | null = null
  let adapterRegisteredDecimals: number | null = null
  let adapterIsRegistered = false
  try {
    const [isReg, mintRaw, decRaw] = await Promise.all([
      input.basePublicClient.readContract({
        address: adapterAddress,
        abi: SOLANA_BRIDGE_ADAPTER_VIEW_ABI,
        functionName: 'isRegistered',
        args: [creatorToken],
      }),
      input.basePublicClient.readContract({
        address: adapterAddress,
        abi: SOLANA_BRIDGE_ADAPTER_VIEW_ABI,
        functionName: 'tokenToSolanaMint',
        args: [creatorToken],
      }),
      input.basePublicClient.readContract({
        address: adapterAddress,
        abi: SOLANA_BRIDGE_ADAPTER_VIEW_ABI,
        functionName: 'tokenToSolanaDecimals',
        args: [creatorToken],
      }),
    ])
    adapterIsRegistered = Boolean(isReg)
    adapterRegisteredMint = (mintRaw as Hex) ?? null
    adapterRegisteredDecimals = typeof decRaw === 'number' ? decRaw : Number(decRaw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    drift.push(`adapter_read_failed: ${message}`)
  }

  if (!adapterIsRegistered) drift.push('adapter_not_registered (tokenToSolanaMint is zero)')
  if (
    adapterRegisteredMint &&
    adapterRegisteredMint.toLowerCase() === ZERO_BYTES32.toLowerCase()
  ) {
    drift.push('adapter_registered_mint_is_zero')
  }
  if (
    expectedMintBytes32 &&
    adapterRegisteredMint &&
    adapterRegisteredMint.toLowerCase() !== expectedMintBytes32.toLowerCase()
  ) {
    drift.push(
      `adapter_mint_mismatch: registered=${adapterRegisteredMint} expected=${expectedMintBytes32}`,
    )
  }
  if (
    adapterRegisteredDecimals !== null &&
    Number.isFinite(adapterRegisteredDecimals) &&
    adapterRegisteredDecimals !== input.expectedDecimals
  ) {
    drift.push(
      `adapter_decimals_mismatch: registered=${adapterRegisteredDecimals} expected=${input.expectedDecimals}`,
    )
  }

  // 3. Read the live Solana mint metadata via the injected fetcher.
  let solanaOnchainName: string | null = null
  let solanaOnchainSymbol: string | null = null
  if (expectedMintPubkey) {
    try {
      const meta = await input.solanaMintMetadataFetcher(expectedMintPubkey)
      solanaOnchainName = meta.name
      solanaOnchainSymbol = meta.symbol
      if (!meta.hasTokenMetadataExtension) {
        drift.push(
          `solana_mint_missing_tokenMetadata_extension (mint=${expectedMintPubkey} is either unwrapped or uses Metaplex off-chain metadata)`,
        )
      }
      if (meta.decimals !== null && meta.decimals !== input.expectedDecimals) {
        drift.push(
          `solana_mint_decimals_mismatch: onchain=${meta.decimals} expected=${input.expectedDecimals}`,
        )
      }
      if (lowercaseName && meta.name !== null && meta.name !== lowercaseName) {
        drift.push(`solana_mint_name_mismatch: onchain="${meta.name}" expected="${lowercaseName}"`)
      }
      if (lowercaseSymbol && meta.symbol !== null && meta.symbol !== lowercaseSymbol) {
        drift.push(
          `solana_mint_symbol_mismatch: onchain="${meta.symbol}" expected="${lowercaseSymbol}"`,
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      drift.push(`solana_metadata_read_failed: ${message}`)
    }
  }

  return {
    matched: drift.length === 0,
    creatorToken,
    adapterAddress,
    baseName,
    baseSymbol,
    lowercaseName,
    lowercaseSymbol,
    expectedMintPubkey,
    expectedMintBytes32,
    adapterRegisteredMint,
    adapterRegisteredDecimals,
    solanaOnchainName,
    solanaOnchainSymbol,
    drift,
  }
}

/**
 * Convenience wrapper: build a `SolanaMintMetadataFetcher` that calls the
 * Solana JSON-RPC `getAccountInfo` with `jsonParsed` encoding and extracts
 * the Token-2022 tokenMetadata extension fields.
 */
export function createSolanaRpcMintMetadataFetcher(rpcUrl: string): SolanaMintMetadataFetcher {
  return async (mintPubkey: string) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [mintPubkey, { encoding: 'jsonParsed' }],
    })
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })
    if (!response.ok) {
      throw new Error(`solana rpc http ${response.status}`)
    }
    const json = (await response.json()) as {
      result?: {
        value?: {
          data?: { parsed?: { info?: Record<string, unknown> } }
        } | null
      }
    }
    const info = json?.result?.value?.data?.parsed?.info as Record<string, unknown> | undefined
    if (!info) {
      return { name: null, symbol: null, decimals: null, supply: null, hasTokenMetadataExtension: false }
    }
    const decimalsRaw = info.decimals
    const decimals = typeof decimalsRaw === 'number' ? decimalsRaw : Number(decimalsRaw ?? NaN)
    const supplyRaw = info.supply
    const supply = typeof supplyRaw === 'string' ? supplyRaw : supplyRaw == null ? null : String(supplyRaw)
    const exts = (info.extensions as Array<{ extension?: string; state?: Record<string, unknown> }> | undefined) ?? []
    const tokenMeta = exts.find((ext) => ext?.extension === 'tokenMetadata')
    if (!tokenMeta) {
      return {
        name: null,
        symbol: null,
        decimals: Number.isFinite(decimals) ? decimals : null,
        supply,
        hasTokenMetadataExtension: false,
      }
    }
    const state = (tokenMeta.state ?? {}) as Record<string, unknown>
    const nameRaw = state.name
    const symbolRaw = state.symbol
    return {
      name: typeof nameRaw === 'string' ? nameRaw : null,
      symbol: typeof symbolRaw === 'string' ? symbolRaw : null,
      decimals: Number.isFinite(decimals) ? decimals : null,
      supply,
      hasTokenMetadataExtension: true,
    }
  }
}
