import { HTTPClient, type NodeRuntime } from "@chainlink/cre-sdk"

export type ApiRuntimeConfig = {
  apiBaseUrl: string
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

type JsonRequestOptions = {
  method: HttpMethod
  path: string
  payload?: unknown
}

export function encodeJsonBody(payload: unknown): string {
  const json = JSON.stringify(payload)
  if (typeof btoa === "function") return btoa(json)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maybeBuffer = (globalThis as any).Buffer
  if (maybeBuffer?.from) return maybeBuffer.from(json, "utf8").toString("base64")
  throw new Error("base64_encoder_unavailable")
}

function decodeJsonBody<T>(body: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(body)) as T
}

function withLeadingSlash(path: string): string {
  if (path.startsWith("/")) return path
  return `/${path}`
}

function requestHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }
}

export function sendJsonRequest<Config extends ApiRuntimeConfig, T>(
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  apiKey: string,
  options: JsonRequestOptions,
): T {
  const url = `${nodeRuntime.config.apiBaseUrl}${withLeadingSlash(options.path)}`
  const request = {
    url,
    method: options.method,
    headers: requestHeaders(apiKey),
    ...(options.payload === undefined ? {} : { body: encodeJsonBody(options.payload) }),
  }

  const response = httpClient.sendRequest(nodeRuntime, request).result()
  if (response.statusCode >= 400) {
    throw new Error(`http_${options.method.toLowerCase()}_${response.statusCode}_${options.path}`)
  }

  return decodeJsonBody<T>(response.body)
}

export function getJson<Config extends ApiRuntimeConfig, T>(
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  apiKey: string,
  path: string,
): T {
  return sendJsonRequest<Config, T>(nodeRuntime, httpClient, apiKey, {
    method: "GET",
    path,
  })
}

export function postJson<Config extends ApiRuntimeConfig, T>(
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  apiKey: string,
  path: string,
  payload: unknown,
): T {
  return sendJsonRequest<Config, T>(nodeRuntime, httpClient, apiKey, {
    method: "POST",
    path,
    payload,
  })
}
