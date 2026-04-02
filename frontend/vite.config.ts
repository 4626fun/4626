import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { URL } from 'url'
import type { IncomingMessage, ServerResponse } from 'http'

import { classifyManualChunk } from './src/lib/viteManualChunks'
import { zoraCliRoutePaths } from './api/_handlers/zora/cli/_routes'

const buildTelegramLinkStandalone = process.env.TELEGRAM_LINK_STANDALONE_BUILD === '1'
const nodeRequire = createRequire(import.meta.url)

function loadDotEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (!key) continue
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

async function readRequestBody(req: IncomingMessage): Promise<string | undefined> {
  const method = (req.method ?? '').toUpperCase()
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') return undefined
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (chunks.length === 0) return undefined
  return Buffer.concat(chunks).toString('utf8')
}

function makeVercelCompatReq(req: IncomingMessage, body?: string): any {
  const host = req.headers.host ?? 'localhost'
  const url = new URL(req.url ?? '/', `http://${host}`)
  // Use a null-prototype object to avoid prototype pollution via query keys.
  const query: Record<string, string | string[] | undefined> = Object.create(null)
  // Avoid TS downlevel-iteration requirements by using forEach (Vite config runs in Node anyway).
  url.searchParams.forEach((v, k) => {
    // last value wins (good enough for our use-cases)
    query[k] = v
  })
  // Avoid assign-with-user-input scanner patterns; mutate a local object directly.
  const r: any = req as any
  r.query = query
  r.cookies = {}
  // Local API handlers expect `req.body` to already be an object (Vercel behavior).
  // Parse JSON here because the stream is consumed by the middleware before handler code runs.
  let parsedBody: unknown = undefined
  if (typeof body === 'string' && body.length > 0) {
    const ct = String(req.headers['content-type'] ?? '').toLowerCase()
    if (ct.includes('application/json')) {
      try {
        parsedBody = JSON.parse(body)
      } catch {
        parsedBody = undefined
      }
    } else {
      parsedBody = body
    }
  }
  r.body = parsedBody
  return r
}

function makeVercelCompatRes(res: ServerResponse): any {
  const r: any = res
  r.status = (code: number) => {
    res.statusCode = code
    return r
  }
  r.json = (jsonBody: any) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(jsonBody))
    return r
  }
  r.send = (body: any) => {
    if (body === undefined || body === null) {
      res.end()
      return r
    }
    if (Buffer.isBuffer(body)) {
      res.end(body)
      return r
    }
    if (body instanceof Uint8Array) {
      res.end(Buffer.from(body))
      return r
    }
    if (typeof body === 'object') {
      if (!res.headersSent) res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(body))
      return r
    }
    res.end(typeof body === 'string' ? body : String(body))
    return r
  }
  r.redirect = (statusCode: number, location: string) => {
    res.statusCode = statusCode
    res.setHeader('Location', location)
    res.end()
    return r
  }
  return r
}

