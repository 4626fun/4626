import type { ApiHandler, ApiRouteLoaders } from './_routeLoader.js'
import { authRouteLoaders } from './_routes.auth.js'
import { cdpRouteLoaders } from './_routes.cdp.js'
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
import { loadHandlerFromMap } from './_routeLoader.js'
export type { ApiHandler } from './_routeLoader.js'

function prefixRouteLoaders(prefix: string, loaders: ApiRouteLoaders): ApiRouteLoaders {
  return Object.fromEntries(
    Object.entries(loaders).map(([subpath, loader]) => [subpath ? `${prefix}/${subpath}` : prefix, loader])
  )
}

// Keep the root catch-all small enough to be practical, but fold the thinner
// route families back into it so Vercel doesn't spend extra packaging passes
// on wrappers that do not need runtime isolation.
export const apiRouteLoaders: ApiRouteLoaders = {
  'agents': () => import('./agents/_agents.js'),
  'agent/creative': () => import('./agent/_creative.js'),
  'agent/stream': () => import('./agent/_stream.js'),
  // agent/process is deployed as a standalone function (api/agent/process.ts)
  // to isolate the heavy @xmtp/node-bindings (~214 MB) from the catch-all bundle.
  // 'agent/process': () => import('./agent/_process.js'),
  'token/image': () => import('./token/_image.js'),
  'telegram/webhook': () => import('./telegram/_webhook.js'),

  'onboarding/bootstrap': () => import('./onboarding/_bootstrap.js'),
  'onboarding/register-sub-account': () => import('./onboarding/_register-sub-account.js'),
  'onboarding/provision-agent-owner': () => import('./onboarding/_provision-agent-owner.js'),
  'onboarding/preview-agent-owner': () => import('./onboarding/_preview-agent-owner.js'),
  'onboarding/preview-remove-owner': () => import('./onboarding/_preview-remove-owner.js'),
  'accounts/me': () => import('./accounts/_me.js'),
  'accounts/link': () => import('./accounts/_link.js'),
  'accounts/unlink': () => import('./accounts/_unlink.js'),
  'wallet/sync': () => import('./wallet/_sync.js'),
  'wallet/prepare-add-privy-owner': () => import('./wallet/_prepare-add-privy-owner.js'),
  'wallet/confirm-owner': () => import('./wallet/_confirm-owner.js'),
  'wallet/prepare-add-rabby-owner': () => import('./wallet/_prepare-add-rabby-owner.js'),
  'portfolio/me': () => import('./portfolio/_me.js'),
  'vaults/active': () => import('./vaults/_active.js'),

  'creator-allowlist': () => import('./creator-access/_allowlist.js'),
  'creator-access/request': () => import('./creator-access/_request.js'),
  'creator/strategy/activate': () => import('./creator/strategy/_activate.js'),
  'creator/strategy/list': () => import('./creator/strategy/_list.js'),
  'creator/strategy/x402-activate': () => import('./creator/strategy/_x402-activate.js'),
  'creator/strategy/stripe/checkout': () => import('./creator/strategy/stripe/_checkout.js'),
  'creator/strategy/stripe/webhook': () => import('./creator/strategy/stripe/_webhook.js'),
  'creator-access/status': () => import('./creator-access/_status.js'),

  'debank/totalBalanceBatch': () => import('./debank/_totalBalanceBatch.js'),
  'debank/tokenList': () => import('./debank/_tokenList.js'),
  'deploy/v2/session/cancel': () => import('./deploy/v2/session/_cancel.js'),
  'deploy/v2/session/create': () => import('./deploy/v2/session/_create.js'),
  'deploy/v2/session/dry-run': () => import('./deploy/v2/session/_dryRun.js'),
  'deploy/v2/session/resume': () => import('./deploy/v2/session/_resume.js'),
  'deploy/v2/session/start': () => import('./deploy/v2/session/_start.js'),
  'deploy/v2/session/status': () => import('./deploy/v2/session/_status.js'),
  'deploy/config': () => import('./deploy/_config.js'),
  'deploy/smartWalletOwner': () => import('./deploy/_smartWalletOwner.js'),
  'deploy/smartWalletOwners': () => import('./deploy/_smartWalletOwners.js'),
  'keeper/jobs/enqueue': () => import('./keeper/jobs/_enqueue.js'),
  'keeper/jobs/enqueue-active-vaults': () => import('./keeper/jobs/_enqueueActiveVaults.js'),
  'keeper/jobs/enqueue-bridge-integrity': () => import('./keeper/jobs/_enqueueBridgeIntegrity.js'),
  'keeper/jobs/enqueue-solana-reconcile': () => import('./keeper/jobs/_enqueueSolanaReconcile.js'),
  'keeper/jobs/enqueue-strategy-canary': () => import('./keeper/jobs/_enqueueStrategyCanary.js'),
  'keeper/jobs/enqueue-strategy-signals': () => import('./keeper/jobs/_enqueueStrategySignals.js'),
  'keeper/jobs/enqueue-sweep-canary': () => import('./keeper/jobs/_enqueueSweepCanary.js'),
  'keeper/jobs/enqueue-vault-canary': () => import('./keeper/jobs/_enqueueVaultCanary.js'),
  'keeper/jobs/claim': () => import('./keeper/jobs/_claim.js'),
  'keeper/jobs/complete': () => import('./keeper/jobs/_complete.js'),
  'keeper/jobs/process-keepr-actions': () => import('./keeper/jobs/_processKeeprActions.js'),
  'keeper/jobs/run': () => import('./keeper/jobs/_run.js'),
  'keeper/jobs/status': () => import('./keeper/jobs/_status.js'),
  'keeper/jobs/health': () => import('./keeper/jobs/_health.js'),

  'flags/discover': () => import('./flags/_discover.js'),
  'flags/evaluate': () => import('./flags/_evaluate.js'),
  'health': () => import('./health/_health.js'),
  'analytics/event': () => import('./analytics/_event.js'),

  'onchain/coinTradeRewardsBatch': () => import('./onchain/_coinTradeRewardsBatch.js'),
  'onchain/protocolRewardsClaimable': () => import('./onchain/_protocolRewardsClaimable.js'),
  'onchain/protocolRewardsWithdrawn': () => import('./onchain/_protocolRewardsWithdrawn.js'),

  'paymaster': () => import('./paymaster/_paymaster.js'),
  'relay/execute': () => import('./relay/_execute.js'),
  'relay/quote': () => import('./relay/_quote.js'),
  'social/recipient': () => import('./social/_recipient.js'),
  'social/talent': () => import('./social/_talent.js'),
  'status/protocolReport': () => import('./status/_protocolReport.js'),
  'status/vaultReport': () => import('./status/_vaultReport.js'),

  'sync-creator-metrics': () => import('./zora/_sync-creator-metrics.js'),
  'rpc': () => import('./rpc/_proxy.js'),

  'token/metadata': () => import('./token/_metadata.js'),
  'tokenlist': () => import('./token/_managedTokenList.js'),

  'admin/creator-access/allowlist': () => import('./admin/creator-access/_allowlist.js'),
  'admin/creator-access/approve': () => import('./admin/creator-access/_approve.js'),
  'admin/creator-access/deny': () => import('./admin/creator-access/_deny.js'),
  'admin/creator-access/list': () => import('./admin/creator-access/_list.js'),
  'admin/creator-access/revoke': () => import('./admin/creator-access/_revoke.js'),
  'admin/creator-strategy/provisioning-queue': () =>
    import('./admin/creator-strategy/_provisioningQueue.js'),
  'admin/waitlist/detail': () => import('./admin/waitlist/_detail.js'),
  'admin/waitlist/list': () => import('./admin/waitlist/_list.js'),
  'admin/waitlist/approve': () => import('./admin/waitlist/_approve.js'),
  'admin/waitlist/deny': () => import('./admin/waitlist/_deny.js'),
  'admin/waitlist/delete': () => import('./admin/waitlist/_delete.js'),
  'admin/waitlist/regenerate-points': () => import('./admin/waitlist/_regeneratePoints.js'),
  'admin/profiles/merge': () => import('./admin/profiles/_merge.js'),
  'admin/userop/health': () => import('./admin/userop/_health.js'),
  'arch-b/enroll': () => import('./arch-b/_enroll.js'),
  'arch-b/revoke': () => import('./arch-b/_revoke.js'),
  'arch-b/status': () => import('./arch-b/_status.js'),
  'arch-b/sub-account/provision/prepare': () =>
    import('./arch-b/_subAccountProvisionPrepare.js'),
  'arch-b/sub-account/provision/commit': () =>
    import('./arch-b/_subAccountProvisionCommit.js'),
  'arch-b/sub-account/baseapp/register': () =>
    import('./arch-b/_subAccountBaseAppRegister.js'),
  'arch-b/sub-account/revoke': () => import('./arch-b/_subAccountRevoke.js'),

  'admin/arch-b/provision': () => import('./admin/arch-b/_provision.js'),
  'admin/arch-b/sub-account/provision': () =>
    import('./admin/arch-b/_subAccountProvision.js'),
  'admin/recover-stranded-csw/resolve-owner': () =>
    import('./admin/_recoverStrandedCswResolveOwner.js'),

  ...prefixRouteLoaders('auth', authRouteLoaders),
  ...prefixRouteLoaders('cdp', cdpRouteLoaders),
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
  return loadHandlerFromMap(subpath, apiRouteLoaders)
}
