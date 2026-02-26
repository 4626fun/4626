import type { WalletClient } from 'viem'

import type { AccountCapabilities, AtomicStatus } from './types'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readBoolean(value: unknown): boolean {
  return value === true
}

function normalizeAtomicStatus(value: unknown): AtomicStatus {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  if (normalized === 'supported' || normalized === 'ready') return normalized
  if (normalized === 'unsupported') return 'unsupported'
  return 'unknown'
}

function pickChainCapabilities(raw: unknown, chainIdHex: `0x${string}` | null): Record<string, unknown> | null {
  const root = asRecord(raw)
  if (!root) return null
  if (chainIdHex && asRecord(root[chainIdHex])) return asRecord(root[chainIdHex])
  if (chainIdHex) {
    const decimal = Number.parseInt(chainIdHex.slice(2), 16)
    if (Number.isFinite(decimal) && asRecord(root[String(decimal)])) {
      return asRecord(root[String(decimal)])
    }
  }
  return root
}

export function parseCapabilities(raw: unknown, chainIdHex: `0x${string}` | null): AccountCapabilities {
  const chain = pickChainCapabilities(raw, chainIdHex)
  if (!chain) {
    return { paymasterService: false, atomicStatus: 'unknown', supports5792: false }
  }

  const paymasterService = readBoolean(
    asRecord(chain.paymasterService)?.supported ??
      asRecord(chain.paymaster)?.supported ??
      asRecord(asRecord(chain.wallet_sendCalls)?.paymasterService)?.supported,
  )

  const atomicStatus = normalizeAtomicStatus(
    asRecord(chain.atomic)?.status ??
      asRecord(chain.atomicBatch)?.status ??
      asRecord(asRecord(chain.wallet_sendCalls)?.atomic)?.status,
  )

  return {
    paymasterService,
    atomicStatus,
    supports5792: true,
  }
}

export async function probeWalletCapabilities(params: {
  walletClient: WalletClient | undefined
  signerAddress?: `0x${string}`
  chainIdHex: `0x${string}` | null
}): Promise<AccountCapabilities> {
  const { walletClient, signerAddress, chainIdHex } = params
  if (!walletClient) return { paymasterService: false, atomicStatus: 'unknown', supports5792: false }

  const request = (walletClient as any)?.request as ((args: { method: string; params?: unknown[] }) => Promise<unknown>) | undefined
  if (!request) return { paymasterService: false, atomicStatus: 'unknown', supports5792: false }

  try {
    const withParams =
      signerAddress && chainIdHex
        ? await request({
            method: 'wallet_getCapabilities',
            params: [signerAddress, [chainIdHex]],
          })
        : await request({ method: 'wallet_getCapabilities' })

    return parseCapabilities(withParams, chainIdHex)
  } catch {
    try {
      const fallback = await request({ method: 'wallet_getCapabilities' })
      return parseCapabilities(fallback, chainIdHex)
    } catch {
      return { paymasterService: false, atomicStatus: 'unknown', supports5792: false }
    }
  }
}

