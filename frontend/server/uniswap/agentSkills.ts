import { randomUUID } from 'node:crypto'

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

type ExecuteOptions = {
  source?: 'eliza' | 'openclaw' | 'system'
  requestId?: string
}

const SKILL_ROUTES: Record<UniswapSkillName, SkillRouteConfig> = {
  uniswap_quote: { path: '/quote' },
  uniswap_check_approval: { path: '/check_approval' },
  uniswap_build_swap: { path: '/swap', requireQuote: true },
  uniswap_batch_swap_5792: { path: '/swap_5792', requireDeadline: true, requireQuote: true },
  uniswap_delegated_swap_7702: { path: '/swap_7702', requireDelegation: true, requireQuote: true },
  uniswap_crosschain_plan: { path: '/plan' },
  uniswap_liquidity: { path: '/liquidity/quote' },
}

const MUTATING_SKILLS = new Set<UniswapSkillName>([
  'uniswap_build_swap',
  'uniswap_batch_swap_5792',
  'uniswap_delegated_swap_7702',
  'uniswap_crosschain_plan',
  'uniswap_liquidity',
])

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

function getAllowedSkillsFromEnv(): Set<UniswapSkillName> | null {
  const raw = String(process.env.ELIZA_UNISWAP_ALLOWED_SKILLS ?? '').trim()
  if (!raw) return null
  const set = new Set<UniswapSkillName>()
  for (const item of raw.split(',').map((v) => v.trim()).filter(Boolean)) {
    if (item in SKILL_ROUTES) set.add(item as UniswapSkillName)
  }
  return set
}

function assertPolicy(name: UniswapSkillName, payload: Record<string, unknown>) {
  const enabled = String(process.env.ELIZA_UNISWAP_SKILLS_ENABLED ?? '1').trim().toLowerCase()
  if (enabled === '0' || enabled === 'false' || enabled === 'off') {
    throw new Error('Uniswap skills are disabled by policy')
  }

  const allowed = getAllowedSkillsFromEnv()
  if (allowed && !allowed.has(name)) {
    throw new Error(`Skill blocked by allowlist: ${name}`)
  }

  const requireConfirmation = String(process.env.ELIZA_UNISWAP_REQUIRE_CONFIRMATION ?? '1').trim().toLowerCase()
  if ((requireConfirmation === '1' || requireConfirmation === 'true') && MUTATING_SKILLS.has(name) && payload.confirmed !== true) {
    throw new Error(`Skill requires explicit confirmation: ${name}`)
  }
}

export async function executeUniswapSkill(name: UniswapSkillName, payload: Record<string, unknown>, options: ExecuteOptions = {}) {
  const route = SKILL_ROUTES[name]
  if (!route) throw new Error(`Unsupported Uniswap skill: ${name}`)

  assertPolicy(name, payload)

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

  const requestId = options.requestId ?? randomUUID()
  const startedAt = Date.now()

  const upstream = await uniswapTradeFetch({
    path: route.path,
    method: 'POST',
    body: payload,
    timeoutMs: 15_000,
    headers: { 'x-correlation-id': requestId },
  })

  if (upstream.status >= 400) {
    throw new Error(toCleanErrorMessage(upstream.payload, `Uniswap skill failed: ${name}`))
  }

  return {
    requestId,
    source: options.source ?? 'system',
    skill: name,
    mutating: MUTATING_SKILLS.has(name),
    elapsedMs: Date.now() - startedAt,
    data: upstream.payload,
  }
}
