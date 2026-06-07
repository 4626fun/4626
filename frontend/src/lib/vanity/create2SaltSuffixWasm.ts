import type { Address, Hex } from 'viem'

import {
  instantiateVanityWasmFromBytes,
  invokeVanityWasmSearch,
  type VanityWasmExports,
} from '@/lib/vanity/vanityWasmRuntime'
import { resolvePerVaultVanityWasmUrl } from '@/lib/vanity/perVaultVanityWasm'

export type Create2SaltSuffixSearchInput = {
  create2Deployer: Address
  initCodeHash: Hex
  startAt: Hex
  suffix: string
  maxAttempts: number
}

export type Create2SaltSuffixSearchResult = {
  salt: Hex
  predictedAddress: Address
  attempts: number
}

type WasmEnvelope =
  | { ok: true; result: Create2SaltSuffixSearchResult }
  | { ok: false; error?: string }

let wasmExportsPromise: Promise<VanityWasmExports> | null = null

export async function findCreate2SaltForSuffixWithWasm(
  input: Create2SaltSuffixSearchInput,
): Promise<Create2SaltSuffixSearchResult> {
  const exports = await loadVanityWasm()
  const output = invokeVanityWasmSearch(exports, 'create2_salt_suffix_search', {
    create2Deployer: input.create2Deployer,
    initCodeHash: input.initCodeHash,
    startAt: input.startAt,
    suffix: input.suffix,
    maxAttempts: Math.max(1, Math.floor(input.maxAttempts)),
  })
  const parsed = JSON.parse(output) as WasmEnvelope
  if (!parsed.ok) {
    throw new Error(parsed.error || 'Rust share suffix vanity search failed')
  }
  return parsed.result
}

async function loadVanityWasm(): Promise<VanityWasmExports> {
  if (!wasmExportsPromise) {
    wasmExportsPromise = instantiateBrowserVanityWasm()
  }
  return wasmExportsPromise
}

async function instantiateBrowserVanityWasm(): Promise<VanityWasmExports> {
  const vanityWasmUrl = resolvePerVaultVanityWasmUrl()
  if (!vanityWasmUrl) {
    throw new Error('Vanity WASM URL is not configured')
  }
  const response = await fetch(vanityWasmUrl)
  if (!response.ok) {
    throw new Error(`Failed to load vanity WASM: ${response.status}`)
  }
  return instantiateVanityWasmFromBytes(await response.arrayBuffer())
}