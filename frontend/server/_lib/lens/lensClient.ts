/**
 * Shared Lens Protocol GraphQL helpers.
 *
 * Uses the Lens V3 public GraphQL endpoint directly to avoid pnpm-hoisting
 * issues with `@lens-protocol/client` sub-package re-exports.
 */

const LENS_API_URL = 'https://api.lens.xyz/graphql'

/**
 * Execute a typed GraphQL query against the Lens V3 API.
 */
export async function lensGql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(LENS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) {
    throw new Error(`Lens API HTTP ${res.status}: ${res.statusText}`)
  }

  const json = (await res.json()) as { data?: T; errors?: { message: string }[] }

  if (json.errors?.length) {
    throw new Error(`Lens API error: ${json.errors[0]!.message}`)
  }

  return json.data as T
}
