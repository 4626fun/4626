/**
 * Derive the deterministic Solana mint PDA for a Coinbase base/bridge
 * wrapped token. The mint identity is cryptographically bound to its
 * metadata -- there is no in-place metadata update on the bridge program
 * (see `docs/operations/solana-bridge-naming-invariant.md`), so this
 * derivation IS the source of truth for what a creator coin's bridge-
 * wrapped mint address must be on any given Solana deploy environment.
 *
 * Seed scheme (must stay byte-for-byte identical to the base/bridge
 * Solana program's `wrap_token` instruction):
 *
 *   metadataBytes = u64_le(name.len) || name || u64_le(symbol.len) || symbol || remoteToken || u8(scalerExponent)
 *   metadataHash  = keccak256(metadataBytes)
 *   mint_pda      = find_program_address(["wrapped_token", u8(decimals), metadataHash], bridgeProgram)
 *
 * The bridge program IDs per deploy environment are pinned below. They
 * come from the official `base/bridge` repo's `BRIDGE_PROGRAM_BY_ENV`
 * map; do not change them without verifying on an explorer.
 */

import { PublicKey } from '@solana/web3.js'
import { getAddress, isAddress, keccak256, type Address, type Hex } from 'viem'

export const WRAPPED_TOKEN_SEED = Buffer.from('wrapped_token')

export const BRIDGE_PROGRAM_BY_ENV = {
  mainnet: 'HNCne2FkVaNghhjKXapxJzPaBvAKDG1Ge3gqhZyfVWLM',
  'testnet-prod': '7c6mteAcTXaQ1MFBCrnuzoZVTTAEfZwa6wgy4bqX3KXC',
  'testnet-alpha': '6YpL1h2a9u6LuNVi55vAes36xNszt2UDm3Zk1kj4WSBm',
} as const

export type BridgeDeployEnv = keyof typeof BRIDGE_PROGRAM_BY_ENV

export type DeriveWrappedMintInput = {
  /** Must match `wrap-token`'s `--name` verbatim (case and all). */
  name: string
  /** Must match `wrap-token`'s `--symbol` verbatim. */
  symbol: string
  /** Solana mint decimals (Token-2022 mint header). */
  decimals: number
  /** Base ERC-20 address the mint bridges to. Checksummed or lowercase both work. */
  remoteToken: Address
  /** Bridge scaler exponent (amount conversion factor between Base and Solana). */
  scalerExponent: number
  /** Which deploy environment's bridge program to target. */
  deployEnv: BridgeDeployEnv
}

export type DeriveWrappedMintOutput = {
  mintPubkey: string
  mintBytes32: Hex
  bridgeProgram: string
  metadataHash: Hex
}

function encodeU64LE(value: bigint): Buffer {
  if (value < 0n || value > 0xffff_ffff_ffff_ffffn) {
    throw new Error('encodeU64LE: value out of range')
  }
  const out = Buffer.alloc(8)
  let v = value
  for (let i = 0; i < 8; i += 1) {
    out[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return out
}

/**
 * Deterministically compute the Solana mint PDA for a base/bridge
 * wrapped token. Pure function: does NOT require a Solana RPC.
 *
 * This is the authoritative derivation -- any code path that needs to
 * know a wrapped mint's address MUST call this. The `mine-solana-mint-vanity`
 * script and the external bridge CLI use the same algorithm.
 */
export function deriveWrappedMintPda(input: DeriveWrappedMintInput): DeriveWrappedMintOutput {
  if (!isAddress(input.remoteToken)) {
    throw new Error(`deriveWrappedMintPda: invalid remoteToken ${String(input.remoteToken)}`)
  }
  if (input.decimals < 0 || input.decimals > 255) {
    throw new Error(`deriveWrappedMintPda: decimals out of range: ${input.decimals}`)
  }
  if (input.scalerExponent < 0 || input.scalerExponent > 255) {
    throw new Error(`deriveWrappedMintPda: scalerExponent out of range: ${input.scalerExponent}`)
  }
  if (typeof input.name !== 'string' || input.name.length === 0) {
    throw new Error('deriveWrappedMintPda: name must be a non-empty string')
  }
  if (typeof input.symbol !== 'string' || input.symbol.length === 0) {
    throw new Error('deriveWrappedMintPda: symbol must be a non-empty string')
  }

  const bridgeProgram = BRIDGE_PROGRAM_BY_ENV[input.deployEnv]
  if (!bridgeProgram) {
    throw new Error(`deriveWrappedMintPda: unknown deployEnv ${String(input.deployEnv)}`)
  }

  const nameBytes = Buffer.from(input.name, 'utf8')
  const symbolBytes = Buffer.from(input.symbol, 'utf8')
  const remoteTokenBytes = Buffer.from(getAddress(input.remoteToken).slice(2), 'hex')
  const metadataBytes = Buffer.concat([
    encodeU64LE(BigInt(nameBytes.length)),
    nameBytes,
    encodeU64LE(BigInt(symbolBytes.length)),
    symbolBytes,
    remoteTokenBytes,
    Buffer.from([input.scalerExponent]),
  ])
  const metadataHash = keccak256(`0x${metadataBytes.toString('hex')}` as Hex) as Hex
  const metadataHashBytes = Buffer.from(metadataHash.slice(2), 'hex')
  const programKey = new PublicKey(bridgeProgram)
  const [pda] = PublicKey.findProgramAddressSync(
    [WRAPPED_TOKEN_SEED, Buffer.from([input.decimals]), metadataHashBytes],
    programKey,
  )
  const mintPubkey = pda.toBase58()
  const mintBytes32 = (`0x${pda.toBuffer().toString('hex')}` as Hex)
  return {
    mintPubkey,
    mintBytes32,
    bridgeProgram,
    metadataHash,
  }
}

/**
 * Convert a Solana pubkey (base58) to the 32-byte hex form the Base
 * `SolanaBridgeAdapter` stores in `tokenToSolanaMint`. Useful when
 * comparing a derived PDA to what's registered onchain.
 */
export function solanaPubkeyToBytes32(pubkey: string): Hex {
  const pk = new PublicKey(pubkey)
  return `0x${pk.toBuffer().toString('hex')}` as Hex
}
