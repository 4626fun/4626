import type { VercelRequest, VercelResponse } from '@vercel/node'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>
type ApiHandlerModule = { default?: ApiHandler }

const v1RouteLoaders: Record<string, () => Promise<ApiHandlerModule>> = {
  'spec.json': () => import('./v1/_spec.js'),
  'vault/report': () => import('./v1/vault/_report.js'),
  'vault/strategies': () => import('./v1/vault/_strategies.js'),
  'workspace/summary': () => import('./v1/workspace/_summary.js'),
  'workspace/strategies': () => import('./v1/workspace/_strategies.js'),
  'workspace/monitoring': () => import('./v1/workspace/_monitoring.js'),
  'workspace/activity': () => import('./v1/workspace/_activity.js'),
  'workspace/rooms': () => import('./v1/workspace/_rooms.js'),
  'workspace/tasks': () => import('./v1/workspace/_tasks.js'),
  'workspace/settings': () => import('./v1/workspace/_settings.js'),
  'workspace/actions': () => import('./v1/workspace/_actions.js'),
  'explore/vaults': () => import('./v1/explore/_vaults.js'),
  'auction/status': () => import('./v1/auction/_status.js'),
  'auction/activity': () => import('./v1/auction/_activity.js'),
  'auction/recentBids': () => import('./v1/auction/_recentBids.js'),
  'lottery/global': () => import('./v1/lottery/_global.js'),
  'lottery/creator': () => import('./v1/lottery/_creator.js'),
  'lottery/recentWinners': () => import('./v1/lottery/_recentWinners.js'),
  'lottery/amoe/nonce': () => import('./v1/lottery/_amoeNonce.js'),
  'lottery/amoe/credits': () => import('./v1/lottery/_amoeCredits.js'),
  'lottery/amoe/submit': () => import('./v1/lottery/_amoeSubmit.js'),
  'lottery/amoe/twitter-checkin': () => import('./v1/lottery/_amoeTwitterCheckin.js'),
  'gauge/epoch': () => import('./v1/gauge/_epoch.js'),
  'gauge/vaults': () => import('./v1/gauge/_vaults.js'),
  'gauge/user': () => import('./v1/gauge/_user.js'),
  've4626/user': () => import('./v1/ve4626/_user.js'),
  'charm/strategy': () => import('./v1/charm/_strategy.js'),
  'chat/command-preflight': () => import('./v1/chat/_commandPreflight.js'),
  'chat/telemetry': () => import('./v1/chat/_telemetry.js'),
  'creators/quickstart': () => import('./v1/creators/_quickstart.js'),
  'agents/capabilities': () => import('./v1/agents/_capabilities.js'),
  'agents/creators': () => import('./v1/agents/creators/_list.js'),
  'agents/creators/enable': () => import('./v1/agents/creators/_enable.js'),
  'agents/creators/provision-wallet': () => import('./v1/agents/creators/_provisionWallet.js'),
  'agents/feedback': () => import('./v1/agents/feedback/_read.js'),
  'agents/feedback/review': () => import('./v1/agents/feedback/_review.js'),
  'agents/feedback/submit': () => import('./v1/agents/feedback/_submit.js'),
  'agents/profile': () => import('./v1/agents/_profile.js'),
  'agents/operator-status': () => import('./v1/agents/_operator-status.js'),
  'agents/identity/verification': () => import('./v1/agents/identity/_verification.js'),
  'agents/identity/set-agent-wallet': () => import('./v1/agents/identity/_setAgentWallet.js'),
  'agents/access-proof/request': () => import('./v1/agents/access-proof/_request.js'),
  'agents/access-proof/verify': () => import('./v1/agents/access-proof/_verify.js'),
  'agents/xmtp/join': () => import('./v1/agents/xmtp/_join.js'),
  'agents/telegram/join': () => import('./v1/agents/telegram/_join.js'),
  'agents/wallet-intelligence': () => import('./v1/agents/_wallet-intelligence.js'),
  'agents/publish': () => import('./v1/agents/_publish.js'),
  'build/auction/submitBid': () => import('./v1/build/auction/_submitBid.js'),
  'build/gauge/vote': () => import('./v1/build/gauge/_vote.js'),
  'build/gauge/resetVotes': () => import('./v1/build/gauge/_resetVotes.js'),
  'build/ve4626/lock': () => import('./v1/build/ve4626/_lock.js'),
  'build/ve4626/extend': () => import('./v1/build/ve4626/_extend.js'),
  'build/ve4626/increase': () => import('./v1/build/ve4626/_increase.js'),
  'build/ve4626/unlock': () => import('./v1/build/ve4626/_unlock.js'),
  'build/ajna/borrow': () => import('./v1/build/ajna/_borrow.js'),
  'build/ajna/repay': () => import('./v1/build/ajna/_repay.js'),
  'build/ajna/addCollateral': () => import('./v1/build/ajna/_addCollateral.js'),
  'build/ajna/removeCollateral': () => import('./v1/build/ajna/_removeCollateral.js'),
  'build/ajna/setMinBucketIndex': () => import('./v1/build/ajna/_setMinBucketIndex.js'),
  'build/ajna/setIdleBufferBps': () => import('./v1/build/ajna/_setIdleBufferBps.js'),
  'build/charm/setCharmVault': () => import('./v1/build/charm/_setCharmVault.js'),
  'build/charm/setSwapPool': () => import('./v1/build/charm/_setSwapPool.js'),
  'build/charm/setUniFactory': () => import('./v1/build/charm/_setUniFactory.js'),
  'build/charm/setAutoFeeTier': () => import('./v1/build/charm/_setAutoFeeTier.js'),
  'build/charm/setParameters': () => import('./v1/build/charm/_setParameters.js'),
  'build/charm/setActive': () => import('./v1/build/charm/_setActive.js'),
  'build/charm/initializeApprovals': () => import('./v1/build/charm/_initializeApprovals.js'),
  'build/charm/rebalance': () => import('./v1/build/charm/_rebalance.js'),
  'build/charm/ownerEmergencyWithdraw': () => import('./v1/build/charm/_ownerEmergencyWithdraw.js'),
  'build/charm/ownerEmergencyWithdrawFromCharm': () => import('./v1/build/charm/_ownerEmergencyWithdrawFromCharm.js'),
  'build/charm/vault/rebalance': () => import('./v1/build/charm/vault/_rebalance.js'),
  'build/charm/vault/setStrategy': () => import('./v1/build/charm/vault/_setStrategy.js'),
}

