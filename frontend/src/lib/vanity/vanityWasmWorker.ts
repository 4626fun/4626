/// <reference lib="webworker" />

import {
  instantiateVanityWasmFromBytes,
  invokeVanityWasmSearch,
  type VanityWasmExports,
} from '@/lib/vanity/vanityWasmRuntime'

type VanityWorkerRequest = {
  id: number
  entrypoint: 'per_vault_version_search' | 'create2_salt_suffix_search'
  input: unknown
  wasmUrl: string
}

type VanityWorkerResponse =
  | { id: number; ok: true; output: string }
  | { id: number; ok: false; error: string }

let wasmExports: VanityWasmExports | null = null
let wasmUrlLoaded: string | null = null

async function ensureWasmLoaded(wasmUrl: string): Promise<VanityWasmExports> {
  if (wasmExports && wasmUrlLoaded === wasmUrl) return wasmExports
  const response = await fetch(wasmUrl)
  if (!response.ok) {
    throw new Error(`Failed to load vanity WASM: ${response.status}`)
  }
  wasmExports = await instantiateVanityWasmFromBytes(await response.arrayBuffer())
  wasmUrlLoaded = wasmUrl
  return wasmExports
}

self.onmessage = async (event: MessageEvent<VanityWorkerRequest>) => {
  const { id, entrypoint, input, wasmUrl } = event.data
  try {
    const exports = await ensureWasmLoaded(wasmUrl)
    const output = invokeVanityWasmSearch(exports, entrypoint, input)
    const response: VanityWorkerResponse = { id, ok: true, output }
    self.postMessage(response)
  } catch (error) {
    const response: VanityWorkerResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error ?? 'vanity_worker_failed'),
    }
    self.postMessage(response)
  }
}