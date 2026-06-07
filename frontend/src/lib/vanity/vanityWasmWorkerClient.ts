import { resolvePerVaultVanityWasmUrl } from '@/lib/vanity/perVaultVanityWasm'

export type VanityWasmWorkerEntrypoint = 'per_vault_version_search' | 'create2_salt_suffix_search'

type VanityWorkerRequest = {
  id: number
  entrypoint: VanityWasmWorkerEntrypoint
  input: unknown
  wasmUrl: string
}

type VanityWorkerResponse =
  | { id: number; ok: true; output: string }
  | { id: number; ok: false; error: string }

type PendingRequest = {
  resolve: (output: string) => void
  reject: (error: Error) => void
}

let worker: Worker | null = null
let requestId = 0
const pending = new Map<number, PendingRequest>()

export function isVanityWasmWorkerEnabled(): boolean {
  if (typeof Worker === 'undefined') return false
  const raw = String(import.meta.env.VITE_VANITY_WASM_WORKER ?? '').trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  return true
}

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./vanityWasmWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<VanityWorkerResponse>) => {
      const message = event.data
      const entry = pending.get(message.id)
      if (!entry) return
      pending.delete(message.id)
      if (message.ok) {
        entry.resolve(message.output)
        return
      }
      entry.reject(new Error(message.error || 'Vanity WASM worker failed'))
    }
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Vanity WASM worker crashed')
      for (const [, entry] of pending) {
        entry.reject(error)
      }
      pending.clear()
      worker?.terminate()
      worker = null
    }
  }
  return worker
}

export async function invokeVanityWasmInWorker(
  entrypoint: VanityWasmWorkerEntrypoint,
  input: unknown,
): Promise<string> {
  const wasmUrl = resolvePerVaultVanityWasmUrl()
  if (!wasmUrl) {
    throw new Error('Vanity WASM URL is not configured')
  }
  const id = ++requestId
  const activeWorker = ensureWorker()
  return await new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    const request: VanityWorkerRequest = { id, entrypoint, input, wasmUrl }
    activeWorker.postMessage(request)
  })
}

export function terminateVanityWasmWorker(): void {
  worker?.terminate()
  worker = null
  pending.clear()
}