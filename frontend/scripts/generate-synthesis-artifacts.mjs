#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_AUDIT_LOG = 'artifacts/deploy-run.json'
const DEFAULT_REGISTRATION = 'public/.well-known/agent-registration.json'
const DEFAULT_EVIDENCE = 'artifacts/synthesis-evidence.json'
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
    --evidence ${DEFAULT_EVIDENCE} \
    --out-dir ${DEFAULT_OUT_DIR}

Options:
  --audit-log <path>      Deploy autopilot audit log JSON (required; default: ${DEFAULT_AUDIT_LOG})
  --registration <path>   Agent registration JSON (default: ${DEFAULT_REGISTRATION})
  --evidence <path>       Optional live-proof evidence JSON (default: ${DEFAULT_EVIDENCE} if present)
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

async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toOptionalString(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || null
}

function toStringArray(value) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean),
    ),
  )
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      values
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean),
    ),
  )
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

function getService(registration, serviceName) {
  const services = Array.isArray(registration?.services) ? registration.services : []
  const normalizedName = serviceName.trim().toLowerCase()
  return (
    services.find((entry) => {
      const name = typeof entry?.name === 'string' ? entry.name.trim().toLowerCase() : ''
      return name === normalizedName
    }) ?? null
  )
}

function getServiceEndpoint(registration, serviceName) {
  return toOptionalString(getService(registration, serviceName)?.endpoint)
}

