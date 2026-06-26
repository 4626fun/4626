import { redactForRemoteAi, redactTextForRemoteAi } from './redaction.js'

type RemoteAiPayloadOptions = {
  allowFields?: string[]
  pseudonymizeFields?: string[]
  maskAddresses?: boolean
  maxStringLength?: number
  maxArrayItems?: number
  maxDepth?: number
}

const ALLOWED_REMOTE_AI_HOSTS = new Set([
  'api.anthropic.com',
  'api.groq.com',
  'api.openai.com',
  'compute.virtuals.io',
  'openrouter.ai',
])

export function assertRemoteAiEndpoint(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(String(url ?? '').trim())
  } catch {
    throw new Error('Remote AI endpoint must be a valid absolute URL')
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Remote AI endpoint must use HTTPS')
  }
  if (!ALLOWED_REMOTE_AI_HOSTS.has(parsed.hostname)) {
    throw new Error(`Remote AI endpoint is not in the allowlist: ${parsed.hostname}`)
  }
  return parsed.toString()
}

export function fetchRemoteAi(url: string, init?: RequestInit): Promise<Response> {
  return fetch(assertRemoteAiEndpoint(url), {
    ...init,
    redirect: 'error',
  })
}

export function prepareRemoteAiText(
  input: string,
  options: Pick<RemoteAiPayloadOptions, 'maskAddresses' | 'maxStringLength'> = {},
): string {
  return redactTextForRemoteAi(String(input ?? ''), {
    maskAddresses: options.maskAddresses ?? true,
    ...(typeof options.maxStringLength === 'number'
      ? { maxStringLength: options.maxStringLength }
      : {}),
  })
}

export function prepareRemoteAiJsonPayload<T = unknown>(
  payload: T,
  options: RemoteAiPayloadOptions = {},
): T {
  return redactForRemoteAi(payload, {
    ...options,
    maskAddresses: options.maskAddresses ?? true,
  }) as T
}

export function prepareRemoteAiJsonString(
  payload: unknown,
  options: RemoteAiPayloadOptions = {},
): string {
  return JSON.stringify(prepareRemoteAiJsonPayload(payload, options))
}
