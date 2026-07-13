import {
  decodeFunctionData,
  getAddress,
  isAddress,
  parseAbi,
  toFunctionSelector,
  type Address,
  type Hex,
} from 'viem'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address
export const ALFACLUB_FRIEND_KEY = getAddress('0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F')
export const ROOM_1659_CREATOR_COIN = getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
export const ROOM_1659_TOKEN_ID = 1659n

const FACTORY_ABI = parseAbi([
  'function poolCreatorAllowed(address account) view returns (bool)',
  'function pairAllowed(address creatorCoin, uint256 tokenId) view returns (bool)',
  'function getPool(address creatorCoin, uint256 tokenId) view returns (address)',
  'function createPoolWithInitialLiquidity(address creatorCoin, uint256 tokenId, uint256 keyAmount, uint256 creatorCoinAmount, address recipient) returns (address)',
])
const POOL_ABI = parseAbi([
  'function factory() view returns (address)',
  'function friendKey() view returns (address)',
  'function creatorCoin() view returns (address)',
  'function keyTokenId() view returns (uint256)',
  'function getReserves() view returns (uint256 creatorCoinReserve, uint256 keyReserve)',
  'function totalSupply() view returns (uint256)',
  'function quoteAddLiquidity(uint256 keyAmount) view returns (uint256 creatorCoinAmount, uint256 lpShares)',
  'function quoteBuyKeys(uint256 keyAmount) view returns (uint256 creatorCoinAmountIn)',
  'function quoteSellKeys(uint256 keyAmount) view returns (uint256 creatorCoinAmountOut)',
  'function addLiquidity(uint256 keyAmount, uint256 maxCreatorCoinAmount, uint256 minLpShares, address recipient) returns (uint256 creatorCoinAmount, uint256 lpShares)',
  'function removeLiquidity(uint256 lpShares, uint256 minCreatorCoinAmount, uint256 minKeyAmount, address recipient) returns (uint256 creatorCoinAmount, uint256 keyAmount)',
  'function buyKeys(uint256 keyAmount, uint256 maxCreatorCoinAmount, address recipient) returns (uint256 creatorCoinAmountIn)',
  'function sellKeys(uint256 keyAmount, uint256 minCreatorCoinAmount, address recipient) returns (uint256 creatorCoinAmountOut)',
])
const POOL_ACTION_ABI = parseAbi([
  'function addLiquidity(uint256 keyAmount, uint256 maxCreatorCoinAmount, uint256 minLpShares, address recipient) returns (uint256 creatorCoinAmount, uint256 lpShares)',
  'function removeLiquidity(uint256 lpShares, uint256 minCreatorCoinAmount, uint256 minKeyAmount, address recipient) returns (uint256 creatorCoinAmount, uint256 keyAmount)',
  'function buyKeys(uint256 keyAmount, uint256 maxCreatorCoinAmount, address recipient) returns (uint256 creatorCoinAmountIn)',
  'function sellKeys(uint256 keyAmount, uint256 minCreatorCoinAmount, address recipient) returns (uint256 creatorCoinAmountOut)',
])
const ERC20_APPROVE_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
])
const ERC1155_APPROVAL_ABI = parseAbi([
  'function setApprovalForAll(address operator, bool approved)',
])

const CREATE_SELECTOR = toFunctionSelector(
  'createPoolWithInitialLiquidity(address,uint256,uint256,uint256,address)',
)
const POOL_SELECTORS = new Set<Hex>([
  toFunctionSelector('addLiquidity(uint256,uint256,uint256,address)'),
  toFunctionSelector('removeLiquidity(uint256,uint256,uint256,address)'),
  toFunctionSelector('buyKeys(uint256,uint256,address)'),
  toFunctionSelector('sellKeys(uint256,uint256,address)'),
])
const APPROVE_SELECTOR = toFunctionSelector('approve(address,uint256)')
const SET_APPROVAL_FOR_ALL_SELECTOR = toFunctionSelector('setApprovalForAll(address,bool)')

export type AlfaClubLpInnerCall = {
  target: Address
  value: bigint
  data: Hex
}

