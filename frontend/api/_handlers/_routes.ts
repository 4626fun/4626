import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authRouteLoaders } from './_routes.auth.js'
import { creRouteLoaders } from './_routes.cre.js'
import { deployRouteLoaders } from './_routes.deploy.js'
import { imageRouteLoaders } from './_routes.image.js'
import { keeprRouteLoaders } from './_routes.keepr.js'
import { lensRouteLoaders } from './_routes.lens.js'
import { telegramRouteLoaders } from './_routes.telegram.js'
import { uniswapRouteLoaders } from './_routes.uniswap.js'
import { getV1ApiHandler } from './_routes.v1.js'
import { waitlistRouteLoaders } from './_routes.waitlist.js'
import { walletSolanaRouteLoaders } from './_routes.wallet.solana.js'
import { zoraRouteLoaders } from './_routes.zora.js'

export type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>

type ApiHandlerModule = { default?: ApiHandler }
type ApiRouteLoaders = Record<string, () => Promise<ApiHandlerModule>>

function prefixRouteLoaders(prefix: string, loaders: ApiRouteLoaders): ApiRouteLoaders {
  return Object.fromEntries(
    Object.entries(loaders).map(([subpath, loader]) => [subpath ? `${prefix}/${subpath}` : prefix, loader])
  )
}

