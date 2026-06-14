export const API_ENDPOINTS = {
  auth: {
    admin: '/api/auth/admin',
  },
  creator: {
    allowlist: '/api/creator-allowlist',
    accessStatus: '/api/creator-access/status',
    accessRequest: '/api/creator-access/request',
  },
  waitlist: {
    leaderboard: '/api/waitlist/leaderboard',
  },
  zora: {
    metrics: '/api/zora/metrics',
  },
  workspace: {
    summary: '/api/v1/workspace/summary',
    strategies: '/api/v1/workspace/strategies',
    monitoring: '/api/v1/workspace/monitoring',
    activity: '/api/v1/workspace/activity',
    rooms: '/api/v1/workspace/rooms',
    tasks: '/api/v1/workspace/tasks',
    settings: '/api/v1/workspace/settings',
    actions: '/api/v1/workspace/actions',
  },
  explore: {
    vaults: '/api/v1/explore/vaults',
  },
  image: {
    createProject: '/api/image/projects/create',
    uploadAsset: '/api/image/projects/assets/upload',
    generate: '/api/image/projects/generate',
    refine: '/api/image/projects/refine',
    jobStatus: '/api/image/jobs/status',
    getProject: '/api/image/projects/get',
    directCompose: '/api/image/projects/direct-compose',
    autoAssets: '/api/image/projects/auto-assets',
    vaultImage: '/api/image/projects/vault-image',
    associateVault: '/api/image/projects/associate-vault',
  },
  uniswap: {
    quote: '/api/uniswap/quote',
    checkApproval: '/api/uniswap/checkApproval',
    swap: '/api/uniswap/swap',
    order: '/api/uniswap/order',
    swap5792: '/api/uniswap/swap5792',
    swap7702: '/api/uniswap/swap7702',
    checkDelegation: '/api/uniswap/checkDelegation',
    plan: '/api/uniswap/plan',
  },
  cdpSwap: {
    price: '/api/cdp/swap/price',
    execute: '/api/cdp/swap/execute',
  },
  agent: {
    creative: '/api/agent/creative',
  },
  chat: {
    hermit: '/api/v1/chat/hermit',
  },
  alfaclub: {
    counterTradeStatus: '/api/v1/alfaclub/counter-trade-status',
    backtestSweep: '/api/v1/alfaclub/backtest-sweep',
    backtestRun: '/api/v1/alfaclub/backtest-run',
    backtestMarkets: '/api/v1/alfaclub/backtest-markets',
  },
} as const
