import { createLogger, defineConfig, type Logger, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'node:url'
import { URL } from 'url'
import type { IncomingMessage, ServerResponse } from 'http'

import { classifyManualChunk } from './src/lib/viteManualChunks'
import { zoraCliRoutePaths } from './api/_handlers/zora/cli/_routes'

const ESBUILD_DEAD_RE =
  /The service is no longer running|The service was stopped|write EPIPE/i

/** WalletConnect / Coinbase SDK packages ship incomplete sourcemaps — Vite warns on every file. */
function createDevLogger(failFastOnEsbuildDeath: boolean): Logger {
  const logger = createLogger('info')
  const isMissingSourcemapNoise = (msg: string) => msg.includes('points to missing source files')
  let esbuildExitScheduled = false

  const scheduleEsbuildRestartExit = (msg: string) => {
    if (!failFastOnEsbuildDeath || esbuildExitScheduled || !ESBUILD_DEAD_RE.test(msg)) return
    esbuildExitScheduled = true
    logger.warn(
      'esbuild transform service died (often WSL memory pressure). Exiting so deploy dry-run can restart Vite...',
    )
    setTimeout(() => process.exit(1), 300)
  }

  const wrap =
    (fn: Logger['warn']) =>
    (msg: string, options?: Parameters<Logger['warn']>[1]) => {
      if (isMissingSourcemapNoise(msg)) return
      scheduleEsbuildRestartExit(msg)
      fn(msg, options)
    }
  logger.warn = wrap(logger.warn)
  logger.warnOnce = wrap(logger.warnOnce)
  logger.error = wrap(logger.error)
  return logger
}

function resolveFrontendRoot(): string {
  const fromMeta = path.dirname(fileURLToPath(import.meta.url))
  if (fs.existsSync(path.join(fromMeta, 'api', '_handlers'))) return fromMeta

  const fromCwd = process.cwd()
  if (fs.existsSync(path.join(fromCwd, 'api', '_handlers'))) return fromCwd
  if (fs.existsSync(path.join(fromCwd, 'frontend', 'api', '_handlers'))) {
    return path.join(fromCwd, 'frontend')
  }

  return fromMeta
}

const frontendRoot = resolveFrontendRoot()

function resolveApiModulePath(relativePath: string): string {
  const normalized = relativePath.replace(/^\.\//, '')
  const basePath = path.join(frontendRoot, normalized)
  if (fs.existsSync(basePath)) return basePath

  for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
    const candidate = `${basePath}${ext}`
    if (fs.existsSync(candidate)) return candidate
  }

  throw new Error(`[vite] apiImport: module not found for ${relativePath} (resolved ${basePath})`)
}

let tsxLoader: typeof import('tsx/esm/api') | null = null

async function loadApiModule(absPath: string) {
  if (!tsxLoader) {
    tsxLoader = await import('tsx/esm/api')
  }
  return tsxLoader.tsImport(absPath, import.meta.url) as Promise<{
    default: (req: any, res: any) => any
  }>
}

/** Keep local API handler paths out of Vite configFileDependencies (avoids full server restart + esbuild crash on every api/ edit). */
function apiImport(relativePath: string) {
  const absPath = resolveApiModulePath(relativePath)
  return () => loadApiModule(absPath)
}

const buildTelegramLinkStandalone = process.env.TELEGRAM_LINK_STANDALONE_BUILD === '1'
const deployDryRunDev = Boolean(String(process.env.DEPLOY_DRY_RUN_PORT ?? '').trim())
// Opt-in only: skip optimizeDeps discovery when WSL/RAM is tight (export VITE_LOW_MEMORY=1).
const lowMemoryDev = process.env.VITE_LOW_MEMORY === '1'
// CJS packages that break in the browser when low-memory skips full dep discovery.
const alwaysOptimizeInclude = [
  'buffer',
  'cookie',
  'set-cookie-parser',
  'ox',
  'ox/erc8010',
  'viem',
] as const
const nodeRequire = createRequire(import.meta.url)
const dotenvLoadedKeys = new Set<string>()

function buildDevWatchIgnored(): string[] {
  const repoRoot = path.resolve(frontendRoot, '..')
  return [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/.vite/**',
    // Local API handlers run via tsx at request time — not part of the client HMR graph.
    path.join(frontendRoot, 'api'),
    path.join(frontendRoot, 'server'),
    // Monorepo siblings outside the SPA dev graph (Forge submodules, keepers, etc.).
    path.join(repoRoot, 'contracts'),
    path.join(repoRoot, 'lib'),
    path.join(repoRoot, 'kpr'),
    path.join(repoRoot, 'programs'),
    path.join(repoRoot, 'indexer'),
    path.join(repoRoot, 'apps'),
    path.join(repoRoot, '.worktrees'),
  ]
}

function resolveDevServerWatch() {
  const usePolling = deployDryRunDev
    ? process.env.VITE_WATCH_POLLING !== '0'
    : process.env.VITE_WATCH_POLLING === '1'
  return {
    ignored: buildDevWatchIgnored(),
    ...(usePolling ? { usePolling: true, interval: 1000 } : {}),
  }
}

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
    const existing = process.env[key]
    if (existing === undefined) {
      process.env[key] = value
      dotenvLoadedKeys.add(key)
      continue
    }

    // Preserve shell-provided env precedence. For keys that were loaded from an
    // earlier dotenv file in this process, let later dotenv files override.
    // This gives local precedence ordering: repo root .env -> frontend/.env,
    // while still honoring explicit shell exports.
    if (dotenvLoadedKeys.has(key)) {
      process.env[key] = value
      dotenvLoadedKeys.add(key)
    }
  }
}

function parsePortCandidate(value: unknown): number | null {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) return null
  return parsed
}

function readCliPort(): number | null {
  const argv = process.argv
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--port') {
      return parsePortCandidate(argv[i + 1])
    }
    if (arg.startsWith('--port=')) {
      return parsePortCandidate(arg.slice('--port='.length))
    }
  }
  return null
}

function resolveDevServerPort(): number {
  const cliPort = readCliPort()
  if (cliPort) return cliPort

  const envPort = parsePortCandidate(process.env.VITE_DEV_SERVER_PORT) ?? parsePortCandidate(process.env.PORT)
  if (envPort) return envPort

  return 5173
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
        '/api/robots.txt': apiImport('./api/robots.txt'),
        '/api/sitemap.xml': apiImport('./api/sitemap.xml'),
        '/api/social-preview': apiImport('./api/social-preview'),
        '/api/social-preview-debug': apiImport('./api/social-preview-debug'),
        '/api/creator-allowlist': apiImport('./api/_handlers/creator-access/_allowlist'),
        '/api/flags/discover': apiImport('./api/_handlers/flags/_discover'),
        '/api/flags/evaluate': apiImport('./api/_handlers/flags/_evaluate'),
        '/api/waitlist/bootstrap': apiImport('./api/_handlers/waitlist/_bootstrap'),
        '/api/waitlist/lead': apiImport('./api/_handlers/waitlist/_lead'),
        '/api/waitlist/me': apiImport('./api/_handlers/waitlist/_me'),
        '/api/waitlist/leaderboard': apiImport('./api/_handlers/waitlist/_leaderboard'),
        '/api/waitlist/position': apiImport('./api/_handlers/waitlist/_position'),
        '/api/analytics/event': apiImport('./api/_handlers/analytics/_event'),
        '/api/onchain/coinTradeRewardsBatch': apiImport('./api/_handlers/onchain/_coinTradeRewardsBatch'),
        '/api/token/metadata': apiImport('./api/_handlers/token/_metadata'),
        '/api/token/image': apiImport('./api/_handlers/token/_image'),
        '/api/zora/coin': apiImport('./api/_handlers/zora/_coin'),
        '/api/zora/coinHistory': apiImport('./api/_handlers/zora/_coinHistory'),
        '/api/zora/csw-entry': apiImport('./api/_handlers/zora/_cswEntry'),
        '/api/zora/csw-entry/telegram-verify': apiImport('./api/_handlers/zora/_cswEntryTelegramVerify'),
        [zoraCliRoutePaths.authStatus]: apiImport('./api/_handlers/zora/cli/_authStatus'),
        [zoraCliRoutePaths.explore]: apiImport('./api/_handlers/zora/cli/_explore'),
        [zoraCliRoutePaths.get]: apiImport('./api/_handlers/zora/cli/_get'),
        [zoraCliRoutePaths.priceHistory]: apiImport('./api/_handlers/zora/cli/_priceHistory'),
        [zoraCliRoutePaths.profile]: apiImport('./api/_handlers/zora/cli/_profile'),
        '/api/zora/explore': apiImport('./api/_handlers/zora/_explore'),
        '/api/zora/link/status': apiImport('./api/_handlers/zora/link/_status'),
        '/api/zora/metrics': apiImport('./api/_handlers/zora/_metrics'),
        '/api/zora/migratedCoins': apiImport('./api/_handlers/zora/_migratedCoins'),
        '/api/zora/refresh': apiImport('./api/_handlers/zora/_refresh'),
        '/api/zora/profile': apiImport('./api/_handlers/zora/_profile'),
        '/api/zora/profileCoins': apiImport('./api/_handlers/zora/_profileCoins'),
        '/api/zora/resolve': apiImport('./api/_handlers/zora/_resolve'),
        '/api/zora/topCreators': apiImport('./api/_handlers/zora/_topCreators'),
        '/api/debank/totalBalanceBatch': apiImport('./api/_handlers/debank/_totalBalanceBatch'),
        '/api/debank/tokenList': apiImport('./api/_handlers/debank/_tokenList'),
        '/api/debank/walletPortfolioBatch': apiImport('./api/_handlers/debank/_walletPortfolioBatch'),
        '/api/wallet/trayPortfolio': apiImport('./api/_handlers/wallet/_trayPortfolio'),
        '/api/status/protocolReport': apiImport('./api/_handlers/status/_protocolReport'),
        '/api/status/vaultReport': apiImport('./api/_handlers/status/_vaultReport'),
        '/api/auth/admin': apiImport('./api/_handlers/auth/_admin'),
        '/api/auth/agent-nonce': apiImport('./api/_handlers/auth/_agent-nonce'),
        '/api/auth/agent-verify': apiImport('./api/_handlers/auth/_agent-verify'),
        '/api/auth/nonce': apiImport('./api/_handlers/auth/_nonce'),
        '/api/auth/privy': apiImport('./api/_handlers/auth/_privy'),
        '/api/auth/verify': apiImport('./api/_handlers/auth/_verify'),
        '/api/auth/me': apiImport('./api/_handlers/auth/_me'),
        '/api/auth/logout': apiImport('./api/_handlers/auth/_logout'),
        '/api/onboarding/bootstrap': apiImport('./api/_handlers/onboarding/_bootstrap'),
        '/api/accounts/me': apiImport('./api/_handlers/accounts/_me'),
        '/api/accounts/link': apiImport('./api/_handlers/accounts/_link'),
        '/api/accounts/unlink': apiImport('./api/_handlers/accounts/_unlink'),
        '/api/image/projects/create': apiImport('./api/_handlers/image/_projects-create'),
        '/api/image/projects/assets/upload': apiImport('./api/_handlers/image/_assets-upload'),
        '/api/image/projects/generate': apiImport('./api/_handlers/image/_generate'),
        '/api/image/projects/refine': apiImport('./api/_handlers/image/_refine'),
        '/api/image/jobs/status': apiImport('./api/_handlers/image/_jobs-status'),
        '/api/image/projects/get': apiImport('./api/_handlers/image/_projects-get'),
        '/api/image/projects/associate-vault': apiImport('./api/_handlers/image/_associate-vault'),
        '/api/image/projects/auto-assets': apiImport('./api/_handlers/image/_auto-assets'),
        '/api/image/projects/direct-compose': apiImport('./api/_handlers/image/_direct-compose'),
        '/api/image/projects/vault-image': apiImport('./api/_handlers/image/_vault-image-get'),
        '/api/image/external': apiImport('./api/_handlers/image/_external-proxy'),
        '/api/deploy/config': apiImport('./api/_handlers/deploy/_config'),
        '/api/deploy/smartWalletOwner': apiImport('./api/_handlers/deploy/_smartWalletOwner'),
        '/api/deploy/v2/session/cancel': apiImport('./api/_handlers/deploy/v2/session/_cancel'),
        '/api/deploy/v2/session/create': apiImport('./api/_handlers/deploy/v2/session/_create'),
        '/api/deploy/v2/session/dry-run': apiImport('./api/_handlers/deploy/v2/session/_dryRun'),
        '/api/deploy/v2/session/resume': apiImport('./api/_handlers/deploy/v2/session/_resume'),
        '/api/deploy/v2/session/start': apiImport('./api/_handlers/deploy/v2/session/_start'),
        '/api/deploy/v2/session/status': apiImport('./api/_handlers/deploy/v2/session/_status'),
        '/api/v1/vault/chat/status': apiImport('./api/_handlers/v1/vault/chat/_status'),
        '/api/v1/vault/chat/join': apiImport('./api/_handlers/v1/vault/chat/_join'),
        '/api/v1/vault/chat/policy': apiImport('./api/_handlers/v1/vault/chat/_policy'),
        '/api/v1/vault/chat/recheck': apiImport('./api/_handlers/v1/vault/chat/_recheck'),
        '/api/deploy/solanaInfraStatus': apiImport('./api/[...path]'),
        '/api/deploy/provisionSolanaRoute': apiImport('./api/[...path]'),
        '/api/deploy/registerSolanaBridgeToken': apiImport('./api/[...path]'),
        '/api/wallet/solana/setCanonical': apiImport('./api/[...path]'),
        '/api/wallet/solana/sweep/enqueue': apiImport('./api/[...path]'),
        '/api/wallet/solana/sweep/process': apiImport('./api/[...path]'),
        '/api/telegram/webhook': apiImport('./api/_handlers/telegram/_webhook'),
        '/api/rpc': apiImport('./api/_handlers/rpc/_proxy'),

        // Keepr (local dev)
        '/api/keepr/nonce': apiImport('./api/_handlers/keepr/_nonce'),
        '/api/keepr/join': apiImport('./api/_handlers/keepr/_join'),
        '/api/keepr/vault/upsert': apiImport('./api/_handlers/keepr/vault/_upsert'),

        '/api/onchain/protocolRewardsClaimable': apiImport('./api/_handlers/onchain/_protocolRewardsClaimable'),
        '/api/onchain/protocolRewardsWithdrawn': apiImport('./api/_handlers/onchain/_protocolRewardsWithdrawn'),
        '/api/uniswap/query': apiImport('./api/_handlers/uniswap/_query'),
        '/api/uniswap/poolHistory': apiImport('./api/_handlers/uniswap/_poolHistory'),
        '/api/uniswap/quote': apiImport('./api/_handlers/uniswap/_quote'),
        '/api/uniswap/swap': apiImport('./api/_handlers/uniswap/_swap'),
        '/api/uniswap/order': apiImport('./api/_handlers/uniswap/_order'),
        '/api/uniswap/checkApproval': apiImport('./api/_handlers/uniswap/_checkApproval'),
        '/api/uniswap/checkDelegation': apiImport('./api/_handlers/uniswap/_checkDelegation'),
        '/api/uniswap/swap5792': apiImport('./api/_handlers/uniswap/_swap5792'),
        '/api/uniswap/swap7702': apiImport('./api/_handlers/uniswap/_swap7702'),
        '/api/uniswap/plan': apiImport('./api/_handlers/uniswap/_plan'),
        '/api/uniswap/liquidity': apiImport('./api/_handlers/uniswap/_liquidity'),
        '/api/cdp/swap/price': apiImport('./api/_handlers/cdp/swap/_price'),
        '/api/cdp/swap/execute': apiImport('./api/_handlers/cdp/swap/_execute'),
        '/api/agent/creative': apiImport('./api/_handlers/agent/_creative'),
        '/api/lens/share-token-metadata': apiImport('./api/_handlers/lens/_share-token-metadata'),
        '/api/lens/agent-registration': apiImport('./api/_handlers/lens/_agent-registration'),
        '/api/lens/reputation-graph': apiImport('./api/_handlers/lens/_reputation-graph'),
        '/api/lens/feedback-payload': apiImport('./api/_handlers/lens/_feedback-payload'),
        // ERC-8004 feedback
        '/api/v1/agents/feedback': apiImport('./api/_handlers/v1/agents/feedback/_read'),
        '/api/v1/agents/feedback/submit': apiImport('./api/_handlers/v1/agents/feedback/_submit'),
        '/api/v1/agents/wallet-intelligence': apiImport('./api/_handlers/v1/agents/_wallet-intelligence'),
        // Social proxies
        '/api/social/recipient': apiImport('./api/_handlers/social/_recipient'),
        '/api/social/talent': apiImport('./api/_handlers/social/_talent'),
        '/api/v1/chat/command-preflight': apiImport('./api/_handlers/v1/chat/_commandPreflight'),
        '/api/v1/chat/availability': apiImport('./api/_handlers/v1/chat/_availability'),
        '/api/v1/chat/presence/heartbeat': apiImport('./api/_handlers/v1/chat/_presenceHeartbeat'),
        '/api/v1/chat/search': apiImport('./api/_handlers/v1/chat/_search'),
        '/api/v1/chat/agents': apiImport('./api/_handlers/v1/chat/_agents'),
        '/api/v1/chat/telemetry': apiImport('./api/_handlers/v1/chat/_telemetry'),
      }
      const patternRoutes: Array<{
        pattern: RegExp
        load: () => Promise<{ default: (req: any, res: any) => any }>
        applyQuery: (match: RegExpMatchArray, req: any) => void
      }> = [
        {
          pattern: /^\/api\/v1\/token\/([a-fA-F0-9x]+)\/image$/,
          load: apiImport('./api/_handlers/token/_image'),
          applyQuery: (match, req) => {
            req.query = req.query ?? Object.create(null)
            if (!req.query.address) req.query.address = match[1]
          },
        },
        {
          pattern: /^\/api\/v1\/token\/([a-fA-F0-9x]+)\/logo\.(png|svg)$/,
          load: apiImport('./api/_handlers/token/_image'),
          applyQuery: (match, req) => {
            req.query = req.query ?? Object.create(null)
            if (!req.query.address) req.query.address = match[1]
            if (!req.query.format) req.query.format = match[2]
            if (!req.query.size) req.query.size = '64'
          },
        },
      ]
      const catchAllApiRoute = apiImport('./api/[...path]')

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

function readLocalHostModeOverride(): string {
  const candidates = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, './.env'),
  ]
  let value = String(process.env.VITE_HOST_MODE_OVERRIDE ?? '').trim().toLowerCase()
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue
    const raw = fs.readFileSync(filePath, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      if (key !== 'VITE_HOST_MODE_OVERRIDE') continue
      value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '').toLowerCase()
    }
  }
  return value
}

const TRUST_PAGE_PATHS = new Set(['/risks', '/security', '/about', '/terms', '/privacy'])

function localMarketingLandingPlugin(): Plugin {
  return {
    name: '4626-local-marketing-landing',
    apply: 'serve',
    configureServer(server) {
      loadDotEnvFile(path.resolve(__dirname, '../.env'))
      loadDotEnvFile(path.resolve(__dirname, './.env'))

      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          next()
          return
        }

        const rawUrl = req.url ?? '/'
        const url = new URL(rawUrl, 'http://localhost')
        const isRoot = url.pathname === '/'
        const trustPagePath = TRUST_PAGE_PATHS.has(url.pathname) ? url.pathname : null
        const hostMode = readLocalHostModeOverride()
        if ((!isRoot && !trustPagePath) || hostMode !== 'marketing') {
          next()
          return
        }

        const landingPath = trustPagePath
          ? path.resolve(__dirname, `public${trustPagePath}/index.html`)
          : path.resolve(__dirname, 'public/immersive/index.html')
        fs.readFile(landingPath, 'utf8', (error, html) => {
          if (error) {
            next(error)
            return
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(html)
        })
      })
    },
  }
}

function resolveOxModulePlugin(): Plugin {
  return {
    name: '4626-resolve-ox-esm',
    enforce: 'pre',
    resolveId(source) {
      if (source !== 'ox' && !source.startsWith('ox/')) return null
      const resolved = nodeRequire.resolve(source, { paths: [frontendRoot] })
      const cjsSegment = `${path.sep}_cjs${path.sep}`
      const esmSegment = `${path.sep}_esm${path.sep}`
      if (!resolved.includes(cjsSegment)) return resolved
      const esmPath = resolved.replace(cjsSegment, esmSegment)
      return fs.existsSync(esmPath) ? esmPath : resolved
    },
  }
}

export default defineConfig(({ command }) => {
  const devServerPort = resolveDevServerPort()
  const viteCacheDir = (() => {
    const configured = (process.env.VITE_CACHE_DIR ?? '').trim()
    if (configured) return configured
    // Keep optimize-deps caches isolated per dev-server port so parallel local servers
    // do not race on the same chunk manifest and trigger "Outdated Optimize Dep" loops.
    return `node_modules/.vite/port-${devServerPort}`
  })()
  const enableSourcemap = (() => {
    const raw = (process.env.VITE_BUILD_SOURCEMAP ?? '').trim().toLowerCase()
    return raw === '1' || raw === 'true' || raw === 'yes'
  })()
  const devServerHost: true | string = (() => {
    const raw = (process.env.VITE_DEV_SERVER_HOST ?? '').trim()
    const normalized = raw.toLowerCase()
    if (!normalized || normalized === 'false' || normalized === 'no' || normalized === '0') {
      // Bind to localhost so browser origin matches Privy/SIWE/CORS allowlists.
      return 'localhost'
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
    cacheDir: viteCacheDir,
    customLogger:
      command === 'serve'
        ? createDevLogger(deployDryRunDev || process.env.VITE_ESBUILD_FAIL_FAST === '1')
        : undefined,
    plugins: [
      resolveOxModulePlugin(),
      react(),
      tailwindcss(),
      ...(command === 'serve' ? [localMarketingLandingPlugin(), localApiRoutesPlugin()] : []),
    ],
    // Default localhost-only. Set VITE_DEV_SERVER_HOST=true (or 0.0.0.0) to expose on LAN/WSL.
    server: {
      host: devServerHost,
      port: devServerPort,
      strictPort: true,
      watch: resolveDevServerWatch(),
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
    // WSL/low-RAM dev: skip esbuild pre-bundling to avoid OOM-killed esbuild (EPIPE overlay).
    ...(lowMemoryDev && command === 'serve'
      ? { noDiscovery: true, include: [...alwaysOptimizeInclude] }
      : { include: [...alwaysOptimizeInclude] }),
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
    // The app intentionally ships a few large route chunks (wallet/auth/deploy).
    // Keep the warning threshold aligned with the current split strategy so CI logs stay actionable.
    chunkSizeWarningLimit: 4000,
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
