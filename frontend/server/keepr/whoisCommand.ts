import { getAddress, isAddress } from 'viem'

import type { KeeprCommandResult } from '../commands/types.js'
import { getEnsProfile, type EnsProfile } from '../_lib/identity/ensResolver.js'
import { getBasenameName } from '../_lib/identity/basenameResolver.js'

const CACHE_TTL_MS = 5 * 60_000
const MAX_CACHE_ENTRIES = 2_000
const MAX_PENDING_ENTRIES = 500

type CacheEntry = {
  expiresAt: number
  value: KeeprCommandResult
}

const cache = new Map<string, CacheEntry>()
const pending = new Map<string, Promise<KeeprCommandResult>>()

function evictCache(now = Date.now()): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key)
  }
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined
    if (!oldestKey) break
    cache.delete(oldestKey)
  }
}

function truncate(value: string, maxLen: number): string {
  const v = String(value ?? '').trim()
  if (!v) return ''
  if (v.length <= maxLen) return v
  return `${v.slice(0, Math.max(0, maxLen - 1))}…`
}

function normalizeHandle(value: string | null | undefined): string | null {
  const v = String(value ?? '').trim()
  if (!v) return null
  if (v.startsWith('@')) return v
  // ENS text records often store a raw username; prefix for display.
  if (/^[a-z0-9_]{1,32}$/i.test(v)) return `@${v}`
  return v
}

export async function handleWhoisCommand(params: {
  text: string
}): Promise<KeeprCommandResult> {
  const raw = (params.text ?? '').trim()
  const argText = raw.replace(/^\/?whois\s*/i, '').trim()
  const target = argText.split(/\s+/g).filter(Boolean)[0] ?? ''

  if (!target) {
    return {
      ok: false,
      response: [
        'Usage: /whois <address>',
        '',
        'Example:',
        '  /whois 0x1234567890abcdef1234567890abcdef12345678',
      ].join('\n'),
    }
  }

  if (!isAddress(target)) {
    return { ok: false, response: 'Enter a valid Ethereum address.' }
  }

  const address = getAddress(target).toLowerCase() as `0x${string}`
  const cached = cache.get(address)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  if (cached && cached.expiresAt <= Date.now()) cache.delete(address)

  const inFlight = pending.get(address)
  if (inFlight) return await inFlight
  if (pending.size >= MAX_PENDING_ENTRIES) {
    return { ok: false, response: 'Please retry in a moment.' }
  }

  const promise = (async (): Promise<KeeprCommandResult> => {
    const [ens, basename] = await Promise.all([
      getEnsProfile(address).catch(() => ({ name: null } as EnsProfile)),
      getBasenameName(address).catch(() => null),
    ])

    const lines: string[] = []
    lines.push('Whois')
    lines.push('')
    lines.push(`- address: ${address}`)
    lines.push(`- ens: ${ens.name ?? 'n/a'}`)
    lines.push(`- basename: ${basename ?? 'n/a'}`)

    const displayName = String(ens.displayName ?? '').trim()
    if (displayName && displayName.toLowerCase() !== String(ens.name ?? '').toLowerCase()) {
      lines.push(`- name: ${truncate(displayName, 80)}`)
    }

    const twitter = normalizeHandle(ens.twitter)
    const github = String(ens.github ?? '').trim()
    const url = String(ens.url ?? '').trim()
    const description = String(ens.description ?? '').trim()

    if (twitter) lines.push(`- twitter: ${twitter}`)
    if (github) lines.push(`- github: ${github}`)
    if (url) lines.push(`- url: ${truncate(url, 120)}`)
    if (description) lines.push(`- bio: ${truncate(description, 160)}`)

    return { ok: true, response: lines.join('\n') }
  })()

  pending.set(address, promise)
  try {
    const result = await promise
    evictCache()
    if (cache.has(address)) cache.delete(address)
    cache.set(address, { expiresAt: Date.now() + CACHE_TTL_MS, value: result })
    evictCache()
    return result
  } finally {
    pending.delete(address)
  }
}
