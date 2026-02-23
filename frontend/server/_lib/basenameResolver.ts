import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

import { getEnsName } from './ensResolver'

declare const process: { env: Record<string, string | undefined> }

function getBaseRpcUrl(): string {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  return raw || 'https://mainnet.base.org'
}

function getBaseClient() {
  return createPublicClient({
    chain: base,
    transport: http(getBaseRpcUrl(), { timeout: 10_000 }),
  })
}

export function basenameToHandle(name: string | null | undefined): string | null {
  const raw = typeof name === 'string' ? name.trim() : ''
  if (!raw) return null
  if (!raw.toLowerCase().endsWith('.base.eth')) return null

  const withoutSuffix = raw.slice(0, -'.base.eth'.length).trim()
  return withoutSuffix.length > 0 ? withoutSuffix : null
}

async function getBasenameNameOnBase(address: string): Promise<string | null> {
  try {
    const client = getBaseClient()
    const name = await client.getEnsName({ address: address as `0x${string}` })
    return name
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err ?? '')
    // viem can throw before any RPC call if the chain config doesn't define ENS contracts.
    if (msg.includes('does not support contract "ensUniversalResolver"')) return null
    return null
  }
}

/**
 * Resolve a "Basename handle" (e.g. "akita" from "akita.base.eth") for a wallet address.
 *
 * Best-effort:
 * - try Base L2 ENS reverse resolution
 * - fall back to mainnet ENS reverse resolution when it returns a `.base.eth` name
 */
export async function resolveBasenameHandle(address: string): Promise<string | null> {
  const baseName = basenameToHandle(await getBasenameNameOnBase(address))
  if (baseName) return baseName

  const ensName = await getEnsName(address)
  const ensBasename = basenameToHandle(ensName)
  return ensBasename
}

