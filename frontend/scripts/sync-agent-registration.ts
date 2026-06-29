import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildAgentRegistration } from '../server/_lib/agent/agentRegistration.js'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(scriptDir, '..')
const origin = (process.env.ERC8004_PUBLIC_ORIGIN || 'https://4626.fun').replace(/\/+$/, '')

function buildAgentCard(registration: Record<string, unknown>) {
  return {
    name: registration.name ?? '4626 Agent',
    description: registration.description ?? '',
    url: origin,
    version: '1.0.0',
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    skills: [
      {
        id: 'vault-intelligence',
        name: 'Vault and wallet intelligence',
        description: 'Query creator vaults, wallet reputation, and ERC-8004 feedback on Base.',
        tags: ['blockchain', 'defi', 'reputation', 'base'],
      },
      {
        id: 'xmtp-chat',
        name: 'XMTP chat',
        description: 'Message the Keepr agent over XMTP from any compatible client.',
        tags: ['xmtp', 'messaging'],
      },
    ],
  }
}

function buildDomainVerification(registration: Record<string, any>) {
  const canonicalOrigin = origin.replace(/\/+$/, '')
  const verifiedEndpoints = [
    canonicalOrigin,
    `${canonicalOrigin}/api/v1/spec.json`,
    `${canonicalOrigin}/api/v1/agents/feedback`,
    `${canonicalOrigin}/api/v1/agents/feedback/review`,
    `${canonicalOrigin}/api/lens/reputation-graph`,
    `${canonicalOrigin}/api/lens/feedback-payload`,
    `${canonicalOrigin}/api/v1/agents/wallet-intelligence`,
    `${canonicalOrigin}/.well-known/agent-card.json`,
  ]

  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#domain-verification-v1',
    domain: new URL(origin).hostname,
    agentId: registration.registrations?.[0]?.agentId ?? 2205,
    agentRegistry:
      registration.registrations?.[0]?.agentRegistry ??
      'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
    verifiedEndpoints,
    registrationUrl: `${canonicalOrigin}/.well-known/agent-registration.json`,
    generatedAt: new Date().toISOString(),
  }
}

async function writeJson(targetPath: string, payload: unknown) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`)
}

async function main() {
  const wellKnownDir = path.join(frontendRoot, 'public/.well-known')
  const registrationPath = path.join(wellKnownDir, 'agent-registration.json')
  await fs.unlink(registrationPath).catch(() => undefined)

  const result = buildAgentRegistration(origin)
  if (!result.payload) {
    throw new Error(result.error || 'Failed to build agent registration payload.')
  }

  const registration = result.payload
  const agentCardPath = path.join(wellKnownDir, 'agent-card.json')
  const domainProofPath = path.join(wellKnownDir, 'erc8004.json')

  await writeJson(registrationPath, registration)
  await writeJson(agentCardPath, buildAgentCard(registration))
  await writeJson(domainProofPath, buildDomainVerification(registration))

  console.log('[sync-agent-registration] wrote canonical mirror files')
  console.log(`registration=${registrationPath}`)
  console.log(`agentCard=${agentCardPath}`)
  console.log(`domainProof=${domainProofPath}`)
  console.log(`services=${Array.isArray(registration.services) ? registration.services.length : 0}`)
  console.log(`updatedAt=${registration.updatedAt ?? 'missing'}`)
}

main().catch((error) => {
  console.error(`[sync-agent-registration] failed: ${String(error instanceof Error ? error.message : error)}`)
  process.exit(1)
})
