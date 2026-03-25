import type { Hex } from 'viem'

/**
 * Base Builder Codes attribution references:
 * - Privy recipe: https://docs.privy.io/recipes/evm/base-builder-codes
 * - Base app developer guide: https://docs.base.org/base-chain/builder-codes/app-developers
 * - ERC-8021 marker validation: https://docs.base.org/base-chain/builder-codes/builder-codes-faq
 *
 * Notes:
 * - Wagmi `createConfig({ dataSuffix })` is global and applies to all configured chains.
 * - Base rewards are currently scoped to Base mainnet + Base Sepolia.
 * - For flows where we control payload composition directly, we chain-gate suffix
 *   injection to Base/Base Sepolia.
 */

type EnvLike = Record<string, unknown>

const BASE_MAINNET_CHAIN_ID = 8453
const BASE_SEPOLIA_CHAIN_ID = 84532
const ERC_8021_REPEATING_MARKER_HEX = '8021'.repeat(8)
const ERC_8021_SCHEMA_ID_0_HEX = '00'
const MISSING_ENV_WARNING =
  '[BuilderCodes] Missing builder code config. Set VITE_BASE_BUILDER_CODES (preferred) or VITE_BASE_DATA_SUFFIX.'

let missingEnvWarned = false
let allChainsWarningEmitted = false

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asEnvRecord(env: unknown): EnvLike {
  return (env && typeof env === 'object' ? env : {}) as EnvLike
}

function readEnvString(env: EnvLike, key: string): string | null {
  return asTrimmedString(env[key])
}

function isDevRuntime(env: EnvLike): boolean {
  const raw = env.DEV
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'string') return raw.trim().toLowerCase() === 'true'
  return false
}

function isProdRuntime(env: EnvLike): boolean {
  const raw = env.PROD
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'string') return raw.trim().toLowerCase() === 'true'
  return false
}

function warnMissingConfigOnce(): void {
  if (missingEnvWarned) return
  missingEnvWarned = true
  console.warn(MISSING_ENV_WARNING)
}

function normalizeHex(rawHex: string): Hex {
  const prefixed = rawHex.startsWith('0x') ? rawHex : `0x${rawHex}`
  if (!/^0x[0-9a-fA-F]+$/.test(prefixed)) {
    throw new Error('[BuilderCodes] VITE_BASE_DATA_SUFFIX must be valid hex.')
  }
  return prefixed as Hex
}

function byteToHex(value: number): string {
  return value.toString(16).padStart(2, '0')
}

function asciiToHex(value: string): string {
  let result = ''
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index)
    if (codePoint > 0x7f) {
      throw new Error('[BuilderCodes] Builder codes must be ASCII strings.')
    }
    result += byteToHex(codePoint)
  }
  return result
}

function encodeBuilderCodesDataSuffix(codes: readonly string[]): Hex {
  const codesHex = asciiToHex(codes.join(','))
  const codesByteLength = codesHex.length / 2
  if (codesByteLength > 0xff) {
    throw new Error('[BuilderCodes] Builder code suffix exceeds ERC-8021 schema-0 length limit.')
  }
  return `0x${codesHex}${byteToHex(codesByteLength)}${ERC_8021_SCHEMA_ID_0_HEX}${ERC_8021_REPEATING_MARKER_HEX}` as Hex
}

export function parseBuilderCodes(raw: string | null | undefined): string[] {
  return String(raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function resolveBuilderCodes(envInput: unknown = import.meta.env): string[] {
  const env = asEnvRecord(envInput)
  const pluralCodes = parseBuilderCodes(readEnvString(env, 'VITE_BASE_BUILDER_CODES'))
  const singularCode = parseBuilderCodes(readEnvString(env, 'VITE_BASE_BUILDER_CODE'))
  return Array.from(new Set([...pluralCodes, ...singularCode]))
}

export function resolveDataSuffix(envInput: unknown = import.meta.env): Hex | undefined {
  const env = asEnvRecord(envInput)
  const codes = resolveBuilderCodes(env)
  if (codes.length > 0) {
    return encodeBuilderCodesDataSuffix(codes)
  }

  const precomputed = readEnvString(env, 'VITE_BASE_DATA_SUFFIX')
  if (precomputed) {
    return normalizeHex(precomputed)
  }

  const inBrowser = typeof window !== 'undefined'
  if (isDevRuntime(env) && inBrowser) {
    throw new Error(MISSING_ENV_WARNING)
  }

  if (isProdRuntime(env) || inBrowser) {
    warnMissingConfigOnce()
  }
  return undefined
}

export function isBaseChain(chainId: number | null | undefined): boolean {
  return chainId === BASE_MAINNET_CHAIN_ID || chainId === BASE_SEPOLIA_CHAIN_ID
}

export function appendDataSuffixToHex(data: Hex | undefined, dataSuffix: Hex): Hex {
  const baseData = (data && data !== '0x' ? data : '0x') as Hex
  const baseDataLower = baseData.toLowerCase()
  const suffixBody = dataSuffix.slice(2)
  if (suffixBody.length === 0) return baseData
  if (baseDataLower.endsWith(suffixBody.toLowerCase())) return baseData
  return `${baseData}${suffixBody}` as Hex
}

export function appendBuilderSuffixToHex(
  data: Hex | undefined,
  options?: {
    chainId?: number | null
    dataSuffix?: Hex | undefined
  },
): Hex | undefined {
  const dataSuffix = options?.dataSuffix ?? DATA_SUFFIX
  if (!dataSuffix) return data
  if (options && 'chainId' in options && !isBaseChain(options.chainId)) return data
  return appendDataSuffixToHex(data, dataSuffix)
}

export function hasErc8021RepeatingMarker(hexValue: Hex | undefined): boolean {
  if (!hexValue || !/^0x[0-9a-fA-F]+$/.test(hexValue)) return false
  return hexValue.slice(2).toLowerCase().endsWith(ERC_8021_REPEATING_MARKER_HEX)
}

export function payloadEndsWithDataSuffix(payload: Hex | undefined, dataSuffix: Hex): boolean {
  if (!payload || !/^0x[0-9a-fA-F]+$/.test(payload)) return false
  const payloadBody = payload.slice(2).toLowerCase()
  const suffixBody = dataSuffix.slice(2).toLowerCase()
  return suffixBody.length > 0 && payloadBody.endsWith(suffixBody)
}

export function warnGlobalWagmiDataSuffixBehavior(
  dataSuffix: Hex | undefined = DATA_SUFFIX,
  envInput: unknown = import.meta.env,
): void {
  if (!dataSuffix || allChainsWarningEmitted) return
  const env = asEnvRecord(envInput)
  if (!isDevRuntime(env)) return
  allChainsWarningEmitted = true
  console.warn(
    '[BuilderCodes] wagmi config `dataSuffix` is global and may append on non-Base chains. ' +
      'Base rewards are scoped to Base mainnet + Base Sepolia.',
  )
}

export const DATA_SUFFIX = resolveDataSuffix(import.meta.env)
export const ERC_8021_MARKER_HEX = ERC_8021_REPEATING_MARKER_HEX