const TOKEN_PATTERN = /^token\/([a-fA-F0-9x]+)\/(metadata|tokenlist)$/
const VAULT_PATTERN = /^vault\/([a-fA-F0-9x]+)\/(report|strategies)$/
const WORKSPACE_PATTERN = /^workspace\/([a-fA-F0-9x]+)\/(summary|strategies|monitoring|activity|rooms|tasks|settings|actions)$/
const AUCTION_PATTERN = /^auction\/([a-fA-F0-9x]+)\/(status|activity|recentBids)$/
const LOTTERY_CREATOR_PATTERN = /^lottery\/creator\/([a-fA-F0-9x]+)$/
const GAUGE_USER_PATTERN = /^gauge\/user\/([a-fA-F0-9x]+)$/
const VE4626_USER_PATTERN = /^ve4626\/user\/([a-fA-F0-9x]+)$/
const CHARM_STRATEGY_PATTERN = /^charm\/strategy\/([a-fA-F0-9x]+)$/

async function loadExact(routeKey: string): Promise<ApiHandler | null> {
  const loader = v1RouteLoaders[routeKey]
  if (!loader) return null
  const mod = await loader()
  return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
}

function withInjectedQuery(baseHandler: ApiHandler, inject: (req: VercelRequest) => void): ApiHandler {
  return (req, res) => {
    inject(req)
    return baseHandler(req, res)
  }
}

