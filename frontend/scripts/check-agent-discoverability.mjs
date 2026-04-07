#!/usr/bin/env node

const DEFAULT_URL = 'https://4626.fun/api/v1/agents/identity/verification'
const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_RETRIES = 3

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeRegistryRef(value) {
  return String(value || '').trim().toLowerCase()
}

function parseExpectedAgentId(raw) {
  if (!raw) return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || Math.floor(value) !== value) {
    throw new Error('AGENT_DISCOVERABILITY_EXPECTED_ID must be a non-negative integer when provided.')
  }
  return value
}

function parseExpectedAgentRegistry(raw) {
  if (!raw) return null
  const normalized = normalizeRegistryRef(raw)
  if (!/^eip155:\d+:0x[a-f0-9]{40}$/.test(normalized)) {
    throw new Error('AGENT_DISCOVERABILITY_EXPECTED_REGISTRY must match eip155:<chainId>:0x<40-hex>.')
  }
  return normalized
}

async function fetchJsonWithRetries(url, timeoutMs, retries) {
  let lastError = null
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { accept: 'application/json' },
      })
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      const json = await res.json()
      if (!json || typeof json !== 'object' || json.success !== true || !json.data) {
        throw new Error('Verification endpoint returned an unexpected payload shape.')
      }
      return { payload: json.data, status: res.status }
    } catch (error) {
      clearTimeout(timeout)
      lastError = error
      if (attempt < retries) await sleep(500 * attempt)
    }
  }
  throw lastError || new Error('Failed to fetch discoverability payload.')
}

export function validateDiscoverabilityPayload(payload, options = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Verification response data must be a JSON object.')
  }

  const expectedAgentId = options.expectedAgentId ?? null
  const expectedAgentRegistry = options.expectedAgentRegistry ?? null
  const expectReady = options.expectReady !== false

  const agentId = Number(payload.agentId)
  if (!Number.isFinite(agentId) || agentId < 0 || Math.floor(agentId) !== agentId) {
    throw new Error('`agentId` must be a non-negative integer.')
  }
  if (expectedAgentId !== null && agentId !== expectedAgentId) {
    throw new Error(`Expected agentId ${expectedAgentId}, received ${agentId}.`)
  }

  const chainId = Number(payload.chainId)
  const registryAddress = String(payload.registryAddress || '').trim().toLowerCase()
  if (!Number.isFinite(chainId) || chainId <= 0 || !/^0x[a-f0-9]{40}$/.test(registryAddress)) {
    throw new Error('Verification payload is missing a valid chainId or registryAddress.')
  }
  const registryRef = `eip155:${chainId}:${registryAddress}`
  if (expectedAgentRegistry !== null && registryRef !== expectedAgentRegistry) {
    throw new Error(`Expected agentRegistry ${expectedAgentRegistry}, received ${registryRef}.`)
  }

  const checks = Array.isArray(payload.checks) ? payload.checks : []
  const failedChecks = checks.filter((check) => check && check.passed === false)
  const discoverabilityReady = payload.discoverabilityReady === true
  if (expectReady && !discoverabilityReady) {
    const failureSummary =
      failedChecks.length > 0
        ? failedChecks.map((check) => `${String(check.id)}: ${String(check.detail || 'failed')}`).join('; ')
        : 'discoverabilityReady=false'
    throw new Error(`Discoverability verification failed: ${failureSummary}`)
  }

  return {
    agentId,
    registryRef,
    discoverabilityReady,
    endpointUrl: payload?.endpoint?.url ?? null,
    registrationMirrorUrl: payload?.mirrors?.registration?.url ?? null,
    domainVerificationUrl: payload?.mirrors?.domainVerification?.url ?? null,
    failedChecks,
  }
}

async function main() {
  const url = process.env.AGENT_DISCOVERABILITY_URL || DEFAULT_URL
  const retries = Number(process.env.AGENT_DISCOVERABILITY_RETRIES || DEFAULT_RETRIES)
  const timeoutMs = Number(process.env.AGENT_DISCOVERABILITY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  const expectedAgentId = parseExpectedAgentId(process.env.AGENT_DISCOVERABILITY_EXPECTED_ID || '')
  const expectedAgentRegistry = parseExpectedAgentRegistry(process.env.AGENT_DISCOVERABILITY_EXPECTED_REGISTRY || '')
  const expectReady = String(process.env.AGENT_DISCOVERABILITY_EXPECT_READY || 'true').trim().toLowerCase() !== 'false'

  if (!Number.isFinite(retries) || retries <= 0) {
    throw new Error('AGENT_DISCOVERABILITY_RETRIES must be a positive number.')
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('AGENT_DISCOVERABILITY_TIMEOUT_MS must be a positive number.')
  }

  const { payload, status } = await fetchJsonWithRetries(url, timeoutMs, retries)
  const summary = validateDiscoverabilityPayload(payload, {
    expectedAgentId,
    expectedAgentRegistry,
    expectReady,
  })

  console.log('agent-discoverability check passed')
  console.log(`url=${url}`)
  console.log(`status=${status}`)
  console.log(`agentId=${summary.agentId}`)
  console.log(`agentRegistry=${summary.registryRef}`)
  console.log(`discoverabilityReady=${summary.discoverabilityReady}`)
  if (summary.registrationMirrorUrl) console.log(`registrationMirror=${summary.registrationMirrorUrl}`)
  if (summary.domainVerificationUrl) console.log(`domainVerification=${summary.domainVerificationUrl}`)
  if (summary.endpointUrl) console.log(`endpoint=${summary.endpointUrl}`)
}

main().catch((error) => {
  const message = String(error?.message || error)
  console.error(`agent-discoverability check failed: ${message}`)
  process.exit(1)
})