function localApiRoutesPlugin(): Plugin {
  return {
    name: '4626-local-api-routes',
    apply: 'serve',
    configureServer(server) {
      // Load repo envs (secrets) into process.env for local /api handlers.
      // - Prefer repo root .env (BASE_RPC_URL, BASE_LOGS_RPC_URL, ZORA_SERVER_API_KEY, etc.)
      // - Also load frontend/.env if present.
      loadDotEnvFile(path.resolve(__dirname, '../.env'))
      loadDotEnvFile(path.resolve(__dirname, './.env'))

      // Local dev note:
      // Our API handlers use `server/_lib/postgres.ts`, which treats `POSTGRES_URL*` as Vercel Postgres.
      // In local dev we typically want to use `DATABASE_URL` (e.g. Supabase) via `pg`.
      // Clear Vercel-specific envs so local API routing doesn't accidentally use @vercel/postgres.
      try {
        delete (process.env as any).POSTGRES_URL
        delete (process.env as any).POSTGRES_URL_NON_POOLING
      } catch {
        // ignore
      }

      // Local dev DB TLS compatibility:
      // Some environments (and some Supabase pooler endpoints) can present cert chains that fail Node verification.
      // Force `sslmode=no-verify` for local dev so API routes can connect.
      try {
        const raw = (process.env.DATABASE_URL ?? '').trim()
        if (raw) {
          const u = new URL(raw)
          // Supabase pooler hostnames can vary (aws-0 vs aws-1) depending on the dashboard-provided string.
          // Prefer the dashboard value if we detect the older host.
          if (u.hostname === 'aws-0-us-east-2.pooler.supabase.com') {
            u.hostname = 'aws-1-us-east-2.pooler.supabase.com'
          }
          const cur = (u.searchParams.get('sslmode') ?? '').toLowerCase()
          if (!cur || cur === 'require' || cur === 'verify-full' || cur === 'verify-ca' || cur === 'prefer') {
            u.searchParams.set('sslmode', 'no-verify')
            process.env.DATABASE_URL = u.toString()
          }
        }
      } catch {
        // ignore invalid URLs
      }

      // Keep this loosely typed: API handlers often return `VercelResponse`, and we don't want
      // Vite's config TS project to type-check every function signature.
      const routes: Record<string, () => Promise<{ default: (req: any, res: any) => any }>> = {
        '/api/creator-allowlist': () => import('./api/_handlers/_creator-allowlist'),
        '/api/waitlist': () => import('./api/[...path]'),
        '/api/waitlist/join': () => import('./api/_handlers/waitlist/_join'),
        '/api/waitlist/bootstrap': () => import('./api/_handlers/waitlist/_bootstrap'),
        '/api/waitlist/csw-link': () => import('./api/_handlers/waitlist/_csw-link'),
        '/api/waitlist/ledger': () => import('./api/_handlers/waitlist/_ledger'),
        '/api/waitlist/me': () => import('./api/_handlers/waitlist/_me'),
        '/api/waitlist/leaderboard': () => import('./api/_handlers/waitlist/_leaderboard'),
        '/api/waitlist/position': () => import('./api/_handlers/waitlist/_position'),
        '/api/waitlist/profile-complete': () => import('./api/_handlers/waitlist/_profile-complete'),
        '/api/waitlist/task-claim': () => import('./api/_handlers/waitlist/_task-claim'),
        '/api/waitlist/update-email': () => import('./api/_handlers/waitlist/_update-email'),
        '/api/waitlist/verify-social': () => import('./api/_handlers/waitlist/_verify-social'),
        '/api/onchain/coinMarketRewardsByCoin': () => import('./api/_handlers/onchain/_coinMarketRewardsByCoin'),
        '/api/onchain/coinMarketRewardsCurrency': () => import('./api/_handlers/onchain/_coinMarketRewardsCurrency'),
        '/api/onchain/coinTradeRewardsBatch': () => import('./api/_handlers/onchain/_coinTradeRewardsBatch'),
        '/api/token/metadata': () => import('./api/_handlers/token/_metadata'),
        '/api/token/image': () => import('./api/_handlers/token/_image'),
        '/api/zora/coin': () => import('./api/_handlers/zora/_coin'),
        [zoraCliRoutePaths.authStatus]: () => import('./api/_handlers/zora/cli/_authStatus'),
        [zoraCliRoutePaths.explore]: () => import('./api/_handlers/zora/cli/_explore'),
        [zoraCliRoutePaths.get]: () => import('./api/_handlers/zora/cli/_get'),
        [zoraCliRoutePaths.priceHistory]: () => import('./api/_handlers/zora/cli/_priceHistory'),
        [zoraCliRoutePaths.profile]: () => import('./api/_handlers/zora/cli/_profile'),
        '/api/zora/explore': () => import('./api/_handlers/zora/_explore'),
        '/api/zora/link/status': () => import('./api/_handlers/zora/link/_status'),
        '/api/zora/metrics': () => import('./api/_handlers/zora/_metrics'),
        '/api/zora/refresh': () => import('./api/_handlers/zora/_refresh'),
        '/api/zora/profile': () => import('./api/_handlers/zora/_profile'),
        '/api/zora/profileCoins': () => import('./api/_handlers/zora/_profileCoins'),
        '/api/zora/resolve': () => import('./api/_handlers/zora/_resolve'),
        '/api/zora/topCreators': () => import('./api/_handlers/zora/_topCreators'),
        '/api/debank/totalBalanceBatch': () => import('./api/_handlers/debank/_totalBalanceBatch'),
        '/api/debank/tokenList': () => import('./api/_handlers/debank/_tokenList'),
        '/api/dexscreener/tokenStatsBatch': () => import('./api/_handlers/dexscreener/_tokenStatsBatch'),
        '/api/status/protocolReport': () => import('./api/_handlers/status/_protocolReport'),
        '/api/status/vaultReport': () => import('./api/_handlers/status/_vaultReport'),
        '/api/auth/admin': () => import('./api/_handlers/auth/_admin'),
        '/api/auth/agent-nonce': () => import('./api/_handlers/auth/_agent-nonce'),
        '/api/auth/agent-verify': () => import('./api/_handlers/auth/_agent-verify'),
        '/api/auth/nonce': () => import('./api/_handlers/auth/_nonce'),
        '/api/auth/privy': () => import('./api/_handlers/auth/_privy'),
        '/api/auth/verify': () => import('./api/_handlers/auth/_verify'),
        '/api/auth/me': () => import('./api/_handlers/auth/_me'),
        '/api/auth/logout': () => import('./api/_handlers/auth/_logout'),
        '/api/onboarding/bootstrap': () => import('./api/_handlers/onboarding/_bootstrap'),
        '/api/accounts/me': () => import('./api/_handlers/accounts/_me'),
        '/api/accounts/link': () => import('./api/_handlers/accounts/_link'),
        '/api/accounts/unlink': () => import('./api/_handlers/accounts/_unlink'),
        '/api/creator-wallets/claim': () => import('./api/_handlers/_creator-wallets-claim'),
        '/api/image/projects/create': () => import('./api/_handlers/image/_projects-create'),
        '/api/image/projects/assets/upload': () => import('./api/_handlers/image/_assets-upload'),
        '/api/image/projects/generate': () => import('./api/_handlers/image/_generate'),
        '/api/image/projects/refine': () => import('./api/_handlers/image/_refine'),
        '/api/image/jobs/status': () => import('./api/_handlers/image/_jobs-status'),
        '/api/image/projects/get': () => import('./api/_handlers/image/_projects-get'),
        '/api/image/projects/associate-vault': () => import('./api/_handlers/image/_associate-vault'),
        '/api/image/projects/auto-assets': () => import('./api/_handlers/image/_auto-assets'),
        '/api/image/projects/direct-compose': () => import('./api/_handlers/image/_direct-compose'),
        '/api/image/projects/vault-image': () => import('./api/_handlers/image/_vault-image-get'),
        '/api/image/external': () => import('./api/_handlers/image/_external-proxy'),
        '/api/deploy/config': () => import('./api/_handlers/deploy/_config'),
        '/api/deploy/smartWalletOwner': () => import('./api/_handlers/deploy/_smartWalletOwner'),
        '/api/deploy/session/cancel': () => import('./api/_handlers/deploy/session/_cancel'),
        '/api/deploy/session/bootstrapSwap': () => import('./api/_handlers/deploy/session/_bootstrapSwap'),
        '/api/deploy/session/continue': () => import('./api/_handlers/deploy/session/_continue'),
        '/api/deploy/session/create': () => import('./api/_handlers/deploy/session/_create'),
        '/api/deploy/session/dry-run': () => import('./api/_handlers/deploy/session/_dryRun'),
        '/api/deploy/session/start': () => import('./api/_handlers/deploy/session/_start'),
        '/api/deploy/session/status': () => import('./api/_handlers/deploy/session/_status'),
        '/api/deploy/solanaInfraStatus': () => import('./api/[...path]'),
        '/api/deploy/provisionSolanaRoute': () => import('./api/[...path]'),
        '/api/deploy/registerSolanaBridgeToken': () => import('./api/[...path]'),
        '/api/wallet/prepare-add-privy-owner': () => import('./api/_handlers/wallet/_prepare-add-privy-owner'),
        '/api/wallet/confirm-owner': () => import('./api/_handlers/wallet/_confirm-owner'),
        '/api/wallet/prepare-add-rabby-owner': () => import('./api/_handlers/wallet/_prepare-add-rabby-owner'),
        '/api/wallet/solana/setCanonical': () => import('./api/[...path]'),
        '/api/wallet/solana/sweep/enqueue': () => import('./api/[...path]'),
        '/api/wallet/solana/sweep/process': () => import('./api/[...path]'),
        '/api/telegram/webhook': () => import('./api/_handlers/telegram/_webhook'),
        '/api/rpc': () => import('./api/_handlers/rpc/_proxy'),

        // Keepr (local dev)
        '/api/keepr/nonce': () => import('./api/_handlers/keepr/_nonce'),
        '/api/keepr/join': () => import('./api/_handlers/keepr/_join'),
        '/api/keepr/vault/upsert': () => import('./api/_handlers/keepr/vault/_upsert'),

        '/api/onchain/protocolRewardsClaimable': () => import('./api/_handlers/onchain/_protocolRewardsClaimable'),
        '/api/onchain/protocolRewardsWithdrawn': () => import('./api/_handlers/onchain/_protocolRewardsWithdrawn'),
        '/api/uniswap/query': () => import('./api/_handlers/uniswap/_query'),
        '/api/uniswap/poolHistory': () => import('./api/_handlers/uniswap/_poolHistory'),
        '/api/uniswap/quote': () => import('./api/_handlers/uniswap/_quote'),
        '/api/uniswap/swap': () => import('./api/_handlers/uniswap/_swap'),
        '/api/uniswap/order': () => import('./api/_handlers/uniswap/_order'),
        '/api/uniswap/checkApproval': () => import('./api/_handlers/uniswap/_checkApproval'),
        '/api/uniswap/checkDelegation': () => import('./api/_handlers/uniswap/_checkDelegation'),
        '/api/uniswap/swap5792': () => import('./api/_handlers/uniswap/_swap5792'),
        '/api/uniswap/swap7702': () => import('./api/_handlers/uniswap/_swap7702'),
        '/api/uniswap/plan': () => import('./api/_handlers/uniswap/_plan'),
        '/api/uniswap/liquidity': () => import('./api/_handlers/uniswap/_liquidity'),
        '/api/agent/invokeSkill': () => import('./api/_handlers/agent/_invokeSkill'),
        '/api/lens/mapping': () => import('./api/_handlers/lens/_mapping'),
        '/api/lens/graph': () => import('./api/_handlers/lens/_graph'),
        '/api/lens/share-token-metadata': () => import('./api/_handlers/lens/_share-token-metadata'),
        '/api/lens/agent-registration': () => import('./api/_handlers/lens/_agent-registration'),
        '/api/lens/reputation-graph': () => import('./api/_handlers/lens/_reputation-graph'),
        '/api/lens/feedback-payload': () => import('./api/_handlers/lens/_feedback-payload'),
        // ERC-8004 feedback
        '/api/v1/agents/feedback': () => import('./api/_handlers/v1/agents/feedback/_read'),
        '/api/v1/agents/feedback/submit': () => import('./api/_handlers/v1/agents/feedback/_submit'),
        '/api/v1/agents/wallet-intelligence': () => import('./api/_handlers/v1/agents/_wallet-intelligence'),
        // Referrals
        '/api/referrals/click': () => import('./api/_handlers/referrals/_click'),
        '/api/referrals/me': () => import('./api/_handlers/referrals/_me'),
        '/api/referrals/leaderboard': () => import('./api/_handlers/referrals/_leaderboard'),
        // Social proxies
        '/api/social/recipient': () => import('./api/_handlers/social/_recipient'),
        '/api/social/twitter': () => import('./api/_handlers/social/_twitter'),
        '/api/social/talent': () => import('./api/_handlers/social/_talent'),
        '/api/openclaw/tools': () => import('./api/_handlers/openclaw/_tools'),
        '/api/openclaw/execute': () => import('./api/_handlers/openclaw/_execute'),
        '/api/v1/chat/command-preflight': () => import('./api/_handlers/v1/chat/_commandPreflight'),
        '/api/v1/chat/telemetry': () => import('./api/_handlers/v1/chat/_telemetry'),
      }
      const patternRoutes: Array<{
        pattern: RegExp
        load: () => Promise<{ default: (req: any, res: any) => any }>
        applyQuery: (match: RegExpMatchArray, req: any) => void
      }> = [
        {
          pattern: /^\/api\/v1\/token\/([a-fA-F0-9x]+)\/image$/,
          load: () => import('./api/_handlers/token/_image'),
          applyQuery: (match, req) => {
            req.query = req.query ?? Object.create(null)
            if (!req.query.address) req.query.address = match[1]
          },
        },
        {
          pattern: /^\/api\/v1\/token\/([a-fA-F0-9x]+)\/logo\.(png|svg)$/,
          load: () => import('./api/_handlers/token/_image'),
          applyQuery: (match, req) => {
            req.query = req.query ?? Object.create(null)
            if (!req.query.address) req.query.address = match[1]
            if (!req.query.format) req.query.format = match[2]
            if (!req.query.size) req.query.size = '64'
          },
        },
      ]
      const catchAllApiRoute = () => import('./api/[...path]')

      server.middlewares.use(async (req, res, next) => {
        try {
          const host = req.headers.host ?? 'localhost'
          const url = new URL(req.url ?? '/', `http://${host}`)
          // Support the `/__api/*` alias in local dev (the client prefers it to avoid adblock rules).
          const pathname = url.pathname.startsWith('/__api/') ? `/api/${url.pathname.slice('/__api/'.length)}` : url.pathname
          const isApiPath = pathname === '/api' || pathname.startsWith('/api/')
          let loader = routes[pathname]
          let patternMatch: RegExpMatchArray | null = null
          let patternRoute = null as (typeof patternRoutes)[number] | null
          if (!loader) {
            for (const candidate of patternRoutes) {
              const match = pathname.match(candidate.pattern)
              if (!match) continue
              loader = candidate.load
              patternMatch = match
              patternRoute = candidate
              break
            }
          }
          const useCatchAll = !loader && isApiPath
          if (useCatchAll) loader = catchAllApiRoute
          if (!loader) return next()

          const body = await readRequestBody(req as IncomingMessage)
          const mod = await loader()
          const handler = mod.default
          if (typeof handler !== 'function') return next()

          const compatReq = makeVercelCompatReq(req as any, body)
          if (patternRoute && patternMatch) {
            patternRoute.applyQuery(patternMatch, compatReq)
          }
          if (useCatchAll) {
            const subpath = pathname === '/api' ? '' : pathname.slice('/api/'.length)
            compatReq.query = compatReq.query ?? Object.create(null)
            compatReq.query.path = subpath ? subpath.split('/').filter(Boolean) : []
          }
          await handler(compatReq, makeVercelCompatRes(res as any))
        } catch (e) {
          // Structured error logging for dev server
          const err = e instanceof Error ? e : new Error(String(e))
          console.error(`[local api routes] error: ${err.message}`, err.stack ? `\n${err.stack}` : '')
          if (!res.headersSent) {
            ;(res as any).statusCode = 500
            ;(res as any).setHeader?.('Content-Type', 'application/json')
          }
          ;(res as any).end?.(JSON.stringify({ success: false, error: 'Local API route failed' }))
        }
      })
    },
  }
}

