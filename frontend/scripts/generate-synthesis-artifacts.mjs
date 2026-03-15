#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_AUDIT_LOG = 'artifacts/deploy-run.json'
const DEFAULT_REGISTRATION = 'public/.well-known/agent-registration.json'
const DEFAULT_OUT_DIR = 'artifacts/synthesis'

function hasFlag(flag) {
  return process.argv.includes(flag)
}

function getArg(name, fallback = '') {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const value = process.argv[idx + 1]
  if (!value || value.startsWith('--')) return fallback
  return value
}

function usage() {
  console.log(`Usage:
  pnpm -C frontend run synthesis:artifacts -- \
    --audit-log ${DEFAULT_AUDIT_LOG} \
    --registration ${DEFAULT_REGISTRATION} \
    --out-dir ${DEFAULT_OUT_DIR}

Options:
  --audit-log <path>      Deploy autopilot audit log JSON (required; default: ${DEFAULT_AUDIT_LOG})
  --registration <path>   Agent registration JSON (default: ${DEFAULT_REGISTRATION})
  --out-dir <path>        Output directory for artifacts (default: ${DEFAULT_OUT_DIR})
  --project-name <name>   Override project display name
  --tagline <text>        Override project tagline
  --help                  Show this help
`)
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

function pickOperatorWallet(registration) {
  const services = Array.isArray(registration?.services) ? registration.services : []
  const byAccount = services.find((entry) => typeof entry?.account === 'string' && entry.account.trim())
  if (byAccount?.account) return String(byAccount.account).trim()
  const byAddress = services.find((entry) => typeof entry?.address === 'string' && entry.address.trim())
  if (byAddress?.address) return `eip155:8453:${String(byAddress.address).trim().toLowerCase()}`
  return null
}

function pickPrimaryRegistration(registration) {
  const rows = Array.isArray(registration?.registrations) ? registration.registrations : []
  const first = rows[0]
  if (!first || typeof first !== 'object') return null
  const agentIdRaw = first.agentId
  const agentId = Number(agentIdRaw)
  const registry = typeof first.agentRegistry === 'string' ? first.agentRegistry.trim() : ''
  if (!Number.isFinite(agentId) || !registry) return null
  return { agentId, agentRegistry: registry }
}

function classifyPhase(event) {
  const type = String(event?.type || '')
  const step = String(event?.step || '')

  if (type === 'preflight_ok' || type === 'preflight_skipped') return 'discover'
  if (type === 'session_started') return 'plan'
  if (type === 'continue_attempt' || type === 'continue_after_owner_install') return 'execute'
  if (type === 'deploy_completed') return 'verify'
  if (type === 'deploy_error' || type === 'deploy_terminal_failure') return 'verify'
  if (type === 'status_error') return 'verify'

  if (type === 'step_changed') {
    if (step.endsWith('_sent')) return 'execute'
    if (step.endsWith('_confirmed') || step === 'completed') return 'verify'
    return 'execute'
  }

  return 'execute'
}

function toLogEntries(events) {
  return events.map((event, index) => {
    const { ts, type, ...details } = event
    const step = typeof details.step === 'string' ? details.step : null
    return {
      id: index + 1,
      timestamp: typeof ts === 'string' ? ts : null,
      phase: classifyPhase(event),
      eventType: typeof type === 'string' ? type : 'unknown',
      step,
      details,
    }
  })
}

function pickUniqueSteps(events) {
  const out = []
  const seen = new Set()
  for (const event of events) {
    const step = typeof event?.step === 'string' ? event.step.trim() : ''
    if (!step || seen.has(step)) continue
    seen.add(step)
    out.push(step)
  }
  return out
}

function buildAgentManifest(params) {
  const { registration, audit, generatedAt } = params
  const operatorWallet = pickOperatorWallet(registration)
  const primaryRegistration = pickPrimaryRegistration(registration)
  const services = Array.isArray(registration?.services) ? registration.services : []

  const supportedTools = services
    .map((service) => {
      const name = typeof service?.name === 'string' ? service.name.trim() : ''
      const endpoint = typeof service?.endpoint === 'string' ? service.endpoint.trim() : ''
      if (!name || !endpoint) return null
      return { name, endpoint }
    })
    .filter(Boolean)

  return {
    schemaVersion: 'synthesis-agent-manifest-v1',
    generatedAt,
    name: registration?.name || '4626 Agent',
    description:
      registration?.description ||
      'Autonomous vault launch operator for creator deployments on Base with ERC-4337 and verifiable receipts.',
    operatorWallet,
    erc8004: primaryRegistration
      ? {
          agentId: primaryRegistration.agentId,
          identityRegistry: primaryRegistration.agentRegistry,
          reputationRegistry:
            typeof registration?.reputationRegistry === 'string' ? registration.reputationRegistry.trim() : null,
        }
      : null,
    supportedTools,
    techStacks: [
      'TypeScript',
      'Vite + React',
      'Vercel API routes',
      'viem / account abstraction',
      'Base mainnet',
    ],
    computeConstraints: {
      maxRunTimeMs:
        typeof audit?.settings?.timeoutMs === 'number' && Number.isFinite(audit.settings.timeoutMs)
          ? Math.trunc(audit.settings.timeoutMs)
          : 900000,
      pollingIntervalMs:
        typeof audit?.settings?.pollMs === 'number' && Number.isFinite(audit.settings.pollMs)
          ? Math.trunc(audit.settings.pollMs)
          : 4000,
      failFastOnOnchainErrors: true,
    },
    taskCategories: [
      'vault-deployment',
      'erc4337-bundling',
      'strategy-allocation',
      'image-gated-launch',
      'uniswap-cca-launch',
      'erc8004-proofs',
    ],
  }
}

function buildSubmissionMetadata(params) {
  const { audit, generatedAt, projectName, tagline } = params
  const finalStatus = audit?.result?.finalStatus ?? null

  return {
    version: '1.0',
    generatedAt,
    project: {
      name: projectName || '4626 Agentic Vault Launch Operator',
      tagline:
        tagline ||
        'One-click creator vault launches with ERC-4337 execution, strict strategy verification, and receipt-grade onchain evidence.',
    },
    targetTracks: [
      'Synthesis Open Track',
      'Agents With Receipts — ERC-8004',
      'Let the Agent Cook — No Humans Required',
      'Agentic Finance (Best Uniswap API Integration)',
    ],
    evidence: {
      deploySessionId: audit?.session?.id ?? null,
      sessionSigner: audit?.session?.signer ?? null,
      finalStep: audit?.result?.finalStep ?? null,
      finalUserOpHash: finalStatus?.lastUserOpHash ?? null,
      finalTxHash: finalStatus?.lastTxHash ?? null,
      launchImage: finalStatus?.launchImage ?? null,
      diagnostics: finalStatus?.diagnostics ?? null,
      uniqueSteps: pickUniqueSteps(Array.isArray(audit?.events) ? audit.events : []),
      eventCount: Array.isArray(audit?.events) ? audit.events.length : 0,
    },
    artifacts: {
      agentManifest: './agent.json',
      executionLog: './agent_log.json',
      thisMetadataFile: './submission-metadata.json',
    },
  }
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    usage()
    return
  }

  const auditLogPathRaw = String(getArg('--audit-log', DEFAULT_AUDIT_LOG)).trim()
  const registrationPathRaw = String(getArg('--registration', DEFAULT_REGISTRATION)).trim()
  const outDirRaw = String(getArg('--out-dir', DEFAULT_OUT_DIR)).trim()
  const projectName = String(getArg('--project-name', '')).trim()
  const tagline = String(getArg('--tagline', '')).trim()

  if (!auditLogPathRaw) throw new Error('Missing --audit-log')
  if (!registrationPathRaw) throw new Error('Missing --registration')
  if (!outDirRaw) throw new Error('Missing --out-dir')

  const cwd = process.cwd()
  const auditLogPath = path.resolve(cwd, auditLogPathRaw)
  const registrationPath = path.resolve(cwd, registrationPathRaw)
  const outDir = path.resolve(cwd, outDirRaw)
  const generatedAt = new Date().toISOString()

  const [audit, registration] = await Promise.all([readJson(auditLogPath), readJson(registrationPath)])
  if (!audit || typeof audit !== 'object') throw new Error('Invalid audit log JSON')
  if (!registration || typeof registration !== 'object') throw new Error('Invalid registration JSON')

  const events = Array.isArray(audit.events) ? audit.events : []
  const agentManifest = buildAgentManifest({ registration, audit, generatedAt })
  const agentLog = {
    schemaVersion: 'synthesis-agent-log-v1',
    generatedAt,
    sessionId: audit?.session?.id ?? null,
    finalStatus: audit?.result?.status ?? null,
    finalStep: audit?.result?.finalStep ?? null,
    entries: toLogEntries(events),
  }
  const submissionMetadata = buildSubmissionMetadata({
    audit,
    generatedAt,
    projectName,
    tagline,
  })

  await fs.mkdir(outDir, { recursive: true })
  await Promise.all([
    fs.writeFile(path.join(outDir, 'agent.json'), JSON.stringify(agentManifest, null, 2), 'utf8'),
    fs.writeFile(path.join(outDir, 'agent_log.json'), JSON.stringify(agentLog, null, 2), 'utf8'),
    fs.writeFile(
      path.join(outDir, 'submission-metadata.json'),
      JSON.stringify(submissionMetadata, null, 2),
      'utf8',
    ),
  ])

  console.log('synthesis artifacts generated')
  console.log(`auditLog=${auditLogPath}`)
  console.log(`registration=${registrationPath}`)
  console.log(`outDir=${outDir}`)
}

main().catch((error) => {
  const message = String(error?.message || error)
  console.error(`generate-synthesis-artifacts failed: ${message}`)
  process.exit(1)
})