function getUrlOrigin(value) {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
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

function normalizeEvidence(evidence, params) {
  const { registration, primaryRegistration } = params
  const root = isObject(evidence) ? evidence : {}
  const flagshipDemo = isObject(root.flagshipDemo) ? root.flagshipDemo : {}
  const links = isObject(root.links) ? root.links : {}
  const liveProofs = isObject(root.liveProofs) ? root.liveProofs : {}
  const judgeNotes = isObject(root.judgeNotes) ? root.judgeNotes : {}
  const trackOverrides = isObject(root.trackOverrides) ? root.trackOverrides : {}

  const webEndpoint = getServiceEndpoint(registration, 'web')
  const apiEndpoint = getServiceEndpoint(registration, 'api')
  const x402ReviewEndpoint = getServiceEndpoint(registration, 'erc8004-review')
  const walletIntelligenceEndpoint = getServiceEndpoint(registration, 'wallet-intelligence')
  const feedbackEndpoint = getServiceEndpoint(registration, 'feedback')
  const xmtpEndpoint = getServiceEndpoint(registration, 'XMTP')
  const publicOrigin =
    getUrlOrigin(webEndpoint) ||
    getUrlOrigin(apiEndpoint) ||
    getUrlOrigin(x402ReviewEndpoint) ||
    'https://4626.fun'

  const erc8004 = isObject(liveProofs.erc8004) ? liveProofs.erc8004 : {}
  const uniswap = isObject(liveProofs.uniswap) ? liveProofs.uniswap : {}
  const ens = isObject(liveProofs.ens) ? liveProofs.ens : {}
  const x402 = isObject(liveProofs.x402) ? liveProofs.x402 : {}
  const autonomousTrading = isObject(liveProofs.autonomousTrading) ? liveProofs.autonomousTrading : {}

  return {
    flagshipDemo: {
      title:
        toOptionalString(flagshipDemo.title) ||
        '4626 is an ERC-8004-registered Base agent that discovers a task, plans a solution, executes onchain actions, verifies outcomes, and publishes receipts.',
      narrative:
        toOptionalString(flagshipDemo.narrative) ||
        'The flagship demo is one canonical autonomous deployment run on Base, then the same agent identity is reused for ERC-8004 reviews, Uniswap execution, and ENS/Basename-first communication.',
      videoUrl: toOptionalString(flagshipDemo.videoUrl),
    },
    links: {
      repoUrl: toOptionalString(links.repoUrl),
      demoUrl: toOptionalString(links.demoUrl) || webEndpoint,
      apiSpecUrl: toOptionalString(links.apiSpecUrl) || apiEndpoint,
      registrationUrl:
        toOptionalString(links.registrationUrl) || `${publicOrigin.replace(/\/+$/, '')}/.well-known/agent-registration.json`,
      erc8004DomainProofUrl:
        toOptionalString(links.erc8004DomainProofUrl) || `${publicOrigin.replace(/\/+$/, '')}/.well-known/erc8004.json`,
      walletIntelligenceUrl: toOptionalString(links.walletIntelligenceUrl) || walletIntelligenceEndpoint,
      feedbackUrl: toOptionalString(links.feedbackUrl) || feedbackEndpoint,
      x402ReviewUrl: toOptionalString(links.x402ReviewUrl) || x402ReviewEndpoint,
      xmtpUrl: toOptionalString(links.xmtpUrl) || xmtpEndpoint,
    },
    liveProofs: {
      erc8004: {
        scanUrl:
          toOptionalString(erc8004.scanUrl) ||
          (primaryRegistration ? `https://www.8004scan.io/agents/base/${primaryRegistration.agentId}` : null),
        registrationTxHash: toOptionalString(erc8004.registrationTxHash),
        reviewTxHash: toOptionalString(erc8004.reviewTxHash),
        feedbackTxHash: toOptionalString(erc8004.feedbackTxHash),
        proofUrls: toStringArray(erc8004.proofUrls),
        description: toOptionalString(erc8004.description),
      },
      uniswap: {
        txHash: toOptionalString(uniswap.txHash),
        explorerUrl: toOptionalString(uniswap.explorerUrl),
        quoteRequestId: toOptionalString(uniswap.quoteRequestId),
        description: toOptionalString(uniswap.description),
      },
      ens: {
        primaryName: toOptionalString(ens.primaryName),
        proofUrls: toStringArray(ens.proofUrls),
        description: toOptionalString(ens.description),
      },
      x402: {
        paymentTxHash: toOptionalString(x402.paymentTxHash),
        proofUrl: toOptionalString(x402.proofUrl),
        description: toOptionalString(x402.description),
      },
      autonomousTrading: {
        profitProofUrl: toOptionalString(autonomousTrading.profitProofUrl),
        txHashes: toStringArray(autonomousTrading.txHashes),
        description: toOptionalString(autonomousTrading.description),
      },
    },
    judgeNotes: {
      openTrack: toOptionalString(judgeNotes.openTrack),
      letTheAgentCook: toOptionalString(judgeNotes.letTheAgentCook),
      agentsWithReceipts: toOptionalString(judgeNotes.agentsWithReceipts),
      uniswap: toOptionalString(judgeNotes.uniswap),
      ensIdentity: toOptionalString(judgeNotes.ensIdentity),
      ensOpenIntegration: toOptionalString(judgeNotes.ensOpenIntegration),
      ensCommunication: toOptionalString(judgeNotes.ensCommunication),
      baseAgentServices: toOptionalString(judgeNotes.baseAgentServices),
      baseAutonomousTrading: toOptionalString(judgeNotes.baseAutonomousTrading),
    },
    trackOverrides: {
      includeBaseAgentServices: trackOverrides.includeBaseAgentServices === true,
      includeBaseAutonomousTrading: trackOverrides.includeBaseAutonomousTrading === true,
    },
  }
}

function buildTrackBundle(params) {
  const { registration, audit, normalizedEvidence } = params
  const primaryRegistration = pickPrimaryRegistration(registration)
  const finalStatus = isObject(audit?.result?.finalStatus) ? audit.result.finalStatus : {}
  const finalTxHash = toOptionalString(finalStatus.lastTxHash)
  const finalUserOpHash = toOptionalString(finalStatus.lastUserOpHash)
  const deploySucceeded = audit?.result?.status === 'succeeded' || Boolean(finalTxHash || finalUserOpHash)
  const hasAutonomousLog = Array.isArray(audit?.events) && audit.events.length > 0
  const hasDeployArtifacts = hasAutonomousLog && Boolean(audit?.session?.id)
  const hasErc8004Identity = Boolean(primaryRegistration)
  const hasErc8004Surface =
    hasErc8004Identity &&
    (Boolean(normalizedEvidence.liveProofs.erc8004.scanUrl) || Boolean(normalizedEvidence.links.registrationUrl))
  const hasErc8004ReviewReceipt =
    Boolean(normalizedEvidence.liveProofs.erc8004.reviewTxHash) ||
    Boolean(normalizedEvidence.liveProofs.erc8004.feedbackTxHash) ||
    Boolean(normalizedEvidence.liveProofs.x402.paymentTxHash)
  const hasUniswapProof =
    Boolean(normalizedEvidence.liveProofs.uniswap.txHash) ||
    Boolean(normalizedEvidence.liveProofs.uniswap.explorerUrl)
  const hasEnsSurface =
    Boolean(normalizedEvidence.links.walletIntelligenceUrl) &&
    Boolean(normalizedEvidence.links.xmtpUrl)
  const hasEnsProof =
    Boolean(normalizedEvidence.liveProofs.ens.primaryName) ||
    normalizedEvidence.liveProofs.ens.proofUrls.length > 0
  const hasX402Surface =
    registration?.x402Support === true &&
    Boolean(normalizedEvidence.links.x402ReviewUrl)
  const hasX402Proof =
    Boolean(normalizedEvidence.liveProofs.x402.paymentTxHash) ||
    Boolean(normalizedEvidence.liveProofs.x402.proofUrl)
  const hasAutonomousTradingProof =
    Boolean(normalizedEvidence.liveProofs.autonomousTrading.profitProofUrl) ||
    normalizedEvidence.liveProofs.autonomousTrading.txHashes.length > 0

  function finalizeTrack(definition) {
    const missingProofs = uniqueStrings(definition.missingProofs || [])
    const status = missingProofs.length === 0
      ? (definition.bonusGap ? 'ready_bonus_gap' : 'ready')
      : 'needs_live_proof'
    return {
      id: definition.id,
      name: definition.name,
      status,
      summary: definition.summary,
      whyItFits: definition.whyItFits,
      evidence: uniqueStrings(definition.evidence || []),
      missingProofs,
      judgeNote: definition.judgeNote || null,
    }
  }

  const deployBundleEvidence = [
    './deploy-run.json',
    './agent.json',
    './agent_log.json',
    './submission-metadata.json',
    './agent-registration.json',
    normalizedEvidence.links.apiSpecUrl,
  ]

  const coreTracks = [
    finalizeTrack({
      id: 'synthesis-open-track',
      name: 'Synthesis Open Track',
      summary:
        'The flagship package shows one Base agent that can execute a full autonomous loop, expose public discovery endpoints, and then branch into sponsor-specific proofs.',
      whyItFits: 'This bundle combines autonomous execution, onchain receipts, discoverability, and cross-protocol utility from the same agent identity.',
      evidence: deployBundleEvidence,
      missingProofs: [
        !deploySucceeded ? 'run one successful canonical autonomous deploy and keep the final tx/userOp hashes' : '',
      ],
      judgeNote: normalizedEvidence.judgeNotes.openTrack,
    }),
    finalizeTrack({
      id: 'protocol-labs-let-the-agent-cook',
      name: 'Let the Agent Cook — No Humans Required',
      summary:
        'The deploy autopilot audit log captures discover -> plan -> execute -> verify with explicit preflight checks, session polling, owner-install handling, and terminal status reporting.',
      whyItFits: 'The repo already turns a multi-step deploy flow into a reproducible autonomous run with structured logs and compute limits.',
      evidence: deployBundleEvidence,
      missingProofs: [
        !hasDeployArtifacts ? 'generate deploy-run.json from a real autopilot session' : '',
        !deploySucceeded ? 'capture a clean successful run for the final demo' : '',
      ],
      judgeNote: normalizedEvidence.judgeNotes.letTheAgentCook,
    }),
    finalizeTrack({
      id: 'protocol-labs-agents-with-receipts',
      name: 'Agents With Receipts — ERC-8004',
      summary:
        '4626 already ships a live ERC-8004 registration, public registration metadata, a reputation registry reference, and an x402-gated review flow that emits Lens payloads plus unsigned giveFeedback calldata.',
      whyItFits: 'The agent identity is already onchain and judge-verifiable; adding a fresh review or feedback transaction strengthens the reputation-story bonus.',
      evidence: [
        './agent-registration.json',
        './erc8004.json',
        normalizedEvidence.links.registrationUrl,
        normalizedEvidence.liveProofs.erc8004.scanUrl,
        normalizedEvidence.links.x402ReviewUrl,
      ],
      missingProofs: [
        !hasErc8004Surface ? 'provide the live ERC-8004 scan URL or registration verification link' : '',
      ],
      bonusGap: !hasErc8004ReviewReceipt,
      judgeNote: normalizedEvidence.judgeNotes.agentsWithReceipts,
    }),
    finalizeTrack({
      id: 'uniswap-agentic-finance',
      name: 'Agentic Finance (Uniswap)',
      summary:
        '4626 exposes Uniswap quote, approval, swap, 5792 batch, 7702 delegated swap, cross-chain planning, and liquidity tools through one agent runtime.',
      whyItFits: 'The codebase already has the integration and guardrails; the remaining requirement is a clean live tx hash from the flagship wallet.',
      evidence: [
        './agent.json',
        normalizedEvidence.liveProofs.uniswap.explorerUrl,
        normalizedEvidence.liveProofs.uniswap.txHash,
      ],
      missingProofs: [
        !hasUniswapProof ? 'attach one explorer-visible Uniswap transaction hash from the flagship demo wallet' : '',
      ],
      judgeNote: normalizedEvidence.judgeNotes.uniswap,
    }),
    finalizeTrack({
      id: 'ens-identity',
      name: 'ENS Identity',
      summary:
        '4626 resolves ENS and Basenames for wallet intelligence, portfolio identity, and the public-facing wallet record rather than treating raw addresses as the primary UX.',
      whyItFits: 'The same identity layer is already reused across API, portfolio, and chat surfaces.',
      evidence: [
        normalizedEvidence.liveProofs.ens.primaryName,
        ...normalizedEvidence.liveProofs.ens.proofUrls,
      ],
      missingProofs: [
        !hasEnsSurface ? 'keep wallet-intelligence and chat identity surfaces reachable in the deployed app' : '',
        !hasEnsProof ? 'capture one ENS/Basename-first demo proof (screenshot or recording)' : '',
      ],
      judgeNote: normalizedEvidence.judgeNotes.ensIdentity,
    }),
    finalizeTrack({
      id: 'ens-open-integration',
      name: 'ENS Open Integration',
      summary:
        'The repo includes both server-side ENS/Basename resolution and client-side Basename profile fetches with caching, telemetry, and fallback handling.',
      whyItFits: 'The integration is load-bearing: identity resolution feeds the user-facing experience and agent APIs.',
      evidence: [
        normalizedEvidence.links.walletIntelligenceUrl,
        ...normalizedEvidence.liveProofs.ens.proofUrls,
      ],
      missingProofs: [
        !hasEnsProof ? 'record a concrete ENS/Basename resolution flow for the final demo' : '',
      ],
      judgeNote: normalizedEvidence.judgeNotes.ensOpenIntegration,
    }),
    finalizeTrack({
      id: 'ens-communication',
      name: 'ENS Communication',
      summary:
        'The chat surface accepts Basename handles, previews recipients with Basename hints, and routes DM creation through identity-first UX rather than raw addresses.',
      whyItFits: 'This is the most direct sponsor fit: communication is initiated and displayed through ENS/Basenames.',
      evidence: [
        normalizedEvidence.links.xmtpUrl,
        ...normalizedEvidence.liveProofs.ens.proofUrls,
      ],
      missingProofs: [
        !hasEnsProof ? 'capture a DM or whois demo showing Basename-first routing and display' : '',
      ],
      judgeNote: normalizedEvidence.judgeNotes.ensCommunication,
    }),
  ]

  const stretchTracks = [
    finalizeTrack({
      id: 'base-agent-services',
      name: 'Agent Services on Base',
      summary:
        '4626 already advertises an x402-gated ERC-8004 technical review endpoint through both its public registration and API spec.',
      whyItFits: 'The service is discoverable today; the missing piece is a clean paid request proof from another agent or wallet.',
      evidence: [
        normalizedEvidence.links.x402ReviewUrl,
        normalizedEvidence.links.apiSpecUrl,
        normalizedEvidence.liveProofs.x402.proofUrl,
        normalizedEvidence.liveProofs.x402.paymentTxHash,
      ],
      missingProofs: [
        !hasX402Surface ? 'keep x402Support=true and the public review endpoint deployed' : '',
        !hasX402Proof ? 'capture one successful paid x402 request with settlement proof' : '',
      ],
      judgeNote: normalizedEvidence.judgeNotes.baseAgentServices,
    }),
    finalizeTrack({
      id: 'base-autonomous-trading',
      name: 'Autonomous Trading Agent',
      summary:
        'The repo has trading surfaces, but this track only becomes credible once a live profitable strategy record exists.',
      whyItFits: 'Do not submit this stretch track without real profitability evidence.',
      evidence: [
        normalizedEvidence.liveProofs.autonomousTrading.profitProofUrl,
        ...normalizedEvidence.liveProofs.autonomousTrading.txHashes,
      ],
      missingProofs: [
        !hasAutonomousTradingProof ? 'attach a defensible profitability proof and supporting tx set' : '',
      ],
      judgeNote: normalizedEvidence.judgeNotes.baseAutonomousTrading,
    }),
  ]

  return {
    coreTracks,
    stretchTracks,
    readyTracks: coreTracks.filter((track) => track.status !== 'needs_live_proof').map((track) => track.name),
    blockedTracks: coreTracks
      .filter((track) => track.status === 'needs_live_proof')
      .map((track) => ({ name: track.name, missingProofs: track.missingProofs })),
    readyStretchTracks: stretchTracks.filter((track) => track.status !== 'needs_live_proof').map((track) => track.name),
    blockedStretchTracks: stretchTracks
      .filter((track) => track.status === 'needs_live_proof')
      .map((track) => ({ name: track.name, missingProofs: track.missingProofs })),
  }
}

function buildSubmissionMetadata(params) {
  const { audit, generatedAt, projectName, tagline, normalizedEvidence, tracks, hasEvidenceFile } = params
  const finalStatus = audit?.result?.finalStatus ?? null

  return {
    version: '2.0',
    generatedAt,
    project: {
      name: projectName || '4626 Agentic Vault Launch Operator',
      tagline:
        tagline ||
        'One flagship Base agent submission that reuses the same ERC-8004 identity across autonomous execution, receipts, Uniswap, and ENS/Basename surfaces.',
    },
    flagshipDemo: normalizedEvidence.flagshipDemo,
    targetTracks: tracks.coreTracks.map((track) => track.name),
    readyTracks: tracks.readyTracks,
    blockedTracks: tracks.blockedTracks,
    stretchTracks: tracks.stretchTracks.map((track) => track.name),
    readyStretchTracks: tracks.readyStretchTracks,
    blockedStretchTracks: tracks.blockedStretchTracks,
    links: normalizedEvidence.links,
    liveProofs: normalizedEvidence.liveProofs,
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
      auditLog: './deploy-run.json',
      registration: './agent-registration.json',
      domainProof: './erc8004.json',
      agentManifest: './agent.json',
      executionLog: './agent_log.json',
      trackMapping: './tracks.json',
      judgeNote: './judge-note.md',
      bundleReadme: './README.md',
      thisMetadataFile: './submission-metadata.json',
      evidenceFile: hasEvidenceFile ? './evidence.json' : null,
    },
  }
}

