/**
 * Shared Lens Protocol client singleton.
 *
 * Uses the official `@lens-protocol/client` SDK instead of raw GraphQL.
 * The PublicClient provides typed, paginated access to the full Lens V3 API
 * surface (accounts, posts, feeds, follows, groups, actions).
 */
import { PublicClient, mainnet } from '@lens-protocol/client'

let _publicClient: InstanceType<typeof PublicClient> | null = null

/**
 * Returns a shared Lens PublicClient (unauthenticated).
 * Suitable for read-only queries (account lookup, feed reads, etc.).
 */
export function getLensPublicClient(): InstanceType<typeof PublicClient> {
  if (!_publicClient) {
    _publicClient = PublicClient.create({
      environment: mainnet,
    })
  }
  return _publicClient
}
