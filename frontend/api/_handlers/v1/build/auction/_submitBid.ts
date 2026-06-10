import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address, type Hex } from 'viem'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '@4626/server-core'


import type { BuildTxResponse } from '../_types.js'
import {
  BASE_CHAIN_ID,
  UINT128_MAX,
  assertUint256,
  parseOptionalHex,
  requireAddress,
  setBuildCors,
  setRateLimitRetryAfter,
  toBigIntStrict,
} from '../_phase1Shared.js'

type Body = {
  auction: Address
  maxPriceQ96: string | bigint
  amountWei: string | bigint
  owner: Address
  hookData?: Hex
}

const CCA_AUCTION_ABI = [
  {
    name: 'submitBid',
    type: 'function',
    inputs: [
      { name: 'maxPrice', type: 'uint256' },
      { name: 'amount', type: 'uint128' },
      { name: 'owner', type: 'address' },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [{ name: 'bidId', type: 'uint256' }],
    stateMutability: 'payable',
  },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBuildCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/auction/submitBid', kind: 'build' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-build-auction-submit-bid', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.buildAuctionSubmitBid,
  )
  if (!limiter.allowed) {
    setRateLimitRetryAfter(res, limiter.resetAt)
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  try {
    const body = (await readBoundedJsonObjectBody(req, { maxBytes: 65_536 })) ?? ({} as Body)
    const auction = requireAddress(body.auction, 'auction')
    const owner = requireAddress(body.owner, 'owner')
    const maxPriceQ96 = toBigIntStrict(body.maxPriceQ96, 'maxPriceQ96')
    const amountWei = toBigIntStrict(body.amountWei, 'amountWei')
    const hookData = parseOptionalHex(body.hookData, 'hookData')

    if (amountWei <= 0n || amountWei > UINT128_MAX) {
      return res.status(400).json({ success: false, error: 'amountWei must be within uint128 and > 0' })
    }
    if (maxPriceQ96 <= 0n) {
      return res.status(400).json({ success: false, error: 'maxPriceQ96 must be > 0' })
    }
    assertUint256(maxPriceQ96, 'maxPriceQ96')

    const data = encodeFunctionData({
      abi: CCA_AUCTION_ABI,
      functionName: 'submitBid',
      args: [maxPriceQ96, amountWei, owner, hookData],
    })

    const warnings = [
      'This is build-only: you must submit the transaction via your wallet/provider.',
      'value must equal amountWei for ETH-denominated auctions.',
      'Onchain checks still apply (active auction window, reserve checks, and hook validation).',
    ]
    const authAddress = g.auth?.address?.toLowerCase()
    if (authAddress && authAddress !== owner.toLowerCase()) {
      warnings.push('owner differs from authenticated address; confirm your execution flow permits third-party ownership.')
    }

    const out: BuildTxResponse = {
      chainId: BASE_CHAIN_ID,
      to: auction,
      data,
      value: amountWei.toString(),
      description: 'Submit a bid to the Uniswap CCA auction contract.',
      warnings,
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}
