import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { keccak256, type Address, type Hex } from 'viem'

import {
  findDeploymentVersionForVanityTargetsSync,
  type PerVaultVanityVersionSearchParams,
} from '../../../src/lib/deploy/perVaultVanityVersionSearch.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_SERVER_MAX_ATTEMPTS = 50_000_000

type VanityWasmExports = {
  memory: WebAssembly.Memory
  vanity_alloc(len: number): number
  vanity_dealloc(ptr: number, len: number): void
  per_vault_version_search(ptr: number, len: number): number
  vanity_output_ptr(): number
  vanity_output_len(): number
}

type VanityWasmEnvelope =
  | { ok: true; result: { version: string; attempt: number } }
  | { ok: false; error?: string }

let wasmExportsPromise: Promise<VanityWasmExports | null> | null = null

export function readCombinedVanityServerMaxAttempts(): number {
  const raw = String(process.env.DEPLOY_COMBINED_VANITY_SERVER_MAX_TRIES ?? '').trim()
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_SERVER_MAX_ATTEMPTS
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SERVER_MAX_ATTEMPTS
  return Math.min(parsed, 500_000_000)
}

export async function findPerVaultVanityVersionOnServer(
  params: PerVaultVanityVersionSearchParams,
): Promise<{ version: string | null; attempts: number }> {
  const maxTries = Math.max(1, Math.min(Math.floor(params.maxTries), readCombinedVanityServerMaxAttempts()))
  const startAttempt = Math.max(0, Math.floor(params.startAttempt ?? 0))

  const wasm = await loadVanityWasmExports()
  if (wasm) {
    const vaultPrefix = params.vaultPrefix ?? null
    const shareSuffix = params.shareSuffix ?? null
    const input = {
      create2Deployer: params.create2Deployer,
      creatorToken: params.creatorToken,
      owner: params.owner,
      chainId: params.chainId,
      baseVersion: params.baseVersion,
      vaultPrefix,
      shareSuffix,
      startAttempt,
      maxAttempts: maxTries,
      vaultInitCodeHash: vaultPrefix ? keccak256(params.vaultInitCode) : null,
      shareOftInitCodeHash: shareSuffix ? keccak256(params.shareOftInitCode) : null,
      shareSymbol: shareSuffix ? params.shareSymbol : null,
    }
    const encoder = new TextEncoder()
    const bytes = encoder.encode(JSON.stringify(input))
    const ptr = wasm.vanity_alloc(bytes.length)
    try {
      new Uint8Array(wasm.memory.buffer, ptr, bytes.length).set(bytes)
      wasm.per_vault_version_search(ptr, bytes.length)
    } finally {
      wasm.vanity_dealloc(ptr, bytes.length)
    }
    const outPtr = wasm.vanity_output_ptr()
    const outLen = wasm.vanity_output_len()
    const output = new TextDecoder().decode(new Uint8Array(wasm.memory.buffer, outPtr, outLen))
    const parsed = JSON.parse(output) as VanityWasmEnvelope
    if (!parsed.ok) {
      throw new Error(parsed.error || 'Rust vanity search failed')
    }
    return {
      version: parsed.result.version,
      attempts: parsed.result.attempt - startAttempt + 1,
    }
  }

  const version = findDeploymentVersionForVanityTargetsSync({
    ...params,
    maxTries,
    startAttempt,
    preferWasm: false,
  })
  return { version, attempts: maxTries }
}

function resolveVanityWasmPath(): string | null {
  const fromEnv = String(process.env.DEPLOY_VANITY_WASM_PATH ?? '').trim()
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv

  const moduleDir = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(moduleDir, '../../../public/vanity/vanity_salt_grinder.wasm'),
    path.resolve(moduleDir, '../../../../public/vanity/vanity_salt_grinder.wasm'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

async function loadVanityWasmExports(): Promise<VanityWasmExports | null> {
  if (!wasmExportsPromise) {
    wasmExportsPromise = instantiateVanityWasmExports()
  }
  return wasmExportsPromise
}

async function instantiateVanityWasmExports(): Promise<VanityWasmExports | null> {
  const wasmPath = resolveVanityWasmPath()
  if (!wasmPath) return null
  const bytes = fs.readFileSync(wasmPath)
  const imports = {
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
  const { instance } = await WebAssembly.instantiate(bytes, imports)
  return instance.exports as unknown as VanityWasmExports
}