export async function getV1ApiHandler(subpath: string): Promise<ApiHandler | null> {
  const exact = await loadExact(subpath)
  if (exact) return exact

  const tokenMatch = subpath.match(TOKEN_PATTERN)
  if (tokenMatch) {
    const [, address, action] = tokenMatch
    const loader = action === 'metadata'
      ? () => import('./token/_metadata.js')
      : () => import('./token/_tokenlist.js')
    const mod = await loader()
    const baseHandler = mod?.default
    if (typeof baseHandler === 'function') {
      return withInjectedQuery(baseHandler as ApiHandler, (req) => {
        if (!req.query.address) req.query.address = address
      })
    }
  }

  const vaultMatch = subpath.match(VAULT_PATTERN)
  if (vaultMatch) {
    const [, address, action] = vaultMatch
    const baseHandler = await loadExact(`vault/${action}`)
    if (baseHandler) {
      return withInjectedQuery(baseHandler, (req) => {
        if (!req.query.address) req.query.address = address
        if (!req.query.vault) req.query.vault = address
      })
    }
  }

  const workspaceMatch = subpath.match(WORKSPACE_PATTERN)
  if (workspaceMatch) {
    const [, address, action] = workspaceMatch
    const baseHandler = await loadExact(`workspace/${action}`)
    if (baseHandler) {
      return withInjectedQuery(baseHandler, (req) => {
        if (!req.query.address) req.query.address = address
        if (!req.query.vault) req.query.vault = address
      })
    }
  }

  const auctionMatch = subpath.match(AUCTION_PATTERN)
  if (auctionMatch) {
    const [, address, action] = auctionMatch
    const baseHandler = await loadExact(`auction/${action}`)
    if (baseHandler) {
      return withInjectedQuery(baseHandler, (req) => {
        if (!req.query.address) req.query.address = address
        if (action === 'recentBids') {
          if (!req.query.auction) req.query.auction = address
        } else if (!req.query.ccaStrategy) {
          req.query.ccaStrategy = address
        }
      })
    }
  }

  const lotteryCreatorMatch = subpath.match(LOTTERY_CREATOR_PATTERN)
  if (lotteryCreatorMatch) {
    const [, address] = lotteryCreatorMatch
    const baseHandler = await loadExact('lottery/creator')
    if (baseHandler) {
      return withInjectedQuery(baseHandler, (req) => {
        if (!req.query.address) req.query.address = address
        if (!req.query.creatorCoin) req.query.creatorCoin = address
      })
    }
  }

  const gaugeUserMatch = subpath.match(GAUGE_USER_PATTERN)
  if (gaugeUserMatch) {
    const [, address] = gaugeUserMatch
    const baseHandler = await loadExact('gauge/user')
    if (baseHandler) {
      return withInjectedQuery(baseHandler, (req) => {
        if (!req.query.address) req.query.address = address
        if (!req.query.user) req.query.user = address
      })
    }
  }

  const veUserMatch = subpath.match(VE4626_USER_PATTERN)
  if (veUserMatch) {
    const [, address] = veUserMatch
    const baseHandler = await loadExact('ve4626/user')
    if (baseHandler) {
      return withInjectedQuery(baseHandler, (req) => {
        if (!req.query.address) req.query.address = address
        if (!req.query.user) req.query.user = address
      })
    }
  }

  const charmStrategyMatch = subpath.match(CHARM_STRATEGY_PATTERN)
  if (charmStrategyMatch) {
    const [, address] = charmStrategyMatch
    const baseHandler = await loadExact('charm/strategy')
    if (baseHandler) {
      return withInjectedQuery(baseHandler, (req) => {
        if (!req.query.address) req.query.address = address
      })
    }
  }

  return null
}
