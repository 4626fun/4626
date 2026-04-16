/**
 * Resolve the CreatorCoin parties onchain.
 *
 * Canonical lane naming (see AGENTS.md "Canonical Lane Terminology" +
 * docs/audits/creatorvault-business-logic-core-structure-audit.md §3):
 *
 * - The returned `payoutRecipient` is CreatorCoin `payoutRecipient()` — i.e.
 *   the `creatorCoinPayoutRecipient` lane, which routes CreatorCoin EXTERNAL
 *   earnings (router mode: via `PayoutRouter.convertAndQueue(...)` into vault
 *   shares for holder PPS accretion).
 * - It is NOT the `tradeFeeCollector` lane. Trade-fee routing
 *   (ShareOFT/hook plane) flows through a separate destination on the
 *   gauge/hook path.
 *
 * The literal variable name `payoutRecipient` is kept because it mirrors the
 * onchain function name; only use `creatorCoinPayoutRecipient` in prose, UI
 * copy, comments that discuss lane behavior, and cross-file docs.
 */

declare const process: { env: Record<string, string | undefined> }

export function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function getBaseRpcUrl(): string {
  const env = process.env.BASE_RPC_URL
  if (env && env.length > 0) return env
  return 'https://mainnet.base.org'
}

let _clientPromise: Promise<any> | null = null
async function getBaseClient() {
  // Cache the viem client on warm serverless instances to avoid re-initializing transports.
  if (_clientPromise) return _clientPromise
  _clientPromise = (async () => {
    const { createPublicClient, http } = await import('viem')
    const { base } = await import('viem/chains')
    return createPublicClient({
      chain: base,
      transport: http(getBaseRpcUrl(), { timeout: 12_000 }),
    })
  })()
  return _clientPromise
}

const COIN_VIEW_ABI = [
  { type: 'function', name: 'creator', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'payoutRecipient', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const OWNABLE_VIEW_ABI = [
  // EIP-173 / OpenZeppelin Ownable-style
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

export async function resolveCoinParties(
  coin: `0x${string}`,
): Promise<{ creator: `0x${string}` | null; payoutRecipient: `0x${string}` | null }> {
  try {
    const client = await getBaseClient()

    const [creator, payoutRecipient] = await Promise.all([
      client.readContract({ address: coin, abi: COIN_VIEW_ABI, functionName: 'creator' }).catch(() => null),
      client.readContract({ address: coin, abi: COIN_VIEW_ABI, functionName: 'payoutRecipient' }).catch(() => null),
    ])

    const c = typeof creator === 'string' && isAddressLike(creator) ? (creator.toLowerCase() as `0x${string}`) : null
    const p =
      typeof payoutRecipient === 'string' && isAddressLike(payoutRecipient) ? (payoutRecipient.toLowerCase() as `0x${string}`) : null
    return { creator: c, payoutRecipient: p }
  } catch {
    return { creator: null, payoutRecipient: null }
  }
}

export async function resolveCoinPartiesAndOwner(coin: `0x${string}`): Promise<{
  creator: `0x${string}` | null
  payoutRecipient: `0x${string}` | null
  owner: `0x${string}` | null
}> {
  try {
    const client = await getBaseClient()

    const [creator, payoutRecipient, owner] = await Promise.all([
      client.readContract({ address: coin, abi: COIN_VIEW_ABI, functionName: 'creator' }).catch(() => null),
      client.readContract({ address: coin, abi: COIN_VIEW_ABI, functionName: 'payoutRecipient' }).catch(() => null),
      client.readContract({ address: coin, abi: OWNABLE_VIEW_ABI, functionName: 'owner' }).catch(() => null),
    ])

    const c = typeof creator === 'string' && isAddressLike(creator) ? (creator.toLowerCase() as `0x${string}`) : null
    const p =
      typeof payoutRecipient === 'string' && isAddressLike(payoutRecipient) ? (payoutRecipient.toLowerCase() as `0x${string}`) : null
    const o = typeof owner === 'string' && isAddressLike(owner) ? (owner.toLowerCase() as `0x${string}`) : null

    return { creator: c, payoutRecipient: p, owner: o }
  } catch {
    const parties = await resolveCoinParties(coin)
    return { ...parties, owner: null }
  }
}
