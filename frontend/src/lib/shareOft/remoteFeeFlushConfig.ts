import { getAddress, isAddress, type Address } from 'viem'

import { AKITA } from '@/config/contracts'

export type RemoteFeeFlushTarget = {
  chainId: number
  lzEid: number
  shareOft: Address
  rpcUrl: string
  label: string
}

type RawFlushTarget = {
  chainId?: number | string
  lzEid?: number | string
  shareOft?: string
  rpcUrl?: string
  rpcEnvKey?: string
  label?: string
}

const EXECUTOR_DROP_BUFFER_BPS = 500n

function readEnv(name: string): string {
  return String((import.meta.env as Record<string, string | undefined>)[name] ?? '').trim()
}

function readAddressEnv(name: string, fallback: Address): Address {
  const raw = readEnv(name)
  if (raw && isAddress(raw)) return getAddress(raw)
  return fallback
}

export function resolveHubShareOft(): Address {
  return readAddressEnv('VITE_HUB_SHARE_OFT', AKITA.shareOFT)
}

export function resolveHubGaugeController(): Address {
  return readAddressEnv('VITE_HUB_GAUGE_CONTROLLER', AKITA.gaugeController)
}

function resolveRpcUrl(entry: RawFlushTarget, label: string): string {
  if (entry.rpcUrl?.trim()) return entry.rpcUrl.trim()
  const envKey = String(entry.rpcEnvKey ?? '').trim()
  if (!envKey) {
    throw new Error(`Remote fee flush target "${label}" requires rpcUrl or rpcEnvKey`)
  }
  const fromEnv = readEnv(`VITE_${envKey}`) || readEnv(envKey)
  if (!fromEnv) {
    throw new Error(`Remote fee flush target "${label}" missing RPC env ${envKey}`)
  }
  return fromEnv
}

export function parseRemoteFeeFlushTargets(): RemoteFeeFlushTarget[] {
  const inline = readEnv('VITE_REMOTE_SHARE_OFT_FLUSH_TARGETS')
  if (!inline) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(inline)
  } catch {
    throw new Error('Invalid VITE_REMOTE_SHARE_OFT_FLUSH_TARGETS JSON')
  }
  if (!Array.isArray(parsed)) {
    throw new Error('VITE_REMOTE_SHARE_OFT_FLUSH_TARGETS must be a JSON array')
  }

  const out: RemoteFeeFlushTarget[] = []
  const seenEids = new Set<number>()

  for (const [index, item] of parsed.entries()) {
    if (!item || typeof item !== 'object') {
      throw new Error(`Remote fee flush target at index ${index} must be an object`)
    }
    const entry = item as RawFlushTarget
    const label = String(entry.label ?? `chain-${entry.chainId ?? index}`)
    const chainId = Number(entry.chainId)
    const lzEidRaw = entry.lzEid
    if (lzEidRaw == null || String(lzEidRaw).trim() === '') {
      throw new Error(
        `Remote fee flush target "${label}" missing lzEid (LayerZero endpoint id — not chain id)`,
      )
    }
    const lzEid = Number(lzEidRaw)
    const shareOftRaw = String(entry.shareOft ?? '').trim()

    if (!Number.isFinite(chainId) || chainId <= 0) {
      throw new Error(`Remote fee flush target "${label}" missing valid chainId`)
    }
    if (!Number.isFinite(lzEid) || lzEid <= 0) {
      throw new Error(`Remote fee flush target "${label}" missing valid lzEid`)
    }
    if (!isAddress(shareOftRaw)) {
      throw new Error(`Remote fee flush target "${label}" has invalid shareOft`)
    }

    if (seenEids.has(lzEid)) {
      throw new Error(`Duplicate lzEid ${lzEid} in VITE_REMOTE_SHARE_OFT_FLUSH_TARGETS`)
    }
    seenEids.add(lzEid)

    out.push({
      chainId,
      lzEid,
      shareOft: getAddress(shareOftRaw),
      rpcUrl: resolveRpcUrl(entry, label),
      label,
    })
  }

  return out
}

export function applyExecutorDropBuffer(amount: bigint): bigint {
  if (amount === 0n) return 0n
  return amount + (amount * EXECUTOR_DROP_BUFFER_BPS) / 10_000n
}
