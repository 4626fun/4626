import {
  instantiateVanityWasmFromBytes,
  invokeVanityWasmSearch,
  type VanityWasmExports,
} from '@/lib/vanity/vanityWasmRuntime'
import { invokeVanityWasmInWorker, isVanityWasmWorkerEnabled } from '@/lib/vanity/vanityWasmWorkerClient'

const DEFAULT_VANITY_WASM_PUBLIC_PATH = '/vanity/vanity_salt_grinder.wasm'

export function resolvePerVaultVanityWasmUrl(): string | null {
  const fromEnv = (import.meta.env.VITE_VANITY_WASM_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv
  // Served from frontend/public/vanity/ after `pnpm build:vanity-wasm`
  return DEFAULT_VANITY_WASM_PUBLIC_PATH
}

export function isPerVaultVanityWasmConfigured(): boolean {
  return resolvePerVaultVanityWasmUrl() != null
}

export type PerVaultVanitySearchInput = {
  create2Deployer: string
  creatorToken: string
  owner: string
  chainId: number
  baseVersion: string
  vaultPrefix?: string | null
  shareSuffix?: string | null
  startAttempt?: number
  maxAttempts: number
  vaultInitCodeHash?: string | null
  shareOftInitCodeHash?: string | null
  shareSymbol?: string | null
}

export type PerVaultVanitySearchResult = {
  version: string
  attempt: number
  attempts: number
  vaultAddress: string | null
  shareOftAddress: string | null
  vaultSalt: string | null
  shareOftSalt: string | null
}

type VanityWasmEnvelope =
  | { ok: true; result: PerVaultVanitySearchResult }
  | { ok: false; error?: string }

let wasmExportsPromise: Promise<VanityWasmExports> | null = null

export async function findPerVaultVanityVersionWithWasm(
  input: PerVaultVanitySearchInput,
): Promise<PerVaultVanitySearchResult> {
  const output = await invokeVanityWasmSearchOutput('per_vault_version_search', input)
  const parsed = JSON.parse(output) as VanityWasmEnvelope
  if (!parsed.ok) {
    throw new Error(parsed.error || 'Rust vanity search failed')
  }
  return parsed.result
}

async function invokeVanityWasmSearchOutput(
  entrypoint: 'per_vault_version_search',
  input: PerVaultVanitySearchInput,
): Promise<string> {
  if (isVanityWasmWorkerEnabled()) {
    try {
      return await invokeVanityWasmInWorker(entrypoint, input)
    } catch {
      // Fall back to main-thread WASM when the worker is unavailable.
    }
  }
  const exports = await loadVanityWasm()
  return invokeVanityWasmSearch(exports, entrypoint, input)
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