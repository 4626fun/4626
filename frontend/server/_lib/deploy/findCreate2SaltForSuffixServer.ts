import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Address, Hex } from 'viem'

import {
  instantiateVanityWasmFromBytes,
  invokeVanityWasmSearch,
  type VanityWasmExports,
} from '../../../src/lib/vanity/vanityWasmRuntime.js'
import type { Create2SaltSuffixSearchResult } from '../../../src/lib/vanity/create2SaltSuffixWasm.js'

declare const process: { env: Record<string, string | undefined> }

type WasmEnvelope =
  | { ok: true; result: Create2SaltSuffixSearchResult }
  | { ok: false; error?: string }

let wasmExportsPromise: Promise<VanityWasmExports | null> | null = null

export async function findCreate2SaltForSuffixOnServer(params: {
  create2Deployer: Address
  initCodeHash: Hex
  startAt: Hex
  suffix: string
  maxAttempts: number
}): Promise<Create2SaltSuffixSearchResult | null> {
  const wasm = await loadVanityWasmExports()
  if (!wasm) return null

  const output = invokeVanityWasmSearch(wasm, 'create2_salt_suffix_search', {
    create2Deployer: params.create2Deployer,
    initCodeHash: params.initCodeHash,
    startAt: params.startAt,
    suffix: params.suffix,
    maxAttempts: Math.max(1, Math.floor(params.maxAttempts)),
  })
  const parsed = JSON.parse(output) as WasmEnvelope
  if (!parsed.ok) {
    const message = parsed.error || 'Rust share suffix vanity search failed'
    if (message.includes('failed to find suffix')) return null
    throw new Error(message)
  }
  return parsed.result
}

function resolveVanityWasmPath(): string | null {
  const fromEnv = String(process.env.DEPLOY_VANITY_WASM_PATH ?? '').trim()
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv

  const moduleDir = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(moduleDir, '../../../public/vanity/vanity_salt_grinder.wasm'),
    path.resolve(moduleDir, '../../../../public/vanity/vanity_salt_grinder.wasm'),
    path.resolve(moduleDir, '../../../src/lib/vanity/vanity_salt_grinder.wasm'),
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
  return instantiateVanityWasmFromBytes(bytes)
}