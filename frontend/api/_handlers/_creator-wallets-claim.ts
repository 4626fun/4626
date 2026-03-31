import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  getDb,
  readRequestPrincipalAddress,
} from '../../packages/server-core/src/index.js'


import { ensureCreatorWalletsSchema } from '../../server/_lib/creatorWallets.js'
import { isAddressLike, resolveCoinParties } from '../../server/_lib/coinParties.js'


type ClaimBody = { coinAddress?: string }
type WalletRole = 'creator' | 'payout'
type MatchSource = 'direct' | 'csw-owner'

type ClaimResponse = {
  coinAddress: string
  walletAddress: string
  walletRole: WalletRole
  matchSource: MatchSource
  creator: string | null
  payoutRecipient: string | null
}

const COINBASE_SMART_WALLET_OWNER_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'nextOwnerIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

const DEFAULT_BASE_RPCS = ['https://mainnet.base.org', 'https://base.llamarpc.com'] as const

function getBaseRpcUrls(): string[] {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  if (!raw) return [...DEFAULT_BASE_RPCS]
  const parts = raw
    .split(/[\s,]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
  const urls = parts.length > 0 ? [...parts, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]
  return Array.from(new Set(urls))
}

async function isCswOwner(ownerAddress: `0x${string}`, smartWalletAddress: `0x${string}`): Promise<boolean> {
  const { createPublicClient, encodeAbiParameters, http } = await import('viem')
  const { base } = await import('viem/chains')
  const expected = String(encodeAbiParameters([{ type: 'address' }], [ownerAddress])).toLowerCase()
  for (const rpc of getBaseRpcUrls()) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(rpc, { timeout: 10_000 }),
      })

      // Fast path for CSW versions exposing isOwnerAddress.
      try {
        const ok = await client.readContract({
          address: smartWalletAddress,
          abi: COINBASE_SMART_WALLET_OWNER_ABI,
          functionName: 'isOwnerAddress',
          args: [ownerAddress],
        })
        if (ok === true) return true
      } catch {
        // Fall through to index scan fallback.
      }

      // Fallback path: owner slot scan for CSW versions where isOwnerAddress is unavailable/inconsistent.
      const ownerCountRaw = (await client.readContract({
        address: smartWalletAddress,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerCount',
      })) as bigint
      const ownerCount = Number(ownerCountRaw)
      let upperBound = Number.isFinite(ownerCount) ? ownerCount : 0
      try {
        const nextRaw = (await client.readContract({
          address: smartWalletAddress,
          abi: COINBASE_SMART_WALLET_OWNERS_ABI,
          functionName: 'nextOwnerIndex',
        })) as bigint
        const next = Number(nextRaw)
        if (Number.isFinite(next) && next > 0) upperBound = Math.max(upperBound, next)
      } catch {
        // ignore: not all CSW versions expose nextOwnerIndex
      }
      const limit = Math.min(512, Math.max(0, upperBound))
      for (let i = 0; i < limit; i++) {
        let ownerBytes: string
        try {
          ownerBytes = (await client.readContract({
            address: smartWalletAddress,
            abi: COINBASE_SMART_WALLET_OWNERS_ABI,
            functionName: 'ownerAtIndex',
            args: [BigInt(i)],
          })) as string
        } catch {
          continue
        }
        if (String(ownerBytes).toLowerCase() === expected) return true
      }
    } catch {
      // Try next RPC/provider
      continue
    }
  }
  return false
}

async function isTrustedCreatorCoin(
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> },
  coinAddress: `0x${string}`,
): Promise<boolean> {
  const normalized = coinAddress.toLowerCase()
  const creatorCoinPromise = db.sql`
    SELECT coin_address
    FROM creator_coins
    WHERE lower(coin_address) = ${normalized}
    LIMIT 1;
  `.catch(() => ({ rows: [] as any[] }))
  const keeprVaultPromise = db.sql`
    SELECT creator_coin_address
    FROM keepr_vaults
    WHERE lower(creator_coin_address) = ${normalized}
    LIMIT 1;
  `.catch(() => ({ rows: [] as any[] }))
  const [creatorCoinRow, keeprVaultRow] = await Promise.all([creatorCoinPromise, keeprVaultPromise])
  return Boolean((creatorCoinRow.rows?.length ?? 0) > 0 || (keeprVaultRow.rows?.length ?? 0) > 0)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const wallet = readRequestPrincipalAddress(req)
  if (!wallet || !isAddressLike(wallet)) {
    return res.status(401).json({ success: false, error: 'Wallet not verified' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<ClaimBody>(req)
  const coinRaw = typeof body?.coinAddress === 'string' ? body.coinAddress.trim() : ''
  const coin = isAddressLike(coinRaw) ? (coinRaw.toLowerCase() as `0x${string}`) : null
  if (!coin) {
    return res.status(400).json({ success: false, error: 'Invalid coin address' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  }
  const trustedCoin = await isTrustedCreatorCoin(db, coin)
  if (!trustedCoin) {
    return res.status(403).json({ success: false, error: 'Coin is not in the trusted creator registry' } satisfies ApiEnvelope<never>)
  }

  const parties = await resolveCoinParties(coin)
  const creator = parties.creator
  const payoutRecipient = parties.payoutRecipient
  if (!creator && !payoutRecipient) {
    return res.status(404).json({ success: false, error: 'Coin not found' } satisfies ApiEnvelope<never>)
  }

  let role: WalletRole | null = wallet === creator ? 'creator' : wallet === payoutRecipient ? 'payout' : null
  let matchSource: MatchSource = 'direct'

  // If direct match fails, allow the signed-in wallet when it is an owner of the smart-wallet
  // currently set as creator/payoutRecipient/owner.
  if (!role) {
    const candidates: Array<{ role: WalletRole; address: `0x${string}` | null }> = [
      { role: 'creator', address: creator },
      { role: 'payout', address: payoutRecipient },
    ]
    for (const candidate of candidates) {
      if (!candidate.address) continue
      const owned = await isCswOwner(wallet as `0x${string}`, candidate.address)
      if (owned) {
        role = candidate.role
        matchSource = 'csw-owner'
        break
      }
    }
  }

  if (!role) {
    return res.status(403).json({
      success: false,
      error: 'Wallet does not match creator/payoutRecipient and is not an owner of the linked smart wallet',
    } satisfies ApiEnvelope<never>)
  }

  await ensureCreatorWalletsSchema(db)

  await db.sql`
    INSERT INTO creator_wallets (
      coin_address,
      wallet_address,
      wallet_role,
      verified_via,
      verified_at,
      created_at
    )
    VALUES (
      ${coin},
      ${wallet},
      ${role},
      'siwe',
      NOW(),
      NOW()
    )
    ON CONFLICT (coin_address, wallet_address)
    DO UPDATE SET wallet_role = EXCLUDED.wallet_role, verified_via = 'siwe', verified_at = NOW();
  `

  const data: ClaimResponse = {
    coinAddress: coin,
    walletAddress: wallet,
    walletRole: role,
    matchSource,
    creator,
    payoutRecipient,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ClaimResponse>)
}
