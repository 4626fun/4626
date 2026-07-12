import type { PublicClient } from 'viem'

import { readIsOwnerAddressIfDeployed } from '@/lib/wallet/cswOwnerRead'

type OwnerReadClient = Pick<PublicClient, 'readContract' | 'getBytecode'>

export async function waitForEmbeddedOwnerOnChain(params: {
  publicClient: OwnerReadClient
  cswAddress: `0x${string}`
  ownerAddress: `0x${string}`
  attempts?: number
  delayMs?: number
  sleep?: (ms: number) => Promise<void>
}): Promise<boolean> {
  const attempts = Math.max(1, params.attempts ?? 6)
  const delayMs = Math.max(0, params.delayMs ?? 2_000)
  const sleep = params.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const installed = await readIsOwnerAddressIfDeployed({
      publicClient: params.publicClient,
      cswAddress: params.cswAddress,
      ownerAddress: params.ownerAddress,
    })
    if (installed === true) return true
    if (attempt < attempts - 1) await sleep(delayMs)
  }

  return false
}