// Keep the root catch-all small enough to be practical, but fold the thinner
// route families back into it so Vercel doesn't spend extra packaging passes
// on wrappers that do not need runtime isolation.
export const apiRouteLoaders: Record<string, () => Promise<ApiHandlerModule>> = {
  'analytics': () => import('./_analytics.js'),
  'agents': () => import('./_agents.js'),
  'agent/invokeSkill': () => import('./agent/_invokeSkill.js'),
  'agent/stream': () => import('./agent/_stream.js'),
  // agent/process is deployed as a standalone function (api/agent/process.ts)
  // to isolate the heavy @xmtp/node-bindings (~214 MB) from the catch-all bundle.
  // 'agent/process': () => import('./agent/_process.js'),
  'token/image': () => import('./token/_image.js'),
  'telegram/webhook': () => import('./telegram/_webhook.js'),

  'onboarding/bootstrap': () => import('./onboarding/_bootstrap.js'),
  'accounts/me': () => import('./accounts/_me.js'),
  'accounts/link': () => import('./accounts/_link.js'),
  'accounts/unlink': () => import('./accounts/_unlink.js'),
  'wallet/sync': () => import('./wallet/_sync.js'),
  'wallet/prepare-add-privy-owner': () => import('./wallet/_prepare-add-privy-owner.js'),
  'wallet/confirm-owner': () => import('./wallet/_confirm-owner.js'),
  'wallet/prepare-add-rabby-owner': () => import('./wallet/_prepare-add-rabby-owner.js'),
  'portfolio/me': () => import('./portfolio/_me.js'),
  'vaults/active': () => import('./vaults/_active.js'),

  'creator-allowlist': () => import('./_creator-allowlist.js'),
  'creator-wallets/claim': () => import('./_creator-wallets-claim.js'),
  'creator-access/debug': () => import('./creator-access/_debug.js'),
  'creator-access/request': () => import('./creator-access/_request.js'),
  'creator-access/status': () => import('./creator-access/_status.js'),

  'debank/totalBalanceBatch': () => import('./debank/_totalBalanceBatch.js'),
  'debank/tokenList': () => import('./debank/_tokenList.js'),
  'dexscreener/tokenStatsBatch': () => import('./dexscreener/_tokenStatsBatch.js'),

  'deploy/session/cancel': () => import('./deploy/session/_cancel.js'),
  'deploy/session/bootstrapSwap': () => import('./deploy/session/_bootstrapSwap.js'),
  'deploy/session/continue': () => import('./deploy/session/_continue.js'),
  'deploy/session/create': () => import('./deploy/session/_create.js'),
  'deploy/session/dry-run': () => import('./deploy/session/_dryRun.js'),
  'deploy/session/start': () => import('./deploy/session/_start.js'),
  'deploy/session/status': () => import('./deploy/session/_status.js'),
  'deploy/config': () => import('./deploy/_config.js'),
  'deploy/smartWalletOwner': () => import('./deploy/_smartWalletOwner.js'),
  'deploy/smartWalletOwners': () => import('./deploy/_smartWalletOwners.js'),

  'bankr/status': () => import('./bankr/_status.js'),
  'bankr/profile': () => import('./bankr/_profile.js'),

  'health': () => import('./_health.js'),

  'onchain/coinMarketRewardsByCoin': () => import('./onchain/_coinMarketRewardsByCoin.js'),
  'onchain/coinMarketRewardsCurrency': () => import('./onchain/_coinMarketRewardsCurrency.js'),
  'onchain/coinTradeRewardsBatch': () => import('./onchain/_coinTradeRewardsBatch.js'),
  'onchain/protocolRewardsClaimable': () => import('./onchain/_protocolRewardsClaimable.js'),
  'onchain/protocolRewardsWithdrawn': () => import('./onchain/_protocolRewardsWithdrawn.js'),

  'paymaster': () => import('./_paymaster.js'),
  'revert-finance': () => import('./_revert-finance.js'),

  'social/recipient': () => import('./social/_recipient.js'),
  'social/talent': () => import('./social/_talent.js'),
  'social/twitter': () => import('./social/_twitter.js'),
  'status/protocolReport': () => import('./status/_protocolReport.js'),
  'status/vaultReport': () => import('./status/_vaultReport.js'),

  'sync-vault-data': () => import('./_sync-vault-data.js'),
  'referrals/click': () => import('./referrals/_click.js'),
  'referrals/me': () => import('./referrals/_me.js'),
  'referrals/leaderboard': () => import('./referrals/_leaderboard.js'),
  'rpc': () => import('./rpc/_proxy.js'),

  'token/metadata': () => import('./token/_metadata.js'),
  'token/tokenlist': () => import('./token/_tokenlist.js'),
  'tokenlist': () => import('./token/_managedTokenList.js'),
  'tokenlist.json': () => import('./token/_managedTokenList.js'),

  'openclaw/tools': () => import('./openclaw/_tools.js'),
  'openclaw/execute': () => import('./openclaw/_execute.js'),

  'admin/creator-access/allowlist': () => import('./admin/creator-access/_allowlist.js'),
  'admin/creator-access/approve': () => import('./admin/creator-access/_approve.js'),
  'admin/creator-access/deny': () => import('./admin/creator-access/_deny.js'),
  'admin/creator-access/list': () => import('./admin/creator-access/_list.js'),
  'admin/creator-access/note': () => import('./admin/creator-access/_note.js'),
  'admin/creator-access/restore': () => import('./admin/creator-access/_restore.js'),
  'admin/creator-access/revoke': () => import('./admin/creator-access/_revoke.js'),
  'admin/db/index-usage': () => import('./admin/db/_indexUsage.js'),
  'admin/waitlist/detail': () => import('./admin/waitlist/_detail.js'),
  'admin/waitlist/list': () => import('./admin/waitlist/_list.js'),
  'admin/waitlist/approve': () => import('./admin/waitlist/_approve.js'),
  'admin/waitlist/deny': () => import('./admin/waitlist/_deny.js'),
  'admin/waitlist/delete': () => import('./admin/waitlist/_delete.js'),
  'admin/wallet/canonical-owner-link-status': () => import('./admin/wallet/_canonicalOwnerLinkStatus.js'),
  'admin/wallet/duplicate-principals': () => import('./admin/wallet/_duplicatePrincipals.js'),

  ...prefixRouteLoaders('auth', authRouteLoaders),
  ...prefixRouteLoaders('cre', creRouteLoaders),
  ...prefixRouteLoaders('deploy', deployRouteLoaders),
  ...prefixRouteLoaders('image', imageRouteLoaders),
  ...prefixRouteLoaders('keepr', keeprRouteLoaders),
  ...prefixRouteLoaders('lens', lensRouteLoaders),
  ...prefixRouteLoaders('telegram', telegramRouteLoaders),
  ...prefixRouteLoaders('uniswap', uniswapRouteLoaders),
  ...prefixRouteLoaders('waitlist', waitlistRouteLoaders),
  ...prefixRouteLoaders('wallet/solana', walletSolanaRouteLoaders),
  ...prefixRouteLoaders('zora', zoraRouteLoaders),
}

export async function getApiHandler(subpath: string): Promise<ApiHandler | null> {
  if (subpath === 'v1' || subpath.startsWith('v1/')) {
    return getV1ApiHandler(subpath.slice(3))
  }
  const loader = apiRouteLoaders[subpath]
  if (!loader) return null
  const mod = await loader()
  return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
}
