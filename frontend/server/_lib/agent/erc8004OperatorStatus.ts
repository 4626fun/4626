import { createHash } from 'node:crypto'

import type { VercelRequest } from '@vercel/node'

import { buildAgentVerificationData, type AgentVerificationData } from '../../../api/_handlers/v1/agents/identity/_verification.js'
import { buildAgentUriPolicy, type AgentUriPolicy } from '../../../src/lib/agent/erc8004AgentUriPolicy.js'
import { buildAgentRegistration, type RegistrationFile } from './agentRegistration.js'
import { publishAgentRegistrationToGrove, resolveAgentRegistrationKey } from './agentRegistrationPublisher.js'
import { getAgentRegistrationState } from './agentRegistrationState.js'
import { getErc8004PublicOrigin } from '../infra/origin.js'

export type AgentPublishGroveData = {
  lensUri: string
  gatewayUrl: string
  storageKey: string
  statusUrl: string | null
}

export type AgentPublishData = {
  uriPolicy: AgentUriPolicy
  groveStatus: 'stored' | 'unavailable' | 'skipped'
  grove?: AgentPublishGroveData
}

export type AgentOperatorNextActionId =
  | 'register_onchain_identity'
  | 'write_token_uri'
  | 'set_agent_wallet'
  | 'repair_mirror'
  | 'repair_domain_proof'
  | 'fix_service_endpoint'
  | 'rerun_discoverability'

export type AgentOperatorNextAction = {
  id: AgentOperatorNextActionId
  label: string
  detail: string
}

export type AgentOperatorStatus = {
  registration: RegistrationFile
  publish: AgentPublishData
  discoverability: AgentVerificationData
  nextActions: AgentOperatorNextAction[]
  checkedAt: string
}

type BuildAgentPublishStatusOptions = {
  req?: VercelRequest
  storeOnGrove?: boolean
  includeStoredGroveState?: boolean
}

type BuildAgentPublishStatusResult = {
  origin: string
  registration: RegistrationFile
  publish: AgentPublishData
}

type OperatorStatusError = Error & {
  statusCode?: number
  missing?: string[]
}

function buildOperatorStatusError(message: string, statusCode: number, missing?: string[]): OperatorStatusError {
  return Object.assign(new Error(message), {
    statusCode,
    ...(missing && missing.length > 0 ? { missing } : {}),
  })
}

function hashRegistrationPayload(registration: RegistrationFile): string {
  return createHash('sha256').update(JSON.stringify(registration)).digest('hex')
}

function toStoredGroveData(input: {
  lensUri: string
  gatewayUrl: string | null
  storageKey: string | null
}): AgentPublishGroveData {
  const fallbackStorageKey = input.lensUri.replace(/^lens:\/\//, '')
  const fallbackGatewayUrl = input.lensUri.startsWith('lens://')
    ? `https://api.grove.storage/${input.lensUri.slice('lens://'.length)}`
    : input.lensUri

  return {
    lensUri: input.lensUri,
    gatewayUrl: input.gatewayUrl ?? fallbackGatewayUrl,
    storageKey: input.storageKey ?? fallbackStorageKey,
    statusUrl: null,
  }
}

function buildNextActions(discoverability: AgentVerificationData): AgentOperatorNextAction[] {
  const actions: AgentOperatorNextAction[] = []
  const seen = new Set<AgentOperatorNextActionId>()

  function pushAction(action: AgentOperatorNextAction) {
    if (seen.has(action.id)) return
    seen.add(action.id)
    actions.push(action)
  }

  for (const check of discoverability.checks) {
    if (check.passed) continue

    switch (check.id) {
      case 'onchain-registration':
        pushAction({
          id: 'register_onchain_identity',
          label: 'Confirm onchain registry state',
          detail: check.detail,
        })
        break
      case 'token-uri-reachable':
      case 'token-uri-immutable':
      case 'token-uri-matches-canonical':
        pushAction({
          id: 'write_token_uri',
          label: 'Write the canonical immutable tokenURI onchain',
          detail: check.detail,
        })
        break
      case 'canonical-agent-wallet':
        pushAction({
          id: 'set_agent_wallet',
          label: 'Bind agentWallet to the canonical CSW',
          detail: check.detail,
        })
        break
      case 'registration-mirror':
        pushAction({
          id: 'repair_mirror',
          label: 'Repair the public registration mirror',
          detail: check.detail,
        })
        break
      case 'domain-proof':
        pushAction({
          id: 'repair_domain_proof',
          label: 'Repair the domain verification file',
          detail: check.detail,
        })
        break
      case 'service-availability':
        pushAction({
          id: 'fix_service_endpoint',
          label: 'Restore the primary public endpoint',
          detail: check.detail,
        })
        break
      default:
        break
    }
  }

  if (!discoverability.discoverabilityReady) {
    pushAction({
      id: 'rerun_discoverability',
      label: 'Rerun discoverability verification after fixes',
      detail: 'Repeat the public verification check once the failing items above are resolved.',
    })
  }

  return actions
}

export async function buildAgentPublishStatus(
  options: BuildAgentPublishStatusOptions = {},
): Promise<BuildAgentPublishStatusResult> {
  const origin = getErc8004PublicOrigin(options.req)
  const result = buildAgentRegistration(origin)

  if (!result.payload) {
    throw buildOperatorStatusError(
      result.error || 'Missing ERC-8004 registry configuration.',
      503,
      result.missing ?? [],
    )
  }

  const registration = result.payload
  const agentKey = resolveAgentRegistrationKey(registration, 'single-agent')
  const payloadHash = hashRegistrationPayload(registration)
  const shouldStoreOnGrove = options.storeOnGrove === true
  const includeStoredGroveState = options.includeStoredGroveState ?? !shouldStoreOnGrove

  let groveStatus: AgentPublishData['groveStatus'] = 'skipped'
  let grove: AgentPublishGroveData | undefined
  let compatibilityFallbackUrl: string | null = null

  if (shouldStoreOnGrove) {
    const publish = await publishAgentRegistrationToGrove({
      payload: registration,
      agentKey,
    })

    if (publish.ok) {
      grove = toStoredGroveData({
        lensUri: publish.lensUri,
        gatewayUrl: publish.gatewayUrl,
        storageKey: publish.storageKey,
      })
      groveStatus = 'stored'
      compatibilityFallbackUrl = grove.gatewayUrl
    } else {
      groveStatus = 'unavailable'
    }
  } else if (includeStoredGroveState) {
    const storedState = await getAgentRegistrationState(agentKey).catch(() => null)
    if (storedState?.payloadHash === payloadHash) {
      grove = toStoredGroveData(storedState)
      groveStatus = 'stored'
      compatibilityFallbackUrl = grove.gatewayUrl
    }
  }

  const uriPolicy = buildAgentUriPolicy({
    origin,
    registration,
    compatibilityFallbackUrl,
  })

  return {
    origin,
    registration,
    publish: {
      uriPolicy,
      groveStatus,
      ...(grove ? { grove } : {}),
    },
  }
}

export async function buildAgentOperatorStatus(req?: VercelRequest): Promise<AgentOperatorStatus> {
  const [{ registration, publish }, discoverability] = await Promise.all([
    buildAgentPublishStatus({
      req,
      storeOnGrove: false,
      includeStoredGroveState: true,
    }),
    buildAgentVerificationData(req),
  ])

  return {
    registration,
    publish,
    discoverability,
    nextActions: buildNextActions(discoverability),
    checkedAt: new Date().toISOString(),
  }
}
