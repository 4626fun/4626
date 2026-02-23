import { validateAddressField, validateChainIdField, validateIntegerAmountField } from './guards.js'
import { isObject, toCleanErrorMessage, uniswapTradeFetch } from './trading.js'

export type UniswapSkillName =
  | 'uniswap_quote'
  | 'uniswap_check_approval'
  | 'uniswap_build_swap'
  | 'uniswap_batch_swap_5792'
  | 'uniswap_delegated_swap_7702'
  | 'uniswap_crosschain_plan'
  | 'uniswap_liquidity'

type SkillRouteConfig = {
  path: string
  requireQuote?: boolean
  requireDeadline?: boolean
  requireDelegation?: boolean
}

const MUTATING_SKILLS: UniswapSkillName[] = [
  'uniswap_build_swap',
  'uniswap_batch_swap_5792',
  'uniswap_delegated_swap_7702',
  'uniswap_crosschain_plan',
  'uniswap_liquidity',
]

const SKILL_ROUTES: Record<UniswapSkillName, SkillRouteConfig> = {
  uniswap_quote: { path: '/quote' },
  uniswap_check_approval: { path: '/check_approval' },
  uniswap_build_swap: { path: '/swap', requireQuote: true },
  uniswap_batch_swap_5792: { path: '/swap_5792', requireDeadline: true, requireQuote: true },
  uniswap_delegated_swap_7702: { path: '/swap_7702', requireDelegation: true, requireQuote: true },
  uniswap_crosschain_plan: { path: '/plan' },
  uniswap_liquidity: { path: '/liquidity/quote' },
}

function hasAnyQuote(payload: Record<string, unknown>): boolean {
  return Boolean(
    isObject(payload.quote) ||
      isObject(payload.classicQuote) ||
      isObject(payload.wrapUnwrapQuote) ||
      isObject(payload.bridgeQuote) ||
      isObject(payload.priorityQuote),
  )
}

function validateCommon(payload: Record<string, unknown>): string | null {
  for (const chainField of ['chainId', 'tokenInChainId', 'tokenOutChainId']) {
    const err = validateChainIdField(payload, chainField)
    if (err) return err
  }

  for (const addressField of [
    'swapper',
    'walletAddress',
    'tokenIn',
    'tokenOut',
    'token',
    'smartContractDelegationAddress',
  ]) {
    const err = validateAddressField(payload, addressField)
    if (err) return err
  }

  for (const amountField of Object.keys(payload)) {
    if (!/^amount/i.test(amountField)) continue
    const err = validateIntegerAmountField(payload, amountField)
    if (err) return err
  }

  return null
}

export async function executeUniswapSkill(name: UniswapSkillName, payload: Record<string, unknown>) {
  const enabled = process.env.ELIZA_UNISWAP_SKILLS_ENABLED
  if (enabled === '0' || enabled === 'false') {
    throw new Error('Uniswap skills disabled by policy')
  }

  const requireConfirmation = process.env.ELIZA_UNISWAP_REQUIRE_CONFIRMATION === '1'
  if (requireConfirmation && MUTATING_SKILLS.includes(name) && payload.confirm !== true) {
    throw new Error('This skill requires explicit confirmation')
  }

  const route = SKILL_ROUTES[name]
  if (!route) throw new Error(`Unsupported Uniswap skill: ${name}`)

  const commonErr = validateCommon(payload)
  if (commonErr) throw new Error(commonErr)

  if (route.requireQuote && !hasAnyQuote(payload)) {
    throw new Error('Missing quote payload')
  }
  if (route.requireDeadline && typeof payload.deadline !== 'number') {
    throw new Error('Missing required deadline number')
  }
  if (route.requireDelegation && typeof payload.smartContractDelegationAddress !== 'string') {
    throw new Error('Missing smartContractDelegationAddress')
  }

  const upstream = await uniswapTradeFetch({
    path: route.path,
    method: 'POST',
    body: payload,
    timeoutMs: 15_000,
  })

  if (upstream.status >= 400) {
    throw new Error(toCleanErrorMessage(upstream.payload, `Uniswap skill failed: ${name}`))
  }

  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  return { requestId, data: upstream.payload }
}
