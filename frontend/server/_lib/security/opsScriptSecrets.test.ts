import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const frontendRoot = resolve(import.meta.dirname, '../../..')
const repoRoot = resolve(frontendRoot, '..')

describe('ops script secret transport', () => {
  it('does not disable TLS verification for the runtime-secret query', () => {
    const source = readFileSync(
      resolve(frontendRoot, 'scripts/ops/send-hermit-to-1659.ts'),
      'utf8',
    )
    expect(source).not.toContain('rejectUnauthorized: false')
    expect(source).toContain('rejectUnauthorized: true')
  })

  it('does not embed paid RPC credentials', () => {
    const source = readFileSync(
      resolve(frontendRoot, 'scripts/ops/simulate-deploy-bytecode-infra.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/matrixed\.link\/rpc\/base\?auth=/)
    expect(source).toContain('BASE_PAID_RPC_URL')
  })

  it.each([
    'scripts/agent/1659-theatrical-doctor.ts',
    'scripts/agent/railway-hermit-doctor.ts',
  ])('does not print live secret values from %s', (relativePath) => {
    const source = readFileSync(resolve(repoRoot, relativePath), 'utf8')
    expect(source).not.toMatch(/`DATABASE_URL=\\$\\{process\\.env/)
    expect(source).not.toMatch(/`ALFACLUB_[A-Z_]*(?:TOKEN|JWT)=\\$\\{process\\.env/)
    expect(source).not.toMatch(/`HERMIT_AGENT_BEARER_TOKEN=\\$\\{process\\.env/)
    expect(source).toContain("return String(value ?? '').trim() ? '<set>' : '<missing>'")
  })

  it('never passes ACP refresh credentials through process argv', () => {
    const source = readFileSync(
      resolve(frontendRoot, 'server/_lib/arena/arenaClient.ts'),
      'utf8',
    )
    expect(source).not.toContain("'--refresh-token', acpRefresh")
    expect(source).toContain('Runtime ACP token rotation is disabled')
  })

  it('keeps the secret-backed deploy dry-run server loopback-only by default', () => {
    const source = readFileSync(
      resolve(frontendRoot, 'scripts/dev-deploy-dry-run.sh'),
      'utf8',
    )
    expect(source).toContain('export VITE_DEV_SERVER_HOST="localhost"')
    expect(source).toContain('DEPLOY_DRY_RUN_USE_WSL_LAN_ORIGIN')
    expect(source).not.toMatch(/grep -qi microsoft[\\s\\S]{0,200}VITE_DEV_SERVER_HOST="true"/)
  })

  it('keeps unreviewed docs refs out of Vercel preview builds', () => {
    const config = JSON.parse(
      readFileSync(resolve(repoRoot, 'apps/docs-site/vercel.json'), 'utf8'),
    ) as { ignoreCommand?: string }
    expect(config.ignoreCommand).toBe('bash scripts/vercel-ignore.sh')
  })

  it('writes synchronized keeper secrets with owner-only permissions', () => {
    const source = readFileSync(
      resolve(repoRoot, 'scripts/ops/sync-kpr-env-from-vercel.sh'),
      'utf8',
    )
    expect(source).toContain('umask 077')
    expect(source).toContain('chmod 600 "$KPR_ENV"')
  })

  it('cannot send the cron secret to a caller-selected origin', () => {
    const source = readFileSync(
      resolve(frontendRoot, 'scripts/ops/alfaclub-prod-cron-smoke.ts'),
      'utf8',
    )
    expect(source).toContain("parsed.hostname.toLowerCase() !== 'app.4626.fun'")
    expect(source).toContain('requireTrustedProductionOrigin(')
  })

  it('runs Hermit application processes without root privileges', () => {
    const agent = readFileSync(resolve(frontendRoot, 'Dockerfile.agent'), 'utf8')
    const hermit = readFileSync(resolve(frontendRoot, 'Dockerfile.hermit'), 'utf8')
    expect(agent).toContain(
      'AGENT_PROCESS:-keepr}\\" = \\"hermit\\" ]; then exec gosu node',
    )
    expect(hermit).toContain('USER node')
  })
})
