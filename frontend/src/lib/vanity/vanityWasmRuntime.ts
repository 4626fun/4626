export type VanityWasmExports = {
  memory: WebAssembly.Memory
  vanity_alloc(len: number): number
  vanity_dealloc(ptr: number, len: number): void
  per_vault_version_search(ptr: number, len: number): number
  create2_salt_suffix_search(ptr: number, len: number): number
  vanity_output_ptr(): number
  vanity_output_len(): number
}

export function createVanityWasmImports(): WebAssembly.Imports {
  return {
    __wbindgen_placeholder__: {
      __wbindgen_describe() {},
      __wbg___wbindgen_throw_6b64449b9b9ed33c(ptr: number, len: number) {
        throw new Error(`Rust vanity WASM threw at ${ptr}:${len}`)
      },
    },
    __wbindgen_externref_xform__: {
      __wbindgen_externref_table_set_null() {},
      __wbindgen_externref_table_grow() {
        return -1
      },
    },
  }
}

export async function instantiateVanityWasmFromBytes(bytes: ArrayBuffer | Uint8Array): Promise<VanityWasmExports> {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const instantiated = await WebAssembly.instantiate(buffer, createVanityWasmImports())
  const instance =
    (instantiated as Partial<WebAssembly.WebAssemblyInstantiatedSource>).instance ??
    (instantiated as WebAssembly.Instance)
  return instance.exports as unknown as VanityWasmExports
}

export function readVanityWasmOutput(exports: VanityWasmExports): string {
  const outPtr = exports.vanity_output_ptr()
  const outLen = exports.vanity_output_len()
  return new TextDecoder().decode(new Uint8Array(exports.memory.buffer, outPtr, outLen))
}

export function invokeVanityWasmSearch(
  exports: VanityWasmExports,
  entrypoint: 'per_vault_version_search' | 'create2_salt_suffix_search',
  input: unknown,
): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(JSON.stringify(input))
  const ptr = exports.vanity_alloc(bytes.length)
  try {
    new Uint8Array(exports.memory.buffer, ptr, bytes.length).set(bytes)
    exports[entrypoint](ptr, bytes.length)
  } finally {
    exports.vanity_dealloc(ptr, bytes.length)
  }
  return readVanityWasmOutput(exports)
}