function buildTrackMappingJson(params) {
  const { generatedAt, tracks, normalizedEvidence } = params
  return {
    schemaVersion: 'synthesis-track-mapping-v1',
    generatedAt,
    flagshipDemo: normalizedEvidence.flagshipDemo,
    links: normalizedEvidence.links,
    coreTracks: tracks.coreTracks,
    stretchTracks: tracks.stretchTracks,
  }
}

function buildJudgeNote(params) {
  const { generatedAt, registration, audit, normalizedEvidence, tracks } = params
  const primaryRegistration = pickPrimaryRegistration(registration)
  const operatorWallet = pickOperatorWallet(registration)
  const finalStatus = isObject(audit?.result?.finalStatus) ? audit.result.finalStatus : {}
  const finalTxHash = toOptionalString(finalStatus.lastTxHash)
  const finalUserOpHash = toOptionalString(finalStatus.lastUserOpHash)
  const lines = []

  lines.push('# Judge Note')
  lines.push('')
  lines.push(`Generated: ${generatedAt}`)
  lines.push('')
  lines.push(
    `${registration?.name || '4626 Agent'} is an ERC-8004-registered Base agent that runs a canonical autonomous loop: discover, plan, execute, verify, and then package the result into receipt-grade artifacts.`,
  )
  lines.push('')
  if (primaryRegistration) {
    lines.push(`- ERC-8004 agent ID: ${primaryRegistration.agentId}`)
    lines.push(`- Identity registry: ${primaryRegistration.agentRegistry}`)
  }
  if (operatorWallet) lines.push(`- Operator wallet: ${operatorWallet}`)
  if (audit?.session?.id) lines.push(`- Deploy session: ${audit.session.id}`)
  if (finalTxHash) lines.push(`- Final tx hash: ${finalTxHash}`)
  if (finalUserOpHash) lines.push(`- Final userOp hash: ${finalUserOpHash}`)
  lines.push(`- x402 support: ${registration?.x402Support === true ? 'enabled' : 'disabled'}`)
  lines.push('')
  lines.push('Core tracks:')
  for (const track of tracks.coreTracks) {
    lines.push(`- ${track.name}: ${track.status}`)
  }
  lines.push('')
  lines.push('Stretch tracks:')
  for (const track of tracks.stretchTracks) {
    lines.push(`- ${track.name}: ${track.status}`)
  }
  lines.push('')
  lines.push('Submission rule: only submit tracks marked `ready` or `ready_bonus_gap`; drop anything still marked `needs_live_proof`.')

  if (normalizedEvidence.liveProofs.erc8004.scanUrl) {
    lines.push('')
    lines.push(`Primary ERC-8004 scan: ${normalizedEvidence.liveProofs.erc8004.scanUrl}`)
  }

  return `${lines.join('\n')}\n`
}