type ReadClient = {
  readContract: (params: {
    address: Address
    abi: typeof FACTORY_ABI | typeof POOL_ABI
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
}

export type AlfaClubLpPolicyResult = {
  creatorCoin: Address
  tokenId: bigint
  pool: Address | null
}

function selector(data: Hex): Hex {
  return data.slice(0, 10) as Hex
}

function readConfiguredAddress(raw: string | undefined, error: string): Address {
  const value = String(raw ?? '').trim()
  if (!isAddress(value) || getAddress(value) === ZERO_ADDRESS) throw new Error(error)
  return getAddress(value)
}

export function resolveAlfaClubLpPolicyConfig(env: Record<string, string | undefined>): {
  factory: Address
  creatorCoin: Address
  tokenId: bigint
  maxKeyAmount: bigint
  maxSlippageBps: bigint
} {
  const factory = readConfiguredAddress(
    env.ALFA_CREATOR_KEY_LP_FACTORY ?? env.VITE_ALFA_CREATOR_KEY_LP_FACTORY,
    'alfaclub_lp_factory_not_configured',
  )
  const creatorCoinRaw = env.ALFACLUB_LP_CREATOR_COIN?.trim()
  const creatorCoin = creatorCoinRaw
    ? readConfiguredAddress(creatorCoinRaw, 'alfaclub_lp_creator_coin_not_configured')
    : ROOM_1659_CREATOR_COIN
  const tokenIdRaw = String(env.ALFACLUB_LP_TOKEN_ID ?? ROOM_1659_TOKEN_ID).trim()
  const maxKeyAmountRaw = String(env.ALFACLUB_LP_MAX_KEY_AMOUNT ?? '100').trim()
  const maxSlippageBpsRaw = String(env.ALFACLUB_LP_MAX_SLIPPAGE_BPS ?? '500').trim()
  if (!/^\d+$/.test(tokenIdRaw) || BigInt(tokenIdRaw) <= 0n) {
    throw new Error('alfaclub_lp_token_id_invalid')
  }
  if (!/^\d+$/.test(maxKeyAmountRaw) || BigInt(maxKeyAmountRaw) <= 0n) {
    throw new Error('alfaclub_lp_max_key_amount_invalid')
  }
  if (
    !/^\d+$/.test(maxSlippageBpsRaw) ||
    BigInt(maxSlippageBpsRaw) < 0n ||
    BigInt(maxSlippageBpsRaw) >= 10_000n
  ) {
    throw new Error('alfaclub_lp_max_slippage_bps_invalid')
  }
  return {
    factory,
    creatorCoin,
    tokenId: BigInt(tokenIdRaw),
    maxKeyAmount: BigInt(maxKeyAmountRaw),
    maxSlippageBps: BigInt(maxSlippageBpsRaw),
  }
}

function assertPositiveAmount(value: bigint, error: string): void {
  if (value <= 0n) throw new Error(error)
}

function assertKeyAmount(value: bigint, maxKeyAmount: bigint): void {
  assertPositiveAmount(value, 'alfaclub_lp_key_amount_invalid')
  if (value > maxKeyAmount) throw new Error('alfaclub_lp_key_amount_exceeds_policy')
}

function maxWithSlippage(value: bigint, slippageBps: bigint): bigint {
  return (value * (10_000n + slippageBps) + 9_999n) / 10_000n
}

function minWithSlippage(value: bigint, slippageBps: bigint): bigint {
  return (value * (10_000n - slippageBps)) / 10_000n
}

export async function validateAlfaClubLpCalls(params: {
  calls: AlfaClubLpInnerCall[]
  sender: Address
  client: ReadClient
  env: Record<string, string | undefined>
}): Promise<AlfaClubLpPolicyResult | null> {
  const hasLpSelector = params.calls.some((call) => {
    const callSelector = selector(call.data)
    return callSelector === CREATE_SELECTOR || POOL_SELECTORS.has(callSelector)
  })
  if (!hasLpSelector) return null
  if (params.calls.length > 3) throw new Error('alfaclub_lp_call_count_not_allowed')
  if (params.calls.some((call) => call.value !== 0n)) {
    throw new Error('alfaclub_lp_value_not_allowed')
  }

  const config = resolveAlfaClubLpPolicyConfig(params.env)
  const primaryCalls = params.calls.filter((call) => {
    const callSelector = selector(call.data)
    return callSelector === CREATE_SELECTOR || POOL_SELECTORS.has(callSelector)
  })
  if (primaryCalls.length !== 1) throw new Error('alfaclub_lp_primary_call_count_invalid')
  const primary = primaryCalls[0]
  const primarySelector = selector(primary.data)

  let pool: Address | null = null
  let approvalOperator = config.factory

  if (primarySelector === CREATE_SELECTOR) {
    if (primary.target !== config.factory) throw new Error('alfaclub_lp_factory_mismatch')
    const decoded = decodeFunctionData({ abi: FACTORY_ABI, data: primary.data })
    if (decoded.functionName !== 'createPoolWithInitialLiquidity') {
      throw new Error('alfaclub_lp_create_decode_failed')
    }
    const [creatorCoin, tokenId, keyAmount, creatorCoinAmount, recipient] = decoded.args
    if (getAddress(creatorCoin) !== config.creatorCoin) {
      throw new Error('alfaclub_lp_creator_coin_mismatch')
    }
    if (tokenId !== config.tokenId) throw new Error('alfaclub_lp_token_id_mismatch')
    assertKeyAmount(keyAmount, config.maxKeyAmount)
    assertPositiveAmount(creatorCoinAmount, 'alfaclub_lp_creator_coin_amount_invalid')
    if (getAddress(recipient) !== params.sender) throw new Error('alfaclub_lp_recipient_mismatch')

    const [creatorAllowed, pairAllowed, existingPool] = await Promise.all([
      params.client.readContract({
        address: config.factory,
        abi: FACTORY_ABI,
        functionName: 'poolCreatorAllowed',
        args: [params.sender],
      }),
      params.client.readContract({
        address: config.factory,
        abi: FACTORY_ABI,
        functionName: 'pairAllowed',
        args: [config.creatorCoin, config.tokenId],
      }),
      params.client.readContract({
        address: config.factory,
        abi: FACTORY_ABI,
        functionName: 'getPool',
        args: [config.creatorCoin, config.tokenId],
      }),
    ])
    if (creatorAllowed !== true) throw new Error('alfaclub_lp_creator_not_allowed')
    if (pairAllowed !== true) throw new Error('alfaclub_lp_pair_not_allowed')
    if (typeof existingPool !== 'string' || !isAddress(existingPool) || getAddress(existingPool) !== ZERO_ADDRESS) {
      throw new Error('alfaclub_lp_pool_already_exists')
    }
  } else {
    pool = primary.target
    approvalOperator = pool
    const [factory, friendKey, creatorCoin, tokenId, registeredPool] = await Promise.all([
      params.client.readContract({ address: pool, abi: POOL_ABI, functionName: 'factory' }),
      params.client.readContract({ address: pool, abi: POOL_ABI, functionName: 'friendKey' }),
      params.client.readContract({ address: pool, abi: POOL_ABI, functionName: 'creatorCoin' }),
      params.client.readContract({ address: pool, abi: POOL_ABI, functionName: 'keyTokenId' }),
      params.client.readContract({
        address: config.factory,
        abi: FACTORY_ABI,
        functionName: 'getPool',
        args: [config.creatorCoin, config.tokenId],
      }),
    ])
    if (typeof factory !== 'string' || !isAddress(factory) || getAddress(factory) !== config.factory) {
      throw new Error('alfaclub_lp_pool_factory_mismatch')
    }
    if (typeof friendKey !== 'string' || !isAddress(friendKey) || getAddress(friendKey) !== ALFACLUB_FRIEND_KEY) {
      throw new Error('alfaclub_lp_friend_key_mismatch')
    }
    if (typeof creatorCoin !== 'string' || !isAddress(creatorCoin) || getAddress(creatorCoin) !== config.creatorCoin) {
      throw new Error('alfaclub_lp_creator_coin_mismatch')
    }
    if (tokenId !== config.tokenId) throw new Error('alfaclub_lp_token_id_mismatch')
    if (
      typeof registeredPool !== 'string' ||
      !isAddress(registeredPool) ||
      getAddress(registeredPool) !== pool
    ) {
      throw new Error('alfaclub_lp_pool_not_registered')
    }

    const decoded = decodeFunctionData({ abi: POOL_ACTION_ABI, data: primary.data })
    switch (decoded.functionName) {
      case 'addLiquidity': {
        const [keyAmount, maxCreatorCoinAmount, minLpShares, recipient] = decoded.args
        assertKeyAmount(keyAmount, config.maxKeyAmount)
        assertPositiveAmount(maxCreatorCoinAmount, 'alfaclub_lp_max_creator_coin_invalid')
        assertPositiveAmount(minLpShares, 'alfaclub_lp_min_lp_shares_invalid')
        if (getAddress(recipient) !== params.sender) throw new Error('alfaclub_lp_recipient_mismatch')
        const quote = await params.client.readContract({
          address: pool,
          abi: POOL_ABI,
          functionName: 'quoteAddLiquidity',
          args: [keyAmount],
        })
        if (!Array.isArray(quote) || typeof quote[0] !== 'bigint' || typeof quote[1] !== 'bigint') {
          throw new Error('alfaclub_lp_quote_unavailable')
        }
        if (
          maxCreatorCoinAmount > maxWithSlippage(quote[0], config.maxSlippageBps) ||
          minLpShares < minWithSlippage(quote[1], config.maxSlippageBps)
        ) {
          throw new Error('alfaclub_lp_slippage_exceeds_policy')
        }
        break
      }
      case 'removeLiquidity': {
        const [lpShares, minCreatorCoinAmount, minKeyAmount, recipient] = decoded.args
        assertPositiveAmount(lpShares, 'alfaclub_lp_shares_invalid')
        if (minCreatorCoinAmount < 0n || minKeyAmount < 0n) {
          throw new Error('alfaclub_lp_min_output_invalid')
        }
        if (getAddress(recipient) !== params.sender) throw new Error('alfaclub_lp_recipient_mismatch')
        const [reserves, supply] = await Promise.all([
          params.client.readContract({ address: pool, abi: POOL_ABI, functionName: 'getReserves' }),
          params.client.readContract({ address: pool, abi: POOL_ABI, functionName: 'totalSupply' }),
        ])
        if (
          !Array.isArray(reserves) ||
          typeof reserves[0] !== 'bigint' ||
          typeof reserves[1] !== 'bigint' ||
          typeof supply !== 'bigint' ||
          supply <= 0n
        ) {
          throw new Error('alfaclub_lp_quote_unavailable')
        }
        const expectedCoin = (reserves[0] * lpShares) / supply
        const expectedKeys = (reserves[1] * lpShares) / supply
        if (
          minCreatorCoinAmount < minWithSlippage(expectedCoin, config.maxSlippageBps) ||
          minKeyAmount < minWithSlippage(expectedKeys, config.maxSlippageBps)
        ) {
          throw new Error('alfaclub_lp_slippage_exceeds_policy')
        }
        break
      }
      case 'buyKeys': {
        const [keyAmount, maxCreatorCoinAmount, recipient] = decoded.args
        assertKeyAmount(keyAmount, config.maxKeyAmount)
        assertPositiveAmount(maxCreatorCoinAmount, 'alfaclub_lp_max_creator_coin_invalid')
        if (getAddress(recipient) !== params.sender) throw new Error('alfaclub_lp_recipient_mismatch')
        const quote = await params.client.readContract({
          address: pool,
          abi: POOL_ABI,
          functionName: 'quoteBuyKeys',
          args: [keyAmount],
        })
        if (
          typeof quote !== 'bigint' ||
          maxCreatorCoinAmount > maxWithSlippage(quote, config.maxSlippageBps)
        ) {
          throw new Error('alfaclub_lp_slippage_exceeds_policy')
        }
        break
      }
      case 'sellKeys': {
        const [keyAmount, minCreatorCoinAmount, recipient] = decoded.args
        assertKeyAmount(keyAmount, config.maxKeyAmount)
        assertPositiveAmount(minCreatorCoinAmount, 'alfaclub_lp_min_creator_coin_invalid')
        if (getAddress(recipient) !== params.sender) throw new Error('alfaclub_lp_recipient_mismatch')
        const quote = await params.client.readContract({
          address: pool,
          abi: POOL_ABI,
          functionName: 'quoteSellKeys',
          args: [keyAmount],
        })
        if (
          typeof quote !== 'bigint' ||
          minCreatorCoinAmount < minWithSlippage(quote, config.maxSlippageBps)
        ) {
          throw new Error('alfaclub_lp_slippage_exceeds_policy')
        }
        break
      }
      default: {
        const exhaustive: never = decoded
        throw new Error(`alfaclub_lp_selector_not_allowed:${String(exhaustive)}`)
      }
    }
  }

  for (const call of params.calls) {
    if (call === primary) continue
    const callSelector = selector(call.data)
    if (callSelector === APPROVE_SELECTOR) {
      if (call.target !== config.creatorCoin) throw new Error('alfaclub_lp_approval_token_mismatch')
      const decoded = decodeFunctionData({ abi: ERC20_APPROVE_ABI, data: call.data })
      const [spender, amount] = decoded.args
      if (getAddress(spender) !== approvalOperator) {
        throw new Error('alfaclub_lp_approval_spender_mismatch')
      }
      assertPositiveAmount(amount, 'alfaclub_lp_approval_amount_invalid')
      continue
    }
    if (callSelector === SET_APPROVAL_FOR_ALL_SELECTOR) {
      if (call.target !== ALFACLUB_FRIEND_KEY) throw new Error('alfaclub_lp_friend_key_mismatch')
      const decoded = decodeFunctionData({ abi: ERC1155_APPROVAL_ABI, data: call.data })
      const [operator, approved] = decoded.args
      if (getAddress(operator) !== approvalOperator || approved !== true) {
        throw new Error('alfaclub_lp_key_approval_mismatch')
      }
      continue
    }
    throw new Error('alfaclub_lp_selector_not_allowed')
  }

  return { creatorCoin: config.creatorCoin, tokenId: config.tokenId, pool }
}
