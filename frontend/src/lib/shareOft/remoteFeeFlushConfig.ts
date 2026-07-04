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

function resolveRpcUrl(entry: RawFlushTarget): string | null {
  if (entry.rpcUrl?.trim()) return entry.rpcUrl.trim()
  const envKey = String(entry.rpcEnvKey ?? '').trim()
  if (!envKey) return null
  const fromEnv = readEnv(`VITE_${envKey}`) || readEnv(envKey)
  return fromEnv || null
}

export function parseRemoteFeeFlushTargets(): RemoteFeeFlushTarget[] {
  const inline = readEnv('VITE_REMOTE_SHARE_OFT_FLUSH_TARGETS')
  const out: RemoteFeeFlushTarget[] = []

  if (inline) {
    let parsed: unknown
    try {
      parsed = JSON.parse(inline)
    } catch {
      throw new Error('Invalid VITE_REMOTE_SHARE_OFT_FLUSH_TARGETS JSON')
    }
    if (!Array.isArray(parsed)) {
      throw new Error('VITE_REMOTE_SHARE_OFT_FLUSH_TARGETS must be a JSON array')
    }

    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const entry = item as RawFlushTarget
      const chainId = Number(entry.chainId)
      const lzEid = Number(entry.lzEid ?? entry.chainId)
      const shareOftRaw = String(entry.shareOft ?? '').trim()
      const rpcUrl = resolveRpcUrl(entry)
      if (!Number.isFinite(chainId) || chainId <= 0) continue
      if (!Number.isFinite(lzEid) || lzEid <= 0) continue
      if (!isAddress(shareOftRaw) || !rpcUrl) continue
      out.push({
        chainId,
        lzEid,
        shareOft: getAddress(shareOftRaw),
        rpcUrl,
        label: String(entry.label ?? `chain-${chainId}`),
      })
    }
  }

  return out
}

export function applyExecutorDropBuffer(amount: bigint): bigint {
  if (amount === 0n) return 0n
  return amount + (amount * EXECUTOR_DROP_BUFFER_BPS) / 10_000n
}