function buildBundleReadme(params) {
  const { generatedAt, normalizedEvidence, submissionMetadata, tracks, hasEvidenceFile } = params
  const lines = []

  lines.push('# 4626 Synthesis Submission Bundle')
  lines.push('')
  lines.push(`Generated: ${generatedAt}`)
  lines.push('')
  lines.push('## Flagship Story')
  lines.push('')
  lines.push(normalizedEvidence.flagshipDemo.title)
  lines.push('')
  lines.push(normalizedEvidence.flagshipDemo.narrative)
  lines.push('')

  if (normalizedEvidence.flagshipDemo.videoUrl) {
    lines.push('## Demo')
    lines.push('')
    lines.push(`- Video: ${normalizedEvidence.flagshipDemo.videoUrl}`)
    lines.push('')
  }

  lines.push('## Public Links')
  lines.push('')
  for (const [label, value] of Object.entries(submissionMetadata.links || {})) {
    if (!value) continue
    lines.push(`- ${label}: ${value}`)
  }
  lines.push('')

  lines.push('## Included Files')
  lines.push('')
  lines.push('- `./deploy-run.json`')
  lines.push('- `./agent-registration.json`')
  lines.push('- `./erc8004.json`')
  lines.push('- `./agent.json`')
  lines.push('- `./agent_log.json`')
  lines.push('- `./submission-metadata.json`')
  lines.push('- `./tracks.json`')
  lines.push('- `./judge-note.md`')
  lines.push('- `./README.md`')
  if (hasEvidenceFile) {
    lines.push('- `./evidence.json`')
  }
  lines.push('')

  lines.push('## Track Matrix')
  lines.push('')
  for (const track of [...tracks.coreTracks, ...tracks.stretchTracks]) {
    lines.push(`### ${track.name}`)
    lines.push('')
    lines.push(`- Status: ${track.status}`)
    lines.push(`- Why it fits: ${track.whyItFits}`)
    if (track.evidence.length > 0) {
      lines.push(`- Evidence: ${track.evidence.join(', ')}`)
    }
    if (track.missingProofs.length > 0) {
      lines.push(`- Missing before submit: ${track.missingProofs.join('; ')}`)
    }
    if (track.judgeNote) {
      lines.push(`- Judge note: ${track.judgeNote}`)
    }
    lines.push('')
  }

  lines.push('## Reproduce')
  lines.push('')
  lines.push('```bash')
  lines.push('pnpm -C frontend run deploy:autopilot -- \\')
  lines.push('  --origin https://4626.fun \\')
  lines.push('  --plan ./tmp/deploy-plan-v1.4.7-canary.json \\')
  lines.push('  --auth-bearer "$CV_AUTH_SESSION_TOKEN" \\')
  lines.push('  --audit-log ./frontend/artifacts/deploy-run.json')
  lines.push('')
  lines.push('pnpm -C frontend run synthesis:artifacts -- \\')
  lines.push('  --audit-log ./artifacts/deploy-run.json \\')
  lines.push('  --registration ./public/.well-known/agent-registration.json \\')
  lines.push('  --evidence ./artifacts/synthesis-evidence.json \\')
  lines.push('  --out-dir ./artifacts/synthesis')
  lines.push('```')
  lines.push('')

  lines.push('## Submission Rule')
  lines.push('')
  lines.push('Submit the same flagship project everywhere, but only include sponsor tracks that are marked `ready` or `ready_bonus_gap` in `tracks.json`.')

  return `${lines.join('\n')}\n`
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    usage()
    return
  }

  const auditLogPathRaw = String(getArg('--audit-log', DEFAULT_AUDIT_LOG)).trim()
  const registrationPathRaw = String(getArg('--registration', DEFAULT_REGISTRATION)).trim()
  const evidencePathRaw = String(getArg('--evidence', DEFAULT_EVIDENCE)).trim()
  const outDirRaw = String(getArg('--out-dir', DEFAULT_OUT_DIR)).trim()
  const projectName = String(getArg('--project-name', '')).trim()
  const tagline = String(getArg('--tagline', '')).trim()

  if (!auditLogPathRaw) throw new Error('Missing --audit-log')
  if (!registrationPathRaw) throw new Error('Missing --registration')
  if (!outDirRaw) throw new Error('Missing --out-dir')

  const cwd = process.cwd()
  const auditLogPath = path.resolve(cwd, auditLogPathRaw)
  const registrationPath = path.resolve(cwd, registrationPathRaw)
  const evidencePath = path.resolve(cwd, evidencePathRaw)
  const outDir = path.resolve(cwd, outDirRaw)
  const generatedAt = new Date().toISOString()

  const [audit, registration, evidence, domainProof] = await Promise.all([
    readJson(auditLogPath),
    readJson(registrationPath),
    readJsonIfExists(evidencePath),
    readJsonIfExists(path.join(path.dirname(registrationPath), 'erc8004.json')),
  ])

  if (!audit || typeof audit !== 'object') throw new Error('Invalid audit log JSON')
  if (!registration || typeof registration !== 'object') throw new Error('Invalid registration JSON')

  const events = Array.isArray(audit.events) ? audit.events : []
  const primaryRegistration = pickPrimaryRegistration(registration)
  const normalizedEvidence = normalizeEvidence(evidence, { registration, primaryRegistration })
  const tracks = buildTrackBundle({ registration, audit, normalizedEvidence })
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
    normalizedEvidence,
    tracks,
    hasEvidenceFile: Boolean(evidence),
  })
  const trackMapping = buildTrackMappingJson({
    generatedAt,
    tracks,
    normalizedEvidence,
  })
  const judgeNote = buildJudgeNote({
    generatedAt,
    registration,
    audit,
    normalizedEvidence,
    tracks,
  })
  const bundleReadme = buildBundleReadme({
    generatedAt,
    normalizedEvidence,
    submissionMetadata,
    tracks,
    hasEvidenceFile: Boolean(evidence),
  })

  await fs.mkdir(outDir, { recursive: true })
  const writes = [
    fs.writeFile(path.join(outDir, 'deploy-run.json'), JSON.stringify(audit, null, 2), 'utf8'),
    fs.writeFile(path.join(outDir, 'agent-registration.json'), JSON.stringify(registration, null, 2), 'utf8'),
    fs.writeFile(path.join(outDir, 'agent.json'), JSON.stringify(agentManifest, null, 2), 'utf8'),
    fs.writeFile(path.join(outDir, 'agent_log.json'), JSON.stringify(agentLog, null, 2), 'utf8'),
    fs.writeFile(path.join(outDir, 'tracks.json'), JSON.stringify(trackMapping, null, 2), 'utf8'),
    fs.writeFile(
      path.join(outDir, 'submission-metadata.json'),
      JSON.stringify(submissionMetadata, null, 2),
      'utf8',
    ),
    fs.writeFile(path.join(outDir, 'judge-note.md'), judgeNote, 'utf8'),
    fs.writeFile(path.join(outDir, 'README.md'), bundleReadme, 'utf8'),
  ]

  if (domainProof) {
    writes.push(fs.writeFile(path.join(outDir, 'erc8004.json'), JSON.stringify(domainProof, null, 2), 'utf8'))
  }
  if (evidence) {
    writes.push(fs.writeFile(path.join(outDir, 'evidence.json'), JSON.stringify(evidence, null, 2), 'utf8'))
  }

  await Promise.all(writes)

  console.log('synthesis submission bundle generated')
  console.log(`auditLog=${auditLogPath}`)
  console.log(`registration=${registrationPath}`)
  console.log(`evidence=${evidence ? evidencePath : 'not-provided'}`)
  console.log(`outDir=${outDir}`)
  console.log(`readyTracks=${tracks.readyTracks.length}/${tracks.coreTracks.length}`)
}

main().catch((error) => {
  const message = String(error?.message || error)
  console.error(`generate-synthesis-artifacts failed: ${message}`)
  process.exit(1)
})
