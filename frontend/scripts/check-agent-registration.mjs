#!/usr/bin/env node

const DEFAULT_URL = 'https://4626.fun/.well-known/agent-registration.json'
const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_RETRIES = 3

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseExpectedAgentId(raw) {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) {
    throw new Error('AGENT_REGISTRATION_EXPECTED_ID must be a non-negative integer when provided.')
  }
  return n
}

function normalizeRegistryRef(value) {
  return String(value || '').trim().toLowerCase()
}

function parseExpectedAgentRegistry(raw) {
  if (!raw) return null
  const normalized = normalizeRegistryRef(raw)
  if (!/^eip155:\d+:0x[a-f0-9]{40}$/.test(normalized)) {
    throw new Error('AGENT_REGISTRATION_EXPECTED_REGISTRY must match eip155:<chainId>:0x<40-hex>.')
  }
  return normalized
}

async function fetchJsonWithRetries(url, timeoutMs, retries) {
  let lastError = null
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { method: 'GET', signal: controller.signal, headers: { accept: 'application/json' } })
      clearTimeout(timeout)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }
      const payload = await res.json()
      return { payload, status: res.status }
    } catch (error) {
      clearTimeout(timeout)
      lastError = error
      if (attempt < retries) {
        await sleep(500 * attempt)
      }
    }
  }
  throw lastError || new Error('Failed to fetch agent registration payload.')
}

function validatePayload(payload, expectedAgentId, expectedAgentRegistry) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Response body must be a JSON object.')
  }

  const registrations = payload.registrations
  if (!Array.isArray(registrations) || registrations.length === 0) {
    throw new Error('`registrations` must be a non-empty array.')
  }

  const first = registrations[0]
  if (!first || typeof first !== 'object' || Array.isArray(first)) {
    throw new Error('`registrations[0]` must be an object.')
  }

  const agentId = Number(first.agentId)
  if (!Number.isFinite(agentId) || agentId < 0 || Math.floor(agentId) !== agentId) {
    throw new Error('`registrations[0].agentId` must be a non-negative integer.')
  }

  const agentRegistry = normalizeRegistryRef(first.agentRegistry)
  if (!/^eip155:\d+:0x[a-f0-9]{40}$/.test(agentRegistry)) {
    throw new Error('`registrations[0].agentRegistry` must match eip155:<chainId>:0x<40-hex>.')
  }

  if (expectedAgentId !== null && agentId !== expectedAgentId) {
    throw new Error(`Expected agentId ${expectedAgentId}, received ${agentId}.`)
  }

  if (expectedAgentRegistry !== null && agentRegistry !== expectedAgentRegistry) {
    throw new Error(`Expected agentRegistry ${expectedAgentRegistry}, received ${agentRegistry}.`)
  }

  return { agentId, agentRegistry }
}

async function main() {
  const url = process.env.AGENT_REGISTRATION_URL || DEFAULT_URL
  const retries = Number(process.env.AGENT_REGISTRATION_RETRIES || DEFAULT_RETRIES)
  const timeoutMs = Number(process.env.AGENT_REGISTRATION_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  const expectedAgentId = parseExpectedAgentId(process.env.AGENT_REGISTRATION_EXPECTED_ID || '')
  const expectedAgentRegistry = parseExpectedAgentRegistry(process.env.AGENT_REGISTRATION_EXPECTED_REGISTRY || '')

  if (!Number.isFinite(retries) || retries <= 0) {
    throw new Error('AGENT_REGISTRATION_RETRIES must be a positive number.')
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('AGENT_REGISTRATION_TIMEOUT_MS must be a positive number.')
  }

  const { payload, status } = await fetchJsonWithRetries(url, timeoutMs, retries)
  const { agentId, agentRegistry } = validatePayload(payload, expectedAgentId, expectedAgentRegistry)

  console.log(`agent-registration check passed`)
  console.log(`url=${url}`)
  console.log(`status=${status}`)
  console.log(`agentId=${agentId}`)
  console.log(`agentRegistry=${agentRegistry}`)
}

main().catch((error) => {
  const message = String(error?.message || error)
  console.error(`agent-registration check failed: ${message}`)
  process.exit(1)
})