function resolveOxCjsPlugin(): Plugin {
  return {
    name: '4626-resolve-ox-cjs',
    enforce: 'pre',
    resolveId(source) {
      if (source !== 'ox' && !source.startsWith('ox/')) return null
      return nodeRequire.resolve(source, { paths: [__dirname] })
    },
  }
}

export default defineConfig(({ command }) => {
  const enableSourcemap = (() => {
    const raw = (process.env.VITE_BUILD_SOURCEMAP ?? '').trim().toLowerCase()
    return raw === '1' || raw === 'true' || raw === 'yes'
  })()
  const devServerHost: true | string = (() => {
    const raw = (process.env.VITE_DEV_SERVER_HOST ?? '').trim()
    const normalized = raw.toLowerCase()
    if (!normalized || normalized === 'false' || normalized === 'no' || normalized === '0') {
      // Secure-by-default local binding.
      return '127.0.0.1'
    }
    if (normalized === 'true' || normalized === 'yes' || normalized === '1') {
      // Explicit opt-in for network exposure (binds 0.0.0.0 in Vite).
      return true
    }
    // Allow explicit host values like 0.0.0.0 or localhost.
    return raw
  })()
  const buildInputs: Record<string, string> = buildTelegramLinkStandalone
    ? {
        telegramLink: resolve(__dirname, 'telegram-link.html'),
      }
    : {
        index: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
      }

  return {
    plugins: [resolveOxCjsPlugin(), react(), tailwindcss(), ...(command === 'serve' ? [localApiRoutesPlugin()] : [])],
    // Default localhost-only. Set VITE_DEV_SERVER_HOST=true (or 0.0.0.0) to expose on LAN/WSL.
    server: {
      host: devServerHost,
      port: 5173,
      strictPort: true,
    },
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, './src') },
      // Wallet SDKs expect `buffer` to exist; map Node built-in to the browser shim.
      { find: 'buffer', replacement: 'buffer/' },
    ],
    // pnpm can result in multiple copies of a package being bundled, which breaks React context
    // based libraries like Privy (provider + hooks must resolve to the same module instance).
    dedupe: ['@privy-io/react-auth', '@privy-io/wagmi'],
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['buffer'],
    // @xmtp/browser-sdk uses Web Workers (workers/client) that Vite's dep optimizer cannot handle
    exclude: ['@xmtp/browser-sdk'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    // Keep the Telegram link standalone artifact isolated from the main app
    // graph. This avoids reintroducing the shared-chunk crash path that the
    // standalone extraction is meant to prevent.
    modulePreload: buildTelegramLinkStandalone ? false : undefined,
    minify: buildTelegramLinkStandalone ? false : 'esbuild',
    sourcemap: enableSourcemap,
    rollupOptions: {
      input: buildInputs,
      output: {
        // Route-level lazy imports already split page code well. The remaining
        // hotspots are shared SDK families that otherwise collapse into a few
        // oversized vendor chunks.
        ...(buildTelegramLinkStandalone ? {} : { manualChunks: classifyManualChunk }),
      },
    },
  },
  }
})
