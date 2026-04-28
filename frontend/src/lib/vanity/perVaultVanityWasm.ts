import vanityWasmUrl from './vanity_salt_grinder.wasm?url'

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

type VanityWasmExports = {
  memory: WebAssembly.Memory
  vanity_alloc(len: number): number
  vanity_dealloc(ptr: number, len: number): void
  per_vault_version_search(ptr: number, len: number): number
  vanity_output_ptr(): number
  vanity_output_len(): number
}

type VanityWasmEnvelope =
  | { ok: true; result: PerVaultVanitySearchResult }
  | { ok: false; error?: string }

let wasmExportsPromise: Promise<VanityWasmExports> | null = null

export async function findPerVaultVanityVersionWithWasm(
  input: PerVaultVanitySearchInput,
): Promise<PerVaultVanitySearchResult> {
  const exports = await loadVanityWasm()
  const encoder = new TextEncoder()
  const bytes = encoder.encode(JSON.stringify(input))
  const ptr = exports.vanity_alloc(bytes.length)
  try {
    new Uint8Array(exports.memory.buffer, ptr, bytes.length).set(bytes)
    exports.per_vault_version_search(ptr, bytes.length)
  } finally {
    exports.vanity_dealloc(ptr, bytes.length)
  }

  const outPtr = exports.vanity_output_ptr()
  const outLen = exports.vanity_output_len()
  const output = new TextDecoder().decode(new Uint8Array(exports.memory.buffer, outPtr, outLen))
  const parsed = JSON.parse(output) as VanityWasmEnvelope
  if (!parsed.ok) {
    throw new Error(parsed.error || 'Rust vanity search failed')
  }
  return parsed.result
}

async function loadVanityWasm(): Promise<VanityWasmExports> {
  if (!wasmExportsPromise) {
    wasmExportsPromise = instantiateVanityWasm()
  }
  return wasmExportsPromise
}

async function instantiateVanityWasm(): Promise<VanityWasmExports> {
  const response = await fetch(vanityWasmUrl)
  if (!response.ok) {
    throw new Error(`Failed to load vanity WASM: ${response.status}`)
  }
  const bytes = await response.arrayBuffer()
  const imports = {
    __wbindgen_placeholder__: {
      __wbindgen_describe() {
        // Present because transitive Rust deps enable wasm-bindgen metadata.
      },
      __wbg___wbindgen_throw_6b64449b9b9ed33c(ptr: number, len: number) {
        throw new Error(`Rust vanity WASM threw at ${ptr}:${len}`)
      },
    },
    __wbindgen_externref_xform__: {
      __wbindgen_externref_table_set_null() {
        // Not used by the raw C-ABI entrypoint.
      },
      __wbindgen_externref_table_grow() {
        return -1
      },
    },
  }
  const { instance } = await WebAssembly.instantiate(bytes, imports)
  return instance.exports as unknown as VanityWasmExports
}
