import { fetchRemoteAi } from '../../../../_lib/agentControl/remoteAi.js'

const DEFAULT_MODEL = 'moonshotai/kimi-k2-0905'
const DEFAULT_TIMEOUT_MS = 20_000

export type VirtualsComputePingResult =
  | { ok: true; model: string; content: string }
  | { ok: false; status?: number; error: string }

export async function pingVirtualsCompute(params: {
  apiKey: string
  model?: string
  timeoutMs?: number
}): Promise<VirtualsComputePingResult> {
  const apiKey = String(params.apiKey ?? '').trim()
  if (!apiKey) {
    return { ok: false, error: 'missing_api_key' }
  }

  const model = String(params.model ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const timeoutMs = Math.max(1_000, Math.floor(params.timeoutMs ?? DEFAULT_TIMEOUT_MS))
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchRemoteAi('https://compute.virtuals.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 8,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      let detail = `http_${response.status}`
      try {
        const json = (await response.json()) as { error?: { message?: string } }
        const message = String(json?.error?.message ?? '').trim()
        if (message) detail = message
      } catch {
        // Keep status-only detail when body is not JSON.
      }
      return { ok: false, status: response.status, error: detail }
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = String(json?.choices?.[0]?.message?.content ?? '').trim()
    if (!content) {
      return { ok: false, status: response.status, error: 'empty_response' }
    }
    return { ok: true, model, content }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.toLowerCase().includes('abort')) {
      return { ok: false, error: 'timeout' }
    }
    return { ok: false, error: message }
  } finally {
    clearTimeout(timeout)
  }
}